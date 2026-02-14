import { describe, it, expect } from 'vitest';
import { parseRegion } from '../addressParser';

describe('parseRegion', () => {
    it('extracts city name without 시 suffix', () => {
        expect(parseRegion('수원시 팔달구 어딘가')).toBe('수원');
        expect(parseRegion('성남시 분당구')).toBe('성남');
    });

    it('handles special city: 서울특별시', () => {
        expect(parseRegion('서울특별시 강남구')).toBe('서울');
    });

    it('handles special city: 광주광역시', () => {
        expect(parseRegion('광주광역시 서구')).toBe('광주');
    });

    it('falls back to first 2 characters', () => {
        expect(parseRegion('경기도 어딘가')).toBe('경기');
    });
});
