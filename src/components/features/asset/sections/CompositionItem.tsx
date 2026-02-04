// src/components/features/asset/sections/CompositionItem.tsx
import React from "react";
import { Box, HStack, Text, Badge, IconButton } from "@chakra-ui/react";
import { MdRemove } from "react-icons/md";
import { Reorder, useDragControls } from "framer-motion";
import { AssetData } from "@/utils/assetUtils";
import { useInventoryMaster } from "../hooks/useInventoryMaster";

interface CompositionItemProps {
    comp: string;
    idx: number;
    onRemove: () => void;
    assets: AssetData[];
    realNum?: string;
    onDragEnd?: () => void;
}

export const CompositionItem: React.FC<CompositionItemProps> = ({
    comp,
    idx,
    onRemove,
    assets,
    realNum,
    onDragEnd
}) => {
    const { masterItems } = useInventoryMaster();
    const controls = useDragControls();
    const isDivider = comp.startsWith("__DIVIDER__") || comp === "-----";
    const itemName = isDivider ? "" : comp;
    const itemCategory = masterItems.find(m => m.name === itemName)?.category ||
        assets.find(a => a.name === itemName)?.category ||
        "재고";


    return (
        <Reorder.Item
            key={comp}
            value={comp}
            dragListener={false}
            dragControls={controls}
            onDragEnd={onDragEnd}
            whileDrag={{
                scale: 1.02,
                boxShadow: "0 10px 25px rgba(128, 90, 213, 0.25)",
                zIndex: 50
            }}
            whileTap={{ backgroundColor: "rgba(128, 90, 213, 0.05)" }}
            style={{ marginBottom: "8px", userSelect: "none" }}
        >
            <HStack
                justify="space-between"
                bg="white"
                px={3}
                py={isDivider ? 1 : 1.5}
                borderRadius="md"
                shadow="xs"
                border="1px solid"
                borderColor={isDivider ? "gray.100" : "transparent"}
                transition="all 0.2s"
                _active={{ bg: "brand.50", borderColor: "brand.200" }}
            >
                <HStack spacing={3} flex={1} overflow="hidden">
                    <Box
                        cursor="grab"
                        _active={{ cursor: "grabbing" }}
                        onPointerDown={(e) => controls.start(e)}
                        p={1}
                        borderRadius="sm"
                        _hover={{ bg: "gray.100" }}
                        display="flex"
                        alignItems="center"
                    >
                        <Box as="svg" width="14px" height="14px" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" color="gray.300">
                            <line x1="4" y1="8" x2="20" y2="8" />
                            <line x1="4" y1="12" x2="20" y2="12" />
                            <line x1="4" y1="16" x2="20" y2="16" />
                        </Box>
                    </Box>

                    {isDivider ? (
                        <Box flex={1} height="1px" bg="gray.100" my={3} />
                    ) : (
                        <Text fontSize="sm" color="gray.700" fontWeight="medium" userSelect="none" isTruncated>
                            <Text as="span" color="brand.500" mr={2} fontWeight="bold">{realNum}</Text>
                            {comp}
                        </Text>
                    )}
                </HStack>
                <HStack spacing={2}>
                    {!isDivider && (
                        <Badge
                            bg="gray.100"
                            color="gray.500"
                            fontSize="10px"
                            fontWeight="bold"
                            px={2}
                            h="18px"
                            borderRadius="4px"
                            display="flex"
                            alignItems="center"
                            textTransform="none"
                        >
                            {itemCategory}
                        </Badge>
                    )}
                    <IconButton
                        aria-label="remove-component"
                        icon={<MdRemove />}
                        size="xs"
                        variant="ghost"
                        colorScheme="red"
                        onClick={onRemove}
                    />
                </HStack>
            </HStack>
        </Reorder.Item>
    );
};
