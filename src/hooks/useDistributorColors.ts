// src/hooks/useDistributorColors.ts
"use client";
import { useMemo } from "react";
import { useDistributorMaster } from "./useDistributorMaster";

export const useDistributorColors = () => {
    const { distributors, isLoading } = useDistributorMaster();

    const colorMap = useMemo(() => {
        const map: Record<string, { bg: string; color: string }> = {};
        distributors.forEach((d) => {
            if (!d.isDivider && d.colorConfig) {
                map[d.name] = d.colorConfig;
            }
        });
        return map;
    }, [distributors]);

    return { colorMap, isLoading };
};
