// src/components/features/customer/reports/AsCompleteForm/useAsCompleteForm.ts
"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@chakra-ui/react";
import { db, storage } from "@/lib/firebase";
import { collection, serverTimestamp, doc, runTransaction } from "firebase/firestore";
import { ref as sRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { useAuth } from "@/context/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { AsCompleteFormData, AS_COMPLETE_CONSTANTS } from "./types";
import { Activity, Asset } from "@/types/domain";
import { getCircledNumber } from "@/components/features/asset/AssetModalUtils";
import { performSelfHealing } from "@/utils/assetUtils";
import { formatPhone } from "@/utils/formatter";
import { applyColonStandard, normalizeText, getTeasyStandardFileName } from "@/utils/textFormatter";

interface UseAsCompleteFormProps {
    customer: { id: string, name: string, address?: string, phone?: string };
    activities?: any[];
    activityId?: string;
    initialData?: Partial<AsCompleteFormData>;
    defaultManager?: string;
}

export const useAsCompleteForm = ({ customer, activities = [], activityId, initialData, defaultManager }: UseAsCompleteFormProps) => {
    const { userData } = useAuth();
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
        symptoms: [],
        tasks: [],
        selectedSupplies: [],
        symptomIncompleteReason: "",
        taskIncompleteReason: "",
        photos: [],
        memo: "",
        commitmentFiles: [],
        collectionVideo: null,
        reinstallationVideo: null
    });

    useEffect(() => {
        if (initialData) {
            setFormData(prev => ({
                ...prev,
                ...initialData,
                manager: initialData.manager || defaultManager || "",
                asType: initialData.asType || "",
                selectedProducts: initialData.selectedProducts || [],
                symptoms: (initialData.symptoms || []).map((s: any) => typeof s === 'string' ? { text: s, completed: false } : s),
                tasks: (initialData.tasks || []).map((t: any) => typeof t === 'string' ? { text: t, completed: false } : t),
                selectedSupplies: initialData.selectedSupplies || [],
                symptomIncompleteReason: initialData.symptomIncompleteReason || "",
                taskIncompleteReason: initialData.taskIncompleteReason || "",
                photos: initialData.photos || [],
                commitmentFiles: initialData.commitmentFiles || [],
                collectionVideo: initialData.collectionVideo || null,
                reinstallationVideo: initialData.reinstallationVideo || null
            }));
        } else {
            const now = new Date();
            const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}  ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

            // Auto-fill from last as_schedule
            const lastAsSchedule = [...(activities || [])].reverse().find(a => a.type === "as_schedule");

            setFormData(prev => ({
                ...prev,
                date: formattedDate,
                location: lastAsSchedule?.location || customer?.address || "",
                phone: formatPhone(lastAsSchedule?.phone || customer?.phone || ""),
                manager: lastAsSchedule?.manager || prev.manager,
                asType: lastAsSchedule?.asType || "",
                selectedProducts: lastAsSchedule?.selectedProducts || [],
                symptoms: (lastAsSchedule?.symptoms || []).map((s: string) => ({ text: s, completed: false })),
                tasks: (lastAsSchedule?.tasks || []).map((t: string) => ({ text: t, completed: false })),
                selectedSupplies: lastAsSchedule?.selectedSupplies || [],
                symptomIncompleteReason: "",
                taskIncompleteReason: "",
                photos: [],
                commitmentFiles: [],
                collectionVideo: null,
                reinstallationVideo: null
            }));
        }
    }, [initialData, defaultManager, customer.address, customer.phone, activities]);

    const handleFileUpload = useCallback((files: FileList | null) => {
        if (!files || files.length === 0) return;

        setFormData(prev => {
            if (prev.photos.length + files.length > AS_COMPLETE_CONSTANTS.MAX_PHOTOS) {
                toast({ title: "한도 초과", description: `사진은 최대 ${AS_COMPLETE_CONSTANTS.MAX_PHOTOS}장까지 업로드 가능합니다.`, status: "warning", position: "top" });
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

    const handleAttachmentUpload = useCallback((files: FileList | null, type: 'commitment' | 'collection_video' | 'reinstall_video') => {
        if (!files || files.length === 0) return;

        const fileList = Array.from(files);

        // Find existing indices for commitment files to fill gaps (v126.85)
        let existingIndices: number[] = [];
        if (type === 'commitment') {
            existingIndices = formData.commitmentFiles.map(f => {
                const match = (f.displayName || "").match(/_(\d+)$/);
                return match ? parseInt(match[1]) - 1 : -1;
            }).filter(i => i >= 0);
        }

        const newAttachments = fileList.map((file, idx) => {
            const id = Math.random().toString(36).substring(7);
            const url = URL.createObjectURL(file);
            const ext = file.name.split('.').pop()?.toUpperCase() || "FILE";

            const categoryLabel = type === 'commitment' ? '시공확약서' : (type === 'collection_video' ? '수거전동영상' : '설치후동영상');

            let finalIdx = idx;
            let finalTotal = fileList.length;

            if (type === 'commitment') {
                // Find next available index starting from 0
                let nextIdx = 0;
                while (existingIndices.includes(nextIdx)) {
                    nextIdx++;
                }
                existingIndices.push(nextIdx);
                finalIdx = nextIdx;
                // Treat as multi-file (total > 1) to ensure suffix is always added for commitment
                finalTotal = Math.max(2, formData.commitmentFiles.length + fileList.length);
            }

            const displayName = getTeasyStandardFileName(customer.name, categoryLabel, formData.date, finalIdx, finalTotal);

            return {
                id,
                url,
                name: file.name,
                displayName,
                ext,
                _file: file
            };
        });

        setFormData(prev => {
            if (type === 'commitment') {
                return { ...prev, commitmentFiles: [...prev.commitmentFiles, ...newAttachments] };
            } else if (type === 'collection_video') {
                return { ...prev, collectionVideo: newAttachments[0] };
            } else {
                return { ...prev, reinstallationVideo: newAttachments[0] };
            }
        });
    }, [customer.name, formData.date, formData.commitmentFiles]);

    const removeAttachment = useCallback((id: string, type: 'commitment' | 'collection_video' | 'reinstall_video') => {
        setFormData(prev => {
            if (type === 'commitment') {
                const target = prev.commitmentFiles.find(f => f.id === id);
                if (target?.url.startsWith('blob:')) URL.revokeObjectURL(target.url);
                return { ...prev, commitmentFiles: prev.commitmentFiles.filter(f => f.id !== id) };
            } else if (type === 'collection_video') {
                if (prev.collectionVideo?.url.startsWith('blob:')) URL.revokeObjectURL(prev.collectionVideo.url);
                return { ...prev, collectionVideo: null };
            } else {
                if (prev.reinstallationVideo?.url.startsWith('blob:')) URL.revokeObjectURL(prev.reinstallationVideo.url);
                return { ...prev, reinstallationVideo: null };
            }
        });
    }, []);

    const submit = useCallback(async (managerOptions: any[]) => {
        if (isLoading || isSubmitting.current) return false;

        if (!formData.date || !formData.manager || !formData.asType || !formData.location || !formData.phone || formData.selectedSupplies.length === 0) {
            toast({ title: "필수 항목 누락", description: formData.selectedSupplies.length === 0 ? "사용 내역을 최소 1개 이상 추가해주세요." : "필수 항목을 모두 입력해주세요.", status: "warning", duration: 2000, position: "top" });
            return false;
        }

        const symIncomplete = formData.symptoms.some(t => !t.completed);
        const taskIncomplete = formData.tasks.some(t => !t.completed);

        if (symIncomplete && !formData.symptomIncompleteReason.trim()) {
            toast({ title: "사유 입력 필요", description: "점검되지 않은 증상이 있습니다. 사유를 입력해주세요.", status: "warning", duration: 2000, position: "top" });
            return false;
        }

        if (taskIncomplete && !formData.taskIncompleteReason.trim()) {
            toast({ title: "사유 입력 필요", description: "수행되지 않은 결과가 있습니다. 사유를 입력해주세요.", status: "warning", duration: 2000, position: "top" });
            return false;
        }

        // 🚨 AS Type Conditional Validation
        if (formData.asType === "이전 시공") {
            if (formData.commitmentFiles.length < 2) {
                toast({ title: "확약서 누락", description: "시공 확약서 사진을 2장 이상 업로드해주세요.", status: "warning", duration: 2000, position: "top" });
                return false;
            }
        } else if (formData.asType === "방문 수거") {
            if (!formData.collectionVideo) {
                toast({ title: "동영상 누락", description: "수거 전 동영상을 업로드해주세요.", status: "warning", duration: 2000, position: "top" });
                return false;
            }
        } else if (formData.asType === "방문 재설치") {
            if (!formData.reinstallationVideo) {
                toast({ title: "동영상 누락", description: "설치 후 동영상을 업로드해주세요.", status: "warning", duration: 2000, position: "top" });
                return false;
            }
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
                const uploadPromises = uniquePending.map(async (p, i) => {
                    const ext = p.file.name.split('.').pop() || 'jpg';
                    const filename = `as_complete_${Date.now()}_${i}_${Math.random().toString(36).substring(7)}.${ext}`;
                    const storagePath = `${AS_COMPLETE_CONSTANTS.STORAGE_PATH_PREFIX}/${customer.id}/${filename}`;
                    const storageRef = sRef(storage, storagePath);
                    await uploadBytes(storageRef, p.file);
                    return await getDownloadURL(storageRef);
                });
                const uploadedUrls = await Promise.all(uploadPromises);
                finalPhotos = finalPhotos.filter(url => !url.startsWith('blob:')).concat(uploadedUrls);
            }

            // Upload Attachments (Commitment, Videos)
            const uploadQueue = async (fileList: any[], folder: string) => {
                return Promise.all(fileList.map(async (f) => {
                    if (!f.url.startsWith('blob:')) return { id: f.id, url: f.url, name: f.name, displayName: f.displayName, ext: f.ext };

                    const file = f._file;
                    if (!file) throw new Error(`파일 유실: ${f.displayName}`);

                    const filename = `${folder}_${Date.now()}_${Math.random().toString(36).substring(7)}.${f.ext.toLowerCase()}`;
                    const storagePath = `${AS_COMPLETE_CONSTANTS.STORAGE_PATH_PREFIX}/${customer.id}/${filename}`;
                    const storageRef = sRef(storage, storagePath);

                    await uploadBytes(storageRef, file);
                    const url = await getDownloadURL(storageRef);
                    const { _file, ...fileData } = f;
                    return { ...fileData, url };
                }));
            };

            const finalCommitment = await uploadQueue(formData.commitmentFiles, 'commitment');
            const finalCollectionVideo = formData.collectionVideo ? (await uploadQueue([formData.collectionVideo], 'collection_video'))[0] : null;
            const finalReinstallVideo = formData.reinstallationVideo ? (await uploadQueue([formData.reinstallationVideo], 'reinstall_video'))[0] : null;

            const finalSeen = new Set();
            finalPhotos = finalPhotos.filter(url => {
                const baseUrl = url.split('?')[0].trim();
                if (finalSeen.has(baseUrl)) return false;
                finalSeen.add(baseUrl);
                return true;
            });

            // Pre-transaction Read (v1.3 Sync with Schedule Logic)
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

                // Settlement Preparation
                const lastSchedule = [...(activities || [])].reverse().find(a => a.type === "as_schedule");
                const reservedSupplies = lastSchedule?.selectedSupplies || [];

                const reservedMap = new Map<string, { name: string, category: string, quantity: number }>();
                reservedSupplies.forEach((s: any) => {
                    const key = `${s.name.trim()}|${(s.category || "").trim()}`;
                    reservedMap.set(key, { name: s.name.trim(), category: (s.category || "").trim(), quantity: (reservedMap.get(key)?.quantity || 0) + (Number(s.quantity) || 0) });
                });

                const actualMap = new Map<string, { name: string, category: string, quantity: number }>();
                formData.selectedSupplies.forEach(s => {
                    const key = `${s.name.trim()}|${(s.category || "").trim()}`;
                    actualMap.set(key, { name: s.name.trim(), category: (s.category || "").trim(), quantity: (actualMap.get(key)?.quantity || 0) + (Number(s.quantity) || 0) });
                });

                const allKeys = new Set([...reservedMap.keys(), ...actualMap.keys()]);
                const settlementItems: { name: string, category: string, delta: number }[] = [];

                allKeys.forEach(key => {
                    const reservedQty = reservedMap.get(key)?.quantity || 0;
                    const actualQty = actualMap.get(key)?.quantity || 0;
                    const delta = reservedQty - actualQty;

                    if (delta !== 0) {
                        const item = reservedMap.get(key) || actualMap.get(key);
                        if (item && item.category) settlementItems.push({ name: item.name, category: item.category, delta });
                    }
                });

                // ALL READS START
                const customerRef = doc(db, "customers", customer.id);
                const customerSnap = await transaction.get(customerRef);
                const metaRef = doc(db, "customer_meta", `${customer.id}_${AS_COMPLETE_CONSTANTS.META_PREFIX}`);
                const metaSnap = await transaction.get(metaRef);

                const metaReadTasks = settlementItems.map(async (item) => {
                    const metaId = `meta_${item.name}_${item.category}`.replace(/\//g, "_");
                    const assetMetaRef = doc(db, "asset_meta", metaId);
                    const snap = await transaction.get(assetMetaRef);
                    return { item, ref: assetMetaRef, snap };
                });
                const supplyMetaResults = await Promise.all(metaReadTasks);

                // ALL WRITES START
                let currentMeta = metaSnap.exists() ? metaSnap.data() : { lastSequence: 0, totalCount: 0 };
                const validProducts = formData.selectedProducts.filter(p => p.name && p.name.trim() !== "");
                const validSupplies = formData.selectedSupplies.filter(s => s.name && s.name.trim() !== "");

                // Consolidate reasons for legacy Activity interface if needed, or save separately
                const combinedReason = [
                    formData.symptoms.every(t => t.completed) ? "" : `[증상] ${formData.symptomIncompleteReason}`,
                    formData.tasks.every(t => t.completed) ? "" : `[수행] ${formData.taskIncompleteReason}`
                ].filter(Boolean).join(" / ");

                const dataToSave: Partial<Activity> = {
                    customerId: customer.id,
                    customerName: customer.name,
                    type: AS_COMPLETE_CONSTANTS.TYPE,
                    typeName: AS_COMPLETE_CONSTANTS.TYPE_NAME,
                    date: formData.date,
                    manager: formData.manager,
                    managerName: selectedManager?.label || formData.manager,
                    managerRole: selectedManager?.role || "employee",
                    asType: formData.asType,
                    location: normalizeText(formData.location),
                    phone: cleanPhone,
                    product: validProducts.map((p, idx) => {
                        const prefix = validProducts.length > 1 ? getCircledNumber(idx + 1) : "";
                        return `${prefix}${normalizeText(p.name)} × ${p.quantity}`;
                    }).join(", "),
                    selectedProducts: validProducts,
                    selectedSupplies: validSupplies,
                    symptoms: formData.symptoms,
                    tasks: formData.tasks,
                    symptomIncompleteReason: formData.symptoms.every(t => t.completed) ? "" : formData.symptomIncompleteReason,
                    taskIncompleteReason: formData.tasks.every(t => t.completed) ? "" : formData.taskIncompleteReason,
                    incompleteReason: combinedReason,
                    photos: finalPhotos,
                    commitmentFiles: formData.asType === "이전 시공" ? finalCommitment : [],
                    collectionVideo: formData.asType === "방문 수거" ? finalCollectionVideo : null,
                    reinstallationVideo: formData.asType === "방문 재설치" ? finalReinstallVideo : null,
                    memo: applyColonStandard(formData.memo || ""),
                    updatedAt: serverTimestamp(),
                    createdByName: userData?.name || "알 수 없음"
                };

                const now = new Date();
                const actionDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

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
                    const nextSeq = lastSchedule?.sequenceNumber || (activities.filter(a => a.type === AS_COMPLETE_CONSTANTS.TYPE).length + 1);
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

                    transaction.set(assetMetaRef, {
                        ...currentAssetMeta,
                        currentStock: finalStock,
                        totalInflow: item.delta > 0 ? (Number(currentAssetMeta.totalInflow) || 0) + item.delta : (Number(currentAssetMeta.totalInflow) || 0),
                        totalOutflow: item.delta < 0 ? (Number(currentAssetMeta.totalOutflow) || 0) + Math.abs(item.delta) : (Number(currentAssetMeta.totalOutflow) || 0),
                        lastUpdatedAt: serverTimestamp(),
                        lastAction: item.delta > 0 ? "as_recovery" : "as_extra_outflow"
                    }, { merge: true });

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
                            ? `A/S 정산: 물량 남음 (현장 회수 입고) [${customer.name}]`
                            : `A/S 정산: 물량 추가 사용 (현장 추가 출급) [${customer.name}]`,
                        sourceActivityId: targetActivityId
                    });
                }

                return { success: true, affectedItems: Array.from(affectedItems) };
            });

            if (saveResult.success) {
                const urlsToDelete: string[] = [];

                // 1. Photos cleanup
                if (initialData?.photos) {
                    initialData.photos.forEach(url => {
                        if (!finalPhotos.includes(url)) urlsToDelete.push(url);
                    });
                }

                // 2. Commitment Files cleanup
                if (initialData?.commitmentFiles) {
                    initialData.commitmentFiles.forEach(f => {
                        if (!finalCommitment.some(cf => cf.url === f.url)) urlsToDelete.push(f.url);
                    });
                }

                // 3. Videos cleanup
                if (initialData?.collectionVideo && (!finalCollectionVideo || finalCollectionVideo.url !== initialData.collectionVideo.url)) {
                    urlsToDelete.push(initialData.collectionVideo.url);
                }
                if (initialData?.reinstallationVideo && (!finalReinstallVideo || finalReinstallVideo.url !== initialData.reinstallationVideo.url)) {
                    urlsToDelete.push(initialData.reinstallationVideo.url);
                }

                if (urlsToDelete.length > 0) {
                    await cleanupOrphanedPhotos(urlsToDelete);
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
                toast({ title: initialData ? "A/S 완료 수정 완료" : "A/S 완료 등록 완료", status: "success", duration: 2000, position: "top" });
                return true;
            }
        } catch (error: any) {
            console.error("AS Complete Submit Failure:", error);
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
            const { query, where, getDocs } = await import("firebase/firestore");
            const assetQuery = query(collection(db, "assets"), where("sourceActivityId", "==", activityId));
            const assetSnap = await getDocs(assetQuery);
            const assetsToRestores = assetSnap.docs.map(d => ({ ref: d.ref, data: d.data() }));

            const result = await runTransaction(db, async (transaction) => {
                const affectedItems = new Set<string>();
                const metaSnapshots = await Promise.all(assetsToRestores.map(async (asset) => {
                    const metaId = `meta_${asset.data.name}_${asset.data.category}`.replace(/\//g, "_");
                    const assetMetaRef = doc(db, "asset_meta", metaId);
                    const snap = await transaction.get(assetMetaRef);
                    return { asset, ref: assetMetaRef, snap };
                }));

                const activityRef = doc(db, "activities", activityId);
                const activitySnap = await transaction.get(activityRef);
                const metaRef = doc(db, "customer_meta", `${customer.id}_${AS_COMPLETE_CONSTANTS.META_PREFIX}`);
                const custMetaSnap = await transaction.get(metaRef);

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
                    const data = activitySnap.data() as Activity;
                    photosToDelete = [
                        ...(data.photos || []),
                        ...(data.commitmentFiles || []).map(f => f.url),
                        ...(data.collectionVideo ? [data.collectionVideo.url] : []),
                        ...(data.reinstallationVideo ? [data.reinstallationVideo.url] : [])
                    ];
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
                await new Promise(resolve => setTimeout(resolve, 500));
                await queryClient.invalidateQueries({ queryKey: ["activities", customer.id] });
                await queryClient.invalidateQueries({ queryKey: ["customer", customer.id] });
                await queryClient.invalidateQueries({ queryKey: ["customers", "list"] });
                await queryClient.invalidateQueries({ queryKey: ["assets", "management"] });
                toast({ title: "삭제 완료", status: "info", duration: 2000, position: "top" });
                return true;
            }
        } catch (error) {
            toast({ title: "삭제 실패", status: "error", position: "top" });
        } finally { setIsLoading(false); }
        return false;
    }, [activityId, customer.id, toast, cleanupOrphanedPhotos, queryClient]);

    const toggleCheck = useCallback((type: 'symptoms' | 'tasks', index: number) => {
        setFormData(prev => {
            const newList = [...prev[type]];
            newList[index] = { ...newList[index], completed: !newList[index].completed };
            const allSectionDone = newList.every(t => t.completed);

            const fieldToReset = type === 'symptoms' ? 'symptomIncompleteReason' : 'taskIncompleteReason';

            return {
                ...prev,
                [type]: newList,
                [fieldToReset]: allSectionDone ? "" : prev[fieldToReset as keyof AsCompleteFormData]
            };
        });
    }, []);

    return {
        formData, setFormData,
        isLoading,
        handleFileUpload, removePhoto,
        handleAttachmentUpload, removeAttachment,
        toggleCheck,
        submit,
        handleDelete
    };
};
