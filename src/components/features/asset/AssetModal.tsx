"use client";
import React from "react";
import {
    VStack, FormControl, Box, Flex, Text, Badge,
    useToast, HStack, Spacer
} from "@chakra-ui/react";
import { Reorder } from "framer-motion";
import {
    TeasyModal, TeasyModalOverlay, TeasyModalContent,
    TeasyModalHeader, TeasyModalBody, TeasyModalFooter,
    TeasyFormLabel, TeasyInput, TeasyButton
} from "@/components/common/UIComponents";
import { CustomSelect } from "@/components/common/CustomSelect";
import { AssetData } from "@/utils/assetUtils";
import { useAssetModal } from "./useAssetModal";
import { INVENTORY_CATEGORIES, PRODUCT_CATEGORIES, getCircledNumber, cleanComponentString } from "./AssetModalUtils";
import { CompositionItem } from "./sections/CompositionItem";

interface AssetModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedAsset?: AssetData;
    assets: AssetData[];
    viewMode: "inventory" | "product";
    onDelete?: (id: string) => void;
}

export const AssetModal: React.FC<AssetModalProps> = ({
    isOpen,
    onClose,
    selectedAsset,
    assets,
    viewMode,
    onDelete
}) => {
    const {
        category, setCategory, name, setName, qty, price,
        selectedComponents, setSelectedComponents, editReason, setEditReason, isSubmitting,
        suggestions, setSuggestions, showSuggestions, setShowSuggestions,
        isEdit, isProduct, compositionOptions,
        isCategoryChanged, isNameChanged, isQtyChanged,
        handleClose, handleQtyChange, handlePriceChange, handleSubmit,
        handleNameChange, handleSuggestionSelect
    } = useAssetModal(isOpen, onClose, assets, selectedAsset, viewMode);

    const toast = useToast();

    return (
        <TeasyModal isOpen={isOpen} onClose={handleClose} size="md">
            <TeasyModalOverlay />
            <TeasyModalContent>
                <TeasyModalHeader>{isProduct ? (isEdit ? "상품 정보 수정" : "상품 등록") : (isEdit ? "재고 물품 상세/수정" : "재고 물품 등록")}</TeasyModalHeader>
                <TeasyModalBody>
                    <VStack spacing={6} align="stretch" minH="300px">
                        <FormControl isRequired>
                            <TeasyFormLabel>카테고리</TeasyFormLabel>
                            <CustomSelect
                                options={isProduct ? PRODUCT_CATEGORIES : INVENTORY_CATEGORIES}
                                value={category}
                                onChange={setCategory}
                                placeholder="선택"
                                isDisabled={!isProduct && (isNameChanged || isQtyChanged)}
                            />
                        </FormControl>

                        <FormControl isRequired position="relative">
                            <TeasyFormLabel>{isProduct ? "상품명" : "물품명"}</TeasyFormLabel>
                            <TeasyInput
                                value={name}
                                onChange={(e) => handleNameChange(e.target.value)}
                                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                placeholder="입력"
                                isDisabled={!isProduct && (isCategoryChanged || isQtyChanged)}
                            />
                            {showSuggestions && (
                                <Box position="absolute" top="100%" left={0} right={0} bg="white" boxShadow="lg" borderRadius="md" zIndex={10} mt={1} maxH="200px" overflowY="auto" border="1px" borderColor="gray.200">
                                    {suggestions.map((item: any, idx) => (
                                        <Box
                                            key={idx}
                                            px={4}
                                            py={2}
                                            cursor="pointer"
                                            _hover={{ bg: "brand.50" }}
                                            onClick={() => handleSuggestionSelect(item)}
                                        >
                                            <Flex justify="space-between" align="center">
                                                <Text fontSize="sm" fontWeight="semibold" color="gray.700">{item.name}</Text>
                                                <Badge size="xs" colorScheme="gray">{item.category}</Badge>
                                            </Flex>
                                        </Box>
                                    ))}
                                </Box>
                            )}
                        </FormControl>

                        {isProduct ? (
                            <>
                                <FormControl isRequired>
                                    <TeasyFormLabel>판매가</TeasyFormLabel>
                                    <TeasyInput value={price} onChange={(e) => handlePriceChange(e.target.value)} placeholder="입력" textAlign="right" />
                                </FormControl>
                                <FormControl>
                                    <TeasyFormLabel>상품 구성</TeasyFormLabel>
                                    <Box w="full">
                                        <CustomSelect
                                            options={compositionOptions}
                                            value=""
                                            onChange={(val) => {
                                                if (val && !selectedComponents.includes(val)) {
                                                    setSelectedComponents(prev => [...prev, val]);
                                                }
                                            }}
                                            placeholder="선택"
                                        />
                                    </Box>
                                    {selectedComponents.length > 0 && (
                                        <VStack align="stretch" mt={3} spacing={2} p={3} bg="gray.50" borderRadius="md" border="1px" borderColor="gray.100">
                                            <Reorder.Group
                                                axis="y"
                                                values={selectedComponents}
                                                onReorder={setSelectedComponents}
                                                style={{ listStyleType: "none", padding: "2px", overflow: "hidden" }}
                                            >
                                                {selectedComponents.map((comp, idx) => (
                                                    <CompositionItem
                                                        key={comp}
                                                        comp={comp}
                                                        idx={idx}
                                                        realNum={getCircledNumber(idx + 1)}
                                                        assets={assets}
                                                        onRemove={() => setSelectedComponents(prev => prev.filter((_, i) => i !== idx))}
                                                    />
                                                ))}
                                            </Reorder.Group>
                                        </VStack>
                                    )}
                                </FormControl>
                            </>
                        ) : (
                            <>
                                <FormControl isRequired>
                                    <TeasyFormLabel>입고 수량</TeasyFormLabel>
                                    <TeasyInput
                                        value={qty}
                                        onChange={(e) => handleQtyChange(e.target.value)}
                                        placeholder="입력"
                                        textAlign="right"
                                        isDisabled={(!isProduct && (isCategoryChanged || isNameChanged)) || !!selectedAsset?.lastOutflow}
                                        onClick={() => {
                                            if (selectedAsset?.lastOutflow) {
                                                toast({
                                                    title: "수정 불가",
                                                    description: "출고 데이터는 고객 관리 페이지에서만 수정 가능합니다.",
                                                    status: "warning",
                                                    duration: 3000,
                                                    isClosable: true,
                                                    position: "top"
                                                });
                                            }
                                        }}
                                    />
                                </FormControl>

                                {isEdit && isQtyChanged && (
                                    <FormControl isRequired>
                                        <TeasyFormLabel>수정 사유</TeasyFormLabel>
                                        <TeasyInput value={editReason} onChange={(e) => setEditReason(e.target.value)} placeholder="입력" borderColor="red.200" _focus={{ borderColor: "red.500" }} />
                                    </FormControl>
                                )}
                            </>
                        )}
                    </VStack>
                </TeasyModalBody>
                <TeasyModalFooter>
                    {isEdit && isProduct && (
                        <>
                            <TeasyButton
                                version="danger"
                                variant="outline"
                                fontWeight="400"
                                borderColor="rgba(229, 62, 62, 0.3)"
                                bg="rgba(229, 62, 62, 0.02)"
                                _hover={{
                                    bg: "rgba(229, 62, 62, 0.08)",
                                    borderColor: "red.500"
                                }}
                                onClick={() => {
                                    if (selectedAsset && window.confirm("정말 이 상품을 삭제하시겠습니까?")) {
                                        onDelete?.(selectedAsset.id);
                                        handleClose();
                                    }
                                }}
                            >
                                삭제
                            </TeasyButton>
                            <Spacer />
                        </>
                    )}
                    <TeasyButton version="secondary" onClick={handleClose} isDisabled={isSubmitting}>취소</TeasyButton>
                    <TeasyButton onClick={handleSubmit} isLoading={isSubmitting} loadingText={isEdit ? "수정 중" : "등록 중"}>{isEdit ? "수정" : "등록하기"}</TeasyButton>
                </TeasyModalFooter>
            </TeasyModalContent>
        </TeasyModal>
    );
};
