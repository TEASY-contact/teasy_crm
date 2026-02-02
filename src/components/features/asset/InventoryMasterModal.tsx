"use client";
import React, { useState, useMemo } from "react";
import {
    VStack, FormControl, Box, Flex, Text, Badge,
    useToast, HStack, Spacer, Switch, IconButton, Divider, Spinner
} from "@chakra-ui/react";
import { Reorder, useDragControls } from "framer-motion";
import { MdAdd, MdRemove, MdDragHandle } from "react-icons/md";
import {
    TeasyModal, TeasyModalOverlay, TeasyModalContent,
    TeasyModalHeader, TeasyModalBody, TeasyModalFooter,
    TeasyFormLabel, TeasyInput, TeasyButton, TeasyBadge,
    TeasyPlaceholderText, TeasyDivider
} from "@/components/common/UIComponents";
import { CustomSelect } from "@/components/common/CustomSelect";
import { INVENTORY_CATEGORIES, getCircledNumber } from "./AssetModalUtils";
import { useInventoryMaster, MasterItem } from "./hooks/useInventoryMaster";
import { useEffect } from "react";

interface InventoryMasterModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const MasterListItem = ({ item, idx, onRemove, onToggle, onDragEnd }: {
    item: MasterItem,
    idx: number,
    onRemove: (id: string) => void,
    onToggle: (id: string, current: boolean) => void,
    onDragEnd?: () => void
}) => {
    const controls = useDragControls();

    return (
        <Reorder.Item
            as="div"
            value={item}
            dragListener={false}
            dragControls={controls}
            onDragEnd={onDragEnd}
            style={{ marginBottom: "8px", userSelect: "none" }}
        >
            <HStack
                justify="space-between"
                bg="white"
                px={3}
                py={2}
                borderRadius="md"
                shadow="sm"
                border="1px solid"
                borderColor="gray.100"
            >
                <HStack spacing={3} flex={1}>
                    <Box
                        color="gray.300"
                        cursor="grab"
                        _active={{ cursor: "grabbing" }}
                        onPointerDown={(e) => controls.start(e)}
                        p={1}
                        borderRadius="sm"
                        _hover={{ bg: "gray.50", color: "gray.400" }}
                    >
                        <MdDragHandle size="18" />
                    </Box>
                    <Text fontSize="sm" fontWeight="bold" color="brand.500" minW="24px" textAlign="center">
                        {getCircledNumber(idx + 1)}
                    </Text>
                    <TeasyBadge colorType="gray" w="auto" px={2}>
                        {item.category}
                    </TeasyBadge>
                    <Text fontSize="sm" color="gray.700" fontWeight="medium" isTruncated>
                        {item.name}
                    </Text>
                </HStack>

                <HStack spacing={4}>
                    <HStack spacing={2}>
                        <Text fontSize="xs" color="gray.400" fontWeight="bold">배송</Text>
                        <Switch
                            size="sm"
                            colorScheme="brand"
                            isChecked={item.isDeliveryItem}
                            onChange={() => onToggle(item.id, item.isDeliveryItem)}
                        />
                    </HStack>
                    <IconButton
                        aria-label="remove-master-item"
                        icon={<MdRemove />}
                        size="xs"
                        variant="ghost"
                        colorScheme="red"
                        onClick={() => onRemove(item.id)}
                    />
                </HStack>
            </HStack>
        </Reorder.Item>
    );
};

export const InventoryMasterModal: React.FC<InventoryMasterModalProps> = ({ isOpen, onClose }) => {
    const toast = useToast();
    const { masterItems, addItem, removeItem, toggleDelivery, reorderItems, isLoading } = useInventoryMaster();

    const [category, setCategory] = useState("");
    const [name, setName] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [onItems, setOnItems] = useState<MasterItem[]>([]);
    const [offItems, setOffItems] = useState<MasterItem[]>([]);
    const [isInitialized, setIsInitialized] = useState(false);

    // Initial sync from masterItems when modal opens
    useEffect(() => {
        if (isOpen && !isInitialized && masterItems.length > 0) {
            setOnItems(masterItems.filter(i => i.isDeliveryItem));
            setOffItems(masterItems.filter(i => !i.isDeliveryItem));
            setIsInitialized(true);
        }
        if (!isOpen) {
            setIsInitialized(false);
        }
    }, [isOpen, isInitialized, masterItems]);

    const handleAddItem = async () => {
        if (!category || !name.trim()) {
            toast({ title: "정보 입력 필요", status: "warning", position: "top" });
            return;
        }
        setIsSubmitting(true);
        try {
            await addItem(name, category);
            setName("");
            toast({ title: "추가 완료", status: "success", position: "top" });
            // Let the useEffect handle the sync when server updates masterItems if possible, 
            // but since we are locked by isInitialized, we might need a manual push or re-open.
            // Actually, if an item is added, we WANT it to appear.
            // Let's allow length changes to trigger a re-sync.
        } catch (e: any) {
            toast({ title: e.message || "추가 실패", status: "error", position: "top" });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Re-sync if length changes (item added or removed)
    useEffect(() => {
        if (isOpen && isInitialized && masterItems.length !== (onItems.length + offItems.length)) {
            setOnItems(masterItems.filter(i => i.isDeliveryItem));
            setOffItems(masterItems.filter(i => !i.isDeliveryItem));
        }
    }, [masterItems.length]);

    const handleRemoveItem = async (id: string) => {
        try {
            await removeItem(id);
            // Local update for immediate feedback
            setOnItems(prev => prev.filter(i => i.id !== id));
            setOffItems(prev => prev.filter(i => i.id !== id));
        } catch (e) {
            toast({ title: "삭제 실패", status: "error" });
        }
    };

    const handleToggleDelivery = async (id: string, current: boolean) => {
        try {
            await toggleDelivery(id, current);
            // Local update: Move item between lists
            if (current) { // ON -> OFF
                const item = onItems.find(i => i.id === id);
                if (item) {
                    const updatedItem = { ...item, isDeliveryItem: false };
                    setOnItems(prev => prev.filter(i => i.id !== id));
                    setOffItems(prev => [...prev, updatedItem]);
                }
            } else { // OFF -> ON
                const item = offItems.find(i => i.id === id);
                if (item) {
                    const updatedItem = { ...item, isDeliveryItem: true };
                    setOffItems(prev => prev.filter(i => i.id !== id));
                    setOnItems(prev => [...prev, updatedItem]);
                }
            }
        } catch (e) {
            toast({ title: "상태 변경 실패", status: "error" });
        }
    };

    const handleReorder = (type: 'on' | 'off', newSectionOrder: MasterItem[]) => {
        if (type === 'on') {
            setOnItems(newSectionOrder);
        } else {
            setOffItems(newSectionOrder);
        }
    };

    const handleSaveOrder = async () => {
        const finalOrder = [...onItems, ...offItems];
        try {
            await reorderItems(finalOrder);
            toast({
                title: "반영 되었습니다.",
                status: "success",
                position: "top",
                duration: 1500
            });
        } catch (e: any) {
            toast({ title: "순서 저장 실패", status: "error", position: "top" });
        }
    };

    return (
        <TeasyModal isOpen={isOpen} onClose={onClose} size="2xl">
            <TeasyModalOverlay />
            <TeasyModalContent>
                <TeasyModalHeader>신규 물품 등록</TeasyModalHeader>
                <TeasyModalBody>
                    <VStack spacing={6} align="stretch">
                        <FormControl isRequired>
                            <TeasyFormLabel>카테고리</TeasyFormLabel>
                            <CustomSelect
                                options={INVENTORY_CATEGORIES}
                                value={category}
                                onChange={setCategory}
                                placeholder="선택"
                            />
                        </FormControl>

                        <FormControl isRequired>
                            <TeasyFormLabel>물품명</TeasyFormLabel>
                            <HStack spacing={2}>
                                <TeasyInput
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="물품명 입력"
                                />
                                <IconButton
                                    aria-label="add-to-list"
                                    icon={<MdAdd />}
                                    colorScheme="brand"
                                    onClick={handleAddItem}
                                    isLoading={isSubmitting}
                                />
                            </HStack>
                        </FormControl>

                        <Box bg="gray.50" p={3} borderRadius="xl" minH="200px" border="1px" borderColor="gray.100">
                            {isLoading && !isInitialized ? (
                                <Flex justify="center" align="center" h="150px">
                                    <Spinner color="brand.500" />
                                </Flex>
                            ) : (onItems.length + offItems.length) === 0 ? (
                                <Flex justify="center" align="center" h="150px">
                                    <TeasyPlaceholderText>등록된 물품이 없습니다. 상단에서 추가해 주세요.</TeasyPlaceholderText>
                                </Flex>
                            ) : (
                                <VStack align="stretch" spacing={4}>
                                    {/* ON SECTION */}
                                    <VStack align="stretch" spacing={2}>
                                        <Text fontSize="xs" fontWeight="800" color="brand.500" pl={1}>배송 정보 포함 ({onItems.length})</Text>
                                        <Reorder.Group
                                            as="div"
                                            axis="y"
                                            values={onItems}
                                            onReorder={(val) => handleReorder('on', val)}
                                            style={{ listStyleType: "none" }}
                                        >
                                            <VStack align="stretch" spacing={2}>
                                                {onItems.map((item, idx) => (
                                                    <MasterListItem
                                                        key={item.id}
                                                        item={item}
                                                        idx={idx}
                                                        onRemove={handleRemoveItem}
                                                        onToggle={handleToggleDelivery}
                                                        onDragEnd={handleSaveOrder}
                                                    />
                                                ))}
                                            </VStack>
                                        </Reorder.Group>
                                        {onItems.length === 0 && <TeasyPlaceholderText py={4}>배송 정보 포함 물품이 없습니다.</TeasyPlaceholderText>}
                                    </VStack>

                                    <TeasyDivider />

                                    {/* OFF SECTION */}
                                    <VStack align="stretch" spacing={2}>
                                        <Text fontSize="xs" fontWeight="800" color="gray.500" pl={1}>배송 정보 미포함 ({offItems.length})</Text>
                                        <Reorder.Group
                                            as="div"
                                            axis="y"
                                            values={offItems}
                                            onReorder={(val) => handleReorder('off', val)}
                                            style={{ listStyleType: "none" }}
                                        >
                                            <VStack align="stretch" spacing={2}>
                                                {offItems.map((item, idx) => (
                                                    <MasterListItem
                                                        key={item.id}
                                                        item={item}
                                                        idx={onItems.length + idx}
                                                        onRemove={handleRemoveItem}
                                                        onToggle={handleToggleDelivery}
                                                        onDragEnd={handleSaveOrder}
                                                    />
                                                ))}
                                            </VStack>
                                        </Reorder.Group>
                                        {offItems.length === 0 && <TeasyPlaceholderText py={4}>배송 정보 미포함 물품이 없습니다.</TeasyPlaceholderText>}
                                    </VStack>
                                </VStack>
                            )}
                        </Box>
                    </VStack>
                </TeasyModalBody>
                <TeasyModalFooter>
                    <TeasyButton version="secondary" onClick={onClose}>닫기</TeasyButton>
                </TeasyModalFooter>
            </TeasyModalContent>
        </TeasyModal>
    );
};
