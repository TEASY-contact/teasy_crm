// src/components/features/asset/AssetTable.tsx
import React from "react";
import {
    Box, Table, Thead, Tbody, Tr, Td
} from "@chakra-ui/react";
import {
    TeasyPlaceholderText
} from "@/components/common/UIComponents";
import { Reorder } from "framer-motion";
import { AssetData } from "@/utils/assetUtils";
import { AssetTh, AssetTd } from "./AssetTableAtoms";
import { TableRowItem } from "./TableRowItem";

interface AssetTableProps {
    viewMode: "inventory" | "product";
    filteredAssets: AssetData[];
    selectedAssetId: string | null;
    setSelectedAssetId: React.Dispatch<React.SetStateAction<string | null>>;
    search: string;
    onEdit?: (id: string) => void;
    onReorder?: (newAssets: AssetData[]) => void;
    onDeleteDivider?: (id: string) => void;
}

export const AssetTable: React.FC<AssetTableProps> = ({
    viewMode, filteredAssets, selectedAssetId, setSelectedAssetId, search, onEdit, onReorder, onDeleteDivider
}) => {
    return (
        <Box
            overflowY="auto"
            overflowX="hidden"
            maxH="calc(100vh - 300px)"
            css={{
                '&::-webkit-scrollbar': { width: '4px' },
                '&::-webkit-scrollbar-track': { background: 'transparent' },
                '&::-webkit-scrollbar-thumb': {
                    background: 'rgba(0,0,0,0.08)',
                    borderRadius: '10px'
                },
                '&::-webkit-scrollbar-thumb:hover': { background: 'rgba(0,0,0,0.15)' }
            }}
        >
            <Table variant="simple" style={{ tableLayout: "fixed" }}>
                {viewMode === "inventory" ? (
                    <colgroup>
                        <col width="3%" />
                        <col width="6%" />
                        <col width="9%" />
                        <col width="12%" />
                        <col width="8%" />
                        <col width="6%" />
                        <col width="6%" />
                        <col width="6%" />
                        <col width="12%" />
                        <col width="6%" />
                        <col width="8%" />
                        <col width="4%" />
                        <col width="14%" />
                    </colgroup>
                ) : (
                    <colgroup>
                        <col width="5%" />
                        <col width="9%" />
                        <col width="13%" />
                        <col width="9%" />
                        <col width="54%" />
                        <col width="10%" />
                    </colgroup>
                )}
                <Thead bg="gray.50" position="sticky" top={0} zIndex={1}>
                    {viewMode === "inventory" ? (
                        <>
                            <Tr h="27.5px" bg="gray.50">
                                <AssetTh rowSpan={2} w="50px" p={0}></AssetTh>
                                <AssetTh rowSpan={2}>순번</AssetTh>
                                <AssetTh rowSpan={2}>카테고리</AssetTh>
                                <AssetTh rowSpan={2}>물품명</AssetTh>
                                <AssetTh colSpan={6}>출납현황</AssetTh>
                                <AssetTh colSpan={3}>수정내용</AssetTh>
                            </Tr>
                            <Tr h="27.5px">
                                <AssetTh fontWeight="normal">등록일시</AssetTh>
                                <AssetTh fontWeight="normal">담당자</AssetTh>
                                <AssetTh fontWeight="normal">입고</AssetTh>
                                <AssetTh fontWeight="normal">출고</AssetTh>
                                <AssetTh fontWeight="normal" textAlign="left">납품처</AssetTh>
                                <AssetTh fontWeight="normal">재고</AssetTh>
                                <AssetTh fontWeight="normal">수정일시</AssetTh>
                                <AssetTh fontWeight="normal">담당자</AssetTh>
                                <AssetTh fontWeight="normal">수정사항</AssetTh>
                            </Tr>

                        </>
                    ) : (
                        <Tr h="55px">
                            <AssetTh w="50px" />
                            <AssetTh>카테고리</AssetTh>
                            <AssetTh textAlign="left">상품명</AssetTh>
                            <AssetTh>판매가</AssetTh>
                            <AssetTh textAlign="left">상품 구성</AssetTh>
                            <AssetTh>상세</AssetTh>
                        </Tr>
                    )}
                </Thead>
                <Reorder.Group
                    as="tbody"
                    axis="y"
                    values={filteredAssets}
                    onReorder={(newOrder) => onReorder?.(newOrder)}
                >
                    {filteredAssets.length === 0 ? (
                        <Tr>
                            <AssetTd colSpan={viewMode === "inventory" ? 13 : 6} py={20} textAlign="center" borderRight="none">
                                <TeasyPlaceholderText>조회된 {viewMode === "inventory" ? "재고" : "상품"} 데이터가 없습니다.</TeasyPlaceholderText>
                            </AssetTd>
                        </Tr>
                    ) : (
                        filteredAssets.map((asset, idx) => (
                            <TableRowItem
                                key={asset.id}
                                asset={asset}
                                viewMode={viewMode}
                                idx={idx}
                                selectedAssetId={selectedAssetId}
                                setSelectedAssetId={setSelectedAssetId}
                                search={search}
                                onEdit={onEdit}
                                onDeleteDivider={onDeleteDivider}
                                totalCount={filteredAssets.length}
                            />
                        ))
                    )}
                </Reorder.Group>
            </Table>
        </Box>
    );
};
