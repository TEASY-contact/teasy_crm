// src/components/features/customer/reports/InstallCompleteForm/index.tsx
"use client";
import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { VStack, FormControl, Box, Spinner, HStack, Flex, Text, IconButton, Badge, Checkbox, useToast } from "@chakra-ui/react";
import { MdRemove, MdAdd, MdDragHandle } from "react-icons/md";
import { formatPhone } from "@/utils/formatter";
import { Reorder, useDragControls } from "framer-motion";
import { CustomSelect } from "@/components/common/CustomSelect";
import { TeasyDateTimeInput, TeasyFormLabel, TeasyInput, TeasyTextarea, TeasyPhoneInput, TeasyFormGroup } from "@/components/common/UIComponents";
import { applyColonStandard, normalizeText } from "@/utils/textFormatter";
import { useReportMetadata } from "@/hooks/useReportMetadata";
import { useInstallCompleteForm } from "./useInstallCompleteForm";
import { InstallCompleteFormData, InstallCompleteFormHandle, INSTALL_COMPLETE_CONSTANTS } from "./types";
import { SelectedItem } from "../InstallScheduleForm/types";
import { getCircledNumber } from "@/components/features/asset/AssetModalUtils";
import { PhotoGrid } from "../common/PhotoGrid";

// --- Sub Component for Reorder Item ---
const ListItem = ({ item, idx, isReadOnly, onUpdateQty, constraintsRef, onDragEnd, colorScheme = "brand" }: {
    item: SelectedItem,
    idx: number,
    isReadOnly: boolean,
    onUpdateQty: (id: string, delta: number) => void,
    constraintsRef: React.RefObject<HTMLDivElement>,
    onDragEnd?: () => void,
    colorScheme?: string
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
                py={1.5}
                minH="36px"
                borderRadius="md"
                shadow="xs"
                border="1px solid"
                borderColor="gray.100"
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
                    {item.category && (
                        <Badge
                            variant="subtle"
                            bg="gray.100"
                            color="gray.500"
                            fontSize="10px"
                            px={2}
                            h="18px"
                            borderRadius="15%"
                            textTransform="none"
                            fontWeight="600"
                            mr={3}
                        >
                            {item.category}
                        </Badge>
                    )}
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
                        bg="purple.50"
                        color="purple.700"
                        fontSize="11px"
                        px={1}
                        h="20px"
                        minW="24px"
                        borderRadius="sm"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        fontWeight="700"
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

interface InstallCompleteFormProps {
    customer: { id: string, name: string, address?: string, phone?: string };
    activities?: any[];
    activityId?: string;
    initialData?: Partial<InstallCompleteFormData>;
    isReadOnly?: boolean;
    defaultManager?: string;
}

export const InstallCompleteForm = forwardRef<InstallCompleteFormHandle, InstallCompleteFormProps>(({
    customer,
    activities = [],
    activityId,
    initialData,
    isReadOnly = false,
    defaultManager = ""
}, ref) => {
    const toast = useToast();
    const { managerOptions, products, inventoryItems, rawAssets } = useReportMetadata();
    const {
        formData, setFormData,
        isLoading,
        handleFileUpload, removePhoto,
        toggleTask,
        submit,
        handleDelete
    } = useInstallCompleteForm({ customer, activities, activityId, initialData, defaultManager, rawAssets });

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
                    // Merging Logic: Check if an auto-supply with the same name already exists
                    const existingIdx = newSupplies.findIndex(s => s.name === item.name && s.isAuto);
                    if (existingIdx > -1) {
                        const existing = newSupplies[existingIdx];
                        const linkedIds = (existing.linkedId || "").split(",").filter(Boolean);
                        if (!linkedIds.includes(rowId)) {
                            newSupplies[existingIdx] = {
                                ...existing,
                                quantity: existing.quantity + 1,
                                linkedId: [...linkedIds, rowId].join(",")
                            };
                        }
                    } else {
                        newSupplies.push({
                            id: `auto_${invInfo.value}`,
                            name: item.name,
                            quantity: 1,
                            category: invInfo.category,
                            isAuto: true,
                            linkedId: rowId
                        });
                    }
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
            if (window.confirm("해당 데이터 삭제를 희망하십니까?")) {
                if (type === "product") {
                    const remainingProducts = formData.selectedProducts.filter(p => p.id !== id);
                    const updatedSupplies = formData.selectedSupplies.map(s => {
                        if (s.isAuto && s.linkedId && s.linkedId.split(",").includes(id)) {
                            const remainingLinks = s.linkedId.split(",").filter(lid => lid !== id);
                            const newTotal = remainingProducts.reduce((sum, p) => {
                                if (remainingLinks.includes(p.id)) return sum + p.quantity;
                                return sum;
                            }, 0);
                            return { ...s, linkedId: remainingLinks.join(","), quantity: newTotal };
                        }
                        return s;
                    }).filter(s => !s.isAuto || (s.linkedId && s.linkedId.length > 0));

                    setFormData(prev => ({
                        ...prev,
                        selectedProducts: remainingProducts,
                        selectedSupplies: updatedSupplies
                    }));
                    return;
                }
                setFormData(prev => ({
                    ...prev,
                    [field]: prev[field].filter(p => p.id !== id)
                }));
            }
            return;
        }

        list[idx].quantity = newQty;

        // SYNC LOGIC: If product qty changes, update merged auto-supplies
        if (type === "product") {
            const updatedSupplies = formData.selectedSupplies.map(s => {
                if (s.isAuto && s.linkedId && s.linkedId.split(",").includes(id)) {
                    const productIds = s.linkedId.split(",");
                    const totalQty = list.reduce((sum, p) => {
                        if (productIds.includes(p.id)) return sum + p.quantity;
                        return sum;
                    }, 0);
                    return { ...s, quantity: totalQty };
                }
                return s;
            });
            setFormData(prev => ({ ...prev, selectedProducts: list, selectedSupplies: updatedSupplies }));
            return;
        }

        setFormData(prev => ({ ...prev, [field]: list }));
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
                    backdropFilter="blur(2px)"
                >
                    <VStack spacing={4}>
                        <Spinner size="xl" color="brand.500" thickness="4px" />
                        <Text fontWeight="medium" color="brand.600">처리 중...</Text>
                    </VStack>
                </Flex>
            )}
            <VStack spacing={6} align="stretch">
                <HStack w="full" spacing={4}>
                    <FormControl isRequired flex={1}>
                        <TeasyFormLabel>완료 일시</TeasyFormLabel>
                        {isReadOnly ? (
                            <TeasyInput value={formData.date} isReadOnly />
                        ) : (
                            <TeasyDateTimeInput
                                value={formData.date}
                                onChange={(val: string) => setFormData({ ...formData, date: val })}
                                limitType="past"
                            />
                        )}
                    </FormControl>
                    <FormControl isRequired flex={1}>
                        <TeasyFormLabel>담당자</TeasyFormLabel>
                        {isReadOnly ? (
                            <TeasyInput
                                value={managerOptions.find(o => o.value === formData.manager)?.label || formData.manager}
                                isReadOnly
                            />
                        ) : (
                            <CustomSelect
                                placeholder="선택"
                                value={formData.manager}
                                onChange={(val) => !isReadOnly && setFormData({ ...formData, manager: val })}
                                options={managerOptions}
                                isDisabled={isReadOnly}
                            />
                        )}
                    </FormControl>
                </HStack>

                <FormControl isRequired>
                    <TeasyFormLabel>주소</TeasyFormLabel>
                    <TeasyInput
                        value={formData.location}
                        onChange={(e: any) => setFormData({ ...formData, location: normalizeText(e.target.value) })}
                        placeholder="전국 시공 주소 입력"
                        isReadOnly={isReadOnly}
                    />
                </FormControl>

                <FormControl isRequired>
                    <TeasyFormLabel>연락처</TeasyFormLabel>
                    {isReadOnly ? (
                        <TeasyInput value={formatPhone(formData.phone)} isReadOnly />
                    ) : (
                        <TeasyPhoneInput
                            value={formData.phone}
                            onChange={(val: string) => setFormData({ ...formData, phone: val })}
                            placeholder="000-0000-0000"
                        />
                    )}
                </FormControl>

                <FormControl>
                    <TeasyFormLabel>시공 내역</TeasyFormLabel>
                    <VStack align="stretch" spacing={3}>
                        <CustomSelect
                            placeholder="선택"
                            value=""
                            onChange={handleAddProduct}
                            options={products}
                            isDisabled={isReadOnly}
                        />
                        {formData.selectedProducts.length > 0 && (
                            <TeasyFormGroup ref={productScrollRef}>
                                <Reorder.Group
                                    axis="y"
                                    values={formData.selectedProducts}
                                    onReorder={(val) => handleReorder("product", val as SelectedItem[])}
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
                                            onDragEnd={() => toast({ title: "순서가 변경되었습니다.", status: "success", position: "top", duration: 1500 })}
                                        />
                                    ))}
                                </Reorder.Group>
                            </TeasyFormGroup>
                        )}
                    </VStack>
                </FormControl>

                <FormControl>
                    <TeasyFormLabel>사용 내역</TeasyFormLabel>
                    <VStack align="stretch" spacing={3}>
                        <CustomSelect
                            placeholder="선택"
                            value=""
                            onChange={handleAddSupply}
                            options={inventoryItems.filter(i => !i.isDivider)}
                            isDisabled={isReadOnly}
                        />
                        {formData.selectedSupplies.length > 0 && (
                            <TeasyFormGroup ref={supplyScrollRef}>
                                <Reorder.Group
                                    axis="y"
                                    values={formData.selectedSupplies}
                                    onReorder={(val) => handleReorder("supply", val as SelectedItem[])}
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
                                                    colorScheme="brand"
                                                    onDragEnd={() => toast({ title: "순서가 변경되었습니다.", status: "success", position: "top", duration: 1500 })}
                                                />
                                            </React.Fragment>
                                        );
                                    })}
                                </Reorder.Group>
                                <Text fontSize="xs" color="gray.400" mt={2} textAlign="right" fontWeight="normal">
                                    * 저장 시 위 물량만큼 재고에서 자동 차감됩니다.
                                </Text>
                            </TeasyFormGroup>
                        )}
                    </VStack>
                </FormControl>

                {/* 수행 업무 결과 */}
                <FormControl>
                    <TeasyFormLabel>수행 결과</TeasyFormLabel>
                    <TeasyFormGroup>
                        <VStack spacing={5} align="stretch">
                            {/* 시공 전 */}
                            <Box>
                                <HStack justify="space-between" align="center">
                                    <TeasyFormLabel sub mb={2}>시공 전</TeasyFormLabel>
                                    <Text fontSize="11px" color="gray.400" pr={5.5} fontWeight="bold" mt={-1}>✓</Text>
                                </HStack>
                                <VStack spacing={2} align="stretch">
                                    {formData.tasksBefore.map((task, idx) => (
                                        <HStack
                                            key={idx}
                                            spacing={3}
                                            bg="white"
                                            px={3}
                                            py={1.5}
                                            minH="36px"
                                            borderRadius="md"
                                            shadow="xs"
                                            border="1px solid"
                                            borderColor="gray.100"
                                            w="full"
                                            justify="space-between"
                                        >
                                            <HStack spacing={1} flex={1}>
                                                <Text fontSize="sm" fontWeight="bold" color="brand.500" minW="20px" textAlign="center">
                                                    {getCircledNumber(idx + 1)}
                                                </Text>
                                                <Text fontSize="sm" color="gray.700" fontWeight="medium">
                                                    {task.text}
                                                </Text>
                                            </HStack>
                                            <Checkbox
                                                isChecked={task.completed}
                                                onChange={() => !isReadOnly && toggleTask?.('before', idx)}
                                                isDisabled={isReadOnly}
                                                colorScheme="brand"
                                            />
                                        </HStack>
                                    ))}
                                </VStack>
                            </Box>

                            {/* 시공 후 */}
                            <Box>
                                <HStack justify="space-between" align="center">
                                    <TeasyFormLabel sub mb={2}>시공 후</TeasyFormLabel>
                                    <Text fontSize="11px" color="gray.400" pr={5.5} fontWeight="bold" mt={-1}>✓</Text>
                                </HStack>
                                <VStack spacing={2} align="stretch">
                                    {formData.tasksAfter.map((task, idx) => (
                                        <HStack
                                            key={idx}
                                            spacing={3}
                                            bg="white"
                                            px={3}
                                            py={1.5}
                                            minH="36px"
                                            borderRadius="md"
                                            shadow="xs"
                                            border="1px solid"
                                            borderColor="gray.100"
                                            w="full"
                                            justify="space-between"
                                        >
                                            <HStack spacing={1} flex={1}>
                                                <Text fontSize="sm" fontWeight="bold" color="brand.500" minW="20px" textAlign="center">
                                                    {getCircledNumber(formData.tasksBefore.length + idx + 1)}
                                                </Text>
                                                <Text fontSize="sm" color="gray.700" fontWeight="medium">
                                                    {task.text}
                                                </Text>
                                            </HStack>
                                            <Checkbox
                                                isChecked={task.completed}
                                                onChange={() => !isReadOnly && toggleTask?.('after', idx)}
                                                isDisabled={isReadOnly}
                                                colorScheme="brand"
                                            />
                                        </HStack>
                                    ))}
                                </VStack>
                            </Box>

                            {/* 사유 입력창 (Incomplete Reason) */}
                            {[...formData.tasksBefore, ...formData.tasksAfter].some(t => !t.completed) && (
                                <Box>
                                    <TeasyFormLabel sub>수행불가 사유</TeasyFormLabel>
                                    <TeasyTextarea
                                        value={formData.incompleteReason}
                                        onChange={(e: any) => !isReadOnly && setFormData({ ...formData, incompleteReason: e.target.value })}
                                        placeholder="체크되지 않은 업무가 있습니다. 사유를 입력해주세요."
                                        size="sm"
                                        bg="gray.50"
                                        pl={3}
                                        isDisabled={isReadOnly}
                                        w="full"
                                    />
                                </Box>
                            )}
                        </VStack>
                    </TeasyFormGroup>
                </FormControl>

                <FormControl isRequired>
                    <TeasyFormLabel>현장 사진 ({formData.photos.length}/{INSTALL_COMPLETE_CONSTANTS.MAX_PHOTOS})</TeasyFormLabel>
                    <TeasyFormGroup bg="white" borderStyle="dashed" p={4} borderRadius="xl">
                        <PhotoGrid
                            photos={formData.photos}
                            isReadOnly={isReadOnly}
                            onAddClick={() => fileInputRef.current?.click()}
                            onRemoveClick={(idx) => removePhoto(idx, false)}
                            maxPhotos={INSTALL_COMPLETE_CONSTANTS.MAX_PHOTOS}
                        />
                        <input
                            type="file"
                            multiple
                            accept="image/*"
                            ref={fileInputRef}
                            style={{ display: "none" }}
                            onChange={(e) => {
                                if (e.target.files) {
                                    handleFileUpload(e.target.files);
                                    e.target.value = '';
                                }
                            }}
                        />
                    </TeasyFormGroup>
                </FormControl>



                <FormControl>
                    <TeasyFormLabel>참고 사항</TeasyFormLabel>
                    <TeasyTextarea
                        value={formData.memo}
                        onChange={(e: any) => setFormData({ ...formData, memo: applyColonStandard(e.target.value) })}
                        placeholder="특이사항 또는 고객 전달사항 입력"
                        isReadOnly={isReadOnly}
                    />
                </FormControl>
            </VStack>
        </Box>
    );
});

InstallCompleteForm.displayName = "InstallCompleteForm";
