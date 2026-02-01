// src/components/common/CustomSelect.tsx
"use client";

import {
    Menu,
    MenuButton,
    MenuList,
    MenuItem,
    MenuDivider,
    Button,
    Text,
    Flex,
} from "@chakra-ui/react";
import { ChevronDownIcon } from "@chakra-ui/icons";

interface Option {
    value: string;
    label: string;
    isDivider?: boolean;
}

interface CustomSelectProps {
    value: string;
    onChange: (value: string) => void;
    options: Option[];
    placeholder?: string;
    width?: string;
    size?: "sm" | "md" | "lg";
    isDisabled?: boolean;
}

export const CustomSelect = ({
    value,
    onChange,
    options,
    placeholder = "선택",
    width = "100%",
    size = "md",
    isDisabled = false,
}: CustomSelectProps) => {
    const selectedOption = options.find((opt) => opt.value === value);
    const selectedLabel = selectedOption?.label || placeholder;
    const isSelected = !!selectedOption;

    return (
        <Menu matchWidth>
            <MenuButton
                w={width}
                h="45px"
                borderRadius="lg"
                textAlign="left"
                bg={isDisabled ? "gray.50" : "white"}
                border="1px"
                borderColor="gray.200"
                fontWeight="normal"
                color={isSelected ? "gray.700" : "gray.400"}
                fontSize="13px"
                px={4}
                cursor={isDisabled ? "default" : "pointer"}
                _hover={isDisabled ? {} : { borderColor: "gray.300" }}
                _active={isDisabled ? {} : { bg: "white", borderColor: "brand.500" }}
                _focus={isDisabled ? {} : { borderColor: "brand.500" }}
                _expanded={isDisabled ? {} : { borderColor: "brand.500" }}
                disabled={isDisabled}
                type="button"
            >
                <Flex justify="space-between" align="center" userSelect="none" w="full">
                    <Text isTruncated>
                        {selectedLabel}
                    </Text>
                    {!isDisabled && <ChevronDownIcon color="gray.400" />}
                </Flex>
            </MenuButton>
            <MenuList borderRadius="md" shadow="lg" py={1} zIndex={1400} maxH="300px" overflowY="auto">
                {options.map((option, idx) => (
                    option.isDivider ? (
                        <MenuDivider key={`div-${idx}`} borderColor="gray.100" />
                    ) : (
                        <MenuItem
                            key={option.value}
                            onClick={() => onChange(option.value)}
                            fontSize="sm"
                            color={option.value === value ? "brand.600" : "gray.700"}
                            bg={option.value === value ? "brand.50" : "transparent"}
                            fontWeight={option.value === value ? "bold" : "normal"}
                            _hover={{ bg: "brand.50", color: "brand.600" }}
                            _focus={{ bg: "brand.50", color: "brand.600" }}
                        >
                            <Text as="span" mr={2} color={option.value === value ? "brand.400" : "gray.300"}>·</Text>
                            {option.label}
                        </MenuItem>
                    )
                ))}
            </MenuList>
        </Menu>
    );
};
