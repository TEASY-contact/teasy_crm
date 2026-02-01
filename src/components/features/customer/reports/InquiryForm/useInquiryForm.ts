"use client";
import { useState, useEffect } from "react";
import { useToast } from "@chakra-ui/react";
import { db, storage } from "@/lib/firebase";
import { doc, updateDoc, collection, getDocs, addDoc, serverTimestamp, query, where } from "firebase/firestore";
import { ref as sRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { inquirySchema } from "@/lib/validations/reportSchema";
import { applyColonStandard } from "@/utils/textFormatter";

/**
 * Custom hook to manage the state and logic for InquiryForm.
 * Includes sequential file uploading and Firestore persistence.
 */
export const useInquiryForm = ({ customer, activityId, initialData, defaultManager, userData }: any) => {
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const [formData, setFormData] = useState({
        date: initialData?.date || "",
        manager: initialData?.manager || defaultManager,
        channel: initialData?.channel || "",
        nickname: initialData?.nickname || "",
        phone: initialData?.phone || "",
        product: initialData?.product || "",
        result: initialData?.result || "",
        memo: initialData?.memo || ""
    });

    const [recordings, setRecordings] = useState<any[]>(initialData?.recordings || []);
    const [quotes, setQuotes] = useState<any[]>(initialData?.quotes || []);
    const [pendingFilesMap, setPendingFilesMap] = useState<Record<string, File>>({});

    useEffect(() => {
        if (initialData) {
            setFormData({
                date: initialData.date || "",
                manager: initialData.manager || "",
                channel: initialData.channel || "",
                nickname: initialData.nickname || "",
                phone: initialData.phone || "",
                product: initialData.product || "",
                result: initialData.result || "",
                memo: initialData.memo || ""
            });
            setRecordings(initialData.recordings || []);
            setQuotes(initialData.quotes || []);
        } else {
            const now = new Date();
            const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}  ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            setFormData(prev => ({ ...prev, date: prev.date || formattedDate, manager: prev.manager || defaultManager }));
        }
    }, [initialData, defaultManager]);

    const handleFileAdd = (files: FileList | null, type: 'recording' | 'quote') => {
        if (!files || files.length === 0) return;

        const newFiles = Array.from(files).map((file, index) => {
            const id = Math.random().toString(36).substring(7);
            const url = URL.createObjectURL(file);

            setPendingFilesMap(prev => ({ ...prev, [id]: file }));

            // Standard Naming: Customer_Category_Date
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
    };

    const handleFileRemove = (fileId: string, type: 'recording' | 'quote') => {
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
    };

    const submit = async (managerOptions: any[]) => {
        if (isLoading) return false;

        // Atomic Zero-Defect: Zod Validation Integration
        if (formData.channel === '전화 문의') {
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
            const firstError = validationResult.error.issues[0]?.message || "입력 형식이 올바르지 않습니다.";
            toast({
                title: "검증 실패",
                description: firstError,
                status: "warning",
                duration: 3000,
                position: "top"
            });
            return false;
        }

        setIsLoading(true);
        try {
            const uploadFile = async (fileObj: any, typeFolder: string) => {
                if (!fileObj.url.startsWith('blob:')) return fileObj;
                const file = pendingFilesMap[fileObj.id];
                if (!file) throw new Error(`파일 데이터 유실: ${fileObj.displayName || fileObj.name}`);

                const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
                const filename = `inquiry_${today}_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileObj.ext.toLowerCase()}`;
                const storagePath = `${typeFolder}/${customer.id}/${filename}`;
                const storageRef = sRef(storage, storagePath);

                await uploadBytes(storageRef, file);
                const downloadUrl = await getDownloadURL(storageRef);
                return { ...fileObj, url: downloadUrl };
            };

            const finalRecordings = [];
            for (let i = 0; i < recordings.length; i++) {
                finalRecordings.push(await uploadFile(recordings[i], 'recordings'));
            }

            const finalQuotes = [];
            for (let i = 0; i < quotes.length; i++) {
                finalQuotes.push(await uploadFile(quotes[i], 'quotes'));
            }

            const selectedManager = managerOptions.find(o => o.value === formData.manager);

            const isPhoneInquiry = formData.channel === "전화 문의";

            const dataToSave = {
                customerId: customer.id,
                customerName: customer.name,
                type: "inquiry",
                typeName: "신규 문의",
                date: formData.date || new Date().toISOString().replace('T', '  ').substring(0, 16),
                manager: formData.manager,
                managerName: selectedManager?.label || formData.manager,
                managerRole: selectedManager?.role || "employee",
                channel: formData.channel,
                // Data Cleanup: Zero-Defect Integrity
                nickname: isPhoneInquiry ? "" : (formData.nickname || ""),
                phone: isPhoneInquiry ? (formData.phone || "") : "",
                product: formData.product,
                result: formData.result,
                memo: applyColonStandard(formData.memo || ""),
                recordings: isPhoneInquiry ? finalRecordings : [], // Clear recordings if not Phone Inquiry
                quotes: finalQuotes,
                updatedAt: serverTimestamp(),
                createdByName: userData?.name || ""
            };

            if (activityId) {
                await updateDoc(doc(db, "activities", activityId), dataToSave);
            } else {
                const q = query(
                    collection(db, "activities"),
                    where("customerId", "==", customer.id),
                    where("type", "==", "inquiry")
                );
                const snapshot = await getDocs(q);
                const maxSeq = snapshot.docs.reduce((max, d) => Math.max(max, d.data().sequenceNumber || 0), 0);

                await addDoc(collection(db, "activities"), {
                    ...dataToSave,
                    sequenceNumber: maxSeq + 1,
                    createdAt: serverTimestamp(),
                    createdBy: userData?.uid,
                });
            }

            toast({ title: "저장 성공", status: "success", duration: 3000, position: "top" });
            return true;
        } catch (error: any) {
            toast({ title: "저장 실패", description: error.message, status: "error", duration: 3000, position: "top" });
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    return {
        formData, setFormData,
        recordings, setRecordings, quotes,
        isLoading,
        handleFileAdd, handleFileRemove,
        submit
    };
};
