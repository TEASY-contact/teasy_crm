// src/hooks/useBulkImport.ts
"use client";
import { useState, useCallback } from "react";
import { db } from "@/lib/firebase";
import {
    writeBatch, doc, collection, query, where,
    getDocs, updateDoc, serverTimestamp
} from "firebase/firestore";
import { useQueryClient } from "@tanstack/react-query";

/** 중복 병합 결과 */
export interface MergeResult {
    name: string;
    phone: string;
}

/** 등록 결과 */
export interface BulkImportResult {
    newCount: number;
    mergedCount: number;
    reportCount: number;
    errorCount: number;
    mergedList: MergeResult[];
    errors: string[];
}

/** Activity type 구분자 → ActivityType 매핑 */
const TYPE_MAP: Record<string, { type: string; typeName: string }> = {
    "신규 문의": { type: "inquiry", typeName: "신규 문의" },
    "예약": { type: "demo_schedule", typeName: "데모 예약" },
    "완료": { type: "demo_complete", typeName: "데모 완료" },
    "구매 확정": { type: "purchase_confirm", typeName: "구매 확정" },
    "확정": { type: "install_schedule", typeName: "시공 확정" },
    "시공 완료": { type: "install_complete", typeName: "시공 완료" },
    "방문 예약": { type: "as_schedule", typeName: "방문 A/S 예약" },
    "방문 완료": { type: "as_complete", typeName: "방문 A/S 완료" },
    "원격 완료": { type: "remoteas_complete", typeName: "원격 A/S 완료" },
};

/** 쉼표 구분 문자열 → 배열 */
const splitComma = (val: any): string[] => {
    if (!val) return [];
    return String(val).split(",").map(s => s.trim()).filter(Boolean);
};

/** 배열 병합 (중복 제거) */
const mergeArrays = (existing: string[], incoming: string[]): string[] => {
    const set = new Set([...existing, ...incoming]);
    return Array.from(set).filter(Boolean);
};

/** 담당자 이름 → UID 매칭 (동명이인 시 첫 번째 매칭) */
const resolveManagers = async (): Promise<Map<string, { uid: string; name: string; role: string }>> => {
    const snap = await getDocs(collection(db, "users"));
    const map = new Map<string, { uid: string; name: string; role: string }>();
    snap.docs.forEach(d => {
        const data = d.data();
        if (!map.has(data.name)) {
            map.set(data.name, { uid: d.id, name: data.name, role: data.role || "employee" });
        }
    });
    return map;
};

export const useBulkImport = () => {
    const [progress, setProgress] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const queryClient = useQueryClient();

    const importCustomers = useCallback(async (file: File): Promise<BulkImportResult> => {
        setIsProcessing(true);
        setProgress(0);

        const result: BulkImportResult = {
            newCount: 0, mergedCount: 0, reportCount: 0, errorCount: 0,
            mergedList: [], errors: []
        };

        try {
            const XLSX = await import("xlsx");
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: "array" });

            // 1. 담당자 목록 로드
            const managerMap = await resolveManagers();

            // 2. 고객 정보 시트 파싱
            const customerSheet = workbook.Sheets["고객 정보"];
            if (!customerSheet) {
                result.errors.push("'고객 정보' 시트를 찾을 수 없습니다.");
                result.errorCount++;
                return result;
            }

            const customerRows: any[] = XLSX.utils.sheet_to_json(customerSheet);
            if (customerRows.length === 0) {
                result.errors.push("고객 정보 시트에 데이터가 없습니다.");
                result.errorCount++;
                return result;
            }

            setProgress(10);

            // 보고서 시트 파싱
            const reportSheets: Record<string, any[]> = {};
            ["신규 문의", "데모", "구매 확정", "시공", "AS"].forEach(name => {
                const sheet = workbook.Sheets[name];
                if (sheet) reportSheets[name] = XLSX.utils.sheet_to_json(sheet);
            });

            setProgress(20);

            // 3. 기존 고객 전화번호 인덱스 (중복 체크)
            const existingSnap = await getDocs(collection(db, "customers"));
            const phoneIndex = new Map<string, { id: string; data: any }>();
            existingSnap.docs.forEach(d => {
                const cd = d.data();
                const norm = (cd.phone || "").replace(/[\s-]/g, "");
                if (norm) phoneIndex.set(norm, { id: d.id, data: cd });
                (cd.sub_phones || []).forEach((sp: string) => {
                    const n = (sp || "").replace(/[\s-]/g, "");
                    if (n) phoneIndex.set(n, { id: d.id, data: cd });
                });
            });

            setProgress(30);

            // 4. 고객 정보 처리 — 순번 → docId 매핑 생성
            const seqToDocId = new Map<number, string>();
            const seqToName = new Map<number, string>();
            const totalSteps = customerRows.length;

            for (let i = 0; i < customerRows.length; i++) {
                const row = customerRows[i];
                const seq = Number(row["순번*"]);
                const name = String(row["고객명*"] || "").trim();
                const phone = String(row["연락처(대표)*"] || "").trim();

                if (!seq || !name || !phone) {
                    result.errors.push(`고객 정보 행 ${i + 2}: 순번, 고객명, 또는 연락처 누락`);
                    result.errorCount++;
                    continue;
                }

                // 관리 총판: 미입력 시 "TEASY"
                const distributor = String(row["관리 총판*"] || "").trim() || "TEASY";

                const normalizedPhone = phone.replace(/[\s-]/g, "");
                const existing = phoneIndex.get(normalizedPhone);

                if (existing) {
                    // 중복 → 병합
                    const updates: Record<string, any> = {};
                    const incomingSubPhones = splitComma(row["추가 연락처"]);
                    const incomingSubAddresses = splitComma(row["추가 주소"]);
                    const incomingProducts = splitComma(row["보유 상품"]);
                    const incomingAddress = String(row["주소(대표)"] || "").trim();

                    if (incomingSubPhones.length > 0) {
                        updates.sub_phones = mergeArrays(existing.data.sub_phones || [], incomingSubPhones);
                    }
                    // 주소: 기존 없으면 적용, 있고 다르면 sub_addresses에 추가
                    if (incomingAddress) {
                        if (!existing.data.address) {
                            updates.address = incomingAddress;
                        } else if (existing.data.address !== incomingAddress) {
                            const existingSubs = existing.data.sub_addresses || [];
                            if (!existingSubs.includes(incomingAddress)) {
                                updates.sub_addresses = mergeArrays(existingSubs, [incomingAddress, ...incomingSubAddresses]);
                            }
                        }
                    }
                    if (incomingSubAddresses.length > 0 && !updates.sub_addresses) {
                        updates.sub_addresses = mergeArrays(existing.data.sub_addresses || [], incomingSubAddresses);
                    }
                    if (incomingProducts.length > 0) {
                        updates.ownedProducts = mergeArrays(existing.data.ownedProducts || [], incomingProducts);
                    }
                    if (!existing.data.distributor) {
                        updates.distributor = distributor;
                    }
                    if (row["라이선스"] && !existing.data.license) {
                        updates.license = String(row["라이선스"]).trim();
                    }
                    if (row["비고"]) {
                        updates.notes = existing.data.notes
                            ? `${existing.data.notes}\n${String(row["비고"]).trim()}`
                            : String(row["비고"]).trim();
                    }
                    if (row["메모"]) {
                        updates.memo = existing.data.memo
                            ? `${existing.data.memo}\n${String(row["메모"]).trim()}`
                            : String(row["메모"]).trim();
                    }

                    if (Object.keys(updates).length > 0) {
                        updates.updatedAt = serverTimestamp();
                        await updateDoc(doc(db, "customers", existing.id), updates);
                    }

                    seqToDocId.set(seq, existing.id);
                    seqToName.set(seq, existing.data.name);
                    result.mergedCount++;
                    result.mergedList.push({ name: existing.data.name, phone });
                } else {
                    // 신규 등록
                    const newRef = doc(collection(db, "customers"));
                    const newCustomer: Record<string, any> = {
                        no: seq,
                        name,
                        phone,
                        address: String(row["주소(대표)"] || "").trim(),
                        sub_phones: splitComma(row["추가 연락처"]),
                        sub_addresses: splitComma(row["추가 주소"]),
                        ownedProducts: splitComma(row["보유 상품"]),
                        distributor,
                        license: String(row["라이선스"] || "").trim(),
                        notes: String(row["비고"] || "").trim(),
                        memo: String(row["메모"] || "").trim(),
                        registeredDate: String(row["등록일"] || new Date().toISOString().split("T")[0]).trim(),
                        lastConsultDate: null,
                        isImported: true,
                        createdAt: serverTimestamp(),
                    };

                    const batch = writeBatch(db);
                    batch.set(newRef, newCustomer);
                    await batch.commit();

                    seqToDocId.set(seq, newRef.id);
                    seqToName.set(seq, name);
                    phoneIndex.set(normalizedPhone, { id: newRef.id, data: newCustomer });
                    result.newCount++;
                }

                setProgress(30 + Math.round(((i + 1) / totalSteps) * 40));
            }

            setProgress(70);

            // 5. 보고서 처리 — 순번으로 고객 매칭
            const allReportRows: { sheetName: string; row: any; rowIdx: number }[] = [];
            Object.entries(reportSheets).forEach(([sheetName, rows]) => {
                rows.forEach((row, idx) => allReportRows.push({ sheetName, row, rowIdx: idx + 2 }));
            });

            const reportChunkSize = 100;
            for (let i = 0; i < allReportRows.length; i += reportChunkSize) {
                const batch = writeBatch(db);
                const chunk = allReportRows.slice(i, i + reportChunkSize);

                for (const { sheetName, row, rowIdx } of chunk) {
                    const seq = Number(row["순번*"]);
                    const customerId = seqToDocId.get(seq);
                    const customerName = seqToName.get(seq);

                    if (!customerId || !customerName) {
                        result.errors.push(`${sheetName} 행 ${rowIdx}: 순번 '${seq}'에 해당하는 고객을 찾을 수 없습니다`);
                        result.errorCount++;
                        continue;
                    }

                    const dateStr = String(row["일시*"] || "").trim();
                    const managerName = String(row["담당자*"] || "").trim();

                    if (!dateStr || !managerName) {
                        result.errors.push(`${sheetName} 행 ${rowIdx}: 일시 또는 담당자 누락`);
                        result.errorCount++;
                        continue;
                    }

                    const manager = managerMap.get(managerName);
                    if (!manager) {
                        result.errors.push(`${sheetName} 행 ${rowIdx}: '${managerName}' 담당자를 찾을 수 없습니다`);
                        result.errorCount++;
                        continue;
                    }

                    // 타입 결정
                    let typeInfo: { type: string; typeName: string } | undefined;

                    if (sheetName === "신규 문의") {
                        typeInfo = TYPE_MAP["신규 문의"];
                    } else if (sheetName === "구매 확정") {
                        typeInfo = TYPE_MAP["구매 확정"];
                    } else {
                        const subType = String(row["구분*"] || "").trim();
                        if (sheetName === "시공") {
                            typeInfo = subType === "완료" ? TYPE_MAP["시공 완료"] : TYPE_MAP["확정"];
                        } else {
                            typeInfo = TYPE_MAP[subType];
                        }
                    }

                    if (!typeInfo) {
                        result.errors.push(`${sheetName} 행 ${rowIdx}: 알 수 없는 구분값`);
                        result.errorCount++;
                        continue;
                    }

                    const activityRef = doc(collection(db, "customers", customerId, "activities"));
                    const activity: Record<string, any> = {
                        customerId,
                        customerName,
                        type: typeInfo.type,
                        typeName: typeInfo.typeName,
                        date: dateStr,
                        manager: manager.uid,
                        managerName: manager.name,
                        managerRole: manager.role,
                        memo: String(row["메모"] || "").trim(),
                        isImported: true,
                        createdAt: serverTimestamp(),
                    };

                    // 시트별 추가 필드
                    if (sheetName === "신규 문의") {
                        if (row["유입 경로"]) activity.channel = String(row["유입 경로"]).trim();
                        if (row["닉네임"]) activity.nickname = String(row["닉네임"]).trim();
                        if (row["관심 제품"]) activity.product = String(row["관심 제품"]).trim();
                    } else if (sheetName === "데모" || sheetName === "시공") {
                        if (row["제품"]) activity.product = String(row["제품"]).trim();
                        if (row["장소"]) activity.location = String(row["장소"]).trim();
                        if (row["현장 연락처"]) activity.phone = String(row["현장 연락처"]).trim();
                    } else if (sheetName === "구매 확정") {
                        if (row["결제 방식"]) activity.payMethod = String(row["결제 방식"]).trim();
                        if (row["금액"]) activity.amount = Number(row["금액"]) || 0;
                        if (row["할인 유형"]) activity.discountType = String(row["할인 유형"]).trim();
                        if (row["할인 금액"]) activity.discountAmount = Number(row["할인 금액"]) || 0;
                        if (row["제품"]) activity.product = String(row["제품"]).trim();
                    } else if (sheetName === "AS") {
                        if (row["AS 유형"]) activity.asType = String(row["AS 유형"]).trim();
                        if (row["제품"]) activity.product = String(row["제품"]).trim();
                        if (row["장소"]) activity.location = String(row["장소"]).trim();
                        if (row["현장 연락처"]) activity.phone = String(row["현장 연락처"]).trim();
                        if (row["지원 내용"]) activity.supportContent = String(row["지원 내용"]).trim();
                    }

                    batch.set(activityRef, activity);
                    result.reportCount++;
                }

                await batch.commit();
                setProgress(70 + Math.round(((i + chunk.length) / allReportRows.length) * 25));
            }

            setProgress(100);

            // 캐시 무효화
            await queryClient.invalidateQueries({ queryKey: ["customers", "list"] });

        } catch (error: any) {
            result.errors.push(`처리 중 오류: ${error.message || "알 수 없는 오류"}`);
            result.errorCount++;
        } finally {
            setIsProcessing(false);
        }

        return result;
    }, [queryClient]);

    return { importCustomers, progress, isProcessing };
};
