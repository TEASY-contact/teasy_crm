"use client";
import React, { forwardRef, useImperativeHandle, useRef, useCallback } from "react";
import {
    VStack, FormControl, Box, Flex, Spinner,
    HStack, Text
} from "@chakra-ui/react";
import { CustomSelect } from "@/components/common/CustomSelect";
import { TeasyDateTimeInput, TeasyFormLabel, TeasyInput, TeasyTextarea, TeasyPhoneInput } from "@/components/common/UIComponents";
import { useReportMetadata } from "@/hooks/useReportMetadata";
import { useDemoCompleteForm } from "./useDemoCompleteForm";
import { PhotoGrid } from "../common/PhotoGrid";
import { DEMO_CONSTANTS, ManagerOption, DemoCompleteFormData } from "./types";

interface DemoCompleteFormProps {
    customer: { id: string, name: string };
    activities?: any[];
    activityId?: string;
    initialData?: any;
    isReadOnly?: boolean;
    defaultManager?: string;
}

export const DemoCompleteForm = forwardRef<any, DemoCompleteFormProps>(({
    customer,
    activities = [],
    activityId,
    initialData,
    isReadOnly = false,
    defaultManager = ""
}, ref) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { managerOptions, products } = useReportMetadata();
    const {
        formData, setFormData,
        isLoading,
        handleFileUpload, removePhoto,
        submit,
        handleDelete
    } = useDemoCompleteForm({ customer, activities, activityId, initialData, defaultManager });

    const handleCashInput = useCallback((val: string) => {
        const num = val.replace(/[^0-9]/g, "");
        if (!num) {
            setFormData(prev => ({ ...prev, discountValue: "" }));
            return;
        }
        const formatted = new Intl.NumberFormat().format(parseInt(num));
        setFormData(prev => ({ ...prev, discountValue: `-${formatted}` }));
    }, [setFormData]);

    const silentRef = React.useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
        submit: () => submit(managerOptions as ManagerOption[]),
        delete: handleDelete
    }), [submit, handleDelete, managerOptions]);

    // Silent Focus Guard (v126.3)
    React.useEffect(() => {
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
                        <TeasyFormLabel>완료 일시</TeasyFormLabel>
                        <TeasyDateTimeInput
                            value={formData.date}
                            onChange={(val: string) => !isReadOnly && setFormData((prev: DemoCompleteFormData) => ({ ...prev, date: val }))}
                            isDisabled={isReadOnly}
                            limitType="future"
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
                                onChange={(val) => !isReadOnly && setFormData((prev: DemoCompleteFormData) => ({ ...prev, manager: val }))}
                                options={managerOptions}
                                isDisabled={isReadOnly}
                            />
                        )}
                    </FormControl>
                </HStack>

                <FormControl>
                    <TeasyFormLabel>방문 주소</TeasyFormLabel>
                    <TeasyInput
                        value={formData.location}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => !isReadOnly && setFormData((prev: DemoCompleteFormData) => ({ ...prev, location: e.target.value }))}
                        placeholder="입력"
                        isDisabled={isReadOnly}
                    />
                </FormControl>

                <FormControl>
                    <TeasyFormLabel>연락처</TeasyFormLabel>
                    <TeasyPhoneInput
                        value={formData.phone}
                        onChange={(val: string) => !isReadOnly && setFormData((prev: DemoCompleteFormData) => ({ ...prev, phone: val }))}
                        placeholder="000-0000-0000"
                        isDisabled={isReadOnly}
                    />
                </FormControl>

                <HStack spacing={4}>
                    <FormControl isRequired flex={1}>
                        <TeasyFormLabel>시연 상품</TeasyFormLabel>
                        {isReadOnly ? (
                            <TeasyInput
                                value={products.find(p => p.value === formData.product)?.label || formData.product}
                                isReadOnly
                            />
                        ) : (
                            <CustomSelect
                                placeholder="선택"
                                value={formData.product}
                                onChange={(val) => !isReadOnly && setFormData((prev: DemoCompleteFormData) => ({ ...prev, product: val }))}
                                options={products}
                                isDisabled={isReadOnly}
                            />
                        )}
                    </FormControl>

                    <FormControl isRequired flex={1}>
                        <TeasyFormLabel>시연 결과</TeasyFormLabel>
                        {isReadOnly ? (
                            <TeasyInput
                                value={formData.result}
                                isReadOnly
                            />
                        ) : (
                            <CustomSelect
                                placeholder="선택"
                                value={formData.result}
                                onChange={(val) => setFormData((prev: DemoCompleteFormData) => ({ ...prev, result: val }))}
                                options={DEMO_CONSTANTS.RESULTS as any}
                                isDisabled={isReadOnly}
                            />
                        )}
                    </FormControl>
                </HStack>

                <HStack spacing={4} align="flex-end">
                    <FormControl isRequired>
                        <TeasyFormLabel>할인 제안</TeasyFormLabel>
                        {isReadOnly ? (
                            <TeasyInput
                                value={formData.discountType}
                                isReadOnly
                            />
                        ) : (
                            <CustomSelect
                                placeholder="선택"
                                value={formData.discountType}
                                onChange={(val) => setFormData((prev: DemoCompleteFormData) => ({ ...prev, discountType: val, discountValue: "" }))}
                                options={DEMO_CONSTANTS.DISCOUNT_TYPES as any}
                                isDisabled={isReadOnly}
                            />
                        )}
                    </FormControl>

                    {formData.discountType === "현금 할인" && (
                        <FormControl>
                            <TeasyFormLabel sub>제안 금액</TeasyFormLabel>
                            <TeasyInput
                                placeholder="입력"
                                value={formData.discountValue}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleCashInput(e.target.value)}
                                isDisabled={isReadOnly}
                            />
                        </FormControl>
                    )}

                    {formData.discountType === "네이버 쿠폰" && (
                        <FormControl>
                            <TeasyFormLabel sub>쿠폰 선택</TeasyFormLabel>
                            {isReadOnly ? (
                                <TeasyInput
                                    value={formData.discountValue}
                                    isReadOnly
                                />
                            ) : (
                                <CustomSelect
                                    placeholder="선택"
                                    value={formData.discountValue}
                                    onChange={(val) => setFormData((prev: DemoCompleteFormData) => ({ ...prev, discountValue: val }))}
                                    options={DEMO_CONSTANTS.NAVER_COUPONS as any}
                                    isDisabled={isReadOnly}
                                />
                            )}
                        </FormControl>
                    )}
                </HStack>

                <FormControl>
                    <TeasyFormLabel>참고 사항</TeasyFormLabel>
                    <TeasyTextarea
                        value={formData.memo}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => !isReadOnly && setFormData((prev: DemoCompleteFormData) => ({ ...prev, memo: e.target.value }))}
                        placeholder="입력"
                        isDisabled={isReadOnly}
                    />
                </FormControl>

                <FormControl>
                    <TeasyFormLabel>현장 사진 ({formData.photos.length}/{DEMO_CONSTANTS.MAX_PHOTOS})</TeasyFormLabel>
                    <Box p={4} border="1px dashed" borderColor="gray.200" borderRadius="xl" bg="white">
                        <PhotoGrid
                            photos={formData.photos}
                            isReadOnly={isReadOnly}
                            onAddClick={() => fileInputRef.current?.click()}
                            onRemoveClick={removePhoto}
                            maxPhotos={DEMO_CONSTANTS.MAX_PHOTOS}
                        />
                        <input type="file" multiple accept="image/*" ref={fileInputRef} style={{ display: "none" }} onChange={(e) => handleFileUpload(e.target.files)} />
                    </Box>
                </FormControl>
            </VStack>
        </Box>
    );
});

DemoCompleteForm.displayName = "DemoCompleteForm";
