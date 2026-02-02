import { useEffect } from "react";
import { db } from "@/lib/firebase";
import {
    collection, addDoc, serverTimestamp, deleteDoc,
    doc, updateDoc, writeBatch, query, orderBy, onSnapshot
} from "firebase/firestore";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export interface MasterItem {
    id: string;
    name: string;
    category: string;
    isDeliveryItem: boolean;
    orderIndex: number;
    createdAt?: any;
}

export const useInventoryMaster = () => {
    const queryClient = useQueryClient();
    const queryKey = ["inventory_master"];

    const { data: masterItems = [], isLoading } = useQuery<MasterItem[]>({
        queryKey,
        queryFn: async () => {
            // Initial fetch or fallback
            return queryClient.getQueryData<MasterItem[]>(queryKey) || [];
        },
        staleTime: Infinity, // Keep data fresh via onSnapshot
    });

    // Real-time listener
    useEffect(() => {
        const q = query(collection(db, "inventory_master"), orderBy("orderIndex", "asc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MasterItem));
            queryClient.setQueryData(queryKey, items);
        }, (error) => {
            console.error("Inventory Master Listener Error:", error);
        });

        return () => unsubscribe();
    }, [queryClient]);

    const addItem = async (name: string, category: string) => {
        const trimmedName = name.trim();
        const trimmedCategory = category.trim();
        if (!trimmedName || !trimmedCategory) return;

        if (masterItems.some(i => i.name.toLowerCase() === trimmedName.toLowerCase())) {
            throw new Error("이미 등록된 물품명입니다.");
        }

        const onItemsCount = masterItems.filter(i => i.isDeliveryItem).length;
        const batch = writeBatch(db);

        // 1. New item: Add at the end of ON section (index = current ON count)
        const newDocRef = doc(collection(db, "inventory_master"));
        batch.set(newDocRef, {
            name: trimmedName,
            category: trimmedCategory,
            isDeliveryItem: true, // Default to "배송 정보 포함" (ON)
            orderIndex: onItemsCount,
            createdAt: serverTimestamp()
        });

        // 2. Shift all existing items that were at or after the new index (mostly OFF items)
        masterItems.forEach(item => {
            if (item.orderIndex >= onItemsCount) {
                batch.update(doc(db, "inventory_master", item.id), {
                    orderIndex: item.orderIndex + 1
                });
            }
        });

        await batch.commit();
    };

    const removeItem = async (id: string) => {
        await deleteDoc(doc(db, "inventory_master", id));
    };

    const toggleDelivery = async (id: string, currentStatus: boolean) => {
        const itemRef = doc(db, "inventory_master", id);
        await updateDoc(itemRef, { isDeliveryItem: !currentStatus });
    };

    const reorderItems = async (newOrder: MasterItem[]) => {
        const batch = writeBatch(db);
        newOrder.forEach((item, idx) => {
            batch.update(doc(db, "inventory_master", item.id), { orderIndex: idx });
        });
        await batch.commit();
    };

    return {
        masterItems,
        isLoading,
        addItem,
        removeItem,
        toggleDelivery,
        reorderItems
    };
};
