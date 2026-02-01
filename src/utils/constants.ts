// src/utils/constants.ts

/**
 * Standard Date Formats (v1.0.0)
 * yyyy-MM-dd  HH:mm (Double space standard for CRM)
 */
export const DATE_FORMAT_STANDARD = "yyyy-MM-dd  HH:mm";
export const DATE_FORMAT_ONLY = "yyyy-MM-dd";

/**
 * Common Limits
 */
export const MAX_QTY_LIMIT = 9999;

/**
 * Distributor Themes (v1.0.0)
 */
export const DISTRIBUTOR_COLORS: Record<string, { bg: string, color: string }> = {
    'TEASY': { bg: "rgba(128, 90, 213, 0.1)", color: "brand.500" },
    '에이블클래스': { bg: "blue.50", color: "blue.600" },
    '리얼칠판': { bg: "green.50", color: "green.700" },
    '뷰라클': { bg: "yellow.50", color: "orange.600" }
};
