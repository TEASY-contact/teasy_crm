/**
 * Formats colons with specific spacing rules (v123.79)
 * Rule: 1 space before, 2 spaces after, unless it's a time format (HH:MM)
 */
export const formatColonSpacing = (text: string): string => {
    if (!text) return text;

    // Regex explanation:
    // Look for ':' that is NOT preceded by a digit AND followed by a digit (to ignore HH:MM)
    // We use a negative lookbehind and lookahead if possible, but JS support varies.
    // Simpler approach: replace all ':' that aren't part of a time pattern.

    // This is a bit complex for a simple regex.
    // Let's use a more robust logic:
    // First, handle specific date-time format (YYYY-MM-DD HH:MM)
    // Then apply general colon spacing, being careful not to break HH:MM
    let result = text;

    // Handle YYYY-MM-DD HH:MM format: ensure single space between date and time
    // and then apply colon spacing to the time part.
    // This regex captures the date part, the space, and the time part.
    result = result.replace(/(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})/g, (match, datePart, timePart) => {
        // Apply colon spacing to the time part (HH:MM)
        // This specific time format should remain HH:MM, no extra spaces around colon
        return `${datePart}  ${timePart}`; // Ensure two spaces between date and time
    });

    // Now, apply general colon spacing: 1 space before, 2 spaces after
    // Use negative lookbehind and lookahead to avoid changing HH:MM patterns
    // This regex targets colons not preceded by a digit and not followed by a digit.
    result = result.replace(/(?<!\d)\s*:\s*(?!\d)/g, ' :  ');

    return result;
};

// Alternative simpler approach:
export const applyColonStandard = (text: string): string => {
    if (!text) return text;
    // Clear existing spaces around colon and enforce 1-before, 2-after standard
    // Skip if it's a digit:digit pattern (Time format 00:00 or range 1:2)
    return text.replace(/(\d)\s*:\s*(\d)|(\s*:\s*)/g, (match, p1, p2) => {
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
