import { Box, VStack, Text, Divider, Flex, Input, HStack } from "@chakra-ui/react";
import { useState, useEffect, useRef } from "react";
import { TeasyButton } from "@/components/common/UIComponents";

export const ChatRoom = ({ messages, lastReadTimestamp }: any) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    //Kakao-style "Read up to here" divider logic (v122.0)
    const firstUnreadIndex = messages?.findIndex((m: any) => m.timestamp > lastReadTimestamp) ?? -1;

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    return (
        <VStack h="full" spacing={0}>
            <Box flex={1} w="full" overflowY="auto" p={4} ref={scrollRef}>
                {messages?.map((msg: any, index: number) => {
                    const isMe = msg.senderId === "me";
                    return (
                        <VStack key={msg.id} align="stretch" spacing={2} mb={4}>
                            {index === firstUnreadIndex && firstUnreadIndex !== -1 && (
                                <Flex align="center" py={4}>
                                    <Divider borderColor="gray.100" />
                                    <Text fontSize="10px" color="gray.400" whiteSpace="nowrap" px={3} letterSpacing="0.5px">여기까지 읽었습니다</Text>
                                    <Divider borderColor="gray.100" />
                                </Flex>
                            )}
                            <Flex justify={isMe ? "flex-end" : "flex-start"} align="flex-start">
                                <VStack align={isMe ? "flex-end" : "flex-start"} spacing={1} maxW="70%">
                                    <Box
                                        bg={isMe ? "brand.500" : "gray.100"}
                                        color={isMe ? "white" : "gray.800"}
                                        px={4}
                                        py={2}
                                        borderRadius={isMe ? "18px 2px 18px 18px" : "2px 18px 18px 18px"}
                                        shadow="sm"
                                    >
                                        <Text fontSize="sm" lineHeight="1.5" letterSpacing="0.5px">{msg.content}</Text>
                                    </Box>
                                    <Text fontSize="10px" color="gray.400">{msg.time || "오전 10:00"}</Text>
                                </VStack>
                            </Flex>
                        </VStack>
                    );
                })}
            </Box>
            <Box p={4} borderTop="1px" borderColor="gray.50" w="full" bg="white">
                <HStack spacing={2}>
                    <Input
                        placeholder="입력"
                        size="sm"
                        h="36px"
                        borderRadius="10px"
                        bg="gray.50"
                        border="none"
                        focusBorderColor="brand.500"
                        fontSize="sm"
                        _placeholder={{ color: "gray.400" }}
                    />
                    <TeasyButton h="36px" px={5}>전송</TeasyButton>
                </HStack>
            </Box>
        </VStack>
    );
};
