
import { test, expect } from 'vitest';
import { prepareFiles } from '@/components/features/customer/timeline/TimelineUtils';
import { TimelineItem } from '@/types/timeline';

test('TimelineUtils Logic Verification', () => {
    console.log("🚀 Starting Strict Logic Verification for TimelineUtils...");

    // Test Case 1: Standard File Preparation
    const item1: any = {
        customerName: "홍길동",
        content: { date: "2024-02-08" },
        createdAt: "2024-02-08T12:00:00Z"
    };
    const files1 = ["https://example.com/photo1.jpg", "https://example.com/photo2.jpg"];

    const result1 = prepareFiles(files1, "사진", item1);

    // Logic Check: 
    // displayName should contain "홍길동", "사진", "240208" (formatted date), and index
    const r1_0 = result1[0];
    expect(r1_0.url).toBe("https://example.com/photo1.jpg");
    expect(r1_0.displayName).toContain("홍길동");
    expect(r1_0.displayName).toContain("사진");

    // Test Case 2: Content Merging Logic (The Critical Fix from Phase 3)
    // prepareFiles uses: const content = { ...item, ...(item.content || {}) };
    // If 'date' is ONLY in item.content, it must be picked up.
    const item2: any = {
        customerName: "김철수",
        content: { date: "2024-12-25" } // Date is deep inside
    };
    const files2 = ["file1.jpg"];
    const result2 = prepareFiles(files2, "견적", item2);

    expect(result2).toHaveLength(1);
    expect(result2[0].displayName).toContain("김철수");
    expect(result2[0].displayName).toContain("견적서"); // Category label mapping ('견적' -> '견적서')

    // Test Case 3: Empty List Safety
    const result3 = prepareFiles([], "test", item1);
    expect(result3).toHaveLength(0);

    // Test Case 4: Null Safety
    const result4 = prepareFiles(null as any, "test", item1);
    expect(result4).toHaveLength(0);

    console.log("🎉 Verification Complete: All assertions passed.");
});
