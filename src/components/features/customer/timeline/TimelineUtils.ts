import { TimelineItem } from "@/types/timeline";
import { getTeasyStandardFileName } from "@/utils/textFormatter";

export const STEP_LABELS: Record<string, string> = {
    inquiry: "신규 문의", demo_schedule: "시연 확정", demo_complete: "시연 완료",
    purchase_confirm: "구매 확정", install_schedule: "시공 확정", install_complete: "시공 완료",
    as_schedule: "방문 A/S 확정", as_complete: "방문 A/S 완료", remoteas_complete: "원격 A/S 완료",
    customer_registered: "고객 등록"
};

/**
 * Utility: Color mapping rule identical to MainDashboard.tsx (v123.70)
 */
export const getBadgeColor = (type: string) => {
    const t = type || "";
    const mapping: Record<string, string> = {
        'customer_registered': "blue", 'inquiry': "purple", 'demo_schedule': "blue", 'demo_complete': "purple",
        'purchase_confirm': "purple", 'install_schedule': "green", 'install_complete': "purple",
        'as_schedule': "pink", 'as_complete': "purple", 'remoteas_complete': "purple"
    };
    if (mapping[t]) return mapping[t];
    if (t.includes("원격") && t.includes("완료")) return "purple";
    if (t.includes("A/S") || t.includes("AS")) return t.includes("완료") ? "purple" : "pink";
    if (t.includes("시공") || t.includes("설치")) return t.includes("완료") ? "purple" : "green";
    if (t.includes("구매")) return "purple";
    if (t.includes("시연")) return t.includes("완료") ? "purple" : "blue";
    if (t.includes("문의")) return "purple";
    return "purple";
};

/**
 * Formats file objects with display names based on customer, category, date, and index.
 */
export const prepareFiles = (rawFiles: any[], typeLabel: string, item: TimelineItem) => {
    const content = { ...item, ...(item.content || {}) };
    const isWorkReport = (item.stepType || "").includes("install") || (item.stepType || "").includes("as");
    const category = typeLabel === '사진'
        ? (item.stepType === 'remoteas_complete' ? 'PC사양' : (isWorkReport ? '시공사진' : '현장사진'))
        : (typeLabel === '견적' ? '견적서' : typeLabel);

    return (rawFiles || []).map((f: any, i: number) => ({
        ...(typeof f === 'string' ? { url: f } : f),
        displayName: getTeasyStandardFileName(item.customerName || "고객", category, content.date || "", i, (rawFiles || []).length)
    }));
};
