import React from "react";
import { Box, Flex, Text, VStack, HStack, Badge } from "@chakra-ui/react";
import { TimelineItem } from "@/types/timeline";
import { TimelineBadge, TimelineInfoItem, TimelineFileList, ThinParen, TeasyButton, TeasyUniversalViewer } from "@/components/common/UIComponents";
import { formatPhone, formatAmount } from "@/utils/formatter";
import { useDisclosure } from "@chakra-ui/react";

const STEP_LABELS: Record<string, string> = {
    inquiry: "?좉퇋 臾몄쓽", demo_schedule: "?쒖뿰 ?뺤젙", demo_complete: "?쒖뿰 ?꾨즺",
    purchase_confirm: "援щℓ ?뺤젙", install_schedule: "?쒓났 ?뺤젙", install_complete: "?쒓났 ?꾨즺",
    as_schedule: "諛⑸Ц A/S ?뺤젙", as_complete: "諛⑸Ц A/S ?꾨즺", remoteas_complete: "?먭꺽 A/S ?꾨즺",
    customer_registered: "怨좉컼 ?깅줉"
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
    if (t.includes("?먭꺽") && t.includes("?꾨즺")) return "purple";
    if (t.includes("A/S") || t.includes("AS")) return t.includes("?꾨즺") ? "purple" : "pink";
    if (t.includes("?쒓났") || t.includes("?ㅼ튂")) return t.includes("?꾨즺") ? "purple" : "green";
    if (t.includes("援щℓ")) return "purple";
    if (t.includes("?쒖뿰")) return t.includes("?꾨즺") ? "purple" : "blue";
    if (t.includes("臾몄쓽")) return "purple";
    return "purple";
};

import { getTeasyStandardFileName } from "@/utils/textFormatter";

/**
 * Utility: Color mapping rule identical to MainDashboard.tsx (v123.70)
 */

interface ContentItem {
    label: string;
    value: any;
    isHighlight?: boolean;
    isSubItem?: boolean;
    isFirstSubItem?: boolean;
    isCustomValue?: boolean;
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

    const prepareFiles = (rawFiles: any[], typeLabel: string) => {
        const isWorkReport = (item.stepType || "").includes("install") || (item.stepType || "").includes("as");
        const category = typeLabel === '?ъ쭊'
            ? (isWorkReport ? '?쒓났?ъ쭊' : '?꾩옣?ъ쭊')
            : (typeLabel === '寃ъ쟻' ? '寃ъ쟻?? : typeLabel);

        return rawFiles.map((f: any, i: number) => ({
            ...(typeof f === 'string' ? { url: f } : f),
            displayName: getTeasyStandardFileName(item.customerName || "怨좉컼", category, content.date || "", i, rawFiles.length)
        }));
    };

    const otherFiles = prepareFiles(quotes, "寃ъ쟻");
    const photosFiles = prepareFiles(sitePhotos, "?ъ쭊");
    const taxInvoiceFiles = prepareFiles(content.taxInvoice ? [content.taxInvoice] : [], "?꾩옄?멸툑怨꾩궛??);

    const renderContent = () => {
        const stepType = item.stepType;

        // Common items for all cards - Ordered by form top-to-bottom
        const commonItems: ContentItem[] = [
            { label: "?쇱떆", value: content.date || "-" },
            { label: "?대떦", value: item.managerName || item.createdByName }
        ];

        // Type specific items
        const specificItems: ContentItem[] = [];

        if (stepType === 'inquiry') {
            const hasNickname = content.nickname && content.channel !== "?꾪솕 臾몄쓽";
            if (content.channel) {
                specificItems.push({
                    label: "梨꾨꼸",
                    value: `${content.channel}${hasNickname ? ` (${content.nickname})` : ""}`
                });
            }

            if (content.channel === "?꾪솕 臾몄쓽" && content.phone) {
                specificItems.push({ label: "?꾪솕", value: content.phone, isSubItem: true, isFirstSubItem: true });
            }

            if (content.product) {
                const displayProduct = (content.product || "").toString().toLowerCase() === "crm" ? "CRM" : content.product;
                specificItems.push({ label: "?곹뭹", value: displayProduct });
            }
            if (content.result) {
                specificItems.push({ label: "寃곌낵", value: content.result });
            }
        } else if (stepType === 'purchase_confirm') {
            const categoryLabel = content.productCategory === "product" ? "?쒓났" : (content.productCategory === "inventory" ? "諛곗넚" : "");

            const validProducts = (content.selectedProducts || []).filter((p: any) => p.name && p.name.trim() !== "");
            if (validProducts.length > 0) {
                const productList = validProducts.map((p: any, idx: number) => {
                    const circle = validProducts.length > 1 ? String.fromCharCode(9312 + idx) : "";
                    const rawName = p.name || "";
                    const cleanName = rawName.toLowerCase() === "crm" ? "CRM" : rawName;
                    return `${circle}${cleanName} 횞 ${p.quantity}`;
                }).join("\n");

                specificItems.push({
                    label: "?곹뭹",
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
                if (displayProduct.startsWith("??) && !displayProduct.includes("??)) {
                    displayProduct = displayProduct.substring(1).trim();
                }
                specificItems.push({
                    label: "?곹뭹",
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
                specificItems.push({ label: "寃곗젣", value: content.payMethod });
            }
            if (content.amount) {
                specificItems.push({ label: "湲덉븸", value: content.amount ? `${formatAmount(String(content.amount))}?? : "-", isSubItem: true, isFirstSubItem: true });
            }

            // Integrated discount and ID display logic for better data consistency
            const hasDiscount = content.discount && content.discount !== "誘몄쟻??;

            if (content.discountAmount) {
                const formattedVal = formatAmount(String(content.discountAmount), true);
                const displayValue = hasDiscount
                    ? `${content.discount} (${formattedVal}??`
                    : `${formattedVal}??;

                specificItems.push({
                    label: "?좎씤",
                    value: displayValue,
                    isSubItem: true
                });
            }

            if (content.userId) {
                const displayValue = hasDiscount
                    ? `${content.discount} (${content.userId})`
                    : `(${content.userId})`;

                specificItems.push({
                    label: "?좎씤",
                    value: displayValue,
                    isSubItem: true
                });
            }

            if (hasDiscount && !content.discountAmount && !content.userId) {
                specificItems.push({ label: "?좎씤", value: content.discount, isSubItem: true });
            }

            const isAmountPresent = !!content.amount;
            const isDiscountPresent = hasDiscount || !!content.discountAmount || !!content.userId;

            // Move Tax Invoice (利앸튃) below Discount (?좎씤)
            if (taxInvoiceFiles.length > 0 && content.payMethod === '?낃툑') {
                specificItems.push({
                    label: "利앸튃",
                    value: (
                        <TimelineFileList
                            files={taxInvoiceFiles}
                            label="利앸튃"
                            isSubItem={true}
                            isFirstSubItem={!isAmountPresent && !isDiscountPresent}
                            uploader={item.createdByName}
                            timestamp={item.createdAt}
                        />
                    ),
                    isCustomValue: true
                });
            }

            // 諛곗넚 ?뺣낫 (怨좊룄??諛섏쁺: 怨꾩링 援ъ“ ?곸슜)
            if (content.productCategory === 'inventory' && content.deliveryInfo) {
                const { courier, trackingNumber, shipmentDate, deliveryAddress } = content.deliveryInfo;
                const datePart = (shipmentDate || "").split(" ")[0];

                // 1. 二쇱슂 諛곗넚 ?뺣낫 (?좎쭨 + 二쇱냼)
                if (datePart || deliveryAddress) {
                    const separator = (datePart && deliveryAddress) ? "  /  " : "";
                    specificItems.push({
                        label: "諛곗넚",
                        value: `${datePart}${separator}${deliveryAddress || ""}`
                    });
                }

                // 2. ?곸꽭 ?뺣낫 (?낆껜)
                if (courier) {
                    specificItems.push({
                        label: "?낆껜",
                        value: courier,
                        isSubItem: true,
                        isFirstSubItem: true
                    });
                }

                // 3. ?곸꽭 ?뺣낫 (?≪옣)
                if (trackingNumber) {
                    specificItems.push({
                        label: "?≪옣",
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
                const locationLabel = (stepType === 'demo_schedule' || stepType === 'demo_complete') ? "二쇱냼" : ((stepType || "").includes("schedule") ? "?μ냼" : "諛⑸Ц泥?);
                specificItems.push({ label: locationLabel, value: content.location });
            }

            // Phone and Product
            if (content.phone) {
                specificItems.push({ label: "?꾪솕", value: formatPhone(content.phone) });
            }
            const validProducts = (content.selectedProducts || []).filter((p: any) => p.name && p.name.trim() !== "");
            if (validProducts.length > 0) {
                const productList = validProducts.map((p: any, idx: number) => {
                    const circle = validProducts.length > 1 ? String.fromCharCode(9312 + idx) : "";
                    return `${circle}${p.name} 횞 ${p.quantity}`;
                }).join("\n");

                specificItems.push({
                    label: "?곹뭹",
                    value: <Text whiteSpace="pre-wrap" lineHeight="1.6" verticalAlign="top"><ThinParen text={productList} /></Text>
                });
            } else if (content.product) {
                let displayProduct = (content.product || "").toString().toLowerCase() === "crm" ? "CRM" : content.product;
                // Clean legacy single-item circle
                if (displayProduct.startsWith("??) && !displayProduct.includes("??)) {
                    displayProduct = displayProduct.substring(1).trim();
                }
                specificItems.push({ label: "?곹뭹", value: displayProduct });
            }

            // ?쒓났/AS 臾쇳뭹 (v124.2 怨좊룄?? ?먰삎 ?レ옄 議곌굔遺 ?쒖떆 諛?以꾨컮轅??곸슜)
            const supplies = content.content?.selectedSupplies || content.selectedSupplies;
            const validSupplies = (Array.isArray(supplies) ? supplies : []).filter((s: any) => s.name && s.name.trim() !== "");
            if (validSupplies.length > 0) {
                const displaySupplies = validSupplies.map((s: any, idx: number) => {
                    const circle = validSupplies.length > 1 ? String.fromCharCode(9312 + idx) : "";
                    return `${circle}${s.name} 횞 ${s.quantity}`;
                }).join("\n");

                specificItems.push({
                    label: "臾쇳뭹",
                    value: <Text whiteSpace="pre-wrap" lineHeight="1.6" verticalAlign="top"><ThinParen text={displaySupplies} /></Text>
                });
            }

            // Results
            if (content.result) {
                specificItems.push({ label: "寃곌낵", value: content.result });
            }

            // ?쒓났 Task (?쒖? 洹몃젅??諛곗? ?곸슜)
            if (stepType === 'install_schedule') {
                const before = (content.tasksBefore || []).filter((t: string) => t.trim() !== "");
                const after = (content.tasksAfter || []).filter((t: string) => t.trim() !== "");

                if (before.length > 0 || after.length > 0) {
                    const taskLines: React.ReactNode[] = [];

                    // Render Before Tasks
                    before.forEach((t: string, i: number) => {
                        let taskText = t;
                        if (before.length === 1 && taskText.startsWith("??) && !taskText.includes("??)) {
                            taskText = taskText.substring(1).trim();
                        }
                        const circle = before.length > 1 ? String.fromCharCode(9312 + i) : "";
                        taskLines.push(
                            <HStack key={`before-${i}`} align="start" spacing={2} w="full">
                                <Box w="46px" flexShrink={0}>
                                    {i === 0 && (
                                        <Box bg="gray.100" color="gray.500" fontSize="10px" px={1.5} h="18px" borderRadius="4px" display="flex" alignItems="center" justifyContent="center" fontWeight="bold">
                                            ?쒓났 ??                                        </Box>
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
                        if (after.length === 1 && taskText.startsWith("??) && !taskText.includes("??)) {
                            taskText = taskText.substring(1).trim();
                        }
                        const circle = after.length > 1 ? String.fromCharCode(9312 + i) : "";
                        taskLines.push(
                            <HStack key={`after-${i}`} align="start" spacing={2} w="full">
                                <Box w="46px" flexShrink={0}>
                                    {i === 0 && (
                                        <Box bg="gray.100" color="gray.500" fontSize="10px" px={1.5} h="18px" borderRadius="4px" display="flex" alignItems="center" justifyContent="center" fontWeight="bold">
                                            ?쒓났 ??                                        </Box>
                                    )}
                                </Box>
                                <Text fontSize="sm" whiteSpace="pre-wrap" lineHeight="1.6" flex={1}>
                                    <ThinParen text={`${circle}${taskText}`} />
                                </Text>
                            </HStack>
                        );
                    });

                    specificItems.push({
                        label: "?낅Т",
                        value: (
                            <VStack align="start" spacing={0} w="full" mt="1px">
                                {taskLines}
                            </VStack>
                        )
                    });
                }
            }

            // ?쒖뿰 ?꾨즺(demo_complete) ?뱁솕: 愿꾪샇(Parentheses) 諛⑹떇 蹂듦뎄
            if (stepType === 'demo_complete') {
                if (content.discountType) {
                    const displayValue = (content.discountType === "?좎씤 ?놁쓬" || content.discountType === "?좎씤 ?쒖븞?섏? ?딆쓬" || content.discountType === "?대떦 ?놁쓬")
                        ? "?좎씤 ?놁쓬"
                        : `${content.discountType}${content.discountValue ? ` (${content.discountValue})` : ""}`;

                    specificItems.push({
                        label: "?쒖븞",
                        value: displayValue
                    });
                }
            }
        }

        const allItems = [...commonItems, ...specificItems];
        const recordingFiles = recordings.map((f: any, i: number) => ({
            url: typeof f === 'string' ? f : (f.url || ""),
            displayName: getTeasyStandardFileName(item.customerName || "怨좉컼", "?뱀랬", content.date || "", i, recordings.length)
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
                            const isPhone = itm.label === "?꾪솕";
                            const isPhoneInquiry = content.channel === "?꾪솕 臾몄쓽";
                            const isManager = itm.label === "?대떦";
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
                                                            {isBanned && <Text as="span" ml={1}><ThinParen text="(??" /></Text>}
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
                                                                ?묐젰??                                                            </Badge>
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
                                                    label="?뱀랬"
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


                        {otherFiles.length > 0 && (
                            <TimelineFileList
                                files={otherFiles}
                                label="寃ъ쟻"
                                isSubItem={false}
                                uploader={item.createdByName}
                                timestamp={item.createdAt}
                            />
                        )}

                        {photosFiles.length > 0 && (
                            <TimelineFileList
                                files={photosFiles}
                                label="?ъ쭊"
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
                                    쨌 李멸퀬?ы빆
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
