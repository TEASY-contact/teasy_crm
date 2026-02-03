// src/components/features/customer/reports/AsScheduleForm/index.tsx
"use client";
import React, { forwardRef, useImperativeHandle, useRef, useEffect } from "react";
import { VStack, FormControl, Box, Spinner, HStack, Flex, Text, IconButton } from "@chakra-ui/react";
import { MdRemove, MdAdd } from "react-icons/md";
import { CustomSelect } from "@/components/common/CustomSelect";
import {
    TeasyDateTimeInput,
    TeasyFormLabel,
    TeasyInput,
    TeasyTextarea,
    TeasyPhoneInput,
    TeasyFormGroup
} from "@/components/common/ui/FormElements";
import { useReportMetadata } from "@/hooks/useReportMetadata";
import { useAsScheduleForm } from "./useAsScheduleForm";
import { AsScheduleFormData, AsScheduleFormHandle, AS_SCHEDULE_CONSTANTS } from "./types";
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

export const AsScheduleForm = forwardRef<AsScheduleFormHandle, AsScheduleFormProps>(({
    customer,
    activities = [],
    activityId,
    initialData,
    isReadOnly = false,
    defaultManager = ""
}, ref) => {
    const { managerOptions } = useReportMetadata();
    const {
        formData, setFormData,
        isLoading,
        handleFileUpload, removePhoto,
        addSymptom, updateSymptom, removeSymptom,
        submit,
        handleDelete
    } = useAsScheduleForm({ customer, activities, activityId, initialData, defaultManager });

    const silentRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

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
                        <TeasyFormLabel>방문 예정 일시</TeasyFormLabel>
                        <TeasyDateTimeInput
                            value={formData.date}
                            onChange={(val: string) => !isReadOnly && setFormData({ ...formData, date: val })}
                            isDisabled={isReadOnly}
                            limitType="past"
                        />
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

                <FormControl>
                    <TeasyFormLabel>장소</TeasyFormLabel>
                    <TeasyInput
                        value={formData.location}
                        onChange={(e: any) => !isReadOnly && setFormData({ ...formData, location: e.target.value })}
                        placeholder="전국 시공 주소 입력"
                        isDisabled={isReadOnly}
                    />
                </FormControl>

                <FormControl>
                    <TeasyFormLabel>현장 연락처</TeasyFormLabel>
                    <TeasyPhoneInput
                        value={formData.phone}
                        onChange={(val: string) => !isReadOnly && setFormData({ ...formData, phone: val })}
                        placeholder="000-0000-0000"
                        isDisabled={isReadOnly}
                    />
                </FormControl>

                <FormControl>
                    <TeasyFormLabel>관련 상품</TeasyFormLabel>
                    <TeasyInput
                        value={formData.product}
                        onChange={(e: any) => !isReadOnly && setFormData({ ...formData, product: e.target.value })}
                        placeholder="설치된 제품 모델명"
                        isDisabled={isReadOnly}
                    />
                </FormControl>

                {/* 증상 및 기술 지원 요청 (Symptoms) */}
                <FormControl>
                    <TeasyFormLabel>접수 증상</TeasyFormLabel>
                    <TeasyFormGroup>
                        <VStack spacing={2} align="stretch">
                            {formData.symptoms.map((symptom, idx) => (
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
                                    transition="all 0.2s"
                                >
                                    <HStack spacing={1} flex={1}>
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
                                            <Text color="gray.200" fontSize="10px">|</Text>
                                            <IconButton
                                                aria-label="add-symptom"
                                                icon={<MdAdd />}
                                                size="xs"
                                                variant="ghost"
                                                colorScheme="gray"
                                                onClick={() => addSymptom()}
                                            />
                                        </HStack>
                                    )}
                                </HStack>
                            ))}
                        </VStack>
                    </TeasyFormGroup>
                </FormControl>

                <FormControl>
                    <TeasyFormLabel>현장 사진 ({formData.photos.length}/{AS_SCHEDULE_CONSTANTS.MAX_PHOTOS})</TeasyFormLabel>
                    <Box p={4} border="1px dashed" borderColor="gray.200" borderRadius="xl" bg="white">
                        <PhotoGrid
                            photos={formData.photos}
                            isReadOnly={isReadOnly}
                            onAddClick={() => fileInputRef.current?.click()}
                            onRemoveClick={removePhoto}
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

                <FormControl isRequired>
                    <TeasyFormLabel>보고 내용</TeasyFormLabel>
                    <TeasyTextarea
                        value={formData.memo}
                        onChange={(e: any) => !isReadOnly && setFormData({ ...formData, memo: e.target.value })}
                        placeholder="특이사항 또는 수리 엔지니어 전달사항 입력"
                        isDisabled={isReadOnly}
                    />
                </FormControl>
            </VStack>
        </Box>
    );
});

AsScheduleForm.displayName = "AsScheduleForm";
