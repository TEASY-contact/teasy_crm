"use client";
import React, { forwardRef, useImperativeHandle, useState, useEffect } from "react";
import { VStack, FormControl, Box, Spinner, HStack, useToast, Flex, Select } from "@chakra-ui/react";
import { formatAmount } from "@/utils/formatter";
import { CustomSelect } from "@/components/common/CustomSelect";
import { TeasyDateTimeInput, TeasyFormLabel, TeasyInput } from "@/components/common/UIComponents";
import { useAuth } from "@/context/AuthContext";
import { useReportMetadata } from "@/hooks/useReportMetadata";
import { db } from "@/lib/firebase";
import { doc, updateDoc, deleteDoc, collection, addDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore";

export const PurchaseConfirmForm = forwardRef(({ customer, activityId, initialData, isReadOnly = false, defaultManager = "" }: any, ref) => {
    const { userData } = useAuth();
    const toast = useToast();
    const { managerOptions } = useReportMetadata();
    const [isLoading, setIsLoading] = useState(false);

    const [formData, setFormData] = useState({
        date: initialData?.date || "",
        manager: initialData?.manager || defaultManager,
        payMethod: initialData?.payMethod || "입금",
        amount: initialData?.amount || "",
        discount: initialData?.discount || "미적용",
        discountAmount: initialData?.discountAmount || "",
        userId: initialData?.userId || "",
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                date: initialData.date || "",
                manager: initialData.manager || "",
                payMethod: initialData.payMethod || "입금",
                amount: initialData.amount || "",
                discount: initialData.discount || "미적용",
                discountAmount: initialData.discountAmount || "",
                userId: initialData.userId || "",
            });
        } else {
            const now = new Date();
            const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}  ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            setFormData(prev => ({ ...prev, date: formattedDate, manager: prev.manager || defaultManager }));
        }
    }, [initialData, defaultManager]);

    useImperativeHandle(ref, () => ({
        submit: async () => {
            if (!formData.payMethod || !formData.amount || !formData.manager) {
                toast({ title: "입력 부족", status: "warning", duration: 2000, position: "top" });
                return false;
            }

            setIsLoading(true);
            try {
                const selectedManager = managerOptions.find(o => o.value === formData.manager);
                const dataToSave = {
                    customerId: customer.id,
                    customerName: customer?.name || "",
                    type: "purchase_confirm",
                    typeName: "구매 확정",
                    ...formData,
                    managerName: selectedManager?.label || formData.manager,
                    managerRole: selectedManager?.role || "employee",
                    updatedAt: serverTimestamp(),
                    createdByName: userData?.name || ""
                };

                if (activityId) {
                    await updateDoc(doc(db, "activities", activityId), dataToSave);
                } else {
                    const q = query(collection(db, "activities"), where("customerId", "==", customer.id), where("type", "==", "purchase_confirm"));
                    const snapshot = await getDocs(q);
                    const maxSeq = snapshot.docs.reduce((max, d) => Math.max(max, d.data().sequenceNumber || 0), 0);
                    await addDoc(collection(db, "activities"), { ...dataToSave, sequenceNumber: maxSeq + 1, createdAt: serverTimestamp(), createdBy: userData?.uid });
                }
                toast({ title: "저장 성공", status: "success", duration: 2000, position: "top" });
                return true;
            } catch (error) { return false; } finally { setIsLoading(false); }
        },
        delete: async () => {
            if (!activityId) return false;
            setIsLoading(true);
            try {
                await deleteDoc(doc(db, "activities", activityId));
                toast({ title: "삭제 성공", status: "info", duration: 2000, position: "top" });
                return true;
            } catch (error) { return false; } finally { setIsLoading(false); }
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
                        <TeasyFormLabel>활동 일시</TeasyFormLabel>
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

                <FormControl isRequired>
                    <TeasyFormLabel>결제 방식</TeasyFormLabel>
                    <Select
                        size="md"
                        value={formData.payMethod}
                        onChange={(e) => !isReadOnly && setFormData({ ...formData, payMethod: e.target.value })}
                        isDisabled={isReadOnly}
                    >
                        <option value="입금">· 입금</option>
                        <option value="네이버">· 네이버</option>
                        <option value="자사몰">· 자사몰</option>
                    </Select>
                </FormControl>

                <Box p={4} bg="gray.50" borderRadius="md" border="1px" borderColor="gray.100">
                    <VStack spacing={4}>
                        <FormControl isRequired>
                            <TeasyFormLabel fontSize="xs">결제 금액</TeasyFormLabel>
                            <TeasyInput
                                size="sm"
                                bg="white"
                                value={formData.amount}
                                onChange={(e) => !isReadOnly && setFormData({ ...formData, amount: formatAmount(e.target.value) })}
                                placeholder="입력"
                                isDisabled={isReadOnly}
                                _readOnly={{ bg: "gray.50", cursor: "default", color: "gray.600" }}
                            />
                        </FormControl>
                        <HStack w="full">
                            <FormControl>
                                <TeasyFormLabel fontSize="xs">할인 내역</TeasyFormLabel>
                                <Select
                                    size="sm"
                                    bg="white"
                                    value={formData.discount}
                                    onChange={(e) => !isReadOnly && setFormData({ ...formData, discount: e.target.value })}
                                    isDisabled={isReadOnly}
                                >
                                    <option>미적용</option>
                                    <option>현금 할인</option>
                                    {formData.payMethod !== "입금" && <option>쿠폰 5%</option>}
                                </Select>
                            </FormControl>
                            <TeasyInput
                                size="sm"
                                mt={6}
                                value={formData.payMethod === "입금" ? formData.discountAmount : formData.userId}
                                placeholder="입력"
                                onChange={(e) => !isReadOnly && (formData.payMethod === "입금" ? setFormData({ ...formData, discountAmount: formatAmount(e.target.value, true) }) : setFormData({ ...formData, userId: e.target.value }))}
                                isDisabled={isReadOnly}
                                _readOnly={{ bg: "gray.50", cursor: "default", color: "gray.600" }}
                            />
                        </HStack>
                    </VStack>
                </Box>
            </VStack>
        </Box>
    );
});

PurchaseConfirmForm.displayName = "PurchaseConfirmForm";
