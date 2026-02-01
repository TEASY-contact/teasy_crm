// src/components/features/asset/AssetModalUtils.ts

export { DATE_FORMAT_STANDARD, MAX_QTY_LIMIT } from "@/utils/constants";

export const INVENTORY_CATEGORIES = [
    { value: "빔 프로젝터", label: "빔 프로젝터" },
    { value: "TV", label: "TV" },
    { value: "터치 센서", label: "터치 센서" },
    { value: "브라켓", label: "브라켓" },
    { value: "거치대", label: "거치대" },
    { value: "케이블", label: "케이블" },
    { value: "소모품", label: "소모품" },
];

export const PRODUCT_CATEGORIES = [
    { value: "전자칠판", label: "전자칠판" },
    { value: "터치센서", label: "터치센서" },
    { value: "S/W", label: "S/W" },
    { value: "인강 사이트", label: "인강 사이트" },
    { value: "빔프로젝터", label: "빔프로젝터" },
];

/**
 * Utility: Get circled number string (①-⑳)
 */
export const getCircledNumber = (num: number) => {
    const circled = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩", "⑪", "⑫", "⑬", "⑭", "⑮", "⑯", "⑰", "⑱", "⑲", "⑳"];
    return circled[num - 1] || `${num}.`;
};

/**
 * Utility: Clean component string from hierarchy symbols
 */
export const cleanComponentString = (s: string) => {
    const clean = s.trim();
    if (clean === "-----") return `__DIVIDER__${Math.random()}`;
    return clean.replace(/^[①-⑳]|^(\d+\.)/, "").trim();
};
