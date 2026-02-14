// src/hooks/useTimelineIntegration.ts
"use client";
import { db } from "@/lib/firebase";
import { doc, runTransaction, serverTimestamp, collection, DocumentReference, DocumentSnapshot } from "firebase/firestore";
import { TimelineItem } from "@/types/timeline";

/**
 * Final Integration Logic for v122.0
 * Handles the cascading effects of timeline reports on Inventory, Dashboard, and Tax Workflow.
 */
export const useTimelineIntegration = () => {
    const processReport = async (customerId: string, reportData: Partial<TimelineItem>) => {
        await runTransaction(db, async (transaction) => {
            const customerRef = doc(db, "customers", customerId);
            const newTimelineRef = doc(collection(db, `customers/${customerId}/timelines`));

            // 1. ALL READS FIRST (Customer and all inventory items)
            const customerSnap = await transaction.get(customerRef);
            if (!customerSnap.exists()) throw new Error("Customer not found");

            interface PreparedPart { id: string; qty: number; }
            interface InventorySnap {
                item: PreparedPart;
                ref: DocumentReference;
                snap: DocumentSnapshot;
            }

            let inventorySnaps: InventorySnap[] = [];
            if (reportData.stepType === 'install_schedule' || reportData.stepType === 'as_schedule') {
                const items = ((reportData.content as any)?.preparedParts as PreparedPart[]) || [];
                inventorySnaps = await Promise.all(items.map(async (item) => {
                    const itemRef = doc(db, "inventory_items", item.id);
                    const snap = await transaction.get(itemRef);
                    return { item, ref: itemRef, snap };
                }));
            }

            // 2. ALL WRITES AFTER
            transaction.set(newTimelineRef, {
                ...reportData,
                createdAt: serverTimestamp(),
            });

            transaction.update(customerRef, {
                currentStep: reportData.stepType,
                lastActivityDate: serverTimestamp()
            });

            // Inventory Reconciliation
            for (const { item, ref, snap } of inventorySnaps) {
                const currentStock = snap.data()?.current_stock || 0;
                transaction.update(ref, { current_stock: currentStock - item.qty });
            }
        });
    };

    const deleteReportWithInventory = async (customerId: string, timelineId: string, restockItems: { id: string, qty: number, action: 'restock' | 'consumed' }[]) => {
        await runTransaction(db, async (transaction) => {
            const reportRef = doc(db, `customers/${customerId}/timelines`, timelineId);

            // 1. ALL READS FIRST
            const inventorySnaps = await Promise.all(restockItems.map(async (item) => {
                if (item.action === 'restock') {
                    const itemRef = doc(db, "inventory_items", item.id);
                    const snap = await transaction.get(itemRef);
                    return { item, ref: itemRef, snap };
                }
                return null;
            }));

            // 2. ALL WRITES AFTER
            for (const entry of inventorySnaps) {
                if (entry) {
                    const { item, ref, snap } = entry;
                    const currentStock = snap.data()?.current_stock || 0;
                    transaction.update(ref, { current_stock: currentStock + item.qty });
                }
            }
            transaction.delete(reportRef);
        });
    };

    return { processReport, deleteReportWithInventory };
};
