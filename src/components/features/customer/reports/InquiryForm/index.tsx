"use client";
import React, { useRef, forwardRef, useImperativeHandle, useCallback } from "react";
import {
    VStack, FormControl, Box, Flex, Spinner,
    HStack, Text, useToast, Badge
} from "@chakra-ui/react";
import { formatPhone } from "@/utils/formatter";
import {
    TeasyDateTimeInput,
    TeasyFormLabel,
    TeasyInput,
    TeasyTextarea,
    TeasyPhoneInput,
    TeasyUniversalViewer,
    TeasyAudioPlayer,
    TeasyButton,
    TeasyFormGroup
} from "@/components/common/UIComponents";
import { CustomSelect } from "@/components/common/CustomSelect";
import { useAuth } from "@/context/AuthContext";
import { useReportMetadata } from "@/hooks/useReportMetadata";
import { useInquiryForm } from "./useInquiryForm";
import { ReportFileList } from "../common/ReportFileList";
import { InquiryFormData, InquiryFormHandle, InquiryFile } from "./types";

interface InquiryFormProps {
    customer: { id: string, name: string, address?: string, phone?: string };
    activityId?: string;
    initialData?: any;
    isReadOnly?: boolean;
    defaultManager?: string;
    activities?: any[];
}

export const InquiryForm = forwardRef<any, InquiryFormProps>(({
    customer,
    activityId,
    initialData,
    isReadOnly = false,
    defaultManager = "",
    activities = []
}, ref) => {
    const { userData } = useAuth();
    const recordingInputRef = useRef<HTMLInputElement>(null);
    const quoteInputRef = useRef<HTMLInputElement>(null);

    const { managerOptions, products } = useReportMetadata();
    const {
        formData, setFormData,
        recordings, quotes,
        isLoading,
        handleFileAdd, handleFileRemove,
        submit,
        handleDelete
    } = useInquiryForm({ customer: customer as any, activities, activityId, initialData, defaultManager, userData: userData as any });

    const [viewerState, setViewerState] = React.useState({ isOpen: false, files: [] as InquiryFile[], index: 0 });
    const [audioState, setAudioState] = React.useState({ isOpen: false, file: null as InquiryFile | null });

    const silentRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
        submit: () => submit(managerOptions),
        delete: handleDelete
    }), [submit, handleDelete, managerOptions]);

    // Silent Focus Guard (v126.3)
    React.useEffect(() => {
        if (silentRef.current) silentRef.current.focus();
    }, []);

    const handleChannelChange = useCallback((val: string) => {
        if (isReadOnly) return;
        const isPhoneInquiry = val === "전화 문의";
        setFormData((prev: InquiryFormData) => ({
            ...prev,
            channel: val as any,
            nickname: isPhoneInquiry ? "" : prev.nickname,
            phone: isPhoneInquiry ? (prev.phone || customer?.phone || "") : ""
        }));
    }, [isReadOnly, customer?.phone, setFormData]);

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
                        <TeasyFormLabel>접수 일시</TeasyFormLabel>
                        {isReadOnly ? (
                            <TeasyInput value={formData.date} isReadOnly />
                        ) : (
                            <TeasyDateTimeInput
                                value={formData.date}
                                onChange={(val: string) => setFormData((prev: InquiryFormData) => ({ ...prev, date: val }))}
                                limitType="future"
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
                                onChange={(val) => setFormData((prev: InquiryFormData) => ({ ...prev, manager: val }))}
                                options={managerOptions}
                            />
                        )}
                    </FormControl>
                </HStack>

                <VStack spacing={2} align="stretch">
                    <FormControl isRequired>
                        <TeasyFormLabel>유입 채널</TeasyFormLabel>
                        {isReadOnly ? (
                            <TeasyInput
                                value={formData.channel}
                                isReadOnly
                            />
                        ) : (
                            <CustomSelect
                                placeholder="선택"
                                value={formData.channel}
                                onChange={handleChannelChange}
                                options={[
                                    { value: "전화 문의", label: "전화 문의" },
                                    { value: "네이버 톡톡", label: "네이버 톡톡" },
                                    { value: "채널톡", label: "채널톡" },
                                    { value: "기타", label: "기타" }
                                ]}
                            />
                        )}
                    </FormControl>

                    {formData.channel && (
                        <TeasyFormGroup>
                            {formData.channel === "전화 문의" ? (
                                <Box>
                                    <FormControl isRequired>
                                        <TeasyFormLabel sub>연락처</TeasyFormLabel>
                                        <HStack w="full" spacing={2}>
                                            <Box flex={1}>
                                                {isReadOnly ? (
                                                    <TeasyInput value={formatPhone(formData.phone)} isReadOnly />
                                                ) : (
                                                    <TeasyPhoneInput
                                                        value={formData.phone}
                                                        onChange={(val: string) => setFormData((prev: InquiryFormData) => ({ ...prev, phone: val }))}
                                                        placeholder="000-0000-0000"
                                                    />
                                                )}
                                            </Box>
                                            <Box>
                                                {!isReadOnly && (
                                                    <>
                                                        <Badge
                                                            as="button"
                                                            cursor="pointer"
                                                            onClick={() => recordingInputRef.current?.click()}
                                                            bg="gray.100"
                                                            color="gray.600"
                                                            border="1px solid"
                                                            borderColor="gray.200"
                                                            _hover={{ bg: "gray.200" }}
                                                            px={3}
                                                            h="32px"
                                                            borderRadius="10px"
                                                            fontSize="xs"
                                                            fontWeight="600"
                                                            display="flex"
                                                            alignItems="center"
                                                            justifyContent="center"
                                                            textTransform="none"
                                                        >
                                                            녹취 업로드
                                                        </Badge>
                                                        <input
                                                            type="file"
                                                            hidden
                                                            ref={recordingInputRef}
                                                            accept="audio/*"
                                                            onChange={(e) => handleFileAdd(e.target.files, 'recording')}
                                                        />
                                                    </>
                                                )}
                                            </Box>
                                        </HStack>
                                    </FormControl>
                                    <ReportFileList
                                        files={recordings}
                                        type="recording"
                                        isReadOnly={isReadOnly}
                                        onConfirm={(file: any) => setAudioState({ isOpen: true, file })}
                                        onDelete={(id) => handleFileRemove(id, 'recording')}
                                    />
                                </Box>
                            ) : (
                                <FormControl isRequired={formData.channel !== "기타"}>
                                    <TeasyFormLabel sub>
                                        {formData.channel === "기타" ? "유입 채널 상세" : "닉네임"}
                                    </TeasyFormLabel>
                                    <TeasyInput
                                        value={formData.nickname}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData((prev: InquiryFormData) => ({ ...prev, nickname: e.target.value }))}
                                        placeholder="입력"
                                        isReadOnly={isReadOnly}
                                    />
                                </FormControl>
                            )}
                        </TeasyFormGroup>
                    )}
                </VStack>

                <HStack spacing={4}>
                    <FormControl isRequired>
                        <TeasyFormLabel>문의 상품</TeasyFormLabel>
                        {isReadOnly ? (
                            <TeasyInput
                                value={products.find(p => p.value === formData.product)?.label || formData.product}
                                isReadOnly
                            />
                        ) : (
                            <CustomSelect
                                placeholder="선택"
                                value={formData.product}
                                onChange={(val) => setFormData((prev: InquiryFormData) => ({ ...prev, product: val }))}
                                options={products}
                            />
                        )}
                    </FormControl>
                    <FormControl isRequired>
                        <TeasyFormLabel>상담 결과</TeasyFormLabel>
                        {isReadOnly ? (
                            <TeasyInput
                                value={formData.result}
                                isReadOnly
                            />
                        ) : (
                            <CustomSelect
                                placeholder="선택"
                                value={formData.result}
                                onChange={(val) => setFormData((prev: InquiryFormData) => ({ ...prev, result: val as any }))}
                                options={[
                                    { value: "구매 예정", label: "구매 예정" },
                                    { value: "시연 확정", label: "시연 확정" },
                                    { value: "시연 고민", label: "시연 고민" },
                                    { value: "관심 없음", label: "관심 없음" }
                                ]}
                            />
                        )}
                    </FormControl>
                </HStack>

                <FormControl>
                    <TeasyFormLabel>참고 사항</TeasyFormLabel>
                    <TeasyTextarea
                        value={formData.memo}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData((prev: InquiryFormData) => ({ ...prev, memo: e.target.value }))}
                        placeholder="입력"
                        isReadOnly={isReadOnly}
                    />
                </FormControl>

                <FormControl>
                    <TeasyFormLabel>견적서</TeasyFormLabel>
                    <TeasyFormGroup p={2}>
                        <VStack spacing={2} align="stretch">
                            {!isReadOnly && quotes.length < 1 && (
                                <Box w="full">
                                    <input
                                        type="file"
                                        hidden
                                        ref={quoteInputRef}
                                        accept="image/*,application/pdf"
                                        onChange={(e) => handleFileAdd(e.target.files, 'quote')}
                                    />
                                    <Badge
                                        as="button"
                                        cursor="pointer"
                                        onClick={() => quoteInputRef.current?.click()}
                                        bg="gray.100"
                                        color="gray.600"
                                        border="1px solid"
                                        borderColor="gray.200"
                                        _hover={{ bg: "gray.200" }}
                                        w="full"
                                        h="32px"
                                        borderRadius="10px"
                                        fontSize="xs"
                                        fontWeight="600"
                                        display="flex"
                                        alignItems="center"
                                        justifyContent="center"
                                        textTransform="none"
                                    >
                                        파일 업로드 ({quotes.length}/1)
                                    </Badge>
                                </Box>
                            )}
                            <ReportFileList
                                files={quotes}
                                type="quote"
                                isReadOnly={isReadOnly}
                                onConfirm={(file: any) => setViewerState({ isOpen: true, files: quotes, index: quotes.indexOf(file) })}
                                onDelete={(id) => handleFileRemove(id, 'quote')}
                            />
                        </VStack>
                    </TeasyFormGroup>
                </FormControl>
            </VStack>

            <TeasyAudioPlayer
                isOpen={audioState.isOpen}
                onClose={() => setAudioState(prev => ({ ...prev, isOpen: false }))}
                file={audioState.file}
            />
            <TeasyUniversalViewer
                isOpen={viewerState.isOpen}
                onClose={() => setViewerState(prev => ({ ...prev, isOpen: false }))}
                files={viewerState.files}
                initialIndex={viewerState.index}
            />
        </Box >
    );
});

InquiryForm.displayName = "InquiryForm";
