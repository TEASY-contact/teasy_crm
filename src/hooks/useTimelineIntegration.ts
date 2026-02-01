// src/hooks/useTimelineIntegration.ts
"use client";
import { db } from "@/lib/firebase";
import { doc, runTransaction, serverTimestamp, collection } from "firebase/firestore";
import { TimelineItem } from "@/types/timeline";

/**
 * Final Integration Logic for v122.0
 * Handles the cascading effects of timeline reports on Inventory, Dashboard, and Tax Workflow.
 */
export const useTimelineIntegration = () => {
    const processReport = async (customerId: string, reportData: Partial<TimelineItem>) => {
        await runTransaction(db, async (transaction) => {
            const customerRef = doc(db, "customers", customerId);
            const customerSnap = await transaction.get(customerRef);
            if (!customerSnap.exists()) throw new Error("Customer not found");

            const newTimelineRef = doc(collection(db, `customers/${customerId}/timelines`));

            // 1. Step Rollback & Sequence Logic
            transaction.set(newTimelineRef, {
                ...reportData,
                createdAt: serverTimestamp(),
            });
            transaction.update(customerRef, {
                currentStep: reportData.stepType,
                lastActivityDate: serverTimestamp()
            });

            // 2. Inventory Two-Step Reconciliation (v122.0)
            if (reportData.stepType === 'install_schedule' || reportData.stepType === 'as_schedule') {
                const items = reportData.content.preparedParts || [];
                for (const item of items) {
                    const itemRef = doc(db, "inventory_items", item.id);
                    const itemSnap = await transaction.get(itemRef);
                    const currentStock = itemSnap.data()?.current_stock || 0;
                    transaction.update(itemRef, { current_stock: currentStock - item.qty });
                }
            }

            // 3. Tax Workflow Automation (Midnight Check logic handled via Cloud Functions)
        });
    };

    const deleteReportWithInventory = async (customerId: string, timelineId: string, restockItems: { id: string, qty: number, action: 'restock' | 'consumed' }[]) => {
        await runTransaction(db, async (transaction) => {
            const reportRef = doc(db, `customers/${customerId}/timelines`, timelineId);

            for (const item of restockItems) {
                if (item.action === 'restock') {
                    const itemRef = doc(db, "inventory_items", item.id);
                    const itemSnap = await transaction.get(itemRef);
                    const currentStock = itemSnap.data()?.current_stock || 0;
                    transaction.update(itemRef, { current_stock: currentStock + item.qty });
                }
            }
            transaction.delete(reportRef);
        });
    };

    return { processReport, deleteReportWithInventory };
};
