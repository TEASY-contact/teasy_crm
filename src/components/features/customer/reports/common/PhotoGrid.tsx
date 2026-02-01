"use client";
import React from "react";
import { Grid, Box, Image, Icon, IconButton, Text } from "@chakra-ui/react";
import { MdClose, MdAdd } from "react-icons/md";

interface PhotoGridProps {
    photos: string[];
    isReadOnly?: boolean;
    onAddClick: () => void;
    onRemoveClick: (index: number) => void;
    maxPhotos?: number;
}

/**
 * Common Photo Grid component for reports (e.g., DemoCompleteForm).
 */
export const PhotoGrid = ({
    photos,
    isReadOnly = false,
    onAddClick,
    onRemoveClick,
    maxPhotos = 15
}: PhotoGridProps) => {
    return (
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
                        borderColor="gray.200"
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
    );
};
