// src/components/features/admin/DuplicateManager.tsx
"use client";
import { Box, Table, Thead, Tbody, Tr, Th, Td, Button, Heading, Badge } from "@chakra-ui/react";

export const DuplicateManager = ({ duplicates }: any) => {
    return (
        <Box p={6} bg="white" borderRadius="xl" border="1px" borderColor="gray.200">
            <Heading size="md" mb={6}>중복 데이터 관리 센터</Heading>
            <Table variant="simple" size="sm">
                <Thead bg="gray.50">
                    <Tr>
                        <Th>고객명</Th>
                        <Th>연락처</Th>
                        <Th>등록일</Th>
                        <Th>상태</Th>
                        <Th>조치</Th>
                    </Tr>
                </Thead>
                <Tbody>
                    {duplicates.map((item: any) => (
                        <Tr key={item.id}>
                            <Td fontWeight="bold">{item.name}</Td>
                            <Td>{item.phone}</Td>
                            <Td>{item.registeredDate}</Td>
                            <Td><Badge colorScheme="orange">중복 의심</Badge></Td>
                            <Td>
                                <Button size="xs" colorScheme="purple" variant="outline" mr={2}>병합</Button>
                                <Button size="xs" colorScheme="red" variant="ghost">삭제</Button>
                            </Td>
                        </Tr>
                    ))}
                </Tbody>
            </Table>
        </Box>
    );
};
