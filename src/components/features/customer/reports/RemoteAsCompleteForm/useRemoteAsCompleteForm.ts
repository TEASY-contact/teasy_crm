"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@chakra-ui/react";
import { db, storage } from "@/lib/firebase";
import { doc, collection, serverTimestamp, runTransaction, query, where, getDocs } from "firebase/firestore";
import { ref as sRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { useAuth } from "@/context/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { normalizeText, applyColonStandard } from "@/utils/textFormatter";
import { REMOTE_AS_COMPLETE_CONSTANTS, RemoteAsCompleteFormData, SelectedItem } from "./types";
import { Activity, ManagerOption } from "@/types/domain";
import { getCircledNumber } from "@/components/features/asset/AssetModalUtils";
import { formatPhone } from "@/utils/formatter";
import { performSelfHealing } from "@/utils/assetUtils";

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

    const cleanupOrphanedPhotos = useCallback(async (urlsToDelete: string[]) => {
        if (!urlsToDelete || urlsToDelete.length === 0) return;
        const cloudUrls = urlsToDelete.filter(url => url.startsWith('https://firebasestorage.googleapis.com'));
        if (cloudUrls.length === 0) return;

        await Promise.allSettled(cloudUrls.map(async (url) => {
            try {
                const storageRef = sRef(storage, url);
                await deleteObject(storageRef);
            } catch (e) {
                console.warn("Resource cleanup attempt failed:", url, e);
            }
        }));
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
        setFormData(prev => ({
            ...prev,
            symptoms: prev.symptoms.filter((_, i) => i !== index)
        }));
    }, []);



    const handleAddProduct = useCallback((val: string, products: any[]) => {
        if (!val) return;
        const productInfo = products.find(p => p.value === val);
        if (!productInfo) return;

        const rowId = Math.random().toString(36).substr(2, 9);
        setFormData(prev => ({
            ...prev,
            selectedProducts: [...prev.selectedProducts, {
                id: rowId,
                name: productInfo.label,
                quantity: 1,
                category: productInfo.category || ""
            }]
        }));
    }, []);

    const handleUpdateQty = useCallback((id: string, delta: number) => {
        setFormData(prev => {
            const newList = [...prev.selectedProducts];
            const idx = newList.findIndex(p => p.id === id);
            if (idx === -1) return prev;
            const newQty = newList[idx].quantity + delta;
            if (newQty <= 0) {
                if (window.confirm("항목을 삭제하시겠습니까?")) {
                    return { ...prev, selectedProducts: newList.filter(p => p.id !== id) };
                }
                return prev;
            }
            newList[idx].quantity = newQty;
            return { ...prev, selectedProducts: newList };
        });
    }, []);

    const handleReorder = useCallback((newList: SelectedItem[]) => {
        setFormData(prev => ({ ...prev, selectedProducts: newList }));
    }, []);

    const handleAddSupply = useCallback((val: string, items: any[]) => {
        if (!val) return;
        const info = items.find(p => p.value === val);
        if (!info) return;

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
        setFormData(prev => {
            const newList = [...prev.selectedSupplies];
            const idx = newList.findIndex(p => p.id === id);
            if (idx === -1) return prev;
            const newQty = newList[idx].quantity + delta;
            if (newQty <= 0) {
                if (window.confirm("항목을 삭제하시겠습니까?")) {
                    return { ...prev, selectedSupplies: newList.filter(p => p.id !== id) };
                }
                return prev;
            }
            newList[idx].quantity = newQty;
            return { ...prev, selectedSupplies: newList };
        });
    }, []);

    const handleReorderSupplies = useCallback((newList: SelectedItem[]) => {
        setFormData(prev => ({ ...prev, selectedSupplies: newList }));
    }, []);

    const submit = async (managerOptions: ManagerOption[]) => {
        if (isLoading || isSubmitting.current) return false;

        const validSymptoms = formData.symptoms.filter(s => s.text && s.text.trim() !== "");
        const supportContent = formData.supportContent ? formData.supportContent.trim() : "";
        const validProducts = formData.selectedProducts.filter(p => p.name && p.name.trim() !== "");
        const isRemoteSupport = formData.asType === "원격 지원";

        if (!formData.date || !formData.manager || !formData.asType || !formData.phone ||
            validSymptoms.length === 0 || supportContent === "" || validProducts.length === 0 ||
            (isRemoteSupport && formData.photos.length === 0)) {

            let description = "필수 항목을 모두 입력해주세요.";
            if (validProducts.length === 0) description = "점검 상품을 하나 이상 선택해주세요.";
            else if (isRemoteSupport && formData.photos.length === 0) description = "원격 지원 유형은 PC 사양 사진이 필수입니다.";

            toast({ title: "필수 항목 누락", description, status: "warning", position: "top" });
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
                    updatedAt: serverTimestamp(),
                    createdByName: userData?.name || "알 수 없음"
                };

                if (!activityId) {
                    (dataToSave as any).createdAt = serverTimestamp();
                    (dataToSave as any).createdBy = userData?.uid;
                    (dataToSave as any).sequenceNumber = nextSeq;
                    transaction.set(activityRef, dataToSave);
                    transaction.set(metaRef, {
                        lastSequence: nextSeq,
                        totalCount: (currentMeta.totalCount || 0) + 1,
                        lastUpdatedAt: serverTimestamp()
                    }, { merge: true });
                } else {
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
                await queryClient.invalidateQueries({ queryKey: ["customers", "list"] });
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
        if (!window.confirm("보고서와 연결된 데이터 및 사진이 모두 삭제됩니다. 정말 삭제하시겠습니까?")) return false;

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
                await queryClient.invalidateQueries({ queryKey: ["customers", "list"] });
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
        handleAddProduct, handleUpdateQty, handleReorder,
        handleAddSupply, handleUpdateSupplyQty, handleReorderSupplies,
        submit,
        handleDelete
    };
};
