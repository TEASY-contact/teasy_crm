export const isWithinBusinessDays = (startDate: Date, limit: number): boolean => {
    if (!startDate) return false;
    const now = new Date();

    // Normalize to start of day to compare full days
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(now);
    end.setHours(0, 0, 0, 0);

    if (end < start) return true; // Future date (shouldn't happen but valid)

    let businessDays = 0;
    const current = new Date(start);

    while (current <= end) {
        const day = current.getDay();
        if (day !== 0 && day !== 6) { // 0: Sun, 6: Sat
            businessDays++;
        }

        // Safety break to prevent infinite loops if dates are way off
        if (businessDays > limit + 1) return false;

        current.setDate(current.getDate() + 1);
    }

    return businessDays <= limit;
};
