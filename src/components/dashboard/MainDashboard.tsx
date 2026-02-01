"use client";
import { Box, Flex, Grid, GridItem, HStack, Text, SimpleGrid, useDisclosure } from "@chakra-ui/react";
import { useState } from "react";
import { CalendarBadge } from "./CalendarBadge";
import { SideStatusCard } from "@/components/dashboard/SideStatusCards";
import { ReportBadge, TeasyListItem, TeasyButton, SurnameBadge, TeasyList, TeasyListText, TeasyListSubText } from "@/components/common/UIComponents";
import { ReportDetailModal } from "@/components/features/customer/ReportDetailModal";
import { useDashboardLogic } from "./hooks/useDashboardLogic";
import { getBadgeInfo, getBadgeColor, extractRegion } from "./utils/dashboardUtils";

export const MainDashboard = () => {
    const {
        selectedDate,
        setSelectedDate,
        recentList,
        workRequestsList,
        schedulesList,
        userMetadata,
        dismissedRecentIds,
        readWorkIds,
        readScheduleIds,
        dismissRecent,
        markWorkAsRead,
        markScheduleAsRead,
        initAudio,
        userData
    } = useDashboardLogic();

    const { isOpen, onOpen, onClose } = useDisclosure();
    const [selectedActivity, setSelectedActivity] = useState<any>(null);
    const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
    const [isDashboardView, setIsDashboardView] = useState(false);

    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');

    // Calendar Events (Only Confirmed Schedules)
    const getEventsForDay = (day: number) => {
        const dateStr = `${year}-${month}-${String(day).padStart(2, '0')}`;
        return schedulesList
            .filter(s => {
                const d = s.date || "";
                return (d.startsWith(dateStr) || d === dateStr) &&
                    ['demo_schedule', 'install_schedule', 'as_schedule'].includes(s.type);
            })
            .map(s => ({ ...s, region: s.region || extractRegion(s.location) }));
    };

    const handleScheduleClick = (item: any) => {
        markScheduleAsRead(item.id);
        setSelectedActivity(item);
        setSelectedCustomer({ id: item.customerId, name: item.customerName || item.name });
        setIsDashboardView(true);
        onOpen();
    };

    const handleRecentClick = (item: any) => {
        setSelectedActivity(item);
        setSelectedCustomer({ id: item.customerId, name: item.customerName || item.name });
        setIsDashboardView(true);
        onOpen();
    };

    const selectedDateStr = `${year}-${month}-${String(selectedDate.getDate()).padStart(2, '0')}`;
    const normalizedSchedules = schedulesList
        .filter(s => (s.date || "").startsWith(selectedDateStr) && ['demo_schedule', 'install_schedule', 'as_schedule'].includes(s.type))
        .map(item => {
            const completionType = item.type === 'demo_schedule' ? 'demo_complete' : item.type === 'install_schedule' ? 'install_complete' : item.type === 'as_schedule' ? 'as_complete' : '';
            const isCompleted = schedulesList.some(s => s.customerId === item.customerId && s.type === completionType);
            return {
                ...item,
                isRead: readScheduleIds.has(item.id),
                region: item.region || extractRegion(item.location),
                completed: isCompleted
            };
        });

    const normalizedWorkRequests = workRequestsList.map(item => ({ ...item, isRead: readWorkIds.has(item.id) }));
    const visibleRecent = recentList.filter(item => !dismissedRecentIds.has(item.id));

    const unreadSchedules = normalizedSchedules.filter(i => !i.completed && !i.isRead).length;
    const unreadRecent = visibleRecent.length;
    const unreadWorkRequests = normalizedWorkRequests.filter(i => !i.isRead).length;

    return (
        <Box h="full" display="flex" flexDirection="column" gap={0} pb={2} onClick={initAudio}>
            <Grid
                templateColumns={{ base: "1fr", lg: "7fr 3fr" }}
                templateRows={{ base: "auto", lg: "auto auto 1fr" }}
                columnGap={6} rowGap={0} flex={1} h="full"
            >
                {/* Row 1: Year/Month Header */}
                <GridItem colSpan={1}>
                    <Box position="relative" w="full" h="40px">
                        <HStack w="full" justify="center" align="baseline" pt="8px">
                            <Text fontSize="4xl" fontWeight="650" color="gray.500" letterSpacing="-2px">{year}</Text>
                            <Text fontSize="24px" fontWeight="normal" color="gray.500">년</Text>
                            <Box w={2} />
                            <Text fontSize="4xl" fontWeight="650" color="gray.500" letterSpacing="-2px">{month}</Text>
                            <Text fontSize="24px" fontWeight="normal" color="gray.500">월</Text>
                        </HStack>
                        <SimpleGrid columns={7} columnGap={1} px={5} border="1px solid transparent" position="absolute" top={0} left={0} w="full" pointerEvents="none">
                            <Box gridColumn="7" pointerEvents="auto">
                                <HStack spacing={1} justify="center" pt="32px" zIndex={2} align="center">
                                    <TeasyButton version="ghost" minW="26px" h="26px" p={0} borderRadius="full" fontSize="lg" transform="translateY(-1px)" onClick={() => setSelectedDate(new Date(year, selectedDate.getMonth() - 1, 1))}>{"<"}</TeasyButton>
                                    <TeasyButton version="secondary" h="26px" fontSize="12px" px={3} onClick={() => setSelectedDate(new Date())}>오늘</TeasyButton>
                                    <TeasyButton version="ghost" minW="26px" h="26px" p={0} borderRadius="full" fontSize="lg" transform="translateY(-1px)" onClick={() => setSelectedDate(new Date(year, selectedDate.getMonth() + 1, 1))}>{">"}</TeasyButton>
                                </HStack>
                            </Box>
                        </SimpleGrid>
                    </Box>
                </GridItem>
                <GridItem colSpan={1} display={{ base: "none", lg: "block" }} />

                {/* Row 2: Calendar */}
                <GridItem colSpan={1} mt={10}>
                    <Flex bg="white" px={5} pt={1} pb={5} borderRadius="xl" shadow="md" border="1px" borderColor="gray.200" overflow="hidden" flexDirection="column" flex="0 0 auto" h="fit-content">
                        <SimpleGrid columns={{ base: 5, lg: 7 }} columnGap={1} rowGap={1} alignItems="start">
                            {["월", "화", "수", "목", "금", "토", "일"].map((day, idx) => (
                                <Box key={day} textAlign="center" fontWeight="bold" fontSize="16px" color={idx === 5 || idx === 6 ? "red.400" : "gray.400"} py={2}>{day}</Box>
                            ))}
                            {Array.from({ length: (new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1).getDay() + 6) % 7 }).map((_, i) => (
                                <Box key={`prev-${i}`} bg="gray.50" h={{ base: "60px", lg: "103px" }} borderRadius="md" opacity={0.5} />
                            ))}
                            {Array.from({ length: new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate() }).map((_, i) => {
                                const day = i + 1;
                                const dateObj = new Date(year, selectedDate.getMonth(), day);
                                const dayOfWeek = dateObj.getDay();
                                const isToday = new Date().getDate() === day && new Date().getMonth() === selectedDate.getMonth() && new Date().getFullYear() === selectedDate.getFullYear();
                                const isSelected = selectedDate.getDate() === day;
                                return (
                                    <Box key={day} bg={isSelected ? "rgba(128, 90, 213, 0.05)" : "white"} h={{ base: "80px", lg: "103px" }} p={1} borderRadius="md" border={isSelected ? "4px solid" : "1px solid"} borderColor={isSelected ? "rgba(128, 90, 213, 0.3)" : "gray.200"} cursor="pointer" onClick={() => setSelectedDate(dateObj)} _hover={{ bg: "gray.50", shadow: "md", borderColor: "brand.300" }} transition="all 0.2s" display="flex" flexDirection="column" position="relative">
                                        <HStack justify="flex-start" align="center" mb={1} spacing={2}>
                                            <Text fontWeight={isSelected || isToday ? "bold" : "normal"} color={isSelected ? "brand.600" : isToday ? "brand.500" : (dayOfWeek === 0 || dayOfWeek === 6 ? "red.400" : "gray.700")} fontSize="13px">{day}</Text>
                                        </HStack>
                                        <SimpleGrid columns={2} spacingX="3px" spacingY="5px" w="full" px={0}>
                                            {getEventsForDay(day).slice(0, 6).map((evt: any, idx: number) => (
                                                <CalendarBadge key={idx} type={evt.type} region={evt.region} />
                                            ))}
                                        </SimpleGrid>
                                    </Box>
                                );
                            })}
                        </SimpleGrid>
                    </Flex>
                </GridItem>

                {/* Row 2+3: Work Request */}
                <GridItem colSpan={1} rowSpan={2} mt={10} minH="0" display="flex" flexDirection="column">
                    <SideStatusCard title="업무 요청" count={unreadWorkRequests > 0 ? `+${unreadWorkRequests}` : 0} placeholder="모든 업무를 처리하였습니다." h="full" isEmpty={normalizedWorkRequests.length === 0}>
                        <TeasyList>
                            {normalizedWorkRequests.map((req, idx) => (
                                <TeasyListItem key={req.id} isLast={idx === normalizedWorkRequests.length - 1} onClick={() => markWorkAsRead(req.id)} cursor="pointer" opacity={req.isRead ? 0.6 : 1} spacing={3}>
                                    <Box flexShrink={0} w="22px" display="flex" justifyContent="center">
                                        <SurnameBadge name={req.name} badgeChar={userMetadata[req.createdBy]?.badgeChar} color={userMetadata[req.createdBy]?.color || getBadgeColor(req.category)} w="22px" h="22px" />
                                    </Box>
                                    <Box flexShrink={0} w="50px">
                                        <ReportBadge colorType={getBadgeInfo(req.category).color as any}>{getBadgeInfo(req.category).text}</ReportBadge>
                                    </Box>
                                    <Box flexShrink={0} w="70px" overflow="hidden">
                                        <TeasyListText color="gray.800" fontWeight="bold" w="full">{req.customer}</TeasyListText>
                                    </Box>
                                    <Box flex={1} overflow="hidden">
                                        <TeasyListText color="gray.500" fontWeight="medium" isTruncated w="full">{req.title}</TeasyListText>
                                    </Box>
                                    <Box flexShrink={0} w="85px" textAlign="right">
                                        <TeasyListSubText>{(req.date || '').replace(/\s+/g, "  ").replace(/\//g, "-")}</TeasyListSubText>
                                    </Box>
                                </TeasyListItem>
                            ))}
                        </TeasyList>
                    </SideStatusCard>
                </GridItem>

                {/* Row 3: Bottom Stats */}
                <GridItem colSpan={1} mt={6} minH="0">
                    <Grid templateColumns="1fr 1fr" gap={6} h="full">
                        <SideStatusCard title="외근 일정" count={unreadSchedules > 0 ? `+${unreadSchedules}` : 0} placeholder="해당 일자 외근 일정이 없습니다." h="full" mb={1} isEmpty={normalizedSchedules.length === 0}>
                            <TeasyList>
                                {normalizedSchedules.map((s, idx) => (
                                    <TeasyListItem key={s.id} isLast={idx === normalizedSchedules.length - 1} onClick={() => handleScheduleClick(s)} cursor="pointer" opacity={s.completed ? 0.6 : 1} spacing={3}>
                                        <Box flexShrink={0} w="50px">
                                            <ReportBadge colorType={getBadgeInfo(s.type).color as any} opacity={s.completed ? 0.4 : 1}>{getBadgeInfo(s.type).text}</ReportBadge>
                                        </Box>
                                        <Box flex={1} overflow="hidden">
                                            <TeasyListText color={s.completed ? "gray.300" : "gray.700"} textDecoration={s.completed ? "line-through" : "none"} fontWeight="bold" isTruncated w="full">
                                                {s.customerName || s.name}
                                                {s.region && <Text as="span" fontWeight="normal" color={s.completed ? "gray.300" : "gray.400"} ml={1}>({s.region}시)</Text>}
                                            </TeasyListText>
                                        </Box>
                                        <Box flexShrink={0} w="22px" display="flex" justifyContent="center">
                                            <SurnameBadge name={s.managerName} badgeChar={userMetadata[s.manager]?.badgeChar} color={userMetadata[s.manager]?.color} w="22px" h="22px" fontSize="10px" />
                                        </Box>
                                        <Box flexShrink={0} w="45px" textAlign="right">
                                            <TeasyListSubText fontWeight="600" color={s.completed ? "gray.300" : "gray.500"} textDecoration={s.completed ? "line-through" : "none"}>{(s.date || '').split('  ')[1] || (s.date || '').split(' ')[1] || ''}</TeasyListSubText>
                                        </Box>
                                    </TeasyListItem>
                                ))}
                            </TeasyList>
                        </SideStatusCard>

                        <SideStatusCard title="최신 등록" count={unreadRecent > 0 ? `+${unreadRecent}` : 0} placeholder="등록된 보고서가 없습니다." h="full" isEmpty={visibleRecent.length === 0}>
                            <TeasyList>
                                {visibleRecent.map((r, idx) => (
                                    <TeasyListItem key={r.id} isLast={idx === visibleRecent.length - 1} onClick={() => handleRecentClick(r)} cursor="pointer" spacing={3}>
                                        <Box flexShrink={0} w="50px">
                                            <ReportBadge colorType={getBadgeInfo(r.type).color as any} textAlign="center">{getBadgeInfo(r.type).text}</ReportBadge>
                                        </Box>
                                        <Box flex={1} overflow="hidden">
                                            <TeasyListText fontWeight="bold" isTruncated w="full">{r.customerName || '알 수 없는 고객'}</TeasyListText>
                                        </Box>
                                        <Box flexShrink={0} w="85px" textAlign="right">
                                            <TeasyListSubText>{(r.date || '').replace(/\s+/g, "  ").replace(/\//g, "-")}</TeasyListSubText>
                                        </Box>
                                    </TeasyListItem>
                                ))}
                            </TeasyList>
                        </SideStatusCard>
                    </Grid>
                </GridItem>
            </Grid>

            {selectedActivity && (
                <ReportDetailModal
                    isOpen={isOpen}
                    onClose={() => {
                        if (recentList.some(r => r.id === selectedActivity.id)) dismissRecent(selectedActivity.id);
                        onClose();
                        setSelectedActivity(null);
                        setIsDashboardView(false);
                    }}
                    customer={selectedCustomer}
                    activity={selectedActivity}
                    isDashboardView={isDashboardView}
                />
            )}
        </Box>
    );
};
