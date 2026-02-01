// src/app/admin/page.tsx
"use client";
import { Box, SimpleGrid, Heading, Text, Icon, VStack, HStack } from "@chakra-ui/react";
import { MdPeople, MdSettings, MdHistory } from "react-icons/md";
import { useRouter } from "next/navigation";

interface AdminCardProps {
    title: string;
    description: string;
    icon: any;
    onClick: () => void;
}

const AdminCard = ({ title, description, icon, onClick }: AdminCardProps) => (
    <Box
        bg="white"
        p={8}
        borderRadius="xl"
        shadow="sm"
        border="1px"
        borderColor="gray.100"
        cursor="pointer"
        transition="all 0.2s"
        _hover={{ transform: "translateY(-4px)", shadow: "md", borderColor: "brand.500" }}
        onClick={onClick}
    >
        <HStack spacing={6} align="start">
            <Box p={3} bg="brand.50" borderRadius="lg">
                <Icon as={icon} fontSize="3xl" color="brand.500" />
            </Box>
            <VStack align="start" spacing={1}>
                <Text fontSize="lg" fontWeight="bold" color="gray.700">{title}</Text>
                <Text fontSize="sm" color="gray.500">{description}</Text>
            </VStack>
        </HStack>
    </Box>
);

export default function AdminPage() {
    const router = useRouter();

    return (
        <Box p={8} bg="gray.50" minH="100vh">
            <Heading size="lg" color="gray.700" mb={10}>관리자 페이지</Heading>

            <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={8}>
                <AdminCard
                    title="임직원 관리"
                    description="직원 계정 생성 및 관리"
                    icon={MdPeople}
                    onClick={() => router.push("/admin/users")}
                />
                <AdminCard
                    title="재고 · 상품 관리"
                    description="취급 품목 및 실시간 재고 관리"
                    icon={MdSettings}
                    onClick={() => router.push("/admin/assets")}
                />
                <AdminCard
                    title="시스템 로그"
                    description="활동 및 재고 변동 이력 통합 확인"
                    icon={MdHistory}
                    onClick={() => router.push("/admin/logs")}
                />
            </SimpleGrid>
        </Box>
    );
}
