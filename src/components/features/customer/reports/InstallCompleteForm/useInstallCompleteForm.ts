// src/components/features/customer/reports/InstallCompleteForm/useInstallCompleteForm.ts
"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@chakra-ui/react";
import { db, storage } from "@/lib/firebase";
import { collection, serverTimestamp, doc, runTransaction, query, where, getDocs } from "firebase/firestore";
import { ref as sRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { cleanupOrphanedPhotos } from "@/utils/reportUtils";
import { useAuth } from "@/context/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { InstallCompleteFormData, INSTALL_COMPLETE_CONSTANTS } from "./types";
import { Activity } from "@/types/domain";
import { getCircledNumber } from "@/components/features/asset/AssetModalUtils";
import { performSelfHealing } from "@/utils/assetUtils";
import { isWithinBusinessDays } from "@/utils/dateUtils";
import { useReportMetadata } from "@/hooks/useReportMetadata";
import { formatPhone } from "@/utils/formatter";
import { applyColonStandard, normalizeText } from "@/utils/textFormatter";

interface UseInstallCompleteFormProps {
    customer: { id: string, name: string, ownedProducts?: string[], address?: string, phone?: string };
    activities?: any[];
    activityId?: string;
    initialData?: Partial<InstallCompleteFormData>;
    defaultManager?: string;
    rawAssets?: any[];
}

export const useInstallCompleteForm = ({ customer, activities = [], activityId, initialData, defaultManager, rawAssets = [] }: UseInstallCompleteFormProps) => {
    const { userData } = useAuth();
    const { holidayMap } = useReportMetadata();
    const queryClient = useQueryClient();
    const toast = useToast();
    const isSubmitting = useRef(false);
    const [isLoading, setIsLoading] = useState(false);

    const [pendingFiles, setPendingFiles] = useState<{ url: string, file: File }[]>([]);

    const [formData, setFormData] = useState<InstallCompleteFormData>({
        date: "",
        manager: defaultManager || "",
        location: customer?.address || "",
        phone: formatPhone(customer?.phone || ""),
        selectedProducts: [],
        selectedSupplies: [],
        tasksBefore: [],
        tasksAfter: [],
        photos: [],
        memo: "",
        incompleteReason: ""
    });

    useEffect(() => {
        if (initialData) {
            setFormData(prev => ({
                ...prev,
                ...initialData,
                manager: initialData.manager || defaultManager || "",
                selectedProducts: initialData.selectedProducts || [],
                selectedSupplies: initialData.selectedSupplies || [],
                tasksBefore: initialData.tasksBefore || [],
                tasksAfter: initialData.tasksAfter || [],
                photos: initialData.photos || []
            }));
        } else {
            const lastSchedule = [...(activities || [])].reverse().find(a => a.type === "install_schedule");
            const now = new Date();
            const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}  ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

            setFormData(prev => ({
                ...prev,
                date: formattedDate,
                location: lastSchedule?.location || customer?.address || "",
                phone: formatPhone(lastSchedule?.phone || customer?.phone || ""),
                manager: lastSchedule?.manager || prev.manager,
                selectedProducts: lastSchedule?.selectedProducts || [],
                selectedSupplies: lastSchedule?.selectedSupplies || [],
                tasksBefore: (lastSchedule?.tasksBefore || []).map((t: string) => ({ text: t, completed: false })),
                tasksAfter: (lastSchedule?.tasksAfter || []).map((t: string) => ({ text: t, completed: false })),
                photos: lastSchedule?.photos || []
            }));
        }
    }, [initialData, defaultManager, customer.address, customer.phone, activities]);

    const handleUpdateQty = useCallback((type: 'product' | 'supply', index: number, delta: number) => {
        setFormData(prev => {
            const field = type === 'product' ? 'selectedProducts' : 'selectedSupplies';
            const newList = [...prev[field]];
            if (newList[index]) {
                const newQty = Math.max(1, (newList[index].quantity || 1) + delta);
                newList[index] = { ...newList[index], quantity: newQty };
            }
            return { ...prev, [field]: newList };
        });
    }, []);

    const handleRemoveItem = useCallback((type: 'product' | 'supply', index: number) => {
        if (!window.confirm("항목을 삭제하시겠습니까?")) return;
        setFormData(prev => {
            const field = type === 'product' ? 'selectedProducts' : 'selectedSupplies';
            return {
                ...prev,
                [field]: prev[field].filter((_, i) => i !== index)
            };
        });
    }, []);

    const toggleTask = useCallback((type: 'before' | 'after', index: number) => {
        setFormData(prev => {
            const field = type === 'before' ? 'tasksBefore' : 'tasksAfter';
            const newList = [...prev[field]];
            if (newList[index]) {
                newList[index] = { ...newList[index], completed: !newList[index].completed };
            }
            return { ...prev, [field]: newList };
        });
    }, []);

    const handleFileUpload = useCallback((files: FileList) => {
        if (!files) return;
        const remaining = INSTALL_COMPLETE_CONSTANTS.MAX_PHOTOS - (formData.photos.length + pendingFiles.length);
        const toAdd = Array.from(files).slice(0, remaining);

        const newPending = toAdd.map(file => ({
            url: URL.createObjectURL(file),
            file
        }));
        setPendingFiles(prev => [...prev, ...newPending]);
    }, [formData.photos.length, pendingFiles.length]);

    const removePhoto = useCallback((index: number, isPending: boolean) => {
        setFormData(prev => {
            if (isPending) {
                setPendingFiles(p => {
                    const target = p[index];
                    if (target) URL.revokeObjectURL(target.url);
                    return p.filter((_, i) => i !== index);
                });
                return prev;
            }
            return {
                ...prev,
                photos: prev.photos.filter((_, i) => i !== index)
            };
        });
    }, []);



    const submit = useCallback(async (managerOptions: any[]) => {
        if (isLoading || isSubmitting.current) return false;

        if (activityId && initialData) {
            const currentActivity = activities.find(a => a.id === activityId);
            const createdAt = currentActivity?.createdAt?.toDate ? currentActivity.createdAt.toDate() : null;
            const isMaster = userData?.role === 'master';

            if (createdAt && !isMaster) {
                const isWithinEditTime = isWithinBusinessDays(createdAt, 3, holidayMap);
                if (!isWithinEditTime) {
                    toast({ title: "수정 불가", description: "작성 후 3영업일이 경과하여 마스터만 수정 가능합니다.", status: "error", position: "top" });
                    return false;
                }
            }
        }

        const validations = [
            { cond: !formData.date, msg: "시공 일시를 입력해주세요." },
            { cond: !formData.manager, msg: "담당자를 선택해주세요." },
            { cond: !formData.location, msg: "방문 주소를 입력해주세요." },
            { cond: !formData.phone, msg: "연락처를 입력해주세요." },
            { cond: formData.selectedProducts.length === 0, msg: "시공 상품을 1개 이상 선택해주세요." }
        ];

        const error = validations.find(v => v.cond);
        if (error) {
            toast({ title: error.msg, status: "warning", duration: 2000, position: "top" });
            return false;
        }

        setIsLoading(true);
        isSubmitting.current = true;
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
            const cleanPhone = formData.phone.replace(/[^0-9]/g, "");
            const affectedItems = new Set<string>();

            // Upload Photos
            let finalPhotos = [...formData.photos];
            if (pendingFiles.length > 0) {
                const uniquePending = Array.from(new Map(pendingFiles.map(p => [p.file.name + p.file.size, p])).values());
                const uploadPromises = uniquePending.map(async (p, i) => {
                    const ext = p.file.name.split('.').pop() || 'jpg';
                    const filename = `install_complete_${Date.now()}_${i}_${Math.random().toString(36).substring(7)}.${ext}`;
                    const storagePath = `${INSTALL_COMPLETE_CONSTANTS.STORAGE_PATH_PREFIX}/${customer.id}/${filename}`;
                    const storageRef = sRef(storage, storagePath);
                    await uploadBytes(storageRef, p.file);
                    return await getDownloadURL(storageRef);
                });
                const uploadedUrls = await Promise.all(uploadPromises);
                finalPhotos = finalPhotos.filter(url => !url.startsWith('blob:')).concat(uploadedUrls);
            }

            const finalSeen = new Set();
            finalPhotos = finalPhotos.filter(url => {
                const baseUrl = url.split('?')[0].trim();
                if (finalSeen.has(baseUrl)) return false;
                finalSeen.add(baseUrl);
                return true;
            });

            // --- Pre-transaction Read ---
            let existingAssets: any[] = [];
            if (activityId) {
                const assetQuery = query(collection(db, "assets"), where("sourceActivityId", "==", activityId));
                const assetSnap = await getDocs(assetQuery);
                existingAssets = assetSnap.docs.map(d => ({ ref: d.ref, data: d.data() }));
            }

            const saveResult = await runTransaction(db, async (transaction) => {
                const selectedManager = managerOptions.find(o => o.value === formData.manager);
                const targetActivityId = activityId || doc(collection(db, "activities")).id;
                const activityRef = doc(db, "activities", targetActivityId);

                // --- 1. Settlement Calculation (Local) ---
                const lastSchedule = [...(activities || [])].reverse().find(a => a.type === "install_schedule");
                const reservedSupplies = lastSchedule?.selectedSupplies || [];

                const reservedMap = new Map<string, { name: string, category: string, quantity: number }>();
                reservedSupplies.forEach((s: any) => {
                    const key = `${s.name.trim()}|${(s.category || "").trim()}`;
                    if (s.category) {
                        const qty = Number(s.quantity) || 0;
                        reservedMap.set(key, { name: s.name.trim(), category: s.category.trim(), quantity: (reservedMap.get(key)?.quantity || 0) + qty });
                    }
                });

                const actualMap = new Map<string, { name: string, category: string, quantity: number }>();
                formData.selectedSupplies.forEach(s => {
                    const key = `${s.name.trim()}|${(s.category || "").trim()}`;
                    if (s.category) {
                        const qty = Number(s.quantity) || 0;
                        actualMap.set(key, { name: s.name.trim(), category: s.category.trim(), quantity: (actualMap.get(key)?.quantity || 0) + qty });
                    }
                });

                const allKeys = new Set([...reservedMap.keys(), ...actualMap.keys()]);
                const settlementItems: { name: string, category: string, delta: number }[] = [];
                allKeys.forEach(key => {
                    const reservedQty = reservedMap.get(key)?.quantity || 0;
                    const actualQty = actualMap.get(key)?.quantity || 0;
                    const delta = reservedQty - actualQty;
                    if (delta !== 0) {
                        const item = reservedMap.get(key) || actualMap.get(key);
                        if (item) settlementItems.push({ name: item.name, category: item.category, delta });
                    }
                });

                // --- 2. ALL READS & PREPARATION ---
                const metaRef = doc(db, "customer_meta", `${customer.id}_${INSTALL_COMPLETE_CONSTANTS.META_PREFIX}`);
                const metaSnap = await transaction.get(metaRef);
                const customerRef = doc(db, "customers", customer.id);
                const customerSnap = await transaction.get(customerRef);
                const activitySnap = activityId ? await transaction.get(activityRef) : null;

                const metaTracker = new Map<string, { ref: any, data: any, deltaStock: number, deltaOutflow: number, deltaInflow: number }>();

                const encryptMetaId = (name: string, category: string) => {
                    return `meta_${name.trim()}_${category.trim()}`.replace(/\//g, "_");
                };

                const loadMeta = async (metaId: string) => {
                    if (!metaTracker.has(metaId)) {
                        const ref = doc(db, "asset_meta", metaId);
                        const snap = await transaction.get(ref);
                        let data = { totalInflow: 0, totalOutflow: 0, currentStock: 0 };
                        if (snap.exists()) data = snap.data() as any;
                        metaTracker.set(metaId, { ref, data, deltaStock: 0, deltaOutflow: 0, deltaInflow: 0 });
                    }
                };

                // Load Metas for Rollback (Existing Assets)
                if (activityId && existingAssets.length > 0) {
                    for (const asset of existingAssets) {
                        if (asset.data.type === 'inventory') {
                            const metaId = encryptMetaId(asset.data.name, asset.data.category);
                            await loadMeta(metaId);
                        }
                    }
                }

                // Load Metas for New Settlement
                for (const item of settlementItems) {
                    const metaId = encryptMetaId(item.name, item.category);
                    await loadMeta(metaId);
                }

                // Pre-calculate Owned Products
                let currentOwned = (customerSnap.exists() ? customerSnap.data().ownedProducts : []) || [];
                const ownedMap = new Map<string, number>();
                currentOwned.forEach((item: string) => {
                    const match = item.match(/^(.*)\s+x\s+(\d+)$/);
                    if (match) {
                        const name = match[1].trim();
                        const qty = parseInt(match[2]);
                        ownedMap.set(name, (ownedMap.get(name) || 0) + qty);
                    } else if (item.trim()) {
                        ownedMap.set(item.trim(), (ownedMap.get(item.trim()) || 0) + 1);
                    }
                });

                // If editing, first remove previous products
                if (activityId && initialData?.selectedProducts) {
                    (initialData.selectedProducts as any[]).forEach(p => {
                        const name = p.name.trim();
                        const qty = Number(p.quantity) || 0;
                        if (name && ownedMap.has(name)) {
                            ownedMap.set(name, Math.max(0, ownedMap.get(name)! - qty));
                            if (ownedMap.get(name) === 0) ownedMap.delete(name);
                        }
                    });
                }

                // Add current products
                formData.selectedProducts.forEach(p => {
                    const name = p.name.trim();
                    const qty = Number(p.quantity) || 0;
                    if (name) {
                        ownedMap.set(name, (ownedMap.get(name) || 0) + qty);
                    }
                });

                const updatedOwned = Array.from(ownedMap.entries())
                    .sort((a, b) => a[0].localeCompare(b[0]))
                    .map(([name, qty]) => `${name} x ${qty}`);

                let currentMeta = metaSnap.exists() ? metaSnap.data() : { lastSequence: 0, totalCount: 0 };
                const validProducts = formData.selectedProducts.filter(p => p.name && p.name.trim() !== "");
                const validSupplies = formData.selectedSupplies.filter(s => s.name && s.name.trim() !== "");

                const dataToSave: Partial<Activity> = {
                    customerId: customer.id,
                    customerName: customer.name,
                    type: INSTALL_COMPLETE_CONSTANTS.TYPE,
                    typeName: INSTALL_COMPLETE_CONSTANTS.TYPE_NAME,
                    date: formData.date,
                    manager: formData.manager,
                    managerName: selectedManager?.label || formData.manager,
                    managerRole: selectedManager?.role || "employee",
                    location: normalizeText(formData.location),
                    phone: cleanPhone,
                    product: validProducts.map((p, idx) => {
                        const prefix = validProducts.length > 1 ? getCircledNumber(idx + 1) : "";
                        return `${prefix}${normalizeText(p.name)} × ${p.quantity}`;
                    }).join(", "),
                    selectedProducts: validProducts,
                    selectedSupplies: validSupplies,
                    tasksBefore: formData.tasksBefore,
                    tasksAfter: formData.tasksAfter,
                    incompleteReason: [...formData.tasksBefore, ...formData.tasksAfter].every(t => t.completed) ? "" : formData.incompleteReason,
                    photos: finalPhotos,
                    memo: applyColonStandard(formData.memo || ""),
                    updatedAt: serverTimestamp()
                };

                // History (ModificationHistory)
                if (activityId && activitySnap?.exists()) {
                    const oldData = activitySnap.data() as Activity;
                    const changes: string[] = [];

                    // 1. Memo tracking
                    const oldMemo = oldData.memo || "";
                    const newMemo = applyColonStandard(formData.memo || "");
                    if (oldMemo !== newMemo) changes.push(`참고: ${oldMemo || "없음"} → ${newMemo || "없음"}`);

                    // 2. Info tracking
                    if (oldData.date !== formData.date) changes.push(`일시: ${oldData.date} → ${formData.date}`);
                    if (oldData.manager !== formData.manager) {
                        const oldManagerName = oldData.managerName || oldData.manager;
                        const newManagerName = selectedManager?.label || formData.manager;
                        changes.push(`담당: ${oldManagerName} → ${newManagerName}`);
                    }

                    // 3. Address & Contact tracking
                    const oldLoc = oldData.location || "";
                    const newLoc = normalizeText(formData.location);
                    if (oldLoc !== newLoc) changes.push(`주소: ${oldLoc || "없음"} → ${newLoc || "없음"}`);

                    const oldPhone = oldData.phone || "";
                    const newPhone = cleanPhone;
                    if (oldPhone !== newPhone) changes.push(`전화: ${formatPhone(oldPhone) || "없음"} → ${formatPhone(newPhone) || "없음"}`);

                    // 4. Products & Supplies tracking
                    const oldProduct = oldData.product || "";
                    const newProduct = (dataToSave as any).product || "";
                    if (oldProduct !== newProduct) {
                        const cleanOld = oldProduct.replace(/①|②|③|④|⑤|⑥|⑦|⑧|⑨|⑩/g, "").trim();
                        const cleanNew = newProduct.replace(/①|②|③|④|⑤|⑥|⑦|⑧|⑨|⑩/g, "").trim();
                        if (cleanOld !== cleanNew) changes.push(`상품: ${cleanOld || "없음"} → ${cleanNew || "없음"}`);
                    }

                    const oldSupplies = (oldData.selectedSupplies || []).map((s: any) => `${s.name}x${s.quantity}`).sort().join(", ");
                    const newSupplies = (formData.selectedSupplies || []).map((s: any) => `${s.name}x${s.quantity}`).sort().join(", ");
                    if (oldSupplies !== newSupplies) {
                        changes.push(`사용: ${oldSupplies || "없음"} → ${newSupplies || "없음"}`);
                    }

                    // 5. Tasks tracking
                    const oldBefore = oldData.tasksBefore || [];
                    const oldBeforeComp = oldBefore.filter((t: any) => t.completed).length;
                    const newBeforeComp = formData.tasksBefore.filter(t => t.completed).length;

                    const oldAfter = oldData.tasksAfter || [];
                    const oldAfterComp = oldAfter.filter((t: any) => t.completed).length;
                    const newAfterComp = formData.tasksAfter.filter(t => t.completed).length;

                    const oldTotal = oldBefore.length + oldAfter.length;
                    const newTotal = formData.tasksBefore.length + formData.tasksAfter.length;
                    const oldComp = oldBeforeComp + oldAfterComp;
                    const newComp = newBeforeComp + newAfterComp;

                    if (oldComp !== newComp || oldTotal !== newTotal) {
                        changes.push(`결과: ${oldComp}/${oldTotal} → ${newComp}/${newTotal}`);
                    }

                    // 6. Incomplete Reason tracking
                    const oldIncomplete = oldData.incompleteReason || "";
                    const newIncomplete = dataToSave.incompleteReason || "";
                    if (oldIncomplete !== newIncomplete) {
                        changes.push(`사유: ${oldIncomplete || "없음"} → ${newIncomplete || "없음"}`);
                    }

                    // 7. Assets tracking
                    const oldPhotos = (oldData.photos || []).length;
                    const newPhotos = (finalPhotos || []).length;
                    if (oldPhotos !== newPhotos) changes.push(`사진: ${oldPhotos}개 → ${newPhotos}개`);

                    if (changes.length > 0) {
                        const now = new Date();
                        const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}  ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                        dataToSave.modificationHistory = [...(oldData.modificationHistory || []), {
                            time: timeStr,
                            manager: userData?.uid || "unknown",
                            managerName: userData?.name || "알 수 없음",
                            content: changes.join(" / ")
                        }];
                    } else {
                        dataToSave.modificationHistory = oldData.modificationHistory || [];
                    }
                }

                // --- 3. ALL WRITES START ---
                transaction.update(customerRef, {
                    ownedProducts: updatedOwned,
                    lastConsultDate: formData.date,
                    updatedAt: serverTimestamp()
                });

                if (activityId) {
                    existingAssets.forEach(asset => {
                        affectedItems.add(`${asset.data.name}|${asset.data.category}`);
                        if (asset.data.type === 'inventory') {
                            const metaId = encryptMetaId(asset.data.name, asset.data.category);
                            const tracker = metaTracker.get(metaId);
                            if (tracker) {
                                const lastInflow = Number(asset.data.lastInflow) || 0;
                                const lastOutflow = Number(asset.data.lastOutflow) || 0;
                                tracker.deltaStock -= lastInflow;
                                tracker.deltaInflow -= lastInflow;
                                tracker.deltaStock += lastOutflow;
                                tracker.deltaOutflow -= lastOutflow;
                            }
                        }
                        transaction.delete(asset.ref);
                    });
                    transaction.update(activityRef, dataToSave as any);
                } else {
                    const nextSeq = lastSchedule?.sequenceNumber || (activities.filter(a => a.type === INSTALL_COMPLETE_CONSTANTS.TYPE).length + 1);
                    transaction.set(activityRef, {
                        ...dataToSave,
                        sequenceNumber: nextSeq,
                        createdAt: serverTimestamp(),
                        createdBy: userData?.uid || "system",
                        createdByName: userData?.name || "알 수 없음"
                    });

                    transaction.set(metaRef, {
                        lastSequence: nextSeq,
                        totalCount: (Number(currentMeta.totalCount) || 0) + 1,
                        lastUpdatedAt: serverTimestamp()
                    }, { merge: true });
                }

                const nowSec = new Date();
                const actionDate = `${nowSec.getFullYear()}-${String(nowSec.getMonth() + 1).padStart(2, '0')}-${String(nowSec.getDate()).padStart(2, '0')}`;

                // Settlement Writes
                for (const item of settlementItems) {
                    const metaId = encryptMetaId(item.name, item.category);
                    const tracker = metaTracker.get(metaId);
                    affectedItems.add(`${item.name}|${item.category}`);

                    if (item.delta > 0) { // Recovery
                        if (tracker) {
                            tracker.deltaStock += item.delta;
                            tracker.deltaInflow += item.delta;
                        }
                        transaction.set(doc(collection(db, "assets")), {
                            category: item.category,
                            name: item.name,
                            stock: (Number(tracker?.data.currentStock || 0) + (tracker?.deltaStock || 0)),
                            type: "inventory",
                            lastActionDate: actionDate,
                            lastOperator: selectedManager?.label || userData?.name || "System",
                            lastInflow: item.delta,
                            lastOutflow: null,
                            lastRecipient: customer.name || "-",
                            lastRecipientId: customer.id,
                            createdAt: serverTimestamp(),
                            editLog: `시공 정산 회수 (${customer.name}) [Lock-Verified]`,
                            sourceActivityId: targetActivityId
                        });
                    } else if (item.delta < 0) { // Extra Outflow
                        const qty = Math.abs(item.delta);
                        if (tracker) {
                            tracker.deltaStock -= qty;
                            tracker.deltaOutflow += qty;
                        }
                        transaction.set(doc(collection(db, "assets")), {
                            category: item.category,
                            name: item.name,
                            stock: (Number(tracker?.data.currentStock || 0) + (tracker?.deltaStock || 0)),
                            type: "inventory",
                            lastActionDate: actionDate,
                            lastOperator: selectedManager?.label || userData?.name || "System",
                            lastInflow: null,
                            lastOutflow: qty,
                            lastRecipient: customer.name || "-",
                            lastRecipientId: customer.id,
                            createdAt: serverTimestamp(),
                            editLog: `시공 정산 추가사용 (${customer.name}) [Lock-Verified]`,
                            sourceActivityId: targetActivityId
                        });
                    }
                }

                // Meta Commits
                for (const [metaId, tracker] of metaTracker) {
                    if (tracker.deltaStock !== 0 || tracker.deltaOutflow !== 0 || tracker.deltaInflow !== 0) {
                        transaction.set(tracker.ref, {
                            ...tracker.data,
                            currentStock: (Number(tracker.data.currentStock) || 0) + tracker.deltaStock,
                            totalOutflow: (Number(tracker.data.totalOutflow) || 0) + tracker.deltaOutflow,
                            totalInflow: (Number(tracker.data.totalInflow) || 0) + tracker.deltaInflow,
                            lastUpdatedAt: serverTimestamp(),
                            lastAction: "install_complete_sync"
                        }, { merge: true });
                    }
                }

                return { success: true, affectedItems: Array.from(affectedItems) };
            });

            if (saveResult.success) {
                if (activityId && initialData?.photos) {
                    const removedPhotos = initialData.photos.filter((oldUrl: string) => !finalPhotos.includes(oldUrl));
                    await cleanupOrphanedPhotos(removedPhotos);
                }
                Promise.all(saveResult.affectedItems.map(itemKey => {
                    const [name, category] = itemKey.split("|");
                    return performSelfHealing(name, category);
                })).catch(e => console.error("Self-healing error:", e));

                setPendingFiles([]);
                await new Promise(resolve => setTimeout(resolve, 500));
                await queryClient.invalidateQueries({ queryKey: ["activities", customer.id] });
                await queryClient.invalidateQueries({ queryKey: ["customer", customer.id] });
                await queryClient.invalidateQueries({ queryKey: ["customers"] });
                await queryClient.invalidateQueries({ queryKey: ["assets", "management"] });
                toast({ title: "시공 완료 보고 저장", status: "success", duration: 2000, position: "top" });
                return true;
            }
            return false;
        } catch (error: any) {
            console.error("Install Complete Submit Failure:", error);
            toast({ title: "저장 실패", description: error.message, status: "error", position: "top" });
            return false;
        } finally {
            setIsLoading(false);
            isSubmitting.current = false;
        }
    }, [isLoading, formData, activities, pendingFiles, activityId, initialData, customer.id, customer.name, userData?.name, userData?.uid, toast, queryClient, holidayMap]);

    const handleDelete = useCallback(async () => {
        if (!activityId) return false;
        if (initialData) {
            const currentActivity = activities.find(a => a.id === activityId);
            const createdAt = currentActivity?.createdAt?.toDate ? currentActivity.createdAt.toDate() : null;
            const isMaster = userData?.role === 'master';
            if (createdAt && !isMaster && !isWithinBusinessDays(createdAt, 3, holidayMap)) {
                toast({ title: "삭제 불가", description: "3영업일 경과하여 마스터만 가능합니다.", status: "error", position: "top" });
                return false;
            }
        }

        if (!window.confirm("삭제하시겠습니까?")) return false;
        setIsLoading(true);
        try {
            const assetQuery = query(collection(db, "assets"), where("sourceActivityId", "==", activityId));
            const assetSnap = await getDocs(assetQuery);
            const assets = assetSnap.docs.map(d => ({ ref: d.ref, data: d.data() }));

            const result = await runTransaction(db, async (transaction) => {
                const affectedItems = new Set<string>();
                const trackers = new Map<string, { ref: any, data: any }>();

                // 1. ALL READS FIRST
                for (const asset of assets) {
                    const metaId = `meta_${asset.data.name}_${asset.data.category}`.replace(/\//g, "_");
                    if (!trackers.has(metaId)) {
                        const metaRef = doc(db, "asset_meta", metaId);
                        const metaSnap = await transaction.get(metaRef);
                        if (metaSnap.exists()) {
                            trackers.set(metaId, { ref: metaRef, data: metaSnap.data() });
                        }
                    }
                }

                // 2. ALL WRITES AFTER
                for (const asset of assets) {
                    const metaId = `meta_${asset.data.name}_${asset.data.category}`.replace(/\//g, "_");
                    const tracker = trackers.get(metaId);

                    if (tracker) {
                        const currentData = tracker.data;
                        const inflow = Number(asset.data.lastInflow) || 0;
                        const outflow = Number(asset.data.lastOutflow) || 0;

                        // Local update for subsequent assets of same type in this loop
                        const updatedData = {
                            ...currentData,
                            currentStock: (Number(currentData.currentStock) || 0) - inflow + outflow,
                            totalInflow: (Number(currentData.totalInflow) || 0) - inflow,
                            totalOutflow: (Number(currentData.totalOutflow) || 0) - outflow,
                            lastUpdatedAt: serverTimestamp()
                        };

                        transaction.update(tracker.ref, updatedData);
                        tracker.data = updatedData;
                    }
                    affectedItems.add(`${asset.data.name}|${asset.data.category}`);
                    transaction.delete(asset.ref);
                }

                transaction.delete(doc(db, "activities", activityId));
                return { success: true, affectedItems: Array.from(affectedItems) };
            });

            if (result.success) {
                if (initialData?.photos) await cleanupOrphanedPhotos(initialData.photos);
                Promise.all(result.affectedItems.map(itemKey => {
                    const [n, c] = itemKey.split("|");
                    return performSelfHealing(n, c);
                })).catch(e => console.error(e));
                await queryClient.invalidateQueries({ queryKey: ["activities", customer.id] });
                await queryClient.invalidateQueries({ queryKey: ["assets", "management"] });
                toast({ title: "삭제 완료", status: "info", position: "top" });
                return true;
            }
            return false;
        } catch (e: any) {
            console.error(e);
            toast({ title: "삭제 실패", description: e.message, status: "error", position: "top" });
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [activityId, initialData, activities, userData?.role, holidayMap, toast, customer.id, queryClient]);

    return {
        formData,
        isLoading,
        pendingFiles,
        setFormData,
        handleUpdateQty,
        handleRemoveItem,
        toggleTask,
        handleFileUpload,
        removePhoto,
        submit,
        handleDelete
    };
};

useInstallCompleteForm.displayName = "useInstallCompleteForm";
