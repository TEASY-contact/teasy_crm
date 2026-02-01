"use client";
import React, { useRef, forwardRef, useImperativeHandle } from "react";
import {
    VStack, FormControl, Box, Flex, Spinner,
    HStack, Text, useToast, Badge
} from "@chakra-ui/react";
import { TeasyDateTimeInput, TeasyFormLabel, TeasyInput, TeasyTextarea, TeasyPhoneInput, TeasyUniversalViewer, TeasyAudioPlayer, TeasyButton } from "@/components/common/UIComponents";
import { CustomSelect } from "@/components/common/CustomSelect";
import { useAuth } from "@/context/AuthContext";
import { useReportMetadata } from "@/hooks/useReportMetadata";
import { useInquiryForm } from "./useInquiryForm";
import { ReportFileList } from "../common/ReportFileList";
import { db } from "@/lib/firebase";
import { doc, deleteDoc } from "firebase/firestore";

export const InquiryForm = forwardRef(({ customer, activityId, initialData, isReadOnly = false, defaultManager = "" }: any, ref) => {
    const { userData } = useAuth();
    const toast = useToast();
    const recordingInputRef = useRef<HTMLInputElement>(null);
    const quoteInputRef = useRef<HTMLInputElement>(null);

    // Custom Hooks for shared metadata and specific inquiry logic
    const { managerOptions, products } = useReportMetadata();
    const {
        formData, setFormData,
        recordings, setRecordings, quotes,
        isLoading,
        handleFileAdd, handleFileRemove,
        submit
    } = useInquiryForm({ customer, activityId, initialData, defaultManager, userData });

    // Internal UI States (Viewer/Audio)
    const [viewerState, setViewerState] = React.useState({ isOpen: false, files: [] as any[], index: 0 });
    const [audioState, setAudioState] = React.useState({ isOpen: false, file: null as any });

    useImperativeHandle(ref, () => ({
        submit: () => submit(managerOptions),
        delete: async () => {
            if (!activityId) return false;
            try {
                await deleteDoc(doc(db, "activities", activityId));
                toast({ title: "삭제 성공", status: "info", duration: 2000, position: "top" });
                return true;
            } catch (error) {
                return false;
            }
        }
    }));

    return (
        <Box position="relative">
            {isLoading && (
                <Flex position="absolute" top={0} left={0} right={0} bottom={0} bg="whiteAlpha.700" zIndex={10} align="center" justify="center">
                    <Spinner size="xl" color="brand.500" thickness="4px" />
                </Flex>
            )}

            <VStack spacing={6} align="stretch">
                <HStack spacing={4}>
                    <FormControl isRequired>
                        <TeasyFormLabel>접수 일시</TeasyFormLabel>
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


                <VStack spacing={2} align="stretch">
                    <HStack spacing={4}>
                        <FormControl isRequired>
                            <TeasyFormLabel>유입 채널</TeasyFormLabel>
                            <CustomSelect
                                placeholder="선택"
                                value={formData.channel}
                                onChange={(val) => {
                                    if (isReadOnly) return;
                                    const isPhoneInquiry = val === "전화 문의";

                                    // Helper: Clean up state immediately when switching mode
                                    if (isPhoneInquiry) {
                                        // Switched TO Phone Inquiry -> Clear Nickname
                                        const newPhone = formData.phone || customer?.phone || "";
                                        setFormData({ ...formData, channel: val, nickname: "", phone: newPhone });
                                    } else {
                                        // Switched FROM Phone Inquiry (or others) -> Clear Phone & Recordings
                                        setFormData({ ...formData, channel: val, phone: "" });
                                        setRecordings([]); // Explicitly clear in-memory recordings
                                    }
                                }}
                                options={[
                                    { value: "전화 문의", label: "전화 문의" },
                                    { value: "네이버 톡톡", label: "네이버 톡톡" },
                                    { value: "채널톡", label: "채널톡" },
                                    { value: "기타", label: "기타" }
                                ]}
                                isDisabled={isReadOnly}
                            />
                        </FormControl>
                    </HStack>

                    {/* Conditional Detail Card */}
                    {formData.channel && (
                        <Box bg="gray.50" p={4} borderRadius="xl" border="1px" borderColor="gray.200">
                            {formData.channel === "전화 문의" ? (
                                <Box>
                                    <FormControl isRequired>
                                        <TeasyFormLabel>연락처</TeasyFormLabel>
                                        <HStack w="full" spacing={2}>
                                            <Box flex={1}>
                                                <TeasyPhoneInput
                                                    value={formData.phone}
                                                    onChange={(val: string) => !isReadOnly && setFormData({ ...formData, phone: val })}
                                                    placeholder="000-0000-0000"
                                                    isDisabled={isReadOnly}
                                                />
                                            </Box>
                                            <Box>
                                                <TeasyButton
                                                    onClick={() => recordingInputRef.current?.click()}
                                                    bg="gray.100"
                                                    color="gray.600"
                                                    _hover={{ bg: "gray.200", color: "gray.600" }}
                                                    h="40px"
                                                    px={4}
                                                    fontWeight="400"
                                                >
                                                    통화 파일 업로드
                                                </TeasyButton>
                                                <input type="file" hidden ref={recordingInputRef} onChange={(e) => handleFileAdd(e.target.files, 'recording')} />
                                            </Box>
                                        </HStack>
                                    </FormControl>
                                    <ReportFileList
                                        files={recordings}
                                        type="recording"
                                        isReadOnly={isReadOnly}
                                        onConfirm={(file) => setAudioState({ isOpen: true, file })}
                                        onDelete={(id) => handleFileRemove(id, 'recording')}
                                    />
                                </Box>
                            ) : (
                                <FormControl>
                                    <TeasyFormLabel>
                                        {formData.channel === "기타" ? "유입 채널" : "닉네임"}
                                    </TeasyFormLabel>
                                    <TeasyInput
                                        value={formData.nickname}
                                        onChange={(e: any) => !isReadOnly && setFormData({ ...formData, nickname: e.target.value })}
                                        placeholder="입력"
                                        isDisabled={isReadOnly}
                                        _readOnly={{ bg: "gray.50", cursor: "default", color: "gray.600" }}
                                    />
                                </FormControl>
                            )}
                        </Box>
                    )}
                </VStack>

                <HStack spacing={4}>
                    <FormControl isRequired>
                        <TeasyFormLabel>문의 상품</TeasyFormLabel>
                        <CustomSelect
                            placeholder="선택"
                            value={formData.product}
                            onChange={(val) => !isReadOnly && setFormData({ ...formData, product: val })}
                            options={products}
                            isDisabled={isReadOnly}
                        />
                    </FormControl>
                    <FormControl isRequired>
                        <TeasyFormLabel>상담 결과</TeasyFormLabel>
                        <CustomSelect
                            placeholder="선택"
                            value={formData.result}
                            onChange={(val) => !isReadOnly && setFormData({ ...formData, result: val })}
                            options={[
                                { value: "구매 예정", label: "구매 예정" },
                                { value: "시연 확정", label: "시연 확정" },
                                { value: "시연 고민", label: "시연 고민" },
                                { value: "관심 없음", label: "관심 없음" }
                            ]}
                            isDisabled={isReadOnly}
                        />
                    </FormControl>
                </HStack>

                <FormControl>
                    <TeasyFormLabel>참고 사항</TeasyFormLabel>
                    <TeasyTextarea
                        value={formData.memo}
                        onChange={(e: any) => !isReadOnly && setFormData({ ...formData, memo: e.target.value })}
                        placeholder="입력"
                        isDisabled={isReadOnly}
                        _readOnly={{ bg: "gray.50", cursor: "default", color: "gray.600" }}
                    />
                </FormControl>

                {/* File Upload Sections */}

                <Box>
                    <HStack spacing={2} align="center" mb={2}>
                        <TeasyFormLabel mb={0}>견적서</TeasyFormLabel>
                        <Box>
                            <TeasyButton
                                onClick={() => quoteInputRef.current?.click()}
                                bg="gray.100"
                                color="gray.600"
                                _hover={{ bg: "gray.200", color: "gray.600" }}
                                h="32px"
                                size="sm"
                                px={3}
                                fontWeight="400"
                            >
                                견적서 파일 업로드
                            </TeasyButton>
                            <input type="file" hidden ref={quoteInputRef} onChange={(e) => handleFileAdd(e.target.files, 'quote')} />
                        </Box>
                    </HStack>
                    <ReportFileList
                        files={quotes}
                        type="quote"
                        isReadOnly={isReadOnly}
                        onConfirm={(file) => setViewerState({ isOpen: true, files: quotes, index: quotes.indexOf(file) })}
                        onDelete={(id) => handleFileRemove(id, 'quote')}
                    />
                </Box>
            </VStack>

            {/* Overlays */}
            <TeasyAudioPlayer
                isOpen={audioState.isOpen}
                onClose={() => setAudioState({ ...audioState, isOpen: false })}
                file={audioState.file}
            />
            <TeasyUniversalViewer
                isOpen={viewerState.isOpen}
                onClose={() => setViewerState({ ...viewerState, isOpen: false })}
                files={viewerState.files}
                initialIndex={viewerState.index}
            />
        </Box>
    );
});

InquiryForm.displayName = "InquiryForm";
