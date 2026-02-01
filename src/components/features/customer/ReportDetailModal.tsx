// src/components/features/customer/ReportDetailModal.tsx
"use client";
import { useRef } from "react";
import { Box, Flex, Spacer, Text, useToast } from "@chakra-ui/react";
import { isWithinBusinessDays } from "@/utils/dateUtils";
import { InquiryForm } from "./reports/InquiryForm/index";
import { StandardReportForm } from "./reports/StandardReportForm/index";
import { DemoScheduleForm } from "./reports/DemoScheduleForm/index";
import { DemoCompleteForm } from "./reports/DemoCompleteForm/index";
import { PurchaseConfirmForm } from "./reports/PurchaseConfirmForm/index";
import { Activity, Customer } from "@/types/domain";
import {
    TeasyButton,
    TeasyModalHeader,
    TeasyModalOverlay,
    TeasyModalContent,
    TeasyModalBody,
    TeasyModalFooter,
    TeasyModal
} from "@/components/common/UIComponents";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";

interface ReportDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    customer: Customer;
    activity: Activity;
    isDashboardView?: boolean;
    isConfirmationMode?: boolean;
}

const ReportDetailModalContent = ({ onClose, customer, activity, isDashboardView, isConfirmationMode }: { onClose: () => void, customer: Customer, activity: Activity, isDashboardView?: boolean, isConfirmationMode?: boolean }) => {
    const { userData } = useAuth();
    const formRef = useRef<any>(null);
    const toast = useToast();
    const isProcessing = useRef(false);

    // Permissions Logic
    const isAuthor = userData?.uid === activity.createdBy;
    const isMaster = userData?.role === 'master';

    // Business Day Logic (Author can edit within 3 days)
    const createdAt = activity.createdAt?.toDate ? activity.createdAt.toDate() : new Date(activity.createdAt || Date.now());
    const isWithinEditTime = isWithinBusinessDays(createdAt, 3);

    // Forced read-only if it's dashboard view or explicit confirmation mode
    // Master can always edit. Author can edit only within 3 business days. Others cannot edit.
    let canEdit = false;

    if (isDashboardView || isConfirmationMode) {
        canEdit = false;
    } else if (isMaster) {
        canEdit = true;
    } else if (isAuthor) {
        canEdit = isWithinEditTime;
    } else {
        canEdit = false;
    }

    const isReadOnly = !canEdit;

    // Check if this modal is being opened from a Work Request
    const isWorkRequest = activity.category !== undefined; // work_requests documents usually have 'category'

    const handleSave = async () => {
        if (formRef.current) {
            const success = await formRef.current.submit();
            if (success) onClose();
        }
    };

    const handleDelete = async () => {
        if (window.confirm("정말 이 보고서를 삭제하시겠습니까?")) {
            if (formRef.current) {
                const success = await formRef.current.delete();
                if (success) onClose();
            }
        }
    };

    const handleReviewRequest = async () => {
        if (!activity.id || isProcessing.current) return;
        isProcessing.current = true;
        try {
            const docRef = doc(db, "work_requests", activity.id);
            await updateDoc(docRef, { status: "reviewing" });
            toast({
                title: "검토 요청 완료",
                description: "업무가 검토 요청 상태로 변경되었습니다.",
                status: "success",
                duration: 2000,
            });
            onClose();
        } catch (error) {
            console.error("Review Request Error:", error);
        } finally {
            isProcessing.current = false;
        }
    };

    const renderForm = () => {
        const commonProps = {
            ref: formRef,
            customer,
            activityId: activity.id,
            reportType: activity.type,
            reportLabel: activity.typeName || activity.type,
            initialData: activity.content || activity,
            isReadOnly
        };

        if (activity.type === "inquiry") return <InquiryForm {...commonProps} />;
        if (activity.type === "demo_schedule") return <DemoScheduleForm {...commonProps} />;
        if (activity.type === "demo_complete") return <DemoCompleteForm {...commonProps} />;
        if (activity.type === "purchase_confirm") return <PurchaseConfirmForm {...commonProps} />;
        return <StandardReportForm {...commonProps} />;
    };

    return (
        <TeasyModalContent>
            <TeasyModalHeader>
                {activity.typeName || "업무 요청"} 보고서
                <span style={{ fontWeight: 300, marginLeft: '4px' }}>(</span>{isReadOnly ? "확인" : "수정"}<span style={{ fontWeight: 300 }}>)</span>
            </TeasyModalHeader>
            <TeasyModalBody
                p={8}
                maxH="calc(100vh - 250px)"
                overflowY="auto"
                css={{
                    '&::-webkit-scrollbar': { width: '4px' },
                    '&::-webkit-scrollbar-track': { background: 'transparent' },
                    '&::-webkit-scrollbar-thumb': {
                        background: 'rgba(0,0,0,0.08)',
                        borderRadius: '10px'
                    },
                    '&::-webkit-scrollbar-thumb:hover': { background: 'rgba(0,0,0,0.15)' },
                }}
            >
                {/* Focus Guard: Prevent initial focus from jumping to the first active button (like File Confirm) */}
                <Box tabIndex={0} w={0} h={0} opacity={0} position="absolute" />
                {renderForm()}
            </TeasyModalBody>
            <TeasyModalFooter>
                {isDashboardView ? (
                    <>
                        {isWorkRequest && (
                            <TeasyButton
                                bg="brand.500"
                                color="white"
                                onClick={handleReviewRequest}
                                w="108px"
                                h="45px"
                                _hover={{ bg: "brand.600" }}
                            >
                                검토 요청
                            </TeasyButton>
                        )}
                        {!isWorkRequest && (
                            <TeasyButton version="secondary" onClick={() => { }} w="130px" h="45px">업무 요청서 작성</TeasyButton>
                        )}
                        <Spacer />
                        <TeasyButton onClick={onClose} w="108px" h="45px">닫기</TeasyButton>
                    </>
                ) : (
                    <>
                        {canEdit && (
                            <>
                                <TeasyButton
                                    version="danger"
                                    variant="outline"
                                    fontWeight="400"
                                    borderColor="rgba(229, 62, 62, 0.3)"
                                    bg="rgba(229, 62, 62, 0.02)"
                                    _hover={{
                                        bg: "rgba(229, 62, 62, 0.08)",
                                        borderColor: "red.500"
                                    }}
                                    onClick={handleDelete}
                                >
                                    삭제
                                </TeasyButton>
                                <Spacer />
                                <TeasyButton version="secondary" onClick={onClose} w="108px" h="45px">취소</TeasyButton>
                                <TeasyButton onClick={handleSave} w="108px" h="45px">저장</TeasyButton>
                            </>
                        )}
                        {!canEdit && (
                            <>
                                <Spacer />
                                <TeasyButton onClick={onClose} w="108px" h="45px">닫기</TeasyButton>
                            </>
                        )}
                    </>
                )}
            </TeasyModalFooter>
        </TeasyModalContent>
    );
};

export const ReportDetailModal = ({ isOpen, onClose, customer, activity, isDashboardView, isConfirmationMode }: ReportDetailModalProps) => {
    if (!activity || !isOpen) return null;

    return (
        <TeasyModal isOpen={isOpen} onClose={onClose} size="lg">
            <TeasyModalOverlay />
            <ReportDetailModalContent
                onClose={onClose}
                customer={customer}
                activity={activity}
                isDashboardView={isDashboardView}
                isConfirmationMode={isConfirmationMode}
            />
        </TeasyModal>
    );
};
