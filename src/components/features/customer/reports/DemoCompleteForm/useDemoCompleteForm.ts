"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@chakra-ui/react";
import { db, storage } from "@/lib/firebase";
import { collection, serverTimestamp, doc, query, where, getDocs, runTransaction } from "firebase/firestore";
import { ref as sRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { useAuth } from "@/context/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { applyColonStandard, normalizeText, getTeasyStandardFileName } from "@/utils/textFormatter";
import { InquiryFile } from "../InquiryForm/types";
import { DemoCompleteFormData, DemoCompleteActivity, ManagerOption, DEMO_CONSTANTS } from "./types";

interface UseDemoCompleteFormProps {
    customer: { id: string, name: string };
    activities?: any[]; // Assuming activities can be of various types, or a more specific type if available
    activityId?: string;
    initialData?: Partial<DemoCompleteFormData>;
    defaultManager?: string;
}

export const useDemoCompleteForm = ({ customer, activities, activityId, initialData, defaultManager }: UseDemoCompleteFormProps) => {
    const { userData } = useAuth();
    const queryClient = useQueryClient();
    const toast = useToast();
    const isSubmitting = useRef(false);
    const [isLoading, setIsLoading] = useState(false);

    // File upload state for UI only
    const [pendingFiles, setPendingFiles] = useState<{ url: string, file: File }[]>([]);
    const [quotes, setQuotes] = useState<InquiryFile[]>(initialData?.quotes || []);
    const [pendingQuotesMap, setPendingQuotesMap] = useState<Record<string, File>>({});

    const [formData, setFormData] = useState<DemoCompleteFormData>({
        date: "",
        manager: defaultManager || "",
        location: "",
        phone: "",
        product: "",
        result: "",
        discountType: "",
        discountValue: "",
        memo: "",
        photos: [],
        quotes: []
    });

    // Populate Initial Data
    useEffect(() => {
        if (initialData) {
            const deduplicate = (list: any[]) => {
                const seen = new Set();
                return (list || []).filter(item => {
                    const val = typeof item === 'string' ? item : item?.url;
                    if (!val) return false;
                    const baseUrl = val.split('?')[0].trim();
                    if (seen.has(baseUrl)) return false;
                    seen.add(baseUrl);
                    return true;
                });
            };

            setFormData(prev => ({
                ...prev,
                ...initialData,
                manager: initialData.manager || defaultManager || "",
                photos: deduplicate(initialData.photos || []),
                quotes: initialData.quotes || []
            }));
            setQuotes(initialData.quotes || []);
        } else {
            // New report: Auto-fill current date
            const now = new Date();
            const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}  ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

            setFormData(prev => ({ ...prev, date: formattedDate }));

            // Auto-fill from last schedule if available
            const lastSchedule = [...(activities || [])].reverse().find(a => a.type === "demo_schedule");
            if (lastSchedule) {
                setFormData(prev => ({
                    ...prev,
                    manager: lastSchedule.manager || prev.manager,
                    location: lastSchedule.location || prev.location,
                    phone: lastSchedule.phone || prev.phone,
                    product: lastSchedule.product || prev.product,
                    date: formattedDate // Ensure date is set logic order
                }));
            }
        }
    }, [initialData, activities, defaultManager]);

    // --- Auxiliary Functions (Resource UI) ---
    const handleFileUpload = useCallback((files: FileList | null) => {
        if (!files || files.length === 0) return;

        setFormData(prev => {
            if (prev.photos.length + files.length > DEMO_CONSTANTS.MAX_PHOTOS) {
                toast({ title: "한도 초과", description: `사진은 최대 ${DEMO_CONSTANTS.MAX_PHOTOS}장까지 업로드 가능합니다.`, status: "warning", position: "top" });
                return prev;
            }

            const newPending: { url: string, file: File }[] = [];
            const newUrls: string[] = [];

            // Ignore already pending files by name and size to prevent double-selection duplication (v124.77)
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

    const handleQuoteAdd = useCallback((files: FileList | null) => {
        if (!files || files.length === 0) return;

        const currentCount = quotes.length;
        const newFiles = Array.from(files).map((file, index) => {
            const id = Math.random().toString(36).substring(7);
            const url = URL.createObjectURL(file);

            setPendingQuotesMap(prev => ({ ...prev, [id]: file }));

            const dateValue = formData.date || new Date().toISOString();
            const displayName = getTeasyStandardFileName(
                customer.name,
                '견적',
                dateValue,
                currentCount + index,
                currentCount + files.length
            ) + `.${file.name.split('.').pop()}`;

            return {
                id,
                url,
                name: file.name,
                displayName,
                ext: file.name.split('.').pop()?.toUpperCase() || "FILE"
            };
        });

        setQuotes(prev => [...prev, ...newFiles]);
    }, [customer.name, quotes.length, formData.date]);

    const handleQuoteRemove = useCallback((fileId: string) => {
        const target = quotes.find(q => q.id === fileId);
        if (target?.url.startsWith('blob:')) URL.revokeObjectURL(target.url);
        setQuotes(prev => prev.filter(q => q.id !== fileId));
        setPendingQuotesMap(prev => {
            const next = { ...prev };
            delete next[fileId];
            return next;
        });
    }, [quotes]);

    // --- Core Resource Management (Physics) ---
    const cleanupOrphanedPhotos = useCallback(async (urlsToDelete: string[]) => {
        if (!urlsToDelete || urlsToDelete.length === 0) return;

        // Final protection: only delete if they are real cloud URLs
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

    const submit = useCallback(async (managerOptions: ManagerOption[]) => {
        if (isLoading || isSubmitting.current) return false;

        // Validation Rule Object
        const validations = [
            { cond: !formData.manager, msg: "담당자를 선택해주세요." },
            { cond: !formData.product, msg: "상품을 선택해주세요." },
            { cond: !formData.result, msg: "결과를 선택해주세요." },
            { cond: !formData.discountType, msg: "할인 종류를 선택해주세요." }
        ];

        const error = validations.find(v => v.cond);
        if (error) {
            toast({ title: error.msg, status: "warning", duration: 2000, position: "top" });
            return false;
        }

        setIsLoading(true);
        isSubmitting.current = true;
        try {
            // 1. Data Sanitization
            const cleanPhone = formData.phone.replace(/[^0-9]/g, "");

            // 2. Parallel Photo Processing
            let finalPhotos = [...formData.photos];
            if (pendingFiles.length > 0) {
                // Deduplicate pending files before upload to prevent accidental multi-upload (v124.78)
                const uniquePending = Array.from(new Map(pendingFiles.map(p => [p.file.name + p.file.size, p])).values());

                const uploadPromises = uniquePending.map(async (p, i) => {
                    const ext = p.file.name.split('.').pop() || 'jpg';
                    const filename = `site_${Date.now()}_${i}_${Math.random().toString(36).substring(7)}.${ext}`;
                    const storagePath = `${DEMO_CONSTANTS.STORAGE_PATH_PREFIX}/${customer.id}/${filename}`;
                    const storageRef = sRef(storage, storagePath);
                    await uploadBytes(storageRef, p.file);
                    return await getDownloadURL(storageRef);
                });

                const uploadedUrls = await Promise.all(uploadPromises);
                finalPhotos = finalPhotos.filter(url => !url.startsWith('blob:')).concat(uploadedUrls);
            }

            // 3. Parallel Quote Uploads (Optimized)
            const uploadQueue = async (fileList: InquiryFile[], folder: string) => {
                return Promise.all(fileList.map(async (f) => {
                    if (!f.url.startsWith('blob:')) return f;

                    const file = pendingQuotesMap[f.id];
                    if (!file) throw new Error(`파일 유실: ${f.displayName}`);

                    const filename = `demo_quote_${Date.now()}_${Math.random().toString(36).substring(7)}.${f.ext.toLowerCase()}`;
                    const storagePath = `${folder}/${customer.id}/${filename}`;
                    const storageRef = sRef(storage, storagePath);

                    await uploadBytes(storageRef, file);
                    const url = await getDownloadURL(storageRef);
                    return { ...f, url };
                }));
            };

            const finalQuotes = await uploadQueue(quotes, 'quotes');

            // High-reliability deduplication by base URL (v124.76)
            const finalSeen = new Set();
            finalPhotos = finalPhotos.filter(url => {
                const baseUrl = url.split('?')[0].trim();
                if (finalSeen.has(baseUrl)) return false;
                finalSeen.add(baseUrl);
                return true;
            });

            // 3. Transactional Persistence with Meta-Lock
            const saveResult = await runTransaction(db, async (transaction) => {
                const selectedManager = managerOptions.find(o => o.value === formData.manager);
                const targetActivityId = activityId || doc(collection(db, "activities")).id;
                const activityRef = doc(db, "activities", targetActivityId);

                const metaRef = doc(db, "customer_meta", `${customer.id}_demo`);
                const metaSnap = await transaction.get(metaRef);
                let currentMeta = metaSnap.exists() ? metaSnap.data() : { lastSequence: 0, totalCount: 0 };

                const dataToSave: DemoCompleteActivity = {
                    customerId: customer.id,
                    customerName: customer.name,
                    type: DEMO_CONSTANTS.TYPE,
                    typeName: DEMO_CONSTANTS.TYPE_NAME,
                    date: formData.date,
                    manager: formData.manager,
                    managerName: selectedManager?.label || formData.manager,
                    managerRole: selectedManager?.role || "employee",
                    location: normalizeText(formData.location),
                    phone: cleanPhone,
                    product: normalizeText(formData.product),
                    result: formData.result,
                    discountType: formData.discountType,
                    discountValue: formData.discountValue,
                    memo: applyColonStandard(formData.memo || ""),
                    photos: finalPhotos,
                    quotes: finalQuotes,
                    updatedAt: serverTimestamp(),
                    createdByName: userData?.name || "알 수 없음"
                };

                // Sync with Customer Document (Last Consult Date)
                const customerRef = doc(db, "customers", customer.id);
                transaction.update(customerRef, {
                    lastConsultDate: formData.date,
                    updatedAt: serverTimestamp()
                });

                if (activityId) {
                    transaction.update(activityRef, dataToSave as any); // Cast to any for updateDoc flexibility
                } else {
                    // Sync sequence number with the authorizing schedule (v124.81)
                    const lastSchedule = [...(activities || [])].reverse().find(a => a.type === "demo_schedule");
                    const nextSeq = lastSchedule?.sequenceNumber || ((activities || []).filter(a => a.type === DEMO_CONSTANTS.TYPE).length + 1);

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
                // 4. POST-DB Resource Cleanup (Safe transition) (v123.04)
                if (activityId && initialData) {
                    const oldPhotos = initialData.photos || [];
                    const removedPhotos = oldPhotos.filter((oldUrl: string) => !finalPhotos.includes(oldUrl));

                    const oldQuotes = (initialData as any).quotes || [];
                    const removedQuotes = oldQuotes.filter((oldQ: any) => !finalQuotes.some(newQ => newQ.url === oldQ.url));
                    const urlsToDelete = [
                        ...removedPhotos,
                        ...removedQuotes.map((q: any) => q.url)
                    ];

                    await cleanupOrphanedPhotos(urlsToDelete);
                }

                setPendingFiles([]);
                setPendingQuotesMap({});
                // Delay for Firestore indexing (v123.03)
                await new Promise(resolve => setTimeout(resolve, 500));
                await queryClient.invalidateQueries({ queryKey: ["activities", customer.id] });
                await queryClient.invalidateQueries({ queryKey: ["customer", customer.id] });
                await queryClient.invalidateQueries({ queryKey: ["customers", "list"] });
                toast({ title: "저장 완료", status: "success", duration: 3000, position: "top" });
                return true;
            }
            return false;
        } catch (error: any) {
            console.error("Demo Complete Submit Failure:", error);
            toast({ title: "저장 실패", description: error.message, status: "error", position: "top" });
            return false;
        } finally {
            setIsLoading(false);
            isSubmitting.current = false;
        }
    }, [isLoading, formData, pendingFiles, quotes, pendingQuotesMap, activityId, initialData, customer.id, customer.name, userData?.name, userData?.uid, toast, cleanupOrphanedPhotos]);

    const handleDelete = useCallback(async () => {
        if (!activityId) return false;
        if (!window.confirm(`정말 이 [${DEMO_CONSTANTS.TYPE_NAME}] 보고서를 삭제하시겠습니까?\n첨부된 모든 사진 데이터도 영구히 삭제됩니다.`)) return false;

        setIsLoading(true);
        try {
            const cleanupResult = await runTransaction(db, async (transaction) => {
                const activityRef = doc(db, "activities", activityId);
                const activitySnap = await transaction.get(activityRef);

                if (!activitySnap.exists()) return { success: false, msg: "데이터가 존재하지 않습니다." };

                const activityData = activitySnap.data() as any;
                const photosToDelete = activityData.photos || [];
                const quotesToDelete = (activityData.quotes || []).map((q: any) => q.url);
                const urlsToDelete = [...photosToDelete, ...quotesToDelete];

                const metaRef = doc(db, "customer_meta", `${customer.id}_demo`);
                const metaSnap = await transaction.get(metaRef);

                if (metaSnap.exists()) {
                    const currentMeta = metaSnap.data();
                    transaction.update(metaRef, {
                        totalCount: Math.max(0, (Number(currentMeta.totalCount) || 0) - 1),
                        lastDeletedAt: serverTimestamp()
                    });
                }

                transaction.delete(activityRef);
                return { success: true, urls: urlsToDelete };
            });

            if (cleanupResult.success) {
                // Physical Cleanup after successful DB deletion
                if (cleanupResult.urls && cleanupResult.urls.length > 0) {
                    await cleanupOrphanedPhotos(cleanupResult.urls);
                }
                // Delay for Firestore indexing
                await new Promise(resolve => setTimeout(resolve, 500));
                await queryClient.invalidateQueries({ queryKey: ["activities", customer.id] });
                await queryClient.invalidateQueries({ queryKey: ["customer", customer.id] });
                await queryClient.invalidateQueries({ queryKey: ["customers", "list"] });
                toast({ title: "삭제 완료", status: "info", duration: 2000, position: "top" });
                return true;
            } else {
                toast({ title: "삭제 실패", description: cleanupResult.msg, status: "error", position: "top" });
                return false;
            }
        } catch (error) {
            console.error("Demo Delete Failure:", error);
            toast({ title: "삭제 실패", status: "error", position: "top" });
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [activityId, customer.id, toast, cleanupOrphanedPhotos]);

    return {
        formData, setFormData,
        quotes,
        handleQuoteAdd, handleQuoteRemove,
        isLoading,
        handleFileUpload, removePhoto,
        submit,
        handleDelete
    };
};
