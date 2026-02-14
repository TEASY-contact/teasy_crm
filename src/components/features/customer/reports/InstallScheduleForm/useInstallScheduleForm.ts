// src/components/features/customer/reports/InstallScheduleForm/useInstallScheduleForm.ts
"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@chakra-ui/react";
import { db, storage } from "@/lib/firebase";
import { collection, serverTimestamp, doc, runTransaction, query, where, getDocs } from "firebase/firestore";
import { ref as sRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { cleanupOrphanedPhotos } from "@/utils/reportUtils";
import { useAuth } from "@/context/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { InstallScheduleFormData, INSTALL_SCHEDULE_CONSTANTS } from "./types";
import { Activity } from "@/types/domain";
import { getCircledNumber } from "@/components/features/asset/AssetModalUtils";
import { performSelfHealing } from "@/utils/assetUtils";
import { isWithinBusinessDays } from "@/utils/dateUtils";
import { useReportMetadata } from "@/hooks/useReportMetadata";
import { formatPhone } from "@/utils/formatter";
import { applyColonStandard, normalizeText } from "@/utils/textFormatter";

interface UseInstallScheduleFormProps {
    customer: { id: string, name: string, address?: string, phone?: string };
    activities?: any[];
    activityId?: string;
    initialData?: Partial<InstallScheduleFormData>;
    defaultManager?: string;
    rawAssets?: any[];
}

export const useInstallScheduleForm = ({ customer, activities = [], activityId, initialData, defaultManager, rawAssets = [] }: UseInstallScheduleFormProps) => {
    const { userData } = useAuth();
    const { holidayMap } = useReportMetadata();
    const queryClient = useQueryClient();
    const toast = useToast();
    const isSubmitting = useRef(false);
    const [isLoading, setIsLoading] = useState(false);

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

            const lastDemoSchedule = [...(activities || [])].reverse().find(a => a.type === "demo_schedule");

            setFormData(prev => ({
                ...prev,
                date: formattedDate,
                location: lastDemoSchedule?.location || customer?.address || "",
                phone: formatPhone(lastDemoSchedule?.phone || customer?.phone || ""),
                manager: lastDemoSchedule?.manager || prev.manager,
                selectedProducts: [],
                selectedSupplies: [],
                tasksBefore: [""],
                tasksAfter: [""],
                photos: lastDemoSchedule?.photos || []
            }));
        }
    }, [initialData, defaultManager, customer.address, customer.phone, activities]);

    const handleUpdateQty = useCallback((type: 'product' | 'supply', index: number, delta: number) => {
        setFormData(prev => {
            const field = type === 'product' ? 'selectedProducts' : 'selectedSupplies';
            const newList = [...prev[field]];
            if (newList[index]) {
                if (newList[index].isInherited) return prev;
                const newQty = Math.max(1, (newList[index].quantity || 1) + delta);
                newList[index] = { ...newList[index], quantity: newQty };
            }
            return { ...prev, [field]: newList };
        });
    }, []);

    const handleRemoveItem = useCallback((type: 'product' | 'supply', index: number) => {
        if (!window.confirm("항목을 삭제하시겠습니까?")) return;
        setFormData(prev => {
            const field = type === 'product' ? 'selectedProducts' : 'selectedSupplies';
            if (prev[field][index]?.isInherited) return prev;
            return {
                ...prev,
                [field]: prev[field].filter((_, i) => i !== index)
            };
        });
    }, []);

    const handleFileUpload = useCallback((files: FileList) => {
        if (!files) return;
        const remaining = INSTALL_SCHEDULE_CONSTANTS.MAX_PHOTOS - (formData.photos.length + pendingFiles.length);
        const toAdd = Array.from(files).slice(0, remaining);

        const newPending = toAdd.map(file => ({
            url: URL.createObjectURL(file),
            file
        }));
        setPendingFiles(prev => [...prev, ...newPending]);
    }, [formData.photos.length, pendingFiles.length]);

    const removePhoto = useCallback((index: number, isPending: boolean) => {
        setFormData(prev => {
            if (isPending) {
                setPendingFiles(p => {
                    const target = p[index];
                    if (target) URL.revokeObjectURL(target.url);
                    return p.filter((_, i) => i !== index);
                });
                return prev;
            }
            return {
                ...prev,
                photos: prev.photos.filter((_, i) => i !== index)
            };
        });
    }, []);



    const submit = useCallback(async (managerOptions: any[]) => {
        if (isLoading || isSubmitting.current) return false;

        // Surgical Guard: restrict edits after 3 business days (v126.9)
        if (activityId && initialData) {
            const currentActivity = activities.find(a => a.id === activityId);
            const createdAt = currentActivity?.createdAt?.toDate ? currentActivity.createdAt.toDate() : null;
            const isMaster = userData?.role === 'master';

            if (createdAt && !isMaster) {
                const isWithinEditTime = isWithinBusinessDays(createdAt, 3, holidayMap);
                if (!isWithinEditTime) {
                    toast({ title: "수정 불가", description: "작성 후 3영업일이 경과하여 마스터만 수정 가능합니다.", status: "error", position: "top" });
                    return false;
                }
            }
        }

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

            // --- Pre-transaction Read ---
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

                // --- 1. ALL READS & PREPARATION ---
                const metaRef = doc(db, "customer_meta", `${customer.id}_${INSTALL_SCHEDULE_CONSTANTS.META_PREFIX}`);
                const metaSnap = await transaction.get(metaRef);
                const activitySnap = activityId ? await transaction.get(activityRef) : null;
                const customerRef = doc(db, "customers", customer.id);

                // Meta Tracker Setup
                const metaTracker = new Map<string, { ref: any, data: any, deltaStock: number, deltaOutflow: number }>();

                const encryptMetaId = (name: string, category: string) => {
                    return `meta_${name.trim()}_${category.trim()}`.replace(/\//g, "_");
                };

                const loadMeta = async (metaId: string) => {
                    if (!metaTracker.has(metaId)) {
                        const ref = doc(db, "asset_meta", metaId);
                        const snap = await transaction.get(ref);
                        let data = { totalInflow: 0, totalOutflow: 0, currentStock: 0 };
                        if (snap.exists()) data = snap.data() as any;
                        metaTracker.set(metaId, { ref, data, deltaStock: 0, deltaOutflow: 0 });
                    }
                };

                // Load Metas for Rollback (Existing Assets)
                if (activityId && existingAssets.length > 0) {
                    for (const asset of existingAssets) {
                        if (asset.data.type === 'inventory') {
                            const metaId = encryptMetaId(asset.data.name, asset.data.category);
                            await loadMeta(metaId);
                        }
                    }
                }

                // Aggregate New Deductions
                const aggregatedSuppliesMap = new Map<string, { name: string, category: string, quantity: number }>();
                formData.selectedSupplies.forEach(s => {
                    const key = `${s.name.trim()}|${(s.category || "").trim()}`;
                    if (s.category) {
                        const qty = Number(s.quantity) || 1;
                        if (aggregatedSuppliesMap.has(key)) {
                            aggregatedSuppliesMap.get(key)!.quantity += qty;
                        } else {
                            aggregatedSuppliesMap.set(key, { ...s, name: s.name.trim(), category: (s.category || "").trim(), quantity: qty });
                        }
                    }
                });

                // Load Metas for New Deductions
                for (const supply of Array.from(aggregatedSuppliesMap.values())) {
                    const metaId = encryptMetaId(supply.name, supply.category);
                    await loadMeta(metaId);
                }

                let currentMeta = metaSnap.exists() ? metaSnap.data() : { lastSequence: 0, totalCount: 0 };
                let modificationHistory = [];

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
                    location: normalizeText(formData.location),
                    phone: cleanPhone,
                    product: validProducts.map((p, idx) => {
                        const prefix = validProducts.length > 1 ? getCircledNumber(idx + 1) : "";
                        return `${prefix}${p.name} × ${p.quantity}`;
                    }).join(", "),
                    selectedProducts: validProducts,
                    selectedSupplies: validSupplies,
                    tasksBefore: formData.tasksBefore.filter(t => t && t.trim() !== "").map(t => normalizeText(t.trim())),
                    tasksAfter: formData.tasksAfter.filter(t => t && t.trim() !== "").map(t => normalizeText(t.trim())),
                    photos: finalPhotos,
                    memo: applyColonStandard(formData.memo || ""),
                    updatedAt: serverTimestamp()
                };

                // History (ModificationHistory)
                if (activityId && activitySnap?.exists()) {
                    const oldData = activitySnap.data() as Activity;
                    const changes: string[] = [];

                    // 1. Memo tracking
                    const oldMemo = oldData.memo || "";
                    const newMemo = applyColonStandard(formData.memo || "");
                    if (oldMemo !== newMemo) changes.push(`참고: ${oldMemo || "없음"} → ${newMemo || "없음"}`);

                    // 2. Info tracking
                    if (oldData.date !== formData.date) changes.push(`일시: ${oldData.date} → ${formData.date}`);
                    if (oldData.manager !== formData.manager) {
                        const oldManagerName = oldData.managerName || oldData.manager;
                        const newManagerName = selectedManager?.label || formData.manager;
                        changes.push(`담당: ${oldManagerName} → ${newManagerName}`);
                    }

                    // 3. Address & Contact tracking
                    const oldLoc = oldData.location || "";
                    const newLoc = normalizeText(formData.location);
                    if (oldLoc !== newLoc) changes.push(`장소: ${oldLoc || "없음"} → ${newLoc || "없음"}`);

                    const oldPhone = oldData.phone || "";
                    const newPhone = cleanPhone;
                    if (oldPhone !== newPhone) changes.push(`전화: ${formatPhone(oldPhone) || "없음"} → ${formatPhone(newPhone) || "없음"}`);

                    // 4. Products & Supplies tracking
                    const oldP = (oldData.selectedProducts || []).map((p: any) => `${p.name}x${p.quantity}`).sort().join(", ");
                    const newP = (validProducts).map(p => `${p.name}x${p.quantity}`).sort().join(", ");
                    if (oldP !== newP) changes.push(`상품: ${oldP || "없음"} → ${newP || "없음"}`);

                    const oldS = (oldData.selectedSupplies || []).map((s: any) => `${s.name}x${s.quantity}`).sort().join(", ");
                    const newS = (validSupplies).map(s => `${s.name}x${s.quantity}`).sort().join(", ");
                    if (oldS !== newS) changes.push(`준비: ${oldS || "없음"} → ${newS || "없음"}`);

                    // 5. Assets tracking
                    const oldPhotos = (oldData.photos || []).length;
                    const newPhotos = (finalPhotos || []).length;
                    if (oldPhotos !== newPhotos) changes.push(`사진: ${oldPhotos}개 → ${newPhotos}개`);

                    if (changes.length > 0) {
                        const now = new Date();
                        const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}  ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                        dataToSave.modificationHistory = [...(oldData.modificationHistory || []), {
                            time: timeStr,
                            manager: userData?.uid || "unknown",
                            managerName: userData?.name || "알 수 없음",
                            content: changes.join(" / ")
                        }];
                    } else {
                        dataToSave.modificationHistory = oldData.modificationHistory || [];
                    }
                }

                // --- 2. ALL WRITES START ---
                transaction.update(customerRef, {
                    lastConsultDate: formData.date,
                    updatedAt: serverTimestamp()
                });

                // A. Rollback Existing Assets
                if (activityId) {
                    existingAssets.forEach(asset => {
                        affectedItems.add(`${asset.data.name}|${asset.data.category}`);
                        if (asset.data.type === 'inventory') {
                            const metaId = encryptMetaId(asset.data.name, asset.data.category);
                            const tracker = metaTracker.get(metaId);
                            if (tracker) {
                                const qty = Number(asset.data.lastOutflow) || 0;
                                tracker.deltaStock += qty;
                                tracker.deltaOutflow -= qty;
                            }
                        }
                        transaction.delete(asset.ref);
                    });
                    transaction.update(activityRef, dataToSave as any);
                } else {
                    const nextSeq = activities.filter(a => a.type === INSTALL_SCHEDULE_CONSTANTS.TYPE).length + 1;
                    transaction.set(activityRef, {
                        ...dataToSave,
                        sequenceNumber: nextSeq,
                        createdAt: serverTimestamp(),
                        createdBy: userData?.uid || "system",
                        createdByName: userData?.name || "알 수 없음"
                    });

                    transaction.set(metaRef, {
                        lastSequence: nextSeq,
                        totalCount: (Number(currentMeta.totalCount) || 0) + 1,
                        lastUpdatedAt: serverTimestamp()
                    }, { merge: true });
                }

                const nowSec = new Date();
                const actionDate = `${nowSec.getFullYear()}-${String(nowSec.getMonth() + 1).padStart(2, '0')}-${String(nowSec.getDate()).padStart(2, '0')}`;

                // B. Apply New Deductions
                for (const supply of Array.from(aggregatedSuppliesMap.values())) {
                    const name = supply.name.trim();
                    const category = (supply.category || "").trim();
                    const quantity = Number(supply.quantity) || 1;
                    affectedItems.add(`${name}|${category}`);

                    const metaId = encryptMetaId(name, category);
                    const tracker = metaTracker.get(metaId);

                    if (tracker) {
                        tracker.deltaStock -= quantity;
                        tracker.deltaOutflow += quantity;
                    }

                    const newAssetRef = doc(collection(db, "assets"));
                    transaction.set(newAssetRef, {
                        category,
                        name,
                        stock: (Number(tracker?.data.currentStock || 0) + (tracker?.deltaStock || 0)),
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

                // C. Commit Meta Changes
                for (const [metaId, tracker] of metaTracker) {
                    if (tracker.deltaStock !== 0 || tracker.deltaOutflow !== 0) {
                        const newStock = (Number(tracker.data.currentStock) || 0) + tracker.deltaStock;
                        const newOutflow = (Number(tracker.data.totalOutflow) || 0) + tracker.deltaOutflow;
                        transaction.set(tracker.ref, {
                            ...tracker.data,
                            currentStock: newStock,
                            totalOutflow: newOutflow,
                            lastUpdatedAt: serverTimestamp(),
                            lastAction: "install_schedule_sync"
                        }, { merge: true });
                    }
                }

                return { success: true, affectedItems: Array.from(affectedItems) };
            });

            if (saveResult.success) {
                if (activityId && initialData?.photos) {
                    const removedPhotos = initialData.photos.filter((oldUrl: string) => !finalPhotos.includes(oldUrl));
                    await cleanupOrphanedPhotos(removedPhotos);
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
                toast({ title: "시공 확정 완료", status: "success", duration: 2000, position: "top" });
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
    }, [isLoading, formData, activities, pendingFiles, activityId, initialData, customer.id, customer.name, userData?.name, userData?.uid, toast, queryClient, holidayMap]);

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
        if (!window.confirm("항목을 삭제하시겠습니까?")) return;
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

        if (initialData) {
            const currentActivity = activities.find(a => a.id === activityId);
            const createdAt = currentActivity?.createdAt?.toDate ? currentActivity.createdAt.toDate() : null;
            const isMaster = userData?.role === 'master';

            if (createdAt && !isMaster) {
                const isWithinEditTime = isWithinBusinessDays(createdAt, 3, holidayMap);
                if (!isWithinEditTime) {
                    toast({ title: "삭제 불가", description: "작성 후 3영업일이 경과하여 마스터만 삭제 가능합니다.", status: "error", position: "top" });
                    return false;
                }
            }
        }

        if (!window.confirm("해당 데이터 삭제를 희망하십니까?")) return false;
        setIsLoading(true);
        try {
            const assetQuery = query(collection(db, "assets"), where("sourceActivityId", "==", activityId));
            const assetSnap = await getDocs(assetQuery);
            const assetsToRestores = assetSnap.docs.map(d => ({ ref: d.ref, data: d.data() }));

            const result = await runTransaction(db, async (transaction) => {
                const affectedItems = new Set<string>();
                const trackers = new Map<string, { ref: any, data: any }>();

                // 1. ALL READS FIRST
                for (const asset of assetsToRestores) {
                    const metaId = `meta_${asset.data.name}_${asset.data.category}`.replace(/\//g, "_");
                    if (!trackers.has(metaId)) {
                        const metaRef = doc(db, "asset_meta", metaId);
                        const metaSnap = await transaction.get(metaRef);
                        if (metaSnap.exists()) {
                            trackers.set(metaId, { ref: metaRef, data: metaSnap.data() });
                        }
                    }
                }

                // 2. ALL WRITES AFTER
                for (const asset of assetsToRestores) {
                    const metaId = `meta_${asset.data.name}_${asset.data.category}`.replace(/\//g, "_");
                    const tracker = trackers.get(metaId);

                    if (tracker) {
                        const currentData = tracker.data;
                        const outflow = Number(asset.data.lastOutflow) || 0;

                        // Local update for subsequent assets of same type in this loop
                        const updatedData = {
                            ...currentData,
                            currentStock: (Number(currentData.currentStock) || 0) + outflow,
                            totalOutflow: (Number(currentData.totalOutflow) || 0) - outflow,
                            lastUpdatedAt: serverTimestamp(),
                            lastAction: "install_schedule_delete_recovery"
                        };

                        transaction.update(tracker.ref, updatedData);
                        tracker.data = updatedData;
                    }
                    affectedItems.add(`${asset.data.name}|${asset.data.category}`);
                    transaction.delete(asset.ref);
                }

                transaction.delete(doc(db, "activities", activityId));
                return { success: true, affectedItems: Array.from(affectedItems) };
            });

            if (result.success) {
                if (initialData?.photos) await cleanupOrphanedPhotos(initialData.photos);
                Promise.all(result.affectedItems.map(itemKey => {
                    const [name, category] = itemKey.split("|");
                    return performSelfHealing(name, category);
                })).catch(e => console.error("Self-healing error:", e));

                await queryClient.invalidateQueries({ queryKey: ["activities", customer.id] });
                await queryClient.invalidateQueries({ queryKey: ["assets", "management"] });
                toast({ title: "삭제 완료", status: "info", duration: 2000, position: "top" });
                return true;
            }
            return false;
        } catch (error: any) {
            console.error("Delete Failure:", error);
            toast({ title: "삭제 실패", description: error.message, status: "error", position: "top" });
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [activityId, initialData, activities, userData?.role, holidayMap, toast, customer.id, queryClient]);

    return {
        formData,
        isLoading,
        pendingFiles,
        setFormData,
        handleUpdateQty,
        handleRemoveItem,
        handleFileUpload,
        removePhoto,
        submit,
        handleDelete,
        addTask,
        updateTask,
        removeTask
    };
};

useInstallScheduleForm.displayName = "useInstallScheduleForm";
