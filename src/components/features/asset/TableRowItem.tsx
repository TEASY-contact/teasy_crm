// src/components/features/asset/TableRowItem.tsx
import React from "react";
import {
    Box, Flex, Text, Checkbox, Grid, GridItem, VStack, Divider, Badge, IconButton
} from "@chakra-ui/react";
import { Reorder, useDragControls } from "framer-motion";
import { MdRemove } from "react-icons/md";
import { AssetData } from "@/utils/assetUtils";
import { formatAssetDate, formatAssetDisplay } from "@/utils/textFormatter";
import {
    AssetTd, AssetTh, HighlightedText, TruncatedTooltip, HISTORY_GRID_RATIO
} from "./AssetTableAtoms";

interface TableRowItemProps {
    asset: AssetData;
    viewMode: "inventory" | "product";
    idx: number;
    selectedAssetId: string | null;
    setSelectedAssetId: React.Dispatch<React.SetStateAction<string | null>>;
    search: string;
    onEdit?: (id: string) => void;
    onDeleteDivider?: (id: string) => void;
    totalCount: number;
}

export const TableRowItem = ({
    asset,
    viewMode,
    idx,
    selectedAssetId,
    setSelectedAssetId,
    search,
    onEdit,
    onDeleteDivider,
    totalCount
}: TableRowItemProps) => {
    const controls = useDragControls();
    const isProduct = viewMode === "product";
    const isSelected = selectedAssetId === asset.id;
    const isDivider = asset.type === "divider";

    if (isDivider) {
        return (
            <Reorder.Item
                as="tr"
                key={asset.id}
                value={asset}
                dragListener={false}
                dragControls={controls}
                whileDrag={{ scale: 1.01, backgroundColor: "white", zIndex: 10, boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}
                style={{ height: "45px", borderBottom: "1px solid var(--chakra-colors-gray-100)", userSelect: "none" }}
            >
                <AssetTd textAlign="center">
                    <Flex justify="center" align="center" cursor="grab" onPointerDown={(e) => controls.start(e)} p={1} borderRadius="sm" _hover={{ bg: "gray.100" }}>
                        {/* Custom Hamburger SVG */}
                        <Box as="svg" width="14px" height="14px" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" color="gray.300">
                            <line x1="4" y1="8" x2="20" y2="8" />
                            <line x1="4" y1="12" x2="20" y2="12" />
                            <line x1="4" y1="16" x2="20" y2="16" />
                        </Box>
                    </Flex>
                </AssetTd>
                <AssetTd colSpan={isProduct ? 4 : 11} py={4} px={8}>
                    <Box h="6px" bgGradient="linear(to-r, brand.50, brand.700, brand.50)" w="full" borderRadius="full" shadow="md" />
                </AssetTd>
                <AssetTd textAlign="center">
                    <IconButton
                        aria-label="Delete Divider"
                        icon={<MdRemove />}
                        size="xs"
                        variant="ghost"
                        colorScheme="red"
                        onClick={(e) => { e.stopPropagation(); onDeleteDivider?.(asset.id); }}
                    />
                </AssetTd>
            </Reorder.Item>
        );
    }

    return (
        <Reorder.Item
            as="tr"
            key={asset.id}
            value={asset}
            dragListener={false}
            dragControls={controls}
            whileDrag={{
                scale: 1.0,
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
                backgroundColor: "white",
                zIndex: 10
            }}
            whileHover={{ backgroundColor: isSelected ? "rgba(128, 90, 213, 0.06)" : "var(--chakra-colors-gray-50)" }}
            initial={false}
            animate={{ backgroundColor: isSelected ? "rgba(128, 90, 213, 0.06)" : "rgba(0,0,0,0)" }}
            transition={{ duration: 0 }}
            style={{
                height: "45px",
                borderBottom: "1px solid var(--chakra-colors-gray-50)",
                userSelect: "none",
                WebkitTapHighlightColor: "transparent"
            }}
        >
            {isProduct ? (
                <>
                    <AssetTd textAlign="center">
                        <Flex
                            justify="center"
                            align="center"
                            cursor="grab"
                            _active={{ cursor: "grabbing" }}
                            onPointerDown={(e) => controls.start(e)}
                            p={1}
                            borderRadius="sm"
                            _hover={{ bg: "gray.100" }}
                        >
                            <Box as="svg" width="14px" height="14px" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" color="gray.300">
                                <line x1="4" y1="8" x2="20" y2="8" />
                                <line x1="4" y1="12" x2="20" y2="12" />
                                <line x1="4" y1="16" x2="20" y2="16" />
                            </Box>
                        </Flex>
                    </AssetTd>
                    <AssetTd textAlign="center" color="gray.600">
                        {asset.category ? <HighlightedText text={asset.category} query={search} /> : <Text as="span" color="gray.400">-</Text>}
                    </AssetTd>
                    <AssetTd fontWeight="bold" color="gray.800" textAlign={asset.name ? "left" : "center"}>
                        {asset.name ? <HighlightedText text={asset.name} query={search} /> : <Text as="span" color="gray.400">-</Text>}
                    </AssetTd>
                    <AssetTd textAlign="center">
                        <Box as="span" fontWeight="semibold" color="gray.800">
                            {asset.price ? asset.price.toLocaleString() : <Text as="span" color="gray.400">-</Text>}
                        </Box>
                    </AssetTd>
                    <AssetTd overflow="hidden" textAlign={asset.composition && asset.composition !== "-" ? "left" : "center"}>
                        <TruncatedTooltip label={asset.composition || "-"}>
                            <Box as="span" color="gray.600">
                                {asset.composition && asset.composition !== "-" ? <HighlightedText text={asset.composition} query={search} /> : <Text as="span" color="gray.400">-</Text>}
                            </Box>
                        </TruncatedTooltip>
                    </AssetTd>
                    <AssetTd textAlign="center">
                        <Flex justify="center" align="center">
                            <Badge
                                bg="rgba(128, 90, 213, 0.1)"
                                color="brand.500"
                                cursor="pointer"
                                px={3}
                                py="3px"
                                borderRadius="10px"
                                textTransform="none"
                                fontSize="xs"
                                fontWeight="800"
                                transition="all 0.2s"
                                _hover={{ bg: "brand.500", color: "white" }}
                                onClick={(e: React.MouseEvent) => { e.stopPropagation(); onEdit?.(asset.id); }}
                            >
                                상세보기
                            </Badge>
                        </Flex>
                    </AssetTd>
                </>
            ) : (
                <>
                    <AssetTd p={0} textAlign="center">
                        <Flex
                            w="full" h="full" minH="45px" cursor="pointer"
                            onClick={() => setSelectedAssetId(prev => prev === asset.id ? null : asset.id)}
                            align="center" justify="center"
                            userSelect="none"
                            _active={{ bg: "transparent" }}
                            _focus={{ bg: "transparent" }}
                            _focusVisible={{ boxShadow: "none" }}
                            style={{ WebkitTapHighlightColor: "transparent" }}
                        >
                            <Checkbox
                                colorScheme="brand"
                                isChecked={isSelected}
                                pointerEvents="none"
                                _focus={{ boxShadow: "none" }}
                                _focusVisible={{ boxShadow: "none" }}
                                _active={{ bg: "transparent" }}
                            />
                        </Flex>
                    </AssetTd>
                    <AssetTd textAlign="center" color="gray.600" whiteSpace="nowrap">
                        {totalCount - idx}
                    </AssetTd>
                    <AssetTd textAlign="center" color="gray.600" overflow="hidden">
                        <TruncatedTooltip label={asset.category || "-"}>
                            <Box as="span">
                                {asset.category ? <HighlightedText text={asset.category} query={search} /> : <Text as="span" color="gray.400">-</Text>}
                            </Box>
                        </TruncatedTooltip>
                    </AssetTd>
                    <AssetTd fontWeight="bold" color="gray.800" overflow="hidden" textAlign={asset.name ? "left" : "center"}>
                        <TruncatedTooltip label={asset.name || "-"}>
                            <Box as="span">
                                {asset.name ? <HighlightedText text={asset.name} query={search} /> : <Text as="span" color="gray.400">-</Text>}
                            </Box>
                        </TruncatedTooltip>
                    </AssetTd>
                    <AssetTd textAlign="center" color="gray.600" overflow="hidden">
                        <TruncatedTooltip label={asset.lastActionDate || "-"}>
                            <Text as="span" color={asset.lastActionDate ? "inherit" : "gray.400"} whiteSpace="pre-wrap">
                                {formatAssetDate(asset.lastActionDate)}
                            </Text>
                        </TruncatedTooltip>
                    </AssetTd>
                    <AssetTd textAlign="center" fontSize="xs" color="gray.500" whiteSpace="nowrap">
                        {asset.lastOperator || <Text as="span" color="gray.400">-</Text>}
                    </AssetTd>
                    <AssetTd textAlign="center" color="blue.500" whiteSpace="nowrap" px={3}>
                        {asset.lastInflow ? (
                            <Text as="span" fontWeight="bold">
                                <Text as="span" fontWeight="normal" mr={0.5}>+</Text>
                                {asset.lastInflow.toLocaleString()}
                            </Text>
                        ) : (
                            <Text as="span" color="gray.400">-</Text>
                        )}
                    </AssetTd>
                    <AssetTd textAlign="center" color="red.500" whiteSpace="nowrap" px={3}>
                        {asset.lastOutflow ? (
                            <Text as="span" fontWeight="bold">
                                <Text as="span" fontWeight="normal" mr={0.5}>-</Text>
                                {asset.lastOutflow.toLocaleString()}
                            </Text>
                        ) : (
                            <Text as="span" color="gray.400">-</Text>
                        )}
                    </AssetTd>
                    <AssetTd overflow="hidden" textAlign={asset.lastRecipient && asset.lastRecipient !== "-" ? "left" : "center"} px={3}>
                        <TruncatedTooltip label={asset.lastRecipient || "-"}>
                            <Box as="span" fontSize="xs" color="gray.600">
                                {asset.lastRecipient && asset.lastRecipient !== "-" ? asset.lastRecipient : <Text as="span" color="gray.400">-</Text>}
                            </Box>
                        </TruncatedTooltip>
                    </AssetTd>
                    <AssetTd textAlign="center" fontWeight="extrabold" color="gray.800" whiteSpace="nowrap" px={3}>
                        {asset.stock?.toLocaleString() || 0}
                    </AssetTd>
                    <AssetTd colSpan={3} p={0} verticalAlign="top">
                        <VStack align="stretch" spacing={0} w="full">
                            {asset.editTime && asset.editTime !== "-" ? (
                                asset.editTime.split("\n").map((time, i, arr) => {
                                    const ops = asset.editOperators?.split("\n") || [];
                                    const logs = asset.editLog?.split("\n") || [];
                                    const operator = (ops[i] || "-").trim();
                                    const logDetail = (logs[i] || "-").replace(/\r/g, "\n");

                                    return (
                                        <Box key={i} w="full">
                                            <Grid templateColumns={HISTORY_GRID_RATIO} w="full" minH="34px" alignItems="center">
                                                <GridItem borderRight="1px" borderColor="gray.50" h="full" display="flex" alignItems="center" justifyContent="center">
                                                    <Text fontSize="sm" color="gray.600" textAlign="center" whiteSpace="pre-wrap" w="full">
                                                        {formatAssetDate(time.trim())}
                                                    </Text>
                                                </GridItem>
                                                <GridItem borderRight="1px" borderColor="gray.50" h="full" display="flex" alignItems="center" justifyContent="center">
                                                    <Text fontSize="xs" color="gray.500" textAlign="center" w="full">
                                                        {operator}
                                                    </Text>
                                                </GridItem>
                                                <GridItem px={3} py={1} h="full" display="flex" alignItems="center">
                                                    <TruncatedTooltip label={logDetail} noNowrap>
                                                        <Text fontSize="sm" color={logDetail && logDetail !== "-" ? "gray.600" : "gray.400"} whiteSpace="pre-wrap" textAlign="left" lineHeight="1.4">
                                                            {formatAssetDisplay(logDetail)}
                                                        </Text>
                                                    </TruncatedTooltip>
                                                </GridItem>
                                            </Grid>
                                            {i < arr.length - 1 && <Divider borderColor="gray.100" />}
                                        </Box>
                                    );
                                })
                            ) : (
                                <Grid templateColumns={HISTORY_GRID_RATIO} w="full" h="45px" alignItems="center">
                                    <GridItem px={2} borderRight="1px" borderColor="gray.50" h="full" display="flex" alignItems="center" justifyContent="center">
                                        <Text fontSize="sm" color="gray.400">-</Text>
                                    </GridItem>
                                    <GridItem px={2} borderRight="1px" borderColor="gray.50" h="full" display="flex" alignItems="center" justifyContent="center">
                                        <Text fontSize="xs" color="gray.400">-</Text>
                                    </GridItem>
                                    <GridItem px={3} h="full" display="flex" alignItems="center" justifyContent="center">
                                        <Text fontSize="sm" color="gray.400">-</Text>
                                    </GridItem>
                                </Grid>
                            )}
                        </VStack>
                    </AssetTd>
                </>
            )}
        </Reorder.Item>
    );
};
