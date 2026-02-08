// src/components/features/work-order/ChatRoom.tsx
"use client";
import React, { useRef, useState, useEffect } from "react";
import {
    VStack, Box, Text, Flex, HStack, Divider, Spinner, Input
} from "@chakra-ui/react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { WorkRequestMessage } from "@/types/work-order";
import { SurnameBadge, TeasyButton } from "@/components/common/UIComponents";
import { applyColonStandard } from "@/utils/textFormatter";

interface ChatRoomProps {
    messages?: WorkRequestMessage[];
    lastReadTimestamp?: any;
    currentUserId?: string;
    input?: string;
    onInputChange?: (val: string) => void;
    onSendMessage?: () => void;
}

/**
 * Constants & Utilities: Identical to AdminCommentRoom (v123.75)
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

export const ChatRoom = ({ messages, lastReadTimestamp, currentUserId, input, onInputChange, onSendMessage }: ChatRoomProps) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [userMetadata, setUserMetadata] = useState<Record<string, { color: string, badgeChar: string, name: string }>>({});
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
            const metadata: Record<string, { color: string, badgeChar: string, name: string }> = {};
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                metadata[doc.id] = {
                    name: data.name || "사용자",
                    color: data.representativeColor || "#805AD5",
                    badgeChar: data.badgeChar || data.name?.[0] || "?"
                };
            });
            setUserMetadata(metadata);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const firstUnreadIndex = messages?.findIndex((m) => m.timestamp > lastReadTimestamp) ?? -1;

    return (
        <VStack h="full" spacing={0} bg="white">
            {/* Body: Messages Area (Identical to AdminCommentRoom) */}
            <Box flex={1} w="full" position="relative" overflow="hidden" pl={6} pr={3} py={4} bg="gray.50/10">

                <Box
                    w="full"
                    h="full"
                    overflowY="auto"
                    ref={scrollRef}
                    className="hide-scrollbar"
                    pr={2}
                >
                    {isLoading ? (
                        <Flex h="full" align="center" justify="center">
                            <Spinner color="brand.500" />
                        </Flex>
                    ) : !messages || messages.length === 0 ? (
                        <Flex h="full" align="center" justify="center">
                            <Text fontSize="xs" color="gray.400">등록된 메세지가 없습니다.</Text>
                        </Flex>
                    ) : (
                        <Flex direction="column" minH="full">
                            <Box flex={1} />
                            <VStack spacing={0} w="full" align="stretch">
                                {messages.map((msg, index) => {
                                    const isMe = msg.senderId === currentUserId;
                                    const { color: badgeColor, badgeChar } = getAvatarMetadata(msg.senderId, userMetadata[msg.senderId]?.name || "사용자", userMetadata);

                                    const currentDate = getSafeDateString(msg.timestamp);
                                    const prevMsg = index > 0 ? messages[index - 1] : null;
                                    const prevDate = prevMsg ? getSafeDateString(prevMsg.timestamp) : "";
                                    const showDateDivider = currentDate !== prevDate;
                                    const isFirstUnread = index === firstUnreadIndex && lastReadTimestamp;

                                    return (
                                        <React.Fragment key={msg.id || index}>
                                            {showDateDivider && (
                                                <Flex align="center" my={8} w="full">
                                                    <Divider borderColor="gray.200" />
                                                    <Text px={4} whiteSpace="nowrap" color="gray.400" fontSize="xs" fontWeight="bold">
                                                        {currentDate}
                                                    </Text>
                                                    <Divider borderColor="gray.200" />
                                                </Flex>
                                            )}

                                            {isFirstUnread && (
                                                <Flex align="center" my={4}>
                                                    <Divider borderColor="brand.200" />
                                                    <Text px={4} whiteSpace="nowrap" color="brand.400" fontSize="10px" fontWeight="bold">
                                                        여기까지 읽었습니다
                                                    </Text>
                                                    <Divider borderColor="brand.200" />
                                                </Flex>
                                            )}

                                            <VStack align="stretch" spacing={1} mb={6} w="full">
                                                <Flex justify={isMe ? "flex-end" : "flex-start"} align="flex-start">
                                                    <HStack spacing={1} align="flex-start">
                                                        {isMe && (
                                                            <Text fontSize="9px" color="gray.400" whiteSpace="nowrap" fontWeight="medium" mt="auto" mb={1}>
                                                                {formatCommentTime(msg.timestamp)}
                                                            </Text>
                                                        )}

                                                        {!isMe && (
                                                            <SurnameBadge
                                                                name={userMetadata[msg.senderId]?.name}
                                                                badgeChar={badgeChar}
                                                                color={badgeColor}
                                                                mt={0}
                                                            />
                                                        )}

                                                        <Box
                                                            bg={`${badgeColor}15`}
                                                            backdropFilter="blur(15px)"
                                                            px={4}
                                                            py={1.5}
                                                            maxW="300px"
                                                            borderRadius={isMe ? "20px 4px 20px 20px" : "4px 20px 20px 20px"}
                                                            shadow="xs"
                                                            border="1px solid"
                                                            borderColor={`${badgeColor}30`}
                                                        >
                                                            <Text fontSize="14px" lineHeight="1.6" fontWeight="normal" color="gray.800" whiteSpace="pre-wrap">
                                                                {applyColonStandard(msg.content)}
                                                            </Text>
                                                        </Box>

                                                        {isMe && (
                                                            <SurnameBadge
                                                                name={userMetadata[msg.senderId]?.name}
                                                                badgeChar={badgeChar}
                                                                color={badgeColor}
                                                                mt={0}
                                                            />
                                                        )}

                                                        {!isMe && (
                                                            <Text fontSize="9px" color="gray.400" whiteSpace="nowrap" fontWeight="medium" mt="auto" mb={1}>
                                                                {formatCommentTime(msg.timestamp)}
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

            </Box>

        </VStack>
    );
};
