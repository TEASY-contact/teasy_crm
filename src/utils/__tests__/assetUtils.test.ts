import { describe, it, expect, vi } from 'vitest';

// Mock Firebase to prevent initialization errors in test environment
vi.mock('@/lib/firebase', () => ({
    db: {},
}));

import { getAssetTimestamp, calculateInitialStock, AssetData } from '../assetUtils';

// ─── getAssetTimestamp ───

describe('getAssetTimestamp', () => {
    it('returns seconds from Firestore Timestamp-like object', () => {
        const firestoreTs = { seconds: 1700000000 };
        expect(getAssetTimestamp(firestoreTs)).toBe(1700000000);
    });

    it('returns seconds from JS Date', () => {
        const date = new Date('2026-01-15T00:00:00Z');
        const expected = date.getTime() / 1000;
        expect(getAssetTimestamp(date)).toBe(expected);
    });

    it('returns current time in seconds for null/undefined', () => {
        const before = Date.now() / 1000;
        const result = getAssetTimestamp(null);
        const after = Date.now() / 1000;
        expect(result).toBeGreaterThanOrEqual(before);
        expect(result).toBeLessThanOrEqual(after);
    });

    it('returns current time in seconds for empty object', () => {
        const before = Date.now() / 1000;
        const result = getAssetTimestamp({});
        const after = Date.now() / 1000;
        expect(result).toBeGreaterThanOrEqual(before);
        expect(result).toBeLessThanOrEqual(after);
    });
});

// ─── calculateInitialStock ───

const createAsset = (overrides: Partial<AssetData> = {}): AssetData => ({
    id: 'test-id',
    type: 'inventory',
    category: '소모품',
    name: '마커',
    createdAt: null,
    ...overrides,
});

describe('calculateInitialStock', () => {
    it('calculates stock from empty history', () => {
        const result = calculateInitialStock('마커', '소모품', [], 10);
        expect(result).toBe(10);
    });

    it('sums inflow minus outflow for matching items', () => {
        const assets: AssetData[] = [
            createAsset({ id: '1', lastInflow: 20, lastOutflow: 5 }),
            createAsset({ id: '2', lastInflow: 10, lastOutflow: 3 }),
        ];
        const result = calculateInitialStock('마커', '소모품', assets, 5);
        expect(result).toBe(27); // (20-5) + (10-3) + 5
    });

    it('ignores non-inventory items', () => {
        const assets: AssetData[] = [
            createAsset({ id: '1', type: 'product', lastInflow: 100, lastOutflow: 0 }),
            createAsset({ id: '2', type: 'inventory', lastInflow: 10, lastOutflow: 2 }),
        ];
        const result = calculateInitialStock('마커', '소모품', assets, 5);
        expect(result).toBe(13); // (10-2) + 5
    });

    it('ignores items with different name/category', () => {
        const assets: AssetData[] = [
            createAsset({ id: '1', name: '마커', category: '소모품', lastInflow: 10, lastOutflow: 2 }),
            createAsset({ id: '2', name: '지우개', category: '소모품', lastInflow: 50, lastOutflow: 0 }),
            createAsset({ id: '3', name: '마커', category: '교구', lastInflow: 30, lastOutflow: 0 }),
        ];
        const result = calculateInitialStock('마커', '소모품', assets, 5);
        expect(result).toBe(13); // (10-2) + 5
    });

    it('handles null/undefined inflow/outflow as 0', () => {
        const assets: AssetData[] = [
            createAsset({ id: '1', lastInflow: null, lastOutflow: null }),
            createAsset({ id: '2', lastInflow: undefined, lastOutflow: undefined }),
        ];
        const result = calculateInitialStock('마커', '소모품', assets, 7);
        expect(result).toBe(7);
    });

    it('trims name/category whitespace for matching', () => {
        const assets: AssetData[] = [
            createAsset({ id: '1', name: ' 마커 ', category: ' 소모품 ', lastInflow: 10, lastOutflow: 0 }),
        ];
        const result = calculateInitialStock('마커', '소모품', assets, 5);
        expect(result).toBe(15); // 10 + 5
    });

    it('uses masterId-based matching when provided', () => {
        const assets: AssetData[] = [
            createAsset({ id: '1', masterId: 'M001', name: '다른이름', lastInflow: 20, lastOutflow: 0 }),
            createAsset({ id: '2', masterId: 'M002', lastInflow: 100, lastOutflow: 0 }),
        ];
        const result = calculateInitialStock('마커', '소모품', assets, 5, 'M001');
        expect(result).toBe(25); // 20 + 5
    });
});
