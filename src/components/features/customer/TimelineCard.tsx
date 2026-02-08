import React from "react";
import { Box, Flex, Text, VStack, HStack, Badge } from "@chakra-ui/react";
import { TimelineItem } from "@/types/timeline";
import { TimelineBadge, TimelineInfoItem, TimelineFileList, ThinParen, TeasyButton, TeasyUniversalViewer, triggerTeasyDownload } from "@/components/common/UIComponents";
import { formatPhone, formatAmount } from "@/utils/formatter";
import { useDisclosure } from "@chakra-ui/react";
import { useState } from "react";
import { getTeasyStandardFileName } from "@/utils/textFormatter";
import { deduplicateFiles } from "@/utils/reportPureUtils";

import { ModificationHistoryPanel } from "./timeline/ModificationHistoryPanel";
import { renderInquiryItems } from "./timeline/renderers/InquiryRenderer";
import { renderPurchaseConfirmItems } from "./timeline/renderers/PurchaseConfirmRenderer";
import { renderStandardReportItems } from "./timeline/renderers/StandardReportRenderer";
import { ContentItem } from "@/types/timeline";
import { STEP_LABELS, getBadgeColor, prepareFiles } from "./timeline/TimelineUtils";





export const TimelineCard = React.memo(({
    item,
    onCardClick,
    onTitleClick,
    variant = 'default',
    ...boxProps
}: {
    item: TimelineItem & { count?: number };
    onCardClick?: () => void;
    onTitleClick?: () => void;
    variant?: 'default' | 'preview';
} & React.ComponentProps<typeof Box>) => {
    const { isOpen: isPhotosOpen, onOpen: onPhotosOpen, onClose: onPhotosClose } = useDisclosure();
    const [isTaxInvoiceViewerOpen, setTaxInvoiceViewerOpen] = useState(false);

    // Optimize content derivation
    const content = React.useMemo(() => ({ ...item, ...(item.content || {}) }), [item]);

    // Optimize file deduplication
    const sitePhotos = React.useMemo(() => deduplicateFiles(content.photos), [content.photos]);
    const quotes = React.useMemo(() => deduplicateFiles(content.quotes), [content.quotes]);
    const recordings = React.useMemo(() => deduplicateFiles(content.recordings), [content.recordings]);
    const commitments = React.useMemo(() => deduplicateFiles(content.commitmentFiles), [content.commitmentFiles]);
    const collectionVideo = React.useMemo(() => content.collectionVideo ? [content.collectionVideo] : [], [content.collectionVideo]);
    const reinstallVideo = React.useMemo(() => content.reinstallationVideo ? [content.reinstallationVideo] : [], [content.reinstallationVideo]);

    // Optimize file preparation
    const otherFiles = React.useMemo(() => prepareFiles(quotes, "견적", item), [quotes, item]);
    const photosFiles = React.useMemo(() => prepareFiles(sitePhotos, "사진", item), [sitePhotos, item]);
    const commitmentFiles = React.useMemo(() => prepareFiles(commitments, "시공확약서", item), [commitments, item]);
    const collectionVideoFiles = React.useMemo(() => prepareFiles(collectionVideo, "수거전동영상", item), [collectionVideo, item]);
    const reinstallVideoFiles = React.useMemo(() => prepareFiles(reinstallVideo, "설치후동영상", item), [reinstallVideo, item]);
    const taxInvoiceFiles = React.useMemo(() => prepareFiles(content.taxInvoice ? [content.taxInvoice] : [], "전자세금계산서", item), [content.taxInvoice, item]);

    const renderContent = React.useMemo(() => {
        const stepType = item.stepType;
        const isPreview = variant === 'preview';

        // Common items for all cards - Ordered by form top-to-bottom
        const commonItems: ContentItem[] = [
            { label: "일시", value: content.date || "-" },
            { label: "담당", value: item.managerName || item.createdByName }
        ];

        // Type specific items
        let specificItems: ContentItem[] = [];

        if (stepType === 'inquiry') {
            specificItems = renderInquiryItems(content);
        } else if (stepType === 'purchase_confirm') {
            specificItems = renderPurchaseConfirmItems(item, content);
        } else {
            // Standard report types (Visits: Demo, Install, AS) and Others
            specificItems = renderStandardReportItems(item, content);
        }

        const allItems = [...commonItems, ...specificItems];
        const recordingFiles = recordings.map((f: any, i: number) => ({
            url: typeof f === 'string' ? f : (f.url || ""),
            displayName: getTeasyStandardFileName(item.customerName || "고객", "녹취", content.date || "", i, recordings.length)
        }));

        return (
            <VStack align="start" spacing={2.5} w="full">
                <Flex gap={isPreview ? 0 : 8} w="full" align="stretch">
                    <VStack align="start" spacing={1.5} flex={isPreview ? 1 : 3} fontSize="sm" color="gray.600" lineHeight="1.6">
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
                        {photosFiles.length > 0 && (
                            <TimelineFileList
                                files={photosFiles}
                                label={item.stepType === 'remoteas_complete' ? "PC사양" : "사진"}
                                isSubItem={false}
                                uploader={item.createdByName}
                                timestamp={item.createdAt}
                            />
                        )}
                        {isPreview && content.memo && (
                            <TimelineInfoItem label="참고" value={content.memo} />
                        )}
                    </VStack>

                    {!isPreview && ((content.memo && content.memo.trim() !== "") || (content.modificationHistory && content.modificationHistory.length > 0) || (content.content?.modificationHistory && content.content?.modificationHistory.length > 0)) && (
                        <Box flex={2} position="relative" minH="250px">
                            <Box position="absolute" top={0} left={0} right={0} bottom={0} bg="gray.50" borderRadius="xl" border="1px" borderColor="gray.100" overflow="hidden" display="flex" flexDirection="column">
                                <Box overflowY="auto" flex={1} css={{
                                    "&::-webkit-scrollbar": { width: "4px" },
                                    "&::-webkit-scrollbar-track": { background: "transparent" },
                                    "&::-webkit-scrollbar-thumb": { background: "rgba(0,0,0,0.05)", borderRadius: "10px" },
                                    "&:hover::-webkit-scrollbar-thumb": { background: "rgba(0,0,0,0.1)" }
                                }}>
                                    {content.memo && content.memo.trim() !== "" && (
                                        <Box>
                                            <Box px={4} py={2.5} bg="gray.50">
                                                <Text fontSize="sm" color="gray.500" fontWeight="medium">· 참고사항</Text>
                                            </Box>
                                            <Box p={4} pt={0}>
                                                <Text fontSize="sm" color="gray.600" fontWeight="medium" whiteSpace="pre-wrap" lineHeight="1.6">{content.memo}</Text>
                                            </Box>
                                        </Box>
                                    )}

                                    {((content.modificationHistory && content.modificationHistory.length > 0) || (content.content?.modificationHistory && content.content?.modificationHistory.length > 0)) && (
                                        <Box borderTop={content.memo && content.memo.trim() !== "" ? "1px" : "0px"} borderColor="gray.100">
                                            <ModificationHistoryPanel historyArr={content.modificationHistory || content.content?.modificationHistory || []} />
                                        </Box>
                                    )}
                                </Box>
                            </Box>
                        </Box>
                    )}
                </Flex>
            </VStack>
        );
    }, [item, content, recordings, otherFiles, photosFiles, commitmentFiles, collectionVideoFiles, reinstallVideoFiles, variant]);

    return (
        <Box
            bg="white" p={variant === 'preview' ? 3 : 6} borderRadius="2xl" border="1px" borderColor="gray.100" shadow="sm" position="relative"
            onClick={onCardClick} cursor={onCardClick ? "pointer" : "default"}
            {...boxProps}
        >
            {variant !== 'preview' && (
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
            )}
            {renderContent}

            {sitePhotos.length > 0 && (
                <TeasyUniversalViewer isOpen={isPhotosOpen} onClose={onPhotosClose} files={photosFiles} />
            )}
            {taxInvoiceFiles.length > 0 && (
                <TeasyUniversalViewer isOpen={isTaxInvoiceViewerOpen} onClose={() => setTaxInvoiceViewerOpen(false)} files={taxInvoiceFiles} title="증빙" />
            )}
        </Box>
    );
});
