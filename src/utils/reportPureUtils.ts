import { isWithinBusinessDays, HolidayMap } from "@/utils/dateUtils";
import { Timestamp } from "firebase/firestore";

interface FileLike {
    url?: string;
    [key: string]: any;
}

/**
 * URL-based deduplication for file/photo arrays (v127.0)
 * Removes duplicate entries by comparing base URLs (without query params)
 */
export const deduplicateFiles = <T extends string | FileLike>(list: T[]): T[] => {
    const seen = new Set<string>();
    return (list || []).filter(item => {
        const val = typeof item === 'string' ? item : item?.url;
        if (!val) return false;
        const baseUrl = val.split('?')[0].trim();
        if (seen.has(baseUrl)) return false;
        seen.add(baseUrl);
        return true;
    });
};

/**
 * 3-business-day edit/delete permission check (v127.0)
 * Returns { allowed: true } or { allowed: false, reason: string }
 */
export const checkEditPermission = (opts: {
    createdAt: Timestamp | Date | string | null | undefined;
    userRole: string | undefined;
    holidayMap: HolidayMap | undefined;
}): { allowed: boolean; reason?: string } => {
    const { createdAt, userRole, holidayMap } = opts;
    if (!createdAt) return { allowed: true };
    if (userRole === 'master') return { allowed: true };

    const date = (createdAt as any)?.toDate ? (createdAt as any).toDate() : new Date(createdAt as any);
    if (!isWithinBusinessDays(date, 3, holidayMap)) {
        return {
            allowed: false,
            reason: "작성 후 3영업일이 경과하여 마스터만 수정/삭제 가능합니다."
        };
    }
    return { allowed: true };
};
