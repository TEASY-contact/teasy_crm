"use client";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@chakra-ui/react";
import { db } from "@/lib/firebase";
import { collection, serverTimestamp, doc, runTransaction } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { applyColonStandard, normalizeText } from "@/utils/textFormatter";
import { DemoScheduleFormData, DemoScheduleActivity, SCHEDULE_CONSTANTS } from "./types";
import { ManagerOption } from "../DemoCompleteForm/types";

interface UseDemoScheduleFormProps {
    customer: { id: string, name: string, address?: string, phone?: string };
    activityId?: string;
    initialData?: Partial<DemoScheduleFormData>;
    defaultManager?: string;
}

export const useDemoScheduleForm = ({ customer, activityId, initialData, defaultManager }: UseDemoScheduleFormProps) => {
    const { userData } = useAuth();
    const queryClient = useQueryClient();
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const [formData, setFormData] = useState<DemoScheduleFormData>({
        date: "",
        manager: defaultManager || "",
        location: customer?.address || "",
        phone: customer?.phone || "",
        product: "",
        memo: ""
    });

    // Populate Initial Data
    useEffect(() => {
        if (initialData) {
            setFormData(prev => ({
                ...prev,
                ...initialData,
                manager: initialData.manager || defaultManager || ""
            }));
        } else {
            const now = new Date();
            const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}  ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

            setFormData(prev => ({
                ...prev,
                date: formattedDate,
                location: customer?.address || "",
                phone: customer?.phone || ""
            }));
        }
    }, [initialData, defaultManager, customer.address, customer.phone]);

    const submit = useCallback(async (managerOptions: ManagerOption[]) => {
        if (isLoading) return false;

        // Validation Rules
        const validations = [
            { cond: !formData.date, msg: "시연 일시를 입력해주세요." },
            { cond: !formData.manager, msg: "담당자를 선택해주세요." },
            { cond: !formData.location, msg: "방문 주소를 입력해주세요." },
            { cond: !formData.phone, msg: "연락처를 입력해주세요." },
            { cond: !formData.product, msg: "시연 상품을 선택해주세요." }
        ];

        const error = validations.find(v => v.cond);
        if (error) {
            toast({ title: error.msg, status: "warning", duration: 2000, position: "top" });
            return false;
        }

        setIsLoading(true);
        try {
            const cleanPhone = formData.phone.replace(/[^0-9]/g, "");

            // Paint Guard (v126.3): Ensure UI loading state is painted before heavy transactions
            await new Promise(resolve => setTimeout(resolve, 100));

            const saveResult = await runTransaction(db, async (transaction) => {
                const selectedManager = managerOptions.find(o => o.value === formData.manager);
                const targetActivityId = activityId || doc(collection(db, "activities")).id;
                const activityRef = doc(db, "activities", targetActivityId);

                // --- Meta-Locking for Serialization ---
                const metaRef = doc(db, "customer_meta", `${customer.id}_demo_schedule`);
                const metaSnap = await transaction.get(metaRef);
                let currentMeta = metaSnap.exists() ? metaSnap.data() : { lastSequence: 0, totalCount: 0 };

                const dataToSave: DemoScheduleActivity = {
                    customerId: customer.id,
                    customerName: customer.name,
                    type: SCHEDULE_CONSTANTS.TYPE,
                    typeName: SCHEDULE_CONSTANTS.TYPE_NAME,
                    date: formData.date,
                    manager: formData.manager,
                    managerName: selectedManager?.label || formData.manager,
                    managerRole: selectedManager?.role || "employee",
                    location: normalizeText(formData.location),
                    phone: cleanPhone,
                    product: normalizeText(formData.product),
                    memo: applyColonStandard(formData.memo || ""),
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
                // Delay for Firestore indexing (v123.03)
                await new Promise(resolve => setTimeout(resolve, 500));
                await queryClient.invalidateQueries({ queryKey: ["activities", customer.id] });
                await queryClient.invalidateQueries({ queryKey: ["customer", customer.id] });
                await queryClient.invalidateQueries({ queryKey: ["customers", "list"] });
                toast({ title: "예약 완료", status: "success", duration: 2000, position: "top" });
                return true;
            }
            return false;
        } catch (error: any) {
            console.error("Demo Schedule Submit Failure:", error);
            toast({ title: "저장 실패", description: error.message, status: "error", position: "top" });
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [isLoading, formData, activityId, customer.id, customer.name, userData?.name, userData?.uid, toast]);

    const handleDelete = useCallback(async () => {
        if (!activityId) return false;
        if (!window.confirm(`정말 이 [${SCHEDULE_CONSTANTS.TYPE_NAME}] 보고서를 삭제하시겠습니까?`)) return false;

        setIsLoading(true);
        try {
            const result = await runTransaction(db, async (transaction) => {
                const activityRef = doc(db, "activities", activityId);
                const activitySnap = await transaction.get(activityRef);

                if (!activitySnap.exists()) return { success: false, msg: "데이터가 존재하지 않습니다." };

                const metaRef = doc(db, "customer_meta", `${customer.id}_demo_schedule`);
                const metaSnap = await transaction.get(metaRef);

                if (metaSnap.exists()) {
                    const currentMeta = metaSnap.data();
                    transaction.update(metaRef, {
                        totalCount: Math.max(0, (Number(currentMeta.totalCount) || 0) - 1),
                        lastDeletedAt: serverTimestamp()
                    });
                }

                transaction.delete(activityRef);
                return { success: true };
            });

            if (result.success) {
                // Delay for Firestore indexing
                await new Promise(resolve => setTimeout(resolve, 500));
                await queryClient.invalidateQueries({ queryKey: ["activities", customer.id] });
                await queryClient.invalidateQueries({ queryKey: ["customer", customer.id] });
                await queryClient.invalidateQueries({ queryKey: ["customers", "list"] });
                toast({ title: "삭제 완료", status: "info", duration: 2000, position: "top" });
                return true;
            }
            return false;
        } catch (error) {
            console.error("Demo Schedule Delete Failure:", error);
            toast({ title: "삭제 실패", status: "error", position: "top" });
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [activityId, customer.id, toast, queryClient]);

    return {
        formData, setFormData,
        isLoading,
        submit,
        handleDelete
    };
};
