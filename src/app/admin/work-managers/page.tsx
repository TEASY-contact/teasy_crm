// src/app/admin/work-managers/page.tsx
"use client";
import React, { useState, useEffect } from "react";
import {
    Box, VStack, HStack, Heading, Text,
    IconButton, Flex, SimpleGrid, Icon, Divider, useToast, Spinner, Center
} from "@chakra-ui/react";
import {
    MdArrowBack, MdReceipt, MdEventNote, MdFilter1, MdMoreHoriz, MdLocalShipping, MdClose, MdSave
} from "react-icons/md";
import { useRouter } from "next/navigation";
import { useReportMetadata } from "@/hooks/useReportMetadata";
import { CustomSelect } from "@/components/common/CustomSelect";
import { useWorkManagerSettings, WorkManagerSettings } from "@/hooks/useWorkManagerSettings";
import { TeasyButton, PageHeader } from "@/components/common/UIComponents";

export default function WorkManagersPage() {
    const router = useRouter();
    const toast = useToast();
    const { managerOptions, isLoadingMetadata } = useReportMetadata();
    const { settings, saveSettings, isLoading: isLoadingSettings } = useWorkManagerSettings();

    // Local state for UI
    const [localSettings, setLocalSettings] = useState<WorkManagerSettings>({});
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (settings) {
            setLocalSettings(settings);
        }
    }, [settings]);

    const handleManagerChange = (key: keyof WorkManagerSettings, value: string) => {
        if (value === "divider") return;
        setLocalSettings(prev => ({ ...prev, [key]: value }));
    };

    const handleClearManager = (key: keyof WorkManagerSettings) => {
        setLocalSettings(prev => ({ ...prev, [key]: undefined }));
    };

    const handleSave = async () => {
        if (!localSettings.bizRegistrationManagerId || !localSettings.taxInvoiceManagerId) {
            toast({
                title: "설정 저장 불가",
                description: "사업자등록증 확보 및 전자세금계산서 발급 담당자는 필수로 지정해야 합니다.",
                status: "error",
                duration: 3000,
                position: "top"
            });
            return;
        }

        setIsSaving(true);
        try {
            await saveSettings(localSettings);
            toast({
                title: "설정 저장 완료",
                status: "success",
                duration: 2000,
                position: "top"
            });
        } catch (e) {
            toast({
                title: "설정 저장 실패",
                status: "error",
                duration: 2000,
                position: "top"
            });
        } finally {
            setIsSaving(false);
        }
    };

    const getManagerDisplay = (id?: string) => {
        if (!id) return null;
        return managerOptions.find(m => m.value === id);
    };

    const SelectedManagerItem = ({ managerId, itemKey }: { managerId?: string, itemKey: keyof WorkManagerSettings }) => {
        const manager = getManagerDisplay(managerId);
        if (!manager) return (
            <Text fontSize="xs" color="gray.400" textAlign="center" py={4}>
                지정된 담당자가 없습니다.
            </Text>
        );

        return (
            <HStack
                justify="space-between"
                bg="gray.50"
                p={2}
                px={3}
                borderRadius="lg"
                border="1px"
                borderColor="gray.100"
                mt={1}
            >
                <HStack spacing={2}>
                    <Box w="8px" h="8px" borderRadius="full" bg={manager.representativeColor || "gray.300"} />
                    <Text fontSize="sm" fontWeight="bold" color="gray.700">{manager.label}</Text>
                </HStack>
                <IconButton
                    aria-label="remove-manager"
                    icon={<MdClose />}
                    size="xs"
                    variant="ghost"
                    color="gray.400"
                    onClick={() => handleClearManager(itemKey)}
                    _hover={{ color: "red.500", bg: "red.50" }}
                />
            </HStack>
        );
    };

    const ManagerCard = ({ title, icon, children }: { title: string, icon: any, children?: React.ReactNode }) => (
        <Box
            bg="white"
            p={5}
            borderRadius="2xl"
            shadow="sm"
            border="1px"
            borderColor="gray.100"
            h="420px"
            display="flex"
            flexDirection="column"
        >
            <VStack align="stretch" spacing={5} h="full">
                <Box borderBottom="1px" borderColor="gray.100" pb={3}>
                    <Text fontSize="md" fontWeight="bold" color="gray.700">{title}</Text>
                </Box>

                <Box flex={1}>
                    {children ? children : (
                        <Flex h="full" align="center" justify="center" flexDirection="column" opacity={0.3}>
                            <Icon as={icon} fontSize="4xl" mb={2} />
                            <Text fontSize="sm">설정 항목이 준비 중입니다.</Text>
                        </Flex>
                    )}
                </Box>
            </VStack>
        </Box>
    );

    if (isLoadingMetadata || isLoadingSettings) {
        return (
            <Center h="100vh" bg="gray.50">
                <VStack spacing={4}>
                    <Spinner size="xl" color="brand.500" thickness="4px" />
                    <Text color="gray.500" fontWeight="medium">설정 데이터를 불러오는 중...</Text>
                </VStack>
            </Center>
        );
    }

    return (
        <Box p={0} bg="gray.50" minH="100vh">
            {/* Header */}
            <Box px={8} pt={8}>
                <PageHeader title="업무 담당자 관리">
                    <IconButton
                        aria-label="Back"
                        icon={<MdArrowBack />}
                        variant="ghost"
                        onClick={() => router.push("/admin")}
                    />
                    <TeasyButton
                        leftIcon={<MdSave />}
                        onClick={handleSave}
                        isLoading={isSaving}
                        px={8}
                    >
                        설정 저장
                    </TeasyButton>
                </PageHeader>
            </Box>

            <SimpleGrid columns={{ base: 1, lg: 5 }} spacing={6} px={8}>
                {/* 1. Tax/Biz Card */}
                <ManagerCard title="사업자등록증 확보" icon={MdReceipt}>
                    <VStack align="stretch" spacing={3} mt={3}>
                        <CustomSelect
                            placeholder="담당자 선택"
                            value={localSettings.bizRegistrationManagerId || ""}
                            onChange={(val) => handleManagerChange("bizRegistrationManagerId", val)}
                            options={managerOptions}
                        />
                        <Box minH="50px">
                            <SelectedManagerItem
                                managerId={localSettings.bizRegistrationManagerId}
                                itemKey="bizRegistrationManagerId"
                            />
                        </Box>

                        <Divider borderColor="gray.100" my={2} />

                        <Box pb={1}>
                            <Text fontSize="md" fontWeight="bold" color="gray.700">전자세금계산서 발급</Text>
                        </Box>

                        <CustomSelect
                            placeholder="담당자 선택"
                            value={localSettings.taxInvoiceManagerId || ""}
                            onChange={(val) => handleManagerChange("taxInvoiceManagerId", val)}
                            options={managerOptions}
                        />
                        <Box minH="50px">
                            <SelectedManagerItem
                                managerId={localSettings.taxInvoiceManagerId}
                                itemKey="taxInvoiceManagerId"
                            />
                        </Box>
                    </VStack>
                </ManagerCard>

                {/* 2. Shipping Card */}
                <ManagerCard title="배송 · 송장 발급" icon={MdLocalShipping}>
                    <VStack align="stretch" spacing={4} mt={3}>
                        <CustomSelect
                            placeholder="담당자 선택"
                            value={localSettings.nthFollowupManagerId || ""} // Reusing for now or add new keys
                            onChange={(val) => handleManagerChange("nthFollowupManagerId", val)}
                            options={managerOptions}
                        />
                        <SelectedManagerItem
                            managerId={localSettings.nthFollowupManagerId}
                            itemKey="nthFollowupManagerId"
                        />
                    </VStack>
                </ManagerCard>

                {/* 3. Schedule Card */}
                <ManagerCard title="일정 안내 · 만족도 조사" icon={MdEventNote}>
                    <VStack align="stretch" spacing={4} mt={3}>
                        <CustomSelect
                            placeholder="담당자 선택"
                            value={localSettings.scheduleManagerId || ""}
                            onChange={(val) => handleManagerChange("scheduleManagerId", val)}
                            options={managerOptions}
                        />
                        <SelectedManagerItem
                            managerId={localSettings.scheduleManagerId}
                            itemKey="scheduleManagerId"
                        />
                    </VStack>
                </ManagerCard>

                {/* 4. 1st Followup Card */}
                <ManagerCard title="1차 후속 관리" icon={MdFilter1}>
                    <VStack align="stretch" spacing={4} mt={3}>
                        <CustomSelect
                            placeholder="담당자 선택"
                            value={localSettings.firstFollowupManagerId || ""}
                            onChange={(val) => handleManagerChange("firstFollowupManagerId", val)}
                            options={managerOptions}
                        />
                        <SelectedManagerItem
                            managerId={localSettings.firstFollowupManagerId}
                            itemKey="firstFollowupManagerId"
                        />
                    </VStack>
                </ManagerCard>

                {/* 5. Nth Followup Card */}
                <ManagerCard title="N차 후속 관리" icon={MdMoreHoriz} />
            </SimpleGrid>
        </Box>
    );
}
