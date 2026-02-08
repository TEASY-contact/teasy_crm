
"use client";
import { useState, useEffect } from "react";
import {
    Box, Heading, Input, InputGroup, InputLeftElement, Grid, VStack, Text,
    HStack, Badge, Flex, IconButton, useDisclosure, SimpleGrid
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
import { STEP_LABELS, getBadgeColor } from "@/components/features/customer/timeline/TimelineUtils";

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
        'review_requested': 'purple',
        'approved': 'green',
        'rejected': 'red'
    };

    const statusLabels: Record<string, string> = {
        'pending': '대기',
        'review_requested': '검토 요청',
        'approved': '승인',
        'rejected': '반려'
    };

    // New logic: if pending but already read, show '확인'
    const displayLabel = (request.status === 'pending' && request.readStatus?.[request.receiverId])
        ? '확인'
        : statusLabels[request.status];

    const displayColor = (displayLabel === '확인') ? 'teal' : statusColors[request.status];

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
            bg="white"
            borderBottom="1px"
            borderColor="purple.50"
            cursor="pointer"
            _hover={{
                bg: "purple.50",
                zIndex: 1
            }}
            onClick={onClick}
            transition="all 0.1s"
            _last={{ borderBottom: "none" }}
        >
            <Flex align="center" gap={2} w="full">
                <Badge
                    colorScheme={displayColor}
                    variant={(displayColor === 'red' || displayColor === 'teal') ? "subtle" : "solid"}
                    px={2}
                    borderRadius="md"
                    fontSize="xs"
                    flexShrink={0}
                    h="18px"
                    display="flex"
                    alignItems="center"
                    fontWeight="700"
                    textTransform="none"
                    opacity={0.9}
                >
                    {displayLabel}
                </Badge>

                <Text
                    fontWeight="500"
                    fontSize="sm"
                    isTruncated
                    color="gray.700"
                    lineHeight="1.2"
                >
                    {request.title}
                </Text>

                {activity && (
                    <HStack spacing={1} flexShrink={0} ml={1.5} opacity={0.8} align="center">
                        <Badge
                            bg={`${getBadgeColor(activity.type)}.50`}
                            color={`${getBadgeColor(activity.type)}.500`}
                            fontSize="xs"
                            variant="subtle"
                            px={1.5}
                            borderRadius="md"
                            h="18px"
                            display="flex"
                            alignItems="center"
                            textTransform="none"
                            fontWeight="500"
                        >
                            {STEP_LABELS[activity.type] || activity.typeName || "보고서"}
                        </Badge>
                        <Text as="span" fontSize="xs" color="gray.500" fontWeight="500" isTruncated display="inline-flex" lineHeight="1.2">
                            {activity.customerName} {formatActivityDate(activity.date)}
                        </Text>
                    </HStack>
                )}

                <Text
                    fontSize="sm"
                    color="gray.700"
                    fontWeight="400"
                    isTruncated
                    flex={1}
                    ml={2}
                    lineHeight="1.2"
                    opacity={0.8}
                >
                    {request.content}
                </Text>

                {(() => {
                    const mgr = managerResolver(isSent ? request.receiverId : request.senderId);
                    const brandColor = mgr?.representativeColor || "gray.400";
                    return (
                        <Badge
                            variant="solid"
                            bg={brandColor}
                            color="white"
                            borderRadius="full"
                            w="18px"
                            h="18px"
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                            fontSize="10px"
                            fontWeight="700"
                            flexShrink={0}
                            opacity={0.9}
                        >
                            {(mgr?.label || "?").charAt(0)}
                        </Badge>
                    );
                })()}

                <Text
                    fontSize="sm"
                    color="gray.400"
                    fontWeight="medium"
                    flexShrink={0}
                    whiteSpace="pre"
                    lineHeight="1.2"
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
        });
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
        req.receiverId === userData?.uid && req.status !== 'approved' // Completed goes to bottom? "검토 완료" usually means approved/rejected
    );

    const sentRequests = filteredRequests.filter(req =>
        req.senderId === userData?.uid && req.status !== 'approved'
    );

    const completedRequests = filteredRequests.filter(req =>
        req.status === 'approved' || req.status === 'rejected'
    );

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
                        {completedRequests.map(req => (
                            <RequestCard
                                key={req.id}
                                request={req}
                                onClick={() => handleCardClick(req)}
                                isSent={req.senderId === userData?.uid}
                                managerResolver={resolveManager}
                                activity={req.relatedActivityId ? activityMap[req.relatedActivityId] : null}
                            />
                        ))}
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
