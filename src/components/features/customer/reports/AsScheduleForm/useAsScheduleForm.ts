// src/components/features/customer/reports/AsScheduleForm/useAsScheduleForm.ts
"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@chakra-ui/react";
import { db, storage } from "@/lib/firebase";
import {
    doc,
    serverTimestamp,
    runTransaction,
    collection,
    query,
    where,
    getDocs
} from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import {
    ref as sRef,
    uploadBytes,
    getDownloadURL,
    deleteObject
} from "firebase/storage";
import { applyColonStandard, normalizeText } from "@/utils/textFormatter";
import { formatPhone } from "@/utils/formatter";
import { AsScheduleFormData, AS_SCHEDULE_CONSTANTS, SelectedItem } from "./types";
import { Activity, ActivityType, ManagerOption } from "@/types/domain";
import { performSelfHealing } from "@/utils/assetUtils";
import { isWithinBusinessDays } from "@/utils/dateUtils";
import { useReportMetadata } from "@/hooks/useReportMetadata";

interface UseAsScheduleFormProps {
    customer: { id: string, name: string, address?: string, phone?: string };
    activities?: any[];
    activityId?: string;
    initialData?: any;
    isReadOnly?: boolean;
    defaultManager?: string;
}

export const useAsScheduleForm = ({
    customer,
    activities = [],
    activityId,
    initialData,
    isReadOnly,
    defaultManager
}: UseAsScheduleFormProps) => {
    const { userData } = useAuth();
    const { holidayMap } = useReportMetadata();
    const queryClient = useQueryClient();
    const toast = useToast();
    const isSubmitting = useRef(false);
    const [isLoading, setIsLoading] = useState(false);

    // File upload state
    const [pendingFiles, setPendingFiles] = useState<{ url: string, file: File }[]>([]);

    const [formData, setFormData] = useState<AsScheduleFormData>({
        date: "",
        manager: defaultManager || "",
        asType: "",
        location: customer?.address || "",
        phone: formatPhone(customer?.phone || ""),
        selectedProducts: [],
        symptoms: [""],
        tasks: [""],
        selectedSupplies: [],
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
                asType: initialData.asType || "",
                selectedProducts: initialData.selectedProducts || [],
                symptoms: initialData.symptoms || [""],
                tasks: initialData.tasks || [""],
                selectedSupplies: initialData.selectedSupplies || [],
                photos: initialData.photos || []
            }));
        } else if (!isReadOnly) {
            const now = new Date();
            const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}  ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

            setFormData(prev => ({
                ...prev,
                date: formattedDate,
                asType: "",
                location: customer?.address || "",
                phone: formatPhone(customer?.phone || ""),
                manager: defaultManager || prev.manager,
                selectedProducts: [],
                symptoms: [""],
                tasks: [""],
                selectedSupplies: [],
                photos: []
            }));
        }
    }, [initialData, defaultManager, customer.address, customer.phone, activities, isReadOnly]);

    const handleFileUpload = useCallback((files: FileList | null) => {
        if (!files || files.length === 0) return;

        setFormData(prev => {
            if (prev.photos.length + files.length > AS_SCHEDULE_CONSTANTS.MAX_PHOTOS) {
                toast({ title: "한도 초과", description: `사진은 최대 ${AS_SCHEDULE_CONSTANTS.MAX_PHOTOS}장까지 업로드 가능합니다.`, status: "warning", position: "top" });
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

    const addSymptom = useCallback(() => {
        setFormData(prev => ({ ...prev, symptoms: [...prev.symptoms, ""] }));
    }, []);

    const updateSymptom = useCallback((index: number, value: string) => {
        setFormData(prev => {
            const newList = [...prev.symptoms];
            newList[index] = value;
            return { ...prev, symptoms: newList };
        });
    }, []);

    const removeSymptom = useCallback((index: number) => {
        setFormData(prev => {
            if (prev.symptoms.length <= 1) return { ...prev, symptoms: [""] };
            return {
                ...prev,
                symptoms: prev.symptoms.filter((_, i) => i !== index)
            };
        });
    }, []);

    const addTask = useCallback(() => {
        setFormData(prev => ({ ...prev, tasks: [...prev.tasks, ""] }));
    }, []);

    const updateTask = useCallback((index: number, value: string) => {
        setFormData(prev => {
            const newList = [...prev.tasks];
            newList[index] = value;
            return { ...prev, tasks: newList };
        });
    }, []);

    const removeTask = useCallback((index: number) => {
        setFormData(prev => {
            if (prev.tasks.length <= 1) return { ...prev, tasks: [""] };
            return {
                ...prev,
                tasks: prev.tasks.filter((_, i) => i !== index)
            };
        });
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

    const submit = useCallback(async (managerOptions: ManagerOption[]) => {
        if (isLoading || isSubmitting.current) return false;

        // Surgical Guard: 3 Business Days Limit Enforcement
        if (activityId && initialData?.createdAt) {
            const createdAt = initialData.createdAt?.toDate ? initialData.createdAt.toDate() : new Date(initialData.createdAt);
            const isMaster = userData?.role === 'master';
            const isWithinEditTime = isWithinBusinessDays(createdAt, 3, holidayMap);

            if (!isMaster && !isWithinEditTime) {
                toast({ title: "저장 불가", description: "작성 후 3영업일이 경과하여 수정할 수 없습니다.", status: "error", position: "top" });
                return false;
            }
        }

        if (isReadOnly) {
            toast({ title: "수정 권한 없음", description: "읽기 전용 상태에서는 저장할 수 없습니다.", status: "error", position: "top" });
            return false;
        }

        const validSymptoms = formData.symptoms.filter(s => s && s.trim() !== "");
        const validTasks = formData.tasks.filter(t => t && t.trim() !== "");

        if (!formData.date || !formData.manager || !formData.asType || !formData.location || !formData.phone || validSymptoms.length === 0 || validTasks.length === 0) {
            let msg = "필수 항목을 모두 입력해주세요.";
            if (!formData.date || !formData.manager) msg = "일시와 담당자를 선택해주세요.";
            else if (!formData.asType) msg = "A/S 유형을 선택해주세요.";
            else if (!formData.location) msg = "방문 주소를 입력해주세요.";
            else if (!formData.phone) msg = "연락처를 입력해주세요.";
            else if (validSymptoms.length === 0) msg = "접수 증상을 최소 1개 이상 입력해주세요.";
            else if (validTasks.length === 0) msg = "수행 요망 사항을 최소 1개 이상 입력해주세요.";

            toast({
                title: "필수 항목 누락",
                description: msg,
                status: "warning",
                duration: 2000,
                position: "top"
            });
            return false;
        }

        setIsLoading(true);
        isSubmitting.current = true;
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
            const targetActivityId = activityId || doc(collection(db, "activities")).id;

            let finalPhotos = [...formData.photos];
            if (pendingFiles.length > 0) {
                const uniquePending = Array.from(new Map(pendingFiles.map(p => [p.file.name + p.file.size, p])).values());
                const uploadPromises = uniquePending.map(async (p, i) => {
                    const ext = p.file.name.split('.').pop() || 'jpg';
                    const filename = `as_sch_${Date.now()}_${i}_${Math.random().toString(36).substring(7)}.${ext}`;
                    const storagePath = `${AS_SCHEDULE_CONSTANTS.STORAGE_PATH_PREFIX}/${customer.id}/${filename}`;
                    const storageRef = sRef(storage, storagePath);
                    await uploadBytes(storageRef, p.file);
                    return await getDownloadURL(storageRef);
                });
                const uploadedUrls = await Promise.all(uploadPromises);
                finalPhotos = finalPhotos.filter(url => !url.startsWith('blob:')).concat(uploadedUrls);
            }

            const finalSeen = new Set();
            finalPhotos = finalPhotos.filter(url => {
                const baseUrl = url.split('?')[0].trim();
                if (finalSeen.has(baseUrl)) return false;
                finalSeen.add(baseUrl);
                return true;
            });

            let existingAssets: any[] = [];
            if (activityId) {
                const assetQuery = query(collection(db, "assets"), where("sourceActivityId", "==", activityId));
                const assetSnap = await getDocs(assetQuery);
                existingAssets = assetSnap.docs.map(d => ({ ref: d.ref, data: d.data() }));
            }

            const saveResult = await runTransaction(db, async (transaction) => {
                const selectedManager = managerOptions.find(o => o.value === formData.manager);
                const activityRef = doc(db, "activities", targetActivityId);
                const metaRef = doc(db, "customer_meta", `${customer.id}_${AS_SCHEDULE_CONSTANTS.META_PREFIX}`);
                const customerRef = doc(db, "customers", customer.id);

                const affectedItems = new Set<string>();

                const supplyNames = formData.selectedSupplies.map(s => s.name.trim());
                const prevAssetNames = existingAssets.map(a => a.data.name.trim());
                const allInvolvedNames = Array.from(new Set([...supplyNames, ...prevAssetNames]));

                const supplyMetaResults = await Promise.all(allInvolvedNames.map(async (name) => {
                    const supply = formData.selectedSupplies.find(s => s.name.trim() === name) ||
                        existingAssets.find(a => a.data.name.trim() === name)?.data;
                    if (!supply) return null;
                    const metaId = `meta_${name}_${(supply.category || "").trim()}`.replace(/\//g, "_");
                    const assetMetaRef = doc(db, "asset_meta", metaId);
                    const snap = await transaction.get(assetMetaRef);
                    return { name, category: (supply.category || "").trim(), ref: assetMetaRef, snap };
                }));

                const validMetaResults = supplyMetaResults.filter(r => r !== null) as any[];
                const metaSnap = await transaction.get(metaRef);
                let currentMeta = metaSnap.exists() ? metaSnap.data() : { lastSequence: 0, totalCount: 0 };

                existingAssets.forEach(asset => {
                    const name = asset.data.name;
                    const category = asset.data.category;
                    affectedItems.add(`${name}|${category}`);

                    const metaResult = validMetaResults.find(r => r.name === name && r.category === category);
                    if (metaResult && metaResult.snap.exists()) {
                        const metaData = metaResult.snap.data();
                        const restoredOutflow = Number(asset.data.lastOutflow) || 0;
                        transaction.update(metaResult.ref, {
                            currentStock: (Number(metaData.currentStock) || 0) + restoredOutflow,
                            totalOutflow: (Number(metaData.totalOutflow) || 0) - restoredOutflow,
                            lastUpdatedAt: serverTimestamp()
                        });
                    }
                    transaction.delete(asset.ref);
                });

                const now = new Date();
                const actionDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

                formData.selectedSupplies.forEach(supply => {
                    const name = supply.name.trim();
                    const category = (supply.category || "").trim();
                    affectedItems.add(`${name}|${category}`);

                    const metaResult = validMetaResults.find(r => r.name === name && r.category === category);
                    if (metaResult) {
                        const metaSnap = metaResult.snap;
                        const metaData = metaSnap.exists() ? metaSnap.data() : { currentStock: 0, totalOutflow: 0 };
                        const qty = Number(supply.quantity) || 0;
                        const finalStock = (Number(metaData.currentStock) || 0) - qty;

                        transaction.set(metaResult.ref, {
                            currentStock: finalStock,
                            totalOutflow: (Number(metaData.totalOutflow) || 0) + qty,
                            lastUpdatedAt: serverTimestamp(),
                            lastAction: "as_schedule_outflow"
                        }, { merge: true });

                        const newAssetRef = doc(collection(db, "assets"));
                        transaction.set(newAssetRef, {
                            category,
                            name,
                            stock: finalStock,
                            type: "inventory",
                            lastActionDate: actionDate,
                            lastOperator: userData?.name || "알 수 없음",
                            lastInflow: null,
                            lastOutflow: qty,
                            lastRecipient: customer.name || "-",
                            lastRecipientId: customer.id,
                            createdAt: serverTimestamp(),
                            editLog: `A/S 방문 준비 물품 출고 [${customer.name}]`,
                            sourceActivityId: targetActivityId
                        });
                    }
                });

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
                    phone: formData.phone.replace(/[^0-9]/g, ""),
                    selectedProducts: formData.selectedProducts.map(p => ({
                        id: p.id,
                        name: p.name,
                        quantity: p.quantity,
                        category: p.category || ""
                    })),
                    selectedSupplies: formData.selectedSupplies.map(s => ({
                        id: s.id,
                        name: s.name,
                        quantity: s.quantity,
                        category: s.category || ""
                    })),
                    symptoms: formData.symptoms.filter(s => s && s.trim() !== "").map(s => normalizeText(s)),
                    tasks: formData.tasks.filter(t => t && t.trim() !== "").map(t => normalizeText(t)),
                    photos: finalPhotos,
                    memo: applyColonStandard(formData.memo || ""),
                    updatedAt: serverTimestamp(),
                    createdByName: userData?.name || "알 수 없음"
                };

                Object.keys(dataToSave).forEach(key => {
                    if ((dataToSave as any)[key] === undefined) {
                        delete (dataToSave as any)[key];
                    }
                });

                transaction.update(customerRef, {
                    lastConsultDate: formData.date,
                    updatedAt: serverTimestamp()
                });

                if (activityId) {
                    transaction.update(activityRef, dataToSave as any);

                    // 🚨 Core Sync Logic: Sync asType to linked as_complete reports (v124.85)
                    const seqNum = initialData?.sequenceNumber;
                    if (seqNum) {
                        const completeQuery = query(
                            collection(db, "activities"),
                            where("customerId", "==", customer.id),
                            where("type", "==", "as_complete"),
                            where("sequenceNumber", "==", seqNum)
                        );
                        const completeSnap = await getDocs(completeQuery);
                        completeSnap.docs.forEach(d => {
                            const updateData: any = { asType: formData.asType };
                            // Clear type-specific files that no longer match the synced type (v124.86)
                            if (formData.asType !== "이전 시공") updateData.commitmentFiles = [];
                            if (formData.asType !== "방문 수거") updateData.collectionVideo = null;
                            if (formData.asType !== "방문 재설치") updateData.reinstallationVideo = null;
                            transaction.update(d.ref, updateData);
                        });
                    }
                } else {
                    const nextSeq = activities.filter(a => a.type === AS_SCHEDULE_CONSTANTS.TYPE).length + 1;
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

                return { success: true, affectedItems: Array.from(affectedItems) };
            });

            if (saveResult.success) {
                if (saveResult.affectedItems && saveResult.affectedItems.length > 0) {
                    Promise.all(saveResult.affectedItems.map(itemKey => {
                        const [name, category] = itemKey.split("|");
                        return performSelfHealing(name, category);
                    })).catch(e => console.error("Self-healing error:", e));
                }

                if (activityId && initialData?.photos) {
                    const removedPhotos = initialData.photos.filter((oldUrl: string) => !finalPhotos.includes(oldUrl));
                    await cleanupOrphanedPhotos(removedPhotos);
                }

                setPendingFiles([]);
                await new Promise(resolve => setTimeout(resolve, 500));
                await queryClient.invalidateQueries({ queryKey: ["activities", customer.id] });
                await queryClient.invalidateQueries({ queryKey: ["customer", customer.id] });
                await queryClient.invalidateQueries({ queryKey: ["customers", "list"] });
                await queryClient.invalidateQueries({ queryKey: ["assets", "management"] });
                toast({ title: "A/S 예약 완료", status: "success", duration: 2000, position: "top" });
                return true;
            }
            return false;
        } catch (error: any) {
            console.error("AS Schedule Submit Failure:", error);
            toast({ title: "저장 실패", description: error.message, status: "error", position: "top" });
            return false;
        } finally {
            setIsLoading(false);
            isSubmitting.current = false;
        }
    }, [isLoading, formData, pendingFiles, activityId, initialData, customer.id, customer.name, userData, toast, queryClient, cleanupOrphanedPhotos, holidayMap, isReadOnly]);

    const handleDelete = useCallback(async () => {
        if (!activityId) return false;

        // Surgical Guard: 3 Business Days Limit Enforcement
        if (initialData?.createdAt) {
            const createdAt = initialData.createdAt?.toDate ? initialData.createdAt.toDate() : new Date(initialData.createdAt);
            const isMaster = userData?.role === 'master';
            const isWithinEditTime = isWithinBusinessDays(createdAt, 3, holidayMap);

            if (!isMaster && !isWithinEditTime) {
                toast({ title: "삭제 불가", description: "작성 후 3영업일이 경과하여 삭제할 수 없습니다.", status: "error", position: "top" });
                return false;
            }
        }

        if (isReadOnly) {
            toast({ title: "권한 없음", description: "읽기 전용 상태에서는 삭제할 수 없습니다.", status: "error", position: "top" });
            return false;
        }

        if (!window.confirm("보고서와 연결된 데이터 및 사진이 모두 삭제됩니다. 정말 삭제하시겠습니까?")) return false;
        setIsLoading(true);
        try {
            const assetQuery = query(collection(db, "assets"), where("sourceActivityId", "==", activityId));
            const assetSnap = await getDocs(assetQuery);
            const assetsToRestore = assetSnap.docs.map(d => ({ ref: d.ref, data: d.data() }));

            const result = await runTransaction(db, async (transaction) => {
                const affectedItems = new Set<string>();
                const metaSnapshots = await Promise.all(assetsToRestore.map(async (asset) => {
                    const metaId = `meta_${asset.data.name}_${asset.data.category}`.replace(/\//g, "_");
                    const assetMetaRef = doc(db, "asset_meta", metaId);
                    const snap = await transaction.get(assetMetaRef);
                    return { asset, ref: assetMetaRef, snap };
                }));

                const activityRef = doc(db, "activities", activityId);
                const activitySnap = await transaction.get(activityRef);
                const metaRef = doc(db, "customer_meta", `${customer.id}_${AS_SCHEDULE_CONSTANTS.META_PREFIX}`);
                const custMetaSnap = await transaction.get(metaRef);

                let photosToDelete: string[] = [];
                if (activitySnap.exists()) {
                    photosToDelete = activitySnap.data().photos || [];
                }

                for (const item of metaSnapshots) {
                    const { asset, ref: assetMetaRef, snap: assetMetaSnap } = item;
                    affectedItems.add(`${asset.data.name}|${asset.data.category}`);
                    if (assetMetaSnap.exists()) {
                        const metaData = assetMetaSnap.data();
                        const restoredOutflow = Number(asset.data.lastOutflow) || 0;
                        transaction.update(assetMetaRef, {
                            currentStock: (Number(metaData.currentStock) || 0) + restoredOutflow,
                            totalOutflow: (Number(metaData.totalOutflow) || 0) - restoredOutflow,
                            lastUpdatedAt: serverTimestamp()
                        });
                    }
                    transaction.delete(asset.ref);
                }

                if (custMetaSnap.exists()) {
                    transaction.update(metaRef, {
                        totalCount: Math.max(0, (Number(custMetaSnap.data().totalCount) || 0) - 1),
                        lastDeletedAt: serverTimestamp()
                    });
                }

                transaction.delete(activityRef);
                return { success: true, photosToDelete, affectedItems: Array.from(affectedItems) };
            });

            if (result.success) {
                if (result.photosToDelete.length > 0) await cleanupOrphanedPhotos(result.photosToDelete);
                if (result.affectedItems.length > 0) {
                    Promise.all(result.affectedItems.map(itemKey => {
                        const [name, category] = itemKey.split("|");
                        return performSelfHealing(name, category);
                    })).catch(e => console.error("Self-healing error:", e));
                }

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
            console.error("AS Schedule Delete Failure:", error);
            toast({ title: "삭제 실패", status: "error", position: "top" });
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [activityId, customer.id, toast, queryClient, cleanupOrphanedPhotos, holidayMap, initialData, isReadOnly, userData]);

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

    return {
        formData, setFormData,
        isLoading,
        handleFileUpload, removePhoto,
        addSymptom, updateSymptom, removeSymptom,
        addTask, updateTask, removeTask,
        handleAddProduct, handleUpdateQty, handleReorder,
        handleAddSupply, handleUpdateSupplyQty, handleReorderSupplies,
        submit,
        handleDelete
    };
};
