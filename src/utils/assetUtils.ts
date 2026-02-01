// src/utils/assetUtils.ts
import { db } from "@/lib/firebase";
import { doc, updateDoc, writeBatch } from "firebase/firestore";

export interface AssetData {
    id: string;
    type: "inventory" | "product" | "divider";
    category?: string;
    name?: string;
    spec?: string;
    unit?: string;
    price?: number;
    composition?: string;
    stock?: number;
    notes?: string;
    lastActionDate?: string;
    lastOperator?: string;
    editOperators?: string;
    lastInflow?: number | null;
    lastOutflow?: number | null;
    lastRecipient?: string;
    editTime?: string;
    editLog?: string;
    createdAt: any;
    dividerType?: "inventory" | "product";
    orderIndex?: number;
}

/**
 * Universal timestamp parser for Firestore/JS Date (v1.73)
 */
export const getAssetTimestamp = (createdAt: any): number => {
    if (!createdAt) return 0;
    if (createdAt.seconds) return createdAt.seconds;
    if (createdAt instanceof Date) return createdAt.getTime() / 1000;
    return 0;
};

/**
 * Global Self-Healing Engine (v1.80)
 * Re-calculates entire history for a specific item to ensure mathematical integrity.
 * Performance: Optimized using writeBatch to prevent network waterfall.
 */
export const performSelfHealing = async (name: string, category: string, assets: AssetData[], updates?: any, targetId?: string) => {
    const related = assets
        .filter(a => a.name === name && a.category === category && a.type === "inventory")
        .map(a => (targetId && a.id === targetId) ? { ...a, ...updates, lastInflow: (updates?.lastInflow ?? a.lastInflow), lastOutflow: (updates?.lastOutflow ?? a.lastOutflow) } : a)
        .sort((a, b) => getAssetTimestamp(a.createdAt) - getAssetTimestamp(b.createdAt));

    const batch = writeBatch(db);
    let currentRunning = 0;
    let hasChanges = false;

    for (const item of related) {
        currentRunning += (item.lastInflow || 0) - (item.lastOutflow || 0);
        if (item.stock !== currentRunning) {
            batch.update(doc(db, "assets", item.id), { stock: currentRunning });
            hasChanges = true;
        }
    }

    if (hasChanges) {
        await batch.commit();
    }
    return currentRunning;
};

/**
 * Calculates initial stock for a new registration based on existing history.
 */
export const calculateInitialStock = (name: string, category: string, assets: AssetData[], newInflow: number): number => {
    const itemHistory = assets.filter(a => a.name === name && a.category === category && a.type === "inventory");
    const historicalSum = itemHistory.reduce((acc, cur) => acc + (cur.lastInflow || 0) - (cur.lastOutflow || 0), 0);
    return historicalSum + newInflow;
};
