
"use client";
import { useState, useRef, useEffect } from "react";
import {
    Box, VStack, Text, Select, FormControl,
    InputGroup, HStack, useToast, Badge, Grid, Flex
} from "@chakra-ui/react";
import { AttachmentIcon, CloseIcon } from "@chakra-ui/icons";
import {
    TeasyModal, TeasyModalOverlay, TeasyModalContent, TeasyModalHeader,
    TeasyModalBody, TeasyModalFooter, TeasyButton, TeasyInput, TeasyTextarea, TeasyFormLabel, TeasyFormGroup,
    ThinParen
} from "@/components/common/UIComponents";
import { CustomSelect } from "@/components/common/CustomSelect";
import { useWorkOrder } from "@/hooks/useWorkOrder";
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useReportMetadata } from "@/hooks/useReportMetadata";
import { isWithinBusinessDays } from "@/utils/dateUtils";
import { STEP_LABELS, getBadgeColor } from "@/components/features/customer/timeline/TimelineUtils";
import { TimelineCard } from "@/components/features/customer/TimelineCard";
import { formatTimestamp } from "@/utils/formatter";

// Note: We need a way to select users. 
// Ideally we fetch a user list. For now, we might need a mock list or fetch from 'users' collection.
// Let's assume passed prop 'users' or we fetch them. 
// For this step, I'll create a simple Select that requires a 'users' prop.

interface CreateWorkRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialData?: {
        receiverId?: string;
        relatedActivityId?: string;
    };
}

export const CreateWorkRequestModal = ({ isOpen, onClose, initialData }: CreateWorkRequestModalProps) => {
    const { createRequest } = useWorkOrder();
    const { userData } = useAuth();
    const toast = useToast();

    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [receiverId, setReceiverId] = useState(initialData?.receiverId || "");
    const [relatedActivityId, setRelatedActivityId] = useState(initialData?.relatedActivityId || "");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Sync state with initialData when modal opens
    useEffect(() => {
        if (isOpen && initialData) {
            if (initialData.receiverId) setReceiverId(initialData.receiverId);
            if (initialData.relatedActivityId) setRelatedActivityId(initialData.relatedActivityId);
        }
    }, [isOpen, initialData]);
    const [files, setFiles] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { holidayMap, managerOptions } = useReportMetadata();

    // Fetch Recent Reports (3 Business Days)
    const { data: activities = [] } = useQuery({
        queryKey: ["activities", "recent_for_work_request"],
        queryFn: async () => {
            const tenDaysAgo = new Date();
            tenDaysAgo.setDate(tenDaysAgo.getDate() - 10); // Fetch last 10 days to ensure we have at least 3 business days
            const q = query(
                collection(db, "activities"),
                where("createdAt", ">=", tenDaysAgo),
                orderBy("createdAt", "desc")
            );
            const snap = await getDocs(q);
            return snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
        },
        enabled: isOpen
    });

    const reportOptions = [
        { value: "", label: "선택 안함" },
        { value: "divider", label: "", isDivider: true },
        ...activities.filter(act => {
            if (initialData?.relatedActivityId && act.id === initialData.relatedActivityId) return true;
            const createdAt = act.createdAt?.toDate ? act.createdAt.toDate() : new Date(act.createdAt);
            return isWithinBusinessDays(createdAt, 3, holidayMap);
        }).map(act => {
            const date = act.date ? new Date(act.date.replace("  ", " ")) : new Date();
            const dateStr = `${String(date.getFullYear()).slice(2)}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
            const weekDay = weekDays[date.getDay()];

            return {
                value: act.id,
                label: (
                    <Flex align="center" w="full" gap={2}>
                        <Badge bg={`${getBadgeColor(act.type)}.50`} color={`${getBadgeColor(act.type)}.500`} fontSize="10px" px={1.5} borderRadius="sm" flexShrink={0}>
                            {STEP_LABELS[act.type] || act.typeName || "보고서"}
                        </Badge>
                        <Text as="span" isTruncated fontSize="sm" fontWeight="400" flex={1}>
                            {act.customerName}
                        </Text>
                        <Text as="span" fontSize="xs" color="gray.400" flexShrink={0}>
                            {dateStr} ({weekDay})
                        </Text>
                    </Flex>
                ) as any
            };
        })
    ];

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const selectedFiles = Array.from(e.target.files);
            const restrictedExtensions = ['exe', 'bat', 'cmd', 'msi', 'com', 'scr', 'vbs'];
            const MAX_SIZE = 500 * 1024 * 1024; // 500MB

            let hasRestrictedExt = false;
            let hasOversized = false;

            const validFiles = selectedFiles.filter(file => {
                const ext = file.name.split('.').pop()?.toLowerCase() || '';
                const isExecutable = restrictedExtensions.includes(ext);
                const isOversized = file.size > MAX_SIZE;

                if (isExecutable) hasRestrictedExt = true;
                if (isOversized) hasOversized = true;

                return !isExecutable && !isOversized;
            });

            if (hasRestrictedExt || hasOversized) {
                let description = "";
                if (hasRestrictedExt && hasOversized) {
                    description = "실행 파일은 보안상 제한되며, 500MB를 초과하는 파일은 업로드할 수 없습니다.";
                } else if (hasRestrictedExt) {
                    description = "exe, bat 등의 실행 파일은 보안상 업로드할 수 없습니다.";
                } else {
                    description = "500MB를 초과하는 대용량 파일은 업로드할 수 없습니다.";
                }

                toast({
                    title: "일부 파일 제외됨",
                    description,
                    status: "warning",
                    duration: 3500,
                    isClosable: true,
                });
            }

            setFiles(validFiles);
            if (e.target) e.target.value = '';
        }
    };

    const handleSubmit = async () => {
        if (!title || !content || !receiverId) {
            toast({ title: "모든 필드를 입력해주세요.", status: "warning" });
            return;
        }

        setIsSubmitting(true);
        try {
            const uploadedAttachments = [];
            const tempId = Date.now().toString(); // Use timestamp as a unique folder name

            for (const file of files) {
                // Determine the formatted name using the same logic as display
                const act = activities.find(a => a.id === relatedActivityId);
                const customer = act?.customerName ? act.customerName.split('_')[0].trim() : null;
                const now = new Date();
                const yyyymmdd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

                const lastDot = file.name.lastIndexOf('.');
                const base = lastDot !== -1 ? file.name.substring(0, lastDot) : file.name;
                const ext = lastDot !== -1 ? file.name.substring(lastDot) : "";
                const formattedName = customer ? `${customer}_${base}_${yyyymmdd}${ext}` : `${base}_${yyyymmdd}${ext}`;

                const storageRef = ref(storage, `work-requests/${tempId}/${formattedName}`);
                const snapshot = await uploadBytes(storageRef, file);
                const url = await getDownloadURL(snapshot.ref);

                uploadedAttachments.push({
                    name: formattedName,
                    url,
                    originalName: file.name,
                    size: file.size,
                    type: file.type,
                    createdAt: new Date().toISOString()
                });
            }

            await createRequest(title, content, receiverId, uploadedAttachments, relatedActivityId);

            toast({ title: "업무 요청이 생성되었습니다.", status: "success" });
            onClose();
            // Reset form
            setTitle("");
            setContent("");
            setReceiverId("");
            setRelatedActivityId("");
            setFiles([]);
        } catch (error) {
            console.error(error);
            toast({ title: "요청 생성 실패", status: "error" });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <TeasyModal isOpen={isOpen} onClose={onClose} size="xl">
            <TeasyModalOverlay backdropFilter="blur(4px)" />
            <TeasyModalContent borderRadius="xl">
                <TeasyModalHeader>업무 요청</TeasyModalHeader>
                <TeasyModalBody p={6}>
                    <VStack spacing={4} align="stretch">
                        <Grid templateColumns="3fr 7fr" gap={4}>
                            <FormControl isRequired>
                                <TeasyFormLabel>수신자</TeasyFormLabel>
                                <CustomSelect
                                    placeholder="선택"
                                    value={receiverId}
                                    onChange={(val) => setReceiverId(val)}
                                    options={managerOptions}
                                />
                            </FormControl>

                            <FormControl>
                                <TeasyFormLabel>관련 업무</TeasyFormLabel>
                                <CustomSelect
                                    placeholder="선택 (최근 3영업일)"
                                    value={relatedActivityId}
                                    onChange={(val) => setRelatedActivityId(val)}
                                    options={reportOptions}
                                />
                            </FormControl>
                        </Grid>

                        {relatedActivityId && (
                            <Box>
                                {(() => {
                                    const act = activities.find(a => a.id === relatedActivityId);
                                    if (!act) return (
                                        <>
                                            <TeasyFormLabel>상세정보</TeasyFormLabel>
                                            <Text fontSize="sm" color="gray.400">데이터를 불러올 수 없습니다.</Text>
                                        </>
                                    );

                                    const author = act.createdByName || act.managerName || "담당자 미지정";
                                    const timeStr = formatTimestamp(act.createdAt).replace(/\s+/g, "  ");

                                    return (
                                        <>
                                            <Flex justify="space-between" align="center" mb={1.5}>
                                                <TeasyFormLabel mb={0}>상세정보</TeasyFormLabel>
                                                <Text fontSize="xs" color="gray.400" fontWeight="normal">
                                                    {timeStr}  ({author})
                                                </Text>
                                            </Flex>
                                            <TimelineCard
                                                variant="preview"
                                                item={{
                                                    id: relatedActivityId,
                                                    stepType: act.type as any,
                                                    createdAt: formatTimestamp(act.createdAt),
                                                    createdBy: act.createdBy || "system",
                                                    createdByName: act.createdByName || act.managerName || "담당자 미지정",
                                                    managerName: act.managerName || act.createdByName,
                                                    content: act,
                                                    customerName: act.customerName
                                                } as any}
                                            />
                                        </>
                                    );
                                })()}
                            </Box>
                        )}

                        <FormControl isRequired>
                            <TeasyFormLabel>제목</TeasyFormLabel>
                            <TeasyInput
                                placeholder="업무 제목"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                            />
                        </FormControl>

                        <FormControl isRequired>
                            <TeasyFormLabel>내용</TeasyFormLabel>
                            <TeasyTextarea
                                placeholder="상세 업무 내용을 입력하세요"
                                minH="150px"
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                            />
                        </FormControl>

                        <FormControl>
                            <TeasyFormLabel>첨부파일</TeasyFormLabel>
                            <TeasyFormGroup p={2}>
                                <VStack align="stretch" spacing={2}>
                                    <Box w="full">
                                        <input
                                            type="file"
                                            multiple
                                            ref={fileInputRef}
                                            style={{ display: 'none' }}
                                            onChange={handleFileChange}
                                        />
                                        <Badge
                                            as="button"
                                            cursor="pointer"
                                            onClick={() => fileInputRef.current?.click()}
                                            bg="gray.100"
                                            color="gray.600"
                                            border="1px solid"
                                            borderColor="gray.200"
                                            _hover={{ bg: "gray.200" }}
                                            w="full"
                                            h="32px"
                                            borderRadius="10px"
                                            fontSize="xs"
                                            fontWeight="600"
                                            display="flex"
                                            alignItems="center"
                                            justifyContent="center"
                                            textTransform="none"
                                        >
                                            파일 선택 {files.length > 0 && `(${files.length})`}
                                        </Badge>
                                    </Box>
                                    {files.length > 0 && (
                                        <VStack spacing={1} align="stretch">
                                            {files.map((f, idx) => {
                                                const act = activities.find(a => a.id === relatedActivityId);
                                                const customer = act?.customerName ? act.customerName.split('_')[0].trim() : null;
                                                const now = new Date();
                                                const yyyymmdd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

                                                const lastDot = f.name.lastIndexOf('.');
                                                const base = lastDot !== -1 ? f.name.substring(0, lastDot) : f.name;
                                                const ext = lastDot !== -1 ? f.name.substring(lastDot) : "";
                                                const formattedName = customer ? `${customer}_${base}_${yyyymmdd}${ext}` : `${base}_${yyyymmdd}${ext}`;

                                                return (
                                                    <Badge
                                                        key={idx}
                                                        bg="white"
                                                        color="gray.600"
                                                        border="1px solid"
                                                        borderColor="gray.100"
                                                        borderRadius="md"
                                                        px={3}
                                                        py={1.5}
                                                        display="flex"
                                                        alignItems="center"
                                                        justifyContent="space-between"
                                                        w="full"
                                                        textTransform="none"
                                                    >
                                                        <Text isTruncated flex={1} fontSize="sm" fontWeight="medium" color="gray.600">
                                                            <ThinParen text={formattedName} />
                                                        </Text>
                                                        <CloseIcon
                                                            boxSize={2}
                                                            ml={2}
                                                            cursor="pointer"
                                                            onClick={() => {
                                                                setFiles(files.filter((_, i) => i !== idx));
                                                            }}
                                                            _hover={{ color: "red.500" }}
                                                        />
                                                    </Badge>
                                                );
                                            })}
                                        </VStack>
                                    )}
                                </VStack>
                            </TeasyFormGroup>
                        </FormControl>
                    </VStack>
                </TeasyModalBody>
                <TeasyModalFooter>
                    <TeasyButton version="secondary" mr={3} onClick={onClose} w="108px" h="45px">취소</TeasyButton>
                    <TeasyButton colorScheme="purple" onClick={handleSubmit} isLoading={isSubmitting} w="108px" h="45px">
                        요청 보내기
                    </TeasyButton>
                </TeasyModalFooter>
            </TeasyModalContent>
        </TeasyModal>
    );
};
