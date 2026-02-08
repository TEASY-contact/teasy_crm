// src/components/features/customer/reports/AsCompleteForm/useAsCompleteForm.ts
"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@chakra-ui/react";
import { db, storage } from "@/lib/firebase";
import { collection, serverTimestamp, doc, runTransaction, query, where, getDocs } from "firebase/firestore";
import { ref as sRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { cleanupOrphanedPhotos } from "@/utils/reportUtils";
import { useAuth } from "@/context/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { AsCompleteFormData, AS_COMPLETE_CONSTANTS } from "./types";
import { Activity } from "@/types/domain";
import { getCircledNumber } from "@/components/features/asset/AssetModalUtils";
import { performSelfHealing } from "@/utils/assetUtils";
import { isWithinBusinessDays } from "@/utils/dateUtils";
import { useReportMetadata } from "@/hooks/useReportMetadata";
import { formatPhone } from "@/utils/formatter";
import { applyColonStandard, normalizeText } from "@/utils/textFormatter";

interface UseAsCompleteFormProps {
    customer: { id: string, name: string, address?: string, phone?: string };
    activities?: any[];
    activityId?: string;
    initialData?: Partial<AsCompleteFormData>;
    defaultManager?: string;
}

export const useAsCompleteForm = ({ customer, activities = [], activityId, initialData, defaultManager }: UseAsCompleteFormProps) => {
    const { userData } = useAuth();
    const { holidayMap } = useReportMetadata();
    const queryClient = useQueryClient();
    const toast = useToast();
    const isSubmitting = useRef(false);
    const [isLoading, setIsLoading] = useState(false);

    const [pendingFiles, setPendingFiles] = useState<{ url: string, file: File }[]>([]);

    const [formData, setFormData] = useState<AsCompleteFormData>({
        date: "",
        manager: defaultManager || "",
        asType: "",
        location: customer?.address || "",
        phone: formatPhone(customer?.phone || ""),
        selectedProducts: [],
        selectedSupplies: [],
        symptoms: [],
        tasks: [],
        symptomIncompleteReason: "",
        taskIncompleteReason: "",
        photos: [],
        commitmentFiles: [],
        collectionVideo: null,
        reinstallationVideo: null,
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
                symptoms: initialData.symptoms || [],
                tasks: initialData.tasks || [],
                photos: initialData.photos || [],
                commitmentFiles: initialData.commitmentFiles || [],
                collectionVideo: initialData.collectionVideo || null,
                reinstallationVideo: initialData.reinstallationVideo || null
            }));
        } else {
            const lastSchedule = [...(activities || [])].reverse().find(a => a.type === "as_schedule");
            const now = new Date();
            const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}  ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

            setFormData(prev => ({
                ...prev,
                date: formattedDate,
                location: lastSchedule?.location || customer?.address || "",
                phone: formatPhone(lastSchedule?.phone || customer?.phone || ""),
                manager: lastSchedule?.manager || prev.manager,
                asType: lastSchedule?.asType || "",
                selectedProducts: lastSchedule?.selectedProducts || [],
                selectedSupplies: lastSchedule?.selectedSupplies || [],
                symptoms: (lastSchedule?.symptoms || []).map((s: string) => ({ text: s, completed: false })),
                tasks: (lastSchedule?.tasks || []).map((t: string) => ({ text: t, completed: false })),
                photos: lastSchedule?.photos || []
            }));
        }
    }, [initialData, defaultManager, customer.address, customer.phone, activities]);

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

    const toggleTask = useCallback((type: 'symptom' | 'task', index: number) => {
        setFormData(prev => {
            const field = type === 'symptom' ? 'symptoms' : 'tasks';
            const newList = [...prev[field]];
            if (newList[index]) {
                newList[index] = { ...newList[index], completed: !newList[index].completed };
            }
            return { ...prev, [field]: newList };
        });
    }, []);

    const handleFileUpload = useCallback((files: FileList) => {
        if (!files) return;
        const remaining = AS_COMPLETE_CONSTANTS.MAX_PHOTOS - (formData.photos.length + pendingFiles.length);
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
            { cond: !formData.date, msg: "A/S 완료 일시를 입력해주세요." },
            { cond: !formData.manager, msg: "담당자를 선택해주세요." },
            { cond: !formData.location, msg: "방문 주소를 입력해주세요." },
            { cond: !formData.phone, msg: "연락처를 입력해주세요." },
            { cond: formData.selectedProducts.length === 0, msg: "점검 상품을 선택해주세요." },
            { cond: formData.asType === "이전 시공" && formData.commitmentFiles.length < 2, msg: "확약서는 최소 2장 필수입니다." },
            { cond: formData.asType === "방문 수거" && !formData.collectionVideo, msg: "수거 전 동영상이 필요합니다." },
            { cond: formData.asType === "방문 재설치" && !formData.reinstallationVideo, msg: "설치 후 동영상이 필요합니다." }
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
                    const filename = `as_complete_${Date.now()}_${i}_${Math.random().toString(36).substring(7)}.${ext}`;
                    const storageRef = sRef(storage, `${AS_COMPLETE_CONSTANTS.STORAGE_PATH_PREFIX}/${customer.id}/${filename}`);
                    await uploadBytes(storageRef, p.file);
                    return await getDownloadURL(storageRef);
                }));
                finalPhotos = finalPhotos.filter(url => !url.startsWith('blob:')).concat(uploadedUrls);
            }

            // Upload Attachments
            const uploadQueue = async (fileList: any[], folder: string) => {
                return Promise.all(fileList.map(async (f) => {
                    if (!f.url.startsWith('blob:')) return { id: f.id, url: f.url, name: f.name, displayName: f.displayName, ext: f.ext };
                    const file = f._file;
                    if (!file) throw new Error(`파일 유실: ${f.displayName}`);
                    const filename = `${folder}_${Date.now()}_${Math.random().toString(36).substring(7)}.${f.ext.toLowerCase()}`;
                    const storageRef = sRef(storage, `${AS_COMPLETE_CONSTANTS.STORAGE_PATH_PREFIX}/${customer.id}/${filename}`);
                    await uploadBytes(storageRef, file);
                    const url = await getDownloadURL(storageRef);
                    const { _file, ...fileData } = f;
                    return { ...fileData, url };
                }));
            };

            const finalCommitment = await uploadQueue(formData.commitmentFiles, 'commitment');
            const finalCollectionVideo = formData.collectionVideo ? (await uploadQueue([formData.collectionVideo], 'collection_video'))[0] : null;
            const finalReinstallVideo = formData.reinstallationVideo ? (await uploadQueue([formData.reinstallationVideo], 'reinstall_video'))[0] : null;

            // --- Pre-transaction Read ---
            let existingAssets: any[] = [];
            if (activityId) {
                const assetSnap = await getDocs(query(collection(db, "assets"), where("sourceActivityId", "==", activityId)));
                existingAssets = assetSnap.docs.map(d => ({ ref: d.ref, data: d.data() }));
            }

            const saveResult = await runTransaction(db, async (transaction) => {
                const selectedManager = managerOptions.find(o => o.value === formData.manager);
                const targetActivityId = activityId || doc(collection(db, "activities")).id;
                const activityRef = doc(db, "activities", targetActivityId);

                // --- 1. Settlement Calculation (Local) ---
                const lastSchedule = [...(activities || [])].reverse().find(a => a.type === "as_schedule");
                const reservedSupplies = lastSchedule?.selectedSupplies || [];
                const reservedMap = new Map<string, { name: string, category: string, quantity: number }>();
                reservedSupplies.forEach((s: any) => {
                    const key = `${s.name.trim()}|${(s.category || "").trim()}`;
                    if (s.category) {
                        const qty = Number(s.quantity) || 0;
                        reservedMap.set(key, { name: s.name.trim(), category: s.category.trim(), quantity: (reservedMap.get(key)?.quantity || 0) + qty });
                    }
                });
                const actualMap = new Map<string, { name: string, category: string, quantity: number }>();
                formData.selectedSupplies.forEach(s => {
                    const key = `${s.name.trim()}|${(s.category || "").trim()}`;
                    if (s.category) {
                        const qty = Number(s.quantity) || 0;
                        actualMap.set(key, { name: s.name.trim(), category: s.category.trim(), quantity: (actualMap.get(key)?.quantity || 0) + qty });
                    }
                });
                const allKeys = new Set([...reservedMap.keys(), ...actualMap.keys()]);
                const settlementItems: { name: string, category: string, delta: number }[] = [];
                allKeys.forEach(key => {
                    const res = reservedMap.get(key)?.quantity || 0;
                    const act = actualMap.get(key)?.quantity || 0;
                    const delta = res - act;
                    if (delta !== 0) {
                        const item = reservedMap.get(key) || actualMap.get(key);
                        if (item) settlementItems.push({ name: item.name, category: item.category, delta });
                    }
                });

                // --- 2. ALL READS & PREPARATION ---
                const activitySnap = activityId ? await transaction.get(activityRef) : null;
                const customerRef = doc(db, "customers", customer.id);
                const metaRef = doc(db, "customer_meta", `${customer.id}_${AS_COMPLETE_CONSTANTS.META_PREFIX}`);
                const metaSnap = await transaction.get(metaRef);

                const metaTracker = new Map<string, { ref: any, data: any, deltaStock: number, deltaOutflow: number, deltaInflow: number }>();
                const encryptMetaId = (name: string, category: string) => `meta_${name.trim()}_${category.trim()}`.replace(/\//g, "_");
                const loadMeta = async (metaId: string) => {
                    if (!metaTracker.has(metaId)) {
                        const ref = doc(db, "asset_meta", metaId);
                        const snap = await transaction.get(ref);
                        const data = snap.exists() ? snap.data() : { totalInflow: 0, totalOutflow: 0, currentStock: 0 };
                        metaTracker.set(metaId, { ref, data: data as any, deltaStock: 0, deltaOutflow: 0, deltaInflow: 0 });
                    }
                };

                // Load Metas
                if (activityId) {
                    for (const asset of existingAssets) {
                        if (asset.data.type === 'inventory') await loadMeta(encryptMetaId(asset.data.name, asset.data.category));
                    }
                }
                for (const item of settlementItems) await loadMeta(encryptMetaId(item.name, item.category));

                let currentMeta = metaSnap.exists() ? metaSnap.data() : { lastSequence: 0, totalCount: 0 };
                let modificationHistory = [];
                const combinedReason = [
                    formData.symptoms.every(t => t.completed) ? "" : `[증상] ${formData.symptomIncompleteReason}`,
                    formData.tasks.every(t => t.completed) ? "" : `[수행] ${formData.taskIncompleteReason}`
                ].filter(Boolean).join(" / ");

                const validProducts = formData.selectedProducts.filter(p => p.name && p.name.trim() !== "");
                const dataToSave: Partial<Activity> = {
                    customerId: customer.id, customerName: customer.name,
                    type: AS_COMPLETE_CONSTANTS.TYPE, typeName: AS_COMPLETE_CONSTANTS.TYPE_NAME,
                    date: formData.date, manager: formData.manager, asType: formData.asType,
                    managerName: selectedManager?.label || formData.manager,
                    managerRole: selectedManager?.role || "employee",
                    location: normalizeText(formData.location), phone: cleanPhone,
                    product: validProducts.map((p, idx) => `${validProducts.length > 1 ? getCircledNumber(idx + 1) : ""}${normalizeText(p.name)} × ${p.quantity}`).join(", "),
                    selectedProducts: validProducts, selectedSupplies: formData.selectedSupplies,
                    symptoms: formData.symptoms, tasks: formData.tasks,
                    symptomIncompleteReason: formData.symptoms.every(t => t.completed) ? "" : formData.symptomIncompleteReason,
                    taskIncompleteReason: formData.tasks.every(t => t.completed) ? "" : formData.taskIncompleteReason,
                    incompleteReason: combinedReason,
                    photos: finalPhotos,
                    commitmentFiles: formData.asType === "이전 시공" ? finalCommitment : [],
                    collectionVideo: formData.asType === "방문 수거" ? finalCollectionVideo : null,
                    reinstallationVideo: formData.asType === "방문 재설치" ? finalReinstallVideo : null,
                    memo: applyColonStandard(formData.memo || ""), updatedAt: serverTimestamp()
                };

                // History (ModificationHistory)
                if (activityId && activitySnap?.exists()) {
                    const oldData = activitySnap.data() as Activity;
                    const changes: string[] = [];

                    // 1. Memo tracking
                    const oldMemo = oldData.memo || "";
                    const newMemo = applyColonStandard(formData.memo || "");
                    if (oldMemo !== newMemo) changes.push(`참고: ${oldMemo || "없음"} → ${newMemo || "없음"}`);

                    // 2. Basic Info tracking
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
                    if (oldLoc !== newLoc) changes.push(`주소: ${oldLoc || "없음"} → ${newLoc || "없음"}`);

                    const oldPhone = oldData.phone || "";
                    const newPhone = cleanPhone;
                    if (oldPhone !== newPhone) changes.push(`전화: ${formatPhone(oldPhone) || "없음"} → ${formatPhone(newPhone) || "없음"}`);

                    // 4. Products & Supplies tracking
                    const oldProduct = oldData.product || "";
                    const newProduct = (dataToSave as any).product || "";
                    if (oldProduct !== newProduct) {
                        const cleanOld = oldProduct.replace(/①|②|③|④|⑤|⑥|⑦|⑧|⑨|⑩/g, "").trim();
                        const cleanNew = newProduct.replace(/①|②|③|④|⑤|⑥|⑦|⑧|⑨|⑩/g, "").trim();
                        if (cleanOld !== cleanNew) changes.push(`점검: ${cleanOld || "없음"} → ${cleanNew || "없음"}`);
                    }

                    const oldSupplies = (oldData.selectedSupplies || []).map((s: any) => `${s.name}x${s.quantity}`).sort().join(", ");
                    const newSupplies = (formData.selectedSupplies || []).map((s: any) => `${s.name}x${s.quantity}`).sort().join(", ");
                    if (oldSupplies !== newSupplies) {
                        changes.push(`사용: ${oldSupplies || "없음"} → ${newSupplies || "없음"}`);
                    }

                    // 5. Symptoms & Tasks tracking (Checklist status)
                    const oldSymptoms = oldData.symptoms || [];
                    const oldSymptomsCompleted = oldSymptoms.filter((s: any) => s.completed).length;
                    const newSymptomsCompleted = formData.symptoms.filter(s => s.completed).length;
                    if (oldSymptomsCompleted !== newSymptomsCompleted || oldSymptoms.length !== formData.symptoms.length) {
                        changes.push(`증상: ${oldSymptomsCompleted}/${oldSymptoms.length} → ${newSymptomsCompleted}/${formData.symptoms.length}`);
                    }

                    const oldTasks = oldData.tasks || [];
                    const oldTasksCompleted = oldTasks.filter((t: any) => t.completed).length;
                    const newTasksCompleted = formData.tasks.filter(t => t.completed).length;
                    if (oldTasksCompleted !== newTasksCompleted || oldTasks.length !== formData.tasks.length) {
                        changes.push(`결과: ${oldTasksCompleted}/${oldTasks.length} → ${newTasksCompleted}/${formData.tasks.length}`);
                    }

                    // 6. Incomplete Reason tracking
                    const oldIncomplete = oldData.incompleteReason || "";
                    const newIncomplete = combinedReason || "";
                    if (oldIncomplete !== newIncomplete) {
                        changes.push(`사유: ${oldIncomplete || "없음"} → ${newIncomplete || "없음"}`);
                    }

                    // 7. Assets tracking
                    const oldPhotos = (oldData.photos || []).length;
                    const newPhotos = (finalPhotos || []).length;
                    if (oldPhotos !== newPhotos) changes.push(`사진: ${oldPhotos}개 → ${newPhotos}개`);

                    const oldCommitment = (oldData.commitmentFiles || []).length;
                    const newCommitment = (finalCommitment || []).length;
                    if (oldCommitment !== newCommitment) changes.push(`확약: ${oldCommitment}개 → ${newCommitment}개`);

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

                // --- 3. ALL WRITES START ---
                transaction.update(customerRef, { lastConsultDate: formData.date, updatedAt: serverTimestamp() });

                if (activityId) {
                    existingAssets.forEach(asset => {
                        affectedItems.add(`${asset.data.name}|${asset.data.category}`);
                        if (asset.data.type === 'inventory') {
                            const tracker = metaTracker.get(encryptMetaId(asset.data.name, asset.data.category));
                            if (tracker) {
                                const inF = Number(asset.data.lastInflow) || 0;
                                const outF = Number(asset.data.lastOutflow) || 0;
                                tracker.deltaStock -= inF; tracker.deltaInflow -= inF;
                                tracker.deltaStock += outF; tracker.deltaOutflow -= outF;
                            }
                        }
                        transaction.delete(asset.ref);
                    });
                    transaction.update(activityRef, dataToSave as any);
                } else {
                    const nextSeq = lastSchedule?.sequenceNumber || (activities.filter(a => a.type === AS_COMPLETE_CONSTANTS.TYPE).length + 1);
                    transaction.set(activityRef, { ...dataToSave, sequenceNumber: nextSeq, createdAt: serverTimestamp(), createdBy: userData?.uid || "system", createdByName: userData?.name || "알 수 없음" });
                    transaction.set(metaRef, { lastSequence: nextSeq, totalCount: (Number(currentMeta.totalCount) || 0) + 1, lastUpdatedAt: serverTimestamp() }, { merge: true });
                }

                const nowSec = new Date();
                const actionDate = `${nowSec.getFullYear()}-${String(nowSec.getMonth() + 1).padStart(2, '0')}-${String(nowSec.getDate()).padStart(2, '0')}`;

                // Settlement Writes
                for (const item of settlementItems) {
                    const tracker = metaTracker.get(encryptMetaId(item.name, item.category));
                    affectedItems.add(`${item.name}|${item.category}`);
                    if (item.delta > 0) { // Recovery
                        if (tracker) { tracker.deltaStock += item.delta; tracker.deltaInflow += item.delta; }
                        transaction.set(doc(collection(db, "assets")), {
                            category: item.category, name: item.name, type: "inventory",
                            stock: (Number(tracker?.data.currentStock || 0) + (tracker?.deltaStock || 0)),
                            lastActionDate: actionDate, lastOperator: selectedManager?.label || userData?.name || "System",
                            lastInflow: item.delta, lastRecipient: customer.name || "-", lastRecipientId: customer.id,
                            createdAt: serverTimestamp(), editLog: `A/S 정산 회수 (${customer.name}) [Lock-Verified]`,
                            sourceActivityId: targetActivityId
                        });
                    } else if (item.delta < 0) { // Extra Outflow
                        const qty = Math.abs(item.delta);
                        if (tracker) { tracker.deltaStock -= qty; tracker.deltaOutflow += qty; }
                        transaction.set(doc(collection(db, "assets")), {
                            category: item.category, name: item.name, type: "inventory",
                            stock: (Number(tracker?.data.currentStock || 0) + (tracker?.deltaStock || 0)),
                            lastActionDate: actionDate, lastOperator: selectedManager?.label || userData?.name || "System",
                            lastOutflow: qty, lastRecipient: customer.name || "-", lastRecipientId: customer.id,
                            createdAt: serverTimestamp(), editLog: `A/S 정산 추가사용 (${customer.name}) [Lock-Verified]`,
                            sourceActivityId: targetActivityId
                        });
                    }
                }

                // Commit Metas
                for (const [metaId, tracker] of metaTracker) {
                    if (tracker.deltaStock !== 0 || tracker.deltaOutflow !== 0 || tracker.deltaInflow !== 0) {
                        transaction.set(tracker.ref, {
                            ...tracker.data,
                            currentStock: (Number(tracker.data.currentStock) || 0) + tracker.deltaStock,
                            totalOutflow: (Number(tracker.data.totalOutflow) || 0) + tracker.deltaOutflow,
                            totalInflow: (Number(tracker.data.totalInflow) || 0) + tracker.deltaInflow,
                            lastUpdatedAt: serverTimestamp(), lastAction: "as_complete_sync"
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
                    const [n, c] = itemKey.split("|"); return performSelfHealing(n, c);
                })).catch(e => console.error(e));
                setPendingFiles([]);
                await new Promise(r => setTimeout(r, 500));
                await queryClient.invalidateQueries({ queryKey: ["activities", customer.id] });
                await queryClient.invalidateQueries({ queryKey: ["customer", customer.id] });
                await queryClient.invalidateQueries({ queryKey: ["customers", "list"] });
                await queryClient.invalidateQueries({ queryKey: ["assets", "management"] });
                toast({ title: "A/S 완료 보고 저장", status: "success", position: "top" });
                return true;
            }
            return false;
        } catch (error: any) {
            console.error(error);
            toast({ title: "저장 실패", description: error.message, status: "error", position: "top" });
            return false;
        } finally { setIsLoading(false); isSubmitting.current = false; }
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
                        const inflow = Number(asset.data.lastInflow) || 0;
                        const outflow = Number(asset.data.lastOutflow) || 0;

                        const updatedData = {
                            ...currentData,
                            currentStock: (Number(currentData.currentStock) || 0) - inflow + outflow,
                            totalInflow: (Number(currentData.totalInflow) || 0) - inflow,
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
                    const [n, c] = itemKey.split("|"); return performSelfHealing(n, c);
                })).catch(e => console.error(e));
                await queryClient.invalidateQueries({ queryKey: ["activities", customer.id] });
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
        toggleTask, handleFileUpload, removePhoto, submit, handleDelete
    };
};

useAsCompleteForm.displayName = "useAsCompleteForm";
