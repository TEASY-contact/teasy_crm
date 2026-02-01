// src/components/dashboard/hooks/useDashboardSubscriptions.ts
import { useState, useEffect, useMemo } from "react";
import { collection, query, where, onSnapshot, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";

export const useDashboardSubscriptions = (selectedDate: Date, playDingDong: () => void) => {
    const [recentReportsRaw, setRecentReportsRaw] = useState<any[]>([]);
    const [workRequestsList, setWorkRequestsList] = useState<any[]>([]);
    const [schedulesList, setSchedulesList] = useState<any[]>([]);
    const [userMetadata, setUserMetadata] = useState<Record<string, { color: string, badgeChar: string }>>({});

    useEffect(() => {
        const unsub = onSnapshot(collection(db, "users"), (snap) => {
            const meta: Record<string, { color: string, badgeChar: string }> = {};
            snap.docs.forEach(d => {
                const data = d.data();
                meta[data.uid || d.id] = {
                    color: data.representativeColor,
                    badgeChar: data.badgeChar
                };
            });
            setUserMetadata(meta);
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        const qActivities = query(collection(db, "activities"), orderBy("createdAt", "desc"), limit(100));
        const unsubActivities = onSnapshot(qActivities, (snap) => {
            setRecentReportsRaw(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const qWork = query(collection(db, "work_requests"), where("status", "in", ["pending", "in_progress", "rejected"]), orderBy("createdAt", "desc"));
        const unsubWork = onSnapshot(qWork, (snap) => {
            setWorkRequestsList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            snap.docChanges().forEach((change) => { if (change.type === "added") playDingDong(); });
        });

        return () => { unsubActivities(); unsubWork(); };
    }, [playDingDong]);

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
            setSchedulesList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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
