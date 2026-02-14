"use client";
import React, { forwardRef, useImperativeHandle, useState, useEffect } from "react";
import { VStack, FormControl, Box, Spinner, HStack, useToast, Flex, Text } from "@chakra-ui/react";
import { CustomSelect } from "@/components/common/CustomSelect";
import {
    TeasyDateTimeInput, TeasyFormLabel, TeasyInput, TeasyTextarea, TeasyPhoneInput
} from "@/components/common/UIComponents";
import { useAuth } from "@/context/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useReportMetadata } from "@/hooks/useReportMetadata";
import { db } from "@/lib/firebase";
import { formatPhone } from "@/utils/formatter";
import {
    doc, updateDoc, deleteDoc, collection, addDoc,
    serverTimestamp, query, where, getDocs, runTransaction
} from "firebase/firestore";
import { applyColonStandard, normalizeText } from "@/utils/textFormatter";
import { Activity, Customer, ManagerOption } from "@/types/domain";

export interface StandardReportFormData {
    date: string;
    manager: string;
    location: string;
    phone: string;
    product: string;
    memo: string;
}

export interface StandardReportFormProps {
    customer: Customer;
    activityId?: string;
    initialData?: Partial<StandardReportFormData>;
    isReadOnly?: boolean;
    defaultManager?: string;
    activities?: any[];
    reportType?: string;
    reportLabel?: string;
}

export interface StandardReportFormHandle {
    submit: () => Promise<boolean>;
    delete: () => Promise<boolean>;
}

export const StandardReportForm = forwardRef<StandardReportFormHandle, StandardReportFormProps>(({
    customer,
    activityId,
    initialData,
    activities = [],
    isReadOnly = false,
    defaultManager = "",
    reportType = "standard",
    reportLabel = "일반 업무"
}, ref) => {
    const { userData } = useAuth();
    const queryClient = useQueryClient();
    const toast = useToast();
    const { managerOptions } = useReportMetadata();
    const [isLoading, setIsLoading] = useState(false);
    const silentRef = React.useRef<HTMLDivElement>(null);

    // Silent Focus Guard (v126.3)
    useEffect(() => {
        if (silentRef.current) silentRef.current.focus();
    }, []);

    // Dynamic field check
    const isVisitType = reportType.includes("schedule") || reportType.includes("complete") || reportType.includes("install") || reportType.includes("as");
    const hasLocation = isVisitType && reportType !== "remoteas_complete";
    const hasPhone = isVisitType && reportType !== "remoteas_complete";
    const hasProduct = isVisitType;

    const [formData, setFormData] = useState<StandardReportFormData>({
        date: initialData?.date || "",
        manager: initialData?.manager || defaultManager,
        location: initialData?.location || customer?.address || "",
        phone: initialData?.phone || customer?.phone || "",
        product: initialData?.product || "",
        memo: initialData?.memo || ""
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                date: initialData.date || "",
                manager: initialData.manager || "",
                location: initialData.location || "",
                phone: initialData.phone || "",
                product: initialData.product || "",
                memo: initialData.memo || ""
            });
        } else {
            const now = new Date();
            const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}  ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

            // Auto-fill from last as_schedule if applicable (v124.81)
            const lastAsSchedule = [...(activities || [])].reverse().find(a => a.type === "as_schedule");

            setFormData(prev => ({
                ...prev,
                date: formattedDate,
                manager: lastAsSchedule?.manager || prev.manager || defaultManager,
                location: lastAsSchedule?.location || prev.location || customer?.address || "",
                phone: lastAsSchedule?.phone || prev.phone || customer?.phone || "",
                product: lastAsSchedule?.product || prev.product || ""
            }));
        }
    }, [initialData, defaultManager, customer, activities]);

    useImperativeHandle(ref, () => ({
        submit: async () => {
            if (!formData.manager) {
                toast({ title: "입력 부족", status: "warning", duration: 2000, position: "top" });
                return false;
            }

            setIsLoading(true);
            try {
                await runTransaction(db, async (transaction) => {
                    const selectedManager = managerOptions.find(o => o.value === formData.manager);
                    const targetActivityId = activityId || doc(collection(db, "activities")).id;
                    const activityRef = doc(db, "activities", targetActivityId);

                    const metaRef = doc(db, "customer_meta", `${customer.id}_${reportType}`);
                    const metaSnap = await transaction.get(metaRef);
                    const activitySnap = activityId ? await transaction.get(activityRef) : null;
                    let currentMeta = metaSnap.exists() ? metaSnap.data() as { lastSequence: number, totalCount: number } : { lastSequence: 0, totalCount: 0 };

                    const dataToSave: Partial<Activity> = {
                        customerId: customer.id,
                        customerName: customer?.name || "",
                        type: reportType as any,
                        typeName: reportLabel,
                        date: formData.date,
                        manager: formData.manager,
                        memo: applyColonStandard(formData.memo || ""),
                        managerName: selectedManager?.label || formData.manager,
                        managerRole: selectedManager?.role || "employee",
                        updatedAt: serverTimestamp()
                    };

                    if (hasLocation) dataToSave.location = normalizeText(formData.location);
                    if (hasPhone) dataToSave.phone = formData.phone.replace(/[^0-9]/g, "");
                    if (hasProduct) dataToSave.product = normalizeText(formData.product);

                    // Sync Customer Last Consult Date
                    const customerRef = doc(db, "customers", customer.id);
                    transaction.update(customerRef, {
                        lastConsultDate: formData.date,
                        updatedAt: serverTimestamp()
                    });

                    if (activityId) {
                        if (activitySnap?.exists()) {
                            const oldData = activitySnap.data() as Activity;
                            const oldMemo = oldData.memo || "없음";
                            const newMemo = applyColonStandard(formData.memo || "");

                            if (oldMemo !== newMemo) {
                                const now = new Date();
                                const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}  ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

                                const log = {
                                    time: timeStr,
                                    manager: userData?.uid || "unknown",
                                    managerName: userData?.name || "알 수 없음",
                                    content: `(변경전) ${oldMemo} → (변경후) ${newMemo}`
                                };

                                dataToSave.modificationHistory = [...(oldData.modificationHistory || []), log];
                            }
                        }
                        transaction.update(activityRef, dataToSave);
                    } else {
                        // Sync sequence number based on pairing (v124.81)
                        let nextSeq = activities.filter(a => a.type === reportType).length + 1;
                        if (reportType === "as_complete") {
                            const lastSchedule = [...(activities || [])].reverse().find(a => a.type === "as_schedule");
                            if (lastSchedule) nextSeq = lastSchedule.sequenceNumber || nextSeq;
                        } else if (reportType === "demo_complete") {
                            // Note: useDemoCompleteForm usually handles this, but StandardReportForm is a fallback
                            const lastSchedule = [...(activities || [])].reverse().find(a => a.type === "demo_schedule");
                            if (lastSchedule) nextSeq = lastSchedule.sequenceNumber || nextSeq;
                        }

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
                });
                // Delay for Firestore indexing (v123.03)
                await new Promise(resolve => setTimeout(resolve, 500));
                await queryClient.invalidateQueries({ queryKey: ["activities", customer.id] });
                await queryClient.invalidateQueries({ queryKey: ["customer", customer.id] });
                await queryClient.invalidateQueries({ queryKey: ["customers"] });
                toast({ title: "저장 성공", status: "success", duration: 2000, position: "top" });
                return true;
            } catch (error: any) {
                console.error("Standard Report Logic Failure:", error);
                toast({ title: "저장 실패", description: error.message, status: "error", position: "top" });
                return false;
            } finally { setIsLoading(false); }
        },
        delete: async () => {
            if (!activityId) return false;
            if (!window.confirm("해당 데이터 삭제를 희망하십니까?")) return false;

            setIsLoading(true);
            try {
                await runTransaction(db, async (transaction) => {
                    const activityRef = doc(db, "activities", activityId);
                    const metaRef = doc(db, "customer_meta", `${customer.id}_${reportType}`);
                    const metaSnap = await transaction.get(metaRef);

                    if (metaSnap.exists()) {
                        transaction.update(metaRef, {
                            totalCount: Math.max(0, (Number(metaSnap.data().totalCount) || 0) - 1),
                            lastDeletedAt: serverTimestamp()
                        });
                    }
                    transaction.delete(activityRef);
                });
                // Delay for Firestore indexing
                await new Promise(resolve => setTimeout(resolve, 500));
                await queryClient.invalidateQueries({ queryKey: ["activities", customer.id] });
                await queryClient.invalidateQueries({ queryKey: ["customer", customer.id] });
                await queryClient.invalidateQueries({ queryKey: ["customers"] });
                toast({ title: "삭제 성공", status: "info", duration: 2000, position: "top" });
                return true;
            } catch (error) { return false; } finally { setIsLoading(false); }
        }
    }));

    if (isLoading) return (
        <Flex justify="center" align="center" py={10}>
            <VStack spacing={4}>
                <Spinner color="brand.500" />
                <Text fontWeight="medium" color="brand.600">처리 중...</Text>
            </VStack>
        </Flex>
    );

    return (
        <Box position="relative">
            {/* Focus Guard */}
            <Box ref={silentRef} tabIndex={0} position="absolute" top="-100px" left="-100px" opacity={0} pointerEvents="none" />
            <VStack spacing={6} align="stretch">
                <HStack spacing={4}>
                    <FormControl isRequired isReadOnly={isReadOnly} flex={1}>
                        <TeasyFormLabel>날짜 및 시간</TeasyFormLabel>
                        {isReadOnly ? (
                            <TeasyInput value={formData.date} isReadOnly />
                        ) : (
                            <TeasyDateTimeInput
                                value={formData.date}
                                onChange={(val: string) => setFormData({ ...formData, date: val })}
                                limitType={reportType.includes("schedule") ? "past" : (reportType.includes("complete") ? "future" : undefined)}
                            />
                        )}
                    </FormControl>

                    <FormControl isRequired isReadOnly={isReadOnly} flex={1}>
                        <TeasyFormLabel>담당자</TeasyFormLabel>
                        {isReadOnly ? (
                            <TeasyInput
                                value={managerOptions.find(o => o.value === formData.manager)?.label || formData.manager}
                                isReadOnly
                            />
                        ) : (
                            <CustomSelect
                                options={managerOptions}
                                value={formData.manager}
                                onChange={(val) => setFormData({ ...formData, manager: val })}
                                placeholder="담당자 선택"
                                isDisabled={isReadOnly}
                            />
                        )}
                    </FormControl>
                </HStack>

                {hasLocation && (
                    <FormControl isReadOnly={isReadOnly}>
                        <TeasyFormLabel>{reportType.includes("schedule") ? "장소" : "방문처"}</TeasyFormLabel>
                        <TeasyInput
                            value={formData.location}
                            onChange={(e) => setFormData({ ...formData, location: normalizeText(e.target.value) })}
                            placeholder="주소를 입력하세요"
                            isReadOnly={isReadOnly}
                        />
                    </FormControl>
                )}

                <HStack spacing={4}>
                    {hasPhone && (
                        <FormControl isReadOnly={isReadOnly} flex={1}>
                            <TeasyFormLabel>현장 연락처</TeasyFormLabel>
                            {isReadOnly ? (
                                <TeasyInput value={formatPhone(formData.phone)} isReadOnly />
                            ) : (
                                <TeasyPhoneInput
                                    value={formData.phone}
                                    onChange={(val: string) => setFormData({ ...formData, phone: val })}
                                    placeholder="010-0000-0000"
                                />
                            )}
                        </FormControl>
                    )}

                    {hasProduct && (
                        <FormControl isReadOnly={isReadOnly} flex={1}>
                            <TeasyFormLabel>품목</TeasyFormLabel>
                            <TeasyInput
                                value={formData.product}
                                onChange={(e: any) => setFormData({ ...formData, product: normalizeText(e.target.value) })}
                                placeholder="상품명을 입력하세요"
                                isReadOnly={isReadOnly}
                            />
                        </FormControl>
                    )}
                </HStack>

                <FormControl isReadOnly={isReadOnly}>
                    <TeasyFormLabel>보고 내용</TeasyFormLabel>
                    <TeasyTextarea
                        value={formData.memo}
                        onChange={(e: any) => setFormData({ ...formData, memo: e.target.value })}
                        placeholder="업무 상세 내용을 입력하세요."
                        minH="150px"
                        isDisabled={isReadOnly}
                    />
                </FormControl>
            </VStack>
        </Box>
    );
});

StandardReportForm.displayName = "StandardReportForm";
