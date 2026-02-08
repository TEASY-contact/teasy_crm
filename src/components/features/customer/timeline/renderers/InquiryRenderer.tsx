import React from "react";
import { formatPhone } from "@/utils/formatter";
import { ContentItem } from "@/types/timeline";

export const renderInquiryItems = (content: any): ContentItem[] => {
    const items: ContentItem[] = [];
    const hasNickname = content.nickname && content.channel !== "전화 문의";

    if (content.channel) {
        items.push({
            label: "채널",
            value: `${content.channel}${hasNickname ? ` (${content.nickname})` : ""}`
        });
    }
    if (content.channel === "전화 문의" && content.phone) {
        items.push({ label: "전화", value: formatPhone(content.phone), isSubItem: true, isFirstSubItem: true });
    }
    if (content.product) {
        const displayProduct = (content.product || "").toString().toLowerCase() === "crm" ? "CRM" : content.product;
        items.push({ label: "상품", value: displayProduct });
    }
    if (content.result) {
        items.push({ label: "결과", value: content.result });
    }

    return items;
};
