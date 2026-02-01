"use client";
import React, { forwardRef, useImperativeHandle, useState, useEffect } from "react";
import { VStack, FormControl, Box, Spinner, HStack, useToast, Flex } from "@chakra-ui/react";
import { CustomSelect } from "@/components/common/CustomSelect";
import { TeasyDateTimeInput, TeasyFormLabel, TeasyInput, TeasyTextarea, TeasyPhoneInput } from "@/components/common/UIComponents";
import { useAuth } from "@/context/AuthContext";
import { useReportMetadata } from "@/hooks/useReportMetadata";
import { db } from "@/lib/firebase";
import { doc, updateDoc, deleteDoc, collection, addDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore";
import { applyColonStandard } from "@/utils/textFormatter";

export const DemoScheduleForm = forwardRef(({ customer, activityId, initialData, isReadOnly = false, defaultManager = "" }: any, ref) => {
    const { userData } = useAuth();
    const toast = useToast();
    const { managerOptions, products } = useReportMetadata();
    const [isLoading, setIsLoading] = useState(false);

    const [formData, setFormData] = useState({
        date: initialData?.date || "",
        manager: initialData?.manager || defaultManager,
        location: initialData?.location || customer?.address || "",
        phone: initialData?.phone || customer?.phone || "",
        product: initialData?.product || "",
        memo: initialData?.memo || ""
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                date: initialData.date || "",
                manager: initialData.manager || "",
                location: initialData.location || "",
                phone: initialData.phone || "",
                product: initialData.product || "",
                memo: initialData.memo || ""
            });
        } else {
            const now = new Date();
            const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}  ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            setFormData(prev => ({ ...prev, date: formattedDate, manager: prev.manager || defaultManager, location: customer?.address || "", phone: customer?.phone || "" }));
        }
    }, [initialData, defaultManager]);

    useImperativeHandle(ref, () => ({
        submit: async () => {
            if (!formData.manager || !formData.date || !formData.product || !formData.location || !formData.phone) {
                toast({ title: "입력 부족", status: "warning", duration: 2000, position: "top" });
                return false;
            }

            setIsLoading(true);
            try {
                const selectedManager = managerOptions.find(o => o.value === formData.manager);
                const dataToSave = {
                    customerId: customer.id,
                    customerName: customer?.name || "",
                    type: "demo_schedule",
                    typeName: "시연 일정",
                    ...formData,
                    memo: applyColonStandard(formData.memo || ""),
                    managerName: selectedManager?.label || formData.manager,
                    managerRole: selectedManager?.role || "employee",
                    updatedAt: serverTimestamp(),
                    createdByName: userData?.name || ""
                };

                if (activityId) {
                    await updateDoc(doc(db, "activities", activityId), dataToSave);
                } else {
                    const q = query(collection(db, "activities"), where("customerId", "==", customer.id), where("type", "==", "demo_schedule"));
                    const snapshot = await getDocs(q);
                    const maxSeq = snapshot.docs.reduce((max, d) => Math.max(max, d.data().sequenceNumber || 0), 0);
                    await addDoc(collection(db, "activities"), { ...dataToSave, sequenceNumber: maxSeq + 1, createdAt: serverTimestamp(), createdBy: userData?.uid });
                }
                toast({ title: "예약 완료", status: "success", duration: 2000, position: "top" });
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
                        <TeasyFormLabel>시연 일시</TeasyFormLabel>
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
                    <TeasyFormLabel>방문 주소</TeasyFormLabel>
                    <TeasyInput
                        value={formData.location}
                        onChange={(e: any) => !isReadOnly && setFormData({ ...formData, location: e.target.value })}
                        placeholder="입력"
                        isDisabled={isReadOnly}
                    />
                </FormControl>

                <FormControl isRequired>
                    <TeasyFormLabel>연락처</TeasyFormLabel>
                    <TeasyPhoneInput
                        value={formData.phone}
                        onChange={(val: string) => !isReadOnly && setFormData({ ...formData, phone: val })}
                        placeholder="000-0000-0000"
                        isDisabled={isReadOnly}
                    />
                </FormControl>

                <FormControl isRequired>
                    <TeasyFormLabel>시연 상품</TeasyFormLabel>
                    <CustomSelect
                        placeholder="선택"
                        value={formData.product}
                        onChange={(val) => !isReadOnly && setFormData({ ...formData, product: val })}
                        options={products}
                        isDisabled={isReadOnly}
                    />
                </FormControl>

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
            </VStack>
        </Box>
    );
});

DemoScheduleForm.displayName = "DemoScheduleForm";
