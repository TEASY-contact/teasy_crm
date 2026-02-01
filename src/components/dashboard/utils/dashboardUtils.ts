// src/components/dashboard/utils/dashboardUtils.ts

/**
 * Utility: Standardized Badge Info Mapping (v123.80)
 */
export const getBadgeInfo = (type: string) => {
    const t = type || "";

    const mapping: Record<string, { text: string, color: string }> = {
        'customer_registered': { text: "신규등록", color: "blue" },
        'inquiry': { text: "신규문의", color: "purple" },
        'demo_schedule': { text: "시연확정", color: "blue" },
        'demo_complete': { text: "시연완료", color: "purple" },
        'purchase_confirm': { text: "구매확정", color: "purple" },
        'install_schedule': { text: "시공확정", color: "green" },
        'install_complete': { text: "시공완료", color: "purple" },
        'as_schedule': { text: "A/S확정", color: "pink" },
        'as_complete': { text: "A/S완료", color: "purple" },
        'remoteas_complete': { text: "원격완료", color: "purple" }
    };

    if (mapping[t]) return mapping[t];

    // Fallback for Korean keywords if type is not standardized
    if (t.includes("원격") && t.includes("완료")) return { text: "원격완료", color: "purple" };
    if (t.includes("A/S") || t.includes("AS")) {
        if (t.includes("완료")) return { text: "A/S완료", color: "purple" };
        return { text: "A/S확정", color: "pink" };
    }
    if (t.includes("시공") || t.includes("설치")) {
        if (t.includes("완료")) return { text: "시공완료", color: "purple" };
        return { text: "시공확정", color: "green" };
    }
    if (t.includes("구매")) return { text: "구매확정", color: "purple" };
    if (t.includes("시연")) {
        if (t.includes("완료")) return { text: "시연완료", color: "purple" };
        return { text: "시연확정", color: "blue" };
    }
    if (t.includes("문의")) return { text: "신규문의", color: "purple" };

    return { text: t, color: "purple" };
};

/**
 * Utility: Extract region from location string
 */
export const extractRegion = (loc: string) => {
    if (!loc) return "";
    const trimmed = loc.trim();
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) {
        // "경상남도 창원시" -> "창원"
        return parts[1].replace(/[시군구]$/, "").substring(0, 2);
    }
    return parts[0].substring(0, 2);
};

/**
 * Utility: Get color from type via getBadgeInfo
 */
export const getBadgeColor = (type: string) => getBadgeInfo(type).color;
