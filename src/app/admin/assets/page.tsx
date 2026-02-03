// src/app/admin/assets/page.tsx
"use client";
import { useState, useEffect, useMemo } from "react";
import React from "react";
import {
    Box, HStack, InputGroup, InputLeftElement, Input,
    useDisclosure, Flex, Spinner, Spacer, Text, useToast
} from "@chakra-ui/react";
import { MdSearch, MdAdd, MdHorizontalRule, MdOpenInNew, MdSettings } from "react-icons/md";
import { PageHeader, TeasyButton, TeasyPlaceholderText } from "@/components/common/UIComponents";
import { db } from "@/lib/firebase";
import {
    collection, query, addDoc, serverTimestamp,
    deleteDoc, doc, writeBatch, orderBy, getDocs
} from "firebase/firestore";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { CustomSelect } from "@/components/common/CustomSelect";
import { AssetData, getAssetTimestamp } from "@/utils/assetUtils";
import { AssetTable } from "@/components/features/asset/AssetTable";
import { AssetModal } from "@/components/features/asset/AssetModal";
import { InventoryMasterModal } from "@/components/features/asset/InventoryMasterModal";

export default function AssetManagementPage() {
    const [search, setSearch] = useState("");
    const [viewMode, setViewMode] = useState<"inventory" | "product">("inventory");
    const [filterType, setFilterType] = useState<string>("all");
    const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
    const toast = useToast();

    const createDisclosure = useDisclosure();
    const masterDisclosure = useDisclosure();

    const queryClient = useQueryClient();

    const { data: assets = [], isLoading } = useQuery({
        queryKey: ["assets", "management"],
        queryFn: async () => {
            const q = query(collection(db, "assets"));
            const snapshot = await getDocs(q);
            const fetchedData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as AssetData));

            // Enhanced mixed-type sort (v123.82): New activities (no index) at the TOP
            return [...fetchedData].sort((a, b) => {
                const hasA = a.orderIndex !== undefined && a.orderIndex !== null;
                const hasB = b.orderIndex !== undefined && b.orderIndex !== null;

                // Priority: Items WITHOUT orderIndex (new report activities) go to TOP
                if (!hasA && hasB) return -1;
                if (hasA && !hasB) return 1;

                if (hasA && hasB) return (a.orderIndex as number) - (b.orderIndex as number);

                return getAssetTimestamp(b.createdAt) - getAssetTimestamp(a.createdAt);
            });
        }
    });

    const refreshAssets = async () => {
        await new Promise(resolve => setTimeout(resolve, 500));
        await queryClient.invalidateQueries({ queryKey: ["assets", "management"] });
    };

    /**
     * Reorder Mutation with Optimistic Update & Rollback (v123.86)
     */
    const reorderMutation = useMutation({
        mutationFn: async (finalGlobalOrder: AssetData[]) => {
            const CHUNK_SIZE = 500;
            const chunks = [];
            for (let i = 0; i < finalGlobalOrder.length; i += CHUNK_SIZE) {
                chunks.push(finalGlobalOrder.slice(i, i + CHUNK_SIZE));
            }

            let globalCounter = 0;
            for (const chunk of chunks) {
                const batch = writeBatch(db);
                chunk.forEach((asset) => {
                    const assetRef = doc(db, "assets", asset.id);
                    batch.update(assetRef, { orderIndex: globalCounter++ });
                });
                await batch.commit();
            }
        },
        onMutate: async (newOrder) => {
            // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
            await queryClient.cancelQueries({ queryKey: ["assets", "management"] });

            // Snapshot the previous value
            const previousAssets = queryClient.getQueryData<AssetData[]>(["assets", "management"]);

            // Optimistically update to the new value
            queryClient.setQueryData(["assets", "management"], newOrder);

            // Return a context object with the snapshotted value
            return { previousAssets };
        },
        onError: (err, newOrder, context) => {
            // If the mutation fails, use the context returned from onMutate to roll back
            if (context?.previousAssets) {
                queryClient.setQueryData(["assets", "management"], context.previousAssets);
            }
            toast({ title: "순서 저장 실패", description: "네트워크 오류로 인해 순서가 원복되었습니다.", status: "error", duration: 3000 });
        },
        onSettled: async () => {
            // Always refetch after error or success to keep server/client in sync
            await refreshAssets();
        },
        onSuccess: () => {
            const toastId = "reorder-success";
            if (!toast.isActive(toastId)) {
                toast({
                    id: toastId,
                    title: "순서 변경 및 저장 완료",
                    status: "success",
                    duration: 2000,
                    isClosable: true,
                    position: "top"
                });
            }
            if (navigator.vibrate) navigator.vibrate(10);
        }
    });

    const handleAddDivider = async () => {
        try {
            await addDoc(collection(db, "assets"), {
                type: "divider",
                dividerType: viewMode,
                createdAt: serverTimestamp(),
                orderIndex: assets.length
            });
            await refreshAssets();
        } catch (err) {
            console.error(err);
        }
    };

    const handleDeleteDivider = async (id: string) => {
        try {
            await deleteDoc(doc(db, "assets", id));
            await refreshAssets();
        } catch (err) {
            console.error(err);
        }
    };

    const filteredAssets = useMemo(() => {
        return assets.filter(a => {
            if (a.type === "divider") {
                return viewMode === "product" && a.dividerType === "product";
            }

            const matchesSearch = (a.name || "").toLowerCase().includes(search.toLowerCase()) ||
                (a.category || "").toLowerCase().includes(search.toLowerCase());
            const assetType = a.type || "inventory";
            const matchesMode = assetType === viewMode;
            if (!matchesSearch || !matchesMode) return false;

            if (viewMode === "inventory") {
                if (filterType === "inflow") return !!a.lastInflow;
                if (filterType === "outflow") return !!a.lastOutflow;
                if (filterType === "edit") return !!a.editLog && a.editLog !== "-";
                if (filterType === "delivery") return !!a.isDeliveryItem;
            }
            return true;
        });
    }, [assets, search, viewMode, filterType]);

    const selectedAsset = assets.find(a => a.id === selectedAssetId);

    return (
        <Box p={0} bg="gray.50" minH="100vh">
            <Box px={8} pt={8}>
                <PageHeader
                    title="재고 · 상품 관리"
                    leftContent={
                        <Flex
                            bg="gray.200" p="3px" borderRadius="full" position="relative"
                            w="140px" h="34px" cursor="pointer"
                            onClick={() => { setViewMode(prev => prev === "inventory" ? "product" : "inventory"); setSelectedAssetId(null); }}
                            userSelect="none"
                        >
                            <Box
                                position="absolute" left={viewMode === "inventory" ? "3px" : "70px"} top="3px"
                                w="67px" h="28px" bg="white" borderRadius="full" shadow="sm"
                                transition="all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
                            />
                            <Flex zIndex={1} w="full" align="center" justify="space-around" fontSize="13px" fontWeight="800">
                                <Text color={viewMode === "inventory" ? "brand.500" : "gray.500"} transition="color 0.2s">재고</Text>
                                <Text color={viewMode === "product" ? "brand.500" : "gray.500"} transition="color 0.2s">상품</Text>
                            </Flex>
                        </Flex>
                    }
                />
            </Box>

            <Flex align="center" mb={4} px={8} pt={4}>
                <InputGroup maxW="350px" bg="white" borderRadius="lg">
                    <InputLeftElement pointerEvents="none" h="45px">
                        <MdSearch color="gray.400" size="20px" />
                    </InputLeftElement>
                    <Input
                        h="45px" borderRadius="lg" placeholder="카테고리 또는 물품명 검색"
                        _placeholder={{ color: "gray.300", fontSize: "14px" }}
                        focusBorderColor="brand.500" fontSize="sm" value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </InputGroup>

                {viewMode === "inventory" && (
                    <Box ml={3}>
                        <CustomSelect
                            width="210px" value={filterType} placeholder="정렬 필터"
                            onChange={(val) => setFilterType(val as any)}
                            options={[
                                { value: "all", label: "선택 안함" },
                                { value: "divider", label: "", isDivider: true },
                                { value: "inflow", label: "입고" },
                                { value: "outflow", label: "출고" },
                                { value: "edit", label: "수정" },
                                { value: "delivery", label: "배송가능" },
                            ]}
                        />
                    </Box>
                )}
                <Spacer />
                <HStack spacing={3}>
                    {viewMode === "inventory" && (
                        <>
                            <TeasyButton
                                variant="outline"
                                borderColor="brand.500"
                                color="brand.500"
                                bg="transparent"
                                _hover={{ bg: "brand.50", borderColor: "brand.600" }}
                                leftIcon={<MdOpenInNew size={18} />}
                                isDisabled={!selectedAssetId}
                                onClick={() => {
                                    const asset = assets.find(a => a.id === selectedAssetId);
                                    if (asset?.lastOutflow) {
                                        toast({
                                            title: "수정 불가",
                                            description: "출고 데이터는 고객 관리 페이지에서만 수정 가능합니다.",
                                            status: "warning",
                                            duration: 3000,
                                            isClosable: true,
                                            position: "top"
                                        });
                                        return;
                                    }
                                    createDisclosure.onOpen();
                                }}
                            >
                                내용수정
                            </TeasyButton>
                            <TeasyButton
                                version="secondary"
                                borderColor="brand.500"
                                color="brand.500"
                                leftIcon={<MdSettings />}
                                onClick={masterDisclosure.onOpen}
                            >
                                물품 등록
                            </TeasyButton>
                            <TeasyButton shadow="sm" leftIcon={<MdAdd />} onClick={() => { setSelectedAssetId(null); createDisclosure.onOpen(); }}>
                                재고 추가
                            </TeasyButton>
                        </>
                    )}
                    {viewMode === "product" && (
                        <>
                            <TeasyButton
                                version="secondary"
                                leftIcon={<MdHorizontalRule />}
                                onClick={handleAddDivider}
                            >
                                구별선 추가
                            </TeasyButton>
                            <TeasyButton shadow="sm" leftIcon={<MdAdd />} onClick={() => { setSelectedAssetId(null); createDisclosure.onOpen(); }}>
                                상품 등록
                            </TeasyButton>
                        </>
                    )}
                </HStack>
            </Flex>

            <Box px={8}>
                <Box bg="white" borderRadius="xl" border="1px" borderColor="gray.200" shadow="sm">
                    {isLoading ? (
                        <Flex justify="center" py={20}><Spinner color="brand.500" /></Flex>
                    ) : (
                        <AssetTable
                            viewMode={viewMode}
                            filteredAssets={filteredAssets}
                            selectedAssetId={selectedAssetId}
                            setSelectedAssetId={setSelectedAssetId}
                            search={search}
                            onEdit={(id: string) => {
                                const asset = assets.find(a => a.id === id);
                                if (asset?.lastOutflow) {
                                    toast({
                                        title: "수정 불가",
                                        description: "출고 데이터는 고객 관리 페이지에서만 수정 가능합니다.",
                                        status: "warning",
                                        duration: 3000,
                                        isClosable: true,
                                        position: "top"
                                    });
                                    return;
                                }
                                setSelectedAssetId(id);
                                createDisclosure.onOpen();
                            }}
                            onDeleteDivider={handleDeleteDivider}
                            onReorder={async (newOrder) => {
                                const reorderedIds = new Set(newOrder.map(a => a.id));
                                const untouchedAssets = assets.filter(a => !reorderedIds.has(a.id));
                                const finalGlobalOrder = [...untouchedAssets, ...newOrder];

                                reorderMutation.mutate(finalGlobalOrder);
                            }}
                        />
                    )}
                </Box>
            </Box>

            <AssetModal
                isOpen={createDisclosure.isOpen}
                onClose={createDisclosure.onClose}
                selectedAsset={selectedAsset}
                assets={assets}
                viewMode={viewMode}
                onDelete={handleDeleteDivider}
            />

            <InventoryMasterModal
                isOpen={masterDisclosure.isOpen}
                onClose={masterDisclosure.onClose}
            />
        </Box>
    );
}
