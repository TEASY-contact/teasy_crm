// src/components/features/asset/AssetTableAtoms.tsx
import React, { useState, useRef } from "react";
import {
    Box, Th, Td, Tooltip, Flex
} from "@chakra-ui/react";

// Shared Constants
export const HISTORY_GRID_RATIO = "8fr 4fr 14fr";

export const TABLE_CELL_DEFAULTS = {
    py: 2,
    px: 4,
    borderRight: "1px",
    borderColor: "gray.50",
    fontSize: "sm",
};

export const TABLE_HEADER_DEFAULTS = {
    color: "gray.500",
    fontSize: "xs",
    fontWeight: "800",
    bg: "gray.50",
    borderBottom: "1px",
    borderRight: "1px",
    borderColor: "gray.100",
    verticalAlign: "middle",
    whiteSpace: "nowrap" as const, // For TS literal
    py: 0,
};

/**
 * Helper: Tooltip that only shows when text is truncated
 */
export const TruncatedTooltip = ({ label, children, maxW, noNowrap }: { label: string, children: React.ReactElement, maxW?: string, noNowrap?: boolean }) => {
    const [isTruncated, setIsTruncated] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const checkTruncation = () => {
        if (ref.current) {
            if (noNowrap) {
                setIsTruncated(ref.current.scrollHeight > ref.current.clientHeight);
            } else {
                setIsTruncated(ref.current.scrollWidth > ref.current.clientWidth);
            }
        }
    };

    return (
        <Tooltip label={label} isDisabled={!isTruncated} hasArrow placement="top" borderRadius="lg" bg="gray.800" color="white" fontSize="xs">
            {React.cloneElement(children, {
                ref,
                onMouseEnter: checkTruncation,
                style: {
                    ...children.props.style,
                    whiteSpace: noNowrap ? 'pre-wrap' : 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: 'block',
                    maxWidth: maxW || '100%'
                }
            })}
        </Tooltip>
    );
};

export const HighlightedText = ({ text, query }: { text: string, query: string }) => {
    if (!query || !text) return <>{text}</>;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return (
        <>
            {parts.map((part, i) =>
                part.toLowerCase() === query.toLowerCase() ? (
                    <Box as="span" key={i} bg="yellow.200" borderRadius="sm" px={0.5} fontWeight="extrabold">
                        {part}
                    </Box>
                ) : (
                    part
                )
            )}
        </>
    );
};

// Atomic Sub-components
export const AssetTd = ({ children, textAlign = "left" as const, ...props }: any) => (
    <Td {...TABLE_CELL_DEFAULTS} textAlign={textAlign} {...props}>
        {children}
    </Td>
);

export const AssetTh = ({ children, textAlign = "center" as const, h = "27.5px", ...props }: any) => (
    <Th {...TABLE_HEADER_DEFAULTS} textAlign={textAlign} h={h} {...props}>
        {children}
    </Th>
);
