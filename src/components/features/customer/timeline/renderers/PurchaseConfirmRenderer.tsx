import React from "react";
import { Box, HStack, Text } from "@chakra-ui/react";
import { formatAmount } from "@/utils/formatter";
import { ThinParen, TimelineFileList } from "@/components/common/UIComponents";
import { ContentItem, TimelineItem } from "@/types/timeline";
import { getTeasyStandardFileName } from "@/utils/textFormatter";

export const renderPurchaseConfirmItems = (item: TimelineItem, content: any): ContentItem[] => {
    const items: ContentItem[] = [];

    // Prepare tax invoice files if present
    const category = "전자세금계산서";
    const rawFiles = content.taxInvoice ? [content.taxInvoice] : [];
    const taxInvoiceFiles = rawFiles.map((f: any, i: number) => ({
        ...(typeof f === 'string' ? { url: f } : f),
        displayName: getTeasyStandardFileName(item.customerName || "고객", category, content.date || "", i, rawFiles.length)
    }));

    const categoryLabel = content.productCategory === "product" ? "시공" : (content.productCategory === "inventory" ? "배송" : "");
    const validProducts = (content.selectedProducts || []).filter((p: any) => p.name && p.name.trim() !== "");

    if (validProducts.length > 0) {
        const productList = validProducts.map((p: any, idx: number) => {
            const circle = validProducts.length > 1 ? String.fromCharCode(9312 + idx) : "";
            const rawName = p.name || "";
            const cleanName = rawName.toLowerCase() === "crm" ? "CRM" : rawName;
            return `${circle}${cleanName} × ${p.quantity}`;
        }).join("\n");
        items.push({
            label: "상품",
            value: (
                <HStack spacing={2} display="inline-flex" align="top">
                    {categoryLabel && (
                        <Box as="span" bg="gray.100" color="gray.500" fontSize="10px" px={1.5} h="18px" borderRadius="4px" fontWeight="bold" display="flex" alignItems="center" flexShrink={0} mt="2px">
                            {categoryLabel}
                        </Box>
                    )}
                    <Text as="span" whiteSpace="pre-wrap" lineHeight="1.6"><ThinParen text={productList} /></Text>
                </HStack>
            )
        });
    } else if (content.product) {
        let displayProduct = (content.product || "").toString().toLowerCase() === "crm" ? "CRM" : content.product;
        if (displayProduct.startsWith("①") && !displayProduct.includes("②")) {
            displayProduct = displayProduct.substring(1).trim();
        }
        items.push({
            label: "상품",
            value: (
                <HStack spacing={2} display="inline-flex" align="top">
                    {categoryLabel && (
                        <Box as="span" bg="gray.100" color="gray.500" fontSize="10px" px={1.5} h="18px" borderRadius="4px" fontWeight="bold" display="flex" alignItems="center" flexShrink={0}>
                            {categoryLabel}
                        </Box>
                    )}
                    <Text as="span" whiteSpace="pre-wrap" lineHeight="1.6">{displayProduct}</Text>
                </HStack>
            )
        });
    }

    if (content.payMethod) {
        items.push({ label: "결제", value: content.payMethod });
    }
    if (content.amount) {
        items.push({ label: "금액", value: `${formatAmount(String(content.amount))}원`, isSubItem: true, isFirstSubItem: true });
    }

    const hasDiscount = content.discount && content.discount !== "미적용";
    if (content.discountAmount) {
        const formattedVal = formatAmount(String(content.discountAmount), true);
        const displayValue = hasDiscount ? `${content.discount} (${formattedVal}원)` : `${formattedVal}원`;
        items.push({ label: "할인", value: displayValue, isSubItem: true, isFirstSubItem: !content.amount });
    }
    if (content.userId) {
        const displayValue = hasDiscount ? `${content.discount} (${content.userId})` : `(${content.userId})`;
        items.push({ label: "할인", value: displayValue, isSubItem: true, isFirstSubItem: !content.amount && !content.discountAmount });
    }
    if (hasDiscount && !content.discountAmount && !content.userId) {
        items.push({ label: "할인", value: content.discount, isSubItem: true, isFirstSubItem: !content.amount });
    }

    const isAmountPresent = !!content.amount;
    const isDiscountPresent = hasDiscount || !!content.discountAmount || !!content.userId;

    if (taxInvoiceFiles.length > 0 && content.payMethod === '입금') {
        items.push({
            label: "증빙",
            value: (
                <TimelineFileList
                    files={taxInvoiceFiles}
                    label="증빙"
                    isSubItem={true}
                    isFirstSubItem={!isAmountPresent && !isDiscountPresent}
                    uploader={item.createdByName}
                    timestamp={item.createdAt}
                />
            ),
            isCustomValue: true
        });
    }

    if (content.productCategory === 'inventory' && content.deliveryInfo) {
        const { courier, trackingNumber, shipmentDate, deliveryAddress } = content.deliveryInfo;
        const datePart = (shipmentDate || "").split(" ")[0];
        if (datePart || deliveryAddress) {
            const separator = (datePart && deliveryAddress) ? "  /  " : "";
            items.push({ label: "배송", value: `${datePart}${separator}${deliveryAddress || ""}` });
        }
        if (courier) {
            items.push({ label: "업체", value: courier, isSubItem: true, isFirstSubItem: true });
        }
        if (trackingNumber) {
            items.push({ label: "송장", value: trackingNumber, isSubItem: true, isFirstSubItem: !courier });
        }
    }

    return items;
};
