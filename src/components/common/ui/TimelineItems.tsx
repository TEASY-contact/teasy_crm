"use client";
import React, { useState, useMemo } from "react";
import {
    VStack, Flex, Box, Text, HStack, Badge, Center, type TextProps
} from "@chakra-ui/react";
import { MdFileDownload } from "react-icons/md";
import { TeasyUniversalViewer, TeasyAudioPlayer, triggerTeasyDownload } from "@/components/common/ui/MediaViewer";
import { ThinParen } from "@/components/common/ui/BaseAtoms";

export const TimelineInfoItem = ({ label, value, isHighlight, isSubItem, isFirstSubItem, pl, children, ...props }: any) => {
    const displayValue = typeof value === 'string' && /\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(value)
        ? value.replace(/\s+/, "  ")
        : value;

    return (
        <VStack align="start" spacing={1.5} w="full" pl={isSubItem ? (pl || "16px") : 0} {...props}>
            <Flex align="baseline" gap={0} w="full">
                {isSubItem && (
                    <Center color="gray.400" fontWeight="medium" w="12px" minW="12px" flexShrink={0}>
                        {isFirstSubItem ? "└" : ""}
                    </Center>
                )}
                <Center color="gray.400" fontWeight="medium" w="8px" minW="8px" flexShrink={0}>·</Center>
                <Text color="gray.400" fontWeight="medium" flexShrink={0}>{label}{(displayValue !== undefined && displayValue !== null && displayValue !== "") ? "\u00A0:\u00A0\u00A0" : ""}</Text>
                <Box color={isHighlight ? "brand.500" : "gray.600"} fontWeight={isHighlight ? "bold" : "medium"} whiteSpace="pre-wrap">
                    {displayValue ? (typeof displayValue === 'string' ? <ThinParen text={displayValue} /> : displayValue) : null}
                </Box>
            </Flex>
            {children}
        </VStack>
    );
};

export const TimelineFileList = ({ files, label, isSubItem, isFirstSubItem, uploader, timestamp, pl, showConfirm: manualShowConfirm, ...props }: any) => {
    const [viewerState, setViewerState] = useState({ isOpen: false, index: 0 });
    const [audioState, setAudioState] = useState({ isOpen: false, file: null as any });

    if (!files || files.length === 0) return null;

    // Default: Hide confirm for '영상' (Video) label (v126.86)
    const showConfirm = manualShowConfirm !== undefined ? manualShowConfirm : label !== "영상";

    const formattedTimestamp = typeof timestamp === 'string' && /\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(timestamp)
        ? timestamp.replace(/\s+/, "  ")
        : timestamp;

    const filesWithUploader = useMemo(() =>
        files.map((f: any) => ({ ...f, author: f.author || uploader, timestamp: f.author ? f.timestamp : formattedTimestamp })),
        [files, uploader, formattedTimestamp]
    );

    const handleConfirm = (index: number) => {
        const target = filesWithUploader[index];
        const ext = (target.displayName || target.name || "").split('.').pop()?.toUpperCase() || "";
        const isAudio = ['MP3', 'WAV', 'M4A', 'AAC', 'OGG', 'WMA', 'WEBM'].includes(ext) || label === '녹취';
        if (isAudio) setAudioState({ isOpen: true, file: target });
        else setViewerState({ isOpen: true, index });
    };

    return (
        <VStack align="start" spacing={1.5} w="full" pl={isSubItem ? (pl || "16px") : 0} {...props}>
            <Flex align="baseline" gap={0} fontSize="sm" w="full">
                {isSubItem && (
                    <Center color="gray.400" fontWeight="medium" w="12px" minW="12px" flexShrink={0}>
                        {isFirstSubItem ? "└" : ""}
                    </Center>
                )}
                <Center color="gray.400" fontWeight="medium" w="8px" minW="8px" flexShrink={0}>·</Center>
                <Text color="gray.400" fontWeight="medium" flexShrink={0}>{label}&nbsp;:&nbsp;&nbsp;</Text>

                <Box color="gray.600" fontWeight="medium">
                    {(() => {
                        let name = files.length === 1 ? filesWithUploader[0].displayName : `총 ${files.length}개`;
                        if (files.length === 1 && name.includes('.')) {
                            const parts = name.split('.');
                            parts.pop();
                            name = parts.join('.');
                        }
                        return <ThinParen text={name} />;
                    })()}
                </Box>
                <HStack spacing={1.5} ml={4} align="center">
                    {showConfirm && (
                        <>
                            <Box as="button" type="button" bg="gray.100" color="gray.500" fontSize="10px" px={2} h="18px" borderRadius="4px" cursor="pointer" transition="all 0.2s" _hover={{ bg: "gray.500", color: "white" }} onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleConfirm(0); }} fontWeight="bold" textTransform="none">확인</Box>
                            <Text color="gray.300" fontSize="10px" fontWeight="bold">/</Text>
                        </>
                    )}
                    <Box as="button" type="button" bg="gray.100" color="gray.500" fontSize="10px" px={2} h="18px" borderRadius="4px" cursor="pointer" transition="all 0.2s" _hover={{ bg: "gray.500", color: "white" }} onClick={async (e: any) => { e.stopPropagation(); for (let i = 0; i < filesWithUploader.length; i++) { await triggerTeasyDownload(filesWithUploader[i]); if (i < filesWithUploader.length - 1) await new Promise(r => setTimeout(r, 200)); } }} fontWeight="bold" textTransform="none">다운로드</Box>
                </HStack>
            </Flex>
            <TeasyUniversalViewer
                isOpen={viewerState.isOpen}
                onClose={() => setViewerState({ ...viewerState, isOpen: false })}
                files={filesWithUploader}
                initialIndex={viewerState.index}
                title={label}
            />
            <TeasyAudioPlayer
                isOpen={audioState.isOpen}
                onClose={() => setAudioState({ ...audioState, isOpen: false })}
                file={audioState.file}
            />
        </VStack>
    );
};

export const TimelineBadge = ({ label, count = 1, colorScheme = "purple", ...props }: any) => {
    const hoverBg = colorScheme === "purple" ? "brand.500" : `${colorScheme}.500`;
    return (
        <Badge
            colorScheme={colorScheme} px={2.5} py={1.5} borderRadius="md" textTransform="none" fontSize="sm" fontWeight="700" cursor="pointer" transition="all 0.2s"
            _hover={{ bg: hoverBg, color: "white", shadow: "md", transform: "translateY(-1px)" }}
            _active={{ transform: "translateY(0)", shadow: "sm" }}
            display="inline-flex" alignItems="center" {...props}
        >
            {label}
            {count > 1 && <Text as="span" fontWeight="500" ml={1}><ThinParen text={`(${count})`} /></Text>}
        </Badge>
    );
};
