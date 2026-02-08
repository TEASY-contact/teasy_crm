"use client";
import React, { useRef, useState } from "react";
import {
    Box, Flex, Text, HStack, VStack, Center, Button, IconButton, Modal, ModalOverlay, ModalContent, ModalBody, ModalFooter
} from "@chakra-ui/react";
import { MdFileDownload, MdChevronLeft, MdChevronRight } from "react-icons/md";
import { TeasyButton } from "@/components/common/ui/TeasyButton";
import { ThinParen } from "@/components/common/ui/BaseAtoms";

/**
 * 4. Media Viewing Components (Audio / Video / Image / PDF)
 */

/**
 * Interactive Pan-Zoom Container
 * Provides high-performance dragging and zooming for images and PDFs.
 * Uses native wheel events with passive: false to override browser defaults.
 */
export const PanZoomContainer = ({ children, initialScale = 1, state, setState }: any) => {
    const [isDragging, setIsDragging] = React.useState(false);
    const [lastPos, setLastPos] = React.useState({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleNativeWheel = (e: WheelEvent) => {
            e.preventDefault();
            const delta = -e.deltaY;
            const factor = Math.pow(1.1, delta / 200);

            setState((prev: any) => {
                const newScale = Math.min(Math.max(prev.scale * factor, 0.01), 10);
                return { ...prev, scale: newScale };
            });
        };

        container.addEventListener('wheel', handleNativeWheel, { passive: false });
        return () => container.removeEventListener('wheel', handleNativeWheel);
    }, [setState]);

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setLastPos({ x: e.clientX, y: e.clientY });
        e.preventDefault();
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging) {
            const dx = e.clientX - lastPos.x;
            const dy = e.clientY - lastPos.y;
            setState((prev: any) => ({
                ...prev,
                translateX: prev.translateX + dx,
                translateY: prev.translateY + dy
            }));
            setLastPos({ x: e.clientX, y: e.clientY });
        }
    };

    const handleMouseUp = () => setIsDragging(false);

    return (
        <Box
            ref={containerRef}
            w="full"
            h="full"
            overflow="hidden"
            cursor={isDragging ? "grabbing" : (state.scale > 1 ? "grab" : "default")}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            display="flex"
            alignItems="center"
            justifyContent="center"
            position="relative"
            bg="gray.100"
        >
            <Box position="absolute" top={0} left={0} right={0} bottom={0} zIndex={5} bg="transparent" />
            <Box
                zIndex={1}
                style={{
                    transform: `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`,
                    transition: isDragging ? "none" : "transform 0.1s ease-out",
                    transformOrigin: "center center",
                    pointerEvents: isDragging ? "none" : "auto"
                }}
            >
                {children}
            </Box>
        </Box>
    );
};

/**
 * File Utility Functions (Shared logic for all viewers)
 */
export const getTeasyFileExt = (fileObj: any) => {
    if (!fileObj) return "";

    // 1. Explicit ext property
    if (fileObj.ext) return fileObj.ext.toUpperCase();

    // 2. From name/displayName
    const name = fileObj.displayName || fileObj.name || "";
    const namePart = name.split('?')[0];
    if (namePart.includes('.')) {
        const ext = namePart.split('.').pop()?.toUpperCase();
        if (ext && ext.length <= 5) return ext;
    }

    // 3. From URL
    const url = fileObj.url || "";
    const urlPart = url.split('?')[0];
    if (urlPart.includes('.')) {
        const ext = urlPart.split('.').pop()?.toUpperCase();
        if (ext && ext.length <= 5) return ext;
    }

    // 4. From type property
    if (fileObj.type) {
        if (fileObj.type.includes('/')) return fileObj.type.split('/').pop()?.toUpperCase() || "";
        return fileObj.type.toUpperCase();
    }

    return "";
};

export const getTeasyBaseFileName = (fileObj: any) => {
    let name = fileObj.displayName || fileObj.name || "파일";
    name = name.split('?')[0].split('/').pop() || name;
    if (name.includes('.')) {
        const parts = name.split('.');
        parts.pop();
        name = parts.join('.');
    }
    return name;
};

export const triggerTeasyDownload = async (fileObj: any) => {
    if (!fileObj?.url) return;
    try {
        const response = await fetch(fileObj.url, { cache: 'no-cache' });
        if (!response.ok) throw new Error("Fetch failed");
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);

        let baseName = fileObj.displayName || fileObj.name || "file";

        // 1. Remove existing extension from baseName to avoid duplication or corrupted names (v126.87)
        if (baseName.includes('.')) {
            const parts = baseName.split('.');
            parts.pop();
            baseName = parts.join('.');
        }

        // 2. Determine Extension with blob-safety
        let ext = (fileObj.ext || "").toLowerCase();

        // If no explicit ext, try to parse from Cloud Storage URL (if not a blob)
        if (!ext && !fileObj.url.startsWith('blob:')) {
            const urlWithoutQuery = fileObj.url.split('?')[0];
            const parts = urlWithoutQuery.split('.');
            if (parts.length > 1) {
                ext = parts.pop()?.toLowerCase() || "";
            }
        }

        // 3. Last fallback: determine from blob's MIME type (especially for freshly uploaded blobs)
        if (!ext || ext.length > 5 || ext.includes('/') || ext.includes(':') || ext.includes('?')) {
            const mimeMap: Record<string, string> = {
                'video/mp4': 'mp4',
                'video/quicktime': 'mov',
                'video/x-m4v': 'm4v',
                'video/webm': 'webm',
                'image/jpeg': 'jpg',
                'image/jpg': 'jpg',
                'image/png': 'png',
                'image/webp': 'webp',
                'application/pdf': 'pdf'
            };
            ext = mimeMap[blob.type] || blob.type.split('/').pop() || "bin";
        }

        const finalName = `${baseName}.${ext}`;

        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = finalName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
        window.open(fileObj.url, '_blank');
    }
};

/**
 * Audio Integrated Viewer Component
 */
export const TeasyAudioPlayer = ({ isOpen, onClose, file }: any) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);

    React.useEffect(() => {
        if (isOpen && file?.url && audioRef.current) {
            audioRef.current.load();
            audioRef.current.play().catch(err => console.error("Auto-play failed:", err));
        }
    }, [isOpen, file?.url]);

    if (!file) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="md" isCentered>
            <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(5px)" />
            <ModalContent borderRadius="xl" overflow="hidden">
                <Flex px={6} py={4} bg="brand.50" borderBottom="1px solid" borderColor="rgba(128, 90, 213, 0.1)" justify="space-between" align="center">
                    <HStack spacing={3}>
                        <Box w="3px" h="16px" bg="brand.500" borderRadius="full" />
                        <Text color="gray.500" fontWeight="bold" fontSize="md" isTruncated maxW="200px">
                            {getTeasyBaseFileName(file)}
                        </Text>
                    </HStack>
                    <VStack align="flex-end" spacing={0}>
                        <Text color="gray.400" fontSize="10px" fontWeight="normal" whiteSpace="pre"><ThinParen text={file.timestamp || ""} /></Text>
                        <Text color="gray.400" fontSize="xs" fontWeight="300">{file.uploader || file.author || ""}</Text>
                    </VStack>
                </Flex>
                <Box p={10} bg="white">
                    <VStack spacing={6}>
                        <audio ref={audioRef} controls src={file.url} style={{ width: '100%', height: '40px' }} />
                    </VStack>
                </Box>
                <Flex bg="gray.50" p={5} justify="flex-end" gap={2}>
                    <TeasyButton version="secondary" leftIcon={<MdFileDownload />} onClick={() => triggerTeasyDownload(file)}>다운로드</TeasyButton>
                    <TeasyButton onClick={onClose} w="100px">닫기</TeasyButton>
                </Flex>
            </ModalContent>
        </Modal>
    );
};

interface PanZoomState {
    scale: number;
    translateX: number;
    translateY: number;
}

/**
 * Universal File Viewer (Unified Gallery & PDF)
 */
export const TeasyUniversalViewer = ({ isOpen, onClose, files = [], initialIndex = 0, onDelete }: any) => {
    const [currentIndex, setCurrentIndex] = React.useState(initialIndex);
    const [zoomState, setZoomState] = React.useState<PanZoomState>({ scale: 1, translateX: 0, translateY: 0 });

    const currentFile = files[currentIndex] || {};
    const ext = getTeasyFileExt(currentFile);
    const isImage = ['JPG', 'JPEG', 'PNG', 'GIF', 'WEBP', 'BMP'].includes(ext);
    const isPdf = ext === 'PDF' || currentFile.type === 'pdf' || currentFile.type === 'PDF';
    const isVideo = ['MP4', 'MOV', 'M4V', 'WEBM', 'MKV'].includes(ext);

    const getInitialScale = (pdf: boolean) => pdf ? 0.18 : 0.80;

    React.useEffect(() => {
        if (isOpen) {
            setCurrentIndex(initialIndex);
            setZoomState({ scale: getInitialScale(isPdf), translateX: 0, translateY: 0 });
        }
    }, [isOpen, initialIndex]);

    React.useEffect(() => {
        setZoomState({ scale: getInitialScale(isPdf), translateX: 0, translateY: 0 });
    }, [currentIndex, isPdf]);

    if (!isOpen || files.length === 0) return null;

    const handlePrev = () => setCurrentIndex((p: number) => (p > 0 ? p - 1 : files.length - 1));
    const handleNext = () => setCurrentIndex((p: number) => (p < files.length - 1 ? p + 1 : 0));
    const handleZoomIn = () => setZoomState(prev => ({ ...prev, scale: Math.min(prev.scale * 1.1, 10) }));
    const handleZoomOut = () => setZoomState(prev => ({ ...prev, scale: Math.max(prev.scale / 1.1, 0.01) }));
    const handleReset = () => setZoomState({ scale: getInitialScale(isPdf), translateX: 0, translateY: 0 });

    const triggerDownloadAll = async () => {
        for (let i = 0; i < files.length; i++) {
            await triggerTeasyDownload(files[i]);
            if (i < files.length - 1) await new Promise(r => setTimeout(r, 200));
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="full" isCentered>
            <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(8px)" />
            <ModalContent bg="transparent" boxShadow="none" m={0} display="flex" alignItems="center" justifyContent="center">
                <Box w="85vw" maxW="1200px" minH="600px" h="85vh" bg="gray.100" borderRadius="2xl" overflow="hidden" display="flex" flexDirection="column" boxShadow="2xl">
                    <Flex px={6} py={4} bg="brand.50" borderBottom="1px solid" borderColor="rgba(128, 90, 213, 0.1)" justify="space-between" align="center" zIndex={20}>
                        <HStack spacing={3} maxW="75vw">
                            <Box w="3px" h="16px" bg="brand.500" borderRadius="full" />
                            <HStack spacing={0} isTruncated>
                                <Text color="gray.500" fontWeight="bold" fontSize="md" isTruncated whiteSpace="pre-wrap">{getTeasyBaseFileName(currentFile)}</Text>
                                {files.length > 1 && (
                                    <HStack spacing={0} ml={3} color="gray.400" fontWeight="semibold" fontSize="sm" flexShrink={0}>
                                        <ThinParen text={`(${currentIndex + 1}/${files.length})`} />
                                    </HStack>
                                )}
                            </HStack>
                        </HStack>
                        <VStack align="flex-end" spacing={0}>
                            <Text color="gray.400" fontSize="10px" fontWeight="normal" whiteSpace="pre"><ThinParen text={currentFile.timestamp || ""} /></Text>
                            <Text color="gray.400" fontSize="xs" fontWeight="300">{currentFile.uploader || currentFile.author || ""}</Text>
                        </VStack>
                    </Flex>
                    <Box flex={1} display="flex" flexDirection="column" overflow="hidden" bg="gray.100">
                        <Box flex={1} w="full" position="relative" display="flex" flexDirection="column" overflow="hidden">
                            {isPdf ? (
                                <Box w="full" h="full" bg="white">
                                    <PanZoomContainer key={currentFile.url} state={zoomState} setState={setZoomState}>
                                        <Box w="3000px" h="4243px" bg="white" border="none" boxShadow="none" outline="none" overflow="hidden">
                                            <iframe src={`${currentFile.url}#view=FitV&toolbar=0&navpanes=0`} width="100%" height="100%" frameBorder="0" scrolling="no" style={{ border: 0, borderStyle: 'none', background: 'white', display: 'block', outline: 'none', margin: 0, padding: 0 }} title="PDF" />
                                        </Box>
                                    </PanZoomContainer>
                                </Box>
                            ) : (
                                <Box w="full" h="full" display="flex" alignItems="center" justifyContent="center">
                                    <Box w="full" style={{ aspectRatio: '16/9' }}>
                                        <PanZoomContainer key={currentFile.url} state={zoomState} setState={setZoomState}>
                                            <img src={currentFile.url} alt="View" style={{ width: '2400px', objectFit: 'contain' }} />
                                        </PanZoomContainer>
                                    </Box>
                                </Box>
                            )}
                        </Box>
                        <Box px={6} py={3} bg="white" borderTop="1px solid" borderColor="gray.100" h="65px" display="flex" alignItems="center" justifyContent="center" overflow="hidden">
                            <HStack spacing={1.5} justify="center" wrap="nowrap" mx="auto" overflowX="auto" overflowY="hidden">
                                {files.map((file: any, idx: number) => {
                                    const isCurrent = idx === currentIndex;
                                    const fExt = getTeasyFileExt(file);
                                    const fIsPdf = fExt === 'PDF' || file.type === 'pdf' || file.type === 'PDF';
                                    const fIsImg = ['JPG', 'JPEG', 'PNG', 'GIF', 'WEBP', 'BMP', 'HEIC'].includes(fExt);
                                    const fIsVid = ['MP4', 'MOV', 'M4V', 'WEBM', 'MKV'].includes(fExt);
                                    const fIsAud = ['MP3', 'WAV', 'M4A', 'AAC', 'OGG'].includes(fExt);

                                    return (
                                        <Box key={idx} w="51px" h="29px" borderRadius="md" overflow="hidden" cursor="pointer" border={isCurrent ? "3px solid" : "1.5px solid"} borderColor={isCurrent ? "rgba(128, 90, 213, 0.6)" : "gray.100"} bg="gray.100" opacity={isCurrent ? 1 : 0.6} onClick={() => setCurrentIndex(idx)} flexShrink={0} transition="all 0.2s">
                                            {fIsPdf ? (
                                                <Center h="full" bg="red.50" color="red.500"><Text fontSize="10px" fontWeight="bold">PDF</Text></Center>
                                            ) : fIsImg ? (
                                                <img src={file.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : fIsVid ? (
                                                <Center h="full" bg="blue.50" color="blue.500"><Text fontSize="10px" fontWeight="bold">VIDEO</Text></Center>
                                            ) : fIsAud ? (
                                                <Center h="full" bg="orange.50" color="orange.500"><Text fontSize="10px" fontWeight="bold">AUDIO</Text></Center>
                                            ) : (
                                                <Center h="full" bg="gray.200" color="gray.500"><Text fontSize="10px" fontWeight="bold">FILE</Text></Center>
                                            )}
                                        </Box>
                                    );
                                })}
                            </HStack>
                        </Box>
                    </Box>
                    <Flex px={6} py={5} borderTop="1px solid" borderColor="gray.100" bg="gray.50" justify="space-between" align="center" zIndex={20}>
                        <Box flex={1} />
                        <HStack spacing={2} flex={1} justify="center">
                            {files.length > 1 && <IconButton aria-label="Prev" icon={<MdChevronLeft size={24} />} size="sm" variant="ghost" color="gray.600" onClick={handlePrev} />}
                            <HStack spacing={1} px={3} py={1} bg="white" borderRadius="full" border="1px solid" borderColor="gray.200" boxShadow="sm">
                                <IconButton aria-label="Zoom Out" icon={<Text fontSize="lg" fontWeight="bold">-</Text>} size="xs" variant="ghost" onClick={handleZoomOut} />
                                <Text fontSize="xs" fontWeight="bold" color="gray.600" minW="45px" textAlign="center">{Math.round(zoomState.scale * 100)}%</Text>
                                <IconButton aria-label="Zoom In" icon={<Text fontSize="lg" fontWeight="bold">+</Text>} size="xs" variant="ghost" onClick={handleZoomIn} />
                                <Box h="12px" w="1px" bg="gray.200" mx={1} />
                                <Button size="xs" variant="ghost" fontSize="10px" color="gray.500" onClick={handleReset}>Reset</Button>
                            </HStack>
                            {files.length > 1 && <IconButton aria-label="Next" icon={<MdChevronRight size={24} />} size="sm" variant="ghost" color="gray.600" onClick={handleNext} />}
                        </HStack>
                        <HStack spacing={files.length > 1 ? 8 : 2} flex={1} justify="flex-end">
                            <HStack spacing={2}>
                                <TeasyButton size="sm" version="secondary" leftIcon={<MdFileDownload />} onClick={() => triggerTeasyDownload(currentFile)}>다운로드</TeasyButton>
                                {files.length > 1 && <TeasyButton size="sm" version="secondary" onClick={triggerDownloadAll}>전체 다운로드</TeasyButton>}
                                {onDelete && (
                                    <TeasyButton
                                        size="sm"
                                        version="secondary"
                                        color="red.400"
                                        _hover={{ bg: "red.500", color: "white" }}
                                        onClick={() => onDelete(currentFile)}
                                    >
                                        삭제
                                    </TeasyButton>
                                )}
                            </HStack>
                            <TeasyButton size="sm" onClick={onClose} minW="80px">닫기</TeasyButton>
                        </HStack>
                    </Flex>
                </Box>
            </ModalContent>
        </Modal>
    );
};
