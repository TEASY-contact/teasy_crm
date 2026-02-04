"use client";
import React from "react";
import {
    Text, Badge, Center, Box, Divider, type TextProps, type BadgeProps
} from "@chakra-ui/react";

/**
 * Utility to make parentheses thin as requested by user
 */
export const ThinParen = ({ text }: { text?: string }) => {
    if (!text) return null;
    const parts = text.split(/([()\-×/_]|\b[xX]\b)/);
    return (
        <>
            {parts.map((part, i) => {
                const isSpecial = part === '(' || part === ')' || part === '-' || part === '/' || part === '×' || part === '_' || (part && part.toLowerCase() === 'x');
                if (isSpecial) {
                    return <Text key={i} as="span" color="gray.500" fontWeight="300" display="inline">{part}</Text>;
                }
                return part;
            })}
        </>
    );
};

export interface TeasyBadgeProps extends BadgeProps {
    colorType?: 'brand' | 'red' | 'green' | 'blue' | 'gray' | 'purple' | 'yellow' | 'orange' | 'pink';
}

export const TeasyBadge = ({ colorType = 'brand', children, ...props }: any) => {
    const colorMap: any = {
        brand: { bg: "rgba(128, 90, 213, 0.12)", color: "brand.500" },
        purple: { bg: "rgba(128, 90, 213, 0.12)", color: "brand.500" },
        red: { bg: "rgba(229, 62, 62, 0.12)", color: "red.500" },
        green: { bg: "rgba(72, 187, 120, 0.12)", color: "green.500" },
        blue: { bg: "rgba(66, 153, 225, 0.12)", color: "blue.500" },
        gray: { bg: "rgba(160, 174, 192, 0.12)", color: "gray.500" },
        yellow: { bg: "rgba(236, 201, 75, 0.12)", color: "yellow.600" },
        orange: { bg: "rgba(237, 137, 54, 0.12)", color: "orange.500" },
        pink: { bg: "rgba(237, 100, 166, 0.12)", color: "pink.500" },
    };
    const c = colorMap[colorType] || colorMap.brand;
    return (
        <Badge
            bg={c.bg} color={c.color} px={0} w="50px" h="18px" display="flex" alignItems="center" justifyContent="center" borderRadius="15%" textTransform="none" fontSize="10px" fontWeight="600" letterSpacing="0" {...props}
        >
            {children}
        </Badge>
    );
};

export const ReportBadge = TeasyBadge;

export const TeasyPlaceholderText = (props: TextProps) => <Text fontSize="sm" color="gray.300" textAlign="center" {...props} />;

export const SurnameBadge = ({ name, color, badgeChar, ...props }: any) => (
    <Center
        bg={color || "brand.500"}
        color="white"
        fontSize="10px"
        w="18px"
        h="18px"
        minW="18px"
        minH="18px"
        borderRadius="full"
        shadow="0 2px 4px rgba(0,0,0,0.12)"
        fontWeight="bold"
        border="1px solid rgba(255, 255, 255, 0.4)"
        p={0}
        {...props}
    >
        <Box
            as="span"
            lineHeight="1"
            transform="translate(0.3px, -0.5px)"
        >
            {badgeChar || (name ? name[0] : "?")}
        </Box>
    </Center>
);

export const TeasyDivider = (props: any) => <Divider borderColor="gray.100" {...props} />;
