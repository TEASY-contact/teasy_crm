import { describe, it, expect } from 'vitest';
import { formatPhone, formatAmount, formatLicenseKey, formatDateTime, formatTimestamp } from '../formatter';

describe('formatPhone', () => {
    it('returns empty string for null/undefined', () => {
        expect(formatPhone(null)).toBe('');
        expect(formatPhone(undefined)).toBe('');
        expect(formatPhone('')).toBe('');
    });

    it('formats Seoul (02) numbers correctly', () => {
        expect(formatPhone('0212345678')).toBe('02-1234-5678');
        expect(formatPhone('021234567')).toBe('02-123-4567');
        expect(formatPhone('02123')).toBe('02-123');
    });

    it('formats mobile (010) numbers correctly', () => {
        expect(formatPhone('01012345678')).toBe('010-1234-5678');
        expect(formatPhone('0101234567')).toBe('010-123-4567');
        expect(formatPhone('010123')).toBe('010-123');
    });

    it('strips non-digit characters', () => {
        expect(formatPhone('010-1234-5678')).toBe('010-1234-5678');
        expect(formatPhone('(02) 1234-5678')).toBe('02-1234-5678');
    });
});

describe('formatAmount', () => {
    it('formats with comma separators', () => {
        expect(formatAmount('1000000')).toBe('1,000,000');
        expect(formatAmount('500')).toBe('500');
    });

    it('formats as discount (negative)', () => {
        expect(formatAmount('50000', true)).toBe('-50,000');
    });

    it('returns empty string for empty input', () => {
        expect(formatAmount('')).toBe('');
    });
});

describe('formatLicenseKey', () => {
    it('chunks into 5-char groups with dashes', () => {
        expect(formatLicenseKey('abcde12345fghij')).toBe('ABCDE-12345-FGHIJ');
    });

    it('converts to uppercase', () => {
        expect(formatLicenseKey('abc')).toBe('ABC');
    });

    it('strips special characters', () => {
        expect(formatLicenseKey('ab-cd!ef')).toBe('ABCDE-F');
    });
});

describe('formatDateTime', () => {
    it('formats full datetime with double space', () => {
        expect(formatDateTime('202602071430')).toBe('2026-02-07  14:30');
    });

    it('formats partial date', () => {
        expect(formatDateTime('20260207')).toBe('2026-02-07');
    });

    it('formats year-month only', () => {
        expect(formatDateTime('202602')).toBe('2026-02');
    });
});

describe('formatTimestamp', () => {
    it('returns empty string for null', () => {
        expect(formatTimestamp(null)).toBe('');
        expect(formatTimestamp(undefined)).toBe('');
    });

    it('formats Date object', () => {
        const date = new Date(2026, 1, 7, 14, 30); // Feb 7, 2026 14:30
        expect(formatTimestamp(date)).toBe('2026-02-07 14:30');
    });

    it('handles Firestore Timestamp-like objects', () => {
        const ts = { toDate: () => new Date(2026, 0, 15, 9, 5) };
        expect(formatTimestamp(ts)).toBe('2026-01-15 09:05');
    });

    it('returns empty for invalid date', () => {
        expect(formatTimestamp('invalid')).toBe('');
    });
});
