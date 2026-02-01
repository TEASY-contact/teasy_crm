// src/components/dashboard/hooks/useDashboardPersistence.ts
import { useState, useEffect, useMemo } from "react";

export const useDashboardPersistence = () => {
    const [dismissedRecentIds, setDismissedRecentIds] = useState<Set<string>>(new Set());
    const [readWorkIds, setReadWorkIds] = useState<Set<string>>(new Set());
    const [readScheduleIds, setReadScheduleIds] = useState<Set<string>>(new Set());
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const loadSet = (key: string): Set<string> => {
            try {
                const saved = localStorage.getItem(key);
                return saved ? new Set(JSON.parse(saved)) : new Set<string>();
            } catch (e) {
                console.error(`Error loading ${key}:`, e);
                return new Set<string>();
            }
        };
        setDismissedRecentIds(loadSet('teasy_dismissed_recent'));
        setReadWorkIds(loadSet('teasy_read_work'));
        setReadScheduleIds(loadSet('teasy_read_schedules'));
        setIsLoaded(true);
    }, []);

    useEffect(() => {
        if (!isLoaded) return;
        localStorage.setItem('teasy_dismissed_recent', JSON.stringify(Array.from(dismissedRecentIds)));
    }, [dismissedRecentIds, isLoaded]);

    useEffect(() => {
        if (!isLoaded) return;
        localStorage.setItem('teasy_read_work', JSON.stringify(Array.from(readWorkIds)));
    }, [readWorkIds, isLoaded]);

    useEffect(() => {
        if (!isLoaded) return;
        localStorage.setItem('teasy_read_schedules', JSON.stringify(Array.from(readScheduleIds)));
    }, [readScheduleIds, isLoaded]);

    return useMemo(() => ({
        dismissedRecentIds, setDismissedRecentIds,
        readWorkIds, setReadWorkIds,
        readScheduleIds, setReadScheduleIds,
        isLoaded
    }), [dismissedRecentIds, readWorkIds, readScheduleIds, isLoaded]);
};
