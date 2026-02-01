import React from "react";
import { Box, Flex, Text, VStack, HStack, Badge } from "@chakra-ui/react";
import { TimelineItem } from "@/types/timeline";
import { TimelineBadge, TimelineInfoItem, TimelineFileList, ThinParen, TeasyButton, TeasyUniversalViewer } from "@/components/common/UIComponents";
import { formatPhone } from "@/utils/formatter";
import { useDisclosure } from "@chakra-ui/react";

const STEP_LABELS: Record<string, string> = {
    inquiry: "신규 문의", demo_schedule: "시연 확정", demo_complete: "시연 완료",
    purchase_confirm: "구매 확정", install_schedule: "시공 확정", install_complete: "시공 완료",
    as_schedule: "방문 A/S 확정", as_complete: "방문 A/S 완료", remoteas_complete: "원격 A/S 완료"
};

/**
 * Utility: Color mapping rule identical to MainDashboard.tsx (v123.70)
 */
const getBadgeColor = (type: string) => {
    const t = type || "";
    const mapping: Record<string, string> = {
        'customer_registered': "blue", 'inquiry': "purple", 'demo_schedule': "blue", 'demo_complete': "purple",
        'purchase_confirm': "purple", 'install_schedule': "green", 'install_complete': "purple",
        'as_schedule': "pink", 'as_complete': "purple", 'remoteas_complete': "purple"
    };
    if (mapping[t]) return mapping[t];
    if (t.includes("원격") && t.includes("완료")) return "purple";
    if (t.includes("A/S") || t.includes("AS")) return t.includes("완료") ? "purple" : "pink";
    if (t.includes("시공") || t.includes("설치")) return t.includes("완료") ? "purple" : "green";
    if (t.includes("구매")) return "purple";
    if (t.includes("시연")) return t.includes("완료") ? "purple" : "blue";
    if (t.includes("문의")) return "purple";
    return "purple";
};

/**
 * Utility: Standardized file display names (v123.70)
 */
const getTeasyTimelineFileName = (customerName: string, category: string, date: string, index?: number, total?: number) => {
    const reportDate = (date || "").split(" ")[0].replace(/[-\/]/g, "");
    const cleanCustomer = (customerName || "고객").split('_')[0];
    const suffix = (total && total > 1 && index !== undefined) ? `_${index + 1}` : "";
    return `${cleanCustomer}_${category}_${reportDate}${suffix}`;
};

interface ContentItem {
    label: string;
    value: any;
    isHighlight?: boolean;
    isSubItem?: boolean;
    isFirstSubItem?: boolean;
}

export const TimelineCard = ({
    item,
    onCardClick,
    onTitleClick
}: {
    item: TimelineItem & { count?: number };
    onCardClick?: () => void;
    onTitleClick?: () => void;
}) => {
    const { isOpen: isPhotosOpen, onOpen: onPhotosOpen, onClose: onPhotosClose } = useDisclosure();
    const content = { ...item, ...(item.content || {}) };
    const sitePhotos = content.photos || [];

    const prepareFiles = (rawFiles: any[], typeLabel: string) => {
        const isWorkReport = (item.stepType || "").includes("install") || (item.stepType || "").includes("as");
        const category = typeLabel === '사진'
            ? (isWorkReport ? '시공사진' : '현장사진')
            : (typeLabel === '견적' ? '견적서' : typeLabel);

        return rawFiles.map((f: any, i: number) => ({
            ...(typeof f === 'string' ? { url: f } : f),
            displayName: getTeasyTimelineFileName(item.customerName || "고객", category, item.createdAt || "", i, rawFiles.length)
        }));
    };

    const otherFiles = prepareFiles(content.quotes || [], "견적");
    const photosFiles = prepareFiles(sitePhotos, "사진");

    const renderContent = () => {
        const stepType = item.stepType;

        // Common items for all cards - Ordered by form top-to-bottom
        const commonItems: ContentItem[] = [
            { label: "일시", value: content.date || "-" },
            { label: "담당", value: item.managerName || item.createdByName }
        ];

        // Type specific items
        const specificItems: ContentItem[] = [];

        if (stepType === 'inquiry') {
            const hasNickname = content.nickname && content.channel !== "전화 문의";
            if (content.channel) {
                specificItems.push({
                    label: "채널",
                    value: `${content.channel}${hasNickname ? ` (${content.nickname})` : ""}`
                });
            }

            if (content.channel === "전화 문의" && content.phone) {
                specificItems.push({ label: "전화", value: content.phone, isSubItem: true, isFirstSubItem: true });
            }

            if (content.product) {
                const displayProduct = (content.product || "").toString().toLowerCase() === "crm" ? "CRM" : content.product;
                specificItems.push({ label: "상품", value: displayProduct });
            }
            if (content.result) {
                specificItems.push({ label: "결과", value: content.result });
            }
        } else if (stepType === 'purchase_confirm') {
            const categoryLabel = content.productCategory === "product" ? "시공" : (content.productCategory === "inventory" ? "배송" : "");

            const validProducts = (content.selectedProducts || []).filter((p: any) => p.name && p.name.trim() !== "");
            if (validProducts.length > 0) {
                const productList = validProducts.map((p: any, idx: number) => {
                    const circle = validProducts.length > 1 ? String.fromCharCode(9312 + idx) : "";
                    const rawName = p.name || "";
                    const cleanName = rawName.toLowerCase() === "crm" ? "CRM" : rawName;
                    return `${circle}${cleanName} × ${p.quantity}`;
                }).join("\n");

                specificItems.push({
                    label: "상품",
                    value: (
                        <HStack spacing={2} display="inline-flex" align="top">
                            {categoryLabel && (
                                <Box
                                    as="span"
                                    bg="gray.100"
                                    color="gray.500"
                                    fontSize="10px"
                                    px={1.5}
                                    h="18px"
                                    borderRadius="4px"
                                    fontWeight="bold"
                                    display="flex"
                                    alignItems="center"
                                    flexShrink={0}
                                    mt="2px"
                                >
                                    {categoryLabel}
                                </Box>
                            )}
                            <Text as="span" whiteSpace="pre-wrap" lineHeight="1.6"><ThinParen text={productList} /></Text>
                        </HStack>
                    )
                });
            } else if (content.product) {
                let displayProduct = (content.product || "").toString().toLowerCase() === "crm" ? "CRM" : content.product;
                // Clean legacy single-item circle if it's the only one
                if (displayProduct.startsWith("①") && !displayProduct.includes("②")) {
                    displayProduct = displayProduct.substring(1).trim();
                }
                specificItems.push({
                    label: "상품",
                    value: (
                        <HStack spacing={2} display="inline-flex" align="center">
                            {categoryLabel && (
                                <Box
                                    as="span"
                                    bg="gray.100"
                                    color="gray.500"
                                    fontSize="10px"
                                    px={1.5}
                                    h="18px"
                                    borderRadius="4px"
                                    fontWeight="bold"
                                    display="flex"
                                    alignItems="center"
                                    flexShrink={0}
                                >
                                    {categoryLabel}
                                </Box>
                            )}
                            <Text as="span"><ThinParen text={displayProduct} /></Text>
                        </HStack>
                    )
                });
            }

            if (content.payMethod) {
                specificItems.push({ label: "결제", value: content.payMethod });
            }
            if (content.amount) {
                specificItems.push({ label: "금액", value: content.amount ? `${content.amount}원` : "-", isSubItem: true, isFirstSubItem: true });
            }

            // Integrated discount and ID display logic for better data consistency
            const hasDiscount = content.discount && content.discount !== "미적용";

            if (content.discountAmount) {
                const displayValue = hasDiscount
                    ? `${content.discount} (${content.discountAmount}원)`
                    : `${content.discountAmount}원`;

                specificItems.push({
                    label: "할인",
                    value: displayValue,
                    isSubItem: true
                });
            }

            if (content.userId) {
                const displayValue = hasDiscount
                    ? `${content.discount} (${content.userId})`
                    : `(${content.userId})`;

                specificItems.push({
                    label: "할인",
                    value: displayValue,
                    isSubItem: true
                });
            }

            if (hasDiscount && !content.discountAmount && !content.userId) {
                specificItems.push({ label: "할인", value: content.discount, isSubItem: true });
            }

            // 배송 정보 (고도화 반영: 계층 구조 적용)
            if (content.productCategory === 'inventory' && content.deliveryInfo) {
                const { courier, trackingNumber, shipmentDate, deliveryAddress } = content.deliveryInfo;
                const datePart = (shipmentDate || "").split(" ")[0];

                // 1. 주요 배송 정보 (날짜 + 주소)
                if (datePart || deliveryAddress) {
                    const separator = (datePart && deliveryAddress) ? "  /  " : "";
                    specificItems.push({
                        label: "배송",
                        value: `${datePart}${separator}${deliveryAddress || ""}`
                    });
                }

                // 2. 상세 정보 (업체)
                if (courier) {
                    specificItems.push({
                        label: "업체",
                        value: courier,
                        isSubItem: true,
                        isFirstSubItem: true
                    });
                }

                // 3. 상세 정보 (송장)
                if (trackingNumber) {
                    specificItems.push({
                        label: "송장",
                        value: trackingNumber,
                        isSubItem: true,
                        isFirstSubItem: !courier
                    });
                }
            }
        } else {
            // Standard report types (Visits: Demo, Install, AS)
            // Only push items if they have valid values to prevent UI noise and crashes
            if (content.location && stepType !== 'remoteas_complete') {
                const locationLabel = (stepType === 'demo_schedule' || stepType === 'demo_complete') ? "주소" : ((stepType || "").includes("schedule") ? "장소" : "방문처");
                specificItems.push({ label: locationLabel, value: content.location });
            }

            // Phone and Product
            if (content.phone) {
                specificItems.push({ label: "전화", value: formatPhone(content.phone) });
            }
            const validProducts = (content.selectedProducts || []).filter((p: any) => p.name && p.name.trim() !== "");
            if (validProducts.length > 0) {
                const productList = validProducts.map((p: any, idx: number) => {
                    const circle = validProducts.length > 1 ? String.fromCharCode(9312 + idx) : "";
                    return `${circle}${p.name} × ${p.quantity}`;
                }).join("\n");

                specificItems.push({
                    label: "상품",
                    value: <Text whiteSpace="pre-wrap" lineHeight="1.6" verticalAlign="top"><ThinParen text={productList} /></Text>
                });
            } else if (content.product) {
                let displayProduct = (content.product || "").toString().toLowerCase() === "crm" ? "CRM" : content.product;
                // Clean legacy single-item circle
                if (displayProduct.startsWith("①") && !displayProduct.includes("②")) {
                    displayProduct = displayProduct.substring(1).trim();
                }
                specificItems.push({ label: "상품", value: displayProduct });
            }

            // 시공/AS 물품 (v124.2 고도화: 원형 숫자 조건부 표시 및 줄바꿈 적용)
            const supplies = content.content?.selectedSupplies || content.selectedSupplies;
            const validSupplies = (Array.isArray(supplies) ? supplies : []).filter((s: any) => s.name && s.name.trim() !== "");
            if (validSupplies.length > 0) {
                const displaySupplies = validSupplies.map((s: any, idx: number) => {
                    const circle = validSupplies.length > 1 ? String.fromCharCode(9312 + idx) : "";
                    return `${circle}${s.name} × ${s.quantity}`;
                }).join("\n");

                specificItems.push({
                    label: "물품",
                    value: <Text whiteSpace="pre-wrap" lineHeight="1.6" verticalAlign="top"><ThinParen text={displaySupplies} /></Text>
                });
            }

            // Results
            if (content.result) {
                specificItems.push({ label: "결과", value: content.result });
            }

            // 시공 Task (표준 그레이 배지 적용)
            if (stepType === 'install_schedule') {
                const before = (content.tasksBefore || []).filter((t: string) => t.trim() !== "");
                const after = (content.tasksAfter || []).filter((t: string) => t.trim() !== "");

                if (before.length > 0 || after.length > 0) {
                    const taskLines: React.ReactNode[] = [];

                    // Render Before Tasks
                    before.forEach((t: string, i: number) => {
                        let taskText = t;
                        if (before.length === 1 && taskText.startsWith("①") && !taskText.includes("②")) {
                            taskText = taskText.substring(1).trim();
                        }
                        const circle = before.length > 1 ? String.fromCharCode(9312 + i) : "";
                        taskLines.push(
                            <HStack key={`before-${i}`} align="start" spacing={2} w="full">
                                <Box w="46px" flexShrink={0}>
                                    {i === 0 && (
                                        <Box bg="gray.100" color="gray.500" fontSize="10px" px={1.5} h="18px" borderRadius="4px" display="flex" alignItems="center" justifyContent="center" fontWeight="bold">
                                            시공 전
                                        </Box>
                                    )}
                                </Box>
                                <Text fontSize="sm" whiteSpace="pre-wrap" lineHeight="1.6" flex={1}>
                                    <ThinParen text={`${circle}${taskText}`} />
                                </Text>
                            </HStack>
                        );
                    });

                    // Spacer between Before and After groups
                    if (before.length > 0 && after.length > 0) {
                        taskLines.push(<Box key="spacer" h={0} />);
                    }

                    // Render After Tasks
                    after.forEach((t: string, i: number) => {
                        let taskText = t;
                        if (after.length === 1 && taskText.startsWith("①") && !taskText.includes("②")) {
                            taskText = taskText.substring(1).trim();
                        }
                        const circle = after.length > 1 ? String.fromCharCode(9312 + i) : "";
                        taskLines.push(
                            <HStack key={`after-${i}`} align="start" spacing={2} w="full">
                                <Box w="46px" flexShrink={0}>
                                    {i === 0 && (
                                        <Box bg="gray.100" color="gray.500" fontSize="10px" px={1.5} h="18px" borderRadius="4px" display="flex" alignItems="center" justifyContent="center" fontWeight="bold">
                                            시공 후
                                        </Box>
                                    )}
                                </Box>
                                <Text fontSize="sm" whiteSpace="pre-wrap" lineHeight="1.6" flex={1}>
                                    <ThinParen text={`${circle}${taskText}`} />
                                </Text>
                            </HStack>
                        );
                    });

                    specificItems.push({
                        label: "업무",
                        value: (
                            <VStack align="start" spacing={0} w="full" mt="1px">
                                {taskLines}
                            </VStack>
                        )
                    });
                }
            }

            // 시연 완료(demo_complete) 특화: 괄호(Parentheses) 방식 복구
            if (stepType === 'demo_complete') {
                if (content.discountType) {
                    const displayValue = (content.discountType === "할인 없음" || content.discountType === "할인 제안하지 않음" || content.discountType === "해당 없음")
                        ? "할인 없음"
                        : `${content.discountType}${content.discountValue ? ` (${content.discountValue})` : ""}`;

                    specificItems.push({
                        label: "제안",
                        value: displayValue
                    });
                }
            }
        }

        const allItems = [...commonItems, ...specificItems];
        const recordingFiles = (content.recordings || []).map((f: any, i: number) => ({
            url: typeof f === 'string' ? f : (f.url || ""),
            displayName: getTeasyTimelineFileName(item.customerName || "고객", "녹취", item.createdAt || "", i, (content.recordings || []).length)
        }));


        return (
            <VStack align="start" spacing={2.5} w="full">
                <Flex gap={8} w="full" align="stretch">
                    {/* Left: Info List */}
                    <VStack
                        align="start"
                        spacing={1.5}
                        flex={3}
                        fontSize="sm"
                        color="gray.600"
                        lineHeight="1.6"
                    >
                        {allItems.map((itm: any, idx) => {
                            const isPhone = itm.label === "전화";
                            const isPhoneInquiry = content.channel === "전화 문의";
                            const isManager = itm.label === "담당";
                            const isPartner = isManager && item.managerRole === "partner";
                            const isBanned = isManager && item.managerRole === "banned";

                            return (
                                <Box key={idx} w="full">
                                    <TimelineInfoItem
                                        label={itm.label}
                                        value={
                                            <HStack spacing={2} display="inline-flex" align="center">
                                                <Text as="span" color={isBanned ? "gray.400" : "gray.600"}>
                                                    {typeof itm.value === 'string' ? <ThinParen text={itm.value} /> : itm.value}
                                                    {isBanned && <Text as="span" ml={1}><ThinParen text="(퇴)" /></Text>}
                                                </Text>
                                                {isPartner && !isBanned && (
                                                    <Badge
                                                        bg="yellow.400"
                                                        color="white"
                                                        fontSize="10px"
                                                        px={1.5}
                                                        borderRadius="full"
                                                        variant="solid"
                                                    >
                                                        협력사
                                                    </Badge>
                                                )}
                                            </HStack>
                                        }
                                        isHighlight={itm.isHighlight && !isBanned}
                                        isSubItem={itm.isSubItem}
                                        isFirstSubItem={itm.isFirstSubItem}
                                    />
                                    {isPhone && isPhoneInquiry && (
                                        <TimelineFileList
                                            files={recordingFiles}
                                            label="녹취"
                                            isSubItem={true}
                                            isFirstSubItem={false}
                                            uploader={item.createdByName}
                                            timestamp={item.createdAt}
                                        />
                                    )}
                                </Box>
                            );
                        })}


                        {otherFiles.length > 0 && (
                            <TimelineFileList
                                files={otherFiles}
                                label="견적"
                                isSubItem={false}
                                uploader={item.createdByName}
                                timestamp={item.createdAt}
                            />
                        )}

                        {photosFiles.length > 0 && (
                            <TimelineFileList
                                files={photosFiles}
                                label="사진"
                                isSubItem={false}
                                uploader={item.createdByName}
                                timestamp={item.createdAt}
                            />
                        )}
                    </VStack>

                    {/* Right: Memo Box */}
                    {content.memo && content.memo.trim() !== "" && (
                        <Box
                            flex={2}
                            bg="gray.50"
                            borderRadius="xl"
                            border="1px"
                            borderColor="gray.100"
                            display="flex"
                            flexDirection="column"
                            overflow="hidden"
                        >
                            <Box px={4} py={2.5} bg="gray.50">
                                <Text fontSize="xs" color="gray.500" fontWeight="bold">
                                    · 참고사항
                                </Text>
                            </Box>
                            <Box
                                flex={1}
                                p={4}
                                overflowY="auto"
                                css={{
                                    '&::-webkit-scrollbar': { width: '4px' },
                                    '&::-webkit-scrollbar-track': { background: 'transparent' },
                                    '&::-webkit-scrollbar-thumb': {
                                        background: 'rgba(0,0,0,0.08)',
                                        borderRadius: '10px'
                                    },
                                    '&::-webkit-scrollbar-thumb:hover': { background: 'rgba(0,0,0,0.15)' },
                                }}
                            >
                                <Text
                                    fontSize="sm"
                                    color="gray.600"
                                    fontWeight="medium"
                                    whiteSpace="pre-wrap"
                                    lineHeight="1.6"
                                >
                                    {content.memo}
                                </Text>
                            </Box>
                        </Box>
                    )}
                </Flex>
            </VStack>
        );
    };

    return (
        <Box
            bg="white"
            p={6}
            borderRadius="2xl"
            border="1px"
            borderColor="gray.100"
            shadow="sm"
            position="relative"
            onClick={onCardClick}
            cursor={onCardClick ? "pointer" : "default"}
        >
            <Flex w="full" align="center" mb={4} gap={8}>
                <Box flex={3}>
                    <TimelineBadge
                        label={STEP_LABELS[item.stepType]}
                        colorScheme={getBadgeColor(item.stepType)}
                        count={item.count}
                        onClick={(e: any) => {
                            e.stopPropagation();
                            onTitleClick?.();
                        }}
                    />
                </Box>
                <VStack align="end" spacing={0.5} flex={2}>
                    <Text fontSize="xs" color="gray.400" fontWeight="medium" whiteSpace="pre-wrap">
                        {(item.createdAt || "").replace(/\s+/g, "  ").replace(/\//g, "-")}
                    </Text>
                    {item.createdByName && (
                        <Text fontSize="xs" color="gray.400" fontWeight="medium">
                            {item.createdByName}
                        </Text>
                    )}
                </VStack>
            </Flex>
            {renderContent()}

            {sitePhotos.length > 0 && (
                <TeasyUniversalViewer
                    isOpen={isPhotosOpen}
                    onClose={onPhotosClose}
                    files={photosFiles}
                />
            )}
        </Box>
    );
};
