// src/components/dashboard/hooks/useDashboardLogic.ts
import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useDashboardPersistence } from "./useDashboardPersistence";
import { useDashboardSubscriptions } from "./useDashboardSubscriptions";
import { useReportEnrichment } from "./useReportEnrichment";


export const useDashboardLogic = () => {
    const { userData } = useAuth();

    const [selectedDate, setSelectedDate] = useState(new Date());

    // 1. Persistence Layer (Sub-hook)
    const persistence = useDashboardPersistence();
    const {
        dismissedRecentIds, setDismissedRecentIds,
        readWorkIds, setReadWorkIds,
        readScheduleIds, setReadScheduleIds
    } = persistence;

    // 2. Subscription Layer (Sub-hook)
    const subscriptions = useDashboardSubscriptions(selectedDate);
    const {
        recentReportsRaw,
        workRequestsList,
        schedulesList,
        userMetadata
    } = subscriptions;



    // 3. Enrichment Layer (Sub-hook)
    const enrichment = useReportEnrichment(recentReportsRaw, userData, dismissedRecentIds);
    const { recentList } = enrichment;

    // Midnight Auto-Update
    useEffect(() => {
        const checkMidnight = () => {
            const now = new Date();
            if (now.getHours() === 0 && now.getMinutes() === 0) {
                setSelectedDate(new Date());
            }
        };
        const timer = setInterval(checkMidnight, 60000);
        return () => clearInterval(timer);
    }, []);

    const dismissRecent = useCallback((id: string) => {
        setDismissedRecentIds(prev => {
            const next = new Set(prev);
            next.add(id);
            return next;
        });
    }, [setDismissedRecentIds]);

    const markWorkAsRead = useCallback((id: string) => {
        setReadWorkIds(prev => {
            const next = new Set(prev);
            next.add(id);
            return next;
        });
    }, [setReadWorkIds]);

    const markScheduleAsRead = useCallback((id: string) => {
        setReadScheduleIds(prev => {
            const next = new Set(prev);
            next.add(id);
            return next;
        });
    }, [setReadScheduleIds]);

    return useMemo(() => ({
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
        userData
    }), [
        selectedDate, recentList, workRequestsList, schedulesList,
        userMetadata, dismissedRecentIds, readWorkIds, readScheduleIds,
        dismissRecent, markWorkAsRead, markScheduleAsRead, userData
    ]);
};
