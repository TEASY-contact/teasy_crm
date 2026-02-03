import React, { useState } from "react";
import { Grid, Box, Image, Icon, IconButton, Text, useDisclosure } from "@chakra-ui/react";
import { MdClose, MdAdd } from "react-icons/md";
import { TeasyUniversalViewer } from "@/components/common/ui/MediaViewer";

interface PhotoGridProps {
    photos: string[];
    isReadOnly?: boolean;
    onAddClick: () => void;
    onRemoveClick: (index: number) => void;
    maxPhotos?: number;
}

/**
 * Common Photo Grid component for reports (e.g., DemoCompleteForm).
 * Now includes integrated TeasyUniversalViewer for photo viewing.
 */
export const PhotoGrid = ({
    photos,
    isReadOnly = false,
    onAddClick,
    onRemoveClick,
    maxPhotos = 15
}: PhotoGridProps) => {
    const { isOpen, onOpen, onClose } = useDisclosure();
    const [viewerIndex, setViewerIndex] = useState(0);

    const handlePhotoClick = (index: number) => {
        setViewerIndex(index);
        onOpen();
    };

    // Prepare files for viewer
    const viewerFiles = photos.map(url => ({ url, name: "현장 사진" }));

    return (
        <>
            <Grid templateColumns="repeat(auto-fill, minmax(80px, 1fr))" gap={3}>
                {photos.map((url, index) => (
                    <Box key={index} position="relative" w="80px" h="80px">
                        <Image
                            src={url}
                            alt={`Photo ${index + 1}`}
                            boxSize="80px"
                            objectFit="cover"
                            borderRadius="md"
                            border="1px solid"
                            borderColor="gray.100"
                            cursor="pointer"
                            onClick={() => handlePhotoClick(index)}
                            _active={{ opacity: 0.8 }}
                            transition="opacity 0.2s"
                        />
                        {!isReadOnly && (
                            <IconButton
                                aria-label="Remove photo"
                                icon={<MdClose />}
                                size="xs"
                                colorScheme="red"
                                position="absolute"
                                top="-5px"
                                right="-5px"
                                borderRadius="full"
                                onClick={() => onRemoveClick(index)}
                                type="button"
                                zIndex={1}
                            />
                        )}
                    </Box>
                ))}
                {!isReadOnly && photos.length < maxPhotos && (
                    <Box
                        w="80px" h="80px" bg="white" border="1px dashed" borderColor="brand.300"
                        borderRadius="md" display="flex" flexDirection="column" alignItems="center"
                        justifyContent="center" cursor="pointer" onClick={onAddClick}
                        _hover={{ bg: "brand.50", borderColor: "brand.500" }} transition="all 0.2s"
                    >
                        <Icon as={MdAdd} fontSize="24px" color="brand.500" />
                        <Text fontSize="10px" color="brand.600" mt={1}>추가</Text>
                    </Box>
                )}
            </Grid>

            {/* Photo Viewer */}
            <TeasyUniversalViewer
                isOpen={isOpen}
                onClose={onClose}
                files={viewerFiles}
                initialIndex={viewerIndex}
            />
        </>
    );
};
