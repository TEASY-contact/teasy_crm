// src/components/features/work-order/WorkRequestModal.tsx
import React, { useState, useRef, useEffect } from "react";
import {
    Flex, Box, Grid, Text, Heading, IconButton, HStack, SimpleGrid, VStack, Badge, Tag, Avatar, GridItem,
    useDisclosure, Input, Textarea
} from "@chakra-ui/react";
import { AddIcon } from "@chakra-ui/icons";
import { ChatRoom } from "./ChatRoom";
import { useWorkOrder } from "@/hooks/useWorkOrder";
import {
    TeasyModal, TeasyModalOverlay, TeasyModalContent, TeasyModalHeader,
    TeasyModalBody, TeasyModalFooter, TeasyButton, triggerTeasyDownload, TeasyUniversalViewer,
    TeasyBadge, SurnameBadge, TeasyDivider
} from "@/components/common/UIComponents";
import { WorkRequest } from "@/types/work-order";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { doc, getDoc, collection, query, where, getDocs, writeBatch, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { TimelineCard } from "@/components/features/customer/TimelineCard";
import { STEP_LABELS, getBadgeColor } from "@/components/features/customer/timeline/TimelineUtils";
import { formatTimestamp } from "@/utils/formatter";
import { useReportMetadata } from "@/hooks/useReportMetadata";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { useToast } from "@chakra-ui/react";

interface WorkRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: WorkRequest | null;
    currentUser: any;
}

/**
 * Sub-component for Work Request details.
 * Unmounts when modal is closed, resetting all internal state (including ChatRoom).
 */
const FOOTER_STYLES = {
    BUTTON: { w: "108px", h: "45px" },
    BUTTON_LONG: { w: "130px", h: "45px" },
    CHAT_INPUT: { h: "45px", borderRadius: "lg", bg: "purple.50", border: "none", focusBorderColor: "purple.500" }, // Width removed for flexibility
    SEND_BUTTON: { w: "80px", h: "45px" }
};

const WorkRequestModalContent = ({ onClose, data, currentUser }: { onClose: () => void, data: WorkRequest, currentUser: any }) => {
    const { handleStatusChange: baseHandleStatusChange, deleteRequest, sendMessage, addAttachment, removeAttachment, updateRequest } = useWorkOrder();
    const queryClient = useQueryClient();
    const { managerOptions } = useReportMetadata();
    const [viewerState, setViewerState] = useState({ isOpen: false, index: 0 });
    const [uploading, setUploading] = useState(false);
    const [chatInput, setChatInput] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);
    const toast = useToast();

    const isAdminOrMaster = currentUser?.role === 'master' || currentUser?.role === 'admin';
    const isSender = currentUser?.uid === data.senderId || (isAdminOrMaster && data.senderId === 'TEASY_SYSTEM');
    const isReceiver = currentUser?.uid === data.receiverId;
    const isParticipant = isSender || isReceiver;

    const resolveName = (id: string) => {
        if (id === 'TEASY_SYSTEM') return '시스템';
        const option = managerOptions.find(opt => opt.value === id);
        return option ? option.label : id;
    };

    // Fetch Linked Activity
    const { data: activity } = useQuery({
        queryKey: ["activity-detail", data.relatedActivityId],
        queryFn: async () => {
            if (!data.relatedActivityId) return null;
            const snap = await getDoc(doc(db, "activities", data.relatedActivityId));
            return snap.exists() ? { id: snap.id, ...snap.data() } as any : null;
        },
        enabled: !!data.relatedActivityId
    });

    // --- Status Change Handler ---
    const handleStatusChange = async (requestId: string, newStatus: string, additionalData: any = {}) => {
        // Execute base change without any automation logic
        await baseHandleStatusChange(requestId, newStatus as any, additionalData);
    };

    const handleFileAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;
        const file = e.target.files[0];
        setUploading(true);

        try {
            // Standard Naming: {customer}_{base}_{yyyymmdd}{ext}
            const customer = activity?.customerName ? activity.customerName.split('_')[0].trim() : null;
            const now = new Date();
            const yyyymmdd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

            const lastDot = file.name.lastIndexOf('.');
            const base = lastDot !== -1 ? file.name.substring(0, lastDot) : file.name;
            const ext = lastDot !== -1 ? file.name.substring(lastDot) : "";
            const formattedName = customer ? `${customer}_${base}_${yyyymmdd}${ext}` : `${base}_${yyyymmdd}${ext}`;

            const storageRef = ref(storage, `work-requests/${data.id}/${formattedName}`);
            const snapshot = await uploadBytes(storageRef, file);
            const url = await getDownloadURL(snapshot.ref);

            await addAttachment(data.id, url, formattedName);
            toast({ title: "파일이 추가되었습니다.", status: "success", duration: 2000 });
        } catch (error) {
            console.error(error);
            toast({ title: "파일 업로드 실패", status: "error" });
        } finally {
            setUploading(false);
            if (e.target) e.target.value = '';
        }
    };

    const statusColors: Record<string, string> = {
        'pending': 'red',
        'review_requested': 'red',
        'approved': 'green',
        'rejected': 'red'
    };

    const statusLabels: Record<string, string> = {
        'pending': '대기',
        'review_requested': '검토 요청',
        'approved': '완료',
        'rejected': '반려'
    };

    let displayLabel = statusLabels[data.status];
    if (data.status === 'pending') {
        if (isReceiver && data.isReReview) {
            displayLabel = '재검토';
        } else if (isReceiver && data.readStatus?.[data.receiverId]) {
            displayLabel = '확인';
        }
    }

    const displayColor = (displayLabel === '확인' || displayLabel === '완료') ? 'green' : statusColors[data.status];

    return (
        <TeasyModalContent minH="500px" maxH="85vh" h="auto" borderRadius="2xl" overflow="hidden">
            <TeasyModalHeader p={0} m={0} borderBottom="none" borderTopRadius="0">
                <Grid templateColumns="minmax(0, 1fr) minmax(0, 1fr)" gap={8} w="full" px={6} py={4}>
                    <Flex justify="center" align="center">
                        <HStack spacing={3}>
                            <TeasyBadge
                                colorType={displayColor === 'red' ? 'red' : (displayColor === 'green' ? 'green' : 'brand')}
                                w="50px"
                            >
                                {displayLabel}
                            </TeasyBadge>
                            <Heading size="md" fontWeight="700" color="white">
                                {data.title}
                            </Heading>
                        </HStack>
                    </Flex>
                    <Box /> {/* Empty second column to maintain grid sync */}
                </Grid>
            </TeasyModalHeader>
            <TeasyModalBody p={0} bg="gray.50" overflow="hidden" display="flex" flexDirection="column">
                <VStack p={6} spacing={0} flex={1} w="full" align="stretch" overflowX="hidden" overflowY="hidden">
                    <Grid templateColumns="minmax(0, 1fr) minmax(0, 1fr)" gap={8} flex={1} minH={0}>
                        {/* Left: Info & Attachments */}
                        <VStack align="stretch" spacing={6} w="full" h="full" minH={0}>
                            {/* 1. Request Info (Always visible, fixed height) */}
                            <Box w="full" bg="white" p={5} borderRadius="xl" border="1px solid" borderColor="gray.100" shadow="sm" flex="0 0 auto">
                                <HStack spacing={6} mb={4} pb={3} borderBottom="1px" borderColor="gray.100" justify="start">
                                    <HStack spacing={2} align="start">
                                        <Text fontSize="sm" color="gray.400" fontWeight="medium">요청자</Text>
                                        <Text fontSize="sm" color="gray.600">{resolveName(data.senderId)}</Text>
                                    </HStack>
                                    <Box w="1px" h="12px" bg="gray.300" />
                                    <HStack spacing={2} align="start">
                                        <Text fontSize="sm" color="gray.400" fontWeight="medium">담당자</Text>
                                        <Text fontSize="sm" color="gray.600">{resolveName(data.receiverId)}</Text>
                                    </HStack>
                                </HStack>

                                <Box>
                                    <Text fontSize="sm" color="gray.400" fontWeight="medium" mb={2}>요청 내용</Text>
                                    <Text fontSize="sm" color="gray.600" whiteSpace="pre-wrap" pl="2px">
                                        {data.content}
                                    </Text>
                                </Box>
                            </Box>

                            {/* 2. Linked Activity (Scrollable, max-height restricted) */}
                            {activity && (
                                <VStack align="stretch" spacing={2} w="full" flex="0 1 auto" minH={0}>
                                    <HStack spacing={2} mb={1} ml={1} align="center">
                                        <TeasyBadge
                                            colorType={getBadgeColor(activity.type) as any}
                                            w="auto"
                                            px={1.5}
                                        >
                                            {activity.typeName || activity.type || "보고서"}
                                        </TeasyBadge>
                                        <Text fontSize="xs" color="gray.400">{activity.customerName}</Text>
                                    </HStack>
                                    <Box
                                        bg="white"
                                        p={3}
                                        borderRadius="2xl"
                                        border="1px solid"
                                        borderColor="gray.100"
                                        shadow="sm"
                                    >
                                        <Box
                                            maxH="200px"
                                            overflowY="auto"
                                            sx={{
                                                '&::-webkit-scrollbar': { width: '4px' },
                                                '&::-webkit-scrollbar-track': { background: 'transparent' },
                                                '&::-webkit-scrollbar-thumb': { background: 'gray.200', borderRadius: '24px' },
                                                '&:hover::-webkit-scrollbar-thumb': { background: 'gray.300' }
                                            }}
                                        >
                                            <TimelineCard
                                                variant="preview"
                                                bg="transparent"
                                                border="none"
                                                shadow="none"
                                                p={0}
                                                item={{
                                                    id: activity.id,
                                                    stepType: activity.type as any,
                                                    createdAt: formatTimestamp(activity.createdAt),
                                                    createdBy: activity.createdBy || "system",
                                                    createdByName: activity.createdByName || activity.managerName || "담당자 미지정",
                                                    managerName: activity.managerName || activity.createdByName,
                                                    content: activity,
                                                    customerName: activity.customerName
                                                } as any}
                                            />
                                        </Box>
                                    </Box>
                                </VStack>
                            )}

                            {/* 3. Attachments (Scrollable, fixed/constrained height) */}
                            <Box w="full" flex="0 1 auto" display="flex" flexDirection="column" minH={0}>
                                <Flex align="center" mb={2} flex="0 0 auto" ml={2}>
                                    <Text fontSize="sm" color="gray.400" fontWeight="medium">참고자료</Text>
                                    <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileAdd} />
                                    {isParticipant && (
                                        <IconButton
                                            aria-label="Add"
                                            icon={<AddIcon boxSize={2} />}
                                            size="xs"
                                            ml={2}
                                            colorScheme="purple"
                                            variant="ghost"
                                            minW="16px"
                                            h="16px"
                                            onClick={() => fileInputRef.current?.click()}
                                            isLoading={uploading}
                                        />
                                    )}
                                </Flex>
                                <Box
                                    flex={1}
                                    w="full"
                                    bg="white"
                                    borderRadius="2xl"
                                    border="1px solid"
                                    borderColor="gray.100"
                                    shadow="sm"
                                    position="relative"
                                    p={3}
                                >
                                    <Box
                                        w="full"
                                        h="full"
                                        maxH="100px"
                                        overflowY="auto"
                                        sx={{
                                            '&::-webkit-scrollbar': { width: '4px' },
                                            '&::-webkit-scrollbar-track': { background: 'transparent' },
                                            '&::-webkit-scrollbar-thumb': { background: 'gray.200', borderRadius: '24px' },
                                            '&:hover::-webkit-scrollbar-thumb': { background: 'gray.300' }
                                        }}
                                    >
                                        {data.attachments && data.attachments.length > 0 ? (
                                            <VStack align="stretch" spacing={0}>
                                                {data.attachments.map((file, idx) => (
                                                    <Box key={file.url}>
                                                        {idx > 0 && <Box h="1px" bg="gray.50" mx={3} />}
                                                        <HStack px={3} py={2} _hover={{ bg: "gray.50" }} cursor="pointer" transition="all 0.2s" justify="space-between">
                                                            <Text fontSize="xs" fontWeight="500" color="gray.700" isTruncated flex={1} pl="2px">{file.name}</Text>
                                                            <HStack spacing={1.5} flexShrink={0}>
                                                                <Box
                                                                    as="button"
                                                                    type="button"
                                                                    bg="gray.100"
                                                                    color="gray.500"
                                                                    fontSize="10px"
                                                                    px={2}
                                                                    h="18px"
                                                                    borderRadius="4px"
                                                                    cursor="pointer"
                                                                    transition="all 0.2s"
                                                                    _hover={{ bg: "gray.500", color: "white" }}
                                                                    onClick={(e: React.MouseEvent) => {
                                                                        e.stopPropagation();
                                                                        const isVideo = ['mp4', 'mov', 'm4v', 'webm'].some(ext =>
                                                                            file.name.toLowerCase().endsWith(ext) ||
                                                                            file.url.toLowerCase().split('?')[0].endsWith(ext) ||
                                                                            ((file as any).type && (file as any).type.includes('video'))
                                                                        );
                                                                        if (isVideo) window.open(file.url, '_blank');
                                                                        else setViewerState({ isOpen: true, index: (data.attachments || []).indexOf(file) || 0 });
                                                                    }}
                                                                    fontWeight="bold"
                                                                >
                                                                    확인
                                                                </Box>
                                                                <Text color="gray.300" fontSize="10px" fontWeight="bold">/</Text>
                                                                <Box
                                                                    as="button"
                                                                    type="button"
                                                                    bg="gray.100"
                                                                    color="gray.500"
                                                                    fontSize="10px"
                                                                    px={2}
                                                                    h="18px"
                                                                    borderRadius="4px"
                                                                    cursor="pointer"
                                                                    transition="all 0.2s"
                                                                    _hover={{ bg: "gray.500", color: "white" }}
                                                                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); triggerTeasyDownload(file); }}
                                                                    fontWeight="bold"
                                                                >
                                                                    다운로드
                                                                </Box>
                                                                <Text color="gray.300" fontSize="10px" fontWeight="bold">/</Text>
                                                                {isParticipant && (
                                                                    <Box
                                                                        as="button"
                                                                        type="button"
                                                                        bg="gray.100"
                                                                        color="gray.500"
                                                                        fontSize="10px"
                                                                        px={2}
                                                                        h="18px"
                                                                        borderRadius="4px"
                                                                        cursor="pointer"
                                                                        transition="all 0.2s"
                                                                        _hover={{ bg: "red.500", color: "white" }}
                                                                        onClick={async (e: React.MouseEvent) => {
                                                                            e.stopPropagation();
                                                                            if (confirm("해당 첨부파일을 삭제하시겠습니까?")) {
                                                                                await removeAttachment(data.id, file);
                                                                                toast({ title: "파일이 삭제되었습니다.", status: "success", duration: 2000 });
                                                                            }
                                                                        }}
                                                                        fontWeight="bold"
                                                                    >
                                                                        삭제
                                                                    </Box>
                                                                )}
                                                            </HStack>
                                                        </HStack>
                                                    </Box>
                                                ))}
                                            </VStack>
                                        ) : (
                                            <Box p={4} textAlign="center" border="1px dashed" borderColor="gray.200" borderRadius="lg" h="full" display="flex" alignItems="center" justifyContent="center">
                                                <Text fontSize="xs" color="gray.400">첨부된 자료가 없습니다.</Text>
                                            </Box>
                                        )}
                                    </Box>
                                </Box>
                            </Box>
                        </VStack>

                        {/* Right: Chat Room */}
                        <Box h="full" bg="white" borderRadius="xl" border="1px solid" borderColor="gray.100" overflow="hidden" position="relative" shadow="sm">
                            <Box position="absolute" top={0} left={0} right={0} bottom={0}>
                                <ChatRoom
                                    messages={data.messages}
                                    lastReadTimestamp={data.lastReadTimestamp}
                                    currentUserId={currentUser?.uid}
                                    input={chatInput}
                                    onInputChange={setChatInput}
                                    onSendMessage={async () => {
                                        if (!chatInput.trim()) return;
                                        await sendMessage(data.id, chatInput);
                                        setChatInput("");
                                    }}
                                />
                            </Box>
                        </Box>
                    </Grid>
                </VStack>

                <TeasyUniversalViewer
                    isOpen={viewerState.isOpen}
                    onClose={() => setViewerState({ ...viewerState, isOpen: false })}
                    files={(data.attachments || []).map(att => ({ ...att, timestamp: formatTimestamp(data.createdAt), author: resolveName(data.senderId) }))}
                    initialIndex={viewerState.index}
                    title="참고자료"
                    onDelete={async (file: any) => {
                        if (!isParticipant) return;
                        if (confirm("해당 첨부파일을 삭제하시겠습니까?")) {
                            await removeAttachment(data.id, file);
                            toast({ title: "파일이 삭제되었습니다.", status: "success", duration: 2000 });
                        }
                    }}
                />
            </TeasyModalBody>

            <TeasyModalFooter p={0} bg="white" borderTop="1px" borderColor="gray.100">
                <Box px={6} py={4} w="full">
                    <Grid templateColumns="minmax(0, 1fr) minmax(0, 1fr)" gap={8} w="full">
                        {/* Left: Action Buttons */}
                        <Flex align="center">
                            <HStack spacing={2}>
                                {isParticipant ? (
                                    <>
                                        {isSender && data.status !== 'approved' && (
                                            <TeasyButton version="danger" {...FOOTER_STYLES.BUTTON_LONG} onClick={() => deleteRequest(data.id)}>보낸 업무 삭제</TeasyButton>
                                        )}
                                        {isReceiver && data.status === 'pending' && (
                                            <TeasyButton colorScheme="purple" {...FOOTER_STYLES.BUTTON} onClick={async () => { await handleStatusChange(data.id, 'review_requested', { isReReview: false }); onClose(); }}>검토 요청</TeasyButton>
                                        )}
                                        {isReceiver && data.status === 'review_requested' && (
                                            <TeasyButton version="secondary" {...FOOTER_STYLES.BUTTON} onClick={async () => { await handleStatusChange(data.id, 'pending'); }}>요청 회수</TeasyButton>
                                        )}
                                        {isSender && data.status === 'review_requested' && (
                                            <>
                                                <TeasyButton colorScheme="purple" {...FOOTER_STYLES.BUTTON} onClick={async () => { await handleStatusChange(data.id, 'pending', { isReReview: true }); onClose(); }}>재검토 요청</TeasyButton>
                                                <TeasyButton colorScheme="purple" {...FOOTER_STYLES.BUTTON} onClick={async () => { await handleStatusChange(data.id, 'approved'); onClose(); }}>최종 승인</TeasyButton>
                                            </>
                                        )}
                                        {isSender && data.status === 'approved' && (
                                            <TeasyButton version="danger" {...FOOTER_STYLES.BUTTON_LONG} onClick={async () => { await handleStatusChange(data.id, 'pending', { isReReview: true }); onClose(); }}>최종 승인 반려</TeasyButton>
                                        )}
                                    </>
                                ) : (
                                    <Text fontSize="xs" color="gray.400" fontStyle="italic">업무 참여자가 아니므로 조회만 가능합니다.</Text>
                                )}
                            </HStack>
                        </Flex>

                        {/* Right: Chat Input & Close */}
                        <Flex align="center" gap={4} w="full">
                            {isParticipant ? (
                                <HStack spacing={2} flex={1} w="full">
                                    <Input
                                        placeholder="채팅 메세지 입력"
                                        {...FOOTER_STYLES.CHAT_INPUT}
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                                                if (chatInput.trim()) {
                                                    sendMessage(data.id, chatInput);
                                                    setChatInput("");
                                                }
                                            }
                                        }}
                                        flex={1}
                                    />
                                    <TeasyButton
                                        {...FOOTER_STYLES.SEND_BUTTON}
                                        colorScheme="brand"
                                        onClick={async () => {
                                            if (!chatInput.trim()) return;
                                            await sendMessage(data.id, chatInput);
                                            setChatInput("");
                                        }}
                                        flexShrink={0}
                                    >
                                        전송
                                    </TeasyButton>
                                </HStack>
                            ) : (
                                <Box flex={1} />
                            )}
                            <TeasyButton
                                version="secondary"
                                {...FOOTER_STYLES.BUTTON}
                                onClick={onClose}
                                flexShrink={0}
                            >
                                닫기
                            </TeasyButton>
                        </Flex>
                    </Grid>
                </Box>
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
