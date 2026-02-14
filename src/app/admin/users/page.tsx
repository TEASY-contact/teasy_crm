// src/app/admin/users/page.tsx
"use client";
import { useState, useEffect } from "react";
import {
    Box, HStack, VStack, Text, InputGroup, InputLeftElement, Input,
    Table, Thead, Tbody, Tr, Th, Td, Badge,
    useDisclosure, Flex, Spinner, IconButton, Tooltip, Switch, Spacer
} from "@chakra-ui/react";
import { MdSearch, MdPersonAdd, MdEdit, MdBlock } from "react-icons/md";
import { PageHeader, TeasyButton, SurnameBadge } from "@/components/common/UIComponents";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, doc, updateDoc } from "firebase/firestore";
import { UserData, UserRole } from "@/types/auth";
import { isTimestamp } from "@/utils/typeGuards";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserCreateModal } from "../../../components/features/admin/UserCreateModal";
import { UserEditModal } from "../../../components/features/admin/UserEditModal";

const ROLE_LABELS: Record<UserRole, string> = {
    master: "최고 관리자",
    admin: "관리자",
    employee: "임직원",
    partner: "협력사"
};

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

export default function UserManagementPage() {
    const queryClient = useQueryClient();
    const { data: users = [], isLoading } = useQuery({
        queryKey: ["users", "list"],
        queryFn: async () => {
            const q = query(collection(db, "users"), orderBy("name", "asc"));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                uid: doc.id,
                ...doc.data()
            } as UserData));
        }
    });

    const refreshUsers = async () => {
        await new Promise(resolve => setTimeout(resolve, 500));
        await queryClient.invalidateQueries({ queryKey: ["users", "list"] });
    };

    const [search, setSearch] = useState("");
    const createDisclosure = useDisclosure();
    const editDisclosure = useDisclosure();
    const [selectedUser, setSelectedUser] = useState<UserData | null>(null);

    const filteredUsers = users.filter(u =>
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())
    );

    const handleEdit = (user: UserData) => {
        setSelectedUser(user);
        editDisclosure.onOpen();
    };

    const togglePermission = async (userId: string, field: string, currentVal: any) => {
        try {
            const updateData: any = {};
            if (field === 'status') {
                updateData.status = currentVal;
                updateData.bannedUntil = currentVal === 'banned' ? '2124-12-31' : null;
            } else {
                updateData[field] = !currentVal;
            }
            await updateDoc(doc(db, "users", userId), updateData);
            await refreshUsers();
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <Box p={0} bg="gray.50" minH="100vh">
            <Box px={8} pt={8}>
                <PageHeader
                    title="임직원 관리"
                    leftContent={
                        <Badge colorScheme="brand" borderRadius="full" px={3} py={1} fontSize="md">
                            TOTAL. {filteredUsers.length}
                        </Badge>
                    }
                />
            </Box>

            {/* Filter Section - Standardized (Search + Actions) */}
            <Flex align="center" mb={4} px={8} pt={4}>
                <InputGroup maxW="350px" bg="white">
                    <InputLeftElement pointerEvents="none" h="45px">
                        <MdSearch color="gray.400" size="20px" />
                    </InputLeftElement>
                    <Input
                        h="45px"
                        borderRadius="lg"
                        placeholder="이름 또는 이메일 검색"
                        _placeholder={{ color: "gray.300", fontSize: "14px" }}
                        focusBorderColor="brand.500"
                        fontSize="sm"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </InputGroup>
                <Spacer />
                <HStack spacing={3}>
                    <TeasyButton shadow="sm" leftIcon={<MdPersonAdd />} onClick={createDisclosure.onOpen}>
                        + 임직원 추가
                    </TeasyButton>
                </HStack>
            </Flex>

            {/* Main Table Section - Standardized */}
            <Box px={8}>
                <Box bg="white" borderRadius="xl" border="1px" borderColor="gray.200" overflow="hidden" shadow="sm">
                    {isLoading ? (
                        <Flex justify="center" py={20}><Spinner color="brand.500" /></Flex>
                    ) : (
                        <Box overflowY="auto" maxH="calc(100vh - 300px)">
                            <Table variant="simple" style={{ tableLayout: "fixed" }}>
                                <Thead bg="gray.50" position="sticky" top={0} zIndex={1}>
                                    <Tr h="55px">
                                        <Th color="gray.500" fontSize="xs" fontWeight="800" textAlign="center" w="12.5%" borderBottom="1px" borderColor="gray.100">생성 일자</Th>
                                        <Th color="gray.500" fontSize="xs" fontWeight="800" w="12.5%" borderBottom="1px" borderColor="gray.100">이름</Th>
                                        <Th color="gray.500" fontSize="xs" fontWeight="800" w="17.5%" borderBottom="1px" borderColor="gray.100">이메일</Th>
                                        <Th color="gray.500" fontSize="xs" fontWeight="800" w="12.5%" borderBottom="1px" borderColor="gray.100">권한</Th>
                                        <Th color="gray.500" fontSize="xs" fontWeight="800" textAlign="center" w="12.5%" borderBottom="1px" borderColor="gray.100">알람톡 수신</Th>
                                        <Th color="gray.500" fontSize="xs" fontWeight="800" textAlign="center" w="12.5%" borderBottom="1px" borderColor="gray.100">고객 검색</Th>
                                        <Th color="gray.500" fontSize="xs" fontWeight="800" textAlign="center" w="12.5%" borderBottom="1px" borderColor="gray.100">퇴사 처리</Th>
                                        <Th color="gray.500" fontSize="xs" fontWeight="800" textAlign="center" w="7.5%" borderBottom="1px" borderColor="gray.100">상세</Th>
                                    </Tr>
                                </Thead>
                                <Tbody>
                                    {filteredUsers.map((user) => {
                                        const isBanned = user.status === 'banned';
                                        const formattedDate = isTimestamp(user.createdAt)
                                            ? user.createdAt.toDate().toISOString().split('T')[0]
                                            : (typeof user.createdAt === 'string' ? user.createdAt.split(' ')[0] : '-');

                                        return (
                                            <Tr key={user.uid} h="45px" opacity={isBanned ? 0.6 : 1} _hover={{ bg: "gray.50" }} transition="all 0.2s">
                                                <Td textAlign="center" fontSize="sm" color="gray.600" py={2} borderBottom="1px" borderColor="gray.50">
                                                    {formattedDate}
                                                </Td>
                                                <Td py={2} borderBottom="1px" borderColor="gray.50">
                                                    <HStack spacing={3}>
                                                        <SurnameBadge
                                                            name={user.name}
                                                            badgeChar={user.badgeChar}
                                                            color={isBanned ? "gray.400" : user.representativeColor || "brand.500"}
                                                        />
                                                        <Text fontSize="sm" fontWeight="bold" color={isBanned ? "gray.500" : "gray.800"}>
                                                            <HighlightedText text={user.name} query={search} /> {isBanned && <Text as="span" fontSize="xs" fontWeight="normal">(퇴)</Text>}
                                                        </Text>
                                                    </HStack>
                                                </Td>
                                                <Td fontSize="sm" color="gray.600" py={2} borderBottom="1px" borderColor="gray.50">
                                                    <HighlightedText text={user.email} query={search} />
                                                </Td>
                                                <Td py={2} borderBottom="1px" borderColor="gray.50">
                                                    <Badge
                                                        colorScheme={user.role === 'master' ? 'purple' : user.role === 'admin' ? 'blue' : user.role === 'partner' ? 'yellow' : 'gray'}
                                                        px={2}
                                                        variant="subtle"
                                                        borderRadius="full"
                                                    >
                                                        {ROLE_LABELS[user.role]}
                                                    </Badge>
                                                </Td>
                                                <Td textAlign="center" py={2} borderBottom="1px" borderColor="gray.50">
                                                    <Switch
                                                        size="sm"
                                                        colorScheme="brand"
                                                        isChecked={user.kakaoWorkEnabled}
                                                        pointerEvents="none"
                                                    />
                                                </Td>
                                                <Td textAlign="center" py={2} borderBottom="1px" borderColor="gray.50">
                                                    <Switch
                                                        size="sm"
                                                        colorScheme="brand"
                                                        isChecked={user.canAccessCustomerData}
                                                        pointerEvents="none"
                                                    />
                                                </Td>
                                                <Td textAlign="center" py={2} borderBottom="1px" borderColor="gray.50">
                                                    <Switch
                                                        size="sm"
                                                        colorScheme="brand"
                                                        isChecked={isBanned}
                                                        pointerEvents="none"
                                                    />
                                                </Td>
                                                <Td textAlign="center" py={2} borderBottom="1px" borderColor="gray.50">
                                                    <Flex justify="center" align="center">
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
                                                            onClick={() => handleEdit(user)}
                                                        >
                                                            상세보기
                                                        </Badge>
                                                    </Flex>
                                                </Td>
                                            </Tr>
                                        );
                                    })}
                                </Tbody>
                            </Table>
                        </Box>
                    )}
                </Box>
            </Box>

            <UserCreateModal
                isOpen={createDisclosure.isOpen}
                onClose={createDisclosure.onClose}
                existingUsers={users}
            />
            {selectedUser && (
                <UserEditModal
                    isOpen={editDisclosure.isOpen}
                    onClose={editDisclosure.onClose}
                    user={selectedUser}
                    existingUsers={users}
                />
            )}
        </Box>
    );
}
