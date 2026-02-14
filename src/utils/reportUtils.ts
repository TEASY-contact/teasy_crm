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
            // Changed to Soft Delete (move to deleted_files/) instead of hard delete (v127.1)
            await moveFileToTrash(url);
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
    await queryClient.invalidateQueries({ queryKey: ["customers"] });
    if (options?.includeAssets) {
        await queryClient.invalidateQueries({ queryKey: ["assets", "management"] });
    }
};

export const uploadFileToStorage = async (
    file: File,
    storagePath: string
): Promise<string> => {
    const storageRef = sRef(storage, storagePath);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
};

/**
 * Move a file to the 'deleted_files' folder (Soft Delete) for 30-day retention policies (v127.1)
 * This copies the file to 'deleted_files/{yyyy-mm-dd}/{filename}' and deletes the original.
 */
export const moveFileToTrash = async (url: string): Promise<void> => {
    try {
        const storageRef = sRef(storage, url);
        // 1. Download the file as Blob
        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to fetch file for soft delete");
        const blob = await response.blob();

        // 2. Upload to Trash (deleted_files/YYYY-MM-DD/filename)
        const now = new Date();
        const dateFolder = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        const fileName = storageRef.name;
        const trashPath = `deleted_files/${dateFolder}/${fileName}`;
        const trashRef = sRef(storage, trashPath);

        await uploadBytes(trashRef, blob, {
            customMetadata: {
                originalPath: storageRef.fullPath,
                deletedAt: now.toISOString(),
                deletedBy: "system_soft_delete"
            }
        });

        // 3. Delete Original
        await deleteObject(storageRef);
    } catch (e) {
        console.warn("Soft delete failed for:", url, e);
        // Fail silently or handle error? For now, we warn.
        throw e;
    }
};

