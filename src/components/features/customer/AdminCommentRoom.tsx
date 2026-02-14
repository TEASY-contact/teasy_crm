// src/components/features/customer/AdminCommentRoom.tsx
"use client";
import { Box, VStack, Text, Divider, Flex, Input, HStack, Heading, Spinner, Badge } from "@chakra-ui/react";
import { MdChevronRight } from "react-icons/md";
import React, { useState, useEffect, useRef } from "react";
import { TeasyButton, SurnameBadge } from "@/components/common/UIComponents";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { applyColonStandard } from "@/utils/textFormatter";

/**
 * Constants & Utilities: Standardized for Admin Comment Room (v123.75)
 */
const AVATAR_COLORS = ["#805AD5", "#3182CE", "#38A169", "#D69E2E", "#DD6B20", "#E53E3E", "#D53F8C", "#4FD1C5"];

const formatCommentTime = (timestamp: any) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const getSafeDateString = (ts: any) => {
    const date = !ts ? new Date() : (ts.toDate ? ts.toDate() : new Date(ts));
    return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
};

const getAvatarMetadata = (id: string, name: string, userMetadata: any) => {
    if (userMetadata[id]) return userMetadata[id];
    const charCode = (name || " ").charCodeAt(0);
    return {
        color: AVATAR_COLORS[charCode % AVATAR_COLORS.length],
        badgeChar: name?.[0] || "?"
    };
};

export const AdminCommentRoom = ({ customerId }: { customerId: string }) => {
    const { userData, user } = useAuth();
    const [userMetadata, setUserMetadata] = useState<Record<string, { color: string, badgeChar: string }>>({});
    const [messages, setMessages] = useState<any[]>([]);
    const [inputValue, setInputValue] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
            const metadata: Record<string, { color: string, badgeChar: string }> = {};
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                metadata[doc.id] = {
                    color: data.representativeColor || "#805AD5",
                    badgeChar: data.badgeChar || data.name?.[0] || "?"
                };
            });
            setUserMetadata(metadata);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!customerId) return;
        // ... (existing query logic) ...
        const q = query(
            collection(db, "customer_comments"),
            where("customerId", "==", customerId)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetched = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as any));

            fetched.sort((a: any, b: any) => {
                const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt || Date.now());
                const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt || Date.now());
                return timeA - timeB;
            });

            setMessages(fetched);
            setIsLoading(false);
        }, (error) => {
            console.error("Comments fetch error:", error);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [customerId]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
        }
    }, [messages]);

    const handleSendMessage = async () => {
        if (!inputValue.trim()) return;

        const text = inputValue;
        setInputValue("");

        try {
            const myId = userData?.uid || user?.uid || "";
            const myName = userData?.name || "사용자";

            await addDoc(collection(db, "customer_comments"), {
                customerId,
                content: text,
                senderId: myId,
                senderName: myName,
                createdAt: serverTimestamp(),
            });
            // 채팅 메시지 전송 시 lastConsultDate 갱신 → 최근 1주일 목록 포함
            try {
                const today = new Date().toISOString().split('T')[0];
                await updateDoc(doc(db, "customers", customerId), { lastConsultDate: today });
            } catch (updateErr) {
                console.warn("lastConsultDate 갱신 실패 (메시지는 정상 전송됨):", updateErr);
            }
        } catch (error) {
            console.error("Message send error:", error);
        }
    };

    return (
        <VStack
            bg="white"
            borderRadius="2xl"
            border="1px"
            borderColor="gray.100"
            shadow="sm"
            flex={1}
            h="full"
            spacing={0}
            overflow="hidden"
        >
            <Box flex={1} w="full" position="relative" overflow="hidden">
                {/* Top Fade Gradient */}
                <Box
                    position="absolute"
                    top={0}
                    left={0}
                    right={0}
                    h="40px"
                    bgGradient="linear(to-b, white, transparent)"
                    zIndex={2}
                    pointerEvents="none"
                />

                <Box
                    w="full"
                    h="full"
                    overflowY="auto"
                    px={6}
                    py={4}
                    ref={scrollRef}
                    bg="gray.50/10"

                >
                    {isLoading ? (
                        <Flex h="full" align="center" justify="center">
                            <Spinner color="brand.500" />
                        </Flex>
                    ) : messages.length === 0 ? (
                        <Flex h="full" align="center" justify="center">
                            <Text fontSize="xs" color="gray.400">등록된 메세지가 없습니다.</Text>
                        </Flex>
                    ) : (
                        <VStack spacing={0} w="full" align="stretch">
                            {messages.map((msg, index) => {
                                const currentUid = userData?.uid || user?.uid || "";
                                const isMe = msg.senderId === currentUid;
                                const { color: badgeColor, badgeChar } = getAvatarMetadata(msg.senderId, msg.senderName, userMetadata);
                                const currentDate = getSafeDateString(msg.createdAt);
                                const prevMsg = index > 0 ? messages[index - 1] : null;
                                const prevDate = prevMsg ? getSafeDateString(prevMsg.createdAt) : "";
                                const showDateDivider = currentDate !== prevDate;

                                return (
                                    <React.Fragment key={msg.id}>
                                        {showDateDivider && (
                                            <Flex align="center" my={8} w="full">
                                                <Divider borderColor="gray.200" />
                                                <Text px={4} whiteSpace="nowrap" color="gray.400" fontSize="xs" fontWeight="bold">
                                                    {currentDate}
                                                </Text>
                                                <Divider borderColor="gray.200" />
                                            </Flex>
                                        )}
                                        <VStack align="stretch" spacing={1} mb={6} w="full">
                                            <Flex justify={isMe ? "flex-end" : "flex-start"} align="flex-start">
                                                <HStack spacing={1} align="flex-start">
                                                    {/* Time for isMe (Bottom side) */}
                                                    {isMe && (
                                                        <Text fontSize="9px" color="gray.400" whiteSpace="nowrap" fontWeight="medium" mt="auto" mb={1}>
                                                            {formatCommentTime(msg.createdAt)}
                                                        </Text>
                                                    )}

                                                    {/* Surname Badge for Others (Left side) */}
                                                    {!isMe && (
                                                        <SurnameBadge
                                                            name={msg.senderName}
                                                            badgeChar={badgeChar}
                                                            color={badgeColor}
                                                            mt={0}
                                                        />
                                                    )}

                                                    {/* Message Bubble (Dynamic Color Series v123.50) */}
                                                    <Box
                                                        bg={`${badgeColor}15`} // 15% opacity hex
                                                        backdropFilter="blur(15px)"
                                                        px={4}
                                                        py={1.5}
                                                        maxW="300px"
                                                        borderRadius={isMe ? "20px 4px 20px 20px" : "4px 20px 20px 20px"}
                                                        shadow="xs"
                                                        border="1px solid"
                                                        borderColor={`${badgeColor}30`} // 30% opacity hex for border
                                                    >
                                                        <Text fontSize="14px" lineHeight="1.6" fontWeight="normal" color="gray.800" whiteSpace="pre-wrap">
                                                            {applyColonStandard(msg.content)}
                                                        </Text>
                                                    </Box>

                                                    {/* Surname Badge for Me (Right side) */}
                                                    {isMe && (
                                                        <SurnameBadge
                                                            name={msg.senderName}
                                                            badgeChar={badgeChar}
                                                            color={badgeColor}
                                                            mt={0}
                                                        />
                                                    )}

                                                    {/* Time for Others (Bottom side) */}
                                                    {!isMe && (
                                                        <Text fontSize="9px" color="gray.400" whiteSpace="nowrap" fontWeight="medium" mt="auto" mb={1}>
                                                            {formatCommentTime(msg.createdAt)}
                                                        </Text>
                                                    )}
                                                </HStack>
                                            </Flex>
                                        </VStack>
                                    </React.Fragment>
                                );
                            })}
                        </VStack>
                    )}
                </Box>
                {/* ... (Bottom input area remains same) ... */}

                {/* Bottom Fade Gradient */}
                <Box
                    position="absolute"
                    bottom={0}
                    left={0}
                    right={0}
                    h="40px"
                    bgGradient="linear(to-t, white, transparent)"
                    zIndex={2}
                    pointerEvents="none"
                />
            </Box>

            <Box p={4} borderTop="1px" borderColor="gray.50" w="full" bg="white">
                <HStack spacing={2}>
                    <Input
                        placeholder="메세지를 입력하세요."
                        size="md"
                        h="48px"
                        borderRadius="xl"
                        bg="gray.50"
                        border="none"
                        focusBorderColor="brand.500"
                        fontSize="sm"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                                handleSendMessage();
                            }
                        }}
                        _placeholder={{ color: "gray.400" }}
                    />
                    <TeasyButton
                        h="48px"
                        px={6}
                        borderRadius="xl"
                        onClick={handleSendMessage}
                        isDisabled={!inputValue.trim()}
                        _hover={{ transform: "none", boxShadow: "none" }}
                        _active={{ transform: "none", boxShadow: "none" }}
                    >
                        전송
                    </TeasyButton>
                </HStack>
            </Box>
        </VStack >
    );
};
