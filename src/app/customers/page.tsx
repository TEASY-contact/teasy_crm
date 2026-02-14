// src/app/customers/page.tsx
"use client";
import { Box, Flex, Spacer, useDisclosure, HStack, Badge, Text, VStack, useToast, Tooltip } from "@chakra-ui/react";
import { ThinParen } from "@/components/common/ui/BaseAtoms";
import { FilterBar } from "@/components/features/customer/FilterBar";
import { CustomerTable } from "@/components/features/customer/CustomerTable";
import { PageHeader, TeasyButton, TeasyInput, TeasyModal, TeasyModalBody, TeasyModalContent, TeasyModalFooter, TeasyModalHeader, TeasyModalOverlay } from "@/components/common/UIComponents";

import { useState, useMemo } from "react";
import { Customer } from "@/types/domain";
import { CustomerRegistrationModal } from "@/components/features/customer/CustomerRegistrationModal";
import { BulkImportModal } from "@/components/features/customer/BulkImportModal";
import { BulkImportResultModal } from "@/components/features/customer/BulkImportResultModal";
import { useBulkImport, BulkImportResult } from "@/hooks/useBulkImport";

import { db } from "@/lib/firebase";
import { doc, writeBatch } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useCustomerSearch } from "@/hooks/useCustomerSearch";

/**
 * Constants & Utilities: Standardized for Customer Management (v123.78)
 */

const SORT_STRATEGIES: Record<string, (a: Customer, b: Customer) => number> = {
    name: (a, b) => a.name.localeCompare(b.name, 'ko'),
    register: (a, b) => {
        const dateA = (a.registeredDate || "").replace(/\D/g, "");
        const dateB = (b.registeredDate || "").replace(/\D/g, "");
        return dateB.localeCompare(dateA);
    },
    activity: (a, b) => {
        const dateA = (a.lastConsultDate || "").replace(/\D/g, "");
        const dateB = (b.lastConsultDate || "").replace(/\D/g, "");
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateB.localeCompare(dateA);
    }
};

export default function CustomersPage() {
    const queryClient = useQueryClient();
    const {
        customers: searchedCustomers,
        isLoading,
        viewMode,
        setViewMode,
        searchQuery,
        setSearchQuery
    } = useCustomerSearch();

    const [sortBy, setSortBy] = useState("none");
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const { isOpen, onOpen, onClose } = useDisclosure();
    const { isOpen: isDelOpen, onOpen: onDelOpen, onClose: onDelClose } = useDisclosure();
    const { userData } = useAuth();
    const toast = useToast();
    const [delConfirmInput, setDelConfirmInput] = useState("");
    const isMaster = userData?.role === 'master';
    const { isOpen: isBulkOpen, onOpen: onBulkOpen, onClose: onBulkClose } = useDisclosure();
    const [bulkResult, setBulkResult] = useState<BulkImportResult | null>(null);
    const { downloadFailedTemplate } = useBulkImport();

    const refreshCustomers = async () => {
        await new Promise(resolve => setTimeout(resolve, 500));
        await queryClient.invalidateQueries({ queryKey: ["customers"] });
    };

    const finalData = useMemo(() => {
        // The hook already filters by search query.
        // We just need to apply sorting here.
        const sorted = [...searchedCustomers].sort((a, b) => {
            const strategy = SORT_STRATEGIES[sortBy];
            return strategy ? strategy(a, b) : 0;
        });

        return sorted.map((item, idx) => ({
            ...item,
            no: sorted.length - idx
        }));
    }, [searchedCustomers, sortBy]);

    const handleBulkDelete = async () => {
        if (delConfirmInput !== "삭제") {
            toast({ title: "확인 문구 불일치", description: "'삭제'를 정확히 입력해주세요.", status: "error" });
            return;
        }

        try {
            // writeBatch로 안전한 대량 삭제 (500건 단위)
            for (let i = 0; i < selectedIds.length; i += 500) {
                const batch = writeBatch(db);
                selectedIds.slice(i, i + 500).forEach(id => batch.delete(doc(db, "customers", id)));
                await batch.commit();
            }
            await refreshCustomers();
            toast({ title: "삭제 완료", description: `${selectedIds.length}명의 고객 정보가 삭제되었습니다.`, status: "success" });
            setSelectedIds([]);
            onDelClose();
            setDelConfirmInput("");
        } catch (error) {
            console.error(error);
            toast({ title: "삭제 실패", status: "error" });
        }
    };

    return (
        <Box p={0} bg="gray.50" minH="100vh">
            {/* Header Section using standardized Component */}
            <Box px={8} pt={8}>
                <PageHeader
                    title="고객 관리"
                    leftContent={
                        <Badge colorScheme="brand" borderRadius="full" px={3} py={1} fontSize="md">
                            {searchQuery
                                ? `검색결과 ${finalData.length}건`
                                : viewMode === "week" || viewMode === "none"
                                    ? `최근 1주일 ${finalData.length}명`
                                    : viewMode === "recent"
                                        ? `최근 1개월 ${finalData.length}명`
                                        : `전체 ${finalData.length}명`
                            }
                        </Badge>
                    }
                />
            </Box>

            {/* Filter & Actions Section */}
            <Flex align="center" mb={4} px={8} pt={4}>
                <HStack spacing={4}>
                    <FilterBar
                        onSearch={setSearchQuery}
                        onSort={setSortBy}
                        currentSort={sortBy}
                        onViewMode={(val) => { setViewMode(val as "none" | "week" | "recent" | "all"); setSelectedIds([]); }}
                        currentViewMode={viewMode}
                        currentSearch={searchQuery}
                    />
                    {isMaster && (
                        <HStack spacing={2} ml={2}>
                            <TeasyButton
                                version="danger"
                                onClick={onDelOpen}
                                isDisabled={selectedIds.length === 0}
                                fontWeight="500"
                            >
                                선택 삭제 <Box as="span" ml={1}><ThinParen text={`(${selectedIds.length})`} /></Box>
                            </TeasyButton>
                            <Tooltip label="준비 중인 기능입니다" hasArrow>
                                <TeasyButton
                                    version="secondary"
                                    borderColor="rgba(16, 124, 65, 0.3)"
                                    color="#107C41"
                                    isDisabled
                                    fontWeight="500"
                                >
                                    선택 다운로드 <Box as="span" ml={1}><ThinParen text={`(${selectedIds.length})`} /></Box>
                                </TeasyButton>
                            </Tooltip>
                        </HStack>
                    )}
                </HStack>
                <Spacer />
                <HStack spacing={3}>
                    {isMaster && (
                        <>
                            <Tooltip label="준비 중인 기능입니다" hasArrow>
                                <TeasyButton
                                    version="secondary"
                                    borderColor="rgba(16, 124, 65, 0.3)"
                                    color="#107C41"
                                    isDisabled
                                    fontWeight="500"
                                >
                                    전체 다운로드
                                </TeasyButton>
                            </Tooltip>
                            <TeasyButton version="secondary" onClick={onBulkOpen} fontWeight="500">
                                일괄 등록
                            </TeasyButton>

                        </>
                    )}
                    <TeasyButton shadow="sm" onClick={onOpen} fontWeight="500">+ 신규 고객 등록</TeasyButton>
                </HStack>
            </Flex>

            {/* Main Table */}
            <Box px={8}>
                <CustomerTable
                    customers={finalData}
                    searchQuery={searchQuery}
                    selectedIds={selectedIds}
                    setSelectedIds={setSelectedIds}
                    isLoading={isLoading}
                />
            </Box>

            <CustomerRegistrationModal isOpen={isOpen} onClose={onClose} />
            <BulkImportModal
                isOpen={isBulkOpen}
                onClose={onBulkClose}
                onResult={(r) => setBulkResult(r)}
            />
            <BulkImportResultModal
                isOpen={!!bulkResult}
                onClose={() => setBulkResult(null)}
                result={bulkResult}
                onDownloadFailed={() => bulkResult?.failedRows && downloadFailedTemplate(bulkResult.failedRows)}
            />

            {/* Delete Confirmation Modal */}
            <TeasyModal isOpen={isDelOpen} onClose={onDelClose} size="sm">
                <TeasyModalOverlay />
                <TeasyModalContent>
                    <TeasyModalHeader>고객 정보 삭제</TeasyModalHeader>
                    <TeasyModalBody>
                        <VStack spacing={4} align="stretch">
                            <Text fontSize="sm" color="gray.600">
                                선택한 <b>{selectedIds.length}명</b>의 고객 정보를 영구히 삭제하시겠습니까?<br />
                                삭제를 원하시면 아래에 <b>"삭제"</b>라고 입력해주세요.
                            </Text>
                            <TeasyInput
                                value={delConfirmInput}
                                onChange={(e) => setDelConfirmInput(e.target.value)}
                                placeholder="삭제 입력"
                                autoFocus
                            />
                        </VStack>
                    </TeasyModalBody>
                    <TeasyModalFooter>
                        <TeasyButton version="secondary" onClick={onDelClose}>취소</TeasyButton>
                        <TeasyButton
                            bg="red.500"
                            color="white"
                            _hover={{ bg: "red.600" }}
                            onClick={handleBulkDelete}
                        >
                            영구 삭제
                        </TeasyButton>
                    </TeasyModalFooter>
                </TeasyModalContent>
            </TeasyModal>
        </Box>
    );
}
