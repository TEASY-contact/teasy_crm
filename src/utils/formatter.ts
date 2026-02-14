import { Timestamp } from "firebase/firestore";

export const formatPhone = (val: string | null | undefined) => {
    if (!val) return "";
    const nums = val.replace(/[^\d]/g, "");
    if (nums.startsWith("02")) {
        if (nums.length <= 2) return nums;
        if (nums.length <= 5) return `${nums.slice(0, 2)}-${nums.slice(2)}`;
        if (nums.length <= 9) return `${nums.slice(0, 2)}-${nums.slice(2, 5)}-${nums.slice(5)}`;
        return `${nums.slice(0, 2)}-${nums.slice(2, 6)}-${nums.slice(6, 10)}`;
    }
    if (nums.length <= 3) return nums;
    if (nums.length <= 6) return `${nums.slice(0, 3)}-${nums.slice(3)}`;
    if (nums.length <= 10) return `${nums.slice(0, 3)}-${nums.slice(3, 6)}-${nums.slice(6)}`;
    return `${nums.slice(0, 3)}-${nums.slice(3, 7)}-${nums.slice(7, 11)}`;
};

export const formatAmount = (val: string, isDiscount = false) => {
    const num = val.replace(/[^\d]/g, "");
    const formatted = num.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    if (!num) return "";
    return isDiscount ? `-${formatted}` : formatted;
};

export const formatLicenseKey = (val: string) => {
    // Regex: A-Z, 0-9 only (uppercase processed after)
    const raw = val.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 25);
    const chunks = raw.match(/.{1,5}/g);
    return chunks ? chunks.join("-") : raw;
};

export const formatDateTime = (val: string) => {
    const nums = val.replace(/[^\d]/g, "").slice(0, 12);
    let res = "";
    if (nums.length > 0) res += nums.slice(0, 4);
    if (nums.length > 4) res += "-" + nums.slice(4, 6);
    if (nums.length > 6) res += "-" + nums.slice(6, 8);
    if (nums.length > 8) res += "  " + nums.slice(8, 10);
    if (nums.length > 10) res += ":" + nums.slice(10, 12);
    return res;
};
export const formatTimestamp = (ts: Timestamp | Date | string | number | null | undefined): string => {
    if (!ts) return "";

    let date: Date;
    if (ts instanceof Timestamp) {
        date = ts.toDate();
    } else if (ts instanceof Date) {
        date = ts;
    } else if (ts && typeof ts === 'object' && 'toDate' in ts && typeof (ts as any).toDate === 'function') {
        date = (ts as any).toDate();
    } else {
        date = new Date(ts as any);
    }

    if (isNaN(date.getTime())) return "";

    const YYYY = date.getFullYear();
    const MM = String(date.getMonth() + 1).padStart(2, "0");
    const DD = String(date.getDate()).padStart(2, "0");
    const HH = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");

    return `${YYYY}-${MM}-${DD}  ${HH}:${mm}`;
};
