"use client";
import React, { forwardRef, useImperativeHandle, useCallback } from "react";
import { VStack, FormControl, Box, Spinner, HStack, Flex, Text } from "@chakra-ui/react";
import { CustomSelect } from "@/components/common/CustomSelect";
import { TeasyDateTimeInput, TeasyFormLabel, TeasyInput, TeasyTextarea, TeasyPhoneInput } from "@/components/common/UIComponents";
import { useReportMetadata } from "@/hooks/useReportMetadata";
import { useDemoScheduleForm } from "./useDemoScheduleForm";
import { DemoScheduleFormData, DemoScheduleFormHandle } from "./types";
import { ManagerOption } from "../DemoCompleteForm/types";

interface DemoScheduleFormProps {
    customer: { id: string, name: string, address?: string, phone?: string };
    activityId?: string;
    initialData?: Partial<DemoScheduleFormData>;
    isReadOnly?: boolean;
    defaultManager?: string;
}

export const DemoScheduleForm = forwardRef<DemoScheduleFormHandle, DemoScheduleFormProps>(({
    customer,
    activityId,
    initialData,
    isReadOnly = false,
    defaultManager = ""
}, ref) => {
    const { managerOptions, products } = useReportMetadata();
    const {
        formData, setFormData,
        isLoading,
        submit,
        handleDelete
    } = useDemoScheduleForm({ customer, activityId, initialData, defaultManager });

    useImperativeHandle(ref, () => ({
        submit: () => submit(managerOptions as ManagerOption[]),
        delete: handleDelete
    }), [submit, handleDelete, managerOptions]);

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
                        <Text fontWeight="medium" color="brand.600">처리 중...</Text>
                    </VStack>
                </Flex>
            )}
            <VStack spacing={6} align="stretch">
                <HStack spacing={4}>
                    <FormControl isRequired>
                        <TeasyFormLabel>시연 일시</TeasyFormLabel>
                        <TeasyDateTimeInput
                            value={formData.date}
                            onChange={(val: string) => !isReadOnly && setFormData((prev: DemoScheduleFormData) => ({ ...prev, date: val }))}
                            isDisabled={isReadOnly}
                            limitType="past"
                        />
                    </FormControl>
                    <FormControl isRequired>
                        <TeasyFormLabel>담당자</TeasyFormLabel>
                        <CustomSelect
                            placeholder="선택"
                            value={formData.manager}
                            onChange={(val) => !isReadOnly && setFormData((prev: DemoScheduleFormData) => ({ ...prev, manager: val }))}
                            options={managerOptions}
                            isDisabled={isReadOnly}
                        />
                    </FormControl>
                </HStack>

                <FormControl isRequired>
                    <TeasyFormLabel>방문 주소</TeasyFormLabel>
                    <TeasyInput
                        value={formData.location}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => !isReadOnly && setFormData((prev: DemoScheduleFormData) => ({ ...prev, location: e.target.value }))}
                        placeholder="입력"
                        isDisabled={isReadOnly}
                    />
                </FormControl>

                <HStack spacing={4}>
                    <FormControl isRequired flex={1}>
                        <TeasyFormLabel>연락처</TeasyFormLabel>
                        <TeasyPhoneInput
                            value={formData.phone}
                            onChange={(val: string) => !isReadOnly && setFormData((prev: DemoScheduleFormData) => ({ ...prev, phone: val }))}
                            placeholder="000-0000-0000"
                            isDisabled={isReadOnly}
                        />
                    </FormControl>

                    <FormControl isRequired flex={1}>
                        <TeasyFormLabel>시연 상품</TeasyFormLabel>
                        <CustomSelect
                            placeholder="선택"
                            value={formData.product}
                            onChange={(val) => !isReadOnly && setFormData((prev: DemoScheduleFormData) => ({ ...prev, product: val }))}
                            options={products}
                            isDisabled={isReadOnly}
                        />
                    </FormControl>
                </HStack>

                <FormControl>
                    <TeasyFormLabel>참고 사항</TeasyFormLabel>
                    <TeasyTextarea
                        value={formData.memo}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => !isReadOnly && setFormData((prev: DemoScheduleFormData) => ({ ...prev, memo: e.target.value }))}
                        placeholder="입력"
                        isDisabled={isReadOnly}
                    />
                </FormControl>
            </VStack>
        </Box>
    );
});

DemoScheduleForm.displayName = "DemoScheduleForm";
