// src/app/admin/logs/page.tsx
"use client";
import { Box, Table, Thead, Tbody, Tr, Th, Td, Badge, Flex, InputGroup, InputLeftElement, Input } from "@chakra-ui/react";
import { MdSearch } from "react-icons/md";
import { PageHeader } from "@/components/common/UIComponents";
import { CustomSelect } from "@/components/common/CustomSelect";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { applyColonStandard } from "@/utils/textFormatter";

export default function AuditLogPage() {
    const [logs, setLogs] = useState<any[]>([]);
    const [category, setCategory] = useState("all");
    const router = useRouter();

    useEffect(() => {
        const q = query(collection(db, "system_logs"), orderBy("timestamp", "desc"), limit(100));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, []);

    const handleLogClick = (log: any) => {
        if (log.relatedCustomerId) router.push(`/customers/${log.relatedCustomerId}`);
        else if (log.relatedWorkId) router.push(`/work-requests`);
    };

    return (
        <Box p={0} bg="gray.50" minH="100vh">
            <Box px={8} pt={8}>
                <PageHeader title="시스템 로그 조회" />
            </Box>

            {/* Filter Section - Standardized */}
            <Flex align="center" mb={4} px={8} pt={4} gap={4}>
                <InputGroup maxW="350px" bg="white">
                    <InputLeftElement pointerEvents="none" h="45px">
                        <MdSearch color="gray.400" size="20px" />
                    </InputLeftElement>
                    <Input
                        h="45px"
                        borderRadius="lg"
                        placeholder="검색어 입력"
                        _placeholder={{ color: "gray.300", fontSize: "14px" }}
                        focusBorderColor="brand.500"
                        fontSize="sm"
                    />
                </InputGroup>
                <CustomSelect
                    width="210px"
                    value={category}
                    onChange={(val) => setCategory(val)}
                    placeholder="카테고리"
                    options={[
                        { value: "all", label: "전체 카테고리" },
                        { value: "stock", label: "재고 변동" },
                        { value: "delete", label: "데이터 삭제" },
                        { value: "excel", label: "엑셀 추출" },
                    ]}
                />
            </Flex>

            {/* Main Table Section - Standardized */}
            <Box px={8}>
                <Box bg="white" borderRadius="xl" border="1px" borderColor="gray.200" overflow="hidden" shadow="sm">
                    <Box overflowY="auto" maxH="calc(100vh - 300px)">
                        <Table variant="simple" size="lg">
                            <Thead bg="gray.50" position="sticky" top={0} zIndex={1}>
                                <Tr h="55px">
                                    <Th color="gray.500" fontSize="xs" fontWeight="800" borderBottom="1px" borderColor="gray.100">일시 (KST)</Th>
                                    <Th color="gray.500" fontSize="xs" fontWeight="800" borderBottom="1px" borderColor="gray.100">작업자</Th>
                                    <Th color="gray.500" fontSize="xs" fontWeight="800" borderBottom="1px" borderColor="gray.100">활동 유형</Th>
                                    <Th color="gray.500" fontSize="xs" fontWeight="800" borderBottom="1px" borderColor="gray.100">상세 내용</Th>
                                </Tr>
                            </Thead>
                            <Tbody>
                                {logs.map((log) => (
                                    <Tr
                                        key={log.id}
                                        h="45px"
                                        onClick={() => handleLogClick(log)}
                                        cursor="pointer"
                                        _hover={{ bg: "gray.50" }}
                                        transition="all 0.2s"
                                    >
                                        <Td fontSize="sm" color="gray.600" py={2} borderBottom="1px" borderColor="gray.50">
                                            {log.timestamp?.toDate().toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replace(/\. /g, '-').replace('.', '').replace(' ', '  ')}
                                        </Td>
                                        <Td fontSize="sm" fontWeight="bold" color="gray.800" py={2} borderBottom="1px" borderColor="gray.50">
                                            {log.operatorName}
                                        </Td>
                                        <Td fontSize="sm" py={2} borderBottom="1px" borderColor="gray.50">
                                            <Badge colorScheme={log.type === 'DELETE' ? 'red' : 'purple'} variant="subtle" px={2} borderRadius="md">
                                                {log.type}
                                            </Badge>
                                        </Td>
                                        <Td fontSize="sm" color="gray.600" py={2} borderBottom="1px" borderColor="gray.50" whiteSpace="pre-wrap">
                                            {applyColonStandard(log.description)}
                                        </Td>
                                    </Tr>
                                ))}
                            </Tbody>
                        </Table>
                    </Box>
                </Box>
            </Box>
        </Box>
    );
}
