// src/components/features/asset/hooks/useAssetSubmitAction.ts
import { useState, useCallback } from "react";
import { useToast } from "@chakra-ui/react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { collection, serverTimestamp, doc, runTransaction } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AssetData, performSelfHealing } from "@/utils/assetUtils";
import { DATE_FORMAT_STANDARD, getCircledNumber } from "../AssetModalUtils";

export const useAssetSubmitAction = (assets: AssetData[], selectedAsset: AssetData | undefined, isProduct: boolean, userData: any) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const toast = useToast();
    const queryClient = useQueryClient();

    const submitAsset = useCallback(async (
        formValues: any,
        isQtyChanged: boolean,
        handleClose: () => void
    ) => {
        const { category, name, qty, price, selectedComponents, editReason, isDeliveryItem } = formValues;
        const stockNum = parseInt(qty.replace(/,/g, "") || "0");
        const priceNum = parseInt(price.replace(/,/g, "") || "0");

        if (!userData?.name) {
            toast({ title: "인증 오류", status: "error", position: "top" });
            return;
        }

        setIsSubmitting(true);
        try {
            const actionDate = format(new Date(), DATE_FORMAT_STANDARD);
            const sanitizedName = (name || "").trim();
            const sanitizedCategory = (category || "").trim();
            const metaId = `meta_${sanitizedName}_${sanitizedCategory}`.replace(/\//g, "_");

            await runTransaction(db, async (transaction) => {
                if (selectedAsset) {
                    const assetRef = doc(db, "assets", selectedAsset.id);

                    if (isProduct) {
                        // Product Update
                        transaction.update(assetRef, {
                            category, name, price: priceNum,
                            lastActionDate: actionDate,
                            lastOperator: userData.name
                        });
                    } else if (isQtyChanged) {
                        // Inventory Qty Change
                        const prevVal = Number(selectedAsset.lastInflow) || Number(selectedAsset.lastOutflow) || 0;
                        const typeLabel = selectedAsset.lastInflow ? "입고" : "출고";
                        const log = `${typeLabel} 수량 변경: ${prevVal} → ${stockNum} (${editReason})`;
                        const delta = stockNum - prevVal;

                        transaction.update(assetRef, {
                            stock: (Number(selectedAsset.stock) || 0) + delta,
                            lastInflow: selectedAsset.lastInflow ? stockNum : null,
                            lastOutflow: selectedAsset.lastOutflow ? stockNum : null,
                            editTime: (selectedAsset.editTime && selectedAsset.editTime !== "-") ? `${selectedAsset.editTime}\n${actionDate}` : actionDate,
                            editLog: (selectedAsset.editLog && selectedAsset.editLog !== "-") ? `${selectedAsset.editLog}\n${log}` : log,
                            editOperators: (selectedAsset.editOperators && selectedAsset.editOperators !== "-") ? `${selectedAsset.editOperators}\n${userData.name}` : userData.name
                        });
                    } else {
                        // Basic Info Update
                        const isCoreChanged = sanitizedName !== (selectedAsset.name || "").trim() ||
                            sanitizedCategory !== (selectedAsset.category || "").trim();

                        if (isCoreChanged) {
                            const transition = `${selectedAsset.category}/${selectedAsset.name} → ${category}/${name}`;
                            const log = `정보 변경 :  ${transition}`;
                            transaction.update(assetRef, {
                                category, name, isDeliveryItem,
                                editTime: (selectedAsset.editTime && selectedAsset.editTime !== "-") ? `${selectedAsset.editTime}\n${actionDate}` : actionDate,
                                editLog: (selectedAsset.editLog && selectedAsset.editLog !== "-") ? `${selectedAsset.editLog}\n${log}` : log,
                                editOperators: (selectedAsset.editOperators && selectedAsset.editOperators !== "-") ? `${selectedAsset.editOperators}\n${userData.name}` : userData.name
                            });
                        } else if (isDeliveryItem !== (selectedAsset.isDeliveryItem || false)) {
                            transaction.update(assetRef, { isDeliveryItem });
                        }
                    }
                } else {
                    // New Registration
                    const newAssetRef = doc(collection(db, "assets"));
                    if (isProduct) {
                        const finalComp = selectedComponents.map((c: string, i: number) => `${getCircledNumber(i + 1)}${c}`).join(", ");
                        transaction.set(newAssetRef, {
                            category, name, price: priceNum, composition: finalComp, type: "product",
                            lastActionDate: actionDate, lastOperator: userData.name,
                            createdAt: serverTimestamp(), orderIndex: assets.length
                        });
                    } else {
                        // For inventory, we need to know current stock to set initial historical balance
                        const metaRef = doc(db, "asset_meta", metaId);
                        const metaSnap = await transaction.get(metaRef);
                        const currentStock = metaSnap.exists() ? (Number(metaSnap.data().currentStock) || 0) : 0;

                        transaction.set(newAssetRef, {
                            category, name, stock: currentStock + stockNum, type: "inventory",
                            isDeliveryItem,
                            lastActionDate: actionDate, lastOperator: userData.name,
                            lastInflow: stockNum, lastOutflow: null, lastRecipient: "-",
                            createdAt: serverTimestamp(), orderIndex: assets.length
                        });

                        // Increment meta immediately in transaction
                        transaction.set(metaRef, {
                            currentStock: currentStock + stockNum,
                            totalInflow: (metaSnap.exists() ? (Number(metaSnap.data().totalInflow) || 0) : 0) + stockNum,
                            lastUpdatedAt: serverTimestamp()
                        }, { merge: true });
                    }
                }
            });

            // Post-transaction cleanup: Self-healing for complex state changes (name/category shift)
            if (selectedAsset && !isProduct) {
                const isCoreChanged = sanitizedName !== (selectedAsset.name || "").trim() ||
                    sanitizedCategory !== (selectedAsset.category || "").trim();
                if (isCoreChanged) {
                    await performSelfHealing((selectedAsset.name || "").trim(), (selectedAsset.category || "").trim(), assets.filter(a => a.id !== selectedAsset.id));
                }
                await performSelfHealing(sanitizedName, sanitizedCategory);
            } else if (!selectedAsset && !isProduct) {
                // For new items, healing ensures meta is 100% correct across all history
                await performSelfHealing(sanitizedName, sanitizedCategory);
            }

            toast({ title: selectedAsset ? "수정 완료" : "등록 완료", status: "success", position: "top" });
            handleClose();
        } catch (e: any) {
            console.error("Asset Submission Logic Failure:", e);
            toast({ title: "저장 실패", description: e.message, status: "error", position: "top" });
        } finally {
            setIsSubmitting(false);
        }
    }, [assets, selectedAsset, isProduct, userData, toast]);

    return { isSubmitting, submitAsset };
};
