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
import { AsScheduleFormData, AS_SCHEDULE_CONSTANTS } from "./types";
import { Activity, ActivityType, ManagerOption } from "@/types/domain";

interface UseAsScheduleFormProps {
    customer: { id: string, name: string, address?: string, phone?: string };
    activities?: any[];
    activityId?: string;
    initialData?: Partial<AsScheduleFormData>;
    defaultManager?: string;
}

export const useAsScheduleForm = ({
    customer,
    activities = [],
    activityId,
    initialData,
    defaultManager
}: UseAsScheduleFormProps) => {
    const { userData } = useAuth();
    const queryClient = useQueryClient();
    const toast = useToast();
    const isSubmitting = useRef(false);
    const [isLoading, setIsLoading] = useState(false);

    // File upload state
    const [pendingFiles, setPendingFiles] = useState<{ url: string, file: File }[]>([]);

    const [formData, setFormData] = useState<AsScheduleFormData>({
        date: "",
        manager: defaultManager || "",
        location: customer?.address || "",
        phone: formatPhone(customer?.phone || ""),
        product: "",
        symptoms: [""],
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
                symptoms: initialData.symptoms || [""],
                photos: initialData.photos || []
            }));
        } else {
            const now = new Date();
            const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}  ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

            // Auto-fill from last reports if applicable (e.g. last install product)
            const sortedActivities = [...(activities || [])].sort((a, b) => {
                const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.date || 0);
                const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.date || 0);
                return dateA.getTime() - dateB.getTime();
            });

            const lastInstall = [...sortedActivities].reverse().find(a => a.type === "install_complete");

            setFormData(prev => ({
                ...prev,
                date: formattedDate,
                location: customer?.address || "",
                phone: formatPhone(customer?.phone || ""),
                manager: defaultManager || prev.manager,
                product: lastInstall?.product || "",
                symptoms: [""],
                photos: []
            }));
        }
    }, [initialData, defaultManager, customer.address, customer.phone, activities]);

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

    const submit = useCallback(async (managerOptions: ManagerOption[]) => {
        if (isLoading || isSubmitting.current) return false;

        // 1. Pre-validation & UI Standard: Paint Guard (100ms)
        if (!formData.date || !formData.manager) {
            toast({ title: "필수 항목 누락", status: "warning", duration: 2000, position: "top" });
            return false;
        }

        setIsLoading(true);
        isSubmitting.current = true;

        // UI Paint Delay (v126.3)
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
            // 2. ID Pre-allocation (Surgical standard)
            const targetActivityId = activityId || doc(collection(db, "activities")).id;

            // 3. Parallel Photo Processing
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

            // Photo Deduplication
            const finalSeen = new Set();
            finalPhotos = finalPhotos.filter(url => {
                const baseUrl = url.split('?')[0].trim();
                if (finalSeen.has(baseUrl)) return false;
                finalSeen.add(baseUrl);
                return true;
            });

            // 4. Atomic Transaction (Meta-Locking)
            const saveResult = await runTransaction(db, async (transaction) => {
                const selectedManager = managerOptions.find(o => o.value === formData.manager);
                const activityRef = doc(db, "activities", targetActivityId);
                const metaRef = doc(db, "customer_meta", `${customer.id}_${AS_SCHEDULE_CONSTANTS.META_PREFIX}`);
                const customerRef = doc(db, "customers", customer.id);

                // READS FIRST
                const metaSnap = await transaction.get(metaRef);
                let currentMeta = metaSnap.exists() ? metaSnap.data() : { lastSequence: 0, totalCount: 0 };

                // LOGIC & SANITIZATION
                const dataToSave: Partial<Activity> = {
                    customerId: customer.id,
                    customerName: customer.name,
                    type: AS_SCHEDULE_CONSTANTS.TYPE,
                    typeName: AS_SCHEDULE_CONSTANTS.TYPE_NAME,
                    date: formData.date,
                    manager: formData.manager,
                    managerName: selectedManager?.label || formData.manager,
                    managerRole: selectedManager?.role || "employee",
                    location: normalizeText(formData.location),
                    phone: formData.phone.replace(/[^0-9]/g, ""),
                    product: normalizeText(formData.product),
                    symptoms: formData.symptoms.filter(s => s && s.trim() !== "").map(s => normalizeText(s)),
                    photos: finalPhotos,
                    memo: applyColonStandard(formData.memo || ""),
                    updatedAt: serverTimestamp(),
                    createdByName: userData?.name || "알 수 없음"
                };

                // WRITES
                transaction.update(customerRef, {
                    lastConsultDate: formData.date,
                    updatedAt: serverTimestamp()
                });

                if (activityId) {
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

                return { success: true };
            });

            if (saveResult.success) {
                // Background Resource Cleanup
                if (activityId && initialData?.photos) {
                    const removedPhotos = initialData.photos.filter((oldUrl: string) => !finalPhotos.includes(oldUrl));
                    await cleanupOrphanedPhotos(removedPhotos);
                }

                setPendingFiles([]);
                // Delay for Firestore indexing (v123.03)
                await new Promise(resolve => setTimeout(resolve, 500));
                await queryClient.invalidateQueries({ queryKey: ["activities", customer.id] });
                await queryClient.invalidateQueries({ queryKey: ["customer", customer.id] });
                await queryClient.invalidateQueries({ queryKey: ["customers", "list"] });
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
    }, [isLoading, formData, pendingFiles, activityId, initialData, customer.id, customer.name, userData, toast, queryClient, cleanupOrphanedPhotos]);

    const handleDelete = useCallback(async () => {
        if (!activityId) return false;
        if (!window.confirm("보고서와 연결된 데이터 및 사진이 모두 삭제됩니다. 정말 삭제하시겠습니까?")) return false;
        setIsLoading(true);
        try {
            const result = await runTransaction(db, async (transaction) => {
                const activityRef = doc(db, "activities", activityId);
                const activitySnap = await transaction.get(activityRef);
                const metaRef = doc(db, "customer_meta", `${customer.id}_${AS_SCHEDULE_CONSTANTS.META_PREFIX}`);
                const custMetaSnap = await transaction.get(metaRef);

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
                return { success: true, photosToDelete };
            });

            if (result.success) {
                if (result.photosToDelete.length > 0) await cleanupOrphanedPhotos(result.photosToDelete);
                await new Promise(resolve => setTimeout(resolve, 500));
                await queryClient.invalidateQueries({ queryKey: ["activities", customer.id] });
                await queryClient.invalidateQueries({ queryKey: ["customer", customer.id] });
                await queryClient.invalidateQueries({ queryKey: ["customers", "list"] });
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
    }, [activityId, customer.id, toast, queryClient, cleanupOrphanedPhotos]);

    return {
        formData, setFormData,
        isLoading,
        handleFileUpload, removePhoto,
        addSymptom, updateSymptom, removeSymptom,
        submit,
        handleDelete
    };
};
