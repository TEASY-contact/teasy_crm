// src/hooks/useDistributorMaster.ts
"use client";
import { db } from "@/lib/firebase";
import {
    collection,
    query,
    orderBy,
    addDoc,
    deleteDoc,
    doc,
    updateDoc,
    serverTimestamp,
    onSnapshot,
    writeBatch,
    Timestamp
} from "firebase/firestore";
import { useState, useEffect } from "react";

export interface DistributorItem {
    id: string;
    name: string;
    createdAt: Timestamp | Date | string | null;
    isDivider?: boolean;
    orderIndex?: number;
    colorConfig?: { bg: string, color: string };
}

export const useDistributorMaster = () => {
    const [distributors, setDistributors] = useState<DistributorItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const q = query(
            collection(db, "distributor_master"),
            orderBy("orderIndex", "asc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(d => ({
                id: d.id,
                ...d.data()
            } as DistributorItem));
            setDistributors(items);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const addDistributor = async (name: string) => {
        if (!name.trim()) return;
        const exists = distributors.some(d => d.name === name.trim() && !d.isDivider);
        if (exists) throw new Error("이미 존재하는 총판명입니다.");

        await addDoc(collection(db, "distributor_master"), {
            name: name.trim(),
            isDivider: false,
            colorConfig: { bg: "gray.100", color: "gray.600" },
            orderIndex: distributors.length > 0 ? Math.max(...distributors.map(d => d.orderIndex || 0)) + 1 : 0,
            createdAt: serverTimestamp()
        });
    };

    const addDivider = async () => {
        await addDoc(collection(db, "distributor_master"), {
            name: "---",
            isDivider: true,
            orderIndex: distributors.length > 0 ? Math.max(...distributors.map(d => d.orderIndex || 0)) + 1 : 0,
            createdAt: serverTimestamp()
        });
    };

    const removeDistributor = async (id: string) => {
        await deleteDoc(doc(db, "distributor_master", id));
    };

    const updateColor = async (id: string, config: { bg: string, color: string }) => {
        await updateDoc(doc(db, "distributor_master", id), { colorConfig: config });
    };

    const updateOrder = async (newOrder: DistributorItem[]) => {
        const batch = writeBatch(db);
        newOrder.forEach((item, index) => {
            const ref = doc(db, "distributor_master", item.id);
            batch.update(ref, { orderIndex: index });
        });
        await batch.commit();
    };

    return { distributors, isLoading, addDistributor, addDivider, removeDistributor, updateColor, updateOrder };
};
