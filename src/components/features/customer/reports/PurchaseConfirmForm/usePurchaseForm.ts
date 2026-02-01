// src/components/features/customer/reports/PurchaseConfirmForm/usePurchaseForm.ts
"use client";
import { useState } from "react";
import { useToast } from "@chakra-ui/react";
import { db } from "@/lib/firebase";
import {
    doc,
    collection,
    serverTimestamp,
    query,
    where,
    getDocs,
    runTransaction
} from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { applyColonStandard } from "@/utils/textFormatter";
import { getCircledNumber } from "@/components/features/asset/AssetModalUtils";
import { performSelfHealing } from "@/utils/assetUtils";
import {
    Customer,
    User,
    ManagerOption,
    ProductOption,
    Activity,
    DeliveryInfo
} from "@/types/domain";

// --- Type Definitions ---
export interface SelectedProduct {
    id: string;
    name: string;
    quantity: number;
}

export interface PurchaseFormData {
    date: string;
    manager: string;
    selectedProducts: SelectedProduct[];
    payMethod: string;
    amount: string | number;
    discount: string;
    discountAmount: string | number;
    userId: string;
    memo: string;
    deliveryInfo: DeliveryInfo;
}

interface UsePurchaseFormProps {
    customer: Customer;
    activityId?: string;
    formData: PurchaseFormData;
    productCategory: 'product' | 'inventory';
    managerOptions: ManagerOption[];
    inventoryItems: ProductOption[];
}

/**
 * Custom Hook for Purchase Confirmation Logic
 * Handles Atomic Transactions and Business Validation
 */
export const usePurchaseForm = ({
    customer,
    activityId,
    formData,
    productCategory,
    managerOptions,
    inventoryItems
}: UsePurchaseFormProps) => {
    const { userData } = useAuth();
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(false);

    // --- Validation & Sanitization ---
    const validate = () => {
        if (formData.selectedProducts.length === 0 || !formData.payMethod || !formData.amount || !formData.manager) {
            return { isValid: false, message: "필수 항목을 모두 입력해주세요." };
        }
        if (productCategory === "inventory" && (formData.deliveryInfo.courier || formData.deliveryInfo.trackingNumber)) {
            if (!formData.deliveryInfo.deliveryAddress?.trim()) {
                return { isValid: false, message: "배송 정보 입력 시 발송 주소는 필수입니다." };
            }
        }
        return { isValid: true };
    };

    const sanitize = () => {
        const amountStr = String(formData.amount || "0");
        const discountStr = String(formData.discountAmount || "0");
        return {
            amount: parseInt(amountStr.replace(/[^0-9]/g, "")) || 0,
            discountAmount: parseInt(discountStr.replace(/[^0-9]/g, "")) || 0,
        };
    };

    // --- Submit Logic (Atomic Transaction) ---
    const handleSubmit = async () => {
        const validation = validate();
        if (!validation.isValid) {
            toast({ title: validation.message, status: "warning", duration: 3000, position: "top" });
            return false;
        }

        setIsLoading(true);
        try {
            const result = await runTransaction(db, async (transaction) => {
                const selectedManager = managerOptions.find(o => o.value === formData.manager);
                const targetActivityId = activityId || doc(collection(db, "activities")).id;
                const activityRef = doc(db, "activities", targetActivityId);

                const { amount, discountAmount } = sanitize();
                const affectedItems = new Set<string>();

                // 1. Prepare Activity Data
                const dataToSave: Partial<Activity> = {
                    customerId: customer.id,
                    customerName: customer?.name || "",
                    type: "purchase_confirm",
                    typeName: "구매 확정",
                    payMethod: formData.payMethod,
                    amount,
                    discount: formData.discount,
                    discountAmount,
                    userId: formData.userId,
                    deliveryInfo: productCategory === "inventory" ? formData.deliveryInfo : { courier: "", shipmentDate: "", trackingNumber: "", deliveryAddress: customer?.address || "" },
                    productCategory,
                    product: formData.selectedProducts.map((p, idx) => {
                        const rawName = p.name || "";
                        const cleanName = rawName.toLowerCase() === "crm" ? "CRM" : rawName;
                        return `${getCircledNumber(idx + 1)}${cleanName} × ${p.quantity}`;
                    }).join(", "),
                    memo: applyColonStandard(formData.memo || ""),
                    date: formData.date,
                    manager: formData.manager,
                    managerName: selectedManager?.label || formData.manager,
                    managerRole: (selectedManager?.role || "employee") as any,
                    updatedAt: serverTimestamp(),
                    createdByName: userData?.name || ""
                };

                // 2. Handle Activity Upsert & Clean Old Assets (Sequential in Transaction)
                if (activityId) {
                    // Fetch associated assets to delete them atomically
                    const assetQuery = query(collection(db, "assets"), where("sourceActivityId", "==", activityId));
                    const assetSnap = await getDocs(assetQuery);

                    assetSnap.docs.forEach(d => {
                        const data = d.data();
                        const itemKey = `${data.name}|${data.category}`;
                        affectedItems.add(itemKey);
                        transaction.delete(d.ref);
                    });
                    transaction.update(activityRef, dataToSave as any);
                } else {
                    const q = query(collection(db, "activities"), where("customerId", "==", customer.id), where("type", "==", "purchase_confirm"));
                    const snapshot = await getDocs(q);
                    const maxSeq = snapshot.docs.reduce((max, d) => Math.max(max, (d.data() as any).sequenceNumber || 0), 0);

                    transaction.set(activityRef, {
                        ...dataToSave,
                        sequenceNumber: maxSeq + 1,
                        createdAt: serverTimestamp(),
                        createdBy: userData?.uid
                    });
                }

                // 3. Handle Inventory Deductions (ATOMIC) & Customer Document Sync
                const customerRef = doc(db, "customers", customer.id);
                const customerSnap = await transaction.get(customerRef);
                const currentCustomer = customerSnap.exists() ? customerSnap.data() : {};

                // Track owned products (Union)
                const newProducts = formData.selectedProducts.map(p => p.name.trim());
                const existingOwned = currentCustomer.ownedProducts || [];
                const updatedOwned = Array.from(new Set([...existingOwned, ...newProducts]));

                // Update Customer Doc
                transaction.update(customerRef, {
                    lastConsultDate: formData.date,
                    ownedProducts: updatedOwned,
                    updatedAt: serverTimestamp()
                });

                // Meta-Locking for Purchase Sequence
                const metaInquiryRef = doc(db, "customer_meta", `${customer.id}_purchase`);
                const metaInquirySnap = await transaction.get(metaInquiryRef);
                const currentInquiryMeta = metaInquirySnap.exists() ? metaInquirySnap.data() : { lastSequence: 0, totalCount: 0 };

                if (!activityId) {
                    const nextSeq = (Number(currentInquiryMeta.lastSequence) || 0) + 1;
                    transaction.update(activityRef, { sequenceNumber: nextSeq });
                    transaction.set(metaInquiryRef, {
                        lastSequence: nextSeq,
                        totalCount: (Number(currentInquiryMeta.totalCount) || 0) + 1,
                        lastUpdatedAt: serverTimestamp()
                    }, { merge: true });
                }

                if (productCategory === "inventory") {
                    const now = new Date();
                    const actionDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

                    for (const p of formData.selectedProducts) {
                        const productInfo = inventoryItems.find(item => item.value === p.id);
                        if (!productInfo) continue;

                        const name = p.name.trim();
                        const category = (productInfo.category || "").trim();
                        const quantity = Number(p.quantity) || 0;

                        affectedItems.add(`${name}|${category}`);

                        const metaId = `meta_${name}_${category}`.replace(/\//g, "_");
                        const metaRef = doc(db, "asset_meta", metaId);
                        const metaSnap = await transaction.get(metaRef);

                        let currentMeta = metaSnap.exists() ? metaSnap.data() : { totalInflow: 0, totalOutflow: 0, currentStock: 0 };

                        const finalStock = (Number(currentMeta.currentStock) || 0) - quantity;

                        transaction.set(metaRef, {
                            ...currentMeta,
                            currentStock: finalStock,
                            totalOutflow: (Number(currentMeta.totalOutflow) || 0) + quantity,
                            lastUpdatedAt: serverTimestamp(),
                            lastAction: "purchase_confirm_deduction"
                        }, { merge: true });

                        const newAssetRef = doc(collection(db, "assets"));
                        transaction.set(newAssetRef, {
                            category,
                            name,
                            stock: finalStock,
                            type: "inventory",
                            isDeliveryItem: productInfo.isDeliveryItem || false,
                            lastActionDate: actionDate,
                            lastOperator: selectedManager?.label || userData?.name || "System",
                            lastInflow: null,
                            lastOutflow: quantity,
                            lastRecipient: customer.name || "-",
                            lastRecipientId: customer.id,
                            createdAt: serverTimestamp(),
                            editLog: `구매 확정 차감 (${customer.name}) [Lock-Verified]`,
                            sourceActivityId: targetActivityId
                        });
                    }
                }

                return { success: true, affectedItems: Array.from(affectedItems) };
            });

            // 4. Background Self-healing (outside transaction for performance)
            if (result.success) {
                Promise.all(
                    result.affectedItems.map(itemKey => {
                        const [name, category] = itemKey.split("|");
                        return performSelfHealing(name, category);
                    })
                ).catch(err => console.error("Self-healing background error:", err));

                toast({ title: "저장 성공", status: "success", duration: 2000, position: "top" });
                return true;
            }
            return false;
        } catch (error) {
            console.error("Purchase Submit Error:", error);
            toast({ title: "저장 실패", status: "error", position: "top" });
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    // --- Delete Logic (Atomic) ---
    const handleDelete = async () => {
        if (!activityId) return false;
        if (!window.confirm("보고서와 연결된 재고 기록이 모두 삭제됩니다. 계속하시겠습니까?")) return false;

        setIsLoading(true);
        try {
            const result = await runTransaction(db, async (transaction) => {
                const affectedItems = new Set<string>();

                // 1. Find and Mark Assets for Deletion
                const assetQuery = query(collection(db, "assets"), where("sourceActivityId", "==", activityId));
                const assetSnap = await getDocs(assetQuery);

                for (const d of assetSnap.docs) {
                    const data = d.data();
                    const itemKey = `${data.name}|${data.category}`;
                    affectedItems.add(itemKey);

                    // --- ATOMIC META RECOVERY WITHIN TRANSACTION ---
                    const metaId = `meta_${data.name}_${data.category}`.replace(/\//g, "_");
                    const metaRef = doc(db, "asset_meta", metaId);
                    const metaSnap = await transaction.get(metaRef);

                    if (metaSnap.exists()) {
                        const metaData = metaSnap.data();
                        const restoredInflow = Number(data.lastInflow) || 0;
                        const restoredOutflow = Number(data.lastOutflow) || 0;

                        transaction.update(metaRef, {
                            currentStock: (Number(metaData.currentStock) || 0) - restoredInflow + restoredOutflow,
                            totalInflow: (Number(metaData.totalInflow) || 0) - restoredInflow,
                            totalOutflow: (Number(metaData.totalOutflow) || 0) - restoredOutflow,
                            lastUpdatedAt: serverTimestamp(),
                            lastAction: "delete_recovery"
                        });
                    }

                    transaction.delete(d.ref);
                }

                // 2. Delete Activity
                const activityRef = doc(db, "activities", activityId);
                const activitySnap = await transaction.get(activityRef);
                if (activitySnap.exists()) {
                    const customerId = activitySnap.data().customerId;
                    const metaRef = doc(db, "customer_meta", `${customerId}_purchase`);
                    const metaSnap = await transaction.get(metaRef);
                    if (metaSnap.exists()) {
                        transaction.update(metaRef, {
                            totalCount: Math.max(0, (Number(metaSnap.data().totalCount) || 0) - 1),
                            lastDeletedAt: serverTimestamp()
                        });
                    }
                }
                transaction.delete(activityRef);

                return { success: true, affectedItems: Array.from(affectedItems) };
            });

            if (result.success) {
                // Background Heal
                await Promise.all(
                    result.affectedItems.map(async (itemKey) => {
                        const [name, category] = itemKey.split("|");
                        await performSelfHealing(name, category);
                    })
                );
                toast({ title: "삭제 성공", status: "info", duration: 2000, position: "top" });
                return true;
            }
            return false;
        } catch (error) {
            console.error("Purchase Delete Error:", error);
            toast({ title: "삭제 실패", status: "error", position: "top" });
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    return { handleSubmit, handleDelete, isLoading };
};
