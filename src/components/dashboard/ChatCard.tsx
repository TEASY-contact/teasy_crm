// src/components/dashboard/ChatCard.tsx
"use client";
import React, { useState, useRef, useEffect } from "react";
import {
    Box, Flex, Input, VStack, Text, HStack, Spinner, Center
} from "@chakra-ui/react";
import { MdSend } from "react-icons/md";
import { useChat, ChatMessage } from "@/hooks/useChat";
import { SurnameBadge, TeasyButton } from "@/components/common/UIComponents";
import { TeasyCardHeader } from "@/components/common/UIComponents";

const formatChatTime = (date: Date | null): string => {
    if (!date) return "";
    const h = date.getHours();
    const m = String(date.getMinutes()).padStart(2, "0");
    const period = h < 12 ? "오전" : "오후";
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${period} ${hour12}:${m}`;
};

const formatChatDate = (date: Date | null): string => {
    if (!date) return "";
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const days = ["일", "월", "화", "수", "목", "금", "토"];
    const dayName = days[date.getDay()];
    return `${m}월 ${d}일 (${dayName})`;
};

const shouldShowDateDivider = (current: ChatMessage, prev?: ChatMessage): boolean => {
    if (!prev || !current.createdAt) return true;
    if (!prev.createdAt) return true;
    return current.createdAt.toDateString() !== prev.createdAt.toDateString();
};

interface ChatBubbleProps {
    message: ChatMessage;
    isOwn: boolean;
    showAvatar: boolean;
    userMetadata?: Record<string, any>;
}

const ChatBubble = ({ message, isOwn, showAvatar, userMetadata }: ChatBubbleProps) => {
    const meta = userMetadata?.[message.senderId];

    return (
        <Flex
            direction={isOwn ? "row-reverse" : "row"}
            align="flex-end"
            gap={1.5}
            w="full"
        >
            {/* Avatar */}
            <Box w="24px" flexShrink={0}>
                {showAvatar && !isOwn && (
                    <SurnameBadge
                        name={message.senderName}
                        badgeChar={meta?.badgeChar}
                        color={meta?.color}
                        w="24px"
                        h="24px"
                        fontSize="10px"
                    />
                )}
            </Box>

            {/* Bubble */}
            <VStack
                align={isOwn ? "flex-end" : "flex-start"}
                spacing={0.5}
                maxW="75%"
            >
                {showAvatar && !isOwn && (
                    <Text fontSize="10px" color="gray.500" fontWeight="600" ml={1}>
                        {message.senderName}
                    </Text>
                )}
                <Box
                    bg={isOwn ? "brand.500" : "gray.100"}
                    color={isOwn ? "white" : "gray.700"}
                    px={3}
                    py={1.5}
                    borderRadius="xl"
                    borderBottomRightRadius={isOwn ? "sm" : "xl"}
                    borderBottomLeftRadius={isOwn ? "xl" : "sm"}
                    fontSize="13px"
                    lineHeight="1.5"
                    wordBreak="break-word"
                >
                    {message.text}
                </Box>
                <Text fontSize="9px" color="gray.400" px={1}>
                    {formatChatTime(message.createdAt)}
                </Text>
            </VStack>
        </Flex>
    );
};

interface ChatCardProps {
    userMetadata?: Record<string, any>;
}

export const ChatCard = ({ userMetadata }: ChatCardProps) => {
    const { messages, isLoading, sendMessage, currentUserId } = useChat();
    const [inputValue, setInputValue] = useState("");
    const [isSending, setIsSending] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async () => {
        if (!inputValue.trim() || isSending) return;
        setIsSending(true);
        try {
            await sendMessage(inputValue);
            setInputValue("");
        } catch {
            // Error already logged in hook
        } finally {
            setIsSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
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
            <Box
                ref={scrollRef}
                flex={1}
                overflowY="auto"
                px={3}
                py={2}
                css={{
                    "&::-webkit-scrollbar": { width: "4px" },
                    "&::-webkit-scrollbar-thumb": {
                        background: "#CBD5E0",
                        borderRadius: "4px",
                    },
                }}
            >
                {isLoading ? (
                    <Center h="full">
                        <Spinner size="sm" color="brand.500" />
                    </Center>
                ) : messages.length === 0 ? (
                    <Center h="full">
                        <Text fontSize="sm" color="gray.400" fontWeight="medium">
                            첫 메시지를 보내보세요!
                        </Text>
                    </Center>
                ) : (
                    <VStack spacing={2} align="stretch">
                        {messages.map((msg, idx) => {
                            const prev = idx > 0 ? messages[idx - 1] : undefined;
                            const showDate = shouldShowDateDivider(msg, prev);
                            const showAvatar = !prev || prev.senderId !== msg.senderId || showDate;

                            return (
                                <React.Fragment key={msg.id}>
                                    {showDate && (
                                        <Center py={2}>
                                            <Text
                                                fontSize="10px"
                                                color="gray.400"
                                                bg="gray.50"
                                                px={3}
                                                py={0.5}
                                                borderRadius="full"
                                                fontWeight="medium"
                                            >
                                                {formatChatDate(msg.createdAt)}
                                            </Text>
                                        </Center>
                                    )}
                                    <ChatBubble
                                        message={msg}
                                        isOwn={msg.senderId === currentUserId}
                                        showAvatar={showAvatar}
                                        userMetadata={userMetadata}
                                    />
                                </React.Fragment>
                            );
                        })}
                    </VStack>
                )}
            </Box>

            {/* Input Area */}
            <Box
                px={3}
                py="10px"
                borderTop="1px"
                borderColor="gray.100"
                bg="gray.50"
            >
                <HStack spacing={2} mt="-1px">
                    <Input
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="메시지 입력..."
                        h="38px"
                        borderRadius="lg"
                        bg="white"
                        border="1px"
                        borderColor="gray.200"
                        focusBorderColor="brand.400"
                        _hover={{ borderColor: "gray.300" }}
                        fontSize="13px"
                    />
                    <TeasyButton
                        version="primary"
                        onClick={handleSend}
                        isLoading={isSending}
                        minW="38px"
                        h="38px"
                        p={0}
                        borderRadius="full"
                        isDisabled={!inputValue.trim()}
                    >
                        <MdSend size={14} />
                    </TeasyButton>
                </HStack>
            </Box>
        </Box>
    );
};
