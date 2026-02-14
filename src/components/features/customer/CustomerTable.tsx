import React, { useState, useEffect, useCallback } from "react";
import {
    Table,
    Thead,
    Tr,
    Th,
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
import { FixedSizeList, ListChildComponentProps } from "react-window";

const ROW_HEIGHT = 45;

// 반응형 테이블 높이 계산 Hook (SSR 안전)
const useWindowHeight = () => {
    const [height, setHeight] = useState(800);
    useEffect(() => {
        setHeight(window.innerHeight);
        const handleResize = () => setHeight(window.innerHeight);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    return height;
};

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

/**
 * Helper: 연락처 셀 (검색 매칭 + 부번호 표시)
 */
interface CellProps {
    customer: Customer;
    searchQuery: string;
    normalizedQuery: string;
    onEdit: (customer: Customer, type: "phone" | "address" | "product") => void;
}

const PhoneCell = ({ customer, searchQuery, normalizedQuery, onEdit }: CellProps) => {
    const subPhones = customer.sub_phones || [];
    const hasMultiple = subPhones.length > 0;
    const primaryMatches = normalizedQuery
        ? (customer.phone || "").replace(/[\s-]/g, "").toLowerCase().includes(normalizedQuery)
        : true;
    const matchedSub = (!primaryMatches && normalizedQuery)
        ? subPhones.find(p => (p || "").replace(/[\s-]/g, "").toLowerCase().includes(normalizedQuery))
        : undefined;
    const displayPhone = matchedSub || customer.phone;
    return (
        <Flex align="center" whiteSpace="nowrap" gap={1}>
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
                        onEdit(customer, "phone");
                    }}
                />
            )}
        </Flex>
    );
};

/**
 * Helper: 주소 셀 (검색 매칭 + 부주소 표시)
 */
const AddressCell = ({ customer, searchQuery, normalizedQuery, onEdit }: CellProps) => {
    const subAddresses = customer.sub_addresses || [];
    const hasMultiple = subAddresses.length > 0;
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
                        onEdit(customer, "address");
                    }}
                />
            )}
        </Flex>
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

    const handleEditClick = useCallback((customer: Customer, type: "phone" | "address" | "product") => {
        const config = {
            phone: { label: "연락처", field: "phone", values: [customer.phone, ...(customer.sub_phones || [])].filter(Boolean) },
            address: { label: "주소", field: "address", values: [customer.address, ...(customer.sub_addresses || [])].filter(Boolean) },
            product: { label: "보유 상품", field: "ownedProducts", values: (customer.ownedProducts || []).filter(Boolean) },
        };
        setEditTarget({ id: customer.id, ...config[type] });
        onEditOpen();
    }, [onEditOpen]);

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedIds(customers.map(c => c.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectItem = useCallback((id: string) => {
        setSelectedIds(prev =>
            prev.includes(id)
                ? prev.filter(itemId => itemId !== id)
                : [...prev, id]
        );
    }, [setSelectedIds]);

    // 반응형 높이 계산
    const windowHeight = useWindowHeight();
    const listHeight = Math.min(customers.length * ROW_HEIGHT, windowHeight - 355);

    // 검색어 정규화 (Row 외부에서 1회 계산)
    const normalizedQuery = React.useMemo(
        () => searchQuery.replace(/[\s-]/g, "").toLowerCase(),
        [searchQuery]
    );

    // 가상 스크롤 행 렌더러 (useCallback으로 안정화)
    const Row = useCallback(({ index, style }: ListChildComponentProps) => {
        const customer = customers[index];
        return (
            <Flex
                style={style}
                align="center"
                borderBottom="1px"
                borderColor="gray.100"
                _hover={{ bg: "gray.50" }}
                transition="all 0.2s"
                fontSize="sm"
                color="gray.600"
            >
                {/* 체크박스 3% */}
                <Box w="3%" textAlign="center" flexShrink={0}>
                    <Checkbox
                        colorScheme="purple"
                        isChecked={selectedIds.includes(customer.id)}
                        onChange={() => handleSelectItem(customer.id)}
                    />
                </Box>
                {/* 순번 6% */}
                <Box w="6%" textAlign="center" px={1} flexShrink={0} whiteSpace="nowrap">
                    {customer.no}
                </Box>
                {/* 고객명 10% */}
                <Box w="10%" textAlign="left" px={4} flexShrink={0} fontWeight="bold" color="gray.800" whiteSpace="nowrap">
                    <HighlightedText text={customer.name} query={searchQuery} />
                </Box>
                {/* 연락처 12% */}
                <Box w="12%" textAlign="left" px={4} flexShrink={0}>
                    <PhoneCell customer={customer} searchQuery={searchQuery} normalizedQuery={normalizedQuery} onEdit={handleEditClick} />
                </Box>
                {/* 주소 28% */}
                <Box w="28%" textAlign="left" px={4} flexShrink={0}>
                    <AddressCell customer={customer} searchQuery={searchQuery} normalizedQuery={normalizedQuery} onEdit={handleEditClick} />
                </Box>
                {/* 보유 상품 18% */}
                <Box w="18%" textAlign="left" px={4} flexShrink={0}>
                    <Flex align="center" gap={1}>
                        <Box isTruncated>
                            <HighlightedText text={(customer.ownedProducts || []).join(", ") || "-"} query={searchQuery} />
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
                </Box>
                {/* 관리 총판 9% */}
                <Box w="9%" textAlign="center" px={3} flexShrink={0}>
                    <TruncatedTooltip label={customer.distributor || "-"}>
                        <Box as="span" isTruncated display="block">
                            {customer.distributor ? (
                                <HighlightedText text={customer.distributor} query={searchQuery} />
                            ) : "-"}
                        </Box>
                    </TruncatedTooltip>
                </Box>
                {/* 등록일 9% */}
                <Box w="9%" textAlign="center" px={3} flexShrink={0} whiteSpace="pre-wrap">
                    {(customer.registeredDate || "").replace(/\s+/g, "  ").replace(/\//g, "-")}
                </Box>
                {/* 상세 5% */}
                <Box w="5%" textAlign="center" px={2} flexShrink={0}>
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
                </Box>
            </Flex>
        );
    }, [customers, selectedIds, searchQuery, normalizedQuery, handleSelectItem, handleEditClick]);

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
                {/* Sticky Header */}
                <Box>
                    <Table variant="simple" size="lg" w="full" style={{ tableLayout: "fixed" }}>
                        <Thead bg="gray.50">
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
                                <Th w="12%" color="gray.500" fontSize="xs" fontWeight="800" borderBottom="1px" borderColor="gray.100" textAlign="left" px={4}>연락처</Th>
                                <Th w="28%" color="gray.500" fontSize="xs" fontWeight="800" borderBottom="1px" borderColor="gray.100" textAlign="left" px={4}>주소</Th>
                                <Th w="18%" color="gray.500" fontSize="xs" fontWeight="800" borderBottom="1px" borderColor="gray.100" textAlign="left" px={4}>보유 상품</Th>
                                <Th w="9%" color="gray.500" fontSize="xs" fontWeight="800" borderBottom="1px" borderColor="gray.100" textAlign="center" px={3}>관리 총판</Th>
                                <Th w="9%" color="gray.500" fontSize="xs" fontWeight="800" borderBottom="1px" borderColor="gray.100" textAlign="center" px={3}>등록일</Th>
                                <Th w="5%" color="gray.500" fontSize="xs" fontWeight="800" borderBottom="1px" borderColor="gray.100" textAlign="center" px={2}>상세</Th>
                            </Tr>
                        </Thead>
                    </Table>
                </Box>

                {/* Virtual Scroll Body */}
                {isLoading ? (
                    <Center h="200px">
                        <VStack spacing={4}>
                            <Spinner size="lg" color="brand.500" thickness="4px" />
                            <Text color="gray.500" fontSize="sm" fontWeight="medium">데이터를 불러오는 중입니다...</Text>
                        </VStack>
                    </Center>
                ) : customers.length === 0 ? (
                    <Center h="200px">
                        <VStack spacing={2}>
                            <Text color="gray.400" fontSize="md" fontWeight="bold">검색 결과가 없습니다.</Text>
                            <Text color="gray.300" fontSize="xs">검색어를 확인하거나 필터를 초기화해 보세요.</Text>
                        </VStack>
                    </Center>
                ) : (
                    <FixedSizeList
                        height={listHeight}
                        itemCount={customers.length}
                        itemSize={ROW_HEIGHT}
                        width="100%"
                        overscanCount={5}
                    >
                        {Row}
                    </FixedSizeList>
                )}
            </Box>

            {/* 프로필 편집 모달 (연락처/주소/보유 상품) */}
            {editTarget && (
                <ProfileEditModal
                    isOpen={isEditOpen}
                    onClose={onEditClose}
                    customerId={editTarget?.id || ""}
                    label={editTarget?.label || ""}
                    field={editTarget?.field || ""}
                    initialValues={editTarget?.values || []}
                />
            )}
        </>
    );
};
