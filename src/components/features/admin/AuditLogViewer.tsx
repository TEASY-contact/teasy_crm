// src/components/features/admin/AuditLogViewer.tsx
"use client";
import { Box, Table, Thead, Tbody, Tr, Th, Td, Input, Select, HStack, Badge } from "@chakra-ui/react";

export const AuditLogViewer = () => {
    return (
        <Box bg="white" p={6} borderRadius="xl" border="1px" borderColor="gray.200">
            <HStack mb={6} spacing={4}>
                <Input placeholder="검색어 입력" size="sm" maxW="300px" focusBorderColor="brand.500" />
                <Select size="sm" maxW="150px" focusBorderColor="brand.500">
                    <option>전체 카테고리</option>
                    <option>재고 변동</option>
                    <option>계정 관리</option>
                    <option>데이터 삭제</option>
                </Select>
            </HStack>

            <Table variant="simple" size="sm">
                <Thead bg="gray.50">
                    <Tr>
                        <Th>일시 (KST)</Th>
                        <Th>작업자</Th>
                        <Th>활동 유형</Th>
                        <Th>상세 내용</Th>
                        <Th>비고</Th>
                    </Tr>
                </Thead>
                <Tbody>
                    {/* Logs will be rendered here dynamically */}
                </Tbody>
            </Table>
        </Box>
    );
};
