// src/app/admin/settings/page.tsx
"use client";
import React, { useState } from "react";
import {
    Box, VStack, HStack, Heading, Text,
    useToast, IconButton, Flex, Spinner,
    FormControl, SimpleGrid, useDisclosure,
    Modal, ModalOverlay, ModalContent, ModalHeader,
    ModalBody, ModalFooter, Circle, Center,
    Icon
} from "@chakra-ui/react";
import {
    MdAdd, MdRemove, MdArrowBack, MdHorizontalRule,
    MdMenu
} from "react-icons/md";
import { useRouter } from "next/navigation";
import { Reorder } from "framer-motion";
import {
    TeasyButton, TeasyInput, TeasyFormLabel,
} from "@/components/common/UIComponents";
import { useDistributorMaster, DistributorItem } from "@/hooks/useDistributorMaster";

const COLOR_THEMES = [
    { bg: "rgba(107, 70, 193, 0.1)", color: "#6B46C1" }, // Purple
    { bg: "rgba(213, 63, 140, 0.1)", color: "#D53F8C" },  // Pink
    { bg: "rgba(229, 62, 62, 0.1)", color: "#E53E3E" },   // Red
    { bg: "rgba(221, 107, 32, 0.1)", color: "#DD6B20" },  // Orange
    { bg: "rgba(214, 158, 46, 0.1)", color: "#D69E2E" },  // Yellow
    { bg: "rgba(56, 161, 105, 0.1)", color: "#38A169" },  // Green
    { bg: "rgba(49, 130, 206, 0.1)", color: "#3182CE" },  // Blue
    { bg: "rgba(49, 151, 149, 0.1)", color: "#319795" },  // Teal
    { bg: "rgba(0, 184, 212, 0.1)", color: "#00B8D4" },   // Cyan
    { bg: "rgba(43, 108, 176, 0.1)", color: "#2B6CB0" },  // Indigo
    { bg: "rgba(128, 90, 213, 0.15)", color: "#805AD5" }, // Light Purple
    { bg: "rgba(151, 38, 109, 0.1)", color: "#97266D" },  // Maroon
    { bg: "rgba(123, 52, 30, 0.1)", color: "#7B341E" },   // Deep Orange
    { bg: "rgba(34, 84, 61, 0.1)", color: "#22543D" },    // Dark Green
    { bg: "rgba(44, 82, 130, 0.1)", color: "#2C5282" },   // Navy
    { bg: "rgba(255, 107, 107, 0.1)", color: "#FF6B6B" }, // Salmon
    { bg: "rgba(78, 205, 196, 0.1)", color: "#4ECDC4" },  // Mint
    { bg: "rgba(255, 230, 109, 0.15)", color: "#F7B731" }, // Gold
    { bg: "rgba(113, 128, 150, 0.1)", color: "#718096" }, // Gray-Blue
    { bg: "rgba(26, 32, 44, 0.05)", color: "#1A202C" },   // Dark
];

export default function SettingsPage() {
    const router = useRouter();
    const toast = useToast();
    const {
        distributors,
        isLoading,
        addDistributor,
        addDivider,
        removeDistributor,
        updateColor,
        updateOrder
    } = useDistributorMaster();

    const [name, setName] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedTarget, setSelectedTarget] = useState<DistributorItem | null>(null);
    const colorDisclosure = useDisclosure();

    return (
        <Box p={8} bg="gray.50" minH="100vh">
            <VStack align="stretch" spacing={1} mb={10}>
                <Flex align="center">
                    <IconButton
                        aria-label="Back"
                        icon={<MdArrowBack />}
                        variant="ghost"
                        mr={2}
                        onClick={() => router.push("/admin")}
                    />
                    <Heading size="lg" color="gray.700">기타 설정</Heading>
                </Flex>
            </VStack>

            <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={6}>
                {/* 1. Distributor Management Card */}
                <Box
                    bg="white"
                    p={5}
                    borderRadius="2xl"
                    shadow="sm"
                    border="1px"
                    borderColor="gray.100"
                >
                    <VStack align="stretch" spacing={5}>
                        <Box borderBottom="1px" borderColor="gray.100" pb={3}>
                            <Text fontSize="md" fontWeight="bold" color="gray.700">관리 총판 설정</Text>
                        </Box>

                        <FormControl isRequired>
                            <TeasyFormLabel>신규 총판명</TeasyFormLabel>
                            <HStack spacing={2}>
                                <TeasyInput
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="총판명 입력"
                                    onKeyDown={(e) => e.key === 'Enter' && (async () => {
                                        if (!name.trim()) { toast({ title: "총판명을 입력해주세요.", status: "warning", position: "top" }); return; }
                                        setIsSubmitting(true);
                                        try { await addDistributor(name); setName(""); toast({ title: "추가 완료", status: "success", position: "top" }); }
                                        catch (e: any) { toast({ title: e.message || "추가 실패", status: "error", position: "top" }); }
                                        finally { setIsSubmitting(false); }
                                    })()}
                                />
                                <TeasyButton
                                    version="secondary"
                                    borderColor="brand.500"
                                    leftIcon={<MdHorizontalRule />}
                                    onClick={async () => {
                                        setIsSubmitting(true);
                                        try { await addDivider(); toast({ title: "구분선 추가 완료", status: "success", position: "top" }); }
                                        catch (e: any) { toast({ title: "지원되지 않는 항목", status: "error", position: "top" }); }
                                        finally { setIsSubmitting(false); }
                                    }}
                                    isLoading={isSubmitting}
                                    h="45px"
                                    fontSize="12px"
                                    fontWeight="800"
                                    px={3}
                                >
                                    구분선
                                </TeasyButton>
                                <IconButton
                                    aria-label="Add"
                                    icon={<MdAdd size={22} />}
                                    onClick={async () => {
                                        if (!name.trim()) { toast({ title: "총판명을 입력해주세요.", status: "warning", position: "top" }); return; }
                                        setIsSubmitting(true);
                                        try { await addDistributor(name); setName(""); toast({ title: "추가 완료", status: "success", position: "top" }); }
                                        catch (e: any) { toast({ title: e.message || "추가 실패", status: "error", position: "top" }); }
                                        finally { setIsSubmitting(false); }
                                    }}
                                    isLoading={isSubmitting}
                                    h="45px"
                                    w="45px"
                                    colorScheme="brand"
                                    bg="brand.500"
                                    color="white"
                                    borderRadius="md"
                                />
                            </HStack>
                        </FormControl>

                        <Box bg="gray.50" p={2} borderRadius="xl" minH="200px" border="1px" borderColor="gray.100" maxH="400px" overflowY="auto">
                            {isLoading ? (
                                <Center h="100px"><Spinner /></Center>
                            ) : distributors.length === 0 ? (
                                <Center h="100px" color="gray.300" fontSize="xs">등록된 총판이 없습니다.</Center>
                            ) : (
                                <Reorder.Group axis="y" values={distributors} onReorder={updateOrder} style={{ listStyle: "none", padding: 0 }}>
                                    <VStack align="stretch" spacing={2}>
                                        {distributors.map((d) => (
                                            <Reorder.Item key={d.id} value={d} style={{ listStyle: "none" }} onDragEnd={() => toast({ title: "순서가 변경되었습니다.", status: "success", position: "top", duration: 1500 })}>
                                                <HStack justify="space-between" bg={d.isDivider ? "gray.50" : "white"} px={3} py={d.isDivider ? 0 : 1} minH={d.isDivider ? "14px" : "40px"} borderRadius="lg" shadow={d.isDivider ? "none" : "sm"} border="1px solid" borderColor="gray.100">
                                                    <HStack spacing={2} flex={1}>
                                                        <Icon as={MdMenu} color="gray.300" cursor="grab" />
                                                        {d.isDivider ? (
                                                            <Box flex={1} h="1px" bg="gray.200" />
                                                        ) : (
                                                            <HStack spacing={2}>
                                                                <Circle size="12px" bg={d.colorConfig?.bg || "gray.100"} border="1px solid" borderColor={d.colorConfig?.color || "gray.300"} cursor="pointer" onClick={() => { setSelectedTarget(d); colorDisclosure.onOpen(); }} />
                                                                <Text fontSize="xs" color="gray.700" fontWeight="bold">{d.name}</Text>
                                                            </HStack>
                                                        )}
                                                    </HStack>
                                                    <IconButton aria-label="Remove" icon={<MdRemove />} size="xs" variant="ghost" color="gray.300" onClick={async () => {
                                                        if (!window.confirm("정말 삭제하시겠습니까?")) return;
                                                        try { await removeDistributor(d.id); toast({ title: "삭제 완료", status: "info", position: "top" }); }
                                                        catch (e) { toast({ title: "삭제 실패", status: "error", position: "top" }); }
                                                    }} />
                                                </HStack>
                                            </Reorder.Item>
                                        ))}
                                    </VStack>
                                </Reorder.Group>
                            )}
                        </Box>
                    </VStack>
                </Box>
            </SimpleGrid>

            {/* Color Picker Modal */}
            <Modal isOpen={colorDisclosure.isOpen} onClose={colorDisclosure.onClose} isCentered size="sm">
                <ModalOverlay backdropFilter="blur(4px)" />
                <ModalContent borderRadius="2xl">
                    <ModalHeader fontSize="md" pb={0}>배지 색상 설정</ModalHeader>
                    <ModalBody py={6}>
                        <VStack spacing={4} align="stretch">
                            <Text fontSize="xs" color="gray.500">
                                <strong>[{selectedTarget?.name}]</strong> 총판의 배지 테마를 선택하세요.
                            </Text>
                            <SimpleGrid columns={5} spacing={3}>
                                {COLOR_THEMES.map((theme, i) => (
                                    <VStack
                                        key={i}
                                        p={2}
                                        borderRadius="xl"
                                        border="1px solid"
                                        borderColor={selectedTarget?.colorConfig?.bg === theme.bg ? theme.color : "gray.50"}
                                        bg={selectedTarget?.colorConfig?.bg === theme.bg ? theme.bg : "white"}
                                        cursor="pointer"
                                        onClick={async () => {
                                            if (!selectedTarget) return;
                                            try {
                                                await updateColor(selectedTarget.id, { bg: theme.bg, color: theme.color });
                                                colorDisclosure.onClose();
                                                toast({ title: "색상 반영 완료", status: "success", size: "sm", position: "top" });
                                            } catch (e) {
                                                toast({ title: "저장 실패", status: "error" });
                                            }
                                        }}
                                        _hover={{ bg: theme.bg, borderColor: theme.color, transform: "scale(1.1)" }}
                                        transition="all 0.2s"
                                    >
                                        <Circle size="28px" bg={theme.bg} border="1px solid" borderColor={theme.color} />
                                    </VStack>
                                ))}
                            </SimpleGrid>
                        </VStack>
                    </ModalBody>
                    <ModalFooter bg="gray.50" borderBottomRadius="2xl" py={3}>
                        <TeasyButton variant="ghost" onClick={colorDisclosure.onClose} h="32px">닫기</TeasyButton>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </Box>
    );
}
