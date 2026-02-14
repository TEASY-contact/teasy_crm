/**
 * Normalizes text by applying standard rules: (v126.5)
 * 1. Cleans 8 types of transparent/unicode spaces (to underscores for specific fields, or regular spaces)
 * 2. Corrects 'crm' to 'CRM'
 */
export const normalizeText = (text: string, toUnderscore: boolean = false): string => {
    if (!text) return text;

    // 8 types of unicode spaces
    const unicodeSpaces = /[\u00A0\u1680\u180E\u2000-\u200A\u202F\u205F\u3000]/g;
    let result = text.replace(unicodeSpaces, toUnderscore ? '_' : ' ');

    // CRM Brand Case Correction (Case-insensitive)
    result = result.replace(/crm/gi, 'CRM');

    return result;
};

// Alternative simpler approach:
export const applyColonStandard = (text: string): string => {
    if (!text) return text;

    // First apply general normalization
    let result = normalizeText(text);

    // Clear existing spaces around colon and enforce 1-before, 2-after standard
    // Skip if it's a digit:digit pattern (Time format 00:00 or range 1:2)
    return result.replace(/(\d)\s*:\s*(\d)|(\s*:\s*)/g, (match, p1, p2) => {
        if (p1 !== undefined && p2 !== undefined) return `${p1}:${p2}`;
        return ' :  ';
    }).replace(/\s+:\s+/g, ' :  '); // Cleanup redundant spaces if any
};
/**
 * Standardizes asset date display with double spaces (v1.73)
 */
export const formatAssetDate = (dateString: string | null | undefined): string => {
    if (!dateString) return "-";
    return dateString.replace(/\s+/g, "  ").replace(/\./g, "-");
};

/**
 * Standardizes asset log or note display with colon spacing and pre-wrap preservation
 */
export const formatAssetDisplay = (text: string | null | undefined): string => {
    if (!text || text === "-") return "-";
    return applyColonStandard(text.replace(/\r/g, "\n"));
};
/**
 * Standardizes filename based on the underscored convention (v124.70)
 * Format: {CleanCustomer}_{Category}_{YYYYMMDD}_{Suffix}
 */
export const getTeasyStandardFileName = (
    customerName: string,
    category: string,
    dateValue: string,
    index?: number,
    total?: number
): string => {
    // 1. Clean Customer Name (Take first part before underscore, remove spaces)
    const cleanCustomer = (customerName || "고객").split('_')[0].replace(/\s/g, '');

    // 2. Format Date (Extract YYYYMMDD from YYYY-MM-DD HH:mm or raw string)
    const rawDate = (dateValue || "").split(" ")[0].replace(/[-\/]/g, "");
    const reportDate = rawDate.length >= 8 ? rawDate.substring(0, 8) : rawDate;

    // 3. Category (Ensure no spaces)
    const cleanCategory = category.replace(/\s/g, '');

    // 4. Suffix (Only if more than one file)
    const suffix = (total && total > 1 && index !== undefined) ? `_${index + 1}` : "";

    return `${cleanCustomer}_${cleanCategory}_${reportDate}${suffix}`;
};
