import React from "react";
import { Box, VStack, HStack, Flex, Text } from "@chakra-ui/react";
import { ThinParen } from "@/components/common/UIComponents";

/**
 * ModificationHistoryPanel - 수정이력 패널
 * TimelineCard 내 수정이력 로그를 카드 형태로 표시합니다.
 */
export const ModificationHistoryPanel = ({ historyArr }: { historyArr: any[] }) => {
    if (!historyArr || historyArr.length === 0) return null;

    const flatLogs = historyArr.flatMap((log: any) => {
        const changes = (log.content || "").split(" / ");
        return changes.map((c: string) => {
            const separatorIndex = c.indexOf(": ");
            const label = separatorIndex > -1 ? c.substring(0, separatorIndex) : c;
            const values = separatorIndex > -1 ? c.substring(separatorIndex + 2) : "";
            const arrowIndex = values.indexOf(" → ");
            const before = arrowIndex > -1 ? values.substring(0, arrowIndex) : values;
            const after = arrowIndex > -1 ? values.substring(arrowIndex + 3) : undefined;
            return {
                time: log.time,
                managerName: log.managerName,
                label: label?.trim(),
                before: before?.trim(),
                after: after?.trim()
            };
        });
    });

    return (
        <Box>
            <Box px={4} py={2} bg="gray.50">
                <Text fontSize="sm" color="gray.500" fontWeight="medium">· 수정이력</Text>
            </Box>
            <Box px={4} pb={4} pt={2}>
                <VStack align="stretch" spacing={3}>
                    {flatLogs.map((log: any, idx: number) => {
                        const circledNum = String.fromCharCode(9312 + idx);
                        return (
                            <Box key={idx} p={2.5} bg="white" borderRadius="lg" border="1px" borderColor="gray.100" shadow="xs">
                                <Box mb={2}>
                                    <HStack spacing={1} align="center">
                                        <Text fontSize="sm" color="gray.400" fontWeight="medium" display="flex" alignItems="center">
                                            {circledNum}
                                            <Box as="span" ml={1}>{(log.time || "").replace(/\s+/g, "  ")}</Box>
                                            <Box as="span" ml={3}><ThinParen text={`(${log.managerName})`} /></Box>
                                        </Text>
                                    </HStack>
                                </Box>
                                <VStack align="stretch" spacing={0.5} pl="18px">
                                    <Flex align="baseline" fontSize="sm" color="gray.400" fontWeight="medium">
                                        <Text flexShrink={0}>· 변경 항목{"\u00A0"}:{"\u00A0\u00A0"}</Text>
                                        <Box color="gray.700" fontWeight="medium" whiteSpace="pre-wrap">{log.label}</Box>
                                    </Flex>
                                    <Flex align="baseline" fontSize="sm" color="gray.400" fontWeight="medium">
                                        <Text flexShrink={0}>· 변경 전{"\u00A0"}:{"\u00A0\u00A0"}</Text>
                                        <Box color="gray.500" fontWeight="light" whiteSpace="pre-wrap"><ThinParen text={log.before || "없음"} /></Box>
                                    </Flex>
                                    <Flex align="baseline" fontSize="sm" color="gray.400" fontWeight="medium">
                                        <Text flexShrink={0}>· 변경 후{"\u00A0"}:{"\u00A0\u00A0"}</Text>
                                        <Box color="gray.700" fontWeight="medium" whiteSpace="pre-wrap"><ThinParen text={log.after || "없음"} /></Box>
                                    </Flex>
                                </VStack>
                            </Box>
                        );
                    })}
                </VStack>
            </Box>
        </Box>
    );
};
