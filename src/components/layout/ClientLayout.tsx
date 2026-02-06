// src/components/layout/ClientLayout.tsx
'use client'

import { Box, Spinner, Center } from "@chakra-ui/react";
import { Sidebar } from "./Sidebar";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useEffect } from "react";

export const ClientLayout = ({ children }: { children: React.ReactNode }) => {
    const pathname = usePathname();
    const router = useRouter();
    const { user, loading } = useAuth();
    const isLoginPage = pathname === "/login";

    useEffect(() => {
        if (!loading && !user && !isLoginPage) {
            router.push("/login");
        }
    }, [user, loading, isLoginPage, router]);

    if (isLoginPage) {
        return <>{children}</>;
    }

    if (loading) {
        return (
            <Center h="100vh">
                <Spinner size="xl" color="brand.500" thickness="4px" />
            </Center>
        );
    }

    // Protection Check: Don't render protected content if user is missing (handled by effect, but as safety)
    if (!user) return null;

    return (
        <>
            <Sidebar />
            <Box
                className="teasy-main-container"
                ml="221px"
                bg="gray.50"
                h="100vh"
                overflowY="auto"
                p={5}
            >
                {children}
            </Box>
        </>
    );
};
