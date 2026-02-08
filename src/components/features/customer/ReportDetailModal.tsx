// src/components/features/customer/ReportDetailModal.tsx
"use client";
import { useRef, useState } from "react";
import { Box, Flex, Spacer, Text, useToast, Spinner, VStack, IconButton } from "@chakra-ui/react";
import { ArrowBackIcon } from "@chakra-ui/icons";
import { isWithinBusinessDays } from "@/utils/dateUtils";
import { InquiryForm } from "./reports/InquiryForm/index";
import { StandardReportForm } from "./reports/StandardReportForm/index";
import { DemoScheduleForm } from "./reports/DemoScheduleForm/index";
import { DemoCompleteForm } from "./reports/DemoCompleteForm/index";
import { PurchaseConfirmForm } from "./reports/PurchaseConfirmForm/index";
import { InstallScheduleForm } from "./reports/InstallScheduleForm/index";
import { InstallCompleteForm } from "./reports/InstallCompleteForm/index";
import { AsScheduleForm } from "./reports/AsScheduleForm/index";
import { AsCompleteForm } from "./reports/AsCompleteForm/index";
import { RemoteAsCompleteForm } from "./reports/RemoteAsCompleteForm/index";
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
    activity: Activity | null;
    isDashboardView?: boolean;
    isConfirmationMode?: boolean;
    activities?: Activity[];
    onCreateWorkRequest?: (activity: Activity) => void;
}

import { useReportMetadata } from "@/hooks/useReportMetadata";

const ReportDetailModalContent = ({ onClose, customer, activity, activities = [], isDashboardView, isConfirmationMode, onCreateWorkRequest }: { onClose: () => void, customer: Customer, activity: Activity, activities: Activity[], isDashboardView?: boolean, isConfirmationMode?: boolean, onCreateWorkRequest?: (activity: Activity) => void }) => {
    const { userData } = useAuth();
    const { holidayMap } = useReportMetadata();
    const formRef = useRef<any>(null);
    const toast = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const isProcessing = useRef(false);

    // Permissions Logic
    const isAuthor = userData?.uid === activity.createdBy;
    const isMaster = userData?.role === 'master';
    const isAdmin = userData?.role === 'admin';

    // Business Day Logic (Author/Admin can edit within 3 days)
    const createdAt = activity.createdAt?.toDate ? activity.createdAt.toDate() : new Date(activity.createdAt || Date.now());
    const isWithinEditTime = isWithinBusinessDays(createdAt, 3, holidayMap);

    // Permissions Logic (v124.83)
    // Master: Always edit. Author or Admin: Within 3 business days.
    const canEdit = !isDashboardView && !isConfirmationMode && (
        isMaster || ((isAuthor || isAdmin) && isWithinEditTime)
    );
    const isReadOnly = !canEdit;
    const canDelete = isMaster; // Only Super Admin can delete (v124.82)

    // Check if this modal is being opened from a Work Request
    const isWorkRequest = activity.category !== undefined; // work_requests documents usually have 'category'

    const handleSave = async () => {
        if (formRef.current && !isSaving) {
            setIsSaving(true);
            try {
                const success = await formRef.current.submit();
                if (success) onClose();
            } finally {
                setIsSaving(false);
            }
        }
    };

    const handleDelete = async () => {
        if (!canDelete) {
            toast({ title: "권한 없음", description: "삭제 권한이 없습니다.", status: "error", position: "top" });
            return;
        }

        if (formRef.current) {
            const success = await formRef.current.delete();
            if (success) onClose();
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
            activities, // Pass full activity list for cross-form auto-fill
            activityId: activity.id,
            reportType: activity.type,
            reportLabel: activity.typeName || activity.type,
            initialData: { ...activity, ...(activity.content || {}) },
            isReadOnly
        };

        if (activity.type === "inquiry") return <InquiryForm {...commonProps} />;
        if (activity.type === "demo_schedule") return <DemoScheduleForm {...commonProps} />;
        if (activity.type === "demo_complete") return <DemoCompleteForm {...commonProps} />;
        if (activity.type === "purchase_confirm") return <PurchaseConfirmForm {...commonProps} />;
        if (activity.type === "install_schedule") return <InstallScheduleForm {...commonProps} />;
        if (activity.type === "install_complete") return <InstallCompleteForm {...commonProps} />;
        if (activity.type === "as_schedule") return <AsScheduleForm {...commonProps} />;
        if (activity.type === "as_complete") return <AsCompleteForm {...commonProps} />;
        if (activity.type === "remoteas_complete") return <RemoteAsCompleteForm {...commonProps} />;
        return <StandardReportForm {...commonProps} />;
    };

    return (
        <TeasyModalContent position="relative">
            {isSaving && (
                <Flex position="absolute" top={0} left={0} right={0} bottom={0} bg="whiteAlpha.800" zIndex={100} align="center" justify="center" borderRadius="2xl" backdropFilter="blur(2px)">
                    <VStack spacing={4}>
                        <Spinner size="xl" color="brand.500" thickness="4px" />
                        <Text fontWeight="medium" color="brand.600">처리 중...</Text>
                    </VStack>
                </Flex>
            )}
            <TeasyModalHeader position="relative">
                <IconButton
                    aria-label="Back"
                    icon={<ArrowBackIcon />}
                    size="md"
                    position="absolute"
                    left="8px"
                    top="8px"
                    color="white"
                    variant="ghost"
                    _hover={{ bg: "whiteAlpha.300" }}
                    onClick={onClose}
                    type="button"
                />
                <Box as="span" ml={10}>
                    {activity.typeName || "업무 요청"}
                    <span style={{ fontWeight: 300, marginLeft: '4px' }}>(</span>{isReadOnly ? "확인" : "수정"}<span style={{ fontWeight: 300 }}>)</span>
                </Box>
            </TeasyModalHeader>
            <TeasyModalBody
                p={8}
                maxH="calc(100vh - 250px)"
                overflowY="auto"
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
                            <TeasyButton onClick={() => onCreateWorkRequest && onCreateWorkRequest(activity)} w="130px" h="45px">업무 요청서 작성</TeasyButton>
                        )}
                        <Spacer />
                        <TeasyButton version="secondary" onClick={onClose} w="108px" h="45px">닫기</TeasyButton>
                    </>
                ) : (
                    <>
                        {canDelete && (
                            <TeasyButton
                                version="danger"
                                onClick={handleDelete}
                                w="108px"
                                h="45px"
                                mr={canEdit ? 0 : 4}
                            >
                                삭제
                            </TeasyButton>
                        )}
                        <Spacer />
                        {canEdit ? (
                            <>
                                <TeasyButton version="secondary" onClick={onClose} w="108px" h="45px" isDisabled={isSaving}>취소</TeasyButton>
                                <TeasyButton onClick={handleSave} w="108px" h="45px" isLoading={isSaving}>저장</TeasyButton>
                            </>
                        ) : (
                            <TeasyButton version="secondary" onClick={onClose} w="108px" h="45px">닫기</TeasyButton>
                        )}
                    </>
                )}
            </TeasyModalFooter>
        </TeasyModalContent>
    );
};

export const ReportDetailModal = ({ isOpen, onClose, customer, activity, activities = [], isDashboardView, isConfirmationMode, onCreateWorkRequest }: ReportDetailModalProps) => {
    if (!activity || !isOpen) return null;

    return (
        <TeasyModal isOpen={isOpen} onClose={onClose} size="lg">
            <TeasyModalOverlay />
            <ReportDetailModalContent
                onClose={onClose}
                customer={customer}
                activity={activity}
                activities={activities}
                isDashboardView={isDashboardView}
                isConfirmationMode={isConfirmationMode}
                onCreateWorkRequest={onCreateWorkRequest}
            />
        </TeasyModal>
    );
};
