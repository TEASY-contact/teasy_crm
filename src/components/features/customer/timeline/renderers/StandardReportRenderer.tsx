import React from "react";
import { Box, HStack, Text, VStack } from "@chakra-ui/react";
import { formatPhone } from "@/utils/formatter";
import { ThinParen } from "@/components/common/UIComponents";
import { ContentItem, TimelineItem } from "@/types/timeline";
import { ChecklistBadge } from "../ChecklistBadge";

// Note: TimelineCard internal import was:
// import { ChecklistBadge } from "./timeline/ChecklistBadge";
// It also imported ChecklistBadge (from UIComponents?) No wait:
// import { TimelineBadge, TimelineInfoItem, TimelineFileList, ThinParen, TeasyButton, TeasyUniversalViewer, triggerTeasyDownload } from "@/components/common/UIComponents";
// AND
// import { ChecklistBadge } from "./timeline/ChecklistBadge";
// Wait, in line 263 TimelineCard uses `ChecklistBadge`. Which one?
// Line 10: import { ChecklistBadge } from "./timeline/ChecklistBadge";
// Line 4: import { ..., TimelineBadge, ... } from "@/components/common/UIComponents";
// It seems the one in `../ChecklistBadge` is the correct one for the lists.

export const renderStandardReportItems = (item: TimelineItem, content: any): ContentItem[] => {
    const items: ContentItem[] = [];
    const stepType = item.stepType;

    // Standard report types (Visits: Demo, Install, AS)
    const isAsFlow = (stepType || "").includes("as_");
    const isInstallFlow = stepType === 'install_schedule' || stepType === 'install_complete';
    const isCompleteMode = stepType === 'install_complete' || stepType === 'as_complete';

    // 1. asType (Visit Type) - CRITICAL: Should be shown first for AS reports
    if (isAsFlow && content.asType) {
        items.push({ label: "유형", value: content.asType });
    }

    if (content.location && stepType !== 'remoteas_complete') {
        const isAS = (stepType || "").includes("as_");
        const locationLabel = (stepType === 'install_complete' || stepType === 'demo_schedule' || stepType === 'demo_complete' || isAS)
            ? "주소"
            : (((stepType || "").includes("schedule") ? "주소" : "방문처"));
        items.push({ label: locationLabel, value: content.location });
    }
    if (content.phone) {
        items.push({ label: "전화", value: formatPhone(content.phone) });
    }
    const validProducts = (content.selectedProducts || []).filter((p: any) => p.name && p.name.trim() !== "");
    const productLabel = (stepType === 'as_complete' || stepType === 'as_schedule' || stepType === 'remoteas_complete') ? "점검" : "상품";
    if (validProducts.length > 0) {
        const productList = validProducts.map((p: any, idx: number) => {
            const circle = validProducts.length > 1 ? String.fromCharCode(9312 + idx) : "";
            return `${circle}${p.name} × ${p.quantity}`;
        }).join("\n");
        items.push({
            label: productLabel,
            value: <Text whiteSpace="pre-wrap" lineHeight="1.6" verticalAlign="top"><ThinParen text={productList} /></Text>
        });
    } else if (content.product) {
        let displayProduct = (content.product || "").toString().toLowerCase() === "crm" ? "CRM" : content.product;
        if (displayProduct.startsWith("①") && !displayProduct.includes("②")) {
            displayProduct = displayProduct.substring(1).trim();
        }
        items.push({ label: productLabel, value: displayProduct });
    }

    // Symptoms
    const rawSymptoms = content.symptoms || [];
    if (Array.isArray(rawSymptoms) && rawSymptoms.length > 0) {
        const isChecklist = typeof rawSymptoms[0] === 'object' && rawSymptoms[0] !== null && 'text' in rawSymptoms[0];
        if (isChecklist && stepType === 'as_complete') {
            const symptomLines = rawSymptoms.map((s: any, i: number) => {
                const circle = rawSymptoms.length > 1 ? String.fromCharCode(9312 + i) : "";
                const completed = s.completed ?? s.isResolved ?? false;
                return (
                    <HStack key={`symptom-${i}`} align="start" spacing={1.5} w="full">
                        <Box w="20px" flexShrink={0} display="flex" justifyContent="center">
                            <ChecklistBadge completed={completed} />
                        </Box>
                        <Text fontSize="sm" whiteSpace="pre-wrap" lineHeight="1.6" flex={1}>
                            <ThinParen text={`${circle}${s.text}`} />
                        </Text>
                    </HStack>
                );
            });
            items.push({
                label: "증상",
                value: <VStack align="start" spacing={0} w="full" mt="1px">{symptomLines}</VStack>
            });
        } else {
            const validSymptoms = rawSymptoms.filter((s: any) => (typeof s === 'string' ? s : s.text) && (typeof s === 'string' ? s : s.text).trim() !== "");
            if (validSymptoms.length > 0) {
                const symptomLines = validSymptoms.map((s: any, i: number) => {
                    const text = typeof s === 'string' ? s : s.text;
                    const circle = validSymptoms.length > 1 ? String.fromCharCode(9312 + i) : "";
                    const completed = typeof s === 'object' ? (s.completed ?? s.isResolved ?? false) : false;
                    const hasStatus = typeof s === 'object' && (s.completed !== undefined || s.isResolved !== undefined);

                    if (hasStatus && stepType === 'remoteas_complete') {
                        return (
                            <HStack key={`symptom-${i}`} align="start" spacing={1.5} w="full">
                                <Box w="20px" flexShrink={0} display="flex" justifyContent="center">
                                    <ChecklistBadge completed={completed} />
                                </Box>
                                <Text fontSize="sm" whiteSpace="pre-wrap" lineHeight="1.6" flex={1}>
                                    <ThinParen text={`${circle}${text}`} />
                                </Text>
                            </HStack>
                        );
                    }
                    return `${circle}${text}`;
                });

                if (stepType === 'remoteas_complete' && typeof symptomLines[0] !== 'string') {
                    items.push({
                        label: "증상",
                        value: <VStack align="start" spacing={0} w="full" mt="1px">{symptomLines}</VStack>
                    });
                } else {
                    items.push({
                        label: "증상",
                        value: <Text whiteSpace="pre-wrap" lineHeight="1.6" verticalAlign="top"><ThinParen text={symptomLines.join("\n")} /></Text>
                    });
                }
            }
        }
    }

    // [Visit A/S Complete Only] 점검 불가 사유 (Symptoms)
    if (stepType === 'as_complete' && content.symptomIncompleteReason) {
        items.push({
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
        items.push({ label: "결과", value: content.result });
    }
    if (stepType === 'remoteas_complete' && content.supportContent) {
        items.push({ label: "지원", value: content.supportContent });
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
                                <ChecklistBadge completed={completed} />
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
                                <ChecklistBadge completed={completed} />
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
            items.push({
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
    if (isCompleteMode && content.incompleteReason && stepType !== 'as_complete') {
        items.push({
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

    // Supplies (Moved up for remoteas_complete to be above deliveryInfo)
    const supplies = content.content?.selectedSupplies || content.selectedSupplies;
    const validSupplies = (Array.isArray(supplies) ? supplies : []).filter((s: any) => s.name && s.name.trim() !== "");
    if (validSupplies.length > 0) {
        const supplyLabel = stepType === 'remoteas_complete' ? "발송" : ((stepType === 'install_complete' || stepType === 'as_complete') ? "사용" : ((stepType || "").includes("schedule") ? "준비" : "물품"));
        const displaySupplies = validSupplies.map((s: any, idx: number) => {
            const circle = validSupplies.length > 1 ? String.fromCharCode(9312 + idx) : "";
            return `${circle}${s.name} × ${s.quantity}`;
        }).join("\n");
        items.push({
            label: supplyLabel,
            value: <Text whiteSpace="pre-wrap" lineHeight="1.6" verticalAlign="top"><ThinParen text={displaySupplies} /></Text>
        });
    }

    if (stepType === 'remoteas_complete' && content.deliveryInfo) {
        const { courier, trackingNumber, shipmentDate, deliveryAddress } = content.deliveryInfo;
        const datePart = (shipmentDate || "").split(" ")[0];
        if (datePart || deliveryAddress) {
            const separator = (datePart && deliveryAddress) ? "  /  " : "";
            items.push({ label: "배송", value: `${datePart}${separator}${deliveryAddress || ""}` });
        }
        if (courier) {
            items.push({ label: "업체", value: courier, isSubItem: true, isFirstSubItem: true });
        }
        if (trackingNumber) {
            items.push({ label: "송장", value: trackingNumber, isSubItem: true, isFirstSubItem: !courier });
        }
    }

    if (stepType === 'demo_complete') {
        if (content.discountType) {
            const displayValue = (content.discountType === "할인 없음" || content.discountType === "할인 제안하지 않음" || content.discountType === "해당 없음")
                ? "할인 없음"
                : `${content.discountType}${content.discountValue ? ` (${content.discountValue})` : ""}`;
            items.push({ label: "제안", value: displayValue });
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
                items.push({
                    label: "업무",
                    value: <Text whiteSpace="pre-wrap" lineHeight="1.6" verticalAlign="top"><ThinParen text={taskList} /></Text>
                });
            }
        }
    }

    return items;
};
