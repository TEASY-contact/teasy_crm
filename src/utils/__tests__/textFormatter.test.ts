import { describe, it, expect } from 'vitest';
import { normalizeText, applyColonStandard, getTeasyStandardFileName } from '../textFormatter';

describe('normalizeText', () => {
    it('returns falsy values as-is', () => {
        expect(normalizeText('')).toBe('');
        expect(normalizeText(null as any)).toBe(null);
    });

    it('replaces unicode spaces with regular spaces', () => {
        // \u00A0 = non-breaking space, \u3000 = ideographic space
        expect(normalizeText('hello\u00A0world')).toBe('hello world');
        expect(normalizeText('hello\u3000world')).toBe('hello world');
    });

    it('replaces unicode spaces with underscores when toUnderscore=true', () => {
        expect(normalizeText('hello\u00A0world', true)).toBe('hello_world');
    });

    it('corrects crm to CRM (case-insensitive)', () => {
        expect(normalizeText('teasy crm system')).toBe('teasy CRM system');
        expect(normalizeText('teasy CRM system')).toBe('teasy CRM system');
        expect(normalizeText('Crm')).toBe('CRM');
    });
});

describe('applyColonStandard', () => {
    it('returns falsy values as-is', () => {
        expect(applyColonStandard('')).toBe('');
    });

    it('preserves digit:digit patterns (time format)', () => {
        const result = applyColonStandard('14:30');
        expect(result).toBe('14:30');
    });

    it('applies 1-before 2-after spacing for non-time colons', () => {
        const result = applyColonStandard('담당자:홍길동');
        expect(result).toContain(' :  ');
    });
});

describe('getTeasyStandardFileName', () => {
    it('generates standard filename format', () => {
        const result = getTeasyStandardFileName('홍길동', '설치완료', '2026-02-07 14:30');
        expect(result).toBe('홍길동_설치완료_20260207');
    });

    it('adds suffix for multiple files', () => {
        const result = getTeasyStandardFileName('홍길동', '설치완료', '2026-02-07', 0, 3);
        expect(result).toBe('홍길동_설치완료_20260207_1');
    });

    it('cleans customer name (takes first part before underscore)', () => {
        const result = getTeasyStandardFileName('홍길동_추가정보', '견적서', '2026-01-15');
        expect(result).toBe('홍길동_견적서_20260115');
    });

    it('defaults to 고객 when customer name is empty', () => {
        const result = getTeasyStandardFileName('', '사진', '2026-03-01');
        expect(result).toBe('고객_사진_20260301');
    });
});
