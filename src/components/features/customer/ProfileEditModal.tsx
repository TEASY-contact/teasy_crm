// src/components/features/customer/ProfileEditModal.tsx
"use client";
import React, { useState, useEffect } from "react";
import { ArrowBackIcon } from "@chakra-ui/icons";
import {
    VStack,
    HStack,
    Text,
    IconButton,
    FormControl,
    useToast,
    Divider,
    NumberInput,
    NumberInputField,
    NumberInputStepper,
    NumberIncrementStepper,
    NumberDecrementStepper,
    Box,
    Flex,
    Spacer,
    Spinner,
} from "@chakra-ui/react";
import { useQueryClient } from "@tanstack/react-query";
import { MdRemoveCircleOutline } from "react-icons/md";
import {
    TeasyButton,
    TeasyInput,
    TeasyPhoneInput,
    TeasyModalHeader,
    TeasyModalOverlay,
    TeasyModalContent,
    TeasyModalBody,
    TeasyModalFooter,
    TeasyModal,
    ThinParen
} from "@/components/common/UIComponents";
import { db } from "@/lib/firebase";
import { formatPhone } from "@/utils/formatter";
import { doc, updateDoc } from "firebase/firestore";

interface ProfileEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    customerId: string;
    label: string;
    field: string;
    initialValues: string[];
}

export const ProfileEditModal = ({
    isOpen,
    onClose,
    customerId,
    label,
    field,
    initialValues
}: ProfileEditModalProps) => {
    const [values, setValues] = useState<string[]>([]);
    const [newValue, setNewValue] = useState("");
    const [count, setCount] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const toast = useToast();
    const queryClient = useQueryClient();

    useEffect(() => {
        if (isOpen) {
            setValues([...initialValues]);
            setNewValue("");
            setCount(1);
        }
    }, [isOpen, initialValues]);

    const handleRemove = (index: number) => {
        setValues(values.filter((_, i) => i !== index));
    };

    const handleAdd = () => {
        if (!newValue.trim()) return;

        const formattedValue = (label === "보유 상품" || label === "라이선스")
            ? `${newValue.trim()} x ${count}`
            : (label === "연락처" ? formatPhone(newValue.trim()) : newValue.trim());

        setValues([...values, formattedValue]);
        setNewValue("");
        setCount(1);
    };

    const handleSave = async () => {
        setIsLoading(true);
        try {
            const docRef = doc(db, "customers", customerId);

            // Map labels/UI-fields to actual DB fields if needed
            // Based on InquiryForm and common usage:
            // "연락처" -> phone (index 0), sub_phones (rest)
            // "주소" -> address (index 0), sub_addresses (rest)
            // "보유 상품" -> ownedProducts
            // "라이선스" -> license (single string or array)

            let updateData: any = {};
            if (label === "연락처") {
                updateData = {
                    phone: values[0] || "",
                    sub_phones: values.slice(1)
                };
            } else if (label === "주소") {
                updateData = {
                    address: values[0] || "",
                    sub_addresses: values.slice(1)
                };
            } else if (label === "보유 상품") {
                updateData = {
                    ownedProducts: values
                };
            } else if (label === "라이선스") {
                updateData = {
                    license: values[0] || ""
                };
            }

            // 고객 정보 수정 시 lastConsultDate 갱신 → 최근 1주일 목록 포함
            const today = new Date().toISOString().split('T')[0];
            await updateDoc(docRef, { ...updateData, lastConsultDate: today });

            toast({
                title: "저장 성공",
                status: "success",
                duration: 2000,
            });

            // Delay for Firestore indexing (v123.05)
            await new Promise(resolve => setTimeout(resolve, 500));
            await queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
            await queryClient.invalidateQueries({ queryKey: ["customers"] });

            onClose();
        } catch (error) {
            console.error("Save Error:", error);
            toast({
                title: "저장 실패",
                status: "error",
                duration: 3000,
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <TeasyModal isOpen={isOpen} onClose={onClose} size="sm">
            <TeasyModalOverlay />
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
                        {label || "정보 수정"}
                    </Box>
                </TeasyModalHeader>
                <TeasyModalBody>
                    <VStack align="stretch" spacing={4}>
                        {/* Existing Items */}
                        <VStack align="stretch" spacing={2} maxH="200px" overflowY="auto" px={1}>
                            {values.map((v, i) => (
                                <HStack key={i} justify="space-between" bg="gray.50" p={2} borderRadius="md">
                                    <Text fontSize="sm" fontWeight="medium" color="gray.700">
                                        {(() => {
                                            let displayValue = label === "연락처" ? formatPhone(v) : v;
                                            if (label === "보유 상품" || label === "라이선스") {
                                                // Convert legacy (count) format to standardized x count for display
                                                displayValue = displayValue.replace(/\s\((\d+)\)$/, ' x $1');
                                            }
                                            return <ThinParen text={displayValue} />;
                                        })()}
                                    </Text>
                                    <IconButton
                                        aria-label="Remove"
                                        icon={<MdRemoveCircleOutline />}
                                        size="xs"
                                        variant="ghost"
                                        color="red.400"
                                        onClick={() => handleRemove(i)}
                                        _hover={{ color: "red.600", bg: "red.50" }}
                                        type="button"
                                    />
                                </HStack>
                            ))}
                        </VStack>

                        <Divider borderColor="gray.100" />

                        {/* Add New Item */}
                        <FormControl>
                            <VStack align="stretch" spacing={3}>
                                <HStack spacing={2}>
                                    {label === "연락처" ? (
                                        <TeasyPhoneInput
                                            value={newValue}
                                            onChange={(val: string) => setNewValue(val)}
                                            placeholder="000-0000-0000"
                                        />
                                    ) : (
                                        <TeasyInput
                                            value={newValue}
                                            onChange={(e) => {
                                                if (label === "라이선스") {
                                                    let val = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                                                    if (val.length > 25) val = val.substring(0, 25);
                                                    let formatted = '';
                                                    for (let i = 0; i < val.length; i++) {
                                                        if (i > 0 && i % 5 === 0) formatted += '-';
                                                        formatted += val[i];
                                                    }
                                                    setNewValue(formatted);
                                                } else {
                                                    setNewValue(e.target.value);
                                                }
                                            }}
                                            placeholder={label === "라이선스" ? "XXXXX-XXXXX-..." : "입력"}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleAdd();
                                            }}
                                        />
                                    )}

                                    {(label === "보유 상품" || label === "라이선스") && (
                                        <NumberInput
                                            size="sm"
                                            maxW="70px"
                                            defaultValue={1}
                                            min={1}
                                            max={99}
                                            value={count}
                                            onChange={(_, val) => setCount(val)}
                                        >
                                            <NumberInputField
                                                h="45px"
                                                borderRadius="lg"
                                                borderColor="gray.200"
                                                _focus={{ borderColor: "brand.500", boxShadow: "0 0 0 1px #805AD5" }}
                                            />
                                            <NumberInputStepper>
                                                <NumberIncrementStepper />
                                                <NumberDecrementStepper />
                                            </NumberInputStepper>
                                        </NumberInput>
                                    )}
                                </HStack>
                                <TeasyButton onClick={handleAdd} w="full">추가</TeasyButton>
                            </VStack>
                        </FormControl>
                    </VStack>
                </TeasyModalBody>
                <TeasyModalFooter>
                    <TeasyButton version="ghost" onClick={onClose}>닫기</TeasyButton>
                    <TeasyButton isLoading={isLoading} onClick={handleSave}>저장</TeasyButton>
                </TeasyModalFooter>
            </TeasyModalContent>
        </TeasyModal>
    );
};
