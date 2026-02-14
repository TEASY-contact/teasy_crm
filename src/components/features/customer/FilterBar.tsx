// src/components/features/customer/FilterBar.tsx
"use client";
import { Flex, Input, InputGroup, InputLeftElement } from "@chakra-ui/react";
import { MdSearch } from "react-icons/md";
import { CustomSelect } from "@/components/common/CustomSelect";

interface FilterBarProps {
    onSearch: (val: string) => void;
    onSort: (val: string) => void;
    currentSort: string;
    onViewMode: (val: string) => void;
    currentViewMode: string;
    currentSearch: string;
}

export const FilterBar = ({ onSearch, onSort, currentSort, onViewMode, currentViewMode, currentSearch }: FilterBarProps) => {
    return (
        <Flex gap={4} align="center">
            <CustomSelect
                width="160px"
                value={currentViewMode}
                onChange={(val) => onViewMode(val)}
                options={[
                    { value: "none", label: "선택 안함" },
                    { value: "divider", label: "", isDivider: true },
                    { value: "recent", label: "최근 1개월" },
                    { value: "all", label: "전체 목록" },
                ]}
            />
            <InputGroup maxW="350px" bg="white">
                <InputLeftElement pointerEvents="none" h="45px">
                    <MdSearch color="gray.400" size="20px" />
                </InputLeftElement>
                <Input
                    h="45px"
                    borderRadius="lg"
                    placeholder="고객명, 연락처, 주소 검색"
                    _placeholder={{ color: "gray.300", fontSize: "14px" }}
                    focusBorderColor="brand.500"
                    fontSize="sm"
                    value={currentSearch}
                    onChange={(e) => onSearch(e.target.value)}
                />
            </InputGroup>
            <CustomSelect
                width="210px"
                value={currentSort}
                placeholder="정렬"
                onChange={(val) => onSort(val)}
                options={[
                    { value: "none", label: "선택 안함" },
                    { value: "divider", label: "", isDivider: true },
                    { value: "name", label: "이름 가나다" },
                    { value: "register", label: "등록일" },
                    { value: "activity", label: "활동일" },
                ]}
            />
        </Flex>
    );
};
