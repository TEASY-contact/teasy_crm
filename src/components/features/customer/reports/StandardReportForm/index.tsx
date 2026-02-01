"use client";
import React, { forwardRef, useImperativeHandle, useState, useEffect } from "react";
import { VStack, FormControl, Box, Spinner, HStack, useToast, Flex } from "@chakra-ui/react";
import { CustomSelect } from "@/components/common/CustomSelect";
import { TeasyDateTimeInput, TeasyFormLabel, TeasyInput, TeasyTextarea } from "@/components/common/UIComponents";
import { useAuth } from "@/context/AuthContext";
import { useReportMetadata } from "@/hooks/useReportMetadata";
import { db } from "@/lib/firebase";
import { doc, updateDoc, deleteDoc, collection, addDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore";
import { applyColonStandard } from "@/utils/textFormatter";

/**
 * Modular StandardReportForm.
 * Handles generic reports (Standard, Install Schedule/Complete, A/S Schedule/Complete, Remote A/S).
 */
export const StandardReportForm = forwardRef(({
    customer,
    activityId,
    initialData,
    isReadOnly = false,
    defaultManager = "",
    reportType = "standard", // Dynamically set by parent
    reportLabel = "일반 업무" // Dynamically set by parent
}: any, ref) => {
    const { userData } = useAuth();
    const toast = useToast();
    const { managerOptions } = useReportMetadata();
    const [isLoading, setIsLoading] = useState(false);

    const [formData, setFormData] = useState({
        date: initialData?.date || "",
        manager: initialData?.manager || defaultManager,
        memo: initialData?.memo || ""
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                date: initialData.date || "",
                manager: initialData.manager || "",
                memo: initialData.memo || ""
            });
        } else {
            const now = new Date();
            const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}  ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            setFormData(prev => ({ ...prev, date: formattedDate, manager: prev.manager || defaultManager }));
        }
    }, [initialData, defaultManager]);

    useImperativeHandle(ref, () => ({
        submit: async () => {
            if (!formData.manager || !formData.memo) {
                toast({ title: "입력 부족", status: "warning", duration: 2000, position: "top" });
                return false;
            }

            setIsLoading(true);
            try {
                const selectedManager = managerOptions.find(o => o.value === formData.manager);
                const dataToSave = {
                    customerId: customer.id,
                    customerName: customer?.name || "",
                    type: reportType,
                    typeName: reportLabel,
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
                    const q = query(collection(db, "activities"), where("customerId", "==", customer.id), where("type", "==", reportType));
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
                    <TeasyFormLabel>활동 내용</TeasyFormLabel>
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

StandardReportForm.displayName = "StandardReportForm";
