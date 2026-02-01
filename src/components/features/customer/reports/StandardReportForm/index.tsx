"use client";
import React, { forwardRef, useImperativeHandle, useState, useEffect } from "react";
import { VStack, FormControl, Box, Spinner, HStack, useToast, Flex } from "@chakra-ui/react";
import { CustomSelect } from "@/components/common/CustomSelect";
import { TeasyDateTimeInput, TeasyFormLabel, TeasyInput, TeasyTextarea } from "@/components/common/UIComponents";
import { useAuth } from "@/context/AuthContext";
import { useReportMetadata } from "@/hooks/useReportMetadata";
import { db } from "@/lib/firebase";
import {
    doc, updateDoc, deleteDoc, collection, addDoc,
    serverTimestamp, query, where, getDocs, runTransaction
} from "firebase/firestore";
import { applyColonStandard } from "@/utils/textFormatter";
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
    isReadOnly = false,
    defaultManager = "",
    reportType = "standard",
    reportLabel = "일반 업무"
}, ref) => {
    const { userData } = useAuth();
    const toast = useToast();
    const { managerOptions } = useReportMetadata();
    const [isLoading, setIsLoading] = useState(false);

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
            setFormData(prev => ({
                ...prev,
                date: formattedDate,
                manager: prev.manager || defaultManager,
                location: prev.location || customer?.address || "",
                phone: prev.phone || customer?.phone || ""
            }));
        }
    }, [initialData, defaultManager, customer]);

    useImperativeHandle(ref, () => ({
        submit: async () => {
            if (!formData.manager || !formData.memo) {
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
                    let currentMeta = metaSnap.exists() ? metaSnap.data() as { lastSequence: number, totalCount: number } : { lastSequence: 0, totalCount: 0 };

                    const dataToSave: Partial<Activity> = {
                        customerId: customer.id,
                        customerName: customer?.name || "",
                        type: reportType as any, // Cast to avoid literal match error if passed dynamic string
                        typeName: reportLabel,
                        date: formData.date,
                        manager: formData.manager,
                        memo: applyColonStandard(formData.memo || ""),
                        managerName: selectedManager?.label || formData.manager,
                        managerRole: selectedManager?.role || "employee",
                        updatedAt: serverTimestamp(),
                        createdByName: userData?.name || "알 수 없음"
                    };

                    if (hasLocation) dataToSave.location = formData.location;
                    if (hasPhone) dataToSave.phone = formData.phone;
                    if (hasProduct) dataToSave.product = formData.product;

                    // Sync Customer Last Consult Date
                    const customerRef = doc(db, "customers", customer.id);
                    transaction.update(customerRef, {
                        lastConsultDate: formData.date,
                        updatedAt: serverTimestamp()
                    });

                    if (activityId) {
                        transaction.update(activityRef, dataToSave);
                    } else {
                        const nextSeq = (Number(currentMeta.lastSequence) || 0) + 1;
                        transaction.set(activityRef, {
                            ...dataToSave,
                            sequenceNumber: nextSeq,
                            createdAt: serverTimestamp(),
                            createdBy: userData?.uid
                        });
                        transaction.set(metaRef, {
                            lastSequence: nextSeq,
                            totalCount: (Number(currentMeta.totalCount) || 0) + 1,
                            lastUpdatedAt: serverTimestamp()
                        }, { merge: true });
                    }
                });

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
            if (!window.confirm(`정말 이 [${reportLabel}] 보고서를 삭제하시겠습니까?`)) return false;

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
                toast({ title: "삭제 성공", status: "info", duration: 2000, position: "top" });
                return true;
            } catch (error) { return false; } finally { setIsLoading(false); }
        }
    }));

    if (isLoading) return <Flex justify="center" align="center" py={10}><Spinner color="brand.500" /></Flex>;

    return (
        <VStack spacing={6} align="stretch">
            <HStack spacing={4}>
                <FormControl isRequired isReadOnly={isReadOnly} flex={1}>
                    <TeasyFormLabel>날짜 및 시간</TeasyFormLabel>
                    <TeasyDateTimeInput
                        value={formData.date}
                        onChange={(val: string) => setFormData({ ...formData, date: val })}
                        isDisabled={isReadOnly}
                    />
                </FormControl>

                <FormControl isRequired isReadOnly={isReadOnly} flex={1}>
                    <TeasyFormLabel>담당자</TeasyFormLabel>
                    <CustomSelect
                        options={managerOptions}
                        value={formData.manager}
                        onChange={(val) => setFormData({ ...formData, manager: val })}
                        placeholder="담당자 선택"
                        isDisabled={isReadOnly}
                    />
                </FormControl>
            </HStack>

            {hasLocation && (
                <FormControl isReadOnly={isReadOnly}>
                    <TeasyFormLabel>{reportType.includes("schedule") ? "장소" : "방문처"}</TeasyFormLabel>
                    <TeasyInput
                        value={formData.location}
                        onChange={(e: any) => setFormData({ ...formData, location: e.target.value })}
                        placeholder="장소 또는 상세 주소 입력"
                        isDisabled={isReadOnly}
                        _readOnly={{ bg: "gray.50", cursor: "default", color: "gray.600" }}
                    />
                </FormControl>
            )}

            <HStack spacing={4}>
                {hasPhone && (
                    <FormControl isReadOnly={isReadOnly} flex={1}>
                        <TeasyFormLabel>현장 연락처</TeasyFormLabel>
                        <TeasyInput
                            value={formData.phone}
                            onChange={(e: any) => setFormData({ ...formData, phone: e.target.value })}
                            placeholder="010-0000-0000"
                            isDisabled={isReadOnly}
                            _readOnly={{ bg: "gray.50", cursor: "default", color: "gray.600" }}
                        />
                    </FormControl>
                )}

                {hasProduct && (
                    <FormControl isReadOnly={isReadOnly} flex={1}>
                        <TeasyFormLabel>관련 상품</TeasyFormLabel>
                        <TeasyInput
                            value={formData.product}
                            onChange={(e: any) => setFormData({ ...formData, product: e.target.value })}
                            placeholder="예: Teasy CRM, 스마트 도어락"
                            isDisabled={isReadOnly}
                            _readOnly={{ bg: "gray.50", cursor: "default", color: "gray.600" }}
                        />
                    </FormControl>
                )}
            </HStack>

            <FormControl isRequired isReadOnly={isReadOnly}>
                <TeasyFormLabel>보고 내용</TeasyFormLabel>
                <TeasyTextarea
                    value={formData.memo}
                    onChange={(e: any) => setFormData({ ...formData, memo: e.target.value })}
                    placeholder="업무 상세 내용을 입력하세요."
                    minH="150px"
                    isDisabled={isReadOnly}
                    _readOnly={{ bg: "gray.50", cursor: "default", color: "gray.600" }}
                />
            </FormControl>
        </VStack>
    );
});

StandardReportForm.displayName = "StandardReportForm";
