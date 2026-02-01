// src/components/features/customer/reports/InstallScheduleForm/index.tsx
"use client";
import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { VStack, FormControl, Box, Spinner, HStack, Flex, Text, IconButton, Badge } from "@chakra-ui/react";
import { MdRemove, MdAdd, MdDragHandle } from "react-icons/md";
import { Reorder, useDragControls } from "framer-motion";
import { CustomSelect } from "@/components/common/CustomSelect";
import { TeasyDateTimeInput, TeasyFormLabel, TeasyInput, TeasyTextarea, TeasyPhoneInput } from "@/components/common/UIComponents";
import { useReportMetadata } from "@/hooks/useReportMetadata";
import { useInstallScheduleForm, INSTALL_SCHEDULE_CONSTANTS } from "./useInstallScheduleForm";
import { InstallScheduleFormData, InstallScheduleFormHandle, SelectedItem } from "./types";
import { getCircledNumber } from "@/components/features/asset/AssetModalUtils";
import { PhotoGrid } from "../common/PhotoGrid";

// --- Sub Component for Reorder Item (Shared Style with PurchaseConfirm) ---
const ListItem = ({ item, idx, isReadOnly, onUpdateQty, constraintsRef, colorScheme = "brand" }: {
    item: SelectedItem,
    idx: number,
    isReadOnly: boolean,
    onUpdateQty: (id: string, delta: number) => void,
    constraintsRef: React.RefObject<HTMLDivElement>,
    colorScheme?: string
}) => {
    const controls = useDragControls();

    return (
        <Reorder.Item
            as="div"
            value={item}
            dragListener={false}
            dragControls={controls}
            style={{ marginBottom: "8px", userSelect: "none" }}
        >
            <HStack
                justify="space-between"
                bg="white"
                px={3}
                py={1.5}
                borderRadius="md"
                shadow="xs"
                border="1px solid transparent"
                transition="all 0.2s"
                _active={!isReadOnly ? { bg: `${colorScheme}.50`, borderColor: `${colorScheme}.200` } : {}}
            >
                <HStack spacing={3} flex={1}>
                    {!isReadOnly && (
                        <Box
                            color="gray.300"
                            cursor="grab"
                            _active={{ cursor: "grabbing" }}
                            onPointerDown={(e) => controls.start(e)}
                            p={1}
                            borderRadius="sm"
                            _hover={{ bg: "gray.100", color: "gray.400" }}
                            display="flex"
                            alignItems="center"
                        >
                            <MdDragHandle size="18" />
                        </Box>
                    )}
                    <Text fontSize="sm" color="gray.700" fontWeight="medium">
                        <Text as="span" color={`${colorScheme}.500`} mr={2} fontWeight="bold">
                            {getCircledNumber(idx + 1)}
                        </Text>
                        {item.name}
                    </Text>
                </HStack>
                <HStack spacing={2}>
                    {!isReadOnly && (
                        <IconButton
                            aria-label="decrease-qty"
                            icon={<MdRemove />}
                            size="xs"
                            variant="ghost"
                            colorScheme="gray"
                            onClick={() => onUpdateQty(item.id, -1)}
                        />
                    )}
                    <Badge
                        bg={`${colorScheme}.50`}
                        color={`${colorScheme}.600`}
                        fontSize="11px"
                        px={2}
                        h="18px"
                        minW="30px"
                        borderRadius="4px"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                    >
                        {item.quantity}
                    </Badge>
                    {!isReadOnly && (
                        <IconButton
                            aria-label="increase-qty"
                            icon={<MdAdd />}
                            size="xs"
                            variant="ghost"
                            colorScheme="gray"
                            onClick={() => onUpdateQty(item.id, 1)}
                        />
                    )}
                </HStack>
            </HStack>
        </Reorder.Item>
    );
};

interface InstallScheduleFormProps {
    customer: { id: string, name: string, address?: string, phone?: string };
    activities?: any[];
    activityId?: string;
    initialData?: Partial<InstallScheduleFormData>;
    isReadOnly?: boolean;
    defaultManager?: string;
}

export const InstallScheduleForm = forwardRef<InstallScheduleFormHandle, InstallScheduleFormProps>(({
    customer,
    activities = [],
    activityId,
    initialData,
    isReadOnly = false,
    defaultManager = ""
}, ref) => {
    const { managerOptions, products, inventoryItems, rawAssets } = useReportMetadata();
    const {
        formData, setFormData,
        isLoading,
        handleFileUpload, removePhoto,
        addTask, updateTask, removeTask,
        submit,
        handleDelete
    } = useInstallScheduleForm({ customer, activities, activityId, initialData, defaultManager, rawAssets });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const productScrollRef = useRef<HTMLDivElement>(null);
    const supplyScrollRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
        submit: () => submit(managerOptions),
        delete: handleDelete
    }), [submit, handleDelete, managerOptions]);

    // Helper: Parse composition string to structured data
    const parseComposition = (composition: string) => {
        const supplies: { name: string, quantity: number }[] = [];
        if (!composition) return supplies;

        const parts = composition.split(/[,/]/);
        parts.forEach(part => {
            const match = part.match(/(.+)\s*[×x*]\s*(\d+)/) || part.match(/(.+)\s*\((\d+)\)/) || part.match(/(.+)\s*(\d+)개/);
            let name = part.trim();
            let qty = 1;

            if (match) {
                name = match[1].replace(/^[①-⑳]|^(\d+\.)/, "").trim();
                qty = parseInt(match[2]);
            } else {
                name = name.replace(/^[①-⑳]|^(\d+\.)/, "").trim();
            }
            if (name) supplies.push({ name, quantity: qty });
        });
        return supplies;
    };

    // Handle Item Selection (Products)
    const handleAddProduct = (val: string) => {
        if (isReadOnly || !val) return;
        const productInfo = products.find(p => p.value === val);
        if (!productInfo) return;

        // Create a unique instance ID for this product row
        const rowId = Math.random().toString(36).substr(2, 9);
        const newProducts = [...formData.selectedProducts, { id: rowId, name: productInfo.label, quantity: 1 }];

        const asset = rawAssets.find(a => a.name === productInfo.label && a.type === "product");
        let newSupplies = [...formData.selectedSupplies];

        if (asset?.composition) {
            const compItems = parseComposition(asset.composition);
            compItems.forEach(item => {
                const invInfo = inventoryItems.find(i => i.label === item.name);
                if (invInfo) {
                    newSupplies.push({
                        id: `${rowId}_${invInfo.value}`,
                        name: item.name,
                        quantity: 1, // Start with 1, matching product initial qty (Absolute 1:1)
                        category: invInfo.category,
                        isAuto: true,
                        linkedId: rowId
                    });
                }
            });
        }
        setFormData({ ...formData, selectedProducts: newProducts, selectedSupplies: newSupplies });
    };

    // Handle Item Selection (Supplies)
    const handleAddSupply = (val: string) => {
        if (isReadOnly || !val) return;
        const invInfo = inventoryItems.find(i => i.value === val);
        if (!invInfo) return;

        const existingIdx = formData.selectedSupplies.findIndex(s => s.id === val);
        let newSupplies = [...formData.selectedSupplies];
        if (existingIdx > -1) {
            newSupplies[existingIdx].quantity += 1;
        } else {
            newSupplies.push({
                id: val,
                name: invInfo.label,
                quantity: 1,
                category: invInfo.category,
                isAuto: false
            });
        }
        setFormData({ ...formData, selectedSupplies: newSupplies });
    };

    const handleUpdateQty = (type: "product" | "supply", id: string, delta: number) => {
        const field = type === "product" ? "selectedProducts" : "selectedSupplies";
        const list = [...formData[field]];
        const idx = list.findIndex(item => item.id === id);
        if (idx === -1) return;

        const targetItem = list[idx];
        const newQty = targetItem.quantity + delta;

        if (newQty <= 0) {
            if (window.confirm("항목을 삭제하시겠습니까?")) {
                if (type === "product") {
                    setFormData(prev => ({
                        ...prev,
                        selectedProducts: prev.selectedProducts.filter(p => p.id !== id),
                        selectedSupplies: prev.selectedSupplies.filter(s => s.linkedId !== id)
                    }));
                    return;
                }
                list.splice(idx, 1);
            } else return;
        } else {
            list[idx].quantity = newQty;

            // SYNC LOGIC: If product qty changes, update ONLY linked auto-supplies to MATCH newQty (Absolute 1:1)
            if (type === "product") {
                const updatedSupplies = formData.selectedSupplies.map(s => {
                    if (s.linkedId === id && s.isAuto) {
                        return { ...s, quantity: newQty }; // Identical to product current quantity
                    }
                    return s;
                });
                setFormData(prev => ({ ...prev, selectedProducts: list, selectedSupplies: updatedSupplies }));
                return;
            }
        }
        setFormData({ ...formData, [field]: list });
    };

    const handleReorder = (type: "product" | "supply", newOrder: SelectedItem[]) => {
        const field = type === "product" ? "selectedProducts" : "selectedSupplies";
        setFormData({ ...formData, [field]: newOrder });
    };

    return (
        <Box position="relative">
            {isLoading && (
                <Flex
                    position="absolute" top={0} left={0} right={0} bottom={0}
                    bg="whiteAlpha.800" zIndex={20} align="center" justify="center"
                    borderRadius="md"
                >
                    <VStack spacing={4}>
                        <Spinner size="xl" color="brand.500" thickness="4px" />
                        <Text fontWeight="bold" color="brand.600">처리 중...</Text>
                    </VStack>
                </Flex>
            )}
            <VStack spacing={6} align="stretch">
                <HStack spacing={4}>
                    <FormControl isRequired>
                        <TeasyFormLabel>시공 일시</TeasyFormLabel>
                        <TeasyDateTimeInput
                            value={formData.date}
                            onChange={(val: string) => !isReadOnly && setFormData({ ...formData, date: val })}
                            isDisabled={isReadOnly}
                        />
                    </FormControl>
                    <FormControl isRequired>
                        <TeasyFormLabel>담당자</TeasyFormLabel>
                        <CustomSelect
                            placeholder="선택"
                            value={formData.manager}
                            onChange={(val) => !isReadOnly && setFormData({ ...formData, manager: val })}
                            options={managerOptions}
                            isDisabled={isReadOnly}
                        />
                    </FormControl>
                </HStack>

                <FormControl isRequired>
                    <TeasyFormLabel>방문 주소</TeasyFormLabel>
                    <TeasyInput
                        value={formData.location}
                        onChange={(e: any) => !isReadOnly && setFormData({ ...formData, location: e.target.value })}
                        placeholder="전국 시공 주소 입력"
                        isDisabled={isReadOnly}
                    />
                </FormControl>

                <FormControl isRequired>
                    <TeasyFormLabel>연락처</TeasyFormLabel>
                    <TeasyPhoneInput
                        value={formData.phone}
                        onChange={(val: string) => !isReadOnly && setFormData({ ...formData, phone: val })}
                        placeholder="000-0000-0000"
                        isDisabled={isReadOnly}
                    />
                </FormControl>

                <FormControl isRequired>
                    <TeasyFormLabel>시공 상품</TeasyFormLabel>
                    <VStack align="stretch" spacing={3}>
                        <CustomSelect
                            placeholder="선택"
                            value=""
                            onChange={handleAddProduct}
                            options={products}
                            isDisabled={isReadOnly}
                        />
                        {formData.selectedProducts.length > 0 && (
                            <Box p={3} bg="gray.50" borderRadius="md" border="1px" borderColor="gray.100" ref={productScrollRef}>
                                <Reorder.Group
                                    axis="y"
                                    values={formData.selectedProducts}
                                    onReorder={(val) => handleReorder("product", val)}
                                    style={{ listStyleType: "none" }}
                                >
                                    {formData.selectedProducts.map((item, idx) => (
                                        <ListItem
                                            key={item.id}
                                            item={item}
                                            idx={idx}
                                            isReadOnly={isReadOnly}
                                            onUpdateQty={(id, delta) => handleUpdateQty("product", id, delta)}
                                            constraintsRef={productScrollRef}
                                        />
                                    ))}
                                </Reorder.Group>
                            </Box>
                        )}
                    </VStack>
                </FormControl>

                <FormControl>
                    <TeasyFormLabel>준비 물품</TeasyFormLabel>
                    <VStack align="stretch" spacing={3}>
                        <CustomSelect
                            placeholder="선택"
                            value=""
                            onChange={handleAddSupply}
                            options={inventoryItems.filter(i => !i.isDivider)}
                            isDisabled={isReadOnly}
                        />
                        {formData.selectedSupplies.length > 0 && (
                            <Box p={3} bg="purple.50" borderRadius="md" border="1px" borderColor="purple.100" ref={supplyScrollRef}>
                                <Reorder.Group
                                    axis="y"
                                    values={formData.selectedSupplies}
                                    onReorder={(val) => handleReorder("supply", val)}
                                    style={{ listStyleType: "none" }}
                                >
                                    {formData.selectedSupplies.map((item, idx) => {
                                        const prevItem = formData.selectedSupplies[idx - 1];
                                        const showDivider = prevItem && prevItem.isAuto && !item.isAuto;

                                        return (
                                            <React.Fragment key={item.id}>
                                                {showDivider && (
                                                    <Box borderTop="1px dashed" borderColor="purple.200" my={2} mx={1} />
                                                )}
                                                <ListItem
                                                    item={item}
                                                    idx={idx}
                                                    isReadOnly={isReadOnly}
                                                    onUpdateQty={(id, delta) => handleUpdateQty("supply", id, delta)}
                                                    constraintsRef={supplyScrollRef}
                                                    colorScheme="purple"
                                                />
                                            </React.Fragment>
                                        );
                                    })}
                                </Reorder.Group>
                                <Text fontSize="xs" color="purple.400" mt={2} textAlign="right" fontWeight="medium">
                                    * 저장 시 위 물량만큼 재고에서 자동 차감됩니다.
                                </Text>
                            </Box>
                        )}
                    </VStack>
                </FormControl>

                {/* 수행 요망 (Tasks) */}
                <FormControl>
                    <TeasyFormLabel>수행 요망</TeasyFormLabel>
                    <Box bg="gray.50" borderRadius="md" p={3} border="1px" borderColor="gray.100">
                        <VStack spacing={3} align="stretch">
                            {/* 시공 전 */}
                            <Box>
                                <HStack spacing={2} mb={3} px={1}>
                                    <Text fontSize="13px" fontWeight="500" color="gray.400">· 시공 전</Text>
                                </HStack>
                                <VStack spacing={2} align="stretch">
                                    {(formData.tasksBefore || [""]).map((task, idx) => (
                                        <HStack
                                            key={idx}
                                            spacing={3}
                                            bg="white"
                                            px={3}
                                            py={1.5}
                                            borderRadius="md"
                                            shadow="xs"
                                            w="full"
                                        >
                                            <Text fontSize="sm" fontWeight="bold" color="brand.500" minW="24px" textAlign="center">
                                                {getCircledNumber(idx + 1)}
                                            </Text>
                                            <TeasyInput
                                                size="sm"
                                                variant="unstyled"
                                                placeholder="입력"
                                                value={task}
                                                onChange={(e: any) => !isReadOnly && updateTask('before', idx, e.target.value)}
                                                isDisabled={isReadOnly}
                                                fontSize="sm"
                                                color="gray.700"
                                                h="24px"
                                                lineHeight="1.6"
                                                py={0}
                                            />
                                            {!isReadOnly && (
                                                <HStack spacing={0}>
                                                    <IconButton
                                                        aria-label="remove-task"
                                                        icon={<MdRemove />}
                                                        size="xs"
                                                        variant="ghost"
                                                        colorScheme="gray"
                                                        onClick={() => removeTask('before', idx)}
                                                    />
                                                    <Text color="gray.200" fontSize="10px">/</Text>
                                                    <IconButton
                                                        aria-label="add-task"
                                                        icon={<MdAdd />}
                                                        size="xs"
                                                        variant="ghost"
                                                        colorScheme="gray"
                                                        onClick={() => addTask('before')}
                                                    />
                                                </HStack>
                                            )}
                                        </HStack>
                                    ))}
                                </VStack>
                            </Box>

                            {/* 시공 후 */}
                            <Box>
                                <HStack spacing={2} mb={3} px={1}>
                                    <Text fontSize="13px" fontWeight="500" color="gray.400">· 시공 후</Text>
                                </HStack>
                                <VStack spacing={2} align="stretch">
                                    {(formData.tasksAfter || [""]).map((task, idx) => (
                                        <HStack
                                            key={idx}
                                            spacing={3}
                                            bg="white"
                                            px={3}
                                            py={1.5}
                                            borderRadius="md"
                                            shadow="xs"
                                            w="full"
                                        >
                                            <Text fontSize="sm" fontWeight="bold" color="brand.500" minW="24px" textAlign="center">
                                                {getCircledNumber(idx + 1)}
                                            </Text>
                                            <TeasyInput
                                                size="sm"
                                                variant="unstyled"
                                                placeholder="입력"
                                                value={task}
                                                onChange={(e: any) => !isReadOnly && updateTask('after', idx, e.target.value)}
                                                isDisabled={isReadOnly}
                                                fontSize="sm"
                                                color="gray.700"
                                                h="24px"
                                                lineHeight="1.6"
                                                py={0}
                                            />
                                            {!isReadOnly && (
                                                <HStack spacing={0}>
                                                    <IconButton
                                                        aria-label="remove-task"
                                                        icon={<MdRemove />}
                                                        size="xs"
                                                        variant="ghost"
                                                        colorScheme="gray"
                                                        onClick={() => removeTask('after', idx)}
                                                    />
                                                    <Text color="gray.200" fontSize="10px">/</Text>
                                                    <IconButton
                                                        aria-label="add-task"
                                                        icon={<MdAdd />}
                                                        size="xs"
                                                        variant="ghost"
                                                        colorScheme="gray"
                                                        onClick={() => addTask('after')}
                                                    />
                                                </HStack>
                                            )}
                                        </HStack>
                                    ))}
                                </VStack>
                            </Box>
                        </VStack>
                    </Box>
                </FormControl>

                <FormControl>
                    <TeasyFormLabel>현장 사진 ({formData.photos.length}/{INSTALL_SCHEDULE_CONSTANTS.MAX_PHOTOS})</TeasyFormLabel>
                    <Box p={4} border="1px dashed" borderColor="gray.200" borderRadius="xl" bg="gray.50">
                        <PhotoGrid
                            photos={formData.photos}
                            isReadOnly={isReadOnly}
                            onAddClick={() => fileInputRef.current?.click()}
                            onRemoveClick={removePhoto}
                            maxPhotos={INSTALL_SCHEDULE_CONSTANTS.MAX_PHOTOS}
                        />
                        <input type="file" multiple accept="image/*" ref={fileInputRef} style={{ display: "none" }} onChange={(e) => handleFileUpload(e.target.files)} />
                    </Box>
                </FormControl>

                <FormControl>
                    <TeasyFormLabel>참고 사항</TeasyFormLabel>
                    <TeasyTextarea
                        value={formData.memo}
                        onChange={(e: any) => !isReadOnly && setFormData({ ...formData, memo: e.target.value })}
                        placeholder="시공 시 주의사항 등 입력"
                        isDisabled={isReadOnly}
                    />
                </FormControl>
            </VStack>
        </Box>
    );
});

InstallScheduleForm.displayName = "InstallScheduleForm";
