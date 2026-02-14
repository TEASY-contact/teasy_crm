// src/components/features/customer/CustomerRegistrationModal.tsx
"use client";
import { useState } from "react";
import {
    FormControl,
    VStack,
    useToast,
    Box,
    IconButton,
    Textarea
} from "@chakra-ui/react";
import { ArrowBackIcon } from "@chakra-ui/icons";
import {
    TeasyButton,
    TeasyInput,
    TeasyPhoneInput,
    TeasyFormLabel,
    TeasyModalHeader,
    TeasyModalOverlay,
    TeasyModalContent,
    TeasyModalBody,
    TeasyModalFooter,
    TeasyModal
} from "@/components/common/UIComponents";
import { CustomSelect } from "@/components/common/CustomSelect";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";

interface CustomerRegistrationModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const CustomerRegistrationModalContent = ({ onClose }: { onClose: () => void }) => {
    const { userData } = useAuth();
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [address, setAddress] = useState("");
    const [distributor, setDistributor] = useState("");
    const [memo, setMemo] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const queryClient = useQueryClient();
    const toast = useToast();

    const handleRegister = async () => {
        if (!name || !phone || !distributor) {
            toast({
                title: "정보 부족",
                description: "고객명, 연락처, 관리 총판은 필수 입력 사항입니다.",
                status: "warning",
                duration: 3000,
                isClosable: true,
            });
            return;
        }

        const phoneRegex = /^01[0-9]-[0-9]{3,4}-[0-9]{4}$/;
        if (!phoneRegex.test(phone)) {
            toast({
                title: "연락처 형식 오류",
                description: "올바른 연락처 형식이 아닙니다. (예: 010-0000-0000)",
                status: "warning",
                duration: 3000,
                isClosable: true,
                position: "top"
            });
            return;
        }

        setIsLoading(true);

        try {
            const docRef = await addDoc(collection(db, "customers"), {
                name,
                phone,
                address,
                distributor,
                license: "",
                notes: memo || "",
                sub_phones: [],
                sub_addresses: [],
                ownedProducts: [],
                manager: userData?.name || "알 수 없음",
                registeredDate: new Date().toISOString().split('T')[0],
                createdAt: serverTimestamp(),
                lastConsultDate: null,
                isLocked: false,
                lockedBy: null
            });

            // 참고 사항 → 채팅 메시지 자동 생성 (일괄 등록과 동일 구조)
            if (memo.trim()) {
                await addDoc(collection(db, "customer_comments"), {
                    customerId: docRef.id,
                    content: memo.trim(),
                    senderId: "TEASY_SYSTEM",
                    senderName: "시스템",
                    createdAt: serverTimestamp(),
                });
            }

            toast({
                title: "등록 성공",
                description: "데이터가 서버에 안전하게 저장되었습니다.",
                status: "success",
                duration: 3000,
                isClosable: true,
            });

            // Delay for Firestore indexing (v123.02)
            await new Promise(resolve => setTimeout(resolve, 500));
            await queryClient.invalidateQueries({ queryKey: ["customers"] });
            onClose();
        } catch (error: any) {
            console.error("DEBUG - Firestore Error:", error);
            toast({
                title: "저장 실패",
                description: "서버 저장 실패: 네트워크 환경이나 권한을 확인해 주세요.",
                status: "error",
                duration: 7000,
                isClosable: true,
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <TeasyModalContent>
            <TeasyModalHeader position="relative">
                <IconButton
                    aria-label="Back"
                    icon={<ArrowBackIcon />}
                    size="md"
                    position="absolute"
                    left="8px"
                    top="8px"
                    color="white"
                    variant="ghost"
                    _hover={{ bg: "whiteAlpha.300" }}
                    onClick={onClose}
                    type="button"
                />
                <Box as="span">
                    신규 고객 등록
                </Box>
            </TeasyModalHeader>
            <TeasyModalBody>
                {/* Focus Guard: Prevents automatic focus on the first input */}
                <Box tabIndex={0} w={0} h={0} opacity={0} position="absolute" />
                <VStack spacing={6}>
                    <FormControl isRequired>
                        <TeasyFormLabel>고객명</TeasyFormLabel>
                        <TeasyInput
                            placeholder="입력"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </FormControl>
                    <FormControl isRequired>
                        <TeasyFormLabel>연락처</TeasyFormLabel>
                        <TeasyPhoneInput
                            value={phone}
                            onChange={(val: string) => setPhone(val)}
                            placeholder="000-0000-0000"
                        />
                    </FormControl>
                    <FormControl>
                        <TeasyFormLabel>주소</TeasyFormLabel>
                        <TeasyInput
                            placeholder="입력"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                        />
                    </FormControl>
                    <FormControl isRequired>
                        <TeasyFormLabel>관리 총판</TeasyFormLabel>
                        <CustomSelect
                            value={distributor}
                            onChange={(val) => setDistributor(val)}
                            options={[
                                { value: "TEASY", label: "TEASY" },
                                { value: "divider", label: "", isDivider: true },
                                { value: "에이블클래스", label: "에이블클래스" },
                                { value: "리얼칠판", label: "리얼칠판" },
                                { value: "뷰라클", label: "뷰라클" },
                            ]}
                            placeholder="선택"
                        />
                    </FormControl>
                    <FormControl>
                        <TeasyFormLabel>참고 사항</TeasyFormLabel>
                        <Textarea
                            placeholder="고객 관련 참고 사항을 입력하세요"
                            value={memo}
                            onChange={(e) => setMemo(e.target.value)}
                            size="sm"
                            borderRadius="lg"
                            focusBorderColor="brand.500"
                            rows={3}
                            resize="vertical"
                        />
                    </FormControl>
                </VStack>
            </TeasyModalBody>
            <TeasyModalFooter>
                <TeasyButton version="secondary" onClick={onClose} w="108px" h="45px">취소</TeasyButton>
                <TeasyButton
                    onClick={handleRegister}
                    isLoading={isLoading}
                    w="108px"
                    h="45px"
                    shadow="brand-lg"
                >
                    등록 완료
                </TeasyButton>
            </TeasyModalFooter>
        </TeasyModalContent>
    );
};

export const CustomerRegistrationModal = ({ isOpen, onClose }: CustomerRegistrationModalProps) => {
    return (
        <TeasyModal isOpen={isOpen} onClose={onClose} size="md">
            <TeasyModalOverlay />
            <CustomerRegistrationModalContent onClose={onClose} />
        </TeasyModal>
    );
};
