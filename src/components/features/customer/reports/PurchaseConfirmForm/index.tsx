"use client";

import React, { forwardRef, useImperativeHandle, useState, useEffect, useRef } from "react";
import { VStack, FormControl, Box, Spinner, HStack, useToast, Flex, Text, IconButton, Badge } from "@chakra-ui/react";
import { MdRemove, MdAdd, MdDragHandle } from "react-icons/md";
import { Reorder, useDragControls } from "framer-motion";
import { formatAmount } from "@/utils/formatter";
import { CustomSelect } from "@/components/common/CustomSelect";
import { TeasyDateTimeInput, TeasyFormLabel, TeasyInput, TeasyTextarea } from "@/components/common/UIComponents";
import { useReportMetadata } from "@/hooks/useReportMetadata";
import { getCircledNumber } from "@/components/features/asset/AssetModalUtils";
import { usePurchaseForm, PurchaseFormData, SelectedProduct } from "./usePurchaseForm";

// --- Sub Component for Advanced Reorder Item ---
const ProductItem = ({ item, idx, isReadOnly, onUpdateQty, constraintsRef }: {
    item: SelectedProduct,
    idx: number,
    isReadOnly: boolean,
    onUpdateQty: (id: string, delta: number) => void,
    constraintsRef: React.RefObject<HTMLDivElement>
}) => {
    const controls = useDragControls();

    return (
        <Reorder.Item
            as="div"
            value={item}
            dragListener={false}
            dragControls={controls}
            dragConstraints={constraintsRef}
            dragElastic={0.1}
            whileDrag={{
                scale: 1.02,
                boxShadow: "0 10px 25px rgba(128, 90, 213, 0.15)",
                zIndex: 50
            }}
            whileTap={{ backgroundColor: "rgba(128, 90, 213, 0.05)" }}
            style={{ marginBottom: "8px", userSelect: "none" }}
        >
            <HStack
                justify="space-between"
                bg="white"
                px={3}
                py={1.5}
                borderRadius="md"
                shadow="xs"
                border="1px solid transparent"
                transition="all 0.2s"
                _active={!isReadOnly ? { bg: "brand.50", borderColor: "brand.200" } : {}}
            >
                <HStack spacing={3} flex={1}>
                    <Box
                        color="gray.300"
                        cursor={isReadOnly ? "default" : "grab"}
                        _active={!isReadOnly ? { cursor: "grabbing" } : { w: "full" }}
                        onPointerDown={(e) => !isReadOnly && controls.start(e)}
                        p={1}
                        borderRadius="sm"
                        _hover={!isReadOnly ? { bg: "gray.100", color: "gray.400" } : {}}
                        display="flex"
                        alignItems="center"
                    >
                        <MdDragHandle size="18" />
                    </Box>
                    <Text fontSize="sm" color="gray.700" fontWeight="medium">
                        <Text as="span" color="brand.500" mr={2} fontWeight="bold">
                            {getCircledNumber(idx + 1)}
                        </Text>
                        {item.name}
                    </Text>
                </HStack>
                <HStack spacing={2}>
                    {!isReadOnly && (
                        <IconButton
                            aria-label="decrease-qty"
                            icon={<MdRemove />}
                            size="xs"
                            variant="ghost"
                            colorScheme="gray"
                            onClick={() => onUpdateQty(item.id, -1)}
                        />
                    )}
                    <Badge
                        bg="brand.50"
                        color="brand.600"
                        fontSize="11px"
                        px={2}
                        h="18px"
                        minW="30px"
                        borderRadius="4px"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                    >
                        {item.quantity}
                    </Badge>
                    {!isReadOnly && (
                        <IconButton
                            aria-label="increase-qty"
                            icon={<MdAdd />}
                            size="xs"
                            variant="ghost"
                            colorScheme="gray"
                            onClick={() => onUpdateQty(item.id, 1)}
                        />
                    )}
                </HStack>
            </HStack>
        </Reorder.Item>
    );
};

interface PurchaseConfirmFormProps {
    customer: any; // Using any for large customer object for now, but can be refined
    activityId?: string;
    initialData?: any;
    isReadOnly?: boolean;
    defaultManager?: string;
}

export const PurchaseConfirmForm = forwardRef<any, PurchaseConfirmFormProps>(
    ({ customer, activityId, initialData, isReadOnly = false, defaultManager = "" }, ref) => {
        const { managerOptions, products, inventoryItems, rawAssets } = useReportMetadata();
        const [productCategory, setProductCategory] = useState<string>(initialData?.productCategory || "");
        const scrollContainerRef = useRef<HTMLDivElement>(null);

        const [formData, setFormData] = useState<PurchaseFormData>({
            date: "",
            manager: defaultManager,
            selectedProducts: [],
            payMethod: "",
            amount: "",
            discount: "미적용",
            discountAmount: "",
            userId: "",
            memo: "",
            deliveryInfo: {
                courier: "",
                shipmentDate: "",
                trackingNumber: "",
                deliveryAddress: customer?.address || ""
            }
        });

        // Initialize/Sync Form Data
        useEffect(() => {
            const now = new Date();
            const formattedNow = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}  ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

            if (initialData) {
                if (initialData.productCategory) setProductCategory(initialData.productCategory);
                setFormData({
                    date: initialData.date || formattedNow,
                    manager: initialData.manager || defaultManager,
                    selectedProducts: initialData.selectedProducts || [],
                    payMethod: initialData.payMethod || "",
                    amount: initialData.amount || "",
                    discount: initialData.discount || "미적용",
                    discountAmount: initialData.discountAmount || "",
                    userId: initialData.userId || "",
                    memo: initialData.memo || "",
                    deliveryInfo: {
                        courier: initialData.deliveryInfo?.courier || "",
                        shipmentDate: initialData.deliveryInfo?.shipmentDate || formattedNow,
                        trackingNumber: initialData.deliveryInfo?.trackingNumber || "",
                        deliveryAddress: initialData.deliveryInfo?.deliveryAddress || customer?.address || ""
                    }
                });
            } else {
                setFormData(prev => ({
                    ...prev,
                    date: prev.date || formattedNow,
                    manager: prev.manager || defaultManager,
                    deliveryInfo: {
                        ...prev.deliveryInfo,
                        shipmentDate: prev.deliveryInfo.shipmentDate || formattedNow,
                        deliveryAddress: prev.deliveryInfo.deliveryAddress || customer?.address || ""
                    }
                }));
            }
        }, [initialData, defaultManager, customer]);

        // Auto-detect Category
        useEffect(() => {
            if (formData.selectedProducts.length > 0 && !productCategory) {
                const firstId = formData.selectedProducts[0].id;
                if (products.some(p => p.value === firstId)) {
                    setProductCategory("product");
                } else if (inventoryItems.some(i => i.value === firstId)) {
                    setProductCategory("inventory");
                }
            }
        }, [formData.selectedProducts, products, inventoryItems, productCategory]);

        // --- Business Logic via Custom Hook ---
        const { handleSubmit, handleDelete, isLoading } = usePurchaseForm({
            customer,
            activityId,
            formData,
            productCategory: productCategory as 'product' | 'inventory',
            managerOptions,
            inventoryItems
        });

        useImperativeHandle(ref, () => ({
            submit: handleSubmit,
            delete: handleDelete
        }));

        const handleUpdateQty = (id: string, delta: number) => {
            const targetIdx = formData.selectedProducts.findIndex((p: any) => p.id === id);
            if (targetIdx === -1) return;

            const newSelected = [...formData.selectedProducts];
            const currentQty = newSelected[targetIdx].quantity;

            if (currentQty + delta <= 0) {
                if (window.confirm("항목을 삭제하시겠습니까?")) {
                    newSelected.splice(targetIdx, 1);
                } else {
                    return;
                }
            } else {
                newSelected[targetIdx].quantity += delta;
            }
            setFormData({ ...formData, selectedProducts: newSelected });
        };

        const handleReorder = (newOrder: SelectedProduct[]) => {
            setFormData({ ...formData, selectedProducts: newOrder });
        };

        const payMethodOptions = [
            { value: "입금", label: "입금" },
            { value: "네이버", label: "네이버" },
            { value: "자사몰", label: "자사몰" }
        ];

        const discountOptions = (() => {
            if (formData.payMethod === "네이버") {
                return [
                    { value: "미적용", label: "미적용" },
                    { value: "divider", label: "", isDivider: true },
                    { value: "할인쿠폰 5%", label: "할인쿠폰 5%" },
                    { value: "할인쿠폰 8%", label: "할인쿠폰 8%" }
                ];
            }
            if (formData.payMethod === "입금") {
                return [
                    { value: "미적용", label: "미적용" },
                    { value: "현금 할인", label: "현금 할인" }
                ];
            }
            return [
                { value: "미적용", label: "미적용" },
                { value: "divider", label: "", isDivider: true },
                { value: "쿠폰 할인", label: "쿠폰 할인" }
            ];
        })();

        return (
            <Box position="relative">
                {isLoading && (
                    <Flex position="absolute" top={0} left={0} right={0} bottom={0} bg="whiteAlpha.700" zIndex={10} align="center" justify="center">
                        <Spinner size="xl" color="brand.500" thickness="4px" />
                    </Flex>
                )}
                <VStack spacing={6} align="stretch">
                    <HStack spacing={4}>
                        <FormControl isRequired>
                            <TeasyFormLabel>구매 일시</TeasyFormLabel>
                            <TeasyDateTimeInput
                                value={formData.date}
                                onChange={(val: string) => !isReadOnly && setFormData({ ...formData, date: val })}
                                isDisabled={isReadOnly}
                            />
                        </FormControl>
                        <FormControl isRequired>
                            <TeasyFormLabel>담당자</TeasyFormLabel>
                            <CustomSelect
                                placeholder="선택"
                                value={formData.manager}
                                onChange={(val) => !isReadOnly && setFormData({ ...formData, manager: val })}
                                options={managerOptions}
                                isDisabled={isReadOnly}
                            />
                        </FormControl>
                    </HStack>

                    <FormControl isRequired>
                        <TeasyFormLabel>구매 상품</TeasyFormLabel>
                        <VStack align="stretch" spacing={3}>
                            <HStack flex={1} spacing={2}>
                                <Box flex={1}>
                                    <CustomSelect
                                        placeholder="선택"
                                        value={productCategory}
                                        onChange={(val) => setProductCategory(val)}
                                        options={[
                                            { value: "product", label: "시공 상품" },
                                            { value: "inventory", label: "배송 상품" }
                                        ]}
                                        isDisabled={isReadOnly || formData.selectedProducts.length > 0}
                                    />
                                </Box>
                                <Box flex={1}>
                                    {(() => {
                                        const rawDelivery = inventoryItems.filter(i => i.isDeliveryItem || i.isDivider);
                                        const deliveryFiltered = rawDelivery.reduce((acc: any[], item, idx, arr) => {
                                            if (item.isDivider) {
                                                const hasFollowupItems = arr.slice(idx + 1).some(next => !next.isDivider && next.isDeliveryItem);
                                                if (hasFollowupItems) acc.push(item);
                                            } else {
                                                const currentStock = rawAssets
                                                    .filter(a => (a.name || "").trim() === (item.label || "").trim() && a.type === "inventory")
                                                    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))[0]?.stock ?? 0;

                                                acc.push({ ...item, label: `${item.label} (${currentStock}개)` });
                                            }
                                            return acc;
                                        }, []);
                                        const isEmptyDelivery = productCategory === "inventory" && deliveryFiltered.filter(i => !i.isDivider).length === 0;

                                        return (
                                            <CustomSelect
                                                placeholder={isEmptyDelivery ? "배송 가능 물품 없음" : "선택"}
                                                value=""
                                                onChange={(val) => {
                                                    if (isReadOnly || !val) return;
                                                    const currentList = productCategory === "product" ? products : inventoryItems;
                                                    const productInfo = currentList.find(p => p.value === val);
                                                    if (!productInfo) return;

                                                    const existingIdx = formData.selectedProducts.findIndex((p: any) => p.id === val);
                                                    let newSelected;
                                                    if (existingIdx > -1) {
                                                        newSelected = [...formData.selectedProducts];
                                                        newSelected[existingIdx].quantity += 1;
                                                    } else {
                                                        newSelected = [...formData.selectedProducts, { id: val, name: productInfo.label, quantity: 1 }];
                                                    }
                                                    setFormData({ ...formData, selectedProducts: newSelected });
                                                }}
                                                options={
                                                    !productCategory
                                                        ? []
                                                        : productCategory === "product"
                                                            ? products
                                                            : deliveryFiltered
                                                }
                                                isDisabled={isReadOnly || !productCategory || isEmptyDelivery}
                                            />
                                        );
                                    })()}
                                </Box>
                            </HStack>

                            {formData.selectedProducts.length > 0 && (
                                <VStack align="stretch" spacing={2} p={3} bg="gray.50" borderRadius="md" border="1px" borderColor="gray.100" ref={scrollContainerRef}>
                                    <Reorder.Group
                                        as="div"
                                        axis="y"
                                        values={formData.selectedProducts}
                                        onReorder={handleReorder}
                                        style={{ listStyleType: "none", padding: "2px", overflow: "hidden" }}
                                    >
                                        {formData.selectedProducts.map((item: any, idx: number) => (
                                            <ProductItem
                                                key={item.id}
                                                item={item}
                                                idx={idx}
                                                isReadOnly={isReadOnly}
                                                onUpdateQty={handleUpdateQty}
                                                constraintsRef={scrollContainerRef}
                                            />
                                        ))}
                                    </Reorder.Group>
                                </VStack>
                            )}
                        </VStack>
                    </FormControl>

                    <FormControl isRequired>
                        <TeasyFormLabel>결제 방식</TeasyFormLabel>
                        <VStack align="stretch" spacing={3}>
                            <CustomSelect
                                placeholder="선택"
                                value={formData.payMethod}
                                onChange={(val) => !isReadOnly && setFormData({ ...formData, payMethod: val, amount: "", discount: "미적용", discountAmount: "", userId: "" })}
                                options={payMethodOptions}
                                isDisabled={isReadOnly}
                            />

                            {formData.payMethod && (
                                <Box p={3} bg="gray.50" borderRadius="md" border="1px" borderColor="gray.100">
                                    <VStack spacing={4}>
                                        <FormControl isRequired isDisabled={isReadOnly}>
                                            <TeasyFormLabel sub>결제 금액</TeasyFormLabel>
                                            <TeasyInput
                                                bg="white"
                                                value={formData.amount}
                                                onChange={(e) => !isReadOnly && setFormData({ ...formData, amount: formatAmount(e.target.value) })}
                                                placeholder="숫자 입력"
                                                isDisabled={isReadOnly}
                                                _readOnly={{ bg: "gray.50", cursor: "default", color: "gray.600" }}
                                            />
                                        </FormControl>
                                        <HStack w="full" align="flex-end">
                                            <FormControl isDisabled={isReadOnly}>
                                                <TeasyFormLabel sub>할인 내역</TeasyFormLabel>
                                                <CustomSelect
                                                    value={formData.discount}
                                                    onChange={(val) => {
                                                        if (isReadOnly) return;
                                                        const isNoDiscount = val === "미적용";
                                                        setFormData({
                                                            ...formData,
                                                            discount: val,
                                                            ...(isNoDiscount ? { discountAmount: "", userId: "" } : {})
                                                        });
                                                    }}
                                                    options={discountOptions}
                                                    isDisabled={isReadOnly}
                                                />
                                            </FormControl>
                                            <TeasyInput
                                                bg={formData.discount === "미적용" ? "gray.50" : "white"}
                                                opacity={formData.discount === "미적용" ? 0.4 : 1}
                                                value={(formData.payMethod === "입금" || formData.payMethod === "자사몰" || formData.discount === "쿠폰 할인") ? formData.discountAmount : formData.userId}
                                                placeholder={(formData.payMethod === "자사몰" || formData.discount === "쿠폰 할인") ? "할인 금액" : (formData.payMethod === "입금" ? "숫자 입력" : "사용자 ID 입력")}
                                                onChange={(e) => !isReadOnly && (
                                                    (formData.payMethod === "입금" || formData.payMethod === "자사몰" || formData.discount === "쿠폰 할인")
                                                        ? setFormData({ ...formData, discountAmount: formatAmount(e.target.value, true) })
                                                        : setFormData({ ...formData, userId: e.target.value })
                                                )}
                                                isDisabled={isReadOnly || formData.discount === "미적용"}
                                                _readOnly={{ bg: "gray.50", cursor: "default", color: "gray.600" }}
                                                _disabled={{ bg: "gray.50", cursor: "not-allowed" }}
                                            />
                                        </HStack>
                                    </VStack>
                                </Box>
                            )}
                        </VStack>
                    </FormControl>

                    {productCategory === "inventory" && formData.selectedProducts.length > 0 && (
                        <FormControl>
                            <TeasyFormLabel>배송 정보</TeasyFormLabel>
                            <Box p={3} bg="gray.50" borderRadius="md" border="1px" borderColor="gray.100">
                                <VStack spacing={4}>
                                    <HStack w="full" spacing={4}>
                                        <FormControl flex={1}>
                                            <TeasyFormLabel sub fontSize="xs" mb={1}>배송 업체</TeasyFormLabel>
                                            <CustomSelect
                                                placeholder="선택"
                                                value={formData.deliveryInfo.courier}
                                                onChange={(val) => !isReadOnly && setFormData({
                                                    ...formData,
                                                    deliveryInfo: { ...formData.deliveryInfo, courier: val }
                                                })}
                                                options={[
                                                    { value: "CJ", label: "CJ" },
                                                    { value: "로젠", label: "로젠" },
                                                    { value: "우체국", label: "우체국" }
                                                ]}
                                                isDisabled={isReadOnly}
                                            />
                                        </FormControl>
                                        <FormControl flex={1}>
                                            <TeasyFormLabel sub fontSize="xs" mb={1}>발송 일자</TeasyFormLabel>
                                            <TeasyDateTimeInput
                                                value={formData.deliveryInfo.shipmentDate}
                                                onChange={(val: string) => !isReadOnly && setFormData({
                                                    ...formData,
                                                    deliveryInfo: { ...formData.deliveryInfo, shipmentDate: val }
                                                })}
                                                isDisabled={isReadOnly}
                                            />
                                        </FormControl>
                                    </HStack>
                                    <FormControl>
                                        <TeasyFormLabel sub fontSize="xs" mb={1}>송장 번호</TeasyFormLabel>
                                        <TeasyInput
                                            bg="white"
                                            value={formData.deliveryInfo.trackingNumber}
                                            maxLength={20}
                                            onChange={(e) => {
                                                if (isReadOnly) return;
                                                const val = e.target.value.replace(/[^0-9]/g, "");
                                                setFormData({
                                                    ...formData,
                                                    deliveryInfo: { ...formData.deliveryInfo, trackingNumber: val }
                                                });
                                            }}
                                            placeholder="숫자 입력"
                                            isDisabled={isReadOnly}
                                            _readOnly={{ bg: "gray.50", cursor: "default", color: "gray.600" }}
                                        />
                                    </FormControl>
                                    <FormControl>
                                        <TeasyFormLabel sub fontSize="xs" mb={1}>발송 주소</TeasyFormLabel>
                                        <TeasyInput
                                            bg="white"
                                            value={formData.deliveryInfo.deliveryAddress}
                                            onChange={(e) => !isReadOnly && setFormData({
                                                ...formData,
                                                deliveryInfo: { ...formData.deliveryInfo, deliveryAddress: e.target.value }
                                            })}
                                            placeholder="주소 입력"
                                            isDisabled={isReadOnly}
                                            _readOnly={{ bg: "gray.50", cursor: "default", color: "gray.600" }}
                                        />
                                    </FormControl>
                                </VStack>
                            </Box>
                        </FormControl>
                    )}

                    <FormControl>
                        <TeasyFormLabel>참고 사항</TeasyFormLabel>
                        <TeasyTextarea
                            value={formData.memo}
                            onChange={(e: any) => !isReadOnly && setFormData({ ...formData, memo: e.target.value })}
                            placeholder="입력"
                            isDisabled={isReadOnly}
                            _readOnly={{ bg: "gray.50", cursor: "default", color: "gray.600" }}
                        />
                    </FormControl>
                </VStack>
            </Box>
        );
    });

PurchaseConfirmForm.displayName = "PurchaseConfirmForm";
