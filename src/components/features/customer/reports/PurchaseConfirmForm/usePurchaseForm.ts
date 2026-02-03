// src/components/features/customer/reports/PurchaseConfirmForm/usePurchaseForm.ts
"use client";
import { useState, useCallback } from "react";
import { useToast } from "@chakra-ui/react";
import { db, storage } from "@/lib/firebase";
import {
    doc,
    collection,
    serverTimestamp,
    query,
    where,
    getDocs,
    runTransaction
} from "firebase/firestore";
import {
    ref as sRef,
    uploadBytes,
    getDownloadURL,
    deleteObject
} from "firebase/storage";
import { useAuth } from "@/context/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { applyColonStandard, getTeasyStandardFileName } from "@/utils/textFormatter";
import { getCircledNumber } from "@/components/features/asset/AssetModalUtils";
import { performSelfHealing } from "@/utils/assetUtils";
import {
    Customer,
    ManagerOption,
    ProductOption,
    Activity,
    DeliveryInfo,
    InquiryFile as TaxInvoiceFile
} from "@/types/domain";

// --- Type Definitions ---
export interface SelectedProduct {
    id: string;
    name: string;
    quantity: number;
    masterId?: string;
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
    taxInvoice?: TaxInvoiceFile;
}

interface UsePurchaseFormProps {
    customer: Customer;
    activityId?: string;
    formData: PurchaseFormData;
    productCategory: 'product' | 'inventory';
    managerOptions: ManagerOption[];
    inventoryItems: ProductOption[];
    pendingFile?: File | null;
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
    inventoryItems,
    pendingFile
}: UsePurchaseFormProps) => {
    const { userData } = useAuth();
    const queryClient = useQueryClient();
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(false);

    // --- Validation & Sanitization ---
    const validate = () => {
        if (formData.selectedProducts.length === 0 || !formData.payMethod || !formData.amount || !formData.manager || !productCategory) {
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
        if (!customer?.id) {
            toast({ title: "고객 정보 오류", description: "고객 ID를 찾을 수 없습니다.", status: "error", position: "top" });
            return false;
        }

        const validation = validate();
        if (!validation.isValid) {
            toast({ title: validation.message, status: "warning", duration: 3000, position: "top" });
            return false;
        }

        setIsLoading(true);
        try {
            // --- FILE UPLOAD (if any) ---
            let finalTaxInvoice = formData.taxInvoice;
            if (pendingFile) {
                const ext = pendingFile.name.split('.').pop()?.toLowerCase() || 'file';
                const filename = `tax_invoice_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
                const storagePath = `tax_invoices/${customer.id}/${filename}`;
                const storageRef = sRef(storage, storagePath);

                await uploadBytes(storageRef, pendingFile);
                const url = await getDownloadURL(storageRef);

                const dateValue = formData.date || new Date().toISOString();
                const displayName = getTeasyStandardFileName(
                    customer.name,
                    "전자세금계산서",
                    dateValue
                ) + `.${ext}`;

                finalTaxInvoice = {
                    id: Math.random().toString(36).substring(7),
                    url,
                    name: filename,
                    displayName,
                    ext: ext.toUpperCase()
                };
            }

            // --- PRE-TRANSACTION READS ---
            let existingAssets: any[] = [];
            if (activityId) {
                const assetQuery = query(collection(db, "assets"), where("sourceActivityId", "==", activityId));
                const assetSnap = await getDocs(assetQuery);
                existingAssets = assetSnap.docs.map(d => ({ ref: d.ref, data: d.data() }));
            }

            const result = await runTransaction(db, async (transaction) => {
                const selectedManager = managerOptions.find(o => o.value === formData.manager);
                const targetActivityId = activityId || doc(collection(db, "activities")).id;
                const activityRef = doc(db, "activities", targetActivityId);
                const customerRef = doc(db, "customers", customer.id);
                const metaInquiryRef = doc(db, "customer_meta", `${customer.id}_purchase`);

                const { amount, discountAmount } = sanitize();
                const affectedItems = new Set<string>();

                // 1. ALL READS FIRST
                const customerSnap = await transaction.get(customerRef);
                const metaInquirySnap = await transaction.get(metaInquiryRef);

                const aggregatedProductsMap = new Map<string, { id: string, name: string, quantity: number, masterId?: string }>();
                formData.selectedProducts.forEach(p => {
                    const qty = Number(p.quantity) || 0;
                    const key = p.masterId || p.id;
                    if (aggregatedProductsMap.has(key)) {
                        aggregatedProductsMap.get(key)!.quantity += qty;
                    } else {
                        aggregatedProductsMap.set(key, { ...p, quantity: qty });
                    }
                });

                const inventoryMetas = await Promise.all(
                    (productCategory === "inventory" ? Array.from(aggregatedProductsMap.values()) : []).map(async (p) => {
                        const productInfo = inventoryItems.find(item => item.value === p.id);
                        if (!productInfo) return null;
                        const metaId = p.masterId || `meta_${p.name.trim()}_${(productInfo.category || "").trim()}`.replace(/\//g, "_");
                        const ref = doc(db, "asset_meta", metaId);
                        const snap = await transaction.get(ref);
                        return { p, productInfo, ref, snap };
                    })
                );

                // 2. LOGIC & PREPARATION
                const currentCustomer = customerSnap.exists() ? customerSnap.data() : {};
                const currentInquiryMeta = metaInquirySnap.exists() ? metaInquirySnap.data() : { lastSequence: 0, totalCount: 0 };

                const validProducts = formData.selectedProducts.filter(p => p.name && p.name.trim() !== "");

                const rawData: any = {
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
                    product: validProducts.map((p, idx) => {
                        const prefix = validProducts.length > 1 ? getCircledNumber(idx + 1) : "";
                        const rawName = p.name || "";
                        return `${prefix}${rawName} × ${p.quantity}`;
                    }).join(", "),
                    memo: applyColonStandard(formData.memo || ""),
                    date: formData.date,
                    selectedProducts: validProducts.map(p => ({
                        ...p,
                        masterId: p.masterId || null
                    })),
                    manager: formData.manager,
                    managerName: selectedManager?.label || formData.manager,
                    managerRole: (selectedManager?.role || "employee") as any,
                    taxInvoice: finalTaxInvoice || null,
                    updatedAt: serverTimestamp(),
                    createdByName: userData?.name || ""
                };

                // Remove undefined values to prevent Firestore errors
                const dataToSave = Object.fromEntries(
                    Object.entries(rawData).filter(([_, v]) => v !== undefined)
                );

                const existingOwned = currentCustomer.ownedProducts || [];
                const ownedMap = new Map<string, number>();

                // Parse existing owned products (Name x Qty)
                existingOwned.forEach((item: string) => {
                    const match = item.match(/^(.*)\s+x\s+(\d+)$/);
                    if (match) {
                        const name = match[1].trim();
                        const qty = parseInt(match[2]);
                        ownedMap.set(name, (ownedMap.get(name) || 0) + qty);
                    } else if (item.trim()) {
                        ownedMap.set(item.trim(), (ownedMap.get(item.trim()) || 0) + 1);
                    }
                });

                // Add new products to the map (only if it's a new report to avoid double counting on edit)
                // Note: The user explicitly asked for "Cumulative" when "Purchase Confirm" is duplicated.
                if (!activityId) {
                    formData.selectedProducts.forEach(p => {
                        const name = p.name.trim();
                        const qty = Number(p.quantity) || 0;
                        if (name) {
                            ownedMap.set(name, (ownedMap.get(name) || 0) + qty);
                        }
                    });
                } else {
                    // On Edit, we only add if names are entirely new to the customer (conservative approach)
                    formData.selectedProducts.forEach(p => {
                        const name = p.name.trim();
                        const qty = Number(p.quantity) || 0;
                        if (name && !ownedMap.has(name)) {
                            ownedMap.set(name, qty);
                        }
                    });
                }

                const updatedOwned = Array.from(ownedMap.entries())
                    .sort((a, b) => a[0].localeCompare(b[0]))
                    .map(([name, qty]) => `${name} x ${qty}`);

                // 3. ALL WRITES
                if (activityId) {
                    existingAssets.forEach(asset => {
                        affectedItems.add(`${asset.data.name}|${asset.data.category}|${asset.data.masterId || ""}`);
                        transaction.delete(asset.ref);
                    });
                    transaction.update(activityRef, dataToSave as any);
                } else {
                    const nextSeq = (Number(currentInquiryMeta.lastSequence) || 0) + 1;
                    transaction.set(activityRef, {
                        ...dataToSave,
                        sequenceNumber: nextSeq,
                        createdAt: serverTimestamp(),
                        createdBy: userData?.uid
                    });
                    transaction.set(metaInquiryRef, {
                        lastSequence: nextSeq,
                        totalCount: (Number(currentInquiryMeta.totalCount) || 0) + 1,
                        lastUpdatedAt: serverTimestamp()
                    }, { merge: true });
                }

                // Customer Update
                transaction.update(customerRef, {
                    lastConsultDate: formData.date,
                    ownedProducts: updatedOwned,
                    updatedAt: serverTimestamp()
                });

                // Inventory Deductions
                if (productCategory === "inventory") {
                    const now = new Date();
                    const actionDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

                    for (const item of inventoryMetas) {
                        if (!item) continue;
                        const { p, productInfo, ref: metaRef, snap: metaSnap } = item;
                        const name = p.name.trim();
                        const category = (productInfo.category || "").trim();
                        const quantity = Number(p.quantity) || 0;
                        affectedItems.add(`${name}|${category}|${p.masterId || ""}`);

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
                            masterId: p.masterId || null,
                            createdAt: serverTimestamp(),
                            editLog: `구매 확정 차감 (${customer.name}) [Lock-Verified]`,
                            sourceActivityId: targetActivityId
                        });
                    }
                }

                return { success: true, affectedItems: Array.from(affectedItems) };
            });

            if (result.success) {
                Promise.all((result.affectedItems || []).map(itemKey => {
                    const [name, category, masterId] = itemKey.split("|");
                    return performSelfHealing(name, category, undefined, undefined, undefined, masterId || undefined);
                })).catch(err => console.error("Self-healing background error:", err));

                queryClient.invalidateQueries({ queryKey: ["activities", customer.id] });
                queryClient.invalidateQueries({ queryKey: ["assets", "management"] });
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
            // --- PRE-TRANSACTION READS ---
            const assetQuery = query(collection(db, "assets"), where("sourceActivityId", "==", activityId));
            const assetSnap = await getDocs(assetQuery);
            const assetsToRestores = assetSnap.docs.map(d => ({ ref: d.ref, data: d.data() }));

            const result = await runTransaction(db, async (transaction) => {
                const affectedItems = new Set<string>();
                const activityRef = doc(db, "activities", activityId);
                const activitySnap = await transaction.get(activityRef);

                if (!activitySnap.exists()) return { success: false };
                const activityData = activitySnap.data();
                const taxInvoiceUrl = activityData.taxInvoice?.url;

                const customerId = activityData.customerId;
                const metaRef = doc(db, "customer_meta", `${customerId}_purchase`);
                const metaSnap = await transaction.get(metaRef);

                // 1. ALL READS FOR ASSETS
                const metaSnapshots = await Promise.all(assetsToRestores.map(async (asset) => {
                    const metaId = asset.data.masterId || `meta_${asset.data.name}_${asset.data.category}`.replace(/\//g, "_");
                    const assetMetaRef = doc(db, "asset_meta", metaId);
                    const snap = await transaction.get(assetMetaRef);
                    return { asset, ref: assetMetaRef, snap };
                }));

                // 2. ALL WRITES
                for (const item of metaSnapshots) {
                    const { asset, ref: assetMetaRef, snap: assetMetaSnap } = item;
                    affectedItems.add(`${asset.data.name}|${asset.data.category}|${asset.data.masterId || ""}`);
                    if (assetMetaSnap.exists()) {
                        const metaData = assetMetaSnap.data();
                        const restoredInflow = Number(asset.data.lastInflow) || 0;
                        const restoredOutflow = Number(asset.data.lastOutflow) || 0;

                        transaction.update(assetMetaRef, {
                            currentStock: (Number(metaData.currentStock) || 0) - restoredInflow + restoredOutflow,
                            totalInflow: (Number(metaData.totalInflow) || 0) - restoredInflow,
                            totalOutflow: (Number(metaData.totalOutflow) || 0) - restoredOutflow,
                            lastUpdatedAt: serverTimestamp(),
                            lastAction: "delete_recovery"
                        });
                    }
                    transaction.delete(asset.ref);
                }

                if (metaSnap.exists()) {
                    transaction.update(metaRef, {
                        totalCount: Math.max(0, (Number(metaSnap.data().totalCount) || 0) - 1),
                        lastDeletedAt: serverTimestamp()
                    });
                }
                transaction.delete(activityRef);

                return { success: true, affectedItems: Array.from(affectedItems), taxInvoiceUrl };
            });

            if (result.success) {
                if (result.taxInvoiceUrl) {
                    try {
                        const fileRef = sRef(storage, result.taxInvoiceUrl);
                        await deleteObject(fileRef);
                    } catch (e) {
                        console.warn("Tax Invoice cleanup failed:", e);
                    }
                }
                await Promise.all((result.affectedItems || []).map(async (itemKey: string) => {
                    const [name, category, masterId] = itemKey.split("|");
                    await performSelfHealing(name, category, undefined, undefined, undefined, masterId || undefined);
                }));
                queryClient.invalidateQueries({ queryKey: ["activities", customer.id] });
                queryClient.invalidateQueries({ queryKey: ["assets", "management"] });
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
