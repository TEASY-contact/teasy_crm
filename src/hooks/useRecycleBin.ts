// src/hooks/useRecycleBin.ts
import { db } from "@/lib/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";

export const useRecycleBin = () => {
    const moveToBin = async (path: string, docId: string) => {
        const ref = doc(db, path, docId);
        await updateDoc(ref, {
            deletedAt: serverTimestamp(),
            isDeleted: true,
            purgeAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7-day retention (v122.0)
        });
    };

    const restoreFromBin = async (path: string, docId: string) => {
        const ref = doc(db, path, docId);
        await updateDoc(ref, {
            deletedAt: null,
            isDeleted: false,
            purgeAt: null
        });
        // Restoration automatically re-triggers inventory logic if applicable (v122.0)
        // This logic relies on Firestore triggers or application level listeners
    };

    return { moveToBin, restoreFromBin };
};
