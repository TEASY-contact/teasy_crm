import { describe, it, expect } from 'vitest';
import { deduplicateFiles, checkEditPermission } from '../reportPureUtils';

describe('deduplicateFiles', () => {
    it('returns empty array for null/undefined', () => {
        expect(deduplicateFiles(null as any)).toEqual([]);
        expect(deduplicateFiles(undefined as any)).toEqual([]);
    });

    it('removes duplicates by base URL (ignoring query params)', () => {
        const input = [
            { url: 'https://storage.com/photo1.jpg?token=abc' },
            { url: 'https://storage.com/photo1.jpg?token=xyz' },
            { url: 'https://storage.com/photo2.jpg?token=abc' },
        ];
        const result = deduplicateFiles(input);
        expect(result).toHaveLength(2);
    });

    it('handles string arrays', () => {
        const input = [
            'https://storage.com/a.jpg',
            'https://storage.com/a.jpg',
            'https://storage.com/b.jpg',
        ];
        const result = deduplicateFiles(input);
        expect(result).toHaveLength(2);
    });

    it('filters out items without url', () => {
        const input = [
            { url: 'https://storage.com/a.jpg' },
            { name: 'no-url' },
            null,
        ];
        const result = deduplicateFiles(input as any);
        expect(result).toHaveLength(1);
    });
});

describe('checkEditPermission', () => {
    it('allows when no createdAt', () => {
        expect(checkEditPermission({ createdAt: null, userRole: 'user', holidayMap: {} }))
            .toEqual({ allowed: true });
    });

    it('always allows for master role', () => {
        const oldDate = new Date(2020, 0, 1);
        expect(checkEditPermission({ createdAt: oldDate, userRole: 'master', holidayMap: {} }))
            .toEqual({ allowed: true });
    });

    it('allows for recent date within 3 business days', () => {
        const today = new Date();
        expect(checkEditPermission({ createdAt: today, userRole: 'user', holidayMap: {} }))
            .toEqual({ allowed: true });
    });

    it('denies for old date beyond 3 business days', () => {
        const oldDate = new Date(2020, 0, 1);
        const result = checkEditPermission({ createdAt: oldDate, userRole: 'user', holidayMap: {} });
        expect(result.allowed).toBe(false);
        expect(result.reason).toBeDefined();
    });

    it('handles Firestore Timestamp-like objects', () => {
        const ts = { toDate: () => new Date() };
        expect(checkEditPermission({ createdAt: ts as any, userRole: 'user', holidayMap: {} }))
            .toEqual({ allowed: true });
    });
});
