// src/components/features/customer/reports/AsScheduleForm/index.tsx
/** v2.2 | 2026-02-04 | Precision Audit: Reorder, Row Instances, and Label standard sync */
"use client";
import React, { forwardRef, useImperativeHandle, useRef, useEffect } from "react";
import { VStack, FormControl, Box, Spinner, HStack, Flex, Text, IconButton, Divider, Badge, useToast } from "@chakra-ui/react";
import { MdRemove, MdAdd, MdDragHandle } from "react-icons/md";
import { formatPhone } from "@/utils/formatter";
import { Reorder, useDragControls } from "framer-motion";
import { CustomSelect } from "@/components/common/CustomSelect";
import {
    TeasyDateTimeInput,
    TeasyFormLabel,
    TeasyInput,
    TeasyTextarea,
    TeasyPhoneInput,
    TeasyFormGroup
} from "@/components/common/UIComponents";
import { useReportMetadata } from "@/hooks/useReportMetadata";
import { applyColonStandard, normalizeText } from "@/utils/textFormatter";
import { useAsScheduleForm } from "./useAsScheduleForm";
import { AsScheduleFormData, AsScheduleFormHandle, AS_SCHEDULE_CONSTANTS, SelectedItem } from "./types";
import { getCircledNumber } from "@/components/features/asset/AssetModalUtils";
import { PhotoGrid } from "../common/PhotoGrid";

interface AsScheduleFormProps {
    customer: { id: string, name: string, address?: string, phone?: string };
    activities?: any[];
    activityId?: string;
    initialData?: Partial<AsScheduleFormData>;
    isReadOnly?: boolean;
    defaultManager?: string;
}

// --- Sub Component for Product List Item ---
const ProductListItem = ({ item, idx, isReadOnly, onUpdateQty, constraintsRef, onDragEnd }: {
    item: SelectedItem,
    idx: number,
    isReadOnly: boolean,
    onUpdateQty: (id: string, delta: number) => void,
    constraintsRef: React.RefObject<HTMLDivElement>,
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
            style={{ marginBottom: "0px", userSelect: "none" }}
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
                _active={!isReadOnly ? { bg: "brand.50", borderColor: "brand.200" } : {}}
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
                        <Text as="span" color="brand.500" mr={2} fontWeight="bold">
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

export const AsScheduleForm = forwardRef<AsScheduleFormHandle, AsScheduleFormProps>(({
    customer,
    activities = [],
    activityId,
    initialData,
    isReadOnly = false,
    defaultManager = ""
}, ref) => {
    const toast = useToast();
    const { managerOptions, visitAsTypeOptions: asTypeOptions, products, inventoryItems } = useReportMetadata();
    const {
        formData, setFormData,
        isLoading,
        handleFileUpload, removePhoto,
        addSymptom, updateSymptom, removeSymptom,
        addTask, updateTask, removeTask,
        handleAddProduct, handleUpdateQty, handleReorder,
        handleAddSupply, handleUpdateSupplyQty, handleReorderSupplies,
        submit,
        handleDelete
    } = useAsScheduleForm({ customer, activities, activityId, initialData, isReadOnly, defaultManager });

    const silentRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const productScrollRef = useRef<HTMLDivElement>(null);
    const supplyScrollRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
        submit: () => submit(managerOptions),
        delete: handleDelete
    }), [submit, handleDelete, managerOptions]);

    // Silent Focus Guard (v126.3)
    useEffect(() => {
        if (silentRef.current) silentRef.current.focus();
    }, []);

    return (
        <Box position="relative">
            {/* Focus Guard */}
            <Box ref={silentRef} tabIndex={0} position="absolute" top="-100px" left="-100px" opacity={0} pointerEvents="none" />

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
                <HStack spacing={4}>
                    <FormControl isRequired>
                        <TeasyFormLabel>방문 일시</TeasyFormLabel>
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
                    <FormControl isRequired>
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
                    <TeasyFormLabel>방문 주소</TeasyFormLabel>
                    <TeasyInput
                        value={formData.location}
                        onChange={(e: any) => setFormData({ ...formData, location: normalizeText(e.target.value) })}
                        placeholder="현장 주소 입력"
                        isReadOnly={isReadOnly}
                    />
                </FormControl>

                <FormControl isRequired flex={1}>
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

                <HStack spacing={4} align="flex-start">
                    <FormControl isRequired flex={1}>
                        <TeasyFormLabel>유형 선택</TeasyFormLabel>
                        {isReadOnly ? (
                            <TeasyInput value={formData.asType} isReadOnly />
                        ) : (
                            <CustomSelect
                                options={asTypeOptions}
                                value={formData.asType}
                                onChange={(val) => setFormData({ ...formData, asType: val })}
                                placeholder="A/S 유형 선택"
                                isDisabled={isReadOnly}
                            />
                        )}
                    </FormControl>

                    <FormControl flex={1.2}>
                        <TeasyFormLabel>관련 상품</TeasyFormLabel>
                        {!isReadOnly && (
                            <CustomSelect
                                placeholder="상품 선택"
                                value=""
                                onChange={(val) => handleAddProduct(val, products)}
                                options={products}
                                isDisabled={isReadOnly}
                            />
                        )}
                    </FormControl>
                </HStack>

                {/* 관련 상품 리스트: Reorder & Instance row ID 기반 */}
                {formData.selectedProducts.length > 0 && (
                    <TeasyFormGroup ref={productScrollRef} mt={-2}>
                        <Reorder.Group
                            axis="y"
                            values={formData.selectedProducts}
                            onReorder={handleReorder}
                            style={{ listStyleType: "none" }}
                        >
                            <VStack align="stretch" spacing={2}>
                                {formData.selectedProducts.map((item, idx) => (
                                    <ProductListItem
                                        key={item.id}
                                        item={item}
                                        idx={idx}
                                        isReadOnly={isReadOnly}
                                        onUpdateQty={handleUpdateQty}
                                        constraintsRef={productScrollRef}
                                        onDragEnd={() => toast({ title: "순서가 변경되었습니다.", status: "success", position: "top", duration: 1500 })}
                                    />
                                ))}
                            </VStack>
                        </Reorder.Group>
                    </TeasyFormGroup>
                )}

                {/* 접수 증상: 수행 요망 스타일 (배경 박스) */}
                <FormControl isRequired>
                    <TeasyFormLabel>접수 증상</TeasyFormLabel>
                    <Box bg="gray.50" borderRadius="md" p={3} border="1px" borderColor="gray.100">
                        <VStack spacing={2} align="stretch">
                            {formData.symptoms.map((symptom, idx) => (
                                <HStack
                                    key={idx}
                                    spacing={3}
                                    bg="white"
                                    px={3}
                                    py={1.5}
                                    minH="38px"
                                    borderRadius="md"
                                    shadow="xs"
                                    border="1px solid"
                                    borderColor="gray.100"
                                    w="full"
                                    justify="space-between"
                                    transition="all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
                                    _hover={!isReadOnly ? { transform: "translateY(-1px)", shadow: "sm", borderColor: "brand.100" } : {}}
                                    _active={!isReadOnly ? { transform: "scale(0.98)" } : {}}
                                >
                                    <HStack spacing={2} flex={1}>
                                        <Text fontSize="sm" fontWeight="bold" color="brand.500" minW="20px" textAlign="center">
                                            {getCircledNumber(idx + 1)}
                                        </Text>
                                        {isReadOnly ? (
                                            <Text fontSize="sm" color="gray.700" fontWeight="medium">
                                                {symptom}
                                            </Text>
                                        ) : (
                                            <TeasyInput
                                                size="sm"
                                                variant="unstyled"
                                                placeholder="증상 또는 요청사항 입력"
                                                value={symptom}
                                                onChange={(e: any) => updateSymptom(idx, e.target.value)}
                                                fontSize="sm"
                                                color="gray.700"
                                                h="24px"
                                                lineHeight="1.6"
                                                py={0}
                                            />
                                        )}
                                    </HStack>
                                    {!isReadOnly && (
                                        <HStack spacing={1}>
                                            <IconButton
                                                aria-label="remove-symptom"
                                                icon={<MdRemove />}
                                                size="xs"
                                                variant="ghost"
                                                colorScheme="gray"
                                                onClick={() => removeSymptom(idx)}
                                            />
                                            <Divider orientation="vertical" h="10px" borderColor="gray.200" />
                                            <IconButton
                                                aria-label="add-symptom"
                                                icon={<MdAdd />}
                                                size="xs"
                                                variant="ghost"
                                                colorScheme="gray"
                                                onClick={() => addSymptom()}
                                                isDisabled={formData.symptoms.length >= 20}
                                            />
                                        </HStack>
                                    )}
                                </HStack>
                            ))}
                        </VStack>
                    </Box>
                </FormControl>

                {/* 수행 요망 */}
                <FormControl isRequired>
                    <TeasyFormLabel>수행 요망</TeasyFormLabel>
                    <Box bg="gray.50" borderRadius="md" p={3} border="1px" borderColor="gray.100">
                        <VStack spacing={2} align="stretch">
                            {formData.tasks.map((task, idx) => (
                                <HStack
                                    key={idx}
                                    spacing={3}
                                    bg="white"
                                    px={3}
                                    py={1.5}
                                    minH="38px"
                                    borderRadius="md"
                                    shadow="xs"
                                    border="1px solid"
                                    borderColor="gray.100"
                                    w="full"
                                    justify="space-between"
                                    transition="all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
                                    _hover={!isReadOnly ? { transform: "translateY(-1px)", shadow: "sm", borderColor: "brand.100" } : {}}
                                    _active={!isReadOnly ? { transform: "scale(0.98)" } : {}}
                                >
                                    <HStack spacing={2} flex={1}>
                                        <Text fontSize="sm" fontWeight="bold" color="brand.500" minW="20px" textAlign="center">
                                            {getCircledNumber(idx + 1)}
                                        </Text>
                                        {isReadOnly ? (
                                            <Text fontSize="sm" color="gray.700" fontWeight="medium">
                                                {task}
                                            </Text>
                                        ) : (
                                            <TeasyInput
                                                size="sm"
                                                variant="unstyled"
                                                placeholder="수행 요망 사항 입력"
                                                value={task}
                                                onChange={(e: any) => updateTask(idx, e.target.value)}
                                                fontSize="sm"
                                                color="gray.700"
                                                h="24px"
                                                lineHeight="1.6"
                                                py={0}
                                            />
                                        )}
                                    </HStack>
                                    {!isReadOnly && (
                                        <HStack spacing={1}>
                                            <IconButton
                                                aria-label="remove-task"
                                                icon={<MdRemove />}
                                                size="xs"
                                                variant="ghost"
                                                colorScheme="gray"
                                                onClick={() => removeTask(idx)}
                                            />
                                            <Divider orientation="vertical" h="10px" borderColor="gray.200" />
                                            <IconButton
                                                aria-label="add-task"
                                                icon={<MdAdd />}
                                                size="xs"
                                                variant="ghost"
                                                colorScheme="gray"
                                                onClick={() => addTask()}
                                                isDisabled={formData.tasks.length >= 20}
                                            />
                                        </HStack>
                                    )}
                                </HStack>
                            ))}
                        </VStack>
                    </Box>
                </FormControl>

                {/* 준비 물품 (추가됨) */}
                <FormControl>
                    <TeasyFormLabel>준비 물품</TeasyFormLabel>
                    <VStack align="stretch" spacing={3}>
                        {!isReadOnly && (
                            <CustomSelect
                                placeholder="물품 선택"
                                value=""
                                onChange={(val) => handleAddSupply(val, inventoryItems)}
                                options={inventoryItems}
                                isDisabled={isReadOnly}
                            />
                        )}
                        {formData.selectedSupplies.length > 0 && (
                            <TeasyFormGroup ref={supplyScrollRef}>
                                <Reorder.Group
                                    axis="y"
                                    values={formData.selectedSupplies}
                                    onReorder={handleReorderSupplies}
                                    style={{ listStyleType: "none" }}
                                >
                                    <VStack align="stretch" spacing={2}>
                                        {formData.selectedSupplies.map((item, idx) => (
                                            <ProductListItem
                                                key={item.id}
                                                item={item}
                                                idx={idx}
                                                isReadOnly={isReadOnly}
                                                onUpdateQty={handleUpdateSupplyQty}
                                                constraintsRef={supplyScrollRef}
                                                onDragEnd={() => toast({ title: "순서가 변경되었습니다.", status: "success", position: "top", duration: 1500 })}
                                            />
                                        ))}
                                    </VStack>
                                </Reorder.Group>
                            </TeasyFormGroup>
                        )}
                    </VStack>
                </FormControl>

                <FormControl>
                    <TeasyFormLabel>현장 사진 ({formData.photos.length}/{AS_SCHEDULE_CONSTANTS.MAX_PHOTOS})</TeasyFormLabel>
                    <Box
                        p={4} border="1px dashed" borderColor="gray.200" borderRadius="xl" bg="white"
                        transition="all 0.2s"
                        _hover={!isReadOnly ? { borderColor: "brand.300", bg: "gray.50" } : {}}
                    >
                        <PhotoGrid
                            photos={formData.photos}
                            isReadOnly={isReadOnly}
                            onAddClick={() => fileInputRef.current?.click()}
                            onRemoveClick={(idx) => removePhoto(idx, false)}
                            maxPhotos={AS_SCHEDULE_CONSTANTS.MAX_PHOTOS}
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
                    </Box>
                </FormControl>

                <FormControl>
                    <TeasyFormLabel>참고 사항</TeasyFormLabel>
                    <TeasyTextarea
                        value={formData.memo}
                        onChange={(e: any) => !isReadOnly && setFormData({ ...formData, memo: applyColonStandard(e.target.value) })}
                        placeholder="특이사항 또는 수리 엔지니어 전달사항 입력"
                        isDisabled={isReadOnly}
                    />
                </FormControl>
            </VStack>
        </Box>
    );
});

AsScheduleForm.displayName = "AsScheduleForm";
