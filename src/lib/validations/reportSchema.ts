// src/lib/validations/reportSchema.ts
import { z } from "zod";

export const inquirySchema = z.object({
    date: z.string().min(1, "문의 일시는 필수입니다."),
    manager: z.string().min(1, "담당자는 필수입니다."),
    channel: z.enum(["전화 문의", "네이버 톡톡", "채널톡", "기타"]),
    nickname: z.string().optional(),
    phone: z.string().regex(/^0\d{1,2}-\d{3,4}-\d{4}$/).optional(),
    audioUrls: z.array(z.string()).optional(),
    product: z.string().min(1, "문의 상품을 선택해주세요."),
    result: z.enum(["구매 예정", "시연 확정", "시연 고민", "관심 없음"]),
    memo: z.string().optional(),
    estimateUrls: z.array(z.string()).optional(),
});
