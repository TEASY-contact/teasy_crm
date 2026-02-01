// src/utils/assetUtils.ts
import { db } from "@/lib/firebase";
import { doc, updateDoc, writeBatch, collection, query, where, getDocs } from "firebase/firestore";

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
    isDeliveryItem?: boolean;
    sourceActivityId?: string;
    lastRecipientId?: string; // Link to customer ID
}

/**
 * Universal timestamp parser for Firestore/JS Date (v1.73)
 */
export const getAssetTimestamp = (createdAt: any): number => {
    if (!createdAt) return Date.now() / 1000;
    if (createdAt.seconds) return createdAt.seconds;
    if (createdAt instanceof Date) return createdAt.getTime() / 1000;
    return Date.now() / 1000;
};

/**
 * Global Self-Healing Engine (v2.0)
 * Re-calculates entire history for a specific item and syncs with asset_meta.
 */
export const performSelfHealing = async (name: string, category: string, assets?: AssetData[], updates?: any, targetId?: string) => {
    let related: AssetData[] = [];

    const sanitizedName = name.trim();
    const sanitizedCategory = category.trim();

    if (assets && assets.length > 0 && (updates || targetId)) {
        related = assets
            .filter(a => (a.name || "").trim() === sanitizedName && (a.category || "").trim() === sanitizedCategory && a.type === "inventory")
            .map(a => (targetId && a.id === targetId) ? { ...a, ...updates } : a);
    } else {
        const q = query(
            collection(db, "assets"),
            where("name", "==", sanitizedName),
            where("category", "==", sanitizedCategory),
            where("type", "==", "inventory")
        );
        const snap = await getDocs(q);
        related = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AssetData[];
    }

    if (related.length === 0) {
        // If no history, clear meta too
        const metaId = `meta_${sanitizedName}_${sanitizedCategory}`.replace(/\//g, "_");
        await updateDoc(doc(db, "asset_meta", metaId), { currentStock: 0, totalInflow: 0, totalOutflow: 0 }).catch(() => { });
        return 0;
    }

    // Reconstruction chain
    related.sort((a, b) => getAssetTimestamp(a.createdAt) - getAssetTimestamp(b.createdAt));

    const batch = writeBatch(db);
    let currentRunning = 0;
    let totalInflow = 0;
    let totalOutflow = 0;
    let hasChanges = false;

    for (const item of related) {
        const inflow = Number(item.lastInflow) || 0;
        const outflow = Number(item.lastOutflow) || 0;
        currentRunning += inflow - outflow;
        totalInflow += inflow;
        totalOutflow += outflow;

        if (item.stock !== currentRunning) {
            batch.update(doc(db, "assets", item.id), { stock: currentRunning });
            hasChanges = true;
        }
    }

    // Sync Meta Collection (Atomic Lock Point)
    const metaId = `meta_${sanitizedName}_${sanitizedCategory}`.replace(/\//g, "_");
    const metaRef = doc(db, "asset_meta", metaId);
    batch.set(metaRef, {
        currentStock: currentRunning,
        totalInflow,
        totalOutflow,
        lastHealedAt: new Date().toISOString()
    }, { merge: true });

    await batch.commit();
    return currentRunning;
};

/**
 * Real-time Stock Counter (v2.0)
 * Prioritizes asset_meta for performance, falls back to history for safety.
 */
export const getLatestStockCount = async (name: string, category: string): Promise<number> => {
    const sanitizedName = name.trim();
    const sanitizedCategory = category.trim();
    const metaId = `meta_${sanitizedName}_${sanitizedCategory}`.replace(/\//g, "_");

    try {
        const metaSnap = await getDocs(query(collection(db, "asset_meta"), where("__name__", "==", metaId)));
        if (!metaSnap.empty) {
            return Number(metaSnap.docs[0].data().currentStock) || 0;
        }
    } catch (e) {
        console.warn("Meta read failed, falling back to history sum", e);
    }

    const q = query(
        collection(db, "assets"),
        where("name", "==", sanitizedName),
        where("category", "==", sanitizedCategory),
        where("type", "==", "inventory")
    );
    const snap = await getDocs(q);
    return snap.docs.reduce((acc, doc) => {
        const data = doc.data();
        return acc + (Number(data.lastInflow) || 0) - (Number(data.lastOutflow) || 0);
    }, 0);
};

/**
 * Initial Stock Calculator (v2.0)
 * Sums up current stock from memory/assets list to determine the new item's starting balance.
 */
export const calculateInitialStock = (name: string, category: string, assets: AssetData[], newInflow: number): number => {
    const sanitizedName = name.trim();
    const sanitizedCategory = category.trim();

    const existingTotal = assets
        .filter(a => a.type === "inventory")
        .filter(a => (a.name || "").trim() === sanitizedName && (a.category || "").trim() === sanitizedCategory)
        .reduce((acc, a) => acc + (Number(a.lastInflow) || 0) - (Number(a.lastOutflow) || 0), 0);

    return existingTotal + newInflow;
};
