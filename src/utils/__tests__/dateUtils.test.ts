import { describe, it, expect } from 'vitest';
import { isKoreanHoliday, isWithinBusinessDays } from '../dateUtils';

// Helper: create a date in KST-safe way
const kstDate = (year: number, month: number, day: number) =>
    new Date(year, month - 1, day, 12, 0, 0); // noon to avoid timezone edge cases

describe('isKoreanHoliday', () => {
    it('returns true for Saturday', () => {
        // 2026-02-07 is Saturday
        expect(isKoreanHoliday(kstDate(2026, 2, 7))).toBe(true);
    });

    it('returns true for Sunday', () => {
        // 2026-02-08 is Sunday
        expect(isKoreanHoliday(kstDate(2026, 2, 8))).toBe(true);
    });

    it('returns false for weekday without holiday map', () => {
        // 2026-02-09 is Monday
        expect(isKoreanHoliday(kstDate(2026, 2, 9))).toBe(false);
    });

    it('returns true for weekday in holiday map', () => {
        const holidayMap = {
            '2026': {
                '2026-01-01': ['신정']
            }
        };
        expect(isKoreanHoliday(kstDate(2026, 1, 1), holidayMap)).toBe(true);
    });

    it('returns false for weekday not in holiday map', () => {
        const holidayMap = {
            '2026': {
                '2026-01-01': ['신정']
            }
        };
        // 2026-01-05 is Monday, not a holiday
        expect(isKoreanHoliday(kstDate(2026, 1, 5), holidayMap)).toBe(false);
    });
});

describe('isWithinBusinessDays', () => {
    it('returns false for null/undefined start date', () => {
        expect(isWithinBusinessDays(null as any, 3)).toBe(false);
    });

    it('returns true when start date is in the future', () => {
        const futureDate = new Date();
        futureDate.setFullYear(futureDate.getFullYear() + 1);
        expect(isWithinBusinessDays(futureDate, 3)).toBe(true);
    });

    it('returns true for same day (1 business day elapsed)', () => {
        const today = new Date();
        expect(isWithinBusinessDays(today, 3)).toBe(true);
    });
});
