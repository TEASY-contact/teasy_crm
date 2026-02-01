// src/components/features/asset/hooks/useAssetSuggestions.ts
import { useState, useCallback, useMemo } from "react";
import { AssetData } from "@/utils/assetUtils";
import { cleanComponentString } from "../AssetModalUtils";

export const useAssetSuggestions = (assets: AssetData[], isProduct: boolean, isEdit: boolean) => {
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const getSuggestions = useCallback((val: string) => {
        if (val.trim() && !isEdit) {
            const typeFilter = isProduct ? "product" : "inventory";
            const uniqueItems = Array.from(new Set(
                assets
                    .filter(a => a.type === typeFilter)
                    .map(a => `${a.name}:::${a.category}:::${a.composition || ""}:::${a.spec || ""}:::${a.unit || ""}:::${a.notes || ""}`)
            ))
                .filter(s => s.split(':::')[0].toLowerCase().includes(val.toLowerCase()))
                .map(s => {
                    const [n, c, comp, sp, un, nt] = s.split(':::');
                    return { name: n, category: c, composition: comp, spec: sp, unit: un, notes: nt };
                });
            const matches = uniqueItems.slice(0, 5);
            setSuggestions(matches);
            setShowSuggestions(matches.length > 0);
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    }, [assets, isProduct, isEdit]);

    const selectSuggestion = useCallback((item: any, setName: (v: string) => void, setCategory: (v: string) => void, setSelectedComponents: (v: string[]) => void) => {
        setName(item.name);
        setCategory(item.category);
        if (isProduct && item.composition) {
            const parsed = item.composition.split(/(?:, | \/ )(?=[①-⑳]|\d+\.|-----)/).map(cleanComponentString);
            setSelectedComponents(parsed);
        }
        setShowSuggestions(false);
    }, [isProduct]);

    return useMemo(() => ({
        suggestions, setSuggestions,
        showSuggestions, setShowSuggestions,
        getSuggestions, selectSuggestion
    }), [suggestions, showSuggestions, getSuggestions, selectSuggestion]);
};
