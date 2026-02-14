// src/hooks/useAsTypeMaster.ts
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

export interface AsTypeItem {
    id: string;
    name: string;
    createdAt: Timestamp | Date | string | null;
    isDivider?: boolean;
    orderIndex?: number;
}

export const useAsTypeMaster = (collectionName: string = "as_type_master") => {
    const [asTypes, setAsTypes] = useState<AsTypeItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const q = query(
            collection(db, collectionName),
            orderBy("orderIndex", "asc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(d => ({
                id: d.id,
                ...d.data()
            } as AsTypeItem));
            setAsTypes(items);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [collectionName]);

    const addAsType = async (name: string) => {
        if (!name.trim()) return;
        const exists = asTypes.some(d => d.name === name.trim() && !d.isDivider);
        if (exists) throw new Error("이미 존재하는 유형명입니다.");

        await addDoc(collection(db, collectionName), {
            name: name.trim(),
            isDivider: false,
            orderIndex: asTypes.length > 0 ? Math.max(...asTypes.map(d => d.orderIndex || 0)) + 1 : 0,
            createdAt: serverTimestamp()
        });
    };

    const addDivider = async () => {
        await addDoc(collection(db, collectionName), {
            name: "---",
            isDivider: true,
            orderIndex: asTypes.length > 0 ? Math.max(...asTypes.map(d => d.orderIndex || 0)) + 1 : 0,
            createdAt: serverTimestamp()
        });
    };

    const removeAsType = async (id: string) => {
        await deleteDoc(doc(db, collectionName, id));
    };

    const updateOrder = async (newOrder: AsTypeItem[]) => {
        const batch = writeBatch(db);
        newOrder.forEach((item, index) => {
            const ref = doc(db, collectionName, item.id);
            batch.update(ref, { orderIndex: index });
        });
        await batch.commit();
    };

    return { asTypes, isLoading, addAsType, addDivider, removeAsType, updateOrder };
};
