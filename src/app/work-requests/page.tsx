"use client";
import React, { useState, useEffect } from "react";
import {
    Box, Heading, Input, InputGroup, InputLeftElement, Grid, VStack, Text,
    HStack, Badge, Flex, IconButton, useDisclosure, SimpleGrid, Divider
} from "@chakra-ui/react";
import { SearchIcon, AddIcon } from "@chakra-ui/icons";
import { useWorkOrder } from "@/hooks/useWorkOrder";
import { useAuth } from "@/context/AuthContext";
import { WorkRequest, WorkRequestStatus } from "@/types/work-order";
import { WorkRequestModal } from "@/components/features/work-order/WorkRequestModal";
import { CreateWorkRequestModal } from "@/components/features/work-order/CreateWorkRequestModal";
import { useReportMetadata } from "@/hooks/useReportMetadata";
import { useQuery } from "@tanstack/react-query";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
    TeasyBadge, SurnameBadge, TeasyDivider, TeasyButton
} from "@/components/common/UIComponents";
import { getBadgeColor } from "@/components/features/customer/timeline/TimelineUtils";

// Helper: Check if a timestamp is within 3 business days from now
const isWithin3BusinessDays = (timestamp: any) => {
    if (!timestamp) return true;
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const today = new Date();

    // Reset hours for comparison
    const startOfToday = new Date(today);
    startOfToday.setHours(0, 0, 0, 0);

    const startOfTarget = new Date(date);
    startOfTarget.setHours(0, 0, 0, 0);

    let count = 0;
    let current = new Date(startOfTarget);

    while (current < startOfToday) {
        current.setDate(current.getDate() + 1);
        const day = current.getDay();
        if (day !== 0 && day !== 6) { // Mon-Fri
            count++;
        }
    }
    return count <= 3;
};

// Helper: Check if a timestamp is today
const isToday = (timestamp: any) => {
    if (!timestamp) return false;
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    return date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate();
};

// Helper: Format date for CHAT-style divider "2026.02.08 (일)"
const formatDateForDivider = (timestamp: any) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const day = days[date.getDay()];
    return `${y}.${m}.${d} (${day})`;
};

const DateDivider = ({ dateStr }: { dateStr: string }) => (
    <Flex align="center" py={4} px={4} bg="white">
        <Divider borderColor="gray.100" />
        <Text px={4} fontSize="xs" color="gray.400" whiteSpace="nowrap" fontWeight="700">
            {dateStr}
        </Text>
        <Divider borderColor="gray.100" />
    </Flex>
);

// Helper Component for Request Card
const RequestCard = ({ request, onClick, isSent, managerResolver, activity }: { request: WorkRequest, onClick: () => void, isSent: boolean, managerResolver: (id: string) => any, activity?: any }) => {
    const formatActivityDate = (dateVal: any) => {
        if (!dateVal) return "";
        try {
            let date: Date;
            if (dateVal.toDate) { // Firestore Timestamp
                date = dateVal.toDate();
            } else if (typeof dateVal === 'string') {
                const normalized = dateVal.includes('T') ? dateVal : dateVal.replace(' ', 'T');
                date = new Date(normalized);
            } else {
                date = new Date(dateVal);
            }

            const formatStringWithStandard = (y: string, m: string, d: string, dayName: string) => (
                <>
                    <Text as="span" fontWeight="400" color="gray.300" ml={1.5} mr={0.5}>|</Text>
                    <Text as="span" whiteSpace="nowrap" ml={0.5}>
                        {y}-{m}-{d}
                        {dayName && (
                            <>
                                &nbsp;<Text as="span" fontWeight="400" color="gray.300">(</Text>{dayName}<Text as="span" fontWeight="400" color="gray.300">)</Text>
                            </>
                        )}
                    </Text>
                </>
            );

            if (isNaN(date.getTime())) {
                const match = String(dateVal).match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
                if (match) {
                    const y = match[1];
                    const m = match[2].padStart(2, '0');
                    const dNum = match[3].padStart(2, '0');
                    const tempDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(dNum));
                    const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
                    const dayName = weekDays[tempDate.getDay()];
                    return formatStringWithStandard(y, m, dNum, dayName);
                }
                return String(dateVal).split(' ')[0];
            }

            const yyyy = date.getFullYear().toString();
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const dd = String(date.getDate()).padStart(2, '0');
            const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
            const day = weekDays[date.getDay()];

            return formatStringWithStandard(yyyy, mm, dd, day);
        } catch (e) { return ""; }
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

    // Updated Label logic
    let displayLabel = statusLabels[request.status];
    if (request.status === 'pending') {
        if (!isSent && request.isReReview) {
            displayLabel = '재검토';
        } else if (!isSent && request.readStatus?.[request.receiverId]) {
            displayLabel = '확인';
        }
    }

    const displayColor = (displayLabel === '확인' || displayLabel === '완료') ? 'green' : statusColors[request.status];

    const isApproved = request.status === 'approved';

    // Safe Date formatting for main request creation: YYYY-MM-DD  HH:MM (No Day)
    const formattedDateTime = (() => {
        if (!request.createdAt) return "";
        try {
            const date = request.createdAt.toDate ? request.createdAt.toDate() : new Date(request.createdAt);
            if (isNaN(date.getTime())) return "";

            const rY = date.getFullYear();
            const rM = String(date.getMonth() + 1).padStart(2, '0');
            const rD = String(date.getDate()).padStart(2, '0');
            const rH = String(date.getHours()).padStart(2, '0');
            const rMin = String(date.getMinutes()).padStart(2, '0');
            const rDay = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
            // Standard: YYYY-MM-DD (요일)  HH:MM
            return (
                <Text as="span" whiteSpace="pre">
                    {rY}-{rM}-{rD}
                    &nbsp;<Text as="span" fontWeight="400" opacity={0.5}>(</Text>{rDay}<Text as="span" fontWeight="400" opacity={0.5}>)</Text>
                    {"\u00A0\u00A0"}{rH}:{rMin}
                </Text>
            );
        } catch (e) { return ""; }
    })();

    return (
        <Box
            py={1.5}
            px={3}
            bg={isApproved ? "gray.50" : "white"}
            borderBottom="1px"
            borderColor="purple.50"
            cursor="pointer"
            position="relative"
            _hover={{
                bg: "purple.50",
                zIndex: 1
            }}
            onClick={onClick}
            transition="all 0.1s"
            _last={{ borderBottom: "none" }}
        >
            <Flex align="center" gap={2} w="full">
                <TeasyBadge
                    colorType={displayColor === 'red' ? 'red' : (displayColor === 'green' ? 'green' : 'brand')}
                    w="50px"
                    flexShrink={0}
                >
                    {displayLabel}
                </TeasyBadge>

                <Box position="relative" flex={1} minW={0} ml={2}>
                    {isApproved && (
                        <Box
                            position="absolute"
                            top="50%"
                            left={0}
                            right={0}
                            h="1px"
                            bg="gray.400"
                            zIndex={2}
                        />
                    )}
                    <Flex align="center" gap={2}>
                        <Text
                            fontWeight="600"
                            fontSize="sm"
                            isTruncated
                            color={isApproved ? "gray.400" : "gray.700"}
                            lineHeight="1.2"
                            flexShrink={0}
                            maxW="40%"
                        >
                            {request.title}
                        </Text>

                        <Text
                            fontWeight="400"
                            fontSize="sm"
                            isTruncated
                            color={isApproved ? "gray.400" : "gray.500"}
                            lineHeight="1.2"
                            flex={1}
                        >
                            {request.content}
                        </Text>
                    </Flex>
                </Box>

                <Box w="1px" h="12px" bg="gray.300" mx={2} />

                {(() => {
                    const isCompletedCategory = request.status === 'approved' || request.status === 'rejected' || request.status === 'review_requested';

                    if (isCompletedCategory) {
                        const sender = managerResolver(request.senderId);
                        const receiver = managerResolver(request.receiverId);
                        return (
                            <HStack spacing={1} flexShrink={0}>
                                <SurnameBadge
                                    name={sender?.label}
                                    color={sender?.representativeColor || "gray.400"}
                                    badgeChar={(sender?.label || "?").charAt(0)}
                                />
                                <Text fontSize="xs" color="gray.300" fontWeight="bold" mx={0.5}>→</Text>
                                <SurnameBadge
                                    name={receiver?.label}
                                    color={receiver?.representativeColor || "gray.400"}
                                    badgeChar={(receiver?.label || "?").charAt(0)}
                                />
                            </HStack>
                        );
                    }

                    const mgr = managerResolver(isSent ? request.receiverId : request.senderId);
                    const brandColor = mgr?.representativeColor || "gray.400";
                    return (
                        <SurnameBadge
                            name={mgr?.label}
                            color={brandColor}
                            badgeChar={(mgr?.label || "?").charAt(0)}
                            flexShrink={0}
                        />
                    );
                })()}

                <Text
                    fontSize="sm"
                    color="gray.400"
                    fontWeight="medium"
                    flexShrink={0}
                    whiteSpace="pre"
                    lineHeight="1.2"
                    ml={2}
                    opacity={0.8}
                >
                    {formattedDateTime}
                </Text>
            </Flex>
        </Box>
    );
};

export default function WorkRequestsPage() {
    const { userData } = useAuth();
    const { getRequests, markAsRead } = useWorkOrder();
    const { managerOptions } = useReportMetadata();
    const [requests, setRequests] = useState<WorkRequest[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedRequest, setSelectedRequest] = useState<WorkRequest | null>(null);
    const { isOpen: isDetailOpen, onOpen: onDetailOpen, onClose: onDetailClose } = useDisclosure();
    const { isOpen: isCreateOpen, onOpen: onCreateOpen, onClose: onCreateClose } = useDisclosure();

    // Fetch Data
    useEffect(() => {
        if (!userData?.uid) return;
        const unsubscribe = getRequests(userData.uid, (data) => {
            setRequests(data);
        }, userData.role);
        return () => unsubscribe && unsubscribe();
    }, [userData]);

    // Fetch Related Activities
    const relatedActivityIds = Array.from(new Set(requests.map(r => r.relatedActivityId).filter(Boolean))) as string[];

    const { data: activityMap = {} } = useQuery({
        queryKey: ["work-request-activities", relatedActivityIds.join(',')],
        queryFn: async () => {
            if (relatedActivityIds.length === 0) return {};

            // Chunk ids in groups of 30 due to Firestore "in" limit
            const chunks = [];
            for (let i = 0; i < relatedActivityIds.length; i += 30) {
                chunks.push(relatedActivityIds.slice(i, i + 30));
            }

            const results = await Promise.all(chunks.map(chunk =>
                getDocs(query(collection(db, "activities"), where("__name__", "in", chunk)))
            ));

            const map: Record<string, any> = {};
            results.forEach(snap => {
                snap.docs.forEach(d => {
                    map[d.id] = d.data();
                });
            });
            return map;
        },
        enabled: relatedActivityIds.length > 0
    });

    // Derived State
    const filteredRequests = requests.filter(req =>
        req.title.includes(searchTerm) || req.content.includes(searchTerm)
    );

    const receivedRequests = filteredRequests.filter(req =>
        req.receiverId === userData?.uid && req.status === 'pending'
    );

    const sentRequests = filteredRequests.filter(req =>
        req.senderId === userData?.uid && req.status === 'pending'
    );

    const completedRequests = filteredRequests.filter(req => {
        const isMasterOrAdmin = userData?.role === 'master' || userData?.role === 'admin';
        const isSystemTask = req.senderId === 'TEASY_SYSTEM';
        const isParticipant = req.participants?.includes(userData?.uid || '');

        if (req.status === 'approved') {
            if (isParticipant || (isSystemTask && isMasterOrAdmin)) {
                return isWithin3BusinessDays(req.createdAt);
            }
            return false;
        }

        if (req.status === 'rejected' || req.status === 'review_requested') {
            return isParticipant || (isSystemTask && isMasterOrAdmin);
        }

        return false;
    });

    const handleCardClick = (req: WorkRequest) => {
        setSelectedRequest(req);
        onDetailOpen();
        if (req.receiverId === userData?.uid && !req.readStatus?.[userData.uid]) {
            markAsRead(req.id);
        }
    };

    const resolveManager = (id: string) => {
        return managerOptions.find(opt => opt.value === id);
    };

    return (
        <Box p={8} h="100vh" overflowY="auto" bg="gray.50">
            <Flex justify="space-between" align="center" mb={6}>
                <Heading size="lg">업무 요청</Heading>
                <IconButton
                    aria-label="Create Request"
                    icon={<AddIcon />}
                    colorScheme="brand"
                    borderRadius="full"
                    onClick={onCreateOpen}
                />
            </Flex>

            {/* 1. Search Bar */}
            <InputGroup mb={8} bg="white" borderRadius="md" shadow="sm">
                <InputLeftElement pointerEvents="none"><SearchIcon color="gray.300" /></InputLeftElement>
                <Input
                    placeholder="업무 제목, 내용 검색..."
                    border="none"
                    focusBorderColor="brand.500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </InputGroup>

            {/* 2. Active Requests (Received vs Sent) */}
            <Grid templateColumns="1fr 1fr" gap={6} mb={8} maxH="calc(33vh - 52px)">
                {/* Received */}
                <Box bg="white" p={4} borderRadius="xl" shadow="sm" border="1px" borderColor="gray.100" h="full" overflowY="auto">
                    <VStack align="stretch" spacing={4}>
                        <HStack spacing={2} pb={2} borderBottom="1px" borderColor="gray.100">
                            <Heading size="md" color="gray.800" fontWeight="700">받은 업무</Heading>
                            <Badge bg="gray.100" color="purple.500" fontSize="xs" px={2} borderRadius="md" fontWeight="600" variant="subtle">{receivedRequests.length}</Badge>
                        </HStack>
                        <VStack align="stretch" spacing={0} border="1px" borderColor="purple.50" borderRadius="lg" overflow="hidden">
                            {receivedRequests.length === 0 && (
                                <Box py={12} textAlign="center">
                                    <Text fontSize="sm" color="gray.400" fontWeight="medium">받은 업무가 없습니다.</Text>
                                </Box>
                            )}
                            {receivedRequests.map(req => (
                                <RequestCard
                                    key={req.id}
                                    request={req}
                                    onClick={() => handleCardClick(req)}
                                    isSent={false}
                                    managerResolver={resolveManager}
                                    activity={req.relatedActivityId ? activityMap[req.relatedActivityId] : null}
                                />
                            ))}
                        </VStack>
                    </VStack>
                </Box>

                {/* Sent */}
                <Box bg="white" p={4} borderRadius="xl" shadow="sm" border="1px" borderColor="gray.100" h="full" overflowY="auto">
                    <VStack align="stretch" spacing={4}>
                        <HStack spacing={2} pb={2} borderBottom="1px" borderColor="gray.100">
                            <Heading size="md" color="gray.800" fontWeight="700">보낸 업무</Heading>
                            <Badge bg="gray.100" color="purple.500" fontSize="xs" px={2} borderRadius="md" fontWeight="600" variant="subtle">{sentRequests.length}</Badge>
                        </HStack>
                        <VStack align="stretch" spacing={0} border="1px" borderColor="purple.50" borderRadius="lg" overflow="hidden">
                            {sentRequests.length === 0 && (
                                <Box py={12} textAlign="center">
                                    <Text fontSize="sm" color="gray.400" fontWeight="medium">보낸 업무가 없습니다.</Text>
                                </Box>
                            )}
                            {sentRequests.map(req => (
                                <RequestCard
                                    key={req.id}
                                    request={req}
                                    onClick={() => handleCardClick(req)}
                                    isSent={true}
                                    managerResolver={resolveManager}
                                    activity={req.relatedActivityId ? activityMap[req.relatedActivityId] : null}
                                />
                            ))}
                        </VStack>
                    </VStack>
                </Box>
            </Grid>

            {/* 3. Completed Requests */}
            <Box bg="white" p={4} borderRadius="xl" shadow="sm" border="1px" borderColor="gray.100" maxH="calc(33vh - 52px)" overflowY="auto">
                <HStack spacing={2} mb={4} pb={2} borderBottom="1px" borderColor="gray.100">
                    <Heading size="md" color="gray.800" fontWeight="700">
                        검토&nbsp;·&nbsp;완료 업무
                    </Heading>
                    <Badge bg="gray.100" color="purple.500" fontSize="xs" px={2} borderRadius="md" fontWeight="600" variant="subtle">{completedRequests.length}</Badge>
                </HStack>

                {completedRequests.length === 0 ? (
                    <Box py={12} textAlign="center">
                        <Text fontSize="sm" color="gray.400" fontWeight="medium">완료된 업무가 없습니다.</Text>
                    </Box>
                ) : (
                    <VStack align="stretch" spacing={0} border="1px" borderColor="purple.50" borderRadius="lg" overflow="hidden">
                        {completedRequests.map((req, idx) => {
                            const currentDate = formatDateForDivider(req.createdAt);
                            const prevDate = idx > 0 ? formatDateForDivider(completedRequests[idx - 1].createdAt) : null;
                            // Only show divider if date changed AND it's not today
                            const showDivider = currentDate !== prevDate && !isToday(req.createdAt);

                            return (
                                <React.Fragment key={req.id}>
                                    {showDivider && <DateDivider dateStr={currentDate} />}
                                    <RequestCard
                                        request={req}
                                        onClick={() => handleCardClick(req)}
                                        isSent={req.senderId === userData?.uid}
                                        managerResolver={resolveManager}
                                        activity={req.relatedActivityId ? activityMap[req.relatedActivityId] : null}
                                    />
                                </React.Fragment>
                            );
                        })}
                    </VStack>
                )}
            </Box>

            {/* Detail Modal */}
            <WorkRequestModal
                isOpen={isDetailOpen}
                onClose={onDetailClose}
                data={requests.find(r => r.id === selectedRequest?.id) || selectedRequest}
                currentUser={userData}
            />

            {/* Create Modal */}
            <CreateWorkRequestModal
                isOpen={isCreateOpen}
                onClose={onCreateClose}
            />
        </Box>
    );
}
