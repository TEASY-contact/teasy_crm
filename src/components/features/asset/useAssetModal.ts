import { useMemo, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { AssetData, getAssetTimestamp } from "@/utils/assetUtils";
import { MAX_QTY_LIMIT } from "./AssetModalUtils";
import { useAssetFormState } from "./hooks/useAssetFormState";
import { useAssetSuggestions } from "./hooks/useAssetSuggestions";
import { useAssetSubmitAction } from "./hooks/useAssetSubmitAction";

export const useAssetModal = (isOpen: boolean, onClose: () => void, assets: AssetData[], selectedAsset?: AssetData, viewMode: "inventory" | "product" = "inventory") => {
    const { userData } = useAuth();
    const isEdit = !!selectedAsset;
    const isProduct = viewMode === "product";

    // 1. Form State Layer
    const form = useAssetFormState(isOpen, selectedAsset, isProduct);
    const {
        category, setCategory, name, setName, qty, setQty, price, setPrice,
        selectedComponents, setSelectedComponents, editReason, isDeliveryItem, setIsDeliveryItem
    } = form;

    const stockNum = parseInt(qty.replace(/,/g, "") || "0");
    const isCategoryChanged = !isProduct && isEdit && selectedAsset && category !== (selectedAsset.category || "");
    const isNameChanged = !isProduct && isEdit && selectedAsset && name !== (selectedAsset.name || "");
    const isQtyChanged = !isProduct && isEdit && selectedAsset && stockNum !== (selectedAsset.lastInflow || 0);

    // 2. Suggestion Layer
    const {
        suggestions, setSuggestions, showSuggestions, setShowSuggestions,
        getSuggestions, selectSuggestion
    } = useAssetSuggestions(assets, isProduct, isEdit);

    // 3. Action Layer
    const { isSubmitting, submitAsset } = useAssetSubmitAction(assets, selectedAsset, isProduct, userData);

    // Composition Options
    const compositionOptions = useMemo(() => {
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const oneYearAgoTs = oneYearAgo.getTime();

        return Array.from(new Set(
            assets
                .filter(a => a.type === "inventory" && a.name && a.name !== "-")
                .filter(a => (getAssetTimestamp(a.createdAt) * 1000) >= oneYearAgoTs)
                .map(a => a.name)
        ))
            .sort()
            .map(n => ({ value: n as string, label: n as string }));
    }, [assets]);

    const handleQtyChange = useCallback((val: string) => {
        const numeric = val.replace(/\D/g, "");
        const num = parseInt(numeric || "0");
        if (num > MAX_QTY_LIMIT) return;
        setQty(num === 0 && numeric === "" ? "" : num.toLocaleString());
    }, [setQty]);

    const handlePriceChange = useCallback((val: string) => {
        const numeric = val.replace(/\D/g, "");
        const num = parseInt(numeric || "0");
        if (num > 100000000) return;
        setPrice(num === 0 && numeric === "" ? "" : num.toLocaleString());
    }, [setPrice]);

    const handleNameChange = (val: string) => {
        setName(val);
        getSuggestions(val);
    };

    const handleSuggestionSelect = (item: any) => {
        selectSuggestion(item, setName, setCategory, setSelectedComponents);
    };

    const handleSubmit = () => {
        submitAsset(form, isQtyChanged, onClose);
    };

    return useMemo(() => ({
        ...form,
        isSubmitting,
        suggestions, setSuggestions, showSuggestions, setShowSuggestions,
        isEdit, isProduct, compositionOptions,
        isCategoryChanged, isNameChanged, isQtyChanged,
        handleClose: onClose, handleQtyChange, handlePriceChange, handleSubmit,
        handleNameChange, handleSuggestionSelect
    }), [
        form, isSubmitting, suggestions, showSuggestions, isEdit, isProduct,
        compositionOptions, isCategoryChanged, isNameChanged, isQtyChanged,
        onClose, handleQtyChange, handlePriceChange, handleSubmit,
        handleNameChange, handleSuggestionSelect
    ]);
};
