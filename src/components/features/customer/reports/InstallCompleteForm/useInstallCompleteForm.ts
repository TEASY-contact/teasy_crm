// src/components/features/customer/reports/InstallCompleteForm/useInstallCompleteForm.ts
"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@chakra-ui/react";
import { db, storage } from "@/lib/firebase";
import { collection, serverTimestamp, doc, runTransaction } from "firebase/firestore";
import { ref as sRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { useAuth } from "@/context/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { applyColonStandard } from "@/utils/textFormatter";
import { formatPhone } from "@/utils/formatter";
import { InstallCompleteFormData } from "./types";
import { Activity, ActivityType, Asset } from "@/types/domain";
import { getCircledNumber } from "@/components/features/asset/AssetModalUtils";
import { performSelfHealing } from "@/utils/assetUtils";

export const INSTALL_COMPLETE_CONSTANTS = {
    TYPE: "install_complete" as ActivityType,
    TYPE_NAME: "시공 완료",
    META_PREFIX: "install_complete",
    MAX_PHOTOS: 15,
    STORAGE_PATH_PREFIX: "activities/install_complete"
};

interface UseInstallCompleteFormProps {
    customer: { id: string, name: string, address?: string, phone?: string };
    activities?: any[];
    activityId?: string;
    initialData?: Partial<InstallCompleteFormData>;
    defaultManager?: string;
    rawAssets?: Asset[];
}

export const useInstallCompleteForm = ({ customer, activities = [], activityId, initialData, defaultManager, rawAssets = [] }: UseInstallCompleteFormProps) => {
    const { userData } = useAuth();
    const queryClient = useQueryClient();
    const toast = useToast();
    const isSubmitting = useRef(false);
    const [isLoading, setIsLoading] = useState(false);

    const [pendingFiles, setPendingFiles] = useState<{ url: string, file: File }[]>([]);

    const [formData, setFormData] = useState<InstallCompleteFormData>({
        date: "",
        manager: defaultManager || "",
        location: customer?.address || "",
        phone: formatPhone(customer?.phone || ""),
        selectedProducts: [],
        selectedSupplies: [],
        tasksBefore: [],
        tasksAfter: [],
        incompleteReason: "",
        photos: [],
        memo: ""
    });

    useEffect(() => {
        if (initialData) {
            setFormData(prev => ({
                ...prev,
                ...initialData,
                manager: initialData.manager || defaultManager || "",
                selectedProducts: initialData.selectedProducts || [],
                selectedSupplies: initialData.selectedSupplies || [],
                tasksBefore: (initialData.tasksBefore || []).map((t: any) => typeof t === 'string' ? { text: t, completed: false } : t),
                tasksAfter: (initialData.tasksAfter || []).map((t: any) => typeof t === 'string' ? { text: t, completed: false } : t),
                photos: initialData.photos || []
            }));
        } else {
            const now = new Date();
            const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}  ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

            // Auto-fill from last install_schedule
            const lastInstallSchedule = [...(activities || [])].reverse().find(a => a.type === "install_schedule");

            setFormData(prev => ({
                ...prev,
                date: formattedDate,
                location: lastInstallSchedule?.location || customer?.address || "",
                phone: formatPhone(lastInstallSchedule?.phone || customer?.phone || ""),
                manager: lastInstallSchedule?.manager || prev.manager,
                selectedProducts: lastInstallSchedule?.selectedProducts || [],
                selectedSupplies: lastInstallSchedule?.selectedSupplies || [],
                tasksBefore: (lastInstallSchedule?.tasksBefore || []).map((t: string) => ({ text: t, completed: false })),
                tasksAfter: (lastInstallSchedule?.tasksAfter || []).map((t: string) => ({ text: t, completed: false })),
                incompleteReason: "",
                photos: [] // Fresh photos for completion
            }));
        }
    }, [initialData, defaultManager, customer.address, customer.phone, activities]);

    const handleFileUpload = useCallback((files: FileList | null) => {
        if (!files || files.length === 0) return;

        setFormData(prev => {
            if (prev.photos.length + files.length > INSTALL_COMPLETE_CONSTANTS.MAX_PHOTOS) {
                toast({ title: "한도 초과", description: `사진은 최대 ${INSTALL_COMPLETE_CONSTANTS.MAX_PHOTOS}장까지 업로드 가능합니다.`, status: "warning", position: "top" });
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

    const submit = useCallback(async (managerOptions: any[]) => {
        if (isLoading || isSubmitting.current) return false;

        if (!formData.date || !formData.manager || !formData.location || !formData.phone) {
            toast({ title: "필수 항목 누락", status: "warning", duration: 2000, position: "top" });
            return false;
        }

        const hasIncompleteTask = [...formData.tasksBefore, ...formData.tasksAfter].some(t => !t.completed);
        if (hasIncompleteTask && !formData.incompleteReason.trim()) {
            toast({ title: "미수행 사유 입력 필요", description: "체크되지 않은 업무가 있습니다. 사유를 입력해주세요.", status: "warning", duration: 2000, position: "top" });
            return false;
        }

        setIsLoading(true);
        isSubmitting.current = true;

        // Ensure the loading overlay is painted before intensive work (v124.92)
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
            const cleanPhone = formData.phone.replace(/[^0-9]/g, "");
            const affectedItems = new Set<string>();

            // Upload Photos
            let finalPhotos = [...formData.photos];
            if (pendingFiles.length > 0) {
                const uniquePending = Array.from(new Map(pendingFiles.map(p => [p.file.name + p.file.size, p])).values());

                const uploadPromises = uniquePending.map(async (p, i) => {
                    const ext = p.file.name.split('.').pop() || 'jpg';
                    const filename = `complete_${Date.now()}_${i}_${Math.random().toString(36).substring(7)}.${ext}`;
                    const storagePath = `${INSTALL_COMPLETE_CONSTANTS.STORAGE_PATH_PREFIX}/${customer.id}/${filename}`;
                    const storageRef = sRef(storage, storagePath);
                    await uploadBytes(storageRef, p.file);
                    return await getDownloadURL(storageRef);
                });
                const uploadedUrls = await Promise.all(uploadPromises);
                finalPhotos = finalPhotos.filter(url => !url.startsWith('blob:')).concat(uploadedUrls);
            }

            // Deduplicate photos
            const finalSeen = new Set();
            finalPhotos = finalPhotos.filter(url => {
                const baseUrl = url.split('?')[0].trim();
                if (finalSeen.has(baseUrl)) return false;
                finalSeen.add(baseUrl);
                return true;
            });

            // --- Pre-transaction Read (v1.3 Sync with Schedule Logic) ---
            let existingAssets: any[] = [];
            if (activityId) {
                const { query, where, getDocs } = await import("firebase/firestore");
                const assetQuery = query(collection(db, "assets"), where("sourceActivityId", "==", activityId));
                const assetSnap = await getDocs(assetQuery);
                existingAssets = assetSnap.docs.map(d => ({ ref: d.ref, data: d.data() }));
            }

            const saveResult = await runTransaction(db, async (transaction) => {
                const selectedManager = managerOptions.find(o => o.value === formData.manager);
                const targetActivityId = activityId || doc(collection(db, "activities")).id;
                const activityRef = doc(db, "activities", targetActivityId);

                // --- 1. Settlement Preparation (READS MUST BE FIRST) ---
                const lastSchedule = [...(activities || [])].reverse().find(a => a.type === "install_schedule");
                const reservedSupplies = lastSchedule?.selectedSupplies || [];

                // Aggregate reserved supplies
                const reservedMap = new Map<string, { name: string, category: string, quantity: number }>();
                reservedSupplies.forEach((s: any) => {
                    const key = `${s.name.trim()}|${(s.category || "").trim()}`;
                    reservedMap.set(key, { name: s.name.trim(), category: (s.category || "").trim(), quantity: (reservedMap.get(key)?.quantity || 0) + (Number(s.quantity) || 0) });
                });

                // Aggregate actual supplies
                const actualMap = new Map<string, { name: string, category: string, quantity: number }>();
                formData.selectedSupplies.forEach(s => {
                    const key = `${s.name.trim()}|${(s.category || "").trim()}`;
                    actualMap.set(key, { name: s.name.trim(), category: (s.category || "").trim(), quantity: (actualMap.get(key)?.quantity || 0) + (Number(s.quantity) || 0) });
                });

                // Calculate Settlement Items
                const allKeys = new Set([...reservedMap.keys(), ...actualMap.keys()]);
                const settlementItems: { name: string, category: string, delta: number }[] = [];

                allKeys.forEach(key => {
                    const reservedQty = reservedMap.get(key)?.quantity || 0;
                    const actualQty = actualMap.get(key)?.quantity || 0;
                    const delta = reservedQty - actualQty; // + : Return to stock (Inflow), - : Extra usage (Outflow)

                    if (delta !== 0) {
                        const item = reservedMap.get(key) || actualMap.get(key);
                        if (item && item.category) {
                            settlementItems.push({ name: item.name, category: item.category, delta });
                        }
                    }
                });

                // --- 2. ALL READS START ---
                // Customer and Activity Meta
                const metaRef = doc(db, "customer_meta", `${customer.id}_${INSTALL_COMPLETE_CONSTANTS.META_PREFIX}`);
                const metaSnap = await transaction.get(metaRef);

                // Asset Metas for ALL involved items (Settlement + Actuals)
                const metaReadTasks = settlementItems.map(async (item) => {
                    const metaId = `meta_${item.name}_${item.category}`.replace(/\//g, "_");
                    const assetMetaRef = doc(db, "asset_meta", metaId);
                    const snap = await transaction.get(assetMetaRef);
                    return { item, ref: assetMetaRef, snap };
                });

                const supplyMetaResults = await Promise.all(metaReadTasks);

                // --- 3. ALL WRITES START ---
                let currentMeta = metaSnap.exists() ? metaSnap.data() : { lastSequence: 0, totalCount: 0 };
                const validProducts = formData.selectedProducts.filter(p => p.name && p.name.trim() !== "");
                const validSupplies = formData.selectedSupplies.filter(s => s.name && s.name.trim() !== "");

                const dataToSave: Partial<Activity> = {
                    customerId: customer.id,
                    customerName: customer.name,
                    type: INSTALL_COMPLETE_CONSTANTS.TYPE,
                    typeName: INSTALL_COMPLETE_CONSTANTS.TYPE_NAME,
                    date: formData.date,
                    manager: formData.manager,
                    managerName: selectedManager?.label || formData.manager,
                    managerRole: selectedManager?.role || "employee",
                    location: formData.location,
                    phone: cleanPhone,
                    product: validProducts.map((p, idx) => {
                        const prefix = validProducts.length > 1 ? getCircledNumber(idx + 1) : "";
                        return `${prefix}${p.name} × ${p.quantity}`;
                    }).join(", "),
                    selectedProducts: validProducts,
                    selectedSupplies: validSupplies,
                    tasksBefore: formData.tasksBefore,
                    tasksAfter: formData.tasksAfter,
                    incompleteReason: formData.incompleteReason,
                    photos: finalPhotos,
                    memo: applyColonStandard(formData.memo || ""),
                    updatedAt: serverTimestamp(),
                    createdByName: userData?.name || "알 수 없음"
                };

                const now = new Date();
                const actionDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

                const customerRef = doc(db, "customers", customer.id);
                transaction.update(customerRef, {
                    lastConsultDate: formData.date,
                    updatedAt: serverTimestamp()
                });

                if (activityId) {
                    existingAssets.forEach(asset => {
                        affectedItems.add(`${asset.data.name}|${asset.data.category}`);
                        transaction.delete(asset.ref);
                    });
                    transaction.update(activityRef, dataToSave as any);
                } else {
                    const nextSeq = lastSchedule?.sequenceNumber || (Number(currentMeta.lastSequence) || 0) + 1;
                    transaction.set(activityRef, {
                        ...dataToSave,
                        sequenceNumber: nextSeq,
                        createdAt: serverTimestamp(),
                        createdBy: userData?.uid || "system",
                    });
                    transaction.set(metaRef, {
                        lastSequence: nextSeq,
                        totalCount: (Number(currentMeta.totalCount) || 0) + 1,
                        lastUpdatedAt: serverTimestamp()
                    }, { merge: true });
                }

                // Inventory Settlement Writes
                for (const result of supplyMetaResults) {
                    const { item, ref: assetMetaRef, snap: assetMetaSnap } = result;
                    affectedItems.add(`${item.name}|${item.category}`);

                    let currentAssetMeta = assetMetaSnap.exists() ? assetMetaSnap.data() : { totalInflow: 0, totalOutflow: 0, currentStock: 0 };
                    const finalStock = (Number(currentAssetMeta.currentStock) || 0) + item.delta;

                    // Update Meta
                    transaction.set(assetMetaRef, {
                        ...currentAssetMeta,
                        currentStock: finalStock,
                        totalInflow: item.delta > 0 ? (Number(currentAssetMeta.totalInflow) || 0) + item.delta : (Number(currentAssetMeta.totalInflow) || 0),
                        totalOutflow: item.delta < 0 ? (Number(currentAssetMeta.totalOutflow) || 0) + Math.abs(item.delta) : (Number(currentAssetMeta.totalOutflow) || 0),
                        lastUpdatedAt: serverTimestamp(),
                        lastAction: item.delta > 0 ? "install_recovery" : "install_extra_outflow"
                    }, { merge: true });

                    // Create Asset Record
                    const newAssetRef = doc(collection(db, "assets"));
                    transaction.set(newAssetRef, {
                        category: item.category,
                        name: item.name,
                        stock: finalStock,
                        type: "inventory",
                        lastActionDate: actionDate,
                        lastOperator: selectedManager?.label || userData?.name || "System",
                        lastInflow: item.delta > 0 ? item.delta : null,
                        lastOutflow: item.delta < 0 ? Math.abs(item.delta) : null,
                        lastRecipient: customer.name || "-",
                        lastRecipientId: customer.id,
                        createdAt: serverTimestamp(),
                        editLog: item.delta > 0
                            ? `시공 정산: 물량 남음 (현장 회수 입고) [${customer.name}]`
                            : `시공 정산: 물량 추가 사용 (현장 추가 출급) [${customer.name}]`,
                        sourceActivityId: targetActivityId
                    });
                }

                return { success: true, affectedItems: Array.from(affectedItems) };
            });

            if (saveResult.success) {
                // Photo Cleanup
                if (activityId && initialData?.photos) {
                    const removedPhotos = initialData.photos.filter((oldUrl: string) => !finalPhotos.includes(oldUrl));
                    await cleanupOrphanedPhotos(removedPhotos);
                }

                // Background Heal
                Promise.all(saveResult.affectedItems.map(itemKey => {
                    const [name, category] = itemKey.split("|");
                    return performSelfHealing(name, category);
                })).catch(e => console.error("Self-healing error:", e));

                setPendingFiles([]);
                // Delay for Firestore indexing (v123.03)
                await new Promise(resolve => setTimeout(resolve, 500));
                await queryClient.invalidateQueries({ queryKey: ["activities", customer.id] });
                await queryClient.invalidateQueries({ queryKey: ["customer", customer.id] });
                await queryClient.invalidateQueries({ queryKey: ["customers", "list"] });
                await queryClient.invalidateQueries({ queryKey: ["assets", "management"] });
                toast({ title: initialData ? "시공 완료 수정 완료" : "시공 완료 등록 완료", status: "success", duration: 2000, position: "top" });
                return true;
            }
        } catch (error: any) {
            console.error("Install Complete Submit Failure:", error);
            toast({ title: "저장 실패", description: error.message, status: "error", position: "top" });
            return false;
        } finally {
            setIsLoading(false);
            isSubmitting.current = false;
        }
        return false;
    }, [isLoading, formData, activities, pendingFiles, activityId, initialData, customer.id, customer.name, userData?.name, userData?.uid, toast, cleanupOrphanedPhotos, queryClient]);

    const handleDelete = useCallback(async () => {
        if (!activityId) return false;
        if (!window.confirm(`보고서와 연결된 사진이 모두 삭제됩니다. 정말 삭제하시겠습니까?`)) return false;
        setIsLoading(true);
        try {
            // --- Pre-transaction Read ---
            const { query, where, getDocs } = await import("firebase/firestore");
            const assetQuery = query(collection(db, "assets"), where("sourceActivityId", "==", activityId));
            const assetSnap = await getDocs(assetQuery);
            const assetsToRestores = assetSnap.docs.map(d => ({ ref: d.ref, data: d.data() }));

            const result = await runTransaction(db, async (transaction) => {
                const affectedItems = new Set<string>();

                // 1. ALL READS FIRST
                const metaSnapshots = await Promise.all(assetsToRestores.map(async (asset) => {
                    const metaId = `meta_${asset.data.name}_${asset.data.category}`.replace(/\//g, "_");
                    const assetMetaRef = doc(db, "asset_meta", metaId);
                    const snap = await transaction.get(assetMetaRef);
                    return { asset, ref: assetMetaRef, snap };
                }));

                const activityRef = doc(db, "activities", activityId);
                const activitySnap = await transaction.get(activityRef);
                const metaRef = doc(db, "customer_meta", `${customer.id}_${INSTALL_COMPLETE_CONSTANTS.META_PREFIX}`);
                const custMetaSnap = await transaction.get(metaRef);

                // 2. ALL WRITES
                for (const item of metaSnapshots) {
                    const { asset, ref: assetMetaRef, snap: assetMetaSnap } = item;
                    affectedItems.add(`${asset.data.name}|${asset.data.category}`);
                    if (assetMetaSnap.exists()) {
                        const metaData = assetMetaSnap.data();
                        const restoredOutflow = Number(asset.data.lastOutflow) || 0;
                        transaction.update(assetMetaRef, {
                            currentStock: (Number(metaData.currentStock) || 0) + restoredOutflow,
                            totalOutflow: (Number(metaData.totalOutflow) || 0) - restoredOutflow,
                            lastUpdatedAt: serverTimestamp(),
                            lastAction: "delete_recovery"
                        });
                    }
                    transaction.delete(asset.ref);
                }

                let photosToDelete: string[] = [];
                if (activitySnap.exists()) {
                    photosToDelete = activitySnap.data().photos || [];
                }

                if (custMetaSnap.exists()) {
                    transaction.update(metaRef, {
                        totalCount: Math.max(0, (Number(custMetaSnap.data().totalCount) || 0) - 1),
                        lastDeletedAt: serverTimestamp()
                    });
                }
                transaction.delete(activityRef);
                return { success: true, affectedItems: Array.from(affectedItems), photosToDelete };
            });
            if (result.success) {
                if (result.photosToDelete.length > 0) await cleanupOrphanedPhotos(result.photosToDelete);
                Promise.all(result.affectedItems.map(itemKey => {
                    const [name, category] = itemKey.split("|");
                    return performSelfHealing(name, category);
                })).catch(e => console.error("Self-healing error:", e));
                // Delay for Firestore indexing
                await new Promise(resolve => setTimeout(resolve, 500));
                await queryClient.invalidateQueries({ queryKey: ["activities", customer.id] });
                await queryClient.invalidateQueries({ queryKey: ["customer", customer.id] });
                await queryClient.invalidateQueries({ queryKey: ["customers", "list"] });
                await queryClient.invalidateQueries({ queryKey: ["assets", "management"] });
                toast({ title: "삭제 완료", status: "info", duration: 2000, position: "top" });
                return true;
            }
            return false;
        } catch (error) {
            console.error("Install Complete Delete Failure:", error);
            toast({ title: "삭제 실패", status: "error", position: "top" });
            return false;
        } finally {
            setIsLoading(false);
        }
        return false;
    }, [activityId, customer.id, toast, cleanupOrphanedPhotos, queryClient]);

    const addTask = useCallback((type: 'before' | 'after') => {
        return; // Fixed from schedule
    }, []);

    const updateTask = useCallback((type: 'before' | 'after', index: number, value: string) => {
        return; // Read-only text
    }, []);

    const removeTask = useCallback((type: 'before' | 'after', index: number) => {
        return; // Fixed from schedule
    }, []);

    const toggleTask = useCallback((type: 'before' | 'after', index: number) => {
        setFormData(prev => {
            const field = type === 'before' ? 'tasksBefore' : 'tasksAfter';
            const newList = [...prev[field]];
            newList[index] = { ...newList[index], completed: !newList[index].completed };
            return { ...prev, [field]: newList };
        });
    }, []);

    return {
        formData, setFormData,
        isLoading,
        handleFileUpload, removePhoto,
        addTask, updateTask, removeTask, toggleTask,
        submit,
        handleDelete
    };
};
