"use client";
import React, { forwardRef, useImperativeHandle, useRef, useEffect } from "react";
import { VStack, FormControl, Box, Spinner, HStack, Flex, Text, IconButton, Divider, Badge, useToast, Checkbox, Tooltip } from "@chakra-ui/react";
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
import { normalizeText } from "@/utils/textFormatter";
import { useRemoteAsCompleteForm } from "./useRemoteAsCompleteForm";
import { RemoteAsCompleteFormData, REMOTE_AS_COMPLETE_CONSTANTS, SelectedItem } from "./types";
import { getCircledNumber } from "@/components/features/asset/AssetModalUtils";
import { PhotoGrid } from "../common/PhotoGrid";
import { RemoteAsCompleteFormHandle } from "./types";

interface RemoteAsCompleteFormProps {
    customer: { id: string; name: string; address?: string; phone?: string };
    activities?: any[];
    activityId?: string;
    initialData?: Partial<RemoteAsCompleteFormData>;
    isReadOnly?: boolean;
    defaultManager?: string;
}

// --- Sub Component for Product List Item ---
// --- Sub Component for Product List Item (No Qty Version) ---
const ProductListItemSimple = ({ item, idx, isReadOnly, constraintsRef, onDragEnd }: {
    item: SelectedItem,
    idx: number,
    isReadOnly: boolean,
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
                    <Tooltip label={item.name} placement="top" hasArrow openDelay={500}>
                        <Text fontSize="sm" color="gray.700" fontWeight="medium" isTruncated maxW="full">
                            <Text as="span" color="brand.500" mr={2} fontWeight="bold">
                                {getCircledNumber(idx + 1)}
                            </Text>
                            {item.name}
                        </Text>
                    </Tooltip>
                </HStack>
            </HStack>
        </Reorder.Item>
    );
};

// --- Sub Component for Supply List Item (With Qty) ---
const SupplyListItem = ({ item, idx, isReadOnly, onUpdateQty, constraintsRef, onDragEnd }: {
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
                    <Tooltip label={item.name} placement="top" hasArrow openDelay={500}>
                        <Text fontSize="sm" color="gray.700" fontWeight="medium" isTruncated maxW="full">
                            <Text as="span" color="brand.500" mr={2} fontWeight="bold">
                                {getCircledNumber(idx + 1)}
                            </Text>
                            {item.name}
                        </Text>
                    </Tooltip>
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

export const RemoteAsCompleteForm = forwardRef<RemoteAsCompleteFormHandle, RemoteAsCompleteFormProps>(({
    customer,
    activities = [],
    activityId,
    initialData,
    isReadOnly = false,
    defaultManager = ""
}, ref) => {
    const toast = useToast();
    const [tempSymptom, setTempSymptom] = React.useState("");
    const { managerOptions, remoteAsTypeOptions: asTypeOptions, remoteAsProductOptions: products, inventoryItems } = useReportMetadata();
    const {
        formData, setFormData,
        isLoading,
        handleFileUpload, removePhoto,
        addSymptom, updateSymptom, toggleSymptomResolved, removeSymptom,
        handleAddProduct, handleUpdateQty, handleReorder,
        handleAddSupply, handleUpdateSupplyQty, handleReorderSupplies,
        submit,
        handleDelete
    } = useRemoteAsCompleteForm({ customer, activities, activityId, initialData, defaultManager });

    const silentRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const productScrollRef = useRef<HTMLDivElement>(null);
    const supplyScrollRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
        submit: () => submit(managerOptions as any[]),
        delete: handleDelete
    }), [submit, handleDelete, managerOptions]);

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
                    borderRadius="2xl"
                    backdropFilter="blur(2px)"
                >
                    <VStack spacing={4}>
                        <Spinner size="xl" color="brand.500" thickness="4px" />
                        <Text fontWeight="medium" color="brand.600">처리 중...</Text>
                    </VStack>
                </Flex>
            )}

            <VStack spacing={6} align="stretch">
                <HStack spacing={4} w="full">
                    <FormControl isRequired flex={1}>
                        <TeasyFormLabel>지원 일시</TeasyFormLabel>
                        {isReadOnly ? (
                            <TeasyInput value={formData.date} isReadOnly />
                        ) : (
                            <TeasyDateTimeInput
                                value={formData.date}
                                onChange={(val: string) => setFormData({ ...formData, date: val })}
                                limitType="future"
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
                                options={managerOptions as any}
                                isDisabled={isReadOnly}
                            />
                        )}
                    </FormControl>
                </HStack>


                <HStack spacing={4} align="flex-start" w="full">
                    <FormControl isRequired flex={1}>
                        <TeasyFormLabel>유형 선택</TeasyFormLabel>
                        {isReadOnly ? (
                            <TeasyInput value={formData.asType} isReadOnly />
                        ) : (
                            <CustomSelect
                                options={asTypeOptions as any}
                                value={formData.asType}
                                onChange={(val) => setFormData({ ...formData, asType: val })}
                                placeholder="A/S 유형 선택"
                                isDisabled={isReadOnly}
                            />
                        )}
                    </FormControl>

                    <FormControl flex={1} isRequired>
                        <TeasyFormLabel>점검 상품</TeasyFormLabel>
                        {!isReadOnly && (
                            <CustomSelect
                                placeholder="상품 선택"
                                value=""
                                onChange={(val) => handleAddProduct(val, products as any[])}
                                options={products as any}
                                isDisabled={isReadOnly}
                            />
                        )}
                    </FormControl>
                </HStack>

                {/* 관련 상품 리스트 */}
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
                                    <ProductListItemSimple
                                        key={item.id}
                                        item={item}
                                        idx={idx}
                                        isReadOnly={isReadOnly}
                                        constraintsRef={productScrollRef}
                                        onDragEnd={() => toast({ title: "순서가 변경되었습니다.", status: "success", position: "top", duration: 1500 })}
                                    />
                                ))}
                            </VStack>
                        </Reorder.Group>
                    </TeasyFormGroup>
                )}

                {/* 접수 증상 */}
                <FormControl isRequired>
                    <TeasyFormLabel>접수 증상</TeasyFormLabel>
                    {!isReadOnly && (
                        <HStack spacing={2} mb={3}>
                            <TeasyInput
                                placeholder="증상 또는 요청사항 입력 후 + 클릭"
                                value={tempSymptom}
                                onChange={(e) => setTempSymptom(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        if (tempSymptom.trim()) {
                                            addSymptom(tempSymptom);
                                            setTempSymptom("");
                                        }
                                    }
                                }}
                            />
                            <IconButton
                                aria-label="add-symptom"
                                icon={<MdAdd />}
                                colorScheme="brand"
                                onClick={() => {
                                    if (tempSymptom.trim()) {
                                        addSymptom(tempSymptom);
                                        setTempSymptom("");
                                    }
                                }}
                                isDisabled={formData.symptoms.length >= 20}
                            />
                        </HStack>
                    )}

                    {formData.symptoms.length > 0 && (
                        <Box bg="gray.50" borderRadius="md" p={3} border="1px" borderColor="gray.100">
                            <Flex justify="flex-end" mb={1} pr={2.5}>
                                <Text fontSize="11px" color="gray.400" fontWeight="bold" mt={-1}>✓</Text>
                            </Flex>
                            <VStack spacing={2} align="stretch">
                                {formData.symptoms.map((symptom, idx) => (
                                    <HStack key={idx} spacing={2} w="full" align="center">
                                        <HStack
                                            flex={1}
                                            spacing={3}
                                            bg="white"
                                            px={3}
                                            py={1.5}
                                            minH="38px"
                                            borderRadius="md"
                                            shadow="xs"
                                            border="1px solid"
                                            borderColor="gray.100"
                                            overflow="hidden"
                                            justify="space-between"
                                        >
                                            <HStack spacing={2} flex={1} overflow="hidden">
                                                <Text fontSize="sm" fontWeight="bold" color="brand.500" minW="20px" textAlign="center">
                                                    {getCircledNumber(idx + 1)}
                                                </Text>
                                                {isReadOnly ? (
                                                    <Tooltip label={symptom.text} placement="top" hasArrow openDelay={500}>
                                                        <Text fontSize="sm" color="gray.700" fontWeight="medium" isTruncated>
                                                            {symptom.text}
                                                        </Text>
                                                    </Tooltip>
                                                ) : (
                                                    <TeasyInput
                                                        size="sm"
                                                        variant="unstyled"
                                                        value={symptom.text}
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
                                                <IconButton
                                                    aria-label="remove-symptom"
                                                    icon={<MdRemove />}
                                                    size="xs"
                                                    variant="ghost"
                                                    colorScheme="gray"
                                                    onClick={() => removeSymptom(idx)}
                                                />
                                            )}
                                        </HStack>
                                        <Checkbox
                                            isChecked={symptom.isResolved}
                                            onChange={() => toggleSymptomResolved(idx)}
                                            colorScheme="brand"
                                            size="md"
                                            isDisabled={isReadOnly}
                                            ml={1}
                                        />
                                    </HStack>
                                ))}
                            </VStack>
                        </Box>
                    )}
                </FormControl>

                {/* 지원 내용 */}
                <FormControl isRequired>
                    <TeasyFormLabel>지원 내용</TeasyFormLabel>
                    <TeasyTextarea
                        value={formData.supportContent}
                        onChange={(e: any) => !isReadOnly && setFormData({ ...formData, supportContent: e.target.value })}
                        placeholder="지원 내용 입력"
                        isDisabled={isReadOnly}
                        minH="120px"
                    />
                </FormControl>

                {/* 발송 물품 */}
                <FormControl>
                    <TeasyFormLabel>발송 물품</TeasyFormLabel>
                    <VStack align="stretch" spacing={3}>
                        {!isReadOnly && (
                            <CustomSelect
                                placeholder="물품 선택"
                                value=""
                                onChange={(val) => handleAddSupply(val, inventoryItems as any[])}
                                options={inventoryItems as any}
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
                                            <SupplyListItem
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

                {/* 배송 정보 (발송 물품이 있을 때만 표시) */}
                {formData.selectedSupplies.length > 0 && formData.deliveryInfo && (
                    <FormControl>
                        <TeasyFormLabel>배송 정보</TeasyFormLabel>
                        <TeasyFormGroup>
                            <VStack spacing={4}>
                                <HStack w="full" spacing={4} align="flex-start">
                                    <FormControl flex={1}>
                                        <TeasyFormLabel sub fontSize="xs" mb={1}>배송 업체</TeasyFormLabel>
                                        {isReadOnly ? (
                                            <TeasyInput value={formData.deliveryInfo.courier} isReadOnly />
                                        ) : (
                                            <CustomSelect
                                                placeholder="선택"
                                                value={formData.deliveryInfo.courier}
                                                onChange={(val) => setFormData({
                                                    ...formData,
                                                    deliveryInfo: { ...formData.deliveryInfo!, courier: val }
                                                })}
                                                options={[
                                                    { value: "CJ", label: "CJ" },
                                                    { value: "로젠", label: "로젠" },
                                                    { value: "우체국", label: "우체국" }
                                                ]}
                                            />
                                        )}
                                    </FormControl>
                                    <FormControl flex={1}>
                                        <TeasyFormLabel sub fontSize="xs" mb={1}>발송 일자</TeasyFormLabel>
                                        {isReadOnly ? (
                                            <TeasyInput value={formData.deliveryInfo.shipmentDate} isReadOnly />
                                        ) : (
                                            <TeasyDateTimeInput
                                                value={formData.deliveryInfo.shipmentDate}
                                                onChange={(val: string) => setFormData({
                                                    ...formData,
                                                    deliveryInfo: { ...formData.deliveryInfo!, shipmentDate: val }
                                                })}
                                                limitType="future"
                                            />
                                        )}
                                    </FormControl>
                                </HStack>
                                <FormControl>
                                    <TeasyFormLabel sub fontSize="xs" mb={1}>송장 번호</TeasyFormLabel>
                                    <TeasyInput
                                        value={formData.deliveryInfo.trackingNumber}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/[^0-9]/g, "");
                                            setFormData({
                                                ...formData,
                                                deliveryInfo: { ...formData.deliveryInfo!, trackingNumber: val }
                                            });
                                        }}
                                        placeholder="숫자 입력"
                                        isReadOnly={isReadOnly}
                                    />
                                </FormControl>
                                <FormControl>
                                    <TeasyFormLabel sub fontSize="xs" mb={1}>발송 주소</TeasyFormLabel>
                                    <TeasyInput
                                        value={formData.deliveryInfo.deliveryAddress}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            deliveryInfo: { ...formData.deliveryInfo!, deliveryAddress: e.target.value }
                                        })}
                                        placeholder="주소 입력"
                                        isReadOnly={isReadOnly}
                                    />
                                </FormControl>
                            </VStack>
                        </TeasyFormGroup>
                    </FormControl>
                )}

                <FormControl isRequired={formData.asType === "원격 지원"}>
                    <TeasyFormLabel>PC 사양 ({formData.photos.length}/{REMOTE_AS_COMPLETE_CONSTANTS.MAX_PHOTOS})</TeasyFormLabel>
                    <Box
                        p={4} border="1px dashed" borderColor="gray.200" borderRadius="xl" bg="white"
                        transition="all 0.2s"
                        _hover={!isReadOnly ? { borderColor: "brand.300", bg: "gray.50" } : {}}
                    >
                        <PhotoGrid
                            photos={formData.photos}
                            isReadOnly={isReadOnly}
                            onAddClick={() => fileInputRef.current?.click()}
                            onRemoveClick={removePhoto}
                            maxPhotos={REMOTE_AS_COMPLETE_CONSTANTS.MAX_PHOTOS}
                        />
                        <input
                            type="file" multiple accept="image/*" ref={fileInputRef} style={{ display: "none" }}
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
                        onChange={(e: any) => !isReadOnly && setFormData({ ...formData, memo: e.target.value })}
                        placeholder="특이사항 입력"
                        isDisabled={isReadOnly}
                    />
                </FormControl>
            </VStack>
        </Box>
    );
});

RemoteAsCompleteForm.displayName = "RemoteAsCompleteForm";
