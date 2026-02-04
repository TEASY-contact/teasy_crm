import React from "react";
import { Box, Flex, Text, VStack, HStack, Badge } from "@chakra-ui/react";
import { TimelineItem } from "@/types/timeline";
import { TimelineBadge, TimelineInfoItem, TimelineFileList, ThinParen, TeasyButton, TeasyUniversalViewer, triggerTeasyDownload } from "@/components/common/UIComponents";
import { formatPhone, formatAmount } from "@/utils/formatter";
import { useDisclosure } from "@chakra-ui/react";
import { useState } from "react";
import { getTeasyStandardFileName } from "@/utils/textFormatter";

const STEP_LABELS: Record<string, string> = {
    inquiry: "신규 문의", demo_schedule: "시연 확정", demo_complete: "시연 완료",
    purchase_confirm: "구매 확정", install_schedule: "시공 확정", install_complete: "시공 완료",
    as_schedule: "방문 A/S 확정", as_complete: "방문 A/S 완료", remoteas_complete: "원격 A/S 완료",
    customer_registered: "고객 등록"
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

interface ContentItem {
    label: string;
    value: any;
    isHighlight?: boolean;
    isSubItem?: boolean;
    isFirstSubItem?: boolean;
    isCustomValue?: boolean;
    pl?: string;
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
    const [isTaxInvoiceViewerOpen, setTaxInvoiceViewerOpen] = useState(false);
    const content = { ...item, ...(item.content || {}) };

    // Aggressive deduplication by base URL to ignore token differences (v124.75)
    const deduplicate = (list: any[]) => {
        const seen = new Set();
        return (list || []).filter(f => {
            const url = typeof f === 'string' ? f : f?.url;
            if (!url) return false;
            // Normalize by removing query params (tokens)
            const baseUrl = url.split('?')[0].trim();
            if (seen.has(baseUrl)) return false;
            seen.add(baseUrl);
            return true;
        });
    };

    const sitePhotos = deduplicate(content.photos);
    const quotes = deduplicate(content.quotes);
    const recordings = deduplicate(content.recordings);
    const commitments = deduplicate(content.commitmentFiles);
    const collectionVideo = content.collectionVideo ? [content.collectionVideo] : [];
    const reinstallVideo = content.reinstallationVideo ? [content.reinstallationVideo] : [];

    const prepareFiles = (rawFiles: any[], typeLabel: string) => {
        const isWorkReport = (item.stepType || "").includes("install") || (item.stepType || "").includes("as");
        const category = typeLabel === '사진'
            ? (isWorkReport ? '시공사진' : '현장사진')
            : (typeLabel === '견적' ? '견적서' : typeLabel);

        return rawFiles.map((f: any, i: number) => ({
            ...(typeof f === 'string' ? { url: f } : f),
            displayName: getTeasyStandardFileName(item.customerName || "고객", category, content.date || "", i, rawFiles.length)
        }));
    };

    const otherFiles = prepareFiles(quotes, "견적");
    const photosFiles = prepareFiles(sitePhotos, "사진");
    const commitmentFiles = prepareFiles(commitments, "시공확약서");
    const collectionVideoFiles = prepareFiles(collectionVideo, "수거전동영상");
    const reinstallVideoFiles = prepareFiles(reinstallVideo, "설치후동영상");
    const taxInvoiceFiles = prepareFiles(content.taxInvoice ? [content.taxInvoice] : [], "전자세금계산서");

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
                specificItems.push({ label: "전화", value: formatPhone(content.phone), isSubItem: true, isFirstSubItem: true });
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
                                <Box as="span" bg="gray.100" color="gray.500" fontSize="10px" px={1.5} h="18px" borderRadius="4px" fontWeight="bold" display="flex" alignItems="center" flexShrink={0} mt="2px">
                                    {categoryLabel}
                                </Box>
                            )}
                            <Text as="span" whiteSpace="pre-wrap" lineHeight="1.6"><ThinParen text={productList} /></Text>
                        </HStack>
                    )
                });
            } else if (content.product) {
                let displayProduct = (content.product || "").toString().toLowerCase() === "crm" ? "CRM" : content.product;
                if (displayProduct.startsWith("①") && !displayProduct.includes("②")) {
                    displayProduct = displayProduct.substring(1).trim();
                }
                specificItems.push({
                    label: "상품",
                    value: (
                        <HStack spacing={2} display="inline-flex" align="top">
                            {categoryLabel && (
                                <Box as="span" bg="gray.100" color="gray.500" fontSize="10px" px={1.5} h="18px" borderRadius="4px" fontWeight="bold" display="flex" alignItems="center" flexShrink={0}>
                                    {categoryLabel}
                                </Box>
                            )}
                            <Text as="span" whiteSpace="pre-wrap" lineHeight="1.6">{displayProduct}</Text>
                        </HStack>
                    )
                });
            }
            if (content.payMethod) {
                specificItems.push({ label: "결제", value: content.payMethod });
            }
            if (content.amount) {
                specificItems.push({ label: "금액", value: `${formatAmount(String(content.amount))}원`, isSubItem: true, isFirstSubItem: true });
            }
            const hasDiscount = content.discount && content.discount !== "미적용";
            if (content.discountAmount) {
                const formattedVal = formatAmount(String(content.discountAmount), true);
                const displayValue = hasDiscount ? `${content.discount} (${formattedVal}원)` : `${formattedVal}원`;
                specificItems.push({ label: "할인", value: displayValue, isSubItem: true, isFirstSubItem: !content.amount });
            }
            if (content.userId) {
                const displayValue = hasDiscount ? `${content.discount} (${content.userId})` : `(${content.userId})`;
                specificItems.push({ label: "할인", value: displayValue, isSubItem: true, isFirstSubItem: !content.amount && !content.discountAmount });
            }
            if (hasDiscount && !content.discountAmount && !content.userId) {
                specificItems.push({ label: "할인", value: content.discount, isSubItem: true, isFirstSubItem: !content.amount });
            }
            const isAmountPresent = !!content.amount;
            const isDiscountPresent = hasDiscount || !!content.discountAmount || !!content.userId;
            if (taxInvoiceFiles.length > 0 && content.payMethod === '입금') {
                specificItems.push({
                    label: "증빙",
                    value: (
                        <TimelineFileList
                            files={taxInvoiceFiles}
                            label="증빙"
                            isSubItem={true}
                            isFirstSubItem={!isAmountPresent && !isDiscountPresent}
                            uploader={item.createdByName}
                            timestamp={item.createdAt}
                        />
                    ),
                    isCustomValue: true
                });
            }
            if (content.productCategory === 'inventory' && content.deliveryInfo) {
                const { courier, trackingNumber, shipmentDate, deliveryAddress } = content.deliveryInfo;
                const datePart = (shipmentDate || "").split(" ")[0];
                if (datePart || deliveryAddress) {
                    const separator = (datePart && deliveryAddress) ? "  /  " : "";
                    specificItems.push({ label: "배송", value: `${datePart}${separator}${deliveryAddress || ""}` });
                }
                if (courier) {
                    specificItems.push({ label: "업체", value: courier, isSubItem: true, isFirstSubItem: true });
                }
                if (trackingNumber) {
                    specificItems.push({ label: "송장", value: trackingNumber, isSubItem: true, isFirstSubItem: !courier });
                }
            }
        } else {
            // Standard report types (Visits: Demo, Install, AS)
            const isAsFlow = (stepType || "").includes("as_");
            const isInstallFlow = stepType === 'install_schedule' || stepType === 'install_complete';
            const isCompleteMode = stepType === 'install_complete' || stepType === 'as_complete';

            // 1. asType (Visit Type) - CRITICAL: Should be shown first for AS reports
            if (isAsFlow && content.asType) {
                specificItems.push({ label: "유형", value: content.asType });
            }

            if (content.location && stepType !== 'remoteas_complete') {
                const isAS = (stepType || "").includes("as_");
                const locationLabel = (stepType === 'install_complete' || stepType === 'demo_schedule' || stepType === 'demo_complete' || isAS)
                    ? "주소"
                    : (((stepType || "").includes("schedule") ? "장소" : "방문처"));
                specificItems.push({ label: locationLabel, value: content.location });
            }
            if (content.phone) {
                specificItems.push({ label: "전화", value: formatPhone(content.phone) });
            }
            const validProducts = (content.selectedProducts || []).filter((p: any) => p.name && p.name.trim() !== "");
            const productLabel = (stepType === 'as_complete' || stepType === 'as_schedule') ? "점검" : "상품";
            if (validProducts.length > 0) {
                const productList = validProducts.map((p: any, idx: number) => {
                    const circle = validProducts.length > 1 ? String.fromCharCode(9312 + idx) : "";
                    return `${circle}${p.name} × ${p.quantity}`;
                }).join("\n");
                specificItems.push({
                    label: productLabel,
                    value: <Text whiteSpace="pre-wrap" lineHeight="1.6" verticalAlign="top"><ThinParen text={productList} /></Text>
                });
            } else if (content.product) {
                let displayProduct = (content.product || "").toString().toLowerCase() === "crm" ? "CRM" : content.product;
                if (displayProduct.startsWith("①") && !displayProduct.includes("②")) {
                    displayProduct = displayProduct.substring(1).trim();
                }
                specificItems.push({ label: productLabel, value: displayProduct });
            }

            // Symptoms
            const rawSymptoms = content.symptoms || [];
            if (Array.isArray(rawSymptoms) && rawSymptoms.length > 0) {
                const isChecklist = typeof rawSymptoms[0] === 'object' && rawSymptoms[0] !== null && 'text' in rawSymptoms[0];
                if (isChecklist && stepType === 'as_complete') {
                    const symptomLines = rawSymptoms.map((s: any, i: number) => {
                        const circle = rawSymptoms.length > 1 ? String.fromCharCode(9312 + i) : "";
                        const completed = s.completed ?? false;
                        return (
                            <HStack key={`symptom-${i}`} align="start" spacing={1.5} w="full">
                                <Box w="20px" flexShrink={0} display="flex" justifyContent="center">
                                    <Box
                                        bg={completed ? "blue.50" : "red.50"} color={completed ? "blue.500" : "red.500"}
                                        fontSize="10px" fontWeight="900" w="15px" h="15px" borderRadius="3px"
                                        display="flex" alignItems="center" justifyContent="center" mt="4px"
                                    >
                                        {completed ? "✓" : "✕"}
                                    </Box>
                                </Box>
                                <Text fontSize="sm" whiteSpace="pre-wrap" lineHeight="1.6" flex={1}>
                                    <ThinParen text={`${circle}${s.text}`} />
                                </Text>
                            </HStack>
                        );
                    });
                    specificItems.push({
                        label: "증상",
                        value: <VStack align="start" spacing={0} w="full" mt="1px">{symptomLines}</VStack>
                    });
                } else {
                    const validSymptoms = rawSymptoms.filter((s: any) => (typeof s === 'string' ? s : s.text) && (typeof s === 'string' ? s : s.text).trim() !== "");
                    if (validSymptoms.length > 0) {
                        const symptomList = validSymptoms.map((s: any, idx: number) => {
                            const text = typeof s === 'string' ? s : s.text;
                            const circle = validSymptoms.length > 1 ? String.fromCharCode(9312 + idx) : "";
                            return `${circle}${text}`;
                        }).join("\n");
                        specificItems.push({
                            label: "증상",
                            value: <Text whiteSpace="pre-wrap" lineHeight="1.6" verticalAlign="top"><ThinParen text={symptomList} /></Text>
                        });
                    }
                }
            }

            // [Visit A/S Complete Only] 점검 불가 사유 (Symptoms)
            if (stepType === 'as_complete' && content.symptomIncompleteReason) {
                specificItems.push({
                    label: (
                        <Box bg="red.50" color="red.500" fontSize="10px" px={1.5} h="18px" borderRadius="4px" display="inline-flex" alignItems="center" justifyContent="center" fontWeight="bold" mt="-2px" verticalAlign="middle">
                            사유
                        </Box>
                    ) as any,
                    value: content.symptomIncompleteReason,
                    isSubItem: true,
                    isFirstSubItem: true,
                    pl: "56px"
                });
            }


            if (content.result) {
                specificItems.push({ label: "결과", value: content.result });
            }

            // Tasks
            const isAsCompleteTask = stepType === 'as_complete';
            if (isInstallFlow || isAsFlow) {
                const mapTask = (t: any) => typeof t === 'string' ? t : (t?.text || "");
                const rawBefore = isAsFlow ? (content.tasks || []) : (content.tasksBefore || []);
                const rawAfter = isAsCompleteTask ? [] : (content.tasksAfter || []);
                const beforeTexts = rawBefore.map(mapTask).filter((t: string) => t.trim() !== "");
                const afterTexts = rawAfter.map(mapTask).filter((t: string) => t.trim() !== "");
                const totalTaskCount = beforeTexts.length + afterTexts.length;
                if (totalTaskCount > 0) {
                    const taskLines: React.ReactNode[] = [];
                    beforeTexts.forEach((t: string, i: number) => {
                        let taskText = t;
                        if (totalTaskCount === 1 && taskText.startsWith("①") && !taskText.includes("②")) {
                            taskText = taskText.substring(1).trim();
                        }
                        const circle = totalTaskCount > 1 ? String.fromCharCode(9312 + i) : "";
                        const completed = isCompleteMode ? (rawBefore[i]?.completed ?? false) : false;
                        taskLines.push(
                            <HStack key={`before-${i}`} align="start" spacing={1.5} w="full">
                                <Box w={isCompleteMode ? "20px" : "46px"} flexShrink={0} display="flex" justifyContent="center">
                                    {isCompleteMode ? (
                                        <Box
                                            bg={completed ? "blue.50" : "red.50"} color={completed ? "blue.500" : "red.500"}
                                            fontSize="10px" fontWeight="900" w="15px" h="15px" borderRadius="3px"
                                            display="flex" alignItems="center" justifyContent="center" mt="4px"
                                        >
                                            {completed ? "✓" : "✕"}
                                        </Box>
                                    ) : (
                                        i === 0 && (
                                            <Box bg="gray.100" color="gray.500" fontSize="10px" px={1.5} h="18px" borderRadius="4px" display="flex" alignItems="center" justifyContent="center" fontWeight="bold">
                                                시공 전
                                            </Box>
                                        )
                                    )}
                                </Box>
                                <Text fontSize="sm" whiteSpace="pre-wrap" lineHeight="1.6" flex={1}>
                                    <ThinParen text={`${circle}${taskText}`} />
                                </Text>
                            </HStack>
                        );
                    });
                    if (beforeTexts.length > 0 && afterTexts.length > 0) {
                        taskLines.push(<Box key="spacer" h={1} />);
                    }
                    afterTexts.forEach((t: string, i: number) => {
                        let taskText = t;
                        if (totalTaskCount === 1 && taskText.startsWith("①") && !taskText.includes("②")) {
                            taskText = taskText.substring(1).trim();
                        }
                        const circle = totalTaskCount > 1 ? String.fromCharCode(9312 + beforeTexts.length + i) : "";
                        const completed = isCompleteMode ? (rawAfter[i]?.completed ?? false) : false;
                        taskLines.push(
                            <HStack key={`after-${i}`} align="start" spacing={1.5} w="full">
                                <Box w={isCompleteMode ? "20px" : "46px"} flexShrink={0} display="flex" justifyContent="center">
                                    {isCompleteMode ? (
                                        <Box
                                            bg={completed ? "blue.50" : "red.50"} color={completed ? "blue.500" : "red.500"}
                                            fontSize="10px" fontWeight="900" w="15px" h="15px" borderRadius="3px"
                                            display="flex" alignItems="center" justifyContent="center" mt="4px"
                                        >
                                            {completed ? "✓" : "✕"}
                                        </Box>
                                    ) : (
                                        i === 0 && (
                                            <Box bg="gray.100" color="gray.500" fontSize="10px" px={1.5} h="18px" borderRadius="4px" display="flex" alignItems="center" justifyContent="center" fontWeight="bold">
                                                시공 후
                                            </Box>
                                        )
                                    )}
                                </Box>
                                <Text fontSize="sm" whiteSpace="pre-wrap" lineHeight="1.6" flex={1}>
                                    <ThinParen text={`${circle}${taskText}`} />
                                </Text>
                            </HStack>
                        );
                    });
                    const taskLabel = (stepType === 'as_complete' || stepType === 'install_complete') ? "결과" : "업무";
                    specificItems.push({
                        label: taskLabel,
                        value: (
                            <VStack align="start" spacing={0} w="full" mt="1px">
                                {taskLines}
                            </VStack>
                        )
                    });
                }
            }

            // [Visit A/S Complete Only] 수행 불가 사유
            if (stepType === 'as_complete' && content.taskIncompleteReason) {
                specificItems.push({
                    label: (
                        <Box bg="red.50" color="red.500" fontSize="10px" px={1.5} h="18px" borderRadius="4px" display="inline-flex" alignItems="center" justifyContent="center" fontWeight="bold" mt="-2px" verticalAlign="middle">
                            사유
                        </Box>
                    ) as any,
                    value: content.taskIncompleteReason,
                    isSubItem: true,
                    isFirstSubItem: true,
                    pl: "56px"
                });
            }

            // Supplies (Moved here to be above Photos/Files)
            const supplies = content.content?.selectedSupplies || content.selectedSupplies;
            const validSupplies = (Array.isArray(supplies) ? supplies : []).filter((s: any) => s.name && s.name.trim() !== "");
            if (validSupplies.length > 0) {
                const displaySupplies = validSupplies.map((s: any, idx: number) => {
                    const circle = validSupplies.length > 1 ? String.fromCharCode(9312 + idx) : "";
                    return `${circle}${s.name} × ${s.quantity}`;
                }).join("\n");
                specificItems.push({
                    label: (stepType === 'install_complete' || stepType === 'as_complete') ? "사용" : ((stepType || "").includes("schedule") ? "준비" : "물품"),
                    value: <Text whiteSpace="pre-wrap" lineHeight="1.6" verticalAlign="top"><ThinParen text={displaySupplies} /></Text>
                });
            }

            if (isCompleteMode && content.incompleteReason && stepType !== 'as_complete') {
                specificItems.push({
                    label: (
                        <Box bg="red.50" color="red.500" fontSize="10px" px={1.5} h="18px" borderRadius="4px" display="inline-flex" alignItems="center" justifyContent="center" fontWeight="bold" mt="-2px" verticalAlign="middle">
                            사유
                        </Box>
                    ) as any,
                    value: content.incompleteReason,
                    isSubItem: true,
                    isFirstSubItem: true,
                    pl: "56px"
                });
            }

            if (stepType === 'demo_complete') {
                if (content.discountType) {
                    const displayValue = (content.discountType === "할인 없음" || content.discountType === "할인 제안하지 않음" || content.discountType === "해당 없음")
                        ? "할인 없음"
                        : `${content.discountType}${content.discountValue ? ` (${content.discountValue})` : ""}`;
                    specificItems.push({ label: "제안", value: displayValue });
                }
            }
            if (stepType === 'as_schedule') {
                const tasks = content.tasks || [];
                if (Array.isArray(tasks) && tasks.length > 0) {
                    const validTasks = tasks.filter((t: string) => t && t.trim() !== "");
                    if (validTasks.length > 0) {
                        const taskList = validTasks.map((t: string, idx: number) => {
                            const circle = validTasks.length > 1 ? String.fromCharCode(9312 + idx) : "";
                            return `${circle}${t}`;
                        }).join("\n");
                        specificItems.push({
                            label: "업무",
                            value: <Text whiteSpace="pre-wrap" lineHeight="1.6" verticalAlign="top"><ThinParen text={taskList} /></Text>
                        });
                    }
                }
            }
        }

        const allItems = [...commonItems, ...specificItems];
        const recordingFiles = recordings.map((f: any, i: number) => ({
            url: typeof f === 'string' ? f : (f.url || ""),
            displayName: getTeasyStandardFileName(item.customerName || "고객", "녹취", content.date || "", i, recordings.length)
        }));

        return (
            <VStack align="start" spacing={2.5} w="full">
                <Flex gap={8} w="full" align="stretch">
                    <VStack align="start" spacing={1.5} flex={3} fontSize="sm" color="gray.600" lineHeight="1.6">
                        {allItems.map((itm: any, idx) => {
                            const isPhone = itm.label === "전화";
                            const isPhoneInquiry = content.channel === "전화 문의";
                            const isManager = itm.label === "담당";
                            const isPartner = isManager && item.managerRole === "partner";
                            const isBanned = isManager && item.managerRole === "banned";
                            return (
                                <Box key={idx} w="full">
                                    {itm.isCustomValue ? itm.value : (
                                        <>
                                            <TimelineInfoItem
                                                label={itm.label}
                                                value={
                                                    <HStack spacing={2} display="inline-flex" align="center">
                                                        <Text as="span" color={isBanned ? "gray.400" : "gray.600"}>
                                                            {typeof itm.value === 'string' ? <ThinParen text={itm.value} /> : itm.value}
                                                            {isBanned && <Text as="span" ml={1}><ThinParen text="(퇴)" /></Text>}
                                                        </Text>
                                                        {isPartner && !isBanned && (
                                                            <Badge bg="yellow.400" color="white" fontSize="10px" px={1.5} borderRadius="full" variant="solid">
                                                                협력사
                                                            </Badge>
                                                        )}
                                                    </HStack>
                                                }
                                                isHighlight={itm.isHighlight && !isBanned}
                                                isSubItem={itm.isSubItem}
                                                isFirstSubItem={itm.isFirstSubItem}
                                                pl={itm.pl}
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
                                        </>
                                    )}
                                </Box>
                            );
                        })}
                        {otherFiles.length > 0 && <TimelineFileList files={otherFiles} label="견적" isSubItem={false} uploader={item.createdByName} timestamp={item.createdAt} />}
                        {commitmentFiles.length > 0 && <TimelineFileList files={commitmentFiles} label="확약" isSubItem={false} uploader={item.createdByName} timestamp={item.createdAt} />}
                        {collectionVideoFiles.length > 0 && <TimelineFileList files={collectionVideoFiles} label="영상" isSubItem={false} uploader={item.createdByName} timestamp={item.createdAt} />}
                        {reinstallVideoFiles.length > 0 && <TimelineFileList files={reinstallVideoFiles} label="영상" isSubItem={false} uploader={item.createdByName} timestamp={item.createdAt} />}
                        {photosFiles.length > 0 && <TimelineFileList files={photosFiles} label="사진" isSubItem={false} uploader={item.createdByName} timestamp={item.createdAt} />}
                    </VStack>

                    {content.memo && content.memo.trim() !== "" && (
                        <Box flex={2} bg="gray.50" borderRadius="xl" border="1px" borderColor="gray.100" display="flex" flexDirection="column" overflow="hidden">
                            <Box px={4} py={2.5} bg="gray.50">
                                <Text fontSize="xs" color="gray.500" fontWeight="bold">· 참고사항</Text>
                            </Box>
                            <Box flex={1} p={4} overflowY="auto" css={{
                                '&::-webkit-scrollbar': { width: '4px' },
                                '&::-webkit-scrollbar-track': { background: 'transparent' },
                                '&::-webkit-scrollbar-thumb': { background: 'rgba(0,0,0,0.08)', borderRadius: '10px' },
                                '&::-webkit-scrollbar-thumb:hover': { background: 'rgba(0,0,0,0.15)' },
                            }}>
                                <Text fontSize="sm" color="gray.600" fontWeight="medium" whiteSpace="pre-wrap" lineHeight="1.6">{content.memo}</Text>
                            </Box>
                        </Box>
                    )}
                </Flex>
            </VStack>
        );
    };

    return (
        <Box
            bg="white" p={6} borderRadius="2xl" border="1px" borderColor="gray.100" shadow="sm" position="relative"
            onClick={onCardClick} cursor={onCardClick ? "pointer" : "default"}
        >
            <Flex w="full" align="center" mb={4} gap={8}>
                <Box flex={3}>
                    <TimelineBadge
                        label={STEP_LABELS[item.stepType]} colorScheme={getBadgeColor(item.stepType)} count={item.count}
                        onClick={(e: any) => { e.stopPropagation(); onTitleClick?.(); }}
                    />
                </Box>
                <VStack align="end" spacing={0.5} flex={2}>
                    <Text fontSize="xs" color="gray.400" fontWeight="medium" whiteSpace="pre">
                        <ThinParen text={(item.createdAt || "").replace(/\s+/g, "  ").replace(/\//g, "-")} />
                    </Text>
                    {item.createdByName && <Text fontSize="xs" color="gray.400" fontWeight="medium">{item.createdByName}</Text>}
                </VStack>
            </Flex>
            {renderContent()}

            {sitePhotos.length > 0 && (
                <TeasyUniversalViewer isOpen={isPhotosOpen} onClose={onPhotosClose} files={photosFiles} />
            )}
            {taxInvoiceFiles.length > 0 && (
                <TeasyUniversalViewer isOpen={isTaxInvoiceViewerOpen} onClose={() => setTaxInvoiceViewerOpen(false)} files={taxInvoiceFiles} title="증빙" />
            )}
        </Box>
    );
};
