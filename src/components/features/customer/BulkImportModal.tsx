// src/components/features/customer/BulkImportModal.tsx
"use client";
import React, { useState, useRef } from "react";
import {
    Box,
    VStack,
    HStack,
    Text,
    Icon,
    Progress,
    useToast,
    IconButton,
} from "@chakra-ui/react";
import { ArrowBackIcon, DownloadIcon, AttachmentIcon } from "@chakra-ui/icons";
import {
    TeasyButton,
    TeasyModal,
    TeasyModalOverlay,
    TeasyModalContent,
    TeasyModalHeader,
    TeasyModalBody,
    TeasyModalFooter,
} from "@/components/common/UIComponents";
import { generateBulkTemplate } from "@/utils/bulkTemplateGenerator";
import { useBulkImport, BulkImportResult } from "@/hooks/useBulkImport";

interface BulkImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onResult: (result: BulkImportResult) => void;
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({
    isOpen,
    onClose,
    onResult,
}) => {
    const [file, setFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { importCustomers, progress, isProcessing } = useBulkImport();
    const toast = useToast();

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        if (!selected) return;

        if (!selected.name.endsWith(".xlsx") && !selected.name.endsWith(".xls")) {
            toast({
                title: "파일 형식 오류",
                description: "엑셀 파일(.xlsx)만 업로드 가능합니다.",
                status: "warning",
                duration: 3000,
                isClosable: true,
            });
            return;
        }

        setFile(selected);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const dropped = e.dataTransfer.files?.[0];
        if (!dropped) return;

        if (!dropped.name.endsWith(".xlsx") && !dropped.name.endsWith(".xls")) {
            toast({
                title: "파일 형식 오류",
                description: "엑셀 파일(.xlsx)만 업로드 가능합니다.",
                status: "warning",
                duration: 3000,
                isClosable: true,
            });
            return;
        }

        setFile(dropped);
    };

    const handleImport = async () => {
        if (!file) return;
        try {
            const result = await importCustomers(file);
            onResult(result);
            onClose();
            setFile(null);
        } catch {
            toast({
                title: "등록 실패",
                description: "일괄 등록 중 오류가 발생했습니다.",
                status: "error",
                duration: 5000,
                isClosable: true,
            });
        }
    };

    const handleClose = () => {
        if (isProcessing) return;
        setFile(null);
        onClose();
    };

    return (
        <TeasyModal isOpen={isOpen} onClose={handleClose} size="md">
            <TeasyModalOverlay />
            <TeasyModalContent>
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
                        onClick={handleClose}
                        type="button"
                        isDisabled={isProcessing}
                    />
                    <Box as="span">
                        일괄 등록
                    </Box>
                </TeasyModalHeader>

                <TeasyModalBody>
                    <Box tabIndex={0} w={0} h={0} opacity={0} position="absolute" />
                    <VStack spacing={6}>
                        {/* 템플릿 다운로드 */}
                        <Box w="100%">
                            <Text fontSize="sm" fontWeight="600" color="gray.700" mb={2}>
                                표준 양식 다운로드
                            </Text>
                            <TeasyButton
                                version="secondary"
                                borderColor="rgba(16, 124, 65, 0.3)"
                                color="#107C41"
                                _hover={{ bg: "rgba(16, 124, 65, 0.1)" }}
                                onClick={generateBulkTemplate}
                                w="100%"
                                fontWeight="500"
                                leftIcon={<DownloadIcon />}
                            >
                                TEASY_CRM_일괄등록_양식.xlsx
                            </TeasyButton>
                        </Box>

                        {/* 파일 업로드 */}
                        <Box w="100%">
                            <Text fontSize="sm" fontWeight="600" color="gray.700" mb={2}>
                                파일 업로드
                            </Text>
                            <Box
                                border="2px dashed"
                                borderColor={file ? "brand.300" : "gray.200"}
                                borderRadius="xl"
                                p={8}
                                textAlign="center"
                                cursor="pointer"
                                bg={file ? "brand.50" : "gray.50"}
                                transition="all 0.2s"
                                _hover={{ borderColor: "brand.300", bg: "brand.50" }}
                                onClick={() => fileInputRef.current?.click()}
                                onDrop={handleDrop}
                                onDragOver={(e) => e.preventDefault()}
                            >
                                <Icon as={AttachmentIcon} boxSize={6} color={file ? "brand.500" : "gray.400"} mb={2} />
                                {file ? (
                                    <Text fontSize="sm" color="brand.600" fontWeight="600">
                                        {file.name}
                                    </Text>
                                ) : (
                                    <VStack spacing={1}>
                                        <Text fontSize="sm" color="gray.500">
                                            클릭 또는 파일을 드래그하세요
                                        </Text>
                                        <Text fontSize="xs" color="gray.400">
                                            .xlsx 형식만 지원
                                        </Text>
                                    </VStack>
                                )}
                            </Box>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx,.xls"
                                onChange={handleFileSelect}
                                style={{ display: "none" }}
                            />
                        </Box>

                        {/* 진행률 */}
                        {isProcessing && (
                            <Box w="100%">
                                <HStack justify="space-between" mb={1}>
                                    <Text fontSize="xs" color="gray.500">등록 진행률</Text>
                                    <Text fontSize="xs" color="brand.500" fontWeight="600">{progress}%</Text>
                                </HStack>
                                <Progress
                                    value={progress}
                                    size="sm"
                                    colorScheme="purple"
                                    borderRadius="full"
                                    hasStripe
                                    isAnimated
                                />
                            </Box>
                        )}
                    </VStack>
                </TeasyModalBody>

                <TeasyModalFooter>
                    <TeasyButton
                        version="secondary"
                        onClick={handleClose}
                        w="108px"
                        h="45px"
                        isDisabled={isProcessing}
                    >
                        취소
                    </TeasyButton>
                    <TeasyButton
                        onClick={handleImport}
                        isLoading={isProcessing}
                        isDisabled={!file || isProcessing}
                        w="108px"
                        h="45px"
                        shadow="brand-lg"
                    >
                        등록
                    </TeasyButton>
                </TeasyModalFooter>
            </TeasyModalContent>
        </TeasyModal>
    );
};
