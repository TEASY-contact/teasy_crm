import React, { useState, useRef } from "react";
import {
    Table,
    Thead,
    Tbody,
    Tr,
    Th,
    Td,
    Checkbox,
    Box,
    Flex,
    VStack,
    Badge,
    Tooltip,
} from "@chakra-ui/react";
import { Customer } from "@/types/domain";
import Link from "next/link";

/**
 * Helper: Tooltip that only shows when text is truncated (v123.79)
 */
const TruncatedTooltip = ({ label, children }: { label: string, children: React.ReactElement }) => {
    const [isTruncated, setIsTruncated] = React.useState(false);
    const ref = React.useRef<HTMLDivElement>(null);

    const checkTruncation = () => {
        if (ref.current) {
            setIsTruncated(ref.current.scrollWidth > ref.current.clientWidth);
        }
    };

    return (
        <Tooltip label={label} isDisabled={!isTruncated} hasArrow placement="top" borderRadius="lg" bg="gray.800">
            {React.cloneElement(children, { ref, onMouseEnter: checkTruncation })}
        </Tooltip>
    );
};

/**
 * Helper: Render parentheses with lighter weight (v123.79)
 */
const renderThinParentheses = (text: string) => {
    if (!text || (!text.includes('(') && !text.includes(')'))) return text;
    const parts = text.split(/([()])/g);
    return parts.map((part, i) =>
        (part === '(' || part === ')') ? (
            <Box as="span" key={i} fontWeight="300">
                {part}
            </Box>
        ) : part
    );
};

/**
 * Helper: Text highlighting for search matches (v123.79)
 */
const HighlightedText = ({ text, query }: { text: string, query: string }) => {
    if (!query || !text) return <>{text}</>;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return (
        <>
            {parts.map((part, i) =>
                part.toLowerCase() === query.toLowerCase() ? (
                    <Box as="span" key={i} bg="yellow.200" borderRadius="sm" px={0.5} fontWeight="extrabold">
                        {part}
                    </Box>
                ) : (
                    part
                )
            )}
        </>
    );
};

interface CustomerTableProps {
    customers: Customer[];
    searchQuery?: string;
    selectedIds: string[];
    setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
    isLoading?: boolean;
}

export const CustomerTable = ({ customers, searchQuery = "", selectedIds, setSelectedIds }: CustomerTableProps) => {

    const isAllSelected = customers.length > 0 && selectedIds.length === customers.length;
    const isIndeterminate = selectedIds.length > 0 && selectedIds.length < customers.length;

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedIds(customers.map(c => c.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectItem = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id)
                ? prev.filter(itemId => itemId !== id)
                : [...prev, id]
        );
    };

    return (
        <Box
            bg="white"
            borderRadius="xl"
            border="1px"
            borderColor="gray.200"
            overflow="hidden"
            shadow="sm"
        >
            <Box overflowY="auto" maxH="calc(100vh - 300px)">
                <Table variant="simple" size="lg" w="full" style={{ tableLayout: "fixed" }}>
                    <Thead bg="gray.50" position="sticky" top={0} zIndex={1}>
                        <Tr h="55px">
                            <Th w="3%" borderBottom="1px" borderColor="gray.100" textAlign="center" p={0}>
                                <Checkbox
                                    colorScheme="purple"
                                    isChecked={isAllSelected}
                                    isIndeterminate={isIndeterminate}
                                    onChange={handleSelectAll}
                                />
                            </Th>
                            <Th w="6%" color="gray.500" fontSize="xs" fontWeight="800" borderBottom="1px" borderColor="gray.100" textAlign="center" px={1}>순번</Th>
                            <Th w="10%" color="gray.500" fontSize="xs" fontWeight="800" borderBottom="1px" borderColor="gray.100" textAlign="left" px={3}>고객명</Th>
                            <Th w="12%" color="gray.500" fontSize="xs" fontWeight="800" borderBottom="1px" borderColor="gray.100" textAlign="center" px={3}>연락처</Th>
                            <Th w="28%" color="gray.500" fontSize="xs" fontWeight="800" borderBottom="1px" borderColor="gray.100" textAlign="left" px={4}>주소</Th>
                            <Th w="18%" color="gray.500" fontSize="xs" fontWeight="800" borderBottom="1px" borderColor="gray.100" textAlign="left" px={4}>보유 상품</Th>
                            <Th w="9%" color="gray.500" fontSize="xs" fontWeight="800" borderBottom="1px" borderColor="gray.100" textAlign="center" px={3}>관리 총판</Th>
                            <Th w="9%" color="gray.500" fontSize="xs" fontWeight="800" borderBottom="1px" borderColor="gray.100" textAlign="center" px={3}>등록일</Th>
                            <Th w="5%" color="gray.500" fontSize="xs" fontWeight="800" borderBottom="1px" borderColor="gray.100" textAlign="center" px={2}>상세</Th>
                        </Tr>
                    </Thead>
                    <Tbody>
                        {customers.map((customer) => (
                            <Tr key={customer.id} h="45px" _hover={{ bg: "gray.50" }} transition="all 0.2s">
                                <Td py={2} borderBottom="1px" borderColor="gray.100" textAlign="center" p={0}>
                                    <Checkbox
                                        colorScheme="purple"
                                        isChecked={selectedIds.includes(customer.id)}
                                        onChange={() => handleSelectItem(customer.id)}
                                    />
                                </Td>
                                <Td py={2} fontSize="sm" color="gray.600" borderBottom="1px" borderColor="gray.100" textAlign="center" whiteSpace="nowrap">{customer.no}</Td>
                                <Td py={2} fontSize="sm" fontWeight="bold" color="gray.800" borderBottom="1px" borderColor="gray.100" textAlign="left" px={4} whiteSpace="nowrap">
                                    <HighlightedText text={customer.name} query={searchQuery} />
                                </Td>
                                <Td py={2} fontSize="sm" color="gray.600" borderBottom="1px" borderColor="gray.100" textAlign="center">
                                    <VStack spacing={0} align="center" whiteSpace="nowrap">
                                        <Box w="full">
                                            <HighlightedText text={customer.phone} query={searchQuery} />
                                        </Box>
                                        {customer.sub_phones?.map((p, idx) => (
                                            <Box key={idx} w="full" color="gray.400" fontSize="sm">
                                                <HighlightedText text={p} query={searchQuery} />
                                            </Box>
                                        ))}
                                    </VStack>
                                </Td>
                                <Td py={2} fontSize="sm" color="gray.600" borderBottom="1px" borderColor="gray.100" textAlign="left" px={4}>
                                    <VStack spacing={0} align="start" whiteSpace="nowrap">
                                        <Box w="full">
                                            <HighlightedText text={customer.address} query={searchQuery} />
                                        </Box>
                                        {customer.sub_addresses?.map((a, idx) => (
                                            <Box key={idx} w="full" color="gray.400" fontSize="sm">
                                                <HighlightedText text={a} query={searchQuery} />
                                            </Box>
                                        ))}
                                    </VStack>
                                </Td>
                                <Td py={2} fontSize="sm" color="gray.600" borderBottom="1px" borderColor="gray.100" textAlign="left" px={4}>
                                    <TruncatedTooltip label={(customer.ownedProducts || []).join(", ") || "-"}>
                                        <Box as="span" isTruncated display="block">
                                            {renderThinParentheses((customer.ownedProducts || []).join(", ") || "-")}
                                        </Box>
                                    </TruncatedTooltip>
                                </Td>
                                <Td py={2} fontSize="sm" color="gray.600" borderBottom="1px" borderColor="gray.100" textAlign="center" px={3}>
                                    <TruncatedTooltip label={customer.distributor || "-"}>
                                        <Box as="span" isTruncated display="block">
                                            {customer.distributor ? (
                                                <HighlightedText text={customer.distributor} query={searchQuery} />
                                            ) : "-"}
                                        </Box>
                                    </TruncatedTooltip>
                                </Td>
                                <Td fontSize="sm" color="gray.600" py={2} borderBottom="1px" borderColor="gray.50" whiteSpace="pre-wrap">
                                    {(customer.registeredDate || "").replace(/\s+/g, "  ").replace(/\//g, "-")}
                                </Td>
                                <Td py={2} borderBottom="1px" borderColor="gray.100" whiteSpace="nowrap">
                                    <Flex justify="center" align="center">
                                        <Link href={`/customers/${customer.id}`}>
                                            <Badge
                                                bg="rgba(128, 90, 213, 0.1)"
                                                color="brand.500"
                                                cursor="pointer"
                                                px={3}
                                                py="3px"
                                                borderRadius="10px"
                                                textTransform="none"
                                                fontSize="xs"
                                                fontWeight="800"
                                                transition="all 0.2s"
                                                _hover={{ bg: "brand.500", color: "white" }}
                                            >
                                                상세보기
                                            </Badge>
                                        </Link>
                                    </Flex>
                                </Td>
                            </Tr>
                        ))}
                    </Tbody>
                </Table>
            </Box>
        </Box>
    );
};
