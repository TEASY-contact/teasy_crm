"use client";
import React from "react";
import { Box, VStack, HStack, Text, Badge } from "@chakra-ui/react";
import { applyColonStandard } from "@/utils/textFormatter";

interface ReportFile {
    id: string;
    url: string;
    name?: string;
    displayName?: string;
}

interface ReportFileListProps {
    files: ReportFile[];
    type: string; // 'recording' | 'quote'
    isReadOnly?: boolean;
    onConfirm: (file: ReportFile) => void;
    onDelete: (fileId: string) => void;
}

/**
 * Standardized File List for Report Forms.
 * Includes synchronized ActionBadge styles (gray.100, 4px radius).
 */
export const ReportFileList = ({
    files,
    type,
    isReadOnly = false,
    onConfirm,
    onDelete
}: ReportFileListProps) => {

    const triggerDownload = async (file: ReportFile) => {
        try {
            const response = await fetch(file.url, { cache: 'no-cache' });
            if (!response.ok) throw new Error('Network response was not ok');
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = file.displayName || file.name || "download";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
            window.open(file.url, '_blank');
        }
    };

    if (!files || files.length === 0) return null;

    return (
        <VStack align="stretch" spacing={2} mt={2}>
            {files.map((file) => (
                <HStack key={file.id} spacing={3} p={1} align="center">
                    <Box flex="0 1 auto" isTruncated fontSize="12px" color="gray.700" fontWeight="medium">
                        {(() => {
                            let name = file.displayName || file.name || "파일";
                            if (name.includes('.')) {
                                const parts = name.split('.');
                                parts.pop();
                                name = parts.join('.');
                            }
                            return applyColonStandard(name);
                        })()}
                    </Box>
                    <HStack spacing={1.5} flexShrink={0}>
                        <Badge
                            as="button"
                            bg="gray.100"
                            color="gray.500"
                            fontSize="10px"
                            px={2}
                            h="18px"
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                            borderRadius="4px"
                            cursor="pointer"
                            transition="all 0.2s"
                            _hover={{ bg: "gray.500", color: "white" }}
                            onClick={(e) => {
                                e.stopPropagation();
                                onConfirm(file);
                            }}
                            fontWeight="bold"
                            textTransform="none"
                        >
                            확인
                        </Badge>
                        <Text color="gray.300" fontSize="10px" fontWeight="bold">/</Text>
                        <Badge
                            as="button"
                            bg="gray.100"
                            color="gray.500"
                            fontSize="10px"
                            px={2}
                            h="18px"
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                            borderRadius="4px"
                            cursor="pointer"
                            transition="all 0.2s"
                            _hover={{ bg: "gray.500", color: "white" }}
                            onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                triggerDownload(file);
                            }}
                            fontWeight="bold"
                            textTransform="none"
                        >
                            다운로드
                        </Badge>
                        {!isReadOnly && (
                            <>
                                <Text color="gray.300" fontSize="10px" fontWeight="bold">/</Text>
                                <Badge
                                    as="button"
                                    bg="gray.100"
                                    color="red.400"
                                    fontSize="10px"
                                    px={2}
                                    h="18px"
                                    display="flex"
                                    alignItems="center"
                                    justifyContent="center"
                                    borderRadius="4px"
                                    cursor="pointer"
                                    transition="all 0.2s"
                                    _hover={{ bg: "red.400", color: "white" }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDelete(file.id);
                                    }}
                                    fontWeight="bold"
                                    textTransform="none"
                                >
                                    삭제
                                </Badge>
                            </>
                        )}
                    </HStack>
                </HStack>
            ))}
        </VStack>
    );
};
