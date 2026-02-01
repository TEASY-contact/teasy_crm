// src/components/features/asset/hooks/useAssetFormState.ts
import { useState, useEffect, useMemo } from "react";
import { AssetData, getAssetTimestamp } from "@/utils/assetUtils";
import { cleanComponentString } from "../AssetModalUtils";

export const useAssetFormState = (isOpen: boolean, selectedAsset: AssetData | undefined, isProduct: boolean) => {
    const [category, setCategory] = useState("");
    const [name, setName] = useState("");
    const [spec, setSpec] = useState("");
    const [unit, setUnit] = useState("");
    const [notes, setNotes] = useState("");
    const [qty, setQty] = useState("");
    const [price, setPrice] = useState("");
    const [composition, setComposition] = useState("");
    const [selectedComponents, setSelectedComponents] = useState<string[]>([]);
    const [editReason, setEditReason] = useState("");

    useEffect(() => {
        if (isOpen) {
            if (selectedAsset) {
                setCategory(selectedAsset.category || "");
                setName(selectedAsset.name || "");
                if (isProduct) {
                    setPrice((selectedAsset.price || 0).toLocaleString());
                    setSpec(selectedAsset.spec || "");
                    setUnit(selectedAsset.unit || "");
                    setNotes(selectedAsset.notes || "");
                    const rawComp = selectedAsset.composition || "";
                    setComposition(rawComp);
                    const parsed = rawComp ? rawComp.split(/(?:, | \/ )(?=[①-⑳]|\d+\.|-----)/).map(cleanComponentString) : [];
                    setSelectedComponents(parsed);
                } else {
                    setQty((selectedAsset.lastInflow || 0).toLocaleString());
                }
            } else {
                setCategory(""); setName(""); setSpec(""); setUnit(""); setNotes(""); setQty(""); setPrice(""); setComposition(""); setSelectedComponents([]);
            }
            setEditReason("");
        }
    }, [selectedAsset, isOpen, isProduct]);

    return useMemo(() => ({
        category, setCategory, name, setName, spec, setSpec, unit, setUnit, notes, setNotes,
        qty, setQty, price, setPrice, composition, setComposition,
        selectedComponents, setSelectedComponents, editReason, setEditReason
    }), [
        category, name, spec, unit, notes, qty, price, composition,
        selectedComponents, editReason
    ]);
};
