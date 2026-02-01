// src/components/features/asset/hooks/useAssetSubmitAction.ts
import { useState, useCallback, useMemo } from "react";
import { useToast } from "@chakra-ui/react";
import { format } from "date-fns";
import { collection, addDoc, serverTimestamp, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AssetData, performSelfHealing, calculateInitialStock } from "@/utils/assetUtils";
import { DATE_FORMAT_STANDARD, getCircledNumber } from "../AssetModalUtils";

export const useAssetSubmitAction = (assets: AssetData[], selectedAsset: AssetData | undefined, isProduct: boolean, userData: any) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const toast = useToast();

    const submitAsset = useCallback(async (
        formValues: any,
        isQtyChanged: boolean,
        handleClose: () => void
    ) => {
        const { category, name, qty, price, selectedComponents, editReason } = formValues;
        const stockNum = parseInt(qty.replace(/,/g, "") || "0");
        const priceNum = parseInt(price.replace(/,/g, "") || "0");

        if (!userData?.name) {
            toast({ title: "인증 오류", status: "error", position: "top" });
            return;
        }

        if (isProduct) {
            if (!category || !name || !price) {
                toast({ title: "입력 확인", description: "카테고리, 상품명, 판매가는 필수항목입니다.", status: "warning", position: "top" });
                return;
            }
        } else {
            if (!category || !name || !qty || (isQtyChanged && !editReason)) {
                toast({ title: "입력 확인", description: isQtyChanged ? "수량 변경 시 사유를 입력해주세요." : "모든 항목을 입력해주세요.", status: "warning", position: "top" });
                return;
            }
            if (stockNum < 1) {
                toast({ title: "수량 확인", description: "입고 수량은 최소 1개 이상이어야 합니다.", status: "warning", position: "top" });
                return;
            }
        }

        setIsSubmitting(true);
        try {
            const actionDate = format(new Date(), DATE_FORMAT_STANDARD);
            if (selectedAsset) {
                if (isProduct) {
                    let productIdx = 0;
                    const finalComp = selectedComponents.map((c: string) => c.startsWith("__DIVIDER__") ? "-----" : `${getCircledNumber(++productIdx)}${c}`).join(", ");
                    await updateDoc(doc(db, "assets", selectedAsset.id), {
                        category, name, price: priceNum, composition: finalComp,
                        lastActionDate: actionDate, lastOperator: userData.name
                    });
                } else {
                    if (isQtyChanged) {
                        const prevVal = selectedAsset.lastInflow || selectedAsset.lastOutflow || 0;
                        const action = selectedAsset.lastInflow ? "입고 수량 변경" : "출고 수량 변경";
                        const log = `${action} :  ${prevVal.toLocaleString()} → ${stockNum.toLocaleString()}${editReason ? `\r(*${editReason})` : ""}`;
                        const delta = stockNum - prevVal;
                        const updates: any = {
                            stock: (selectedAsset.stock || 0) + delta,
                            editTime: (selectedAsset.editTime && selectedAsset.editTime !== "-") ? `${selectedAsset.editTime}\n${actionDate}` : actionDate,
                            editLog: (selectedAsset.editLog && selectedAsset.editLog !== "-") ? `${selectedAsset.editLog}\n${log}` : log,
                            editOperators: (selectedAsset.editOperators && selectedAsset.editOperators !== "-") ? `${selectedAsset.editOperators}\n${userData.name}` : userData.name
                        };
                        if (selectedAsset.lastInflow) updates.lastInflow = stockNum;
                        else if (selectedAsset.lastOutflow) updates.lastOutflow = stockNum;

                        await updateDoc(doc(db, "assets", selectedAsset.id), updates);
                        await performSelfHealing(selectedAsset.name || "", selectedAsset.category || "", assets, updates, selectedAsset.id);
                    } else {
                        const transition = (name !== selectedAsset.name && category !== selectedAsset.category) ? `${selectedAsset.category}/${selectedAsset.name} → ${category}/${name}` : (name !== selectedAsset.name ? `${selectedAsset.name} → ${name}` : `${selectedAsset.category} → ${category}`);
                        const log = `정보 변경 :  ${transition}`;
                        const updates = {
                            category, name,
                            editTime: (selectedAsset.editTime && selectedAsset.editTime !== "-") ? `${selectedAsset.editTime}\n${actionDate}` : actionDate,
                            editLog: (selectedAsset.editLog && selectedAsset.editLog !== "-") ? `${selectedAsset.editLog}\n${log}` : log,
                            editOperators: (selectedAsset.editOperators && selectedAsset.editOperators !== "-") ? `${selectedAsset.editOperators}\n${userData.name}` : userData.name
                        };
                        await updateDoc(doc(db, "assets", selectedAsset.id), updates);
                        await performSelfHealing(selectedAsset.name || "", selectedAsset.category || "", assets.filter(a => a.id !== selectedAsset.id));
                        await performSelfHealing(category, name, assets, updates, selectedAsset.id);
                    }
                }
                toast({ title: "수정 완료", status: "success", position: "top" });
            } else {
                if (isProduct) {
                    const finalComp = selectedComponents.map((c: string, i: number) => `${getCircledNumber(i + 1)}${c}`).join(", ");
                    await addDoc(collection(db, "assets"), {
                        category, name, price: priceNum, composition: finalComp, type: "product",
                        lastActionDate: actionDate, lastOperator: userData.name,
                        createdAt: serverTimestamp(), orderIndex: assets.length
                    });
                } else {
                    const finalStock = calculateInitialStock(name, category, assets, stockNum);
                    await addDoc(collection(db, "assets"), {
                        category, name, stock: finalStock, type: "inventory",
                        lastActionDate: actionDate, lastOperator: userData.name,
                        lastInflow: stockNum, lastOutflow: null, lastRecipient: "-",
                        createdAt: serverTimestamp(), orderIndex: assets.length
                    });
                    await performSelfHealing(name, category, assets);
                }
                toast({ title: "등록 완료", status: "success", position: "top" });
            }
            handleClose();
        } catch (e) {
            console.error(e);
            toast({ title: "작업 실패", status: "error", position: "top" });
        } finally {
            setIsSubmitting(false);
        }
    }, [assets, selectedAsset, isProduct, userData, toast]);

    return useMemo(() => ({ isSubmitting, submitAsset }), [isSubmitting, submitAsset]);
};
