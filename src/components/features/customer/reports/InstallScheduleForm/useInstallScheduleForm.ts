// src/components/features/customer/reports/InstallScheduleForm/useInstallScheduleForm.ts
"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@chakra-ui/react";
import { db, storage } from "@/lib/firebase";
import { collection, serverTimestamp, doc, runTransaction, query, where, getDocs } from "firebase/firestore";
import { ref as sRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { useAuth } from "@/context/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { applyColonStandard } from "@/utils/textFormatter";
import { formatPhone } from "@/utils/formatter";
import { InstallScheduleFormData, SelectedItem } from "./types";
import { Activity, ActivityType, Asset } from "@/types/domain";
import { getCircledNumber } from "@/components/features/asset/AssetModalUtils";
import { performSelfHealing } from "@/utils/assetUtils";

export const INSTALL_SCHEDULE_CONSTANTS = {
    TYPE: "install_schedule" as ActivityType,
    TYPE_NAME: "시공 확정",
    META_PREFIX: "install_schedule",
    MAX_PHOTOS: 15,
    STORAGE_PATH_PREFIX: "activities/install"
};

interface UseInstallScheduleFormProps {
    customer: { id: string, name: string, address?: string, phone?: string };
    activities?: any[];
    activityId?: string;
    initialData?: Partial<InstallScheduleFormData>;
    defaultManager?: string;
    rawAssets?: Asset[];
}

export const useInstallScheduleForm = ({ customer, activities = [], activityId, initialData, defaultManager, rawAssets = [] }: UseInstallScheduleFormProps) => {
    const { userData } = useAuth();
    const queryClient = useQueryClient();
    const toast = useToast();
    const isSubmitting = useRef(false);
    const [isLoading, setIsLoading] = useState(false);

    // File upload state
    const [pendingFiles, setPendingFiles] = useState<{ url: string, file: File }[]>([]);

    const [formData, setFormData] = useState<InstallScheduleFormData>({
        date: "",
        manager: defaultManager || "",
        location: customer?.address || "",
        phone: formatPhone(customer?.phone || ""),
        selectedProducts: [],
        selectedSupplies: [],
        tasksBefore: [""],
        tasksAfter: [""],
        photos: [],
        memo: ""
    });

    // Populate Initial Data
    useEffect(() => {
        if (initialData) {
            setFormData(prev => ({
                ...prev,
                ...initialData,
                manager: initialData.manager || defaultManager || "",
                selectedProducts: initialData.selectedProducts || [],
                selectedSupplies: initialData.selectedSupplies || [],
                tasksBefore: initialData.tasksBefore || [""],
                tasksAfter: initialData.tasksAfter || [""],
                photos: initialData.photos || []
            }));
        } else {
            const now = new Date();
            const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}  ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

            // Auto-fill from last reports
            const sortedActivities = [...(activities || [])].sort((a, b) => {
                const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.date || 0);
                const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.date || 0);
                return dateA.getTime() - dateB.getTime();
            });

            const lastSchedule = [...sortedActivities].reverse().find(a => a.type === "demo_schedule");
            const lastDemoComplete = [...sortedActivities].reverse().find(a => a.type === "demo_complete");

            // Match Install Schedule to corresponding Installation Purchase
            const installationPurchases = sortedActivities.filter(a => a.type === 'purchase_confirm' && a.productCategory === 'product');
            const existingSchedulesCount = sortedActivities.filter(a => a.type === 'install_schedule').length;
            const targetPurchase = installationPurchases[existingSchedulesCount];

            const inheritedProducts = (targetPurchase?.selectedProducts || []).map((p: any) => ({
                ...p,
                isInherited: true // Flag to lock the UI
            }));

            setFormData(prev => ({
                ...prev,
                date: formattedDate,
                location: lastSchedule?.location || customer?.address || "",
                phone: formatPhone(lastSchedule?.phone || customer?.phone || ""),
                manager: lastSchedule?.manager || prev.manager,
                selectedProducts: inheritedProducts,
                selectedSupplies: [],
                tasksBefore: [""],
                tasksAfter: [""],
                photos: lastDemoComplete?.photos || []
            }));
        }
    }, [initialData, defaultManager, customer.address, customer.phone, activities]);

    const handleFileUpload = useCallback((files: FileList | null) => {
        if (!files || files.length === 0) return;

        setFormData(prev => {
            if (prev.photos.length + files.length > INSTALL_SCHEDULE_CONSTANTS.MAX_PHOTOS) {
                toast({ title: "한도 초과", description: `사진은 최대 ${INSTALL_SCHEDULE_CONSTANTS.MAX_PHOTOS}장까지 업로드 가능합니다.`, status: "warning", position: "top" });
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
    }, [toast]);

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

        // Validation Rules
        const validations = [
            { cond: !formData.date, msg: "시공 일시를 입력해주세요." },
            { cond: !formData.manager, msg: "담당자를 선택해주세요." },
            { cond: !formData.location, msg: "방문 주소를 입력해주세요." },
            { cond: !formData.phone, msg: "연락처를 입력해주세요." },
            { cond: formData.selectedProducts.length === 0, msg: "시공 상품을 1개 이상 선택해주세요." }
        ];

        const error = validations.find(v => v.cond);
        if (error) {
            toast({ title: error.msg, status: "warning", duration: 2000, position: "top" });
            return false;
        }

        setIsLoading(true);
        isSubmitting.current = true;

        // Ensure painting (v124.92)
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
                    const filename = `install_${Date.now()}_${i}_${Math.random().toString(36).substring(7)}.${ext}`;
                    const storagePath = `${INSTALL_SCHEDULE_CONSTANTS.STORAGE_PATH_PREFIX}/${customer.id}/${filename}`;
                    const storageRef = sRef(storage, storagePath);
                    await uploadBytes(storageRef, p.file);
                    return await getDownloadURL(storageRef);
                });
                const uploadedUrls = await Promise.all(uploadPromises);
                finalPhotos = finalPhotos.filter(url => !url.startsWith('blob:')).concat(uploadedUrls);
            }

            // High-reliability deduplication by base URL (v124.76)
            const finalSeen = new Set();
            finalPhotos = finalPhotos.filter(url => {
                const baseUrl = url.split('?')[0].trim();
                if (finalSeen.has(baseUrl)) return false;
                finalSeen.add(baseUrl);
                return true;
            });

            // --- Pre-transaction Read (Non-atomic reads for assets if needed) ---
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

                // 1. ALL READS FIRST (With Aggregation to prevent duplicate deduction bugs)
                const metaRef = doc(db, "customer_meta", `${customer.id}_${INSTALL_SCHEDULE_CONSTANTS.META_PREFIX}`);
                const metaSnap = await transaction.get(metaRef);

                const aggregatedSuppliesMap = new Map<string, { name: string, category: string, quantity: number }>();
                formData.selectedSupplies.forEach(s => {
                    const key = `${s.name.trim()}|${(s.category || "").trim()}`;
                    const qty = Number(s.quantity) || 1;
                    if (aggregatedSuppliesMap.has(key)) {
                        aggregatedSuppliesMap.get(key)!.quantity += qty;
                    } else {
                        aggregatedSuppliesMap.set(key, { ...s, name: s.name.trim(), category: (s.category || "").trim(), quantity: qty });
                    }
                });

                const supplyMetas = await Promise.all(Array.from(aggregatedSuppliesMap.values()).map(async (supply) => {
                    const name = supply.name.trim();
                    const category = (supply.category || "").trim();
                    const metaId = `meta_${name}_${category}`.replace(/\//g, "_");
                    const assetMetaRef = doc(db, "asset_meta", metaId);
                    const snap = await transaction.get(assetMetaRef);
                    return { supply, ref: assetMetaRef, snap };
                }));

                // 2. LOGIC & PREPARATION
                let currentMeta = metaSnap.exists() ? metaSnap.data() : { lastSequence: 0, totalCount: 0 };

                const validProducts = formData.selectedProducts.filter(p => p.name && p.name.trim() !== "");
                const validSupplies = formData.selectedSupplies.filter(s => s.name && s.name.trim() !== "");

                const dataToSave: Partial<Activity> = {
                    customerId: customer.id,
                    customerName: customer.name,
                    type: INSTALL_SCHEDULE_CONSTANTS.TYPE,
                    typeName: INSTALL_SCHEDULE_CONSTANTS.TYPE_NAME,
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
                    tasksBefore: formData.tasksBefore.filter(t => t && t.trim() !== ""),
                    tasksAfter: formData.tasksAfter.filter(t => t && t.trim() !== ""),
                    photos: finalPhotos,
                    memo: applyColonStandard(formData.memo || ""),
                    updatedAt: serverTimestamp(),
                    createdByName: userData?.name || "알 수 없음"
                };

                const now = new Date();
                const actionDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

                // 3. ALL WRITES
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
                    const nextSeq = (Number(currentMeta.lastSequence) || 0) + 1;
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

                // Inventory Deduction Writes
                for (const item of supplyMetas) {
                    const { supply, ref: assetMetaRef, snap: assetMetaSnap } = item;
                    const name = supply.name.trim();
                    const category = (supply.category || "").trim();
                    const quantity = Number(supply.quantity) || 1;
                    if (!category) continue;
                    affectedItems.add(`${name}|${category}`);

                    let currentAssetMeta = assetMetaSnap.exists() ? assetMetaSnap.data() : { totalInflow: 0, totalOutflow: 0, currentStock: 0 };
                    const finalStock = (Number(currentAssetMeta.currentStock) || 0) - quantity;

                    transaction.set(assetMetaRef, {
                        ...currentAssetMeta,
                        currentStock: finalStock,
                        totalOutflow: (Number(currentAssetMeta.totalOutflow) || 0) + quantity,
                        lastUpdatedAt: serverTimestamp(),
                        lastAction: "install_schedule_deduction"
                    }, { merge: true });

                    const newAssetRef = doc(collection(db, "assets"));
                    transaction.set(newAssetRef, {
                        category,
                        name,
                        stock: finalStock,
                        type: "inventory",
                        lastActionDate: actionDate,
                        lastOperator: selectedManager?.label || userData?.name || "System",
                        lastInflow: null,
                        lastOutflow: quantity,
                        lastRecipient: customer.name || "-",
                        lastRecipientId: customer.id,
                        createdAt: serverTimestamp(),
                        editLog: `시공 확정 물품 차감 (${customer.name}) [Lock-Verified]`,
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
                toast({ title: "시공 예약 완료", status: "success", duration: 2000, position: "top" });
                return true;
            }
            return false;
        } catch (error: any) {
            console.error("Install Schedule Submit Failure:", error);
            toast({ title: "저장 실패", description: error.message, status: "error", position: "top" });
            return false;
        } finally {
            setIsLoading(false);
            isSubmitting.current = false;
        }
    }, [isLoading, formData, activities, pendingFiles, activityId, initialData?.photos, customer.id, customer.name, userData?.name, userData?.uid, toast, cleanupOrphanedPhotos, queryClient]);

    const addTask = useCallback((type: 'before' | 'after') => {
        const field = type === 'before' ? 'tasksBefore' : 'tasksAfter';
        setFormData(prev => ({
            ...prev,
            [field]: [...prev[field], ""]
        }));
    }, []);

    const updateTask = useCallback((type: 'before' | 'after', index: number, value: string) => {
        const field = type === 'before' ? 'tasksBefore' : 'tasksAfter';
        setFormData(prev => {
            const newList = [...prev[field]];
            newList[index] = value;
            return { ...prev, [field]: newList };
        });
    }, []);

    const removeTask = useCallback((type: 'before' | 'after', index: number) => {
        const field = type === 'before' ? 'tasksBefore' : 'tasksAfter';
        setFormData(prev => {
            if (prev[field].length <= 1) return { ...prev, [field]: [""] };
            return {
                ...prev,
                [field]: prev[field].filter((_, i) => i !== index)
            };
        });
    }, []);

    const handleDelete = useCallback(async () => {
        if (!activityId) return false;
        if (!window.confirm(`보고서와 연결된 재고 기록 및 사진이 모두 삭제됩니다. 정말 삭제하시겠습니까?`)) return false;
        setIsLoading(true);
        try {
            // --- Pre-transaction Read ---
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
                const metaRef = doc(db, "customer_meta", `${customer.id}_${INSTALL_SCHEDULE_CONSTANTS.META_PREFIX}`);
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
            console.error("Install Schedule Delete Failure:", error);
            toast({ title: "삭제 실패", status: "error", position: "top" });
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [activityId, customer.id, toast, cleanupOrphanedPhotos]);

    return {
        formData, setFormData,
        isLoading,
        handleFileUpload, removePhoto,
        addTask, updateTask, removeTask,
        submit,
        handleDelete
    };
};
