// src/components/features/customer/reports/AsScheduleForm/useAsScheduleForm.ts
"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@chakra-ui/react";
import { db, storage } from "@/lib/firebase";
import { collection, serverTimestamp, doc, runTransaction, query, where, getDocs } from "firebase/firestore";
import { ref as sRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { cleanupOrphanedPhotos } from "@/utils/reportUtils";
import { useAuth } from "@/context/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { AsScheduleFormData, AS_SCHEDULE_CONSTANTS } from "./types";
import { Activity } from "@/types/domain";
import { performSelfHealing } from "@/utils/assetUtils";
import { isWithinBusinessDays } from "@/utils/dateUtils";
import { useReportMetadata } from "@/hooks/useReportMetadata";
import { formatPhone } from "@/utils/formatter";
import { applyColonStandard, normalizeText } from "@/utils/textFormatter";

interface UseAsScheduleFormProps {
    customer: { id: string, name: string, address?: string, phone?: string };
    activities?: any[];
    activityId?: string;
    initialData?: Partial<AsScheduleFormData>;
    defaultManager?: string;
}

export const useAsScheduleForm = ({ customer, activities = [], activityId, initialData, defaultManager }: UseAsScheduleFormProps) => {
    const { userData } = useAuth();
    const { holidayMap } = useReportMetadata();
    const queryClient = useQueryClient();
    const toast = useToast();
    const isSubmitting = useRef(false);
    const [isLoading, setIsLoading] = useState(false);

    const [pendingFiles, setPendingFiles] = useState<{ url: string, file: File }[]>([]);

    const [formData, setFormData] = useState<AsScheduleFormData>({
        date: "",
        manager: defaultManager || "",
        asType: "",
        location: customer?.address || "",
        phone: formatPhone(customer?.phone || ""),
        selectedProducts: [],
        selectedSupplies: [],
        symptoms: [""],
        tasks: [""],
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
                symptoms: initialData.symptoms || [""],
                tasks: initialData.tasks || [""],
                photos: initialData.photos || []
            }));
        } else {
            const now = new Date();
            const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}  ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

            setFormData(prev => ({
                ...prev,
                date: formattedDate,
                location: customer?.address || "",
                phone: formatPhone(customer?.phone || "")
            }));
        }
    }, [initialData, defaultManager, customer.address, customer.phone]);

    const handleUpdateQty = useCallback((type: 'product' | 'supply', index: number, delta: number) => {
        setFormData(prev => {
            const field = type === 'product' ? 'selectedProducts' : 'selectedSupplies';
            const newList = [...prev[field]];
            if (newList[index]) {
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
            return {
                ...prev,
                [field]: prev[field].filter((_, i) => i !== index)
            };
        });
    }, []);

    const addRow = useCallback((type: 'symptom' | 'task') => {
        setFormData(prev => {
            const field = type === 'symptom' ? 'symptoms' : 'tasks';
            return { ...prev, [field]: [...prev[field], ""] };
        });
    }, []);

    const updateRow = useCallback((type: 'symptom' | 'task', index: number, value: string) => {
        setFormData(prev => {
            const field = type === 'symptom' ? 'symptoms' : 'tasks';
            const newList = [...prev[field]];
            newList[index] = value;
            return { ...prev, [field]: newList };
        });
    }, []);

    const removeRow = useCallback((type: 'symptom' | 'task', index: number) => {
        setFormData(prev => {
            const field = type === 'symptom' ? 'symptoms' : 'tasks';
            if (prev[field].length <= 1) return { ...prev, [field]: [""] };
            return { ...prev, [field]: prev[field].filter((_, i) => i !== index) };
        });
    }, []);

    const handleFileUpload = useCallback((files: FileList) => {
        if (!files) return;
        const remaining = AS_SCHEDULE_CONSTANTS.MAX_PHOTOS - (formData.photos.length + pendingFiles.length);
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

        if (activityId && initialData) {
            const currentActivity = activities.find(a => a.id === activityId);
            const createdAt = currentActivity?.createdAt?.toDate ? currentActivity.createdAt.toDate() : null;
            if (createdAt && userData?.role !== 'master' && !isWithinBusinessDays(createdAt, 3, holidayMap)) {
                toast({ title: "수정 불가", description: "3영업일 경과하여 마스터만 가능합니다.", status: "error", position: "top" });
                return false;
            }
        }

        const validations = [
            { cond: !formData.date, msg: "A/S 일시를 입력해주세요." },
            { cond: !formData.manager, msg: "담당자를 선택해주세요." },
            { cond: !formData.asType, msg: "A/S 유형을 선택해주세요." },
            { cond: !formData.location, msg: "장소를 입력해주세요." },
            { cond: formData.selectedProducts.length === 0, msg: "점검 상품을 선택해주세요." }
        ];

        const error = validations.find(v => v.cond);
        if (error) {
            toast({ title: error.msg, status: "warning", position: "top" });
            return false;
        }

        setIsLoading(true);
        isSubmitting.current = true;
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
            const cleanPhone = formData.phone.replace(/[^0-9]/g, "");
            const affectedItems = new Set<string>();

            // Upload Photos
            let finalPhotos = [...formData.photos];
            if (pendingFiles.length > 0) {
                const uniquePending = Array.from(new Map(pendingFiles.map(p => [p.file.name + p.file.size, p])).values());
                const uploadedUrls = await Promise.all(uniquePending.map(async (p, i) => {
                    const ext = p.file.name.split('.').pop() || 'jpg';
                    const filename = `as_schedule_${Date.now()}_${i}_${Math.random().toString(36).substring(7)}.${ext}`;
                    const storageRef = sRef(storage, `${AS_SCHEDULE_CONSTANTS.STORAGE_PATH_PREFIX}/${customer.id}/${filename}`);
                    await uploadBytes(storageRef, p.file);
                    return await getDownloadURL(storageRef);
                }));
                finalPhotos = finalPhotos.filter(url => !url.startsWith('blob:')).concat(uploadedUrls);
            }

            // --- Pre-transaction Read ---
            let existingAssets: any[] = [];
            if (activityId) {
                const assetSnap = await getDocs(query(collection(db, "assets"), where("sourceActivityId", "==", activityId)));
                existingAssets = assetSnap.docs.map(d => ({ ref: d.ref, data: d.data() }));
            }

            // Core Sync: Find linked as_complete reports
            let linkedCompleteDocs: any[] = [];
            if (activityId && initialData?.sequenceNumber) {
                const completeSnap = await getDocs(query(
                    collection(db, "activities"),
                    where("customerId", "==", customer.id),
                    where("type", "==", "as_complete"),
                    where("sequenceNumber", "==", initialData.sequenceNumber)
                ));
                linkedCompleteDocs = completeSnap.docs.map(d => ({ ref: d.ref, data: d.data() }));
            }

            const saveResult = await runTransaction(db, async (transaction) => {
                const selectedManager = managerOptions.find(o => o.value === formData.manager);
                const targetActivityId = activityId || doc(collection(db, "activities")).id;
                const activityRef = doc(db, "activities", targetActivityId);

                // --- 1. ALL READS & PREPARATION ---
                const metaRef = doc(db, "customer_meta", `${customer.id}_${AS_SCHEDULE_CONSTANTS.META_PREFIX}`);
                const metaSnap = await transaction.get(metaRef);
                const customerRef = doc(db, "customers", customer.id);
                const activitySnap = activityId ? await transaction.get(activityRef) : null;

                const metaTracker = new Map<string, { ref: any, data: any, deltaStock: number, deltaOutflow: number }>();
                const encryptMetaId = (name: string, category: string) => `meta_${name.trim()}_${category.trim()}`.replace(/\//g, "_");
                const loadMeta = async (metaId: string) => {
                    if (!metaTracker.has(metaId)) {
                        const ref = doc(db, "asset_meta", metaId);
                        const snap = await transaction.get(ref);
                        const data = snap.exists() ? snap.data() : { totalInflow: 0, totalOutflow: 0, currentStock: 0 };
                        metaTracker.set(metaId, { ref, data: data as any, deltaStock: 0, deltaOutflow: 0 });
                    }
                };

                // Load Metas
                if (activityId) {
                    for (const asset of existingAssets) {
                        if (asset.data.type === 'inventory') await loadMeta(encryptMetaId(asset.data.name, asset.data.category));
                    }
                }
                for (const supply of formData.selectedSupplies) {
                    if (supply.category) await loadMeta(encryptMetaId(supply.name, supply.category));
                }

                let currentMeta = metaSnap.exists() ? metaSnap.data() : { lastSequence: 0, totalCount: 0 };
                const dataToSave: Partial<Activity> = {
                    customerId: customer.id,
                    customerName: customer.name,
                    type: AS_SCHEDULE_CONSTANTS.TYPE,
                    typeName: AS_SCHEDULE_CONSTANTS.TYPE_NAME,
                    date: formData.date,
                    manager: formData.manager,
                    managerName: selectedManager?.label || formData.manager,
                    managerRole: selectedManager?.role || "employee",
                    asType: formData.asType,
                    location: normalizeText(formData.location),
                    phone: cleanPhone,
                    selectedProducts: formData.selectedProducts,
                    selectedSupplies: formData.selectedSupplies,
                    symptoms: formData.symptoms.filter(s => s && s.trim() !== "").map(s => normalizeText(s)),
                    tasks: formData.tasks.filter(t => t && t.trim() !== "").map(t => normalizeText(t)),
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
                    if (oldData.asType !== formData.asType) changes.push(`유형: ${oldData.asType || "없음"} → ${formData.asType || "없음"}`);

                    // 3. Address & Contact tracking
                    const oldLoc = oldData.location || "";
                    const newLoc = normalizeText(formData.location);
                    if (oldLoc !== newLoc) changes.push(`장소: ${oldLoc || "없음"} → ${newLoc || "없음"}`);

                    const oldPhone = oldData.phone || "";
                    const newPhone = cleanPhone;
                    if (oldPhone !== newPhone) changes.push(`전화: ${formatPhone(oldPhone) || "없음"} → ${formatPhone(newPhone) || "없음"}`);

                    // 4. Products & Supplies tracking
                    const oldP = (oldData.selectedProducts || []).map((p: any) => `${p.name}x${p.quantity}`).sort().join(", ");
                    const newP = (formData.selectedProducts || []).map(p => `${p.name}x${p.quantity}`).sort().join(", ");
                    if (oldP !== newP) changes.push(`점검: ${oldP || "없음"} → ${newP || "없음"}`);

                    const oldS = (oldData.selectedSupplies || []).map((s: any) => `${s.name}x${s.quantity}`).sort().join(", ");
                    const newS = (formData.selectedSupplies || []).map((s: any) => `${s.name}x${s.quantity}`).sort().join(", ");
                    if (oldS !== newS) changes.push(`준비: ${oldS || "없음"} → ${newS || "없음"}`);

                    // 5. Checklist tracking
                    const oldSymptoms = (oldData.symptoms || []).join(", ");
                    const newSymptoms = dataToSave.symptoms?.join(", ") || "";
                    if (oldSymptoms !== newSymptoms) changes.push(`증상: ${oldSymptoms || "없음"} → ${newSymptoms || "없음"}`);

                    const oldTasks = (oldData.tasks || []).join(", ");
                    const newTasks = dataToSave.tasks?.join(", ") || "";
                    if (oldTasks !== newTasks) changes.push(`결과: ${oldTasks || "없음"} → ${newTasks || "없음"}`);

                    // 6. Assets tracking
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
                transaction.update(customerRef, { lastConsultDate: formData.date, updatedAt: serverTimestamp() });

                if (activityId) {
                    existingAssets.forEach(asset => {
                        affectedItems.add(`${asset.data.name}|${asset.data.category}`);
                        if (asset.data.type === 'inventory') {
                            const tracker = metaTracker.get(encryptMetaId(asset.data.name, asset.data.category));
                            if (tracker) {
                                const qty = Number(asset.data.lastOutflow) || 0;
                                tracker.deltaStock += qty;
                                tracker.deltaOutflow -= qty;
                            }
                        }
                        transaction.delete(asset.ref);
                    });
                    transaction.update(activityRef, dataToSave as any);

                    // Core Sync to linked as_complete
                    linkedCompleteDocs.forEach(d => {
                        const updateData: any = { asType: formData.asType };
                        if (formData.asType !== "이전 시공") updateData.commitmentFiles = [];
                        if (formData.asType !== "방문 수거") updateData.collectionVideo = null;
                        if (formData.asType !== "방문 재설치") updateData.reinstallationVideo = null;
                        transaction.update(d.ref, updateData);
                    });
                } else {
                    const nextSeq = activities.filter(a => a.type === AS_SCHEDULE_CONSTANTS.TYPE).length + 1;
                    transaction.set(activityRef, {
                        ...dataToSave,
                        sequenceNumber: nextSeq,
                        createdAt: serverTimestamp(),
                        createdBy: userData?.uid || "system",
                        createdByName: userData?.name || "알 수 없음"
                    });
                    transaction.set(metaRef, { lastSequence: nextSeq, totalCount: (Number(currentMeta.totalCount) || 0) + 1, lastUpdatedAt: serverTimestamp() }, { merge: true });
                }

                const nowSec = new Date();
                const actionDate = `${nowSec.getFullYear()}-${String(nowSec.getMonth() + 1).padStart(2, '0')}-${String(nowSec.getDate()).padStart(2, '0')}`;

                // Apply Deductions
                formData.selectedSupplies.forEach(s => {
                    const name = s.name.trim();
                    const category = (s.category || "").trim();
                    if (!category) return;
                    const quantity = Number(s.quantity) || 1;
                    affectedItems.add(`${name}|${category}`);
                    const tracker = metaTracker.get(encryptMetaId(name, category));
                    if (tracker) {
                        tracker.deltaStock -= quantity;
                        tracker.deltaOutflow += quantity;
                    }
                    transaction.set(doc(collection(db, "assets")), {
                        category, name, type: "inventory",
                        stock: (Number(tracker?.data.currentStock || 0) + (tracker?.deltaStock || 0)),
                        lastActionDate: actionDate,
                        lastOperator: selectedManager?.label || userData?.name || "System",
                        lastOutflow: quantity,
                        lastRecipient: customer.name || "-",
                        lastRecipientId: customer.id,
                        createdAt: serverTimestamp(),
                        editLog: `A/S 확정 물품 차감 (${customer.name}) [Lock-Verified]`,
                        sourceActivityId: targetActivityId
                    });
                });

                // Commit Metas
                for (const [metaId, tracker] of metaTracker) {
                    if (tracker.deltaStock !== 0 || tracker.deltaOutflow !== 0) {
                        transaction.set(tracker.ref, {
                            ...tracker.data,
                            currentStock: (Number(tracker.data.currentStock) || 0) + tracker.deltaStock,
                            totalOutflow: (Number(tracker.data.totalOutflow) || 0) + tracker.deltaOutflow,
                            lastUpdatedAt: serverTimestamp(),
                            lastAction: "as_schedule_sync"
                        }, { merge: true });
                    }
                }
                return { success: true, affectedItems: Array.from(affectedItems) };
            });

            if (saveResult.success) {
                if (activityId && initialData?.photos) {
                    const removed = initialData.photos.filter((old: string) => !finalPhotos.includes(old));
                    await cleanupOrphanedPhotos(removed);
                }
                Promise.all(saveResult.affectedItems.map(itemKey => {
                    const [n, c] = itemKey.split("|");
                    return performSelfHealing(n, c);
                })).catch(e => console.error(e));
                setPendingFiles([]);
                await new Promise(r => setTimeout(r, 500));
                await queryClient.invalidateQueries({ queryKey: ["activities", customer.id] });
                await queryClient.invalidateQueries({ queryKey: ["customer", customer.id] });
                await queryClient.invalidateQueries({ queryKey: ["customers"] });
                await queryClient.invalidateQueries({ queryKey: ["assets", "management"] });
                toast({ title: "A/S 예약 완료", status: "success", position: "top" });
                return true;
            }
            return false;
        } catch (error: any) {
            console.error(error);
            toast({ title: "저장 실패", description: error.message, status: "error", position: "top" });
            return false;
        } finally {
            setIsLoading(false);
            isSubmitting.current = false;
        }
    }, [isLoading, formData, activities, pendingFiles, activityId, initialData, customer.id, customer.name, userData, toast, queryClient, holidayMap]);

    const handleDelete = useCallback(async () => {
        if (!activityId) return false;
        if (initialData) {
            const currentActivity = activities.find(a => a.id === activityId);
            const createdAt = currentActivity?.createdAt?.toDate ? currentActivity.createdAt.toDate() : null;
            if (createdAt && userData?.role !== 'master' && !isWithinBusinessDays(createdAt, 3, holidayMap)) {
                toast({ title: "삭제 불가", description: "3영업일 경과하여 마스터만 가능합니다.", status: "error", position: "top" });
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
                const trackers = new Map<string, { ref: any, data: any }>();

                // 1. ALL READS FIRST
                for (const asset of assets) {
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
                for (const asset of assets) {
                    const metaId = `meta_${asset.data.name}_${asset.data.category}`.replace(/\//g, "_");
                    const tracker = trackers.get(metaId);

                    if (tracker) {
                        const currentData = tracker.data;
                        const outflow = Number(asset.data.lastOutflow) || 0;

                        const updatedData = {
                            ...currentData,
                            currentStock: (Number(currentData.currentStock) || 0) + outflow,
                            totalOutflow: (Number(currentData.totalOutflow) || 0) - outflow,
                            lastUpdatedAt: serverTimestamp()
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
                    const [n, c] = itemKey.split("|");
                    return performSelfHealing(n, c);
                })).catch(e => console.error(e));
                await queryClient.invalidateQueries({ queryKey: ["activities", customer.id] });
                await queryClient.invalidateQueries({ queryKey: ["assets", "management"] });
                toast({ title: "삭제 완료", status: "info", position: "top" });
                return true;
            }
            return false;
        } catch (e: any) {
            console.error(e);
            toast({ title: "삭제 실패", description: e.message, status: "error", position: "top" });
            return false;
        } finally { setIsLoading(false); }
    }, [activityId, initialData, activities, userData?.role, holidayMap, toast, customer.id, queryClient]);

    return {
        formData, isLoading, pendingFiles, setFormData, handleUpdateQty, handleRemoveItem,
        addRow, updateRow, removeRow, handleFileUpload, removePhoto, submit, handleDelete
    };
};

useAsScheduleForm.displayName = "useAsScheduleForm";
