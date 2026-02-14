"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@chakra-ui/react";
import { db } from "@/lib/firebase";
import { collection, serverTimestamp, doc, runTransaction } from "firebase/firestore";
import { applyColonStandard, normalizeText } from "@/utils/textFormatter";
import { formatPhone } from "@/utils/formatter";
import { isWithinBusinessDays } from "@/utils/dateUtils";
import { useReportMetadata } from "@/hooks/useReportMetadata";
import { useAuth } from "@/context/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { DemoScheduleFormData, DemoScheduleActivity, SCHEDULE_CONSTANTS } from "./types";
import { Customer, ManagerOption, Activity } from "@/types/domain";

interface UseDemoScheduleFormProps {
    customer: { id: string, name: string, address?: string, phone?: string };
    activities?: any[];
    activityId?: string;
    initialData?: Partial<DemoScheduleFormData>;
    defaultManager?: string;
}

export const useDemoScheduleForm = ({ customer, activities = [], activityId, initialData, defaultManager }: UseDemoScheduleFormProps) => {
    const { userData } = useAuth();
    const { holidayMap } = useReportMetadata();
    const queryClient = useQueryClient();
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const isSubmitting = useRef(false);

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
        if (isLoading || isSubmitting.current) return false;

        // Surgical Guard: 3 Business Days Limit Enforcement
        if (activityId && (initialData as any)?.createdAt) {
            const createdAt = (initialData as any).createdAt?.toDate ? (initialData as any).createdAt.toDate() : new Date((initialData as any).createdAt);
            const isMaster = (userData as any)?.role === 'master';
            const isWithinEditTime = isWithinBusinessDays(createdAt, 3, holidayMap);

            if (!isMaster && !isWithinEditTime) {
                toast({ title: "저장 불가", description: "작성 후 3영업일이 경과하여 수정할 수 없습니다.", status: "error", position: "top" });
                return false;
            }
        }

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
                const activitySnap = activityId ? await transaction.get(activityRef) : null;
                const currentMeta = metaSnap.exists() ? metaSnap.data() : { lastSequence: 0, totalCount: 0 };

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
                    updatedAt: serverTimestamp()
                };

                // Sync with Customer Document (Last Consult Date)
                const customerRef = doc(db, "customers", customer.id);
                transaction.update(customerRef, {
                    lastConsultDate: formData.date,
                    updatedAt: serverTimestamp()
                });

                if (activityId) {
                    if (activitySnap?.exists()) {
                        const oldData = activitySnap.data() as Activity;
                        const changes: string[] = [];

                        // 1. Memo tracking
                        const oldMemo = oldData.memo || "";
                        const newMemo = applyColonStandard(formData.memo || "");
                        if (oldMemo !== newMemo) changes.push(`참고: ${oldMemo || "없음"} → ${newMemo || "없음"}`);

                        // 2. Info tracking
                        const oldLoc = oldData.location || "";
                        const newLoc = normalizeText(formData.location);
                        if (oldLoc !== newLoc) changes.push(`주소: ${oldLoc || "없음"} → ${newLoc || "없음"}`);

                        const oldPhone = oldData.phone || "";
                        const newPhone = cleanPhone;
                        if (oldPhone !== newPhone) changes.push(`전화: ${formatPhone(oldPhone) || "없음"} → ${formatPhone(newPhone) || "없음"}`);

                        const oldProduct = oldData.product || "";
                        const newProduct = normalizeText(formData.product);
                        if (oldProduct !== newProduct) changes.push(`상품: ${oldProduct || "없음"} → ${newProduct || "없음"}`);

                        // 3. Date & Manager tracking
                        if (oldData.date !== formData.date) changes.push(`일시: ${oldData.date} → ${formData.date}`);
                        if (oldData.manager !== formData.manager) {
                            const oldManagerName = oldData.managerName || oldData.manager;
                            const newManagerName = selectedManager?.label || formData.manager;
                            changes.push(`담당: ${oldManagerName} → ${newManagerName}`);
                        }

                        if (changes.length > 0) {
                            const now = new Date();
                            const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}  ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                            const log = {
                                time: timeStr,
                                manager: userData?.uid || "unknown",
                                managerName: userData?.name || "알 수 없음",
                                content: changes.join(" / ")
                            };
                            dataToSave.modificationHistory = [...(oldData.modificationHistory || []), log];
                        }
                    }
                    transaction.update(activityRef, dataToSave as any);
                } else {
                    const nextSeq = activities.filter(a => a.type === SCHEDULE_CONSTANTS.TYPE).length + 1;
                    transaction.set(activityRef, {
                        ...dataToSave,
                        sequenceNumber: nextSeq,
                        createdAt: serverTimestamp(),
                        createdBy: userData?.uid || "system",
                        createdByName: userData?.name || "알 수 없음"
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
                await queryClient.invalidateQueries({ queryKey: ["customers"] });
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

        // Surgical Guard: 3 Business Days Limit Enforcement
        if ((initialData as any)?.createdAt) {
            const createdAt = (initialData as any).createdAt?.toDate ? (initialData as any).createdAt.toDate() : new Date((initialData as any).createdAt);
            const isMaster = (userData as any)?.role === 'master';
            const isWithinEditTime = isWithinBusinessDays(createdAt, 3, holidayMap);

            if (!isMaster && !isWithinEditTime) {
                toast({ title: "삭제 불가", description: "작성 후 3영업일이 경과하여 삭제할 수 없습니다.", status: "error", position: "top" });
                return false;
            }
        }

        if (!window.confirm("해당 데이터 삭제를 희망하십니까?")) return false;

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
                await queryClient.invalidateQueries({ queryKey: ["customers"] });
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
