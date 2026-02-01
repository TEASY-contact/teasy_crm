// src/components/features/customer/ProfileItem.tsx
import React from 'react';
import { Box, Text, Flex, IconButton, VStack } from "@chakra-ui/react";
import { AddIcon } from "@chakra-ui/icons";
import { ThinParen } from "@/components/common/UIComponents";

interface ProfileItemProps {
    label: string;
    values: string[];
    onAdd?: () => void;
    onClick?: () => void;
    isDate?: boolean;
    align?: "flex-start" | "center" | "flex-end";
}

export const ProfileItem = React.memo(({ label, values, onAdd, onClick, isDate, align = "flex-start" }: ProfileItemProps) => (
    <Box>
        <Flex align="center" mb={1} justify={align}>
            <Text fontSize="xs" color="gray.400" fontWeight="bold">{label}</Text>
            {onAdd && (
                <Flex
                    as="button"
                    type="button"
                    onClick={onAdd}
                    ml={1}
                    p={1}
                    align="center"
                    justify="center"
                    color="brand.500"
                    opacity={0.7}
                    _hover={{ opacity: 1, bg: "gray.50", borderRadius: "md" }}
                    transition="all 0.2s"
                >
                    <AddIcon boxSize={2} />
                </Flex>
            )}
        </Flex>
        <VStack
            onClick={onClick}
            cursor={onClick ? "pointer" : "default"}
            _hover={onClick ? { opacity: 0.8 } : {}}
            transition="opacity 0.2s"
            align={align}
            spacing={0}
        >
            {values.length > 0 ? (
                label === "보유 상품" ? (
                    <Flex wrap="wrap" gap={2} align="center">
                        {values.map((v, i) => (
                            <React.Fragment key={i}>
                                <Text fontSize="sm" fontWeight="bold" color="gray.600">
                                    <ThinParen text={v} />
                                </Text>
                                {i < values.length - 1 && (
                                    <Text fontSize="xs" color="gray.300" fontWeight="normal">|</Text>
                                )}
                            </React.Fragment>
                        ))}
                    </Flex>
                ) : (
                    values.map((v, i) => (
                        <Text
                            key={i}
                            fontSize="sm"
                            fontWeight="bold"
                            color={isDate && (label === "최신 활동일" || label === "최근 활동") ? "brand.500" : "gray.600"}
                            textDecoration={onClick ? "underline" : "none"}
                            textUnderlineOffset="3px"
                            textAlign={align === "flex-end" ? "right" : "left"}
                        >
                            <ThinParen text={v} />
                        </Text>
                    ))
                )
            ) : (
                <Text fontSize="sm" color="gray.400" textAlign={align === "flex-end" ? "right" : "left"}>-</Text>
            )}
        </VStack>
    </Box>
));
