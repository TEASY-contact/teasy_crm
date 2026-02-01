// src/components/features/customer/PhotoViewerModal.tsx
"use client";
import {
    Modal, ModalOverlay, ModalContent, ModalBody,
    IconButton, Flex, Image, Box, Text, HStack
} from "@chakra-ui/react";
import { useState, useEffect } from "react";
import { MdChevronLeft, MdChevronRight, MdClose } from "react-icons/md";

interface PhotoViewerModalProps {
    isOpen: boolean;
    onClose: () => void;
    photos: string[];
    initialIndex?: number;
}

export const PhotoViewerModal = ({
    isOpen,
    onClose,
    photos,
    initialIndex = 0
}: PhotoViewerModalProps) => {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);

    useEffect(() => {
        if (isOpen) setCurrentIndex(initialIndex);
    }, [isOpen, initialIndex]);

    if (!photos || photos.length === 0) return null;

    const handlePrev = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
    };

    const handleNext = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1));
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} isCentered size="full">
            <ModalOverlay bg="blackAlpha.900" backdropFilter="blur(5px)" />
            <ModalContent bg="transparent" shadow="none" m={0}>
                <ModalBody p={0} position="relative" h="100vh">
                    <Flex w="full" h="full" align="center" justify="center" direction="column">

                        {/* Header Controls */}
                        <Flex
                            position="absolute"
                            top={0}
                            left={0}
                            right={0}
                            p={6}
                            justify="flex-end"
                            align="center"
                            zIndex={2}
                        >
                            <IconButton
                                aria-label="Close viewer"
                                icon={<MdClose />}
                                variant="ghost"
                                color="white"
                                fontSize="32px"
                                _hover={{ bg: "whiteAlpha.200" }}
                                onClick={onClose}
                            />
                        </Flex>

                        {/* Image Display */}
                        <Flex
                            w="full"
                            h="full"
                            align="center"
                            justify="center"
                            onClick={onClose}
                            cursor="zoom-out"
                        >
                            <Image
                                src={photos[currentIndex]}
                                maxH="85vh"
                                maxW="90vw"
                                objectFit="contain"
                                onClick={(e) => e.stopPropagation()}
                                cursor="default"
                                borderRadius="lg"
                                transition="all 0.3s"
                            />
                        </Flex>

                        {/* Navigation Buttons (At the bottom as requested) */}
                        {photos.length > 1 && (
                            <HStack position="absolute" bottom={10} spacing={8} zIndex={5} bg="blackAlpha.600" px={6} py={2} borderRadius="full" backdropFilter="blur(10px)">
                                <IconButton
                                    aria-label="Previous"
                                    icon={<MdChevronLeft />}
                                    colorScheme="whiteAlpha"
                                    color="white"
                                    fontSize="28px"
                                    variant="ghost"
                                    onClick={handlePrev}
                                    _hover={{ bg: "whiteAlpha.300" }}
                                />
                                <Text color="white" fontWeight="bold" fontSize="md" minW="60px" textAlign="center">
                                    {currentIndex + 1} / {photos.length}
                                </Text>
                                <IconButton
                                    aria-label="Next"
                                    icon={<MdChevronRight />}
                                    colorScheme="whiteAlpha"
                                    color="white"
                                    fontSize="28px"
                                    variant="ghost"
                                    onClick={handleNext}
                                    _hover={{ bg: "whiteAlpha.300" }}
                                />
                            </HStack>
                        )}

                        {/* Keyboard Navigation Note */}
                        <Box position="absolute" bottom={4} color="whiteAlpha.400" fontSize="10px">
                            화면의 빈 공간을 클릭하면 닫힙니다.
                        </Box>
                    </Flex>
                </ModalBody>
            </ModalContent>
        </Modal>
    );
};
