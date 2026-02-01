// src/components/features/customer/reports/InquiryForm/useInquiryForm.ts
"use client";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@chakra-ui/react";
import { db, storage } from "@/lib/firebase";
import {
    doc,
    serverTimestamp,
    runTransaction,
    collection
} from "firebase/firestore";
import {
    ref as sRef,
    uploadBytes,
    getDownloadURL,
    deleteObject
} from "firebase/storage";
import { inquirySchema } from "@/lib/validations/reportSchema";
import { applyColonStandard } from "@/utils/textFormatter";
import {
    InquiryFormData,
    InquiryFile,
    INQUIRY_CONSTANTS
} from "./types";
import { Customer, User, ManagerOption, Activity, ActivityType } from "@/types/domain";

interface UseInquiryFormProps {
    customer: Pick<Customer, 'id' | 'name' | 'phone'>;
    activityId?: string;
    initialData?: Partial<Activity>;
    defaultManager?: string;
    userData: User | null;
}

export const useInquiryForm = ({ customer, activityId, initialData, defaultManager, userData }: UseInquiryFormProps) => {
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const [formData, setFormData] = useState<InquiryFormData>({
        date: "",
        manager: defaultManager || "",
        channel: "",
        nickname: "",
        phone: customer?.phone || "",
        product: "",
        result: "",
        memo: ""
    });

    const [recordings, setRecordings] = useState<InquiryFile[]>(initialData?.recordings || []);
    const [quotes, setQuotes] = useState<InquiryFile[]>(initialData?.quotes || []);
    const [pendingFilesMap, setPendingFilesMap] = useState<Record<string, File>>({});

    // Populate Initial Data
    useEffect(() => {
        if (initialData) {
            setFormData({
                date: initialData.date || "",
                manager: initialData.manager || "",
                channel: (initialData.channel || "") as any,
                nickname: initialData.nickname || "",
                phone: initialData.phone || "",
                product: initialData.product || "",
                result: (initialData.result || "") as any,
                memo: initialData.memo || ""
            });
            setRecordings(initialData.recordings || []);
            setQuotes(initialData.quotes || []);
        } else {
            const now = new Date();
            const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}  ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            setFormData(prev => ({
                ...prev,
                date: formattedDate,
                manager: defaultManager || "",
                phone: customer?.phone || ""
            }));
        }
    }, [initialData, defaultManager, customer.phone]);

    /**
     * Physical Resource Cleanup: Delete orphaned files from Storage
     */
    const cleanupStorage = useCallback(async (urls: string[]) => {
        if (!urls || urls.length === 0) return;

        await Promise.allSettled(urls.map(async (url) => {
            if (!url.startsWith('https://firebasestorage.googleapis.com')) return;
            try {
                const storageRef = sRef(storage, url);
                await deleteObject(storageRef);
            } catch (e) {
                console.warn("Resource cleanup attempt failed:", url, e);
            }
        }));
    }, []);

    const handleFileAdd = useCallback((files: FileList | null, type: 'recording' | 'quote') => {
        if (!files || files.length === 0) return;

        const newFiles = Array.from(files).map((file, index) => {
            const id = Math.random().toString(36).substring(7);
            const url = URL.createObjectURL(file);

            setPendingFilesMap(prev => ({ ...prev, [id]: file }));

            const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
            const category = type === 'recording' ? '녹취' : '견적';
            const suffix = files.length > 1 ? `_${index + 1}` : "";
            const displayName = `${customer.name}_${category}_${dateStr}${suffix}.${file.name.split('.').pop()}`;

            return {
                id,
                url,
                name: file.name,
                displayName,
                ext: file.name.split('.').pop()?.toUpperCase() || "FILE"
            };
        });

        if (type === 'recording') {
            setRecordings(prev => [...prev, ...newFiles]);
        } else {
            setQuotes(prev => [...prev, ...newFiles]);
        }
    }, [customer.name]);

    const handleFileRemove = useCallback((fileId: string, type: 'recording' | 'quote') => {
        if (type === 'recording') {
            const target = recordings.find(r => r.id === fileId);
            if (target?.url.startsWith('blob:')) URL.revokeObjectURL(target.url);
            setRecordings(prev => prev.filter(r => r.id !== fileId));
        } else {
            const target = quotes.find(q => q.id === fileId);
            if (target?.url.startsWith('blob:')) URL.revokeObjectURL(target.url);
            setQuotes(prev => prev.filter(q => q.id !== fileId));
        }
        setPendingFilesMap(prev => {
            const next = { ...prev };
            delete next[fileId];
            return next;
        });
    }, [recordings, quotes]);

    const submit = useCallback(async (managerOptions: ManagerOption[]) => {
        if (isLoading) return false;

        // 1. Pre-validation
        const isPhoneInquiry = formData.channel === '전화 문의';
        if (isPhoneInquiry) {
            if (!formData.phone) {
                toast({ title: "연락처 필수", description: "전화 문의일 경우 연락처를 입력해야 합니다.", status: "warning", position: "top" });
                return false;
            }
            if (recordings.length === 0) {
                toast({ title: "녹취 파일 필수", description: "전화 문의일 경우 통화 녹음 파일을 업로드해야 합니다.", status: "warning", position: "top" });
                return false;
            }
        }
        if (formData.channel === '채널톡' || formData.channel === '네이버 톡톡') {
            if (!formData.nickname) {
                toast({ title: "닉네임 필수", description: `${formData.channel}의 경우 닉네임을 입력해야 합니다.`, status: "warning", position: "top" });
                return false;
            }
        }

        const validationResult = inquirySchema.safeParse(formData);
        if (!validationResult.success) {
            toast({ title: "검증 실패", description: validationResult.error.issues[0]?.message, status: "warning", position: "top" });
            return false;
        }

        setIsLoading(true);
        try {
            // 2. Parallel File Uploads (Optimized with Promise.all)
            const uploadQueue = async (fileList: InquiryFile[], folder: string) => {
                return Promise.all(fileList.map(async (f) => {
                    if (!f.url.startsWith('blob:')) return f;

                    const file = pendingFilesMap[f.id];
                    if (!file) throw new Error(`파일 유실: ${f.displayName}`);

                    const filename = `inquiry_${Date.now()}_${Math.random().toString(36).substring(7)}.${f.ext.toLowerCase()}`;
                    const storagePath = `${folder}/${customer.id}/${filename}`;
                    const storageRef = sRef(storage, storagePath);

                    await uploadBytes(storageRef, file);
                    const url = await getDownloadURL(storageRef);
                    return { ...f, url };
                }));
            };

            const [finalRecordings, finalQuotes] = await Promise.all([
                uploadQueue(recordings, 'recordings'),
                uploadQueue(quotes, 'quotes')
            ]);

            // 3. Atomic Transaction (Meta-Locking)
            const saveResult = await runTransaction(db, async (transaction) => {
                const selectedManager = managerOptions.find(o => o.value === formData.manager);
                const targetId = activityId || doc(collection(db, "activities")).id;
                const activityRef = doc(db, "activities", targetId);
                const metaRef = doc(db, "customer_meta", `${customer.id}_inquiry`);

                const metaSnap = await transaction.get(metaRef);
                const currentMeta = metaSnap.exists() ? metaSnap.data() : { lastSequence: 0, totalCount: 0 };

                const dataToSave: Partial<Activity> = {
                    customerId: customer.id,
                    customerName: customer.name,
                    type: INQUIRY_CONSTANTS.TYPE as ActivityType,
                    typeName: INQUIRY_CONSTANTS.TYPE_NAME,
                    date: formData.date,
                    manager: formData.manager,
                    managerName: selectedManager?.label || formData.manager,
                    managerRole: (selectedManager?.role || "employee") as any,
                    channel: formData.channel as any,
                    nickname: isPhoneInquiry ? "" : (formData.nickname || ""),
                    phone: isPhoneInquiry ? (formData.phone || "").replace(/[^0-9]/g, "") : "",
                    product: formData.product,
                    result: formData.result as any,
                    memo: applyColonStandard(formData.memo || ""),
                    recordings: isPhoneInquiry ? finalRecordings : [],
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
                    transaction.update(activityRef, dataToSave as any);
                } else {
                    const nextSeq = (Number(currentMeta.lastSequence) || 0) + 1;
                    transaction.set(activityRef, {
                        ...dataToSave,
                        sequenceNumber: nextSeq,
                        createdAt: serverTimestamp(),
                        createdBy: userData?.uid || "system"
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
                toast({ title: "보고서 저장 완료", status: "success", duration: 2000, position: "top" });
                return true;
            }
            return false;
        } catch (error: any) {
            console.error("Inquiry Submit Failure:", error);
            toast({ title: "저장 실패", description: error.message, status: "error", position: "top" });
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [isLoading, formData, recordings, quotes, pendingFilesMap, activityId, customer, userData, toast]);

    const handleDelete = useCallback(async () => {
        if (!activityId) return false;
        if (!window.confirm("정말 이 [신규 문의] 보고서를 삭제하시겠습니까?")) return false;

        setIsLoading(true);
        try {
            const cleanupResult = await runTransaction(db, async (transaction) => {
                const activityRef = doc(db, "activities", activityId);
                const activitySnap = await transaction.get(activityRef);
                if (!activitySnap.exists()) return { success: false };

                const data = activitySnap.data();
                const urlsToDelete: string[] = [
                    ...(data.recordings || []).map((f: any) => f.url),
                    ...(data.quotes || []).map((f: any) => f.url)
                ];

                const metaRef = doc(db, "customer_meta", `${customer.id}_inquiry`);
                const metaSnap = await transaction.get(metaRef);
                if (metaSnap.exists()) {
                    transaction.update(metaRef, {
                        totalCount: Math.max(0, (Number(metaSnap.data().totalCount) || 0) - 1),
                        lastDeletedAt: serverTimestamp()
                    });
                }

                transaction.delete(activityRef);
                return { success: true, urls: urlsToDelete };
            });

            if (cleanupResult.success) {
                if (cleanupResult.urls) await cleanupStorage(cleanupResult.urls);
                toast({ title: "삭제 완료", status: "info", duration: 2000, position: "top" });
                return true;
            }
            return false;
        } catch (error) {
            console.error("Inquiry Delete Failure:", error);
            toast({ title: "삭제 실패", status: "error", position: "top" });
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [activityId, customer.id, toast, cleanupStorage]);

    return {
        formData, setFormData,
        recordings, quotes,
        isLoading,
        handleFileAdd, handleFileRemove,
        submit,
        handleDelete
    };
};
