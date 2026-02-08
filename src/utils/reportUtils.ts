// src/utils/reportUtils.ts
// Shared utility functions extracted from report form hooks
import { ref as sRef, deleteObject, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { QueryClient } from "@tanstack/react-query";
export { deduplicateFiles, checkEditPermission } from "./reportPureUtils";

/**
 * Delete orphaned photos from Firebase Storage (v127.0)
 * Only deletes URLs that are actual Firebase Storage cloud URLs
 */
export const cleanupOrphanedPhotos = async (urlsToDelete: string[]): Promise<void> => {
    if (!urlsToDelete || urlsToDelete.length === 0) return;
    const cloudUrls = urlsToDelete.filter(url => url.startsWith('https://firebasestorage.googleapis.com'));
    if (cloudUrls.length === 0) return;

    await Promise.allSettled(cloudUrls.map(async (url) => {
        try {
            const storageRef = sRef(storage, url);
            await deleteObject(storageRef);
        } catch (e) {
            console.warn("Resource cleanup attempt failed:", url, e);
        }
    }));
};

/**
 * Invalidate all report-related query caches after save/delete (v127.0)
 * Includes optional 500ms delay for Firestore consistency
 */
export const invalidateReportQueries = async (
    queryClient: QueryClient,
    customerId: string,
    options?: { includeAssets?: boolean; delay?: boolean }
): Promise<void> => {
    if (options?.delay !== false) {
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    await queryClient.invalidateQueries({ queryKey: ["activities", customerId] });
    await queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
    await queryClient.invalidateQueries({ queryKey: ["customers", "list"] });
    if (options?.includeAssets) {
        await queryClient.invalidateQueries({ queryKey: ["assets", "management"] });
    }
};

/**
 * Upload a single file to Firebase Storage and return the download URL (v127.0)
 */
export const uploadFileToStorage = async (
    file: File,
    storagePath: string
): Promise<string> => {
    const storageRef = sRef(storage, storagePath);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
};
