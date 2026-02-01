import React from 'react';
import { Box, VStack, Text, Divider, Flex, Icon, Link as ChakraLink, useToast, useDisclosure, Tooltip, HStack } from "@chakra-ui/react";
import { MdDashboard, MdPeople, MdAssignment, MdSettings, MdLogout } from "react-icons/md";
import NextLink from 'next/link';
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { SurnameBadge } from "@/components/common/UIComponents";
import { UserEditModal } from "@/components/features/admin/UserEditModal";

const NavItem = React.memo(({ icon, children, href }: any) => (
    <ChakraLink as={NextLink} href={href} w="full" _hover={{ textDecoration: "none" }}>
        <Flex align="center" p={3} borderRadius="md" _hover={{ bg: "whiteAlpha.200" }} _active={{ transform: "scale(0.95)" }} transition="transform 0.1s" cursor="pointer">
            <Icon as={icon} mr={3} fontSize="xl" />
            <Text fontWeight="medium">{children}</Text>
        </Flex>
    </ChakraLink>
));
NavItem.displayName = 'NavItem';

export const Sidebar = React.memo(() => {
    const router = useRouter();
    const toast = useToast();
    const { user, userData } = useAuth();
    const isAdmin = userData?.role === 'master' || userData?.role === 'admin';
    const canAccessCustomers = userData?.role === 'master' || userData?.canAccessCustomerData === true;
    const { isOpen, onOpen, onClose } = useDisclosure();

    const handleLogout = async () => {
        try {
            await auth.signOut();
            toast({
                title: "로그아웃 성공",
                status: "success",
                duration: 2000,
            });
            router.push("/login");
        } catch (error) {
            console.error("Logout Error:", error);
        }
    };

    return (
        <Box w="221px" h="100vh" bg="brand.500" color="white" p={5} position="fixed" left={0} top={0}>
            <VStack align="start" spacing={2} h="full">
                <Text fontSize="28px" fontWeight="bold" lineHeight="1.2" px={2} m={0} pb={8}>TEASY CRM</Text>

                <NavItem icon={MdDashboard} href="/">대시보드</NavItem>

                {canAccessCustomers && (
                    <NavItem icon={MdPeople} href="/customers">고객 관리</NavItem>
                )}

                <NavItem icon={MdAssignment} href="/work-requests">업무 요청</NavItem>

                {isAdmin && (
                    <Box w="full" pt={6}>
                        <Box px={3} mb={4}>
                            <Divider borderColor="whiteAlpha.300" />
                        </Box>
                        <Text fontSize="11px" fontWeight="700" color="whiteAlpha.600" mb={2} px={3}>ADMIN</Text>
                        <NavItem icon={MdSettings} href="/admin">관리자 페이지</NavItem>
                    </Box>
                )}

                <Flex
                    mt="auto"
                    w="full"
                    align="center"
                    justify="center"
                    py={6}
                    gap={4}
                    borderTop="1px solid"
                    borderColor="whiteAlpha.100"
                >
                    {userData && (
                        <Tooltip
                            label="내 정보 관리"
                            placement="top"
                            fontSize="xs"
                            bg="rgba(255, 255, 255, 0.1)"
                            color="white"
                            border="0.5px solid rgba(255, 255, 255, 0.5)"
                            borderRadius="20px"
                            px={3}
                            py={1}
                            backdropFilter="blur(4px)"
                            fontWeight="light"
                            hasArrow={false}
                        >
                            <Box
                                cursor="pointer"
                                onClick={onOpen}
                                transition="all 0.2s"
                                _hover={{ transform: "scale(1.1)" }}
                                _active={{ transform: "scale(0.95)" }}
                            >
                                <SurnameBadge
                                    name={userData.name}
                                    badgeChar={userData.badgeChar}
                                    color={userData.representativeColor || "brand.400"}
                                    w="32px"
                                    h="32px"
                                    fontSize="14px"
                                    border="2px solid"
                                    borderColor={userData.representativeColor || "rgba(255,255,255,0.3)"}
                                    shadow="0 0 10px rgba(0,0,0,0.15)"
                                />
                            </Box>
                        </Tooltip>
                    )}

                    <Box w="1.5px" h="16px" bg="whiteAlpha.300" borderRadius="full" />

                    <Tooltip
                        label="로그 아웃"
                        placement="top"
                        fontSize="xs"
                        bg="rgba(255, 255, 255, 0.1)"
                        color="white"
                        border="0.5px solid rgba(255, 255, 255, 0.5)"
                        borderRadius="20px"
                        px={3}
                        py={1}
                        backdropFilter="blur(4px)"
                        fontWeight="light"
                        hasArrow={false}
                    >
                        <Flex
                            w="32px"
                            h="32px"
                            borderRadius="full"
                            bg="whiteAlpha.100"
                            align="center"
                            justify="center"
                            cursor="pointer"
                            onClick={handleLogout}
                            transition="all 0.2s"
                            _hover={{ bg: "whiteAlpha.300", transform: "scale(1.1)" }}
                            _active={{ transform: "scale(0.95)" }}
                            color="white"
                            border="1px solid rgba(255,255,255,0.1)"
                        >
                            <Icon as={MdLogout} fontSize="18px" ml="2px" />
                        </Flex>
                    </Tooltip>
                </Flex>

                {userData && (
                    <UserEditModal
                        isOpen={isOpen}
                        onClose={onClose}
                        user={userData}
                        hideAdminFields={userData.role === 'employee' || userData.role === 'partner'}
                    />
                )}
            </VStack>
        </Box>
    );
});
Sidebar.displayName = 'Sidebar';
