// src/app/customers/[id]/hooks/useCustomerDetail.ts
import { useState, useEffect, use, useCallback } from "react";
import { doc, collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Customer } from "@/types/customer";
import { useDisclosure } from "@chakra-ui/react";

export const useCustomerDetail = (paramsPromise: any) => {
    const params = paramsPromise && typeof paramsPromise.then === 'function' ? use(paramsPromise) : paramsPromise;
    const id = params?.id;

    const [customer, setCustomer] = useState<Customer | null>(null);
    const [activities, setActivities] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [userStatusMap, setUserStatusMap] = useState<Record<string, string>>({});

    const [selectedActivity, setSelectedActivity] = useState<any>(null);
    const [isConfirmationMode, setIsConfirmationMode] = useState(false);
    const [editModalData, setEditModalData] = useState<{ label: string, field: string, values: string[] }>({ label: "", field: "", values: [] });

    const selectionDisclosure = useDisclosure();
    const detailDisclosure = useDisclosure();
    const editDisclosure = useDisclosure();

    useEffect(() => {
        if (!id) return;

        // 1. Real-time customer data
        const unsubscribeCustomer = onSnapshot(doc(db, "customers", id), (docSnap) => {
            if (docSnap.exists()) {
                setCustomer({ id: docSnap.id, ...docSnap.data() } as Customer);
            }
            setIsLoading(false);
        }, (err) => {
            console.error("Error fetching customer:", err);
            setIsLoading(false);
        });

        // 2. Real-time user status
        const unsubscribeUsers = onSnapshot(collection(db, "users"), (snapshot) => {
            const statuses: Record<string, string> = {};
            snapshot.docs.forEach(d => { statuses[d.id] = d.data().status || 'active'; });
            setUserStatusMap(statuses);
        });

        // 3. Real-time timeline
        const q = query(collection(db, "activities"), where("customerId", "==", id));
        const unsubscribeActivities = onSnapshot(q, (snapshot) => {
            if (snapshot.empty) {
                setActivities([]); return;
            }
            const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Client-side sort: 과거 순 (v123.73 standard)
            fetched.sort((a: any, b: any) => {
                const valA = (a.date || "").replace(/\D/g, "");
                const valB = (b.date || "").replace(/\D/g, "");
                if (valA !== valB) return valA.localeCompare(valB);
                const seqA = a.sequenceNumber || 0;
                const seqB = b.sequenceNumber || 0;
                if (seqA !== seqB) return seqA - seqB;
                const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : Date.now();
                const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : Date.now();
                return timeA - timeB;
            });
            setActivities(fetched);
        });

        return () => {
            unsubscribeCustomer();
            unsubscribeUsers();
            unsubscribeActivities();
        };
    }, [id]);

    const handleActivityClick = (activity: any, confirmation: boolean = false) => {
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
        : customer?.lastConsultDate;

    return {
        id, customer, activities, isLoading, userStatusMap,
        selectedActivity, isConfirmationMode, editModalData,
        selectionDisclosure, detailDisclosure, editDisclosure,
        handleActivityClick, handleEditOpen, lastActivityDate
    };
};
