// src/components/dashboard/hooks/useDashboardSubscriptions.ts
import { useState, useEffect, useMemo } from "react";
import { collection, query, where, onSnapshot, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Activity } from "@/types/domain";
import { WorkRequest } from "@/types/work-order";

export const useDashboardSubscriptions = (selectedDate: Date) => {
    const [recentReportsRaw, setRecentReportsRaw] = useState<Activity[]>([]);
    const [workRequestsList, setWorkRequestsList] = useState<WorkRequest[]>([]);
    const [schedulesList, setSchedulesList] = useState<Activity[]>([]);
    const [userMetadata, setUserMetadata] = useState<Record<string, { name: string, color: string, badgeChar: string }>>({});

    useEffect(() => {
        const unsub = onSnapshot(collection(db, "users"), (snap) => {
            const meta: Record<string, { name: string, color: string, badgeChar: string }> = {};
            snap.docs.forEach(d => {
                const data = d.data();
                meta[data.uid || d.id] = {
                    name: data.name,
                    color: data.representativeColor,
                    badgeChar: data.badgeChar
                };
            });
            setUserMetadata({
                ...meta,
                "TEASY_SYSTEM": {
                    name: "시스템",
                    color: "#805AD5", // purple.500
                    badgeChar: "T"
                }
            });
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        const qActivities = query(collection(db, "activities"), orderBy("createdAt", "desc"), limit(100));
        const unsubActivities = onSnapshot(qActivities, (snap) => {
            setRecentReportsRaw(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity)));
        });

        const qWork = query(collection(db, "work_requests"), orderBy("createdAt", "desc"));
        const unsubWork = onSnapshot(qWork, (snap) => {
            setWorkRequestsList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkRequest)));
        });

        return () => { unsubActivities(); unsubWork(); };
    }, []);

    useEffect(() => {
        const year = selectedDate.getFullYear();
        const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
        const startOfMonth = `${year}-${month}-01`;
        const endOfMonth = `${year}-${month}-31`;

        const qSchedules = query(
            collection(db, "activities"),
            where("date", ">=", startOfMonth),
            where("date", "<=", endOfMonth)
        );
        const unsubSchedules = onSnapshot(qSchedules, (snap) => {
            setSchedulesList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity)));
        });

        return () => unsubSchedules();
    }, [selectedDate]);

    return useMemo(() => ({
        recentReportsRaw,
        workRequestsList,
        schedulesList,
        userMetadata
    }), [recentReportsRaw, workRequestsList, schedulesList, userMetadata]);
};
