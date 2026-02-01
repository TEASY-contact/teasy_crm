// src/hooks/useInventoryEngine.ts
import { db } from "@/lib/firebase";
import { doc, runTransaction, serverTimestamp } from "firebase/firestore";

export const useInventoryEngine = () => {
    const reconcileStock = async (items: { id: string; qty: number }[], type: 'deduct' | 'restore', customerId: string, timelineId: string) => {
        await runTransaction(db, async (transaction) => {
            // 1. ALL READS FIRST
            const snapshots = await Promise.all(items.map(async (item) => {
                const itemRef = doc(db, "inventory_items", item.id);
                const snap = await transaction.get(itemRef);
                return { item, ref: itemRef, snap };
            }));

            // 2. ALL WRITES AFTER
            for (const { item, ref, snap } of snapshots) {
                if (!snap.exists()) continue;

                const currentStock = snap.data().current_stock;
                const newStock = type === 'deduct' ? currentStock - item.qty : currentStock + item.qty;

                transaction.update(ref, { current_stock: newStock });

                const logRef = doc(db, "inventory_logs", Math.random().toString(36).substring(7));
                transaction.set(logRef, {
                    itemId: item.id,
                    type: type === 'deduct' ? 'outbound' : 'inbound',
                    qty: item.qty,
                    timestamp: serverTimestamp(),
                    relatedCustomerId: customerId,
                    relatedTimelineId: timelineId,
                    context: type === 'deduct' ? "New Registration" : "Error Correction"
                });
            }
        });
    };

    return { reconcileStock };
};
