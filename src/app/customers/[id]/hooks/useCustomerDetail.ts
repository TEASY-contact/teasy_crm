import { useState, use, useCallback } from "react";
import { doc, collection, query, where, getDoc, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Customer, Activity } from "@/types/domain";
import { useDisclosure } from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";

export const useCustomerDetail = (paramsPromise: any) => {
    const params = paramsPromise && typeof paramsPromise.then === 'function' ? use(paramsPromise) : paramsPromise;
    const id = params?.id;

    // 1. Customer data
    const { data: customer, isLoading: isCustLoading } = useQuery({
        queryKey: ["customer", id],
        queryFn: async () => {
            const docSnap = await getDoc(doc(db, "customers", id));
            return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as Customer : null;
        },
        enabled: !!id
    });

    // 2. User status map
    const { data: userStatusMap = {} } = useQuery({
        queryKey: ["users", "statusMap"],
        queryFn: async () => {
            const snapshot = await getDocs(collection(db, "users"));
            const statuses: Record<string, string> = {};
            snapshot.docs.forEach(d => { statuses[d.id] = d.data().status || 'active'; });
            return statuses;
        },
        staleTime: 1000 * 60 * 5, // 5분 캐시
    });

    // 3. Activity timeline
    const { data: activities = [], isLoading: isActLoading } = useQuery({
        queryKey: ["activities", id],
        queryFn: async () => {
            const q = query(collection(db, "activities"), where("customerId", "==", id));
            const snapshot = await getDocs(q);
            const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));

            // Client-side sort: 작성 일시(createdAt) 기준 오름차순 — 최신이 아래
            return fetched.sort((a, b) => {
                const timeA = (a.createdAt as any)?.toDate ? (a.createdAt as any).toDate().getTime() : 0;
                const timeB = (b.createdAt as any)?.toDate ? (b.createdAt as any).toDate().getTime() : 0;
                if (timeA !== timeB) return timeA - timeB;
                const seqA = a.sequenceNumber || 0;
                const seqB = b.sequenceNumber || 0;
                return seqA - seqB;
            });
        },
        enabled: !!id,
        staleTime: 1000 * 60 * 5, // 5분 캐시
    });

    const isLoading = isCustLoading || isActLoading;

    const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
    const [isConfirmationMode, setIsConfirmationMode] = useState(false);
    const [editModalData, setEditModalData] = useState<{ label: string, field: string, values: string[] }>({ label: "", field: "", values: [] });

    const selectionDisclosure = useDisclosure();
    const detailDisclosure = useDisclosure();
    const editDisclosure = useDisclosure();

    const handleActivityClick = (activity: Activity, confirmation: boolean = false) => {
        setSelectedActivity(activity);
        setIsConfirmationMode(confirmation);
        detailDisclosure.onOpen();
    };

    const handleEditOpen = useCallback((label: string, field: string, values: string[]) => {
        setEditModalData({ label, field, values });
        editDisclosure.onOpen();
    }, [editDisclosure]);

    const lastActivityDate = activities.length > 0
        ? activities[activities.length - 1].date
        : null;

    return {
        id, customer, activities, isLoading, userStatusMap,
        selectedActivity, isConfirmationMode, editModalData,
        selectionDisclosure, detailDisclosure, editDisclosure,
        handleActivityClick, handleEditOpen, lastActivityDate
    };
};
