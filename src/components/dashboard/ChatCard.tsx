// src/components/dashboard/ChatCard.tsx
"use client";
import React, { useState, useRef, useEffect } from "react";
import {
    Box, Flex, Input, VStack, Text, HStack, Spinner, Divider
} from "@chakra-ui/react";
import { useChat, ChatMessage } from "@/hooks/useChat";
import { SurnameBadge, TeasyButton } from "@/components/common/UIComponents";
import { TeasyCardHeader } from "@/components/common/UIComponents";

const AVATAR_COLORS = ["#805AD5", "#3182CE", "#38A169", "#D69E2E", "#DD6B20", "#E53E3E", "#D53F8C", "#4FD1C5"];

const getAvatarMetadata = (senderId: string, senderName: string, userMetadata?: Record<string, any>) => {
    if (userMetadata?.[senderId]) {
        return {
            color: userMetadata[senderId].color || "#805AD5",
            badgeChar: userMetadata[senderId].badgeChar || senderName?.[0] || "?"
        };
    }
    const charCode = (senderName || " ").charCodeAt(0);
    return {
        color: AVATAR_COLORS[charCode % AVATAR_COLORS.length],
        badgeChar: senderName?.[0] || "?"
    };
};

const formatCommentTime = (date: Date | null): string => {
    if (!date) return "방금";
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const getSafeDateString = (date: Date | null): string => {
    const d = date || new Date();
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
};

interface ChatCardProps {
    userMetadata?: Record<string, any>;
}

export const ChatCard = ({ userMetadata }: ChatCardProps) => {
    const { messages, isLoading, sendMessage, currentUserId } = useChat();
    const [inputValue, setInputValue] = useState("");
    const [isSending, setIsSending] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom on new messages (smooth)
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
        }
    }, [messages]);

    const handleSend = async () => {
        if (!inputValue.trim() || isSending) return;
        const text = inputValue;
        setInputValue("");
        setIsSending(true);
        try {
            await sendMessage(text);
        } catch {
            // Error already logged in hook
        } finally {
            setIsSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey && !(e.nativeEvent as any).isComposing) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <Box
            bg="white"
            borderRadius="xl"
            shadow="md"
            border="1px"
            borderColor="gray.200"
            h="full"
            display="flex"
            flexDirection="column"
            overflow="hidden"
        >
            <TeasyCardHeader title="업무 채팅" count={0} />

            {/* Messages Area */}
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
                    px={4}
                    py={4}
                    ref={scrollRef}
                    css={{
                        "&::-webkit-scrollbar": { width: "4px" },
                        "&::-webkit-scrollbar-thumb": {
                            background: "#CBD5E0",
                            borderRadius: "4px",
                        },
                    }}
                >
                    {isLoading ? (
                        <Flex h="full" align="center" justify="center">
                            <Spinner size="sm" color="brand.500" />
                        </Flex>
                    ) : messages.length === 0 ? (
                        <Flex h="full" align="center" justify="center">
                            <Text fontSize="xs" color="gray.400" fontWeight="medium">
                                첫 메시지를 보내보세요!
                            </Text>
                        </Flex>
                    ) : (
                        <Flex direction="column" minH="full" justifyContent="flex-end">
                            <VStack spacing={0} w="full" align="stretch">
                                {messages.map((msg, index) => {
                                    const isMe = msg.senderId === currentUserId;
                                    const { color: badgeColor, badgeChar } = getAvatarMetadata(msg.senderId, msg.senderName, userMetadata);
                                    const currentDate = getSafeDateString(msg.createdAt);
                                    const prevMsg = index > 0 ? messages[index - 1] : undefined;
                                    const prevDate = prevMsg ? getSafeDateString(prevMsg.createdAt) : "";
                                    const showDateDivider = currentDate !== prevDate;

                                    return (
                                        <React.Fragment key={msg.id}>
                                            {showDateDivider && (
                                                <Flex align="center" my={6} w="full">
                                                    <Divider borderColor="gray.200" />
                                                    <Text px={3} whiteSpace="nowrap" color="gray.400" fontSize="10px" fontWeight="bold">
                                                        {currentDate}
                                                    </Text>
                                                    <Divider borderColor="gray.200" />
                                                </Flex>
                                            )}
                                            <VStack align="stretch" spacing={1} mb={4} w="full">
                                                <Flex justify={isMe ? "flex-end" : "flex-start"} align="flex-start">
                                                    <HStack spacing={1} align="flex-start">
                                                        {/* Time for me (left side) */}
                                                        {isMe && (
                                                            <Text fontSize="9px" color="gray.400" whiteSpace="nowrap" fontWeight="medium" mt="auto" mb={1}>
                                                                {formatCommentTime(msg.createdAt)}
                                                            </Text>
                                                        )}

                                                        {/* Badge for others (left side) */}
                                                        {!isMe && (
                                                            <SurnameBadge
                                                                name={msg.senderName}
                                                                badgeChar={badgeChar}
                                                                color={badgeColor}
                                                                mt={0}
                                                            />
                                                        )}

                                                        {/* Message Bubble */}
                                                        <Box
                                                            bg={`${badgeColor}15`}
                                                            backdropFilter="blur(15px)"
                                                            px={3}
                                                            py={1.5}
                                                            maxW="85%"
                                                            borderRadius={isMe ? "16px 4px 16px 16px" : "4px 16px 16px 16px"}
                                                            shadow="xs"
                                                            border="1px solid"
                                                            borderColor={`${badgeColor}30`}
                                                        >
                                                            {/* Sender name for others */}
                                                            {!isMe && (
                                                                <Text fontSize="10px" color="gray.500" fontWeight="600" mb={0.5}>
                                                                    {userMetadata?.[msg.senderId]?.name || msg.senderName}
                                                                </Text>
                                                            )}
                                                            <Text fontSize="13px" lineHeight="1.5" fontWeight="normal" color="gray.800" whiteSpace="pre-wrap" wordBreak="break-word">
                                                                {msg.text}
                                                            </Text>
                                                        </Box>

                                                        {/* Badge for me (right side) */}
                                                        {isMe && (
                                                            <SurnameBadge
                                                                name={msg.senderName}
                                                                badgeChar={badgeChar}
                                                                color={badgeColor}
                                                                mt={0}
                                                            />
                                                        )}

                                                        {/* Time for others (right side) */}
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
                        </Flex>
                    )}
                </Box>

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

            {/* Input Area — Matching AdminCommentRoom style */}
            <Box p={3} borderTop="1px" borderColor="gray.50" w="full" bg="white">
                <HStack spacing={2}>
                    <Input
                        placeholder="메세지를 입력하세요."
                        size="md"
                        h="42px"
                        borderRadius="xl"
                        bg="gray.50"
                        border="none"
                        focusBorderColor="brand.500"
                        fontSize="sm"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        _placeholder={{ color: "gray.400" }}
                    />
                    <TeasyButton
                        h="42px"
                        px={5}
                        borderRadius="xl"
                        onClick={handleSend}
                        isLoading={isSending}
                        isDisabled={!inputValue.trim()}
                        fontSize="13px"
                        _hover={{ transform: "none", boxShadow: "none" }}
                        _active={{ transform: "none", boxShadow: "none" }}
                    >
                        전송
                    </TeasyButton>
                </HStack>
            </Box>
        </Box>
    );
};
