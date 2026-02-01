// src/components/features/customer/ProfileEditModal.tsx
"use client";
import React, { useState, useEffect } from "react";
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
} from "@chakra-ui/react";
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
            ? `${newValue.trim()} (${count})`
            : newValue.trim();

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

            await updateDoc(docRef, updateData);

            toast({
                title: "저장 성공",
                status: "success",
                duration: 2000,
            });
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
                <TeasyModalHeader>{label}</TeasyModalHeader>
                <TeasyModalBody>
                    <VStack align="stretch" spacing={4}>
                        {/* Existing Items */}
                        <VStack align="stretch" spacing={2} maxH="200px" overflowY="auto" px={1}>
                            {values.map((v, i) => (
                                <HStack key={i} justify="space-between" bg="gray.50" p={2} borderRadius="md">
                                    <Text fontSize="sm" fontWeight="medium" color="gray.700">
                                        <ThinParen text={v} />
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
                                            onChange={(e) => setNewValue(e.target.value)}
                                            placeholder="입력"
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
