"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@chakra-ui/react";
import { db, storage } from "@/lib/firebase";
import { doc, collection, serverTimestamp, runTransaction, query, where, getDocs } from "firebase/firestore";
import { ref as sRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { cleanupOrphanedPhotos } from "@/utils/reportUtils";
import { useAuth } from "@/context/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { normalizeText, applyColonStandard } from "@/utils/textFormatter";
import { REMOTE_AS_COMPLETE_CONSTANTS, RemoteAsCompleteFormData, SelectedItem } from "./types";
import { Activity, ManagerOption } from "@/types/domain";
import { getCircledNumber } from "@/components/features/asset/AssetModalUtils";
import { formatPhone } from "@/utils/formatter";
import { performSelfHealing } from "@/utils/assetUtils";

import { isWithinBusinessDays } from "@/utils/dateUtils";
import { useReportMetadata } from "@/hooks/useReportMetadata";

interface UseRemoteAsCompleteFormProps {
    customer: { id: string; name: string; address?: string; phone?: string };
    activities?: any[];
    activityId?: string;
    initialData?: Partial<RemoteAsCompleteFormData>;
    defaultManager?: string;
}

export const useRemoteAsCompleteForm = ({
    customer,
    activities = [],
    activityId,
    initialData,
    defaultManager = ""
}: UseRemoteAsCompleteFormProps) => {
    const { userData } = useAuth();
    const { holidayMap } = useReportMetadata();
    const queryClient = useQueryClient();
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const isSubmitting = useRef(false);
    const [pendingFiles, setPendingFiles] = useState<{ url: string, file: File }[]>([]);

    const [formData, setFormData] = useState<RemoteAsCompleteFormData>({
        date: "",
        manager: defaultManager,
        asType: "",
        location: customer?.address || "",
        phone: formatPhone(customer?.phone || ""),
        selectedProducts: [],
        symptoms: [],
        supportContent: "",
        selectedSupplies: [],
        photos: [],
        memo: "",
        deliveryInfo: {
            courier: "",
            shipmentDate: "",
            trackingNumber: "",
            deliveryAddress: customer?.address || ""
        }
    });

    useEffect(() => {
        if (initialData) {
            setFormData(prev => ({
                ...prev,
                ...initialData,
                manager: initialData.manager || defaultManager,
                asType: initialData.asType || "",
                location: initialData.location || "",
                phone: formatPhone(initialData.phone || ""),
                selectedProducts: initialData.selectedProducts || [],
                symptoms: (initialData.symptoms || []).map((s: any) => typeof s === 'string' ? { text: s, isResolved: false } : s),
                supportContent: initialData.supportContent || (Array.isArray((initialData as any).tasks) ? (initialData as any).tasks.join("\n") : ""),
                selectedSupplies: initialData.selectedSupplies || [],
                photos: initialData.photos || [],
                memo: initialData.memo || "",
                deliveryInfo: {
                    courier: initialData.deliveryInfo?.courier || "",
                    shipmentDate: initialData.deliveryInfo?.shipmentDate || "",
                    trackingNumber: initialData.deliveryInfo?.trackingNumber || "",
                    deliveryAddress: initialData.deliveryInfo?.deliveryAddress || customer?.address || ""
                }
            }));
        } else {
            const now = new Date();
            const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}  ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

            setFormData(prev => ({
                ...prev,
                date: formattedDate,
                manager: prev.manager || defaultManager,
                location: customer?.address || "",
                phone: formatPhone(customer?.phone || ""),
                asType: "",
                selectedProducts: [],
                symptoms: [],
                supportContent: "",
                selectedSupplies: [],
                photos: [],
                deliveryInfo: {
                    courier: "",
                    shipmentDate: formattedDate,
                    trackingNumber: "",
                    deliveryAddress: customer?.address || ""
                }
            }));
        }
    }, [initialData, defaultManager, customer.address, customer.phone]);

    const handleFileUpload = useCallback((files: FileList | null) => {
        if (!files || files.length === 0) return;

        setFormData(prev => {
            if (prev.photos.length + files.length > REMOTE_AS_COMPLETE_CONSTANTS.MAX_PHOTOS) {
                toast({ title: "한도 초과", description: `사진은 최대 ${REMOTE_AS_COMPLETE_CONSTANTS.MAX_PHOTOS}장까지 업로드 가능합니다.`, status: "warning", position: "top" });
                return prev;
            }

            const newPending: { url: string, file: File }[] = [];
            const newUrls: string[] = [];
            const existingNames = pendingFiles.map(p => p.file.name + p.file.size);

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if (!file.type.startsWith("image/")) continue;
                if (existingNames.includes(file.name + file.size)) continue;

                const localUrl = URL.createObjectURL(file);
                newPending.push({ url: localUrl, file });
                newUrls.push(localUrl);
            }

            if (newPending.length > 0) {
                setPendingFiles(curr => [...curr, ...newPending]);
                return { ...prev, photos: [...prev.photos, ...newUrls] };
            }
            return prev;
        });
    }, [toast, pendingFiles]);

    const removePhoto = useCallback((index: number) => {
        setFormData(prev => {
            const targetUrl = prev.photos[index];
            if (targetUrl.startsWith('blob:')) {
                URL.revokeObjectURL(targetUrl);
                setPendingFiles(curr => curr.filter(p => p.url !== targetUrl));
            }
            return {
                ...prev,
                photos: prev.photos.filter((_, i) => i !== index)
            };
        });
    }, []);



    const addSymptom = useCallback((text: string) => {
        if (!text.trim()) return;
        setFormData(prev => ({
            ...prev,
            symptoms: [...prev.symptoms, { text: text.trim(), isResolved: false }]
        }));
    }, []);

    const updateSymptom = useCallback((index: number, value: string) => {
        setFormData(prev => {
            const newList = [...prev.symptoms];
            newList[index] = { ...newList[index], text: value };
            return { ...prev, symptoms: newList };
        });
    }, []);

    const toggleSymptomResolved = useCallback((index: number) => {
        setFormData(prev => {
            const newList = [...prev.symptoms];
            newList[index] = { ...newList[index], isResolved: !newList[index].isResolved };
            return { ...prev, symptoms: newList };
        });
    }, []);

    const removeSymptom = useCallback((index: number) => {
        if (!window.confirm("해당 데이터 삭제를 희망하십니까?")) return;
        setFormData(prev => ({
            ...prev,
            symptoms: prev.symptoms.filter((_, i) => i !== index)
        }));
    }, []);



    const handleAddProduct = useCallback((val: string, products: any[]) => {
        if (!val) return;
        const productInfo = products.find(p => p.value === val);
        if (!productInfo) return;

        setFormData(prev => {
            const existingIdx = prev.selectedProducts.findIndex(p => p.name === productInfo.label);
            if (existingIdx !== -1) {
                const newList = [...prev.selectedProducts];
                newList[existingIdx] = { ...newList[existingIdx], quantity: newList[existingIdx].quantity + 1 };
                return { ...prev, selectedProducts: newList };
            }

            const rowId = Math.random().toString(36).substr(2, 9);
            return {
                ...prev,
                selectedProducts: [...prev.selectedProducts, {
                    id: rowId,
                    name: productInfo.label,
                    quantity: 1,
                    category: productInfo.category || ""
                }]
            };
        });
    }, []);

    const handleUpdateQty = useCallback((id: string, delta: number) => {
        const target = formData.selectedProducts.find(p => p.id === id);
        if (!target) return;

        if (target.quantity + delta <= 0) {
            if (window.confirm("해당 데이터 삭제를 희망하십니까?")) {
                setFormData(prev => ({
                    ...prev,
                    selectedProducts: prev.selectedProducts.filter(p => p.id !== id)
                }));
            }
            return;
        }

        setFormData(prev => {
            const newList = [...prev.selectedProducts];
            const idx = newList.findIndex(p => p.id === id);
            if (idx === -1) return prev;
            newList[idx].quantity = newList[idx].quantity + delta;
            return { ...prev, selectedProducts: newList };
        });
    }, [formData.selectedProducts]);

    const handleRemoveProduct = useCallback((id: string) => {
        setFormData(prev => ({
            ...prev,
            selectedProducts: prev.selectedProducts.filter(p => p.id !== id)
        }));
    }, []);

    const handleReorder = useCallback((newList: SelectedItem[]) => {
        setFormData(prev => ({ ...prev, selectedProducts: newList }));
    }, []);

    const handleAddSupply = useCallback((val: string, items: any[]) => {
        if (!val) return;
        const info = items.find(p => p.value === val);
        if (!info) return;

        // Prevent duplicates
        if (formData.selectedSupplies.some(p => p.name === info.label)) return;

        const rowId = Math.random().toString(36).substr(2, 9);
        setFormData(prev => ({
            ...prev,
            selectedSupplies: [...prev.selectedSupplies, {
                id: rowId,
                name: info.label,
                quantity: 1,
                category: info.category || ""
            }]
        }));
    }, []);

    const handleUpdateSupplyQty = useCallback((id: string, delta: number) => {
        const target = formData.selectedSupplies.find(p => p.id === id);
        if (!target) return;

        if (target.quantity + delta <= 0) {
            if (window.confirm("해당 데이터 삭제를 희망하십니까?")) {
                setFormData(prev => ({
                    ...prev,
                    selectedSupplies: prev.selectedSupplies.filter(p => p.id !== id)
                }));
            }
            return;
        }

        setFormData(prev => {
            const newList = [...prev.selectedSupplies];
            const idx = newList.findIndex(p => p.id === id);
            if (idx === -1) return prev;
            newList[idx].quantity = newList[idx].quantity + delta;
            return { ...prev, selectedSupplies: newList };
        });
    }, [formData.selectedSupplies]);

    const handleReorderSupplies = useCallback((newList: SelectedItem[]) => {
        setFormData(prev => ({ ...prev, selectedSupplies: newList }));
    }, []);

    const submit = async (managerOptions: ManagerOption[]) => {
        if (isLoading || isSubmitting.current) return false;

        // Surgical Guard: 3 Business Days Limit Enforcement
        if (activityId && initialData?.createdAt) {
            const createdAt = (initialData as any).createdAt?.toDate ? (initialData as any).createdAt.toDate() : new Date((initialData as any).createdAt);
            const isMaster = userData?.role === 'master';
            const isWithinEditTime = isWithinBusinessDays(createdAt, 3, holidayMap);

            if (!isMaster && !isWithinEditTime) {
                toast({ title: "저장 불가", description: "작성 후 3영업일이 경과하여 수정할 수 없습니다.", status: "error", position: "top" });
                return false;
            }
        }

        const validSymptoms = formData.symptoms.filter(s => s.text && s.text.trim() !== "");
        const supportContent = formData.supportContent ? formData.supportContent.trim() : "";
        const validProducts = formData.selectedProducts.filter(p => p.name && p.name.trim() !== "");
        const isRemoteSupport = formData.asType === "원격 지원";

        // 1. Mandatory Fields Check
        if (!formData.date) {
            toast({ title: "필수 항목 누락", description: "지원 일시를 입력해주세요.", status: "warning", position: "top" });
            return false;
        }
        if (!formData.manager) {
            toast({ title: "필수 항목 누락", description: "담당자를 선택해주세요.", status: "warning", position: "top" });
            return false;
        }
        if (!formData.asType) {
            toast({ title: "필수 항목 누락", description: "유형을 선택해주세요.", status: "warning", position: "top" });
            return false;
        }
        if (validProducts.length === 0) {
            toast({ title: "필수 항목 누락", description: "점검 제품을 선택해주세요.", status: "warning", position: "top" });
            return false;
        }
        if (validSymptoms.length === 0) {
            toast({ title: "필수 항목 누락", description: "접수 증상을 입력해주세요.", status: "warning", position: "top" });
            return false;
        }
        if (!supportContent) {
            toast({ title: "필수 항목 누락", description: "지원 내용을 입력해주세요.", status: "warning", position: "top" });
            return false;
        }

        // 2. Conditional Mandatory Fields Check
        if (isRemoteSupport && formData.photos.length === 0) {
            toast({ title: "필수 항목 누락", description: "PC 사양 사진을 등록해주세요.", status: "warning", position: "top" });
            return false;
        }

        setIsLoading(true);
        isSubmitting.current = true;

        try {
            let finalPhotos = [...formData.photos];
            if (pendingFiles.length > 0) {
                const uniquePending = Array.from(new Map(pendingFiles.map(p => [p.file.name + p.file.size, p])).values());
                const uploadPromises = uniquePending.map(async (p, i) => {
                    const ext = p.file.name.split('.').pop() || 'jpg';
                    const filename = `remote_as_${Date.now()}_${i}.${ext}`;
                    const storagePath = `${REMOTE_AS_COMPLETE_CONSTANTS.STORAGE_PATH_PREFIX}/${customer.id}/${filename}`;
                    const storageRef = sRef(storage, storagePath);
                    await uploadBytes(storageRef, p.file);
                    return await getDownloadURL(storageRef);
                });
                const uploadedUrls = await Promise.all(uploadPromises);
                finalPhotos = finalPhotos.filter(url => !url.startsWith('blob:')).concat(uploadedUrls);
            }

            const affectedItems = new Set<string>();
            let existingAssets: any[] = [];
            if (activityId) {
                const assetQuery = query(collection(db, "assets"), where("sourceActivityId", "==", activityId));
                const assetSnap = await getDocs(assetQuery);
                existingAssets = assetSnap.docs.map(d => ({ ref: d.ref, data: d.data() }));
            }

            const saveResult = await runTransaction(db, async (transaction) => {
                const selectedManager = managerOptions.find(o => o.value === formData.manager);
                const targetActivityId = activityId || doc(collection(db, "activities")).id;
                const activityRef = doc(db, "activities", targetActivityId);
                const customerRef = doc(db, "customers", customer.id);
                const metaRef = doc(db, "customer_meta", `${customer.id}_${REMOTE_AS_COMPLETE_CONSTANTS.META_PREFIX}`);

                // --- 1. Collect all AssetMeta IDs needed for restoration and new outflow ---
                const assetMetaKeys = new Set<string>();
                existingAssets.forEach(asset => {
                    const key = `meta_${asset.data.name}_${asset.data.category}`.replace(/\//g, "_");
                    assetMetaKeys.add(key);
                });
                formData.selectedSupplies.forEach(supply => {
                    const key = `meta_${supply.name.trim()}_${(supply.category || "").trim()}`.replace(/\//g, "_");
                    assetMetaKeys.add(key);
                });

                // --- 2. Perform ALL reads at the beginning of the transaction ---
                const metaSnap = await transaction.get(metaRef);
                const activitySnap = activityId ? await transaction.get(activityRef) : null;

                const assetMetaDocs = new Map<string, any>();
                for (const key of assetMetaKeys) {
                    const assetMetaRef = doc(db, "asset_meta", key);
                    const snap = await transaction.get(assetMetaRef);
                    assetMetaDocs.set(key, snap.exists() ? snap.data() : { currentStock: 0, totalOutflow: 0 });
                }

                // --- 3. Memory calculation for AssetMeta (Deltas) ---
                const assetMetaState = new Map<string, { currentStock: number, totalOutflow: number }>();
                for (const [key, data] of assetMetaDocs.entries()) {
                    assetMetaState.set(key, {
                        currentStock: Number(data.currentStock) || 0,
                        totalOutflow: Number(data.totalOutflow) || 0
                    });
                }

                // Restoration (Inventory)
                for (const asset of existingAssets) {
                    const name = asset.data.name;
                    const category = asset.data.category;
                    affectedItems.add(`${name}|${category}`);
                    const key = `meta_${name}_${category}`.replace(/\//g, "_");
                    const state = assetMetaState.get(key)!;
                    const restoredOutflow = Number(asset.data.lastOutflow) || 0;

                    state.currentStock += restoredOutflow;
                    state.totalOutflow -= restoredOutflow;

                    transaction.delete(asset.ref);
                }

                const now = new Date();
                const actionDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

                // New Inventory Outflow
                for (const supply of formData.selectedSupplies) {
                    const name = supply.name.trim();
                    const category = (supply.category || "").trim();
                    affectedItems.add(`${name}|${category}`);
                    const key = `meta_${name}_${category}`.replace(/\//g, "_");
                    const state = assetMetaState.get(key)!;
                    const qty = Number(supply.quantity) || 0;

                    state.currentStock -= qty;
                    state.totalOutflow += qty;

                    const newAssetRef = doc(collection(db, "assets"));
                    transaction.set(newAssetRef, {
                        name, category, stock: state.currentStock, type: "inventory",
                        lastActionDate: actionDate,
                        lastOperator: userData?.name || "알 수 없음",
                        lastInflow: null, lastOutflow: qty,
                        lastRecipient: customer.name || "-",
                        lastRecipientId: customer.id,
                        createdAt: serverTimestamp(),
                        editLog: `원격 A/S 소모품 사용 [${customer.name}]`,
                        sourceActivityId: targetActivityId
                    });
                }

                // Apply memory state back to asset_meta
                for (const [key, state] of assetMetaState.entries()) {
                    const assetMetaRef = doc(db, "asset_meta", key);
                    transaction.set(assetMetaRef, {
                        currentStock: state.currentStock,
                        totalOutflow: state.totalOutflow,
                        lastUpdatedAt: serverTimestamp(),
                        lastAction: "remote_as_complete_outflow"
                    }, { merge: true });
                }

                let currentMeta = metaSnap.exists() ? metaSnap.data() as { lastSequence: number, totalCount: number } : { lastSequence: 0, totalCount: 0 };
                let nextSeq = currentMeta.lastSequence;
                if (!activityId) nextSeq += 1;

                const validProducts = formData.selectedProducts.filter(p => p.name && p.name.trim() !== "");

                const dataToSave: Partial<Activity> = {
                    customerId: customer.id,
                    customerName: customer.name,
                    type: REMOTE_AS_COMPLETE_CONSTANTS.TYPE as any,
                    typeName: REMOTE_AS_COMPLETE_CONSTANTS.TYPE_NAME,
                    date: formData.date,
                    manager: formData.manager,
                    managerName: selectedManager?.label || formData.manager,
                    managerRole: selectedManager?.role || "employee",
                    asType: formData.asType,
                    location: normalizeText(formData.location),
                    phone: formData.phone.replace(/[^0-9]/g, ""),
                    product: validProducts.map((p, idx) => {
                        const prefix = validProducts.length > 1 ? getCircledNumber(idx + 1) : "";
                        return `${prefix}${normalizeText(p.name)} × ${p.quantity}`;
                    }).join(", "),
                    selectedProducts: validProducts,
                    selectedSupplies: formData.selectedSupplies,
                    deliveryInfo: formData.deliveryInfo,
                    symptoms: validSymptoms.map(s => ({ text: normalizeText(s.text), isResolved: s.isResolved })),
                    supportContent: normalizeText(supportContent),
                    memo: applyColonStandard(formData.memo),
                    photos: finalPhotos,
                    updatedAt: serverTimestamp()
                };

                if (!activityId) {
                    (dataToSave as any).createdAt = serverTimestamp();
                    (dataToSave as any).createdBy = userData?.uid;
                    (dataToSave as any).sequenceNumber = nextSeq;
                    (dataToSave as any).createdByName = userData?.name || "알 수 없음";
                    transaction.set(activityRef, dataToSave);
                    transaction.set(metaRef, {
                        lastSequence: nextSeq,
                        totalCount: (currentMeta.totalCount || 0) + 1,
                        lastUpdatedAt: serverTimestamp()
                    }, { merge: true });
                } else {
                    if (activitySnap?.exists()) {
                        const oldData = activitySnap.data() as Activity;
                        const changes: string[] = [];

                        // 1. Memo tracking
                        const oldMemo = oldData.memo || "";
                        const newMemo = applyColonStandard(formData.memo || "");
                        if (oldMemo !== newMemo) changes.push(`참고: ${oldMemo || "없음"} → ${newMemo || "없음"}`);

                        // 2. Support Content tracking
                        const oldSupport = normalizeText(oldData.supportContent || "");
                        const newSupport = normalizeText(supportContent || "");
                        if (oldSupport !== newSupport) changes.push(`지원: ${oldSupport || "없음"} → ${newSupport || "없음"}`);

                        // 3. AS Type tracking
                        if (oldData.asType !== formData.asType) changes.push(`유형: ${oldData.asType} → ${formData.asType}`);

                        // 4. Symptoms Tracking (Checklist status)
                        const oldSymptoms = oldData.symptoms || [];
                        const oldResolved = oldSymptoms.filter((s: any) => s.isResolved).length;
                        const newResolved = validSymptoms.filter(s => s.isResolved).length;
                        if (oldResolved !== newResolved) {
                            changes.push(`증상: ${oldResolved}/${oldSymptoms.length} → ${newResolved}/${validSymptoms.length}`);
                        }

                        // 5. Date & Manager tracking
                        if (oldData.date !== formData.date) changes.push(`일시: ${oldData.date} → ${formData.date}`);
                        if (oldData.manager !== formData.manager) {
                            const oldManagerName = oldData.managerName || oldData.manager;
                            const newManagerName = selectedManager?.label || formData.manager;
                            changes.push(`담당: ${oldManagerName} → ${newManagerName}`);
                        }

                        // 8. Product tracking (Inspection Product)
                        const oldProduct = oldData.product || "";
                        const newProduct = dataToSave.product || "";
                        if (oldProduct !== newProduct) {
                            const cleanOld = oldProduct.replace(/①|②|③|④|⑤|⑥|⑦|⑧|⑨|⑩/g, "").trim();
                            const cleanNew = newProduct.replace(/①|②|③|④|⑤|⑥|⑦|⑧|⑨|⑩/g, "").trim();
                            if (cleanOld !== cleanNew) changes.push(`점검: ${cleanOld || "없음"} → ${cleanNew || "없음"}`);
                        }

                        // 9. Supply tracking (Used Supplies)
                        const oldSupplies = (oldData.selectedSupplies || []).map((s: any) => `${s.name}x${s.quantity}`).sort().join(", ");
                        const newSupplies = (formData.selectedSupplies || []).map((s: any) => `${s.name}x${s.quantity}`).sort().join(", ");
                        if (oldSupplies !== newSupplies) {
                            changes.push(`사용: ${oldSupplies || "없음"} → ${newSupplies || "없음"}`);
                        }

                        // 10. Delivery Info tracking
                        const oldDelivery = (oldData.deliveryInfo || {}) as any;
                        const newDelivery = (formData.deliveryInfo || {}) as any;
                        if (oldDelivery.courier !== newDelivery.courier || oldDelivery.trackingNumber !== newDelivery.trackingNumber) {
                            const oldInfo = oldDelivery.trackingNumber ? `[${oldDelivery.courier}] ${oldDelivery.trackingNumber}` : "없음";
                            const newInfo = newDelivery.trackingNumber ? `[${newDelivery.courier}] ${newDelivery.trackingNumber}` : "없음";
                            changes.push(`배송: ${oldInfo} → ${newInfo}`);
                        }

                        // 11. Photos tracking
                        const oldPhotos = (oldData.photos || []).length;
                        const newPhotos = (finalPhotos || []).length;
                        if (oldPhotos !== newPhotos) {
                            changes.push(`PC사양: ${oldPhotos}개 → ${newPhotos}개`);
                        }

                        if (changes.length > 0) {
                            const now = new Date();
                            const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}  ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                            const log = {
                                time: timeStr,
                                manager: userData?.uid || "unknown",
                                managerName: userData?.name || "알 수 없음",
                                content: changes.join(" / ")
                            };
                            (dataToSave as any).modificationHistory = [...(oldData.modificationHistory || []), log];
                        }
                    }
                    transaction.update(activityRef, dataToSave as any);
                }

                transaction.update(customerRef, {
                    lastConsultDate: formData.date,
                    updatedAt: serverTimestamp()
                });

                return { success: true, affectedItems: Array.from(affectedItems) };
            });

            if (saveResult.success) {
                if (initialData?.photos) {
                    const urlsToDelete = initialData.photos.filter(url => !finalPhotos.includes(url));
                    if (urlsToDelete.length > 0) await cleanupOrphanedPhotos(urlsToDelete);
                }

                Promise.all(saveResult.affectedItems.map(itemKey => {
                    const [name, category] = itemKey.split("|");
                    return performSelfHealing(name, category);
                })).catch(e => console.error("Self-healing error:", e));

                setPendingFiles([]);
                await new Promise(resolve => setTimeout(resolve, 500));
                await queryClient.invalidateQueries({ queryKey: ["activities", customer.id] });
                await queryClient.invalidateQueries({ queryKey: ["customer", customer.id] });
                await queryClient.invalidateQueries({ queryKey: ["customers"] });
                await queryClient.invalidateQueries({ queryKey: ["assets", "management"] });

                toast({ title: "저장되었습니다.", status: "success", position: "top" });
                return true;
            }
            return false;
        } catch (error: any) {
            console.error("Remote A/S Submit Error:", error);
            toast({ title: "저장 실패", description: error.message, status: "error", position: "top" });
            return false;
        } finally {
            setIsLoading(false);
            isSubmitting.current = false;
        }
    };

    const handleDelete = async () => {
        if (!activityId) return false;

        // Surgical Guard: 3 Business Days Limit Enforcement
        if (initialData?.createdAt) {
            const createdAt = (initialData as any).createdAt?.toDate ? (initialData as any).createdAt.toDate() : new Date((initialData as any).createdAt);
            const isMaster = userData?.role === 'master';
            const isWithinEditTime = isWithinBusinessDays(createdAt, 3, holidayMap);

            if (!isMaster && !isWithinEditTime) {
                toast({ title: "삭제 불가", description: "작성 후 3영업일이 경과하여 삭제할 수 없습니다.", status: "error", position: "top" });
                return false;
            }
        }

        if (!window.confirm("해당 데이터 삭제를 희망하십니까?")) return false;

        setIsLoading(true);
        try {
            const assetQuery = query(collection(db, "assets"), where("sourceActivityId", "==", activityId));
            const assetSnap = await getDocs(assetQuery);
            const assetsToRestore = assetSnap.docs.map(d => ({ ref: d.ref, data: d.data() }));

            const result = await runTransaction(db, async (transaction) => {
                const affectedItems = new Set<string>();

                // --- 1. Collect all refs and keys ---
                const assetMetaKeys = new Set<string>();
                for (const asset of assetsToRestore) {
                    const key = `meta_${asset.data.name}_${asset.data.category}`.replace(/\//g, "_");
                    assetMetaKeys.add(key);
                }
                const activityRef = doc(db, "activities", activityId);
                const metaRef = doc(db, "customer_meta", `${customer.id}_${REMOTE_AS_COMPLETE_CONSTANTS.META_PREFIX}`);

                // --- 2. Perform ALL reads at the beginning ---
                const activitySnap = await transaction.get(activityRef);
                const metaSnap = await transaction.get(metaRef);
                const assetMetaDocs = new Map<string, any>();
                for (const key of assetMetaKeys) {
                    const snap = await transaction.get(doc(db, "asset_meta", key));
                    if (snap.exists()) assetMetaDocs.set(key, snap.data());
                }

                // --- 3. Process restoration (All writes) ---
                for (const asset of assetsToRestore) {
                    const name = asset.data.name;
                    const category = asset.data.category;
                    affectedItems.add(`${name}|${category}`);
                    const key = `meta_${name}_${category}`.replace(/\//g, "_");
                    const metaData = assetMetaDocs.get(key);

                    if (metaData) {
                        const restoredOutflow = Number(asset.data.lastOutflow) || 0;
                        const assetMetaRef = doc(db, "asset_meta", key);
                        transaction.update(assetMetaRef, {
                            currentStock: (Number(metaData.currentStock) || 0) + restoredOutflow,
                            totalOutflow: (Number(metaData.totalOutflow) || 0) - restoredOutflow,
                            lastUpdatedAt: serverTimestamp()
                        });
                    }
                    transaction.delete(asset.ref);
                }

                let photosToDelete: string[] = [];
                if (activitySnap.exists()) photosToDelete = activitySnap.data().photos || [];

                if (metaSnap.exists()) {
                    transaction.update(metaRef, {
                        totalCount: Math.max(0, (metaSnap.data().totalCount || 0) - 1),
                        lastDeletedAt: serverTimestamp()
                    });
                }
                transaction.delete(activityRef);

                return { success: true, photosToDelete, affectedItems: Array.from(affectedItems) };
            });

            if (result.success) {
                if (result.photosToDelete.length > 0) await cleanupOrphanedPhotos(result.photosToDelete);
                Promise.all(result.affectedItems.map(itemKey => {
                    const [name, category] = itemKey.split("|");
                    return performSelfHealing(name, category);
                })).catch(e => console.error("Self-healing error:", e));

                await new Promise(resolve => setTimeout(resolve, 500));
                await queryClient.invalidateQueries({ queryKey: ["activities", customer.id] });
                await queryClient.invalidateQueries({ queryKey: ["customer", customer.id] });
                await queryClient.invalidateQueries({ queryKey: ["customers"] });
                await queryClient.invalidateQueries({ queryKey: ["assets", "management"] });

                toast({ title: "삭제되었습니다.", status: "info", position: "top" });
                return true;
            }
            return false;
        } catch (error: any) {
            console.error("Delete Error:", error);
            toast({ title: "삭제 실패", description: error.message, status: "error", position: "top" });
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    return {
        formData, setFormData,
        isLoading,
        handleFileUpload, removePhoto,
        addSymptom, updateSymptom, toggleSymptomResolved, removeSymptom,
        handleAddProduct, handleUpdateQty, handleRemoveProduct, handleReorder,
        handleAddSupply, handleUpdateSupplyQty, handleReorderSupplies,
        submit,
        handleDelete
    };
};
