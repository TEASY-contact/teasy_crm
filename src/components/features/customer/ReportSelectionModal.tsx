// src/components/features/customer/ReportSelectionModal.tsx
"use client";
import { FormControl, IconButton, Box, VStack, Flex, Spinner, Text } from "@chakra-ui/react";
import { ArrowBackIcon } from "@chakra-ui/icons";
import { CustomSelect } from "@/components/common/CustomSelect";
import { InquiryForm } from "./reports/InquiryForm/index";
import { PurchaseConfirmForm } from "./reports/PurchaseConfirmForm/index";
import { StandardReportForm } from "./reports/StandardReportForm/index";
import { DemoScheduleForm } from "./reports/DemoScheduleForm/index";
import { DemoCompleteForm } from "./reports/DemoCompleteForm/index";
import { InstallScheduleForm } from "./reports/InstallScheduleForm/index";
import { InstallCompleteForm } from "./reports/InstallCompleteForm/index";
import { AsScheduleForm } from "./reports/AsScheduleForm/index";
import { AsCompleteForm } from "./reports/AsCompleteForm/index";
import { RemoteAsCompleteForm } from "./reports/RemoteAsCompleteForm/index";
import { TeasyButton, TeasyModalHeader, TeasyModalOverlay, TeasyModalContent, TeasyModalBody, TeasyModalFooter, TeasyModal } from "@/components/common/UIComponents";
import React, { forwardRef, useImperativeHandle, useRef, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";

/**
 * Sub-component to handle report selection and writing logic.
 * Unmounts when modal is closed, naturally resetting all internal state.
 */
const ReportSelectionModalContent = ({ onClose, customer, activities = [] }: { onClose: () => void, customer: any, activities: any[] }) => {
    const { userData, user } = useAuth();
    const [selectedReport, setSelectedReport] = useState("");
    const [isWriting, setIsWriting] = useState(false);
    const [defaultManager, setDefaultManager] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const formRef = useRef<any>(null);

    const reports = [
        { value: "inquiry", label: "신규 문의" },
        { value: "divider1", isDivider: true },
        { value: "demo_schedule", label: "시연 확정" },
        { value: "demo_complete", label: "시연 완료" },
        { value: "divider2", isDivider: true },
        { value: "purchase_confirm", label: "구매 확정" },
        { value: "install_schedule", label: "시공 확정" },
        { value: "install_complete", label: "시공 완료" },
        { value: "divider3", isDivider: true },
        { value: "as_schedule", label: "방문 A/S 확정" },
        { value: "as_complete", label: "방문 A/S 완료" },
        { value: "divider4", isDivider: true },
        { value: "remoteas_complete", label: "원격 A/S 완료" },
    ];

    const getReportLabel = (val: string) => reports.find(r => r.value === val)?.label || "";

    const getDefaultManager = (type: string) => {
        const currentUid = userData?.uid || user?.uid || "";
        switch (type) {
            case "inquiry":
            case "purchase_confirm":
            case "remoteas_complete":
                return currentUid;
            case "demo_schedule":
            case "install_schedule":
            case "as_schedule":
                return "";
            case "demo_complete": {
                return activities.find((a: any) => a.type === "demo_schedule")?.manager || currentUid;
            }
            case "install_complete": {
                return activities.find((a: any) => a.type === "install_schedule")?.manager || currentUid;
            }
            case "as_complete": {
                return activities.find((a: any) => a.type === "as_schedule")?.manager || currentUid;
            }
            default:
                return currentUid;
        }
    };

    // Update defaultManager reactively when dependencies change
    useEffect(() => {
        if (selectedReport) {
            setDefaultManager(getDefaultManager(selectedReport));
        }
    }, [selectedReport, userData, user, activities]);

    // Count occurrences of each activity type (v123.01)
    const typeCounts = activities.reduce((acc: any, curr: any) => {
        acc[curr.type] = (acc[curr.type] || 0) + 1;
        return acc;
    }, {});

    const hasInquiry = typeCounts['inquiry'] > 0;
    const hasPurchase = typeCounts['purchase_confirm'] > 0;
    const hasBaseActivity = hasInquiry || hasPurchase;

    // Check for "unmatched" schedules to allow completions
    const canCompleteDemo = (typeCounts['demo_schedule'] || 0) > (typeCounts['demo_complete'] || 0);

    // Install Schedule can be created only if there are unmatched 'Installation' purchases
    // Fallback: If productCategory is missing, treat as 'product' (installation) for backward compatibility (v124.75)
    const installationPurchaseCount = activities.filter(a =>
        a.type === 'purchase_confirm' && (a.productCategory === 'product' || !a.productCategory)
    ).length;
    const canScheduleInstall = installationPurchaseCount > (typeCounts['install_schedule'] || 0);

    const canCompleteInstall = (typeCounts['install_schedule'] || 0) > (typeCounts['install_complete'] || 0);
    const canCompleteAS = (typeCounts['as_schedule'] || 0) > (typeCounts['as_complete'] || 0);

    const isReportDisabled = (val: string) => {
        // Installation workflow activation: (v124.78)
        // Install Schedule needs 'Purchase Confirm (product)', Install Complete needs 'Install Schedule'.
        // These can be the starting flow even without 'Inquiry'.
        if (val === "install_schedule") return !canScheduleInstall;
        if (val === "install_complete") return !canCompleteInstall;

        // Base entry-level reports
        if (val === 'inquiry' || val === 'demo_schedule' || val === 'purchase_confirm') return false;

        // Other downstream reports require 'Inquiry'
        if (!hasInquiry) return true;

        switch (val) {
            case "demo_complete": return !canCompleteDemo;
            case "as_complete": return !canCompleteAS;
            default: return false;
        }
    };

    const getDisabledReason = (val: string) => {
        if (!hasInquiry && val !== 'inquiry') return "먼저 '신규 문의'를 등록해야 합니다.";
        switch (val) {
            case "demo_complete": return !canCompleteDemo ? "'시연 확정' 기록이 필요합니다." : "";
            case "install_schedule": return !canScheduleInstall ? "'구매 확정' 기록이 필요합니다." : "";
            case "install_complete": return !canCompleteInstall ? "'시공 확정' 기록이 필요합니다." : "";
            case "as_complete": return !canCompleteAS ? "'방문 A/S 확정' 기록이 필요합니다." : "";
            default: return "";
        }
    };

    const handleWriteReport = () => {
        if (selectedReport && !isReportDisabled(selectedReport)) {
            setIsWriting(true);
        }
    };

    const handleSave = async () => {
        if (formRef.current && !isSaving) {
            setIsSaving(true);
            try {
                const success = await formRef.current.submit();
                if (success) onClose();
            } finally {
                setIsSaving(false);
            }
        } else if (!isSaving) {
            onClose();
        }
    };

    const renderForm = () => {
        const label = getReportLabel(selectedReport);
        const props = {
            ref: formRef,
            customer,
            activities,
            defaultManager
        };
        switch (selectedReport) {
            case "inquiry":
                return <InquiryForm {...props} />;
            case "demo_schedule":
                return <DemoScheduleForm {...props} />;
            case "purchase_confirm":
                return <PurchaseConfirmForm {...props} />;
            case "demo_complete":
                return <DemoCompleteForm {...props} />;
            case "install_schedule":
                return <InstallScheduleForm {...props} />;
            case "install_complete":
                return <InstallCompleteForm {...props} />;
            case "as_schedule":
                return <AsScheduleForm {...props} />;
            case "as_complete":
                return <AsCompleteForm {...props} />;
            case "remoteas_complete":
                return <RemoteAsCompleteForm {...props} />;
            default:
                return (
                    <StandardReportForm
                        {...props}
                        reportType={selectedReport}
                        reportLabel={label}
                    />
                );
        }
    };

    const getHeaderTitle = () => {
        if (!isWriting) return "보고서 선택";
        return getReportLabel(selectedReport);
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
                {isWriting && (
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
                        onClick={() => setIsWriting(false)}
                        type="button"
                    />
                )}
                {getHeaderTitle()}
            </TeasyModalHeader>
            <TeasyModalBody p={!isWriting ? 0 : 8}>
                {/* Focus Guard */}
                <Box tabIndex={0} w={0} h={0} opacity={0} position="absolute" />
                {!isWriting ? (
                    <Box maxH="400px" overflowY="auto">
                        <VStack spacing={0} align="stretch" py={2}>
                            {reports.map((report) => {
                                if (report.isDivider) {
                                    return <Box key={report.value} borderTop="1px solid" borderColor="gray.100" my={1.3} mx={8} />;
                                }
                                const disabled = isReportDisabled(report.value);
                                const reason = getDisabledReason(report.value);
                                return (
                                    <Box
                                        key={report.value}
                                        px={8}
                                        py={1.5}
                                        cursor={disabled ? "default" : "pointer"}
                                        bg={selectedReport === report.value ? "gray.50" : "transparent"}
                                        color={disabled ? "gray.300" : (selectedReport === report.value ? "brand.600" : "gray.700")}
                                        _hover={!disabled ? { bg: "gray.50" } : {}}
                                        onClick={() => !disabled && setSelectedReport(report.value)}
                                        onDoubleClick={() => {
                                            if (!disabled) {
                                                setSelectedReport(report.value);
                                                setIsWriting(true);
                                            }
                                        }}
                                        display="flex"
                                        alignItems="center"
                                        justifyContent="space-between"
                                        fontSize="15px"
                                        fontWeight={selectedReport === report.value ? "bold" : "medium"}
                                        transition="all 0.2s"
                                        title={reason}
                                    >
                                        <Flex align="center">
                                            <Box as="span" color={disabled ? "gray.200" : "blue.400"} mr={3} fontSize="lg">·</Box>
                                            {report.label}
                                        </Flex>
                                    </Box>
                                );
                            })}
                        </VStack>
                    </Box>
                ) : (
                    renderForm()
                )}
            </TeasyModalBody>
            <TeasyModalFooter>
                <TeasyButton version="secondary" onClick={onClose} w="108px" h="45px" isDisabled={isSaving}>취소</TeasyButton>
                <TeasyButton
                    onClick={isWriting ? handleSave : handleWriteReport}
                    isDisabled={!selectedReport}
                    isLoading={isSaving}
                    w="108px"
                    h="45px"
                >
                    {isWriting ? "저장" : "보고서 작성"}
                </TeasyButton>
            </TeasyModalFooter>
        </TeasyModalContent>
    );
};

export const ReportSelectionModal = ({ isOpen, onClose, customer, activities = [] }: any) => {
    return (
        <TeasyModal
            isOpen={isOpen}
            onClose={onClose}
            size="lg"
        >
            <TeasyModalOverlay />
            <ReportSelectionModalContent onClose={onClose} customer={customer} activities={activities} />
        </TeasyModal>
    );
};
