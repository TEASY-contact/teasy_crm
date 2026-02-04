"use client";

import React, { forwardRef, useImperativeHandle, useState, useEffect, useRef } from "react";
import { VStack, FormControl, Box, Spinner, HStack, useToast, Flex, Text, IconButton, Badge } from "@chakra-ui/react";
import { formatAmount, formatPhone } from "@/utils/formatter";
import { applyColonStandard } from "@/utils/textFormatter";
import { CustomSelect } from "@/components/common/CustomSelect";
import { TeasyDateTimeInput, TeasyFormLabel, TeasyInput, TeasyTextarea, ReportBadge, ThinParen, TeasyFormGroup } from "@/components/common/UIComponents";
import { TeasyUniversalViewer } from "@/components/common/ui/MediaViewer";
import { useReportMetadata } from "@/hooks/useReportMetadata";
import { getCircledNumber } from "@/components/features/asset/AssetModalUtils";
import { usePurchaseForm, PurchaseFormData, SelectedProduct } from "./usePurchaseForm";
import { MdRemove, MdAdd, MdDragHandle } from "react-icons/md";
import { Reorder, useDragControls } from "framer-motion";

// --- Sub Component for Advanced Reorder Item ---
const ProductItem = ({ item, idx, isReadOnly, onUpdateQty, constraintsRef, onDragEnd }: {
    item: SelectedProduct,
    idx: number,
    isReadOnly: boolean,
    onUpdateQty: (id: string, delta: number) => void,
    constraintsRef: React.RefObject<HTMLDivElement>,
    onDragEnd?: () => void
}) => {
    const controls = useDragControls();

    return (
        <Reorder.Item
            as="div"
            value={item}
            dragListener={false}
            dragControls={controls}
            onDragEnd={onDragEnd}
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
                h="45px"
                px={3}
                py={1.5}
                borderRadius="md"
                shadow="xs"
                border="1px solid"
                borderColor="gray.100"
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
                        fontSize="10px"
                        px={2}
                        h="18px"
                        minW="30px"
                        borderRadius="15%"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        textTransform="none"
                        letterSpacing="0"
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
    activities?: any[];
}

export const PurchaseConfirmForm = forwardRef<any, PurchaseConfirmFormProps>(
    ({ customer, activityId, initialData, isReadOnly = false, defaultManager = "", activities = [] }, ref) => {
        const toast = useToast();
        const { managerOptions, products, inventoryItems, rawAssets } = useReportMetadata();
        const [productCategory, setProductCategory] = useState<string>(initialData?.productCategory || "");
        const scrollContainerRef = useRef<HTMLDivElement>(null);
        const fileInputRef = useRef<HTMLInputElement>(null);
        const [pendingFile, setPendingFile] = useState<File | null>(null);
        const [viewerState, setViewerState] = useState<{ isOpen: boolean, file: any | null }>({ isOpen: false, file: null });

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
                    taxInvoice: initialData.taxInvoice || undefined,
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
            inventoryItems,
            pendingFile,
            activities
        });

        const silentRef = useRef<HTMLDivElement>(null);

        useImperativeHandle(ref, () => ({
            submit: handleSubmit,
            delete: handleDelete
        }), [handleSubmit, handleDelete]);

        // Silent Focus Guard (v126.3)
        useEffect(() => {
            if (silentRef.current) silentRef.current.focus();
        }, []);

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
                {/* Focus Guard */}
                <Box ref={silentRef} tabIndex={0} position="absolute" top="-100px" left="-100px" opacity={0} pointerEvents="none" />
                {isLoading && (
                    <Flex
                        position="absolute" top={0} left={0} right={0} bottom={0}
                        bg="whiteAlpha.800" zIndex={20} align="center" justify="center"
                        borderRadius="md"
                    >
                        <VStack spacing={4}>
                            <Spinner size="xl" color="brand.500" thickness="4px" />
                            <Text fontWeight="medium" color="brand.600">처리 중...</Text>
                        </VStack>
                    </Flex>
                )}
                <VStack spacing={6} align="stretch">
                    <HStack spacing={4}>
                        <FormControl isRequired flex={1}>
                            <TeasyFormLabel>구매 일시</TeasyFormLabel>
                            {isReadOnly ? (
                                <TeasyInput value={formData.date} isReadOnly />
                            ) : (
                                <TeasyDateTimeInput
                                    value={formData.date}
                                    onChange={(val: string) => setFormData({ ...formData, date: val })}
                                    limitType="future"
                                />
                            )}
                        </FormControl>
                        <FormControl isRequired>
                            <TeasyFormLabel>담당자</TeasyFormLabel>
                            {isReadOnly ? (
                                <TeasyInput
                                    value={managerOptions.find(o => o.value === formData.manager)?.label || formData.manager}
                                    isReadOnly
                                />
                            ) : (
                                <CustomSelect
                                    placeholder="선택"
                                    value={formData.manager}
                                    onChange={(val) => setFormData({ ...formData, manager: val })}
                                    options={managerOptions}
                                />
                            )}
                        </FormControl>
                    </HStack>

                    <FormControl isRequired>
                        <TeasyFormLabel>구매 상품</TeasyFormLabel>
                        <VStack align="stretch" spacing={3}>
                            <HStack w="full" spacing={4} align="flex-start">
                                <Box flex={1}>
                                    {isReadOnly ? (
                                        <TeasyInput
                                            value={productCategory === "product" ? "시공 상품" : (productCategory === "inventory" ? "배송 상품" : "")}
                                            isReadOnly
                                        />
                                    ) : (
                                        <CustomSelect
                                            placeholder="선택"
                                            value={productCategory}
                                            onChange={(val) => {
                                                setProductCategory(val);
                                                setFormData(prev => ({
                                                    ...prev,
                                                    deliveryInfo: {
                                                        courier: "",
                                                        shipmentDate: prev.deliveryInfo.shipmentDate,
                                                        trackingNumber: "",
                                                        deliveryAddress: customer?.address || ""
                                                    }
                                                }));
                                            }}
                                            options={[
                                                { value: "product", label: "시공 상품" },
                                                { value: "inventory", label: "배송 상품" }
                                            ]}
                                            isDisabled={formData.selectedProducts.length > 0}
                                        />
                                    )}
                                </Box>
                                <Box flex={2}>
                                    {isReadOnly ? (
                                        <TeasyInput
                                            value={formData.selectedProducts.length > 0 ? `${formData.selectedProducts[0].name}${formData.selectedProducts.length > 1 ? ` 외 ${formData.selectedProducts.length - 1}건` : ""}` : ""}
                                            isReadOnly
                                            placeholder="선택 내역 없음"
                                        />
                                    ) : (
                                        (() => {
                                            const rawDelivery = inventoryItems.filter(i => i.isDeliveryItem || i.isDivider);
                                            const deliveryFiltered = rawDelivery.reduce((acc: any[], item, idx, arr) => {
                                                if (item.isDivider) {
                                                    const hasFollowupItems = arr.slice(idx + 1).some(next => !next.isDivider && next.isDeliveryItem);
                                                    if (hasFollowupItems) acc.push(item);
                                                } else {
                                                    acc.push(item);
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
                                                            newSelected = [...formData.selectedProducts, { id: val, name: productInfo.label, quantity: 1, masterId: (productInfo as any).id }];
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
                                        })()
                                    )}
                                </Box>
                            </HStack>

                            {formData.selectedProducts.length > 0 && (
                                <TeasyFormGroup ref={scrollContainerRef}>
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
                                                onDragEnd={() => toast({ title: "순서가 변경되었습니다.", status: "success", position: "top", duration: 1500 })}
                                            />
                                        ))}
                                    </Reorder.Group>
                                </TeasyFormGroup>
                            )}
                        </VStack>
                    </FormControl>

                    <HStack w="full" spacing={4} align="flex-start">
                        <FormControl isRequired flex={1}>
                            <TeasyFormLabel>결제 방식</TeasyFormLabel>
                            {isReadOnly ? (
                                <TeasyInput
                                    value={formData.payMethod}
                                    isReadOnly
                                />
                            ) : (
                                <CustomSelect
                                    placeholder="선택"
                                    value={formData.payMethod}
                                    onChange={(val) => {
                                        setFormData({
                                            ...formData,
                                            payMethod: val,
                                            amount: "",
                                            discount: "미적용",
                                            discountAmount: "",
                                            userId: "",
                                            taxInvoice: undefined
                                        });
                                        setPendingFile(null);
                                        if (fileInputRef.current) fileInputRef.current.value = '';
                                    }}
                                    options={payMethodOptions}
                                />
                            )}
                        </FormControl>
                        <FormControl isRequired flex={2}>
                            <TeasyFormLabel>결제 금액</TeasyFormLabel>
                            <TeasyInput
                                value={formatAmount(String(formData.amount))}
                                onChange={(e) => setFormData({ ...formData, amount: formatAmount(e.target.value) })}
                                placeholder="숫자 입력"
                                isReadOnly={isReadOnly}
                            />
                        </FormControl>
                    </HStack>

                    {formData.payMethod && (
                        <TeasyFormGroup>
                            <VStack spacing={4} align="stretch">
                                <HStack w="full" align="flex-end" spacing={4}>
                                    <FormControl flex={1} isDisabled={isReadOnly}>
                                        <TeasyFormLabel sub mb={1} fontSize="xs">할인 내역</TeasyFormLabel>
                                        {isReadOnly ? (
                                            <TeasyInput
                                                value={formData.discount}
                                                isReadOnly
                                            />
                                        ) : (
                                            <CustomSelect
                                                value={formData.discount}
                                                onChange={(val) => {
                                                    const isNoDiscount = val === "미적용";
                                                    setFormData({
                                                        ...formData,
                                                        discount: val,
                                                        ...(isNoDiscount ? { discountAmount: "", userId: "" } : {})
                                                    });
                                                }}
                                                options={discountOptions}
                                            />
                                        )}
                                    </FormControl>
                                    <Box flex={2}>
                                        <TeasyInput
                                            value={(formData.payMethod === "자사몰" || formData.discount === "쿠폰 할인" || formData.payMethod === "입금" || formData.discount === "현금 할인") ? formatAmount(String(formData.discountAmount), true) : formData.userId}
                                            placeholder={(formData.payMethod === "자사몰" || formData.discount === "쿠폰 할인" || formData.payMethod === "입금" || formData.discount === "현금 할인") ? "할인 금액" : "사용자 ID 입력"}
                                            onChange={(e) => {
                                                const isAmountField = (formData.payMethod === "자사몰" || formData.discount === "쿠폰 할인" || formData.payMethod === "입금" || formData.discount === "현금 할인");
                                                if (isAmountField) {
                                                    setFormData({ ...formData, discountAmount: formatAmount(e.target.value, true) });
                                                } else {
                                                    setFormData({ ...formData, userId: e.target.value });
                                                }
                                            }}
                                            isReadOnly={isReadOnly || formData.discount === "미적용"}
                                        />
                                    </Box>
                                </HStack>

                                {formData.payMethod === "입금" && (
                                    <FormControl pt={2} borderTop="1px dashed" borderColor="gray.200">
                                        <HStack justify="space-between" align="center" mb={2}>
                                            <TeasyFormLabel sub mb={0}>전자세금계산서</TeasyFormLabel>
                                            {!isReadOnly && !formData.taxInvoice && !pendingFile && (
                                                <Box>
                                                    <input
                                                        type="file"
                                                        ref={fileInputRef}
                                                        style={{ display: 'none' }}
                                                        accept="image/*,application/pdf"
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (file) setPendingFile(file);
                                                        }}
                                                    />
                                                    <Badge
                                                        as="button"
                                                        cursor="pointer"
                                                        bg="gray.100"
                                                        color="gray.600"
                                                        border="1px solid"
                                                        borderColor="gray.200"
                                                        _hover={{ bg: "gray.200" }}
                                                        onClick={() => fileInputRef.current?.click()}
                                                        px={3}
                                                        h="32px"
                                                        borderRadius="10px"
                                                        fontSize="xs"
                                                        fontWeight="600"
                                                    >
                                                        파일 업로드
                                                    </Badge>
                                                </Box>
                                            )}
                                        </HStack>

                                        {(formData.taxInvoice || pendingFile) && (
                                            <HStack w="full" px={1} py={1} align="center" justify="space-between">
                                                <Box flex="0 1 auto" isTruncated fontSize="xs" color="gray.600" fontWeight="medium">
                                                    {(() => {
                                                        let name = "";
                                                        if (pendingFile) {
                                                            const today = new Date();
                                                            const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
                                                            const cleanCustomerName = customer.name.replace(/\s/g, '');
                                                            name = `${cleanCustomerName}_전자세금계산서_${dateStr}`;
                                                        } else {
                                                            name = formData.taxInvoice?.displayName || formData.taxInvoice?.name || "전자세금계산서";
                                                            const lastDotIndex = name.lastIndexOf('.');
                                                            if (lastDotIndex !== -1) name = name.substring(0, lastDotIndex);
                                                        }

                                                        // Aggressively replace all invisible/whitespace characters with underscores (v124.71)
                                                        const processed = name.replace(/[\s\u00A0\u1680\u180e\u2000-\u200a\u202f\u205f\u3000\ufeff]/g, '_');
                                                        return <ThinParen text={processed} />;
                                                    })()}
                                                </Box>
                                                <HStack spacing={1.5} flex="0 0 auto">
                                                    <Box
                                                        as="button"
                                                        type="button"
                                                        bg="gray.100"
                                                        color="gray.500"
                                                        fontSize="10px"
                                                        px={2}
                                                        h="18px"
                                                        borderRadius="4px"
                                                        border="1px solid"
                                                        borderColor="gray.200"
                                                        cursor="pointer"
                                                        transition="all 0.2s"
                                                        _hover={{ bg: "gray.500", color: "white" }}
                                                        fontWeight="bold"
                                                        onClick={() => {
                                                            if (pendingFile) {
                                                                const url = URL.createObjectURL(pendingFile);
                                                                setViewerState({ isOpen: true, file: { url, name: pendingFile.name, ext: pendingFile.name.split('.').pop()?.toUpperCase() || '' } });
                                                            } else if (formData.taxInvoice) {
                                                                setViewerState({ isOpen: true, file: formData.taxInvoice });
                                                            }
                                                        }}
                                                    >
                                                        확인
                                                    </Box>
                                                    {(formData.taxInvoice || pendingFile) && (
                                                        <>
                                                            <Text color="gray.300" fontWeight="bold" fontSize="10px">/</Text>
                                                            <Box
                                                                as="button"
                                                                type="button"
                                                                bg="gray.100"
                                                                color="gray.500"
                                                                fontSize="10px"
                                                                px={2}
                                                                h="18px"
                                                                borderRadius="4px"
                                                                border="1px solid"
                                                                borderColor="gray.200"
                                                                cursor="pointer"
                                                                transition="all 0.2s"
                                                                _hover={{ bg: "gray.500", color: "white" }}
                                                                fontWeight="bold"
                                                                onClick={async (e: any) => {
                                                                    const { triggerTeasyDownload } = await import("@/components/common/ui/MediaViewer");
                                                                    if (pendingFile) {
                                                                        const url = URL.createObjectURL(pendingFile);
                                                                        await triggerTeasyDownload({ url, name: pendingFile.name });
                                                                        URL.revokeObjectURL(url);
                                                                    } else if (formData.taxInvoice) {
                                                                        await triggerTeasyDownload(formData.taxInvoice);
                                                                    }
                                                                }}
                                                            >
                                                                다운로드
                                                            </Box>
                                                        </>
                                                    )}
                                                    {!isReadOnly && (
                                                        <>
                                                            <Text color="gray.300" fontWeight="bold" fontSize="10px">/</Text>
                                                            <Box
                                                                as="button"
                                                                type="button"
                                                                bg="gray.100"
                                                                color="gray.500"
                                                                fontSize="10px"
                                                                px={2}
                                                                h="18px"
                                                                borderRadius="4px"
                                                                border="1px solid"
                                                                borderColor="gray.200"
                                                                cursor="pointer"
                                                                transition="all 0.2s"
                                                                _hover={{ bg: "red.500", color: "white" }}
                                                                fontWeight="bold"
                                                                onClick={() => {
                                                                    if (window.confirm("파일을 삭제하시겠습니까?")) {
                                                                        setPendingFile(null);
                                                                        setFormData({ ...formData, taxInvoice: undefined });
                                                                        if (fileInputRef.current) fileInputRef.current.value = '';
                                                                    }
                                                                }}
                                                            >
                                                                삭제
                                                            </Box>
                                                        </>
                                                    )}
                                                </HStack>
                                            </HStack>
                                        )}
                                    </FormControl>
                                )}
                            </VStack>
                        </TeasyFormGroup>
                    )}

                    {productCategory === "inventory" && formData.selectedProducts.length > 0 && (
                        <FormControl>
                            <TeasyFormLabel>배송 정보</TeasyFormLabel>
                            <TeasyFormGroup>
                                <VStack spacing={4}>
                                    <HStack w="full" spacing={4} align="flex-start">
                                        <FormControl flex={1}>
                                            <TeasyFormLabel sub fontSize="xs" mb={1}>배송 업체</TeasyFormLabel>
                                            {isReadOnly ? (
                                                <TeasyInput
                                                    value={formData.deliveryInfo.courier}
                                                    isReadOnly
                                                />
                                            ) : (
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
                                            )}
                                        </FormControl>
                                        <FormControl flex={1}>
                                            <TeasyFormLabel sub fontSize="xs" mb={1}>발송 일자</TeasyFormLabel>
                                            {isReadOnly ? (
                                                <TeasyInput value={formData.deliveryInfo.shipmentDate} isReadOnly />
                                            ) : (
                                                <TeasyDateTimeInput
                                                    value={formData.deliveryInfo.shipmentDate || ""}
                                                    onChange={(val: string) => setFormData({
                                                        ...formData,
                                                        deliveryInfo: { ...formData.deliveryInfo, shipmentDate: val }
                                                    })}
                                                    limitType="future"
                                                />
                                            )}
                                        </FormControl>
                                    </HStack>
                                    <FormControl>
                                        <TeasyFormLabel sub fontSize="xs" mb={1}>송장 번호</TeasyFormLabel>
                                        <TeasyInput
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
                                        />
                                    </FormControl>
                                    <FormControl>
                                        <TeasyFormLabel sub fontSize="xs" mb={1}>발송 주소</TeasyFormLabel>
                                        <TeasyInput
                                            value={formData.deliveryInfo.deliveryAddress}
                                            onChange={(e) => !isReadOnly && setFormData({
                                                ...formData,
                                                deliveryInfo: { ...formData.deliveryInfo, deliveryAddress: e.target.value }
                                            })}
                                            placeholder="주소 입력"
                                            isDisabled={isReadOnly}
                                        />
                                    </FormControl>
                                </VStack>
                            </TeasyFormGroup>
                        </FormControl>
                    )}

                    <FormControl>
                        <TeasyFormLabel>참고 사항</TeasyFormLabel>
                        <TeasyTextarea
                            value={formData.memo}
                            onChange={(e: any) => !isReadOnly && setFormData({ ...formData, memo: e.target.value })}
                            placeholder="입력"
                            isDisabled={isReadOnly}
                        />
                    </FormControl>
                </VStack>

                {/* File Viewer Modal */}
                <TeasyUniversalViewer
                    isOpen={viewerState.isOpen}
                    onClose={() => setViewerState({ ...viewerState, isOpen: false })}
                    files={viewerState.file ? [viewerState.file] : []}
                />
            </Box>
        );
    });

PurchaseConfirmForm.displayName = "PurchaseConfirmForm";
