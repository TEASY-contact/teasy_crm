// src/app/(auth)/login/page.tsx
"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Box, Button, FormControl, FormLabel, Input, VStack, Heading, Text, useToast, Container } from "@chakra-ui/react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const toast = useToast();
    const router = useRouter();
    const { user } = useAuth(); // Check auth status

    // Auto-redirect if already logged in
    useEffect(() => {
        if (user) router.push("/");
    }, [user, router]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
            // Flag this session as a conscious manual login (v122.6)
            sessionStorage.setItem("teasy_is_conscious_login", "true");
            router.push("/");
        } catch (error: any) {
            console.error("Login Error:", error);
            toast({
                title: "로그인 실패",
                description: "이메일 또는 비밀번호를 확인해 주세요.",
                status: "error",
                duration: 5000,
                isClosable: true,
                position: "top"
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Container maxW="lg" centerContent h="100vh" justifyContent="center">
            <Box w="full" p={8} borderRadius="xl" bg="white" shadow="xl" border="1px" borderColor="gray.100">
                <VStack spacing={6}>
                    <Heading color="brand.500">TEASY CRM</Heading>


                    <form style={{ width: "100%" }} onSubmit={handleLogin}>
                        <VStack spacing={4}>
                            <FormControl isRequired>
                                <FormLabel fontSize="sm" color="gray.600">이메일</FormLabel>
                                <Input
                                    type="email"
                                    placeholder="이메일 입력"
                                    _placeholder={{ color: "gray.400", fontSize: "sm" }}
                                    focusBorderColor="brand.500"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </FormControl>
                            <FormControl isRequired>
                                <FormLabel fontSize="sm" color="gray.600">비밀번호</FormLabel>
                                <Input
                                    type="password"
                                    placeholder="비밀번호 입력"
                                    _placeholder={{ color: "gray.400", fontSize: "sm" }}
                                    focusBorderColor="brand.500"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </FormControl>
                            <Button
                                type="submit"
                                colorScheme="purple"
                                w="full"
                                size="lg"
                                isLoading={isLoading}
                                shadow="md"
                                _active={{ transform: "scale(0.95)" }}
                            >
                                로그인
                            </Button>
                        </VStack>
                    </form>
                </VStack>
            </Box>
        </Container>
    );
}
