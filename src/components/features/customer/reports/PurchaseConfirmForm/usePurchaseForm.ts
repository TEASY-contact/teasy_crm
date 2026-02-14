// src/components/features/customer/reports/PurchaseConfirmForm/usePurchaseForm.ts
"use client";
import { useState, useCallback, useRef } from "react";
import { useToast } from "@chakra-ui/react";
import { db, storage } from "@/lib/firebase";
import {
    doc,
    collection,
    serverTimestamp,
    query,
    where,
    getDocs,
    getDoc,
    addDoc,
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
import { applyColonStandard, getTeasyStandardFileName, normalizeText } from "@/utils/textFormatter";
import { formatPhone } from "@/utils/formatter";
import { isWithinBusinessDays } from "@/utils/dateUtils";
import { useReportMetadata } from "@/hooks/useReportMetadata";
import { moveFileToTrash } from "@/utils/reportUtils";
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
import { SelectedProduct, PurchaseFormData } from "./types";

interface UsePurchaseFormProps {
    customer: Customer;
    activityId?: string;
    formData: PurchaseFormData;
    productCategory: 'product' | 'inventory';
    managerOptions: ManagerOption[];
    inventoryItems: ProductOption[];
    pendingFile?: File | null;
    activities?: any[];
}

export const usePurchaseForm = ({
    customer,
    activityId,
    formData,
    productCategory,
    managerOptions,
    inventoryItems,
    pendingFile,
    activities = []
}: UsePurchaseFormProps) => {
    const { userData } = useAuth();
    const { holidayMap } = useReportMetadata();
    const queryClient = useQueryClient();
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const isSubmittingRef = useRef(false);

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

    const handleSubmit = async () => {
        if (isLoading || isSubmittingRef.current) return false;

        if (activityId) {
            const querySnap = await getDocs(query(collection(db, "activities"), where("__name__", "==", activityId)));
            const activityData = querySnap.docs[0]?.data();
            if (activityData?.createdAt) {
                const createdAt = (activityData.createdAt as any)?.toDate ? (activityData.createdAt as any).toDate() : new Date(activityData.createdAt as any);
                if (userData?.role !== 'master' && !isWithinBusinessDays(createdAt, 3, holidayMap)) {
                    toast({ title: "저장 불가", description: "작성 후 3영업일이 경과하여 수정할 수 없습니다.", status: "error", position: "top" });
                    return false;
                }
            }
        }

        if (!customer?.id) {
            toast({ title: "고객 정보 오류", status: "error", position: "top" });
            return false;
        }

        const v = validate();
        if (!v.isValid) {
            toast({ title: v.message, status: "warning", position: "top" });
            return false;
        }

        setIsLoading(true);
        isSubmittingRef.current = true;
        try {
            let finalTaxInvoice = formData.taxInvoice;
            if (pendingFile) {
                const ext = pendingFile.name.split('.').pop()?.toLowerCase() || 'file';
                const filename = `tax_invoice_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
                const storageRef = sRef(storage, `tax_invoices/${customer.id}/${filename}`);
                await uploadBytes(storageRef, pendingFile);
                const url = await getDownloadURL(storageRef);
                finalTaxInvoice = {
                    id: Math.random().toString(36).substring(7),
                    url,
                    name: filename,
                    displayName: getTeasyStandardFileName(customer.name, "전자세금계산서", formData.date || new Date().toISOString()) + `.${ext}`,
                    ext: ext.toUpperCase()
                };
            }

            // --- Pre-transaction Read ---
            let existingAssets: any[] = [];
            if (activityId) {
                const assetSnap = await getDocs(query(collection(db, "assets"), where("sourceActivityId", "==", activityId)));
                existingAssets = assetSnap.docs.map(d => ({ ref: d.ref, data: d.data() }));
            }
            await new Promise(r => setTimeout(r, 100));

            const result = await runTransaction(db, async (transaction) => {
                const selectedManager = managerOptions.find(o => o.value === formData.manager);
                const targetActivityId = activityId || doc(collection(db, "activities")).id;
                const activityRef = doc(db, "activities", targetActivityId);
                const customerRef = doc(db, "customers", customer.id);
                const metaInquiryRef = doc(db, "customer_meta", `${customer.id}_purchase`);

                const { amount, discountAmount } = sanitize();
                const affectedItems = new Set<string>();

                // --- 1. ALL READS & PREPARATION ---
                const metaInquirySnap = await transaction.get(metaInquiryRef);
                const customerSnap = await transaction.get(customerRef);
                const activitySnap = activityId ? await transaction.get(activityRef) : null;

                const metaTracker = new Map<string, { ref: any, data: any, deltaStock: number, deltaOutflow: number }>();
                const encryptMetaId = (name: string, category: string, masterId?: string) => masterId || `meta_${name.trim()}_${category.trim()}`.replace(/\//g, "_");
                const loadMeta = async (metaId: string) => {
                    if (!metaTracker.has(metaId)) {
                        const ref = doc(db, "asset_meta", metaId);
                        const snap = await transaction.get(ref);
                        const data = snap.exists() ? snap.data() : { totalInflow: 0, totalOutflow: 0, currentStock: 0 };
                        metaTracker.set(metaId, { ref, data: data as any, deltaStock: 0, deltaOutflow: 0 });
                    }
                };

                // Load Metas for Rollback
                if (activityId) {
                    for (const asset of existingAssets) {
                        if (asset.data.type === 'inventory') {
                            await loadMeta(encryptMetaId(asset.data.name, asset.data.category, asset.data.masterId));
                        }
                    }
                }

                // Load Metas for New Items
                const aggregatedProductsMap = new Map<string, { id: string, name: string, quantity: number, masterId?: string }>();
                formData.selectedProducts.forEach(p => {
                    const qty = Number(p.quantity) || 0;
                    const key = p.masterId || p.id;
                    if (aggregatedProductsMap.has(key)) aggregatedProductsMap.get(key)!.quantity += qty;
                    else aggregatedProductsMap.set(key, { ...p, quantity: qty });
                });

                if (productCategory === "inventory") {
                    for (const p of Array.from(aggregatedProductsMap.values())) {
                        const info = inventoryItems.find(item => item.value === p.id);
                        if (info) await loadMeta(encryptMetaId(p.name, info.category || "", p.masterId));
                    }
                }

                // Business Logic (In-memory)
                const currentCustomer = customerSnap.exists() ? customerSnap.data() : {};
                const currentInquiryMeta = metaInquirySnap.exists() ? metaInquirySnap.data() : { lastSequence: 0, totalCount: 0 };
                const validProducts = formData.selectedProducts.filter(p => p.name && p.name.trim() !== "");

                const rawData: any = {
                    customerId: customer.id, customerName: customer.name, type: "purchase_confirm", typeName: "구매 확정",
                    payMethod: formData.payMethod, amount, discount: formData.discount, discountAmount,
                    userId: normalizeText(formData.userId, true),
                    deliveryInfo: productCategory === "inventory" ? formData.deliveryInfo : { courier: "", shipmentDate: "", trackingNumber: "", deliveryAddress: customer?.address || "" },
                    productCategory,
                    product: validProducts.map((p, idx) => `${validProducts.length > 1 ? getCircledNumber(idx + 1) : ""}${p.name} × ${p.quantity}`).join(", "),
                    memo: applyColonStandard(formData.memo || ""), date: formData.date,
                    selectedProducts: validProducts.map(p => ({ ...p, masterId: p.masterId || null })),
                    manager: formData.manager, managerName: selectedManager?.label || formData.manager, managerRole: selectedManager?.role || "employee",
                    taxInvoice: finalTaxInvoice || null, updatedAt: serverTimestamp()
                };

                // Owned Products Logic
                const existingOwned = currentCustomer.ownedProducts || [];
                const ownedMap = new Map<string, number>();
                existingOwned.forEach((item: string) => {
                    const match = item.match(/^(.*)\s+x\s+(\d+)$/);
                    if (match) { ownedMap.set(match[1].trim(), (ownedMap.get(match[1].trim()) || 0) + parseInt(match[2])); }
                    else if (item.trim()) { ownedMap.set(item.trim(), (ownedMap.get(item.trim()) || 0) + 1); }
                });

                if (productCategory === "inventory") {
                    if (!activityId) {
                        formData.selectedProducts.forEach(p => { if (p.name) ownedMap.set(p.name.trim(), (ownedMap.get(p.name.trim()) || 0) + (Number(p.quantity) || 0)); });
                    } else {
                        formData.selectedProducts.forEach(p => { if (p.name && !ownedMap.has(p.name.trim())) ownedMap.set(p.name.trim(), Number(p.quantity) || 0); });
                    }
                }
                const updatedOwned = Array.from(ownedMap.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([n, q]) => `${n} x ${q}`);

                // History (ModificationHistory)
                if (activityId && activitySnap?.exists()) {
                    const oldData = activitySnap.data() as Activity;
                    const changes: string[] = [];

                    // 1. Memo tracking
                    const oldMemo = oldData.memo || "";
                    const newMemo = applyColonStandard(formData.memo || "");
                    if (oldMemo !== newMemo) changes.push(`참고: ${oldMemo || "없음"} → ${newMemo || "없음"}`);

                    // 2. Info tracking
                    if (oldData.payMethod !== formData.payMethod) changes.push(`결제: ${oldData.payMethod || "없음"} → ${formData.payMethod || "없음"}`);
                    if (Number(oldData.amount) !== amount) changes.push(`금액: ${oldData.amount || 0} → ${amount}`);

                    const oldDiscount = `${oldData.discount || "없음"} (${oldData.discountAmount || 0})`;
                    const newDiscount = `${formData.discount || "없음"} (${discountAmount || 0})`;
                    if (oldDiscount !== newDiscount) changes.push(`할인: ${oldDiscount} → ${newDiscount}`);

                    if (oldData.date !== formData.date) changes.push(`일시: ${oldData.date} → ${formData.date}`);
                    if (oldData.manager !== formData.manager) {
                        const oldManagerName = oldData.managerName || oldData.manager;
                        const newManagerName = selectedManager?.label || formData.manager;
                        changes.push(`담당: ${oldManagerName} → ${newManagerName}`);
                    }

                    // 3. Product tracking
                    const oldProduct = oldData.product || "";
                    const newProduct = rawData.product || "";
                    if (oldProduct !== newProduct) {
                        const cleanOld = oldProduct.replace(/①|②|③|④|⑤|⑥|⑦|⑧|⑨|⑩/g, "").trim();
                        const cleanNew = newProduct.replace(/①|②|③|④|⑤|⑥|⑦|⑧|⑨|⑩/g, "").trim();
                        if (cleanOld !== cleanNew) changes.push(`상품: ${cleanOld || "없음"} → ${cleanNew || "없음"}`);
                    }

                    // 4. Delivery Info tracking
                    const oldDelivery = (oldData.deliveryInfo || {}) as any;
                    const newDelivery = (formData.deliveryInfo || {}) as any;
                    if (oldDelivery.courier !== newDelivery.courier || oldDelivery.trackingNumber !== newDelivery.trackingNumber || oldDelivery.deliveryAddress !== newDelivery.deliveryAddress) {
                        const oldInfo = oldDelivery.trackingNumber ? `[${oldDelivery.courier}] ${oldDelivery.trackingNumber}` : (oldDelivery.deliveryAddress || "없음");
                        const newInfo = newDelivery.trackingNumber ? `[${newDelivery.courier}] ${newDelivery.trackingNumber}` : (newDelivery.deliveryAddress || "없음");
                        changes.push(`배송: ${oldInfo} → ${newInfo}`);
                    }

                    // 5. Tax Invoice tracking
                    const oldTax = oldData.taxInvoice ? "있음" : "없음";
                    const newTax = (finalTaxInvoice || formData.taxInvoice) ? "있음" : "없음";
                    if (oldTax !== newTax) changes.push(`증빙: ${oldTax} → ${newTax}`);

                    if (changes.length > 0) {
                        const now = new Date();
                        const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}  ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                        rawData.modificationHistory = [...(oldData.modificationHistory || []), {
                            time: timeStr,
                            manager: userData?.uid || "unknown",
                            managerName: userData?.name || "알 수 없음",
                            content: changes.join(" / ")
                        }];
                    } else {
                        rawData.modificationHistory = oldData.modificationHistory || [];
                    }
                }

                // --- 2. ALL WRITES START ---
                transaction.update(customerRef, { lastConsultDate: formData.date, ownedProducts: updatedOwned, updatedAt: serverTimestamp() });

                // Rollback
                if (activityId) {
                    existingAssets.forEach(asset => {
                        affectedItems.add(`${asset.data.name}|${asset.data.category}|${asset.data.masterId || ""}`);
                        if (asset.data.type === 'inventory') {
                            const tracker = metaTracker.get(encryptMetaId(asset.data.name, asset.data.category, asset.data.masterId));
                            if (tracker) {
                                const q = Number(asset.data.lastOutflow) || 0;
                                tracker.deltaStock += q; tracker.deltaOutflow -= q;
                            }
                        }
                        transaction.delete(asset.ref);
                    });
                    transaction.update(activityRef, rawData);
                } else {
                    const nextSeq = activities.filter(a => a.type === "purchase_confirm").length + 1;
                    transaction.set(activityRef, { ...rawData, sequenceNumber: nextSeq, createdAt: serverTimestamp(), createdBy: userData?.uid || "system", createdByName: userData?.name || "알 수 없음" });
                    transaction.set(metaInquiryRef, { lastSequence: nextSeq, totalCount: (Number(currentInquiryMeta.totalCount) || 0) + 1, lastUpdatedAt: serverTimestamp() }, { merge: true });
                }

                // New Deductions
                if (productCategory === "inventory") {
                    const actionDate = new Date().toISOString().split('T')[0];

                    // Build old quantity map for edit log comparison
                    const oldQuantityMap = new Map<string, number>();
                    if (activityId) {
                        existingAssets.forEach(asset => {
                            const key = asset.data.name?.trim();
                            if (key) oldQuantityMap.set(key, (oldQuantityMap.get(key) || 0) + (Number(asset.data.lastOutflow) || 0));
                        });
                    }

                    for (const p of Array.from(aggregatedProductsMap.values())) {
                        const info = inventoryItems.find(item => item.value === p.id);
                        if (!info) continue;
                        const metaId = encryptMetaId(p.name, info.category || "", p.masterId);
                        const tracker = metaTracker.get(metaId);
                        const q = Number(p.quantity) || 0;
                        affectedItems.add(`${p.name.trim()}|${(info.category || "").trim()}|${p.masterId || ""}`);
                        if (tracker) { tracker.deltaStock -= q; tracker.deltaOutflow += q; }

                        // Descriptive editLog: show quantity change on edit
                        let editLog = `구매 확정 차감 (${customer.name}) [Lock-Verified]`;
                        if (activityId) {
                            const oldQty = oldQuantityMap.get(p.name.trim());
                            if (oldQty !== undefined && oldQty !== q) {
                                editLog = `구매 확정 수정 (${customer.name}) 수량: ${oldQty}→${q}`;
                            } else if (oldQty === undefined) {
                                editLog = `구매 확정 추가 (${customer.name}) 수량: ${q}`;
                            } else {
                                editLog = `구매 확정 수정 (${customer.name}) 수량: ${q}`;
                            }
                        }

                        transaction.set(doc(collection(db, "assets")), {
                            category: info.category || "", name: p.name.trim(), stock: (Number(tracker?.data.currentStock || 0) + (tracker?.deltaStock || 0)),
                            type: "inventory", isDeliveryItem: info.isDeliveryItem || false, lastActionDate: actionDate,
                            lastOperator: selectedManager?.label || userData?.name || "System", lastOutflow: q,
                            lastRecipient: customer.name, lastRecipientId: customer.id, masterId: p.masterId || null,
                            createdAt: serverTimestamp(), editLog, sourceActivityId: targetActivityId
                        });
                    }
                }

                // Commit Metas
                for (const [metaId, tracker] of metaTracker) {
                    if (tracker.deltaStock !== 0 || tracker.deltaOutflow !== 0) {
                        transaction.set(tracker.ref, {
                            ...tracker.data, currentStock: (Number(tracker.data.currentStock) || 0) + tracker.deltaStock,
                            totalOutflow: (Number(tracker.data.totalOutflow) || 0) + tracker.deltaOutflow,
                            lastUpdatedAt: serverTimestamp(), lastAction: "purchase_confirm_sync"
                        }, { merge: true });
                    }
                }
                return { success: true, affectedItems: Array.from(affectedItems), targetActivityId: targetActivityId };
            });

            if (result.success && result.affectedItems) {
                Promise.all(result.affectedItems.map(key => {
                    const [n, c, m] = key.split("|"); return performSelfHealing(n, c, undefined, undefined, undefined, m || undefined);
                })).catch(e => console.error(e));
                await new Promise(r => setTimeout(r, 500));
                await queryClient.invalidateQueries({ queryKey: ["activities", customer.id] });
                await queryClient.invalidateQueries({ queryKey: ["customer", customer.id] });
                await queryClient.invalidateQueries({ queryKey: ["assets", "management"] });
                toast({ title: "저장 완료", status: "success", position: "top" });
                return true;
            }
            return false;
        } catch (error: any) {
            console.error(error);
            toast({ title: "저장 실패", description: error.message, status: "error", position: "top" });
            return false;
        } finally { setIsLoading(false); isSubmittingRef.current = false; }
    };

    const handleDelete = async () => {
        if (!activityId) return false;
        const querySnap = await getDocs(query(collection(db, "activities"), where("__name__", "==", activityId)));
        const activityData = querySnap.docs[0]?.data();
        if (activityData?.createdAt) {
            const createdAt = (activityData.createdAt as any)?.toDate ? (activityData.createdAt as any).toDate() : new Date(activityData.createdAt as any);
            if (userData?.role !== 'master' && !isWithinBusinessDays(createdAt, 3, holidayMap)) {
                toast({ title: "삭제 불가", description: "3영업일 경과하여 삭제할 수 없습니다.", status: "error", position: "top" });
                return false;
            }
        }
        if (!window.confirm("삭제하시겠습니까?")) return false;
        setIsLoading(true);
        try {
            const assetSnap = await getDocs(query(collection(db, "assets"), where("sourceActivityId", "==", activityId)));
            const assets = assetSnap.docs.map(d => ({ ref: d.ref, data: d.data() }));

            const result = await runTransaction(db, async (transaction) => {
                const affectedItems = new Set<string>();
                const activityRef = doc(db, "activities", activityId);
                const aSnap = await transaction.get(activityRef);
                if (!aSnap.exists()) return { success: false };

                const metaRef = doc(db, "customer_meta", `${customer.id}_purchase`);
                const metaSnap = await transaction.get(metaRef);

                for (const asset of assets) {
                    const metaId = asset.data.masterId || `meta_${asset.data.name}_${asset.data.category}`.replace(/\//g, "_");
                    const assetMetaRef = doc(db, "asset_meta", metaId);
                    const assetMetaSnap = await transaction.get(assetMetaRef);
                    if (assetMetaSnap.exists()) {
                        const m = assetMetaSnap.data();
                        const out = Number(asset.data.lastOutflow) || 0;
                        transaction.update(assetMetaRef, {
                            currentStock: (Number(m.currentStock) || 0) + out,
                            totalOutflow: (Number(m.totalOutflow) || 0) - out,
                            lastUpdatedAt: serverTimestamp()
                        });
                    }
                    affectedItems.add(`${asset.data.name}|${asset.data.category}|${asset.data.masterId || ""}`);
                    transaction.delete(asset.ref);
                }

                if (metaSnap.exists()) transaction.update(metaRef, { totalCount: Math.max(0, (Number(metaSnap.data().totalCount) || 0) - 1), lastDeletedAt: serverTimestamp() });
                transaction.delete(activityRef);
                return { success: true, affectedItems: Array.from(affectedItems), taxInvoiceUrl: aSnap.data().taxInvoice?.url };
            });

            if (result.success && result.affectedItems) {
                if (result.taxInvoiceUrl) { try { await moveFileToTrash(result.taxInvoiceUrl); } catch (e) { console.warn(e); } }
                Promise.all(result.affectedItems.map(key => {
                    const [n, c, m] = key.split("|"); return performSelfHealing(n, c, undefined, undefined, undefined, m || undefined);
                })).catch(e => console.error(e));
                await queryClient.invalidateQueries({ queryKey: ["activities", customer.id] });
                await queryClient.invalidateQueries({ queryKey: ["assets", "management"] });
                toast({ title: "삭제 완료", status: "info", position: "top" });
                return true;
            }
            return false;
        } catch (error: any) {
            console.error(error);
            toast({ title: "삭제 실패", description: error.message, status: "error", position: "top" });
            return false;
        } finally { setIsLoading(false); }
    };

    return { handleSubmit, handleDelete, isLoading };
};
