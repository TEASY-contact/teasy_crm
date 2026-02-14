import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { deduplicateFiles, checkEditPermission } from '../reportPureUtils';

// ─── deduplicateFiles ───

describe('deduplicateFiles', () => {
    it('removes duplicate strings by base URL', () => {
        const files = [
            'https://storage.com/a.jpg?token=abc',
            'https://storage.com/a.jpg?token=xyz',
            'https://storage.com/b.jpg',
        ];
        const result = deduplicateFiles(files);
        expect(result).toHaveLength(2);
        expect(result[0]).toBe('https://storage.com/a.jpg?token=abc');
        expect(result[1]).toBe('https://storage.com/b.jpg');
    });

    it('removes duplicate objects by url field', () => {
        const files = [
            { url: 'https://storage.com/a.jpg?v=1', name: 'a1' },
            { url: 'https://storage.com/a.jpg?v=2', name: 'a2' },
            { url: 'https://storage.com/b.jpg', name: 'b' },
        ];
        const result = deduplicateFiles(files);
        expect(result).toHaveLength(2);
        expect(result[0].name).toBe('a1'); // 첫 번째 것 유지
        expect(result[1].name).toBe('b');
    });

    it('handles empty/null input', () => {
        expect(deduplicateFiles([])).toEqual([]);
        expect(deduplicateFiles(null as any)).toEqual([]);
        expect(deduplicateFiles(undefined as any)).toEqual([]);
    });

    it('filters out items without url', () => {
        const files = [
            { name: 'no-url' },
            { url: 'https://storage.com/a.jpg', name: 'has-url' },
        ];
        const result = deduplicateFiles(files);
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('has-url');
    });

    it('handles mixed string and object items', () => {
        const files = [
            'https://storage.com/a.jpg',
            { url: 'https://storage.com/a.jpg?v=2', name: 'dup' },
            { url: 'https://storage.com/b.jpg', name: 'unique' },
        ];
        const result = deduplicateFiles(files);
        expect(result).toHaveLength(2); // 'a.jpg' + 'b.jpg'
    });
});

// ─── checkEditPermission ───

describe('checkEditPermission', () => {
    it('allows edit for master role regardless of time', () => {
        const oldDate = new Date('2020-01-01');
        const result = checkEditPermission({
            createdAt: oldDate,
            userRole: 'master',
            holidayMap: undefined,
        });
        expect(result.allowed).toBe(true);
    });

    it('allows edit when createdAt is null', () => {
        const result = checkEditPermission({
            createdAt: null,
            userRole: 'employee',
            holidayMap: undefined,
        });
        expect(result.allowed).toBe(true);
    });

    it('allows edit for recent creation (within 3 business days)', () => {
        const now = new Date();
        const result = checkEditPermission({
            createdAt: now,
            userRole: 'employee',
            holidayMap: undefined,
        });
        expect(result.allowed).toBe(true);
    });

    it('denies edit for old creation (beyond 3 business days)', () => {
        // 30 days ago — definitely beyond 3 business days
        const oldDate = new Date();
        oldDate.setDate(oldDate.getDate() - 30);
        const result = checkEditPermission({
            createdAt: oldDate,
            userRole: 'employee',
            holidayMap: undefined,
        });
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('3영업일');
    });

    it('handles Firestore Timestamp-like object with toDate()', () => {
        const now = new Date();
        const firestoreTs = { toDate: () => now };
        const result = checkEditPermission({
            createdAt: firestoreTs as any,
            userRole: 'employee',
            holidayMap: undefined,
        });
        expect(result.allowed).toBe(true);
    });
});
