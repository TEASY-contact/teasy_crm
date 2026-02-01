// src/components/features/work-order/WorkRequestModal.tsx
"use client";
import {
    Flex, Box, Grid, Text, Heading, IconButton, HStack, SimpleGrid, VStack
} from "@chakra-ui/react";
import { AddIcon } from "@chakra-ui/icons";
import { ChatRoom } from "./ChatRoom";
import { useWorkOrder } from "@/hooks/useWorkOrder";
import {
    TeasyModal, TeasyModalOverlay, TeasyModalContent, TeasyModalHeader,
    TeasyModalBody, TeasyModalFooter, TeasyButton
} from "@/components/common/UIComponents";

interface WorkRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: any;
    currentUser: any;
}

/**
 * Sub-component for Work Request details.
 * Unmounts when modal is closed, resetting all internal state (including ChatRoom).
 */
const WorkRequestModalContent = ({ onClose, data, currentUser }: { onClose: () => void, data: any, currentUser: any }) => {
    const { handleStatusChange, deleteRequest } = useWorkOrder();

    const isSender = currentUser?.uid === data.senderId;
    const isReceiver = currentUser?.uid === data.receiverId;

    return (
        <TeasyModalContent h="80vh" borderRadius="2xl">
            <TeasyModalHeader borderBottom="1px" borderColor="gray.100">업무 요청 상세</TeasyModalHeader>
            <TeasyModalBody p={0}>
                {/* Focus Guard */}
                <Box tabIndex={0} w={0} h={0} opacity={0} position="absolute" />
                <Grid templateColumns="1fr 1fr" h="full">
                    {/* Left: Info & Attachments */}
                    <Box p={6} borderRight="1px" borderColor="gray.100" overflowY="auto">
                        <VStack align="start" spacing={6}>
                            <Box>
                                <Text fontSize="xs" color="gray.500" mb={1}>제목</Text>
                                <Heading size="md">{data.title}</Heading>
                            </Box>
                            <Box>
                                <Text fontSize="xs" color="gray.500" mb={1}>내용</Text>
                                <Text fontSize="sm">{data.content}</Text>
                            </Box>
                            <Box w="full">
                                <Flex align="center" mb={2}>
                                    <Text fontSize="xs" color="gray.500" fontWeight="bold">참고자료</Text>
                                    <IconButton aria-label="Add" icon={<AddIcon />} size="xs" ml={2} colorScheme="purple" variant="ghost" />
                                </Flex>
                                <SimpleGrid columns={3} gap={2}>
                                    {data.attachments?.map((file: any) => (
                                        <Box key={file.url} bg="gray.50" p={2} borderRadius="md" fontSize="xs" isTruncated>{file.name}</Box>
                                    ))}
                                </SimpleGrid>
                            </Box>
                        </VStack>
                    </Box>

                    {/* Right: Chat Room */}
                    <ChatRoom messages={data.messages} lastReadTimestamp={data.lastReadTimestamp} />
                </Grid>
            </TeasyModalBody>

            <TeasyModalFooter borderTop="1px" borderColor="gray.100" justifyContent="space-between">
                <Box>
                    {isSender && data.status !== 'approved' && (
                        <TeasyButton version="ghost" color="red.500" fontSize="sm" onClick={() => deleteRequest(data.id)}>삭제</TeasyButton>
                    )}
                </Box>
                <HStack spacing={3}>
                    {/* Receiver Buttons */}
                    {isReceiver && data.status === 'pending' && (
                        <TeasyButton colorScheme="purple" size="sm" onClick={() => handleStatusChange(data.id, 'review_requested', data.senderId)}>검토 요청</TeasyButton>
                    )}
                    {isReceiver && data.status === 'review_requested' && (
                        <TeasyButton variant="outline" colorScheme="purple" size="sm" onClick={() => handleStatusChange(data.id, 'pending', data.senderId)}>검토요청 회수</TeasyButton>
                    )}

                    {/* Sender Buttons */}
                    {isSender && data.status === 'review_requested' && (
                        <>
                            <TeasyButton version="secondary" colorScheme="red" size="sm" onClick={() => handleStatusChange(data.id, 'pending', data.receiverId)}>재검토 요청</TeasyButton>
                            <TeasyButton colorScheme="purple" size="sm" onClick={() => handleStatusChange(data.id, 'approved', data.receiverId)}>최종 승인</TeasyButton>
                        </>
                    )}
                    {isSender && data.status === 'approved' && (
                        <TeasyButton version="secondary" colorScheme="red" size="sm" onClick={() => handleStatusChange(data.id, 'pending', data.receiverId)}>최종 승인 반려</TeasyButton>
                    )}

                    <TeasyButton version="ghost" size="sm" onClick={onClose}>닫기</TeasyButton>
                </HStack>
            </TeasyModalFooter>
        </TeasyModalContent>
    );
};

export const WorkRequestModal = ({ isOpen, onClose, data, currentUser }: WorkRequestModalProps) => {
    if (!data) return null;

    return (
        <TeasyModal isOpen={isOpen} onClose={onClose} size="6xl">
            <TeasyModalOverlay backdropFilter="blur(4px)" />
            <WorkRequestModalContent onClose={onClose} data={data} currentUser={currentUser} />
        </TeasyModal>
    );
};
