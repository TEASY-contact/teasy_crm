/**
 * KST (Asia/Seoul) and Korean Holiday Logic (v124.86)
 * API-Driven Holiday Management
 */

export type HolidayMap = Record<string, Record<string, string[]>>;

/**
 * Checks if a given date is a Korean holiday or weekend
 * holidayMap: { [year: string]: { [date: string]: string[] } }
 */
export const isKoreanHoliday = (date: Date, holidayMap?: HolidayMap): boolean => {
    const kstDate = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    const day = kstDate.getDay();

    // 1. Weekend Check (Sat: 6, Sun: 0)
    if (day === 0 || day === 6) return true;

    if (!holidayMap) return false;

    const yyyy = String(kstDate.getFullYear());
    const mm = String(kstDate.getMonth() + 1).padStart(2, '0');
    const dd = String(kstDate.getDate()).padStart(2, '0');
    const fullDate = `${yyyy}-${mm}-${dd}`;

    // Check if the date exists in the API holiday map
    return !!(holidayMap[yyyy] && holidayMap[yyyy][fullDate]);
};

/**
 * Calculates if the elapsed work days since startDate is within the limit
 */
export const isWithinBusinessDays = (startDate: Date, limit: number, holidayMap?: HolidayMap): boolean => {
    if (!startDate) return false;

    // Normalize to KST
    const start = new Date(new Date(startDate).toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    start.setHours(0, 0, 0, 0);

    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    now.setHours(0, 0, 0, 0);

    if (now < start) return true;

    let businessDays = 0;
    const current = new Date(start);

    // If holidayMap is not yet loaded, we only have weekend info (limited accuracy)
    // But we still count days.
    while (current <= now) {
        if (!isKoreanHoliday(current, holidayMap)) {
            businessDays++;
        }

        // Safety break
        if (businessDays > limit + 14) return false;

        current.setDate(current.getDate() + 1);
    }

    return businessDays <= limit;
};
