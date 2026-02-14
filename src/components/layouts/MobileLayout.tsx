// src/components/layouts/MobileLayout.tsx
"use client";
import React from "react";
import { Box, Flex, Text, VStack, Icon } from "@chakra-ui/react";
import { usePathname, useRouter } from "next/navigation";
import { MdHome, MdPeople, MdChat, MdSettings } from "react-icons/md";

interface TabItem {
    label: string;
    icon: typeof MdHome;
    path: string;
}

const TABS: TabItem[] = [
    { label: "홈", icon: MdHome, path: "/" },
    { label: "고객", icon: MdPeople, path: "/customers" },
    { label: "채팅", icon: MdChat, path: "/work-orders" },
    { label: "설정", icon: MdSettings, path: "/settings" },
];

interface MobileLayoutProps {
    children: React.ReactNode;
}

export const MobileLayout = ({ children }: MobileLayoutProps) => {
    const pathname = usePathname();
    const router = useRouter();

    const isActive = (path: string) => {
        if (path === "/") return pathname === "/";
        return pathname.startsWith(path);
    };

    return (
        <Flex direction="column" h="100dvh" bg="gray.50">
            {/* Content Area */}
            <Box flex={1} overflow="auto" w="full">
                {children}
            </Box>

            {/* Bottom Tab Navigation */}
            <Flex
                as="nav"
                h="60px"
                bg="white"
                borderTop="1px"
                borderColor="gray.100"
                align="center"
                justify="space-around"
                px={2}
                flexShrink={0}
                // Safe area for notch devices
                pb="env(safe-area-inset-bottom)"
            >
                {TABS.map((tab) => {
                    const active = isActive(tab.path);
                    return (
                        <VStack
                            key={tab.path}
                            spacing={0.5}
                            cursor="pointer"
                            onClick={() => router.push(tab.path)}
                            color={active ? "brand.500" : "gray.400"}
                            transition="color 0.15s"
                            flex={1}
                            py={1}
                        >
                            <Icon as={tab.icon} boxSize="22px" />
                            <Text fontSize="10px" fontWeight={active ? "bold" : "medium"}>
                                {tab.label}
                            </Text>
                        </VStack>
                    );
                })}
            </Flex>
        </Flex>
    );
};
