"use client";
import React from 'react';
import { Box, Flex, Heading, Skeleton, Button, VStack, HStack, IconButton, Text } from "@chakra-ui/react";
import { ArrowBackIcon, AddIcon } from "@chakra-ui/icons";
import { useRouter } from "next/navigation";
import { TimelineCard } from "@/components/features/customer/TimelineCard";
import { ReportSelectionModal } from "@/components/features/customer/ReportSelectionModal";
import { ReportDetailModal } from "@/components/features/customer/ReportDetailModal";
import { AdminCommentRoom } from "@/components/features/customer/AdminCommentRoom";
import { TeasyButton } from "@/components/common/UIComponents";
import { ProfileEditModal } from "@/components/features/customer/ProfileEditModal";
import { useCustomerDetail } from "./hooks/useCustomerDetail";
import { CustomerProfileCard } from "./components/CustomerProfileCard";
import { formatTimestamp } from "@/utils/formatter";

export default function CustomerDetailPage({ params: paramsPromise }: { params: any }) {
    const {
        id, customer, activities, isLoading, userStatusMap,
        selectedActivity, isConfirmationMode, editModalData,
        selectionDisclosure, detailDisclosure, editDisclosure,
        handleActivityClick, handleEditOpen, lastActivityDate
    } = useCustomerDetail(paramsPromise);

    const router = useRouter();

    if (isLoading) {
        return (
            <Box p={8} bg="gray.50" minH="100vh">
                <VStack spacing={6} align="stretch">
                    <Skeleton h="40px" w="200px" />
                    <Skeleton h="250px" borderRadius="2xl" />
                    <Skeleton h="100px" w="150px" />
                </VStack>
            </Box>
        );
    }

    if (!customer) {
        return (
            <Box p={8} bg="gray.50" minH="100vh" textAlign="center">
                <Heading>고객 정보를 찾을 수 없습니다.</Heading>
                <Button mt={4} onClick={() => router.back()}>뒤로 가기</Button>
            </Box>
        );
    }

    return (
        <Box p={8} bg="gray.50" minH="100vh" position="relative" pb={20}>

            <Flex
                align="center" mb={8} onClick={() => router.back()} cursor="pointer"
                transition="all 0.2s cubic-bezier(0.4, 0, 0.2, 1)" w="fit-content" role="button"
                _hover={{ transform: "translateY(-1px)", "& > *": { color: "brand.500" } }}
            >
                <ArrowBackIcon boxSize={5} color="gray.600" mr={2} transition="all 0.2s" />
                <Heading size="md" color="gray.500" transition="all 0.2s">고객 상세 정보</Heading>
            </Flex>

            <CustomerProfileCard
                customer={customer}
                lastActivityDate={lastActivityDate || undefined}
                onEdit={handleEditOpen}
                onActivityClick={handleActivityClick}
                latestActivity={activities.length > 0 ? activities[activities.length - 1] : null}
            />

            <Flex gap={20} align="center" mb={6}>
                <Box flex={7}>
                    <HStack spacing={3} align="center">
                        <Heading size="md" color="gray.500">진행 타임라인</Heading>
                        <IconButton
                            icon={<AddIcon boxSize={3} />}
                            aria-label="신규 보고서 작성"
                            bg="brand.500"
                            color="white"
                            size="xs" w="22px" h="22px" minW="22px" borderRadius="full" shadow="md"
                            onClick={selectionDisclosure.onOpen}
                            _hover={{ bg: "brand.600", transform: "translateY(-1px)" }}
                            _active={{ transform: "scale(0.95)" }}
                            type="button"
                        />
                    </HStack>
                </Box>
                <Box flex={3} opacity={activities.length === 0 ? 0.4 : 1} transition="all 0.3s">
                    <Heading size="md" color="gray.500">담당자 코멘트</Heading>
                </Box>
            </Flex>

            <VStack spacing={0} align="stretch" w="full">
                <Flex gap={20} align="stretch">
                    <Box flex={7} minW={0}>
                        <Box position="relative" pl={8} _before={{ content: '""', position: "absolute", left: "3.5px", top: 0, bottom: 0, width: "2px", bg: "gray.200" }}>
                            <VStack spacing={8} align="stretch">
                                {activities.length > 0 ? activities.map((activity, idx) => {
                                    const typeCount = activities.slice(0, idx + 1).filter(a => a.type === activity.type).length;
                                    const isBanned = userStatusMap[activity.manager] === 'banned';
                                    return (
                                        <TimelineCard
                                            key={activity.id}
                                            onTitleClick={() => handleActivityClick(activity, false)}
                                            item={{
                                                id: activity.id,
                                                stepType: activity.type as any,
                                                createdAt: formatTimestamp(activity.createdAt),
                                                createdBy: activity.createdBy || "system",
                                                createdByName: activity.createdByName || activity.managerName || "담당자 미지정",
                                                managerName: activity.managerName || activity.createdByName,
                                                managerRole: isBanned ? 'banned' : activity.managerRole,
                                                content: activity,
                                                customerName: activity.customerName || customer.name,
                                                count: typeCount
                                            }}
                                        />
                                    );
                                }) : (
                                    <Box p={8} bg="white" borderRadius="xl" border="1px" borderColor="gray.100" shadow="sm">
                                        <Heading size="xs" color="gray.400" textAlign="center">기록된 활동이 없습니다.</Heading>
                                    </Box>
                                )}
                            </VStack>
                        </Box>
                    </Box>

                    <Box flex={3} minW={0} position="relative">
                        <Box
                            position="absolute" top={0} bottom={0} left={0} right={0}
                            opacity={activities.length === 0 ? 0.3 : 1}
                            filter={activities.length === 0 ? "grayscale(1)" : "none"}
                            pointerEvents={activities.length === 0 ? "none" : "auto"}
                            transition="all 0.3s ease"
                        >
                            <AdminCommentRoom customerId={id} />
                        </Box>
                        {activities.length === 0 && (
                            <Flex position="absolute" top={0} bottom={0} left={0} right={0} align="center" justify="center" zIndex={1}>
                                <Text fontSize="xs" fontWeight="bold" color="gray.400" textAlign="center" bg="gray.50" px={4} py={2} borderRadius="full" shadow="sm">
                                    활동 기록이 없어 코멘트를 작성할 수 없습니다.
                                </Text>
                            </Flex>
                        )}
                    </Box>
                </Flex>

                <Flex gap={20} w="full">
                    <Box flex={7}>
                        <Flex justify="flex-end" mt={4}>
                            <TeasyButton leftIcon={<AddIcon boxSize={3} />} onClick={selectionDisclosure.onOpen} shadow="sm">신규 보고서 작성</TeasyButton>
                        </Flex>
                    </Box>
                    <Box flex={3} />
                </Flex>
            </VStack>

            <ProfileEditModal
                isOpen={editDisclosure.isOpen} onClose={editDisclosure.onClose}
                customerId={id} label={editModalData.label} field={editModalData.field} initialValues={editModalData.values}
            />
            <ReportSelectionModal isOpen={selectionDisclosure.isOpen} onClose={selectionDisclosure.onClose} customer={customer} activities={activities} />
            <ReportDetailModal
                isOpen={detailDisclosure.isOpen} onClose={detailDisclosure.onClose}
                customer={customer} activity={selectedActivity} activities={activities} isConfirmationMode={isConfirmationMode}
            />
        </Box>
    );
}
