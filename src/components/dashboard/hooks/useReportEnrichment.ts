// src/components/dashboard/hooks/useReportEnrichment.ts
import { useState, useEffect, useMemo } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export const useReportEnrichment = (recentReportsRaw: any[], userData: any, dismissedRecentIds: Set<string>) => {
    const [recentList, setRecentList] = useState<any[]>([]);
    const [customerCache, setCustomerCache] = useState<Record<string, string>>({});

    useEffect(() => {
        let active = true;
        const enrichAndFilter = async () => {
            if (!userData) return;
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const filtered = recentReportsRaw.filter(item => {
                const createdTime = item.createdAt?.toDate ? item.createdAt.toDate() : new Date();
                const isRecent = createdTime >= sevenDaysAgo;
                const isNotMe = item.createdBy !== userData.uid;
                const isNotDismissed = !dismissedRecentIds.has(item.id);
                return isRecent && isNotMe && isNotDismissed;
            });

            const currentCache = { ...customerCache };
            const inFlight = new Map<string, Promise<string | null>>();
            let cacheChanged = false;

            const enriched = await Promise.all(filtered.map(async (item: any) => {
                const cid = item.customerId;
                if (item.customerName) return item;
                if (!cid) return { ...item, customerName: '알 수 없는 고객' };

                if (currentCache[cid]) return { ...item, customerName: currentCache[cid] };

                if (!inFlight.has(cid)) {
                    inFlight.set(cid, (async () => {
                        try {
                            const cSnap = await getDoc(doc(db, "customers", cid));
                            if (cSnap.exists()) {
                                const cName = cSnap.data().name;
                                currentCache[cid] = cName;
                                cacheChanged = true;
                                return cName;
                            }
                        } catch (e) { console.error(`Error fetching customer ${cid}:`, e); }
                        return null;
                    })());
                }

                const resolvedName = await inFlight.get(cid);
                return { ...item, customerName: resolvedName || '알 수 없는 고객' };
            }));

            if (!active) return;
            if (cacheChanged) setCustomerCache(currentCache);
            setRecentList(enriched);
        };
        enrichAndFilter();
        return () => { active = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [recentReportsRaw, userData, dismissedRecentIds]);

    return useMemo(() => ({ recentList }), [recentList]);
};
