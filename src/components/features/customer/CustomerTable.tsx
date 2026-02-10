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
    Text,
    Spinner,
    Center,
    IconButton,
    useDisclosure,
} from "@chakra-ui/react";
import { AddIcon } from "@chakra-ui/icons";
import { Customer } from "@/types/domain";
import Link from "next/link";
import { ThinParen } from "@/components/common/ui/BaseAtoms";
import { ProfileEditModal } from "@/components/features/customer/ProfileEditModal";

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
 * Helper: Text highlighting for search matches (v123.79)
 */
const HighlightedText = ({ text, query }: { text: string, query: string }) => {
    if (!query || !text) return <>{text}</>;

    // 하이픈 무시 매칭: 검색어와 텍스트 모두 하이픈 제거 후 비교
    const strippedText = text.replace(/-/g, "");
    const strippedQuery = query.replace(/-/g, "");
    const escapedQuery = strippedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = strippedText.match(new RegExp(escapedQuery, 'i'));

    if (match && match.index !== undefined) {
        // 원본 텍스트에서 매칭 범위를 역추적
        let origStart = 0, stripped = 0;
        while (stripped < match.index && origStart < text.length) {
            if (text[origStart] !== '-') stripped++;
            origStart++;
        }
        let origEnd = origStart, matchLen = 0;
        while (matchLen < match[0].length && origEnd < text.length) {
            if (text[origEnd] !== '-') matchLen++;
            origEnd++;
        }
        const before = text.slice(0, origStart);
        const matched = text.slice(origStart, origEnd);
        const after = text.slice(origEnd);
        return (
            <>
                {before}
                <Box as="span" bg="yellow.200" borderRadius="sm" px={0.5} fontWeight="extrabold">
                    {matched}
                </Box>
                {after}
            </>
        );
    }

    // 기본 정확 매칭 (하이픈 포함 일치)
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

export const CustomerTable = ({ customers, searchQuery = "", selectedIds, setSelectedIds, isLoading }: CustomerTableProps) => {

    const isAllSelected = customers.length > 0 && selectedIds.length === customers.length;
    const isIndeterminate = selectedIds.length > 0 && selectedIds.length < customers.length;

    // 프로필 편집 모달 상태 (연락처/주소/보유 상품 공용)
    const { isOpen: isEditOpen, onOpen: onEditOpen, onClose: onEditClose } = useDisclosure();
    const [editTarget, setEditTarget] = useState<{ id: string; label: string; field: string; values: string[] } | null>(null);

    const handleEditClick = (customer: Customer, type: "phone" | "address" | "product") => {
        const config = {
            phone: { label: "연락처", field: "phone", values: [customer.phone, ...(customer.sub_phones || [])].filter(Boolean) },
            address: { label: "주소", field: "address", values: [customer.address, ...(customer.sub_addresses || [])].filter(Boolean) },
            product: { label: "보유 상품", field: "ownedProducts", values: (customer.ownedProducts || []).filter(Boolean) },
        };
        setEditTarget({ id: customer.id, ...config[type] });
        onEditOpen();
    };

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
        <>
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
                                <Th w="10%" color="gray.500" fontSize="xs" fontWeight="800" borderBottom="1px" borderColor="gray.100" textAlign="left" px={4}>고객명</Th>
                                <Th w="12%" color="gray.500" fontSize="xs" fontWeight="800" borderBottom="1px" borderColor="gray.100" textAlign="center" px={3}>연락처</Th>
                                <Th w="28%" color="gray.500" fontSize="xs" fontWeight="800" borderBottom="1px" borderColor="gray.100" textAlign="left" px={4}>주소</Th>
                                <Th w="18%" color="gray.500" fontSize="xs" fontWeight="800" borderBottom="1px" borderColor="gray.100" textAlign="left" px={4}>보유 상품</Th>
                                <Th w="9%" color="gray.500" fontSize="xs" fontWeight="800" borderBottom="1px" borderColor="gray.100" textAlign="center" px={3}>관리 총판</Th>
                                <Th w="9%" color="gray.500" fontSize="xs" fontWeight="800" borderBottom="1px" borderColor="gray.100" textAlign="center" px={3}>등록일</Th>
                                <Th w="5%" color="gray.500" fontSize="xs" fontWeight="800" borderBottom="1px" borderColor="gray.100" textAlign="center" px={2}>상세</Th>
                            </Tr>
                        </Thead>
                        <Tbody>
                            {isLoading ? (
                                <Tr>
                                    <Td colSpan={9} h="200px">
                                        <Center>
                                            <VStack spacing={4}>
                                                <Spinner size="lg" color="brand.500" thickness="4px" />
                                                <Text color="gray.500" fontSize="sm" fontWeight="medium">데이터를 불러오는 중입니다...</Text>
                                            </VStack>
                                        </Center>
                                    </Td>
                                </Tr>
                            ) : customers.length === 0 ? (
                                <Tr>
                                    <Td colSpan={9} h="200px">
                                        <Center>
                                            <VStack spacing={2}>
                                                <Text color="gray.400" fontSize="md" fontWeight="bold">검색 결과가 없습니다.</Text>
                                                <Text color="gray.300" fontSize="xs">검색어를 확인하거나 필터를 초기화해 보세요.</Text>
                                            </VStack>
                                        </Center>
                                    </Td>
                                </Tr>
                            ) : (
                                customers.map((customer) => (
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
                                        <Td px={3} py={2} fontSize="sm" color="gray.600" borderBottom="1px" borderColor="gray.100" textAlign="center">
                                            {(() => {
                                                const subPhones = customer.sub_phones || [];
                                                const hasMultiple = subPhones.length > 0;
                                                // 검색어가 sub_phones에 매칭되면 해당 번호를 표시
                                                const normalizedQuery = searchQuery.replace(/[\s-]/g, "").toLowerCase();
                                                const primaryMatches = normalizedQuery
                                                    ? (customer.phone || "").replace(/[\s-]/g, "").toLowerCase().includes(normalizedQuery)
                                                    : true;
                                                const matchedSub = (!primaryMatches && normalizedQuery)
                                                    ? subPhones.find(p => (p || "").replace(/[\s-]/g, "").toLowerCase().includes(normalizedQuery))
                                                    : undefined;
                                                const displayPhone = matchedSub || customer.phone;

                                                return (
                                                    <Flex align="center" justify="center" whiteSpace="nowrap" gap={1}>
                                                        <HighlightedText text={displayPhone} query={searchQuery} />
                                                        {hasMultiple && (
                                                            <IconButton
                                                                aria-label="연락처 관리"
                                                                icon={<AddIcon />}
                                                                size="xs"
                                                                variant="ghost"
                                                                isRound
                                                                color="gray.400"
                                                                fontSize="8px"
                                                                minW="18px"
                                                                h="18px"
                                                                border="1px"
                                                                borderColor="gray.300"
                                                                _hover={{ color: "brand.500", borderColor: "brand.500", bg: "brand.50" }}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleEditClick(customer, "phone");
                                                                }}
                                                            />
                                                        )}
                                                    </Flex>
                                                );
                                            })()}
                                        </Td>
                                        <Td py={2} fontSize="sm" color="gray.600" borderBottom="1px" borderColor="gray.100" textAlign="left" px={4}>
                                            {(() => {
                                                const subAddresses = customer.sub_addresses || [];
                                                const hasMultiple = subAddresses.length > 0;
                                                const normalizedQuery = searchQuery.replace(/[\s-]/g, "").toLowerCase();
                                                const primaryMatches = normalizedQuery
                                                    ? (customer.address || "").replace(/[\s-]/g, "").toLowerCase().includes(normalizedQuery)
                                                    : true;
                                                const matchedSub = (!primaryMatches && normalizedQuery)
                                                    ? subAddresses.find(a => (a || "").replace(/[\s-]/g, "").toLowerCase().includes(normalizedQuery))
                                                    : undefined;
                                                const displayAddress = matchedSub || customer.address;

                                                return (
                                                    <Flex align="center" whiteSpace="nowrap" gap={1}>
                                                        <Box isTruncated>
                                                            <HighlightedText text={displayAddress} query={searchQuery} />
                                                        </Box>
                                                        {hasMultiple && (
                                                            <IconButton
                                                                aria-label="주소 관리"
                                                                icon={<AddIcon />}
                                                                size="xs"
                                                                variant="ghost"
                                                                isRound
                                                                color="gray.400"
                                                                fontSize="8px"
                                                                minW="18px"
                                                                h="18px"
                                                                border="1px"
                                                                borderColor="gray.300"
                                                                _hover={{ color: "brand.500", borderColor: "brand.500", bg: "brand.50" }}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleEditClick(customer, "address");
                                                                }}
                                                            />
                                                        )}
                                                    </Flex>
                                                );
                                            })()}
                                        </Td>
                                        <Td py={2} fontSize="sm" color="gray.600" borderBottom="1px" borderColor="gray.100" textAlign="left" px={4}>
                                            <Flex align="center" gap={1}>
                                                <Box isTruncated>
                                                    <ThinParen text={(customer.ownedProducts || []).join(", ") || "-"} />
                                                </Box>
                                                {(customer.ownedProducts || []).length >= 2 && (
                                                    <IconButton
                                                        aria-label="보유 상품 관리"
                                                        icon={<AddIcon />}
                                                        size="xs"
                                                        variant="ghost"
                                                        isRound
                                                        color="gray.400"
                                                        fontSize="8px"
                                                        minW="18px"
                                                        h="18px"
                                                        border="1px"
                                                        borderColor="gray.300"
                                                        _hover={{ color: "brand.500", borderColor: "brand.500", bg: "brand.50" }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleEditClick(customer, "product");
                                                        }}
                                                    />
                                                )}
                                            </Flex>
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
                                        <Td px={3} fontSize="sm" color="gray.600" py={2} borderBottom="1px" borderColor="gray.100" whiteSpace="pre-wrap" textAlign="center">
                                            {(customer.registeredDate || "").replace(/\s+/g, "  ").replace(/\//g, "-")}
                                        </Td>
                                        <Td py={2} px={2} borderBottom="1px" borderColor="gray.100" whiteSpace="nowrap">
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
                                ))
                            )}
                        </Tbody>
                    </Table>
                </Box>
            </Box>

            {/* 프로필 편집 모달 (연락처/주소/보유 상품) */}
            {editTarget && (
                <ProfileEditModal
                    isOpen={isEditOpen}
                    onClose={onEditClose}
                    customerId={editTarget!.id}
                    label={editTarget!.label}
                    field={editTarget!.field}
                    initialValues={editTarget!.values}
                />
            )}
        </>
    );
};
