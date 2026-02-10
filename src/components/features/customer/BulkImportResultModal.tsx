// src/components/features/customer/BulkImportResultModal.tsx
"use client";
import React from "react";
import {
    Box, VStack, HStack, Text, Icon,
    Badge, Divider, List, ListItem,
} from "@chakra-ui/react";
import { CheckCircleIcon, WarningIcon, DownloadIcon } from "@chakra-ui/icons";
import {
    TeasyButton,
    TeasyModal,
    TeasyModalOverlay,
    TeasyModalContent,
    TeasyModalHeader,
    TeasyModalBody,
    TeasyModalFooter,
} from "@/components/common/UIComponents";
import { BulkImportResult } from "@/hooks/useBulkImport";

interface BulkImportResultModalProps {
    isOpen: boolean;
    onClose: () => void;
    result: BulkImportResult | null;
    onDownloadFailed: () => void;
}

export const BulkImportResultModal: React.FC<BulkImportResultModalProps> = ({
    isOpen,
    onClose,
    result,
    onDownloadFailed,
}) => {
    if (!result) return null;

    const hasErrors = result.errorCount > 0;
    const hasSuccess = result.newCount > 0 || result.mergedCount > 0 || result.reportCount > 0;

    return (
        <TeasyModal isOpen={isOpen} onClose={onClose} size="md">
            <TeasyModalOverlay />
            <TeasyModalContent>
                <TeasyModalHeader>
                    <Box as="span">일괄 등록 결과</Box>
                </TeasyModalHeader>

                <TeasyModalBody>
                    <Box tabIndex={0} w={0} h={0} opacity={0} position="absolute" />
                    <VStack spacing={5} align="stretch">
                        {/* 성공 요약 */}
                        {hasSuccess && (
                            <Box
                                bg="green.50"
                                border="1px solid"
                                borderColor="green.200"
                                borderRadius="xl"
                                p={4}
                            >
                                <HStack spacing={2} mb={3}>
                                    <Icon as={CheckCircleIcon} color="green.500" />
                                    <Text fontWeight="700" fontSize="sm" color="green.700">
                                        등록 완료
                                    </Text>
                                </HStack>
                                <VStack spacing={1} align="stretch" pl={6}>
                                    {result.newCount > 0 && (
                                        <Text fontSize="sm" color="gray.700">
                                            신규 고객 <Badge colorScheme="green" ml={1}>{result.newCount}명</Badge>
                                        </Text>
                                    )}
                                    {result.mergedCount > 0 && (
                                        <Text fontSize="sm" color="gray.700">
                                            기존 고객 병합 <Badge colorScheme="blue" ml={1}>{result.mergedCount}건</Badge>
                                        </Text>
                                    )}
                                    {result.reportCount > 0 && (
                                        <Text fontSize="sm" color="gray.700">
                                            보고서 등록 <Badge colorScheme="purple" ml={1}>{result.reportCount}건</Badge>
                                        </Text>
                                    )}
                                </VStack>
                            </Box>
                        )}

                        {/* 중복 병합 상세 */}
                        {result.mergedList.length > 0 && (
                            <Box>
                                <Text fontSize="xs" fontWeight="600" color="gray.500" mb={2}>
                                    병합된 고객 목록
                                </Text>
                                <Box
                                    maxH="120px"
                                    overflowY="auto"
                                    bg="gray.50"
                                    borderRadius="lg"
                                    p={3}
                                    border="1px solid"
                                    borderColor="gray.100"
                                >
                                    <List spacing={1}>
                                        {result.mergedList.map((m, i) => (
                                            <ListItem key={i} fontSize="xs" color="gray.600">
                                                {m.name} ({m.phone})
                                            </ListItem>
                                        ))}
                                    </List>
                                </Box>
                            </Box>
                        )}

                        {/* 실패 건 */}
                        {hasErrors && (
                            <>
                                <Divider />
                                <Box
                                    bg="red.50"
                                    border="1px solid"
                                    borderColor="red.200"
                                    borderRadius="xl"
                                    p={4}
                                >
                                    <HStack spacing={2} mb={3}>
                                        <Icon as={WarningIcon} color="red.500" />
                                        <Text fontWeight="700" fontSize="sm" color="red.700">
                                            실패 {result.errorCount}건
                                        </Text>
                                    </HStack>
                                    <Box
                                        maxH="100px"
                                        overflowY="auto"
                                        pl={6}
                                    >
                                        <List spacing={1}>
                                            {result.errors.slice(0, 20).map((err, i) => (
                                                <ListItem key={i} fontSize="xs" color="red.600">
                                                    {err}
                                                </ListItem>
                                            ))}
                                            {result.errors.length > 20 && (
                                                <ListItem fontSize="xs" color="red.400">
                                                    외 {result.errors.length - 20}건...
                                                </ListItem>
                                            )}
                                        </List>
                                    </Box>

                                    {/* 실패 데이터 다운로드 */}
                                    {result.failedRows.length > 0 && (
                                        <TeasyButton
                                            version="secondary"
                                            size="sm"
                                            mt={3}
                                            w="100%"
                                            borderColor="rgba(229, 62, 62, 0.3)"
                                            color="red.600"
                                            _hover={{ bg: "red.100" }}
                                            leftIcon={<DownloadIcon />}
                                            onClick={onDownloadFailed}
                                        >
                                            실패 데이터 다운로드
                                        </TeasyButton>
                                    )}
                                </Box>
                            </>
                        )}
                    </VStack>
                </TeasyModalBody>

                <TeasyModalFooter>
                    <TeasyButton
                        onClick={onClose}
                        w="108px"
                        h="45px"
                        shadow="brand-lg"
                    >
                        확인
                    </TeasyButton>
                </TeasyModalFooter>
            </TeasyModalContent>
        </TeasyModal>
    );
};
