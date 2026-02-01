"use client";
import { useState, useEffect } from "react";
import { useToast } from "@chakra-ui/react";
import { db, storage } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, updateDoc, doc, deleteDoc, query, where, getDocs } from "firebase/firestore";
import { ref as sRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { applyColonStandard } from "@/utils/textFormatter";

export const useDemoCompleteForm = ({ customer, activities, activityId, initialData, defaultManager, userData }: any) => {
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(false);

    // File upload state for UI only
    const [pendingFiles, setPendingFiles] = useState<{ url: string, file: File }[]>([]);

    const [formData, setFormData] = useState({
        date: initialData?.date || "",
        manager: initialData?.manager || defaultManager,
        location: initialData?.location || "",
        phone: initialData?.phone || "",
        product: initialData?.product || "",
        result: initialData?.result || "",
        discountType: initialData?.discountType || "",
        discountValue: initialData?.discountValue || "",
        memo: initialData?.memo || "",
        photos: initialData?.photos || [] as string[]
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                date: initialData.date || "",
                manager: initialData.manager || "",
                location: initialData.location || "",
                phone: initialData.phone || "",
                product: initialData.product || "",
                result: initialData.result || "",
                discountType: initialData.discountType || "",
                discountValue: initialData.discountValue || "",
                memo: initialData.memo || "",
                photos: initialData.photos || []
            });
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
    }, [initialData, activityId, activities, defaultManager]);

    const handleFileUpload = (files: FileList | null) => {
        if (!files || files.length === 0) return;
        if (formData.photos.length + files.length > 15) {
            toast({ title: "한도 초과", description: "사진은 최대 15장까지 업로드 가능합니다.", status: "warning", position: "top" });
            return;
        }

        const newPending: { url: string, file: File }[] = [];
        const newUrls: string[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (!file.type.startsWith("image/")) continue;
            const localUrl = URL.createObjectURL(file);
            newPending.push({ url: localUrl, file });
            newUrls.push(localUrl);
        }

        setPendingFiles(prev => [...prev, ...newPending]);
        setFormData(prev => ({ ...prev, photos: [...prev.photos, ...newUrls] }));
    };

    const removePhoto = (index: number) => {
        const targetUrl = formData.photos[index];
        if (targetUrl.startsWith('blob:')) {
            URL.revokeObjectURL(targetUrl);
            setPendingFiles(prev => prev.filter(p => p.url !== targetUrl));
        }
        setFormData(prev => ({
            ...prev,
            photos: prev.photos.filter((_: string, i: number) => i !== index)
        }));
    };

    const submit = async (managerOptions: any[]) => {
        if (isLoading) return false;

        if (!formData.manager || !formData.product || !formData.result || !formData.discountType) {
            toast({ title: "입력 부족", status: "warning", duration: 2000, position: "top" });
            return false;
        }

        setIsLoading(true);
        try {
            let finalPhotos = [...formData.photos];
            if (pendingFiles.length > 0) {
                // Parallel Upload for Performance (v123.82 Optimization)
                const uploadPromises = pendingFiles.map(async (p, i) => {
                    const ext = p.file.name.split('.').pop() || 'jpg';
                    const filename = `site_${Date.now()}_${i}_${Math.random().toString(36).substring(7)}.${ext}`;
                    const storagePath = `site_photos/${customer.id}/${filename}`;
                    const storageRef = sRef(storage, storagePath);
                    await uploadBytes(storageRef, p.file);
                    return await getDownloadURL(storageRef);
                });

                const uploadedUrls = await Promise.all(uploadPromises);
                finalPhotos = finalPhotos.filter(url => !url.startsWith('blob:')).concat(uploadedUrls);
            }

            const selectedManager = managerOptions.find(o => o.value === formData.manager);

            const dataToSave = {
                customerId: customer.id,
                customerName: customer.name,
                type: "demo_complete",
                typeName: "시연 완료",
                date: formData.date,
                manager: formData.manager,
                managerName: selectedManager?.label || formData.manager,
                managerRole: selectedManager?.role || "employee",
                location: formData.location || "",
                phone: formData.phone || "",
                product: formData.product,
                result: formData.result,
                discountType: formData.discountType,
                discountValue: formData.discountValue,
                memo: applyColonStandard(formData.memo || ""),
                photos: finalPhotos,
                updatedAt: serverTimestamp(),
                createdByName: userData?.name || ""
            };

            if (activityId) {
                await updateDoc(doc(db, "activities", activityId), dataToSave);
            } else {
                const existingCount = (activities || []).filter((a: any) => a.type === "demo_complete").length;
                await addDoc(collection(db, "activities"), {
                    ...dataToSave,
                    sequenceNumber: existingCount + 1,
                    createdAt: serverTimestamp(),
                    createdBy: userData?.uid || "system",
                });
            }

            setPendingFiles([]);
            toast({ title: "저장 성공", status: "success", duration: 3000, position: "top" });
            return true;
        } catch (error: any) {
            toast({ title: "저장 실패", description: error.message, status: "error", duration: 5000, position: "top" });
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    return {
        formData, setFormData,
        isLoading,
        handleFileUpload, removePhoto,
        submit
    };
};
