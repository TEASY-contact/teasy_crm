// src/hooks/useBulkImport.ts
"use client";
import { useState, useCallback } from "react";
import { db } from "@/lib/firebase";
import {
    writeBatch, doc, collection,
    getDocs, serverTimestamp, addDoc
} from "firebase/firestore";
import { useQueryClient } from "@tanstack/react-query";
import { REPORT_SHEETS, CUSTOMER_SHEET } from "@/utils/bulkTemplateGenerator";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MergeResult { name: string; phone: string; }

export interface BulkImportResult {
    newCount: number;
    mergedCount: number;
    reportCount: number;
    errorCount: number;
    mergedList: MergeResult[];
    errors: string[];
    failedRows: FailedRow[];
}

interface FailedRow {
    sheetName: string;
    row: Record<string, any>;
    reason: string;
}

interface ParsedCustomer {
    seq: number;
    name: string;
    phone: string;
    normalizedPhone: string;
    raw: Record<string, any>;
    memo: string;
    registeredDate: string;
}

interface ResolvedManager {
    uid: string;
    name: string;
    role: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** 시트명 → activityType / typeName 매핑 */
const SHEET_TYPE_MAP: Record<string, { type: string; typeName: string }> = {};
REPORT_SHEETS.forEach(s => {
    const label = s.name;
    SHEET_TYPE_MAP[label] = { type: s.activityType, typeName: label };
});

const SYSTEM_UID = "TEASY_SYSTEM";
const SYSTEM_NAME = "시스템";
const BATCH_LIMIT = 450; // Firestore batch limit is 500, keep margin

// ─── Utilities ───────────────────────────────────────────────────────────────

/** 전화번호 정규화 (숫자만 추출) */
const normalizePhone = (val: any): string =>
    String(val || "").replace(/[^0-9]/g, "");

/** 쉼표 구분 → 배열 */
const splitComma = (val: any): string[] => {
    if (!val) return [];
    return String(val).split(",").map(s => s.trim()).filter(Boolean);
};

/** 배열 병합 (중복 제거) */
const mergeArrays = (existing: string[], incoming: string[]): string[] =>
    Array.from(new Set([...existing, ...incoming])).filter(Boolean);

/** 오늘 날짜 YYYY-MM-DD HH:mm */
const todayStr = (): string => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** 담당자 이름 → UID 매칭 (동명이인 제외) */
const resolveManagers = async (): Promise<{
    uniqueMap: Map<string, ResolvedManager>;
    duplicateNames: Set<string>;
}> => {
    const snap = await getDocs(collection(db, "users"));
    const nameCount = new Map<string, number>();
    const tempMap = new Map<string, ResolvedManager>();

    snap.docs.forEach(d => {
        const data = d.data();
        const name = data.name || "";
        nameCount.set(name, (nameCount.get(name) || 0) + 1);
        if (!tempMap.has(name)) {
            tempMap.set(name, { uid: d.id, name, role: data.role || "employee" });
        }
    });

    const duplicateNames = new Set<string>();
    const uniqueMap = new Map<string, ResolvedManager>();

    nameCount.forEach((count, name) => {
        if (count > 1) {
            duplicateNames.add(name);
        } else if (tempMap.has(name)) {
            uniqueMap.set(name, tempMap.get(name)!);
        }
    });

    return { uniqueMap, duplicateNames };
};

/** 담당자 해석: 미입력/동명이인/매칭실패 → 시스템 */
const resolveManager = (
    name: string,
    uniqueMap: Map<string, ResolvedManager>,
    duplicateNames: Set<string>
): ResolvedManager => {
    if (!name || duplicateNames.has(name) || !uniqueMap.has(name)) {
        return { uid: SYSTEM_UID, name: SYSTEM_NAME, role: "system" };
    }
    return uniqueMap.get(name)!;
};

/** 날짜 fallback: 빈칸 → 등록일 → 오늘 */
const resolveDate = (dateVal: any, registeredDate: string): string => {
    const d = String(dateVal || "").trim();
    if (d) return d;
    if (registeredDate) return registeredDate;
    return todayStr();
};

/** 셀 값 안전하게 문자열 추출 */
const cellStr = (row: any, key: string): string =>
    String(row[key] ?? "").trim();

/** 셀 값 숫자 추출 */
const cellNum = (row: any, key: string): number =>
    Number(row[key]) || 0;

// ─── Hook ────────────────────────────────────────────────────────────────────

export const useBulkImport = () => {
    const [progress, setProgress] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const queryClient = useQueryClient();

    /**
     * 실패 데이터 엑셀 다운로드
     */
    const downloadFailedTemplate = useCallback(async (failedRows: FailedRow[]) => {
        if (failedRows.length === 0) return;

        const XLSX = await import("xlsx");
        const wb = XLSX.utils.book_new();

        // 시트별로 그룹화
        const grouped = new Map<string, Record<string, any>[]>();
        failedRows.forEach(({ sheetName, row }) => {
            if (!grouped.has(sheetName)) grouped.set(sheetName, []);
            grouped.get(sheetName)!.push(row);
        });

        grouped.forEach((rows, sheetName) => {
            const ws = XLSX.utils.json_to_sheet(rows);
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
        });

        XLSX.writeFile(wb, "TEASY_CRM_실패_데이터.xlsx");
    }, []);

    /**
     * 메인 임포트 로직
     */
    const importCustomers = useCallback(async (file: File): Promise<BulkImportResult> => {
        setIsProcessing(true);
        setProgress(0);

        const result: BulkImportResult = {
            newCount: 0, mergedCount: 0, reportCount: 0, errorCount: 0,
            mergedList: [], errors: [], failedRows: []
        };

        try {
            const XLSX = await import("xlsx");
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: "array" });

            // ══════════════════════════════════════════════════════════════════
            // STEP 1: 담당자 목록 로드
            // ══════════════════════════════════════════════════════════════════
            const { uniqueMap: managerMap, duplicateNames } = await resolveManagers();
            setProgress(5);

            // ══════════════════════════════════════════════════════════════════
            // STEP 2: 고객 정보 시트 파싱
            // ══════════════════════════════════════════════════════════════════
            const customerSheet = workbook.Sheets[CUSTOMER_SHEET.name];
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

            // 파싱 + 유효성 검증
            const parsedCustomers: ParsedCustomer[] = [];
            for (let i = 0; i < customerRows.length; i++) {
                const row = customerRows[i];
                const seq = Number(row["순번*"]);
                const name = cellStr(row, "고객명*");
                const phone = cellStr(row, "연락처(대표)*");

                if (!seq || !name || !phone) {
                    result.errors.push(`고객 정보 행 ${i + 2}: 순번, 고객명, 연락처 누락`);
                    result.errorCount++;
                    result.failedRows.push({ sheetName: CUSTOMER_SHEET.name, row, reason: "필수 필드 누락" });
                    continue;
                }

                parsedCustomers.push({
                    seq, name, phone,
                    normalizedPhone: normalizePhone(phone),
                    raw: row,
                    memo: cellStr(row, "메모"),
                    registeredDate: cellStr(row, "등록일") || todayStr().split(" ")[0],
                });
            }

            setProgress(15);

            // ══════════════════════════════════════════════════════════════════
            // STEP 3: 템플릿 내 중복 통합 (동일 연락처 → 앞순번 우선)
            // ══════════════════════════════════════════════════════════════════
            const phoneToSeq = new Map<string, number>(); // normalizedPhone → 대표 seq
            const seqToCustomer = new Map<number, ParsedCustomer>(); // 대표 seq → customer
            const seqRedirect = new Map<number, number>(); // 후순위 seq → 대표 seq

            // 순번 오름차순 정렬
            parsedCustomers.sort((a, b) => a.seq - b.seq);

            for (const cust of parsedCustomers) {
                const existing = phoneToSeq.get(cust.normalizedPhone);
                if (existing !== undefined) {
                    // 동일 연락처 → 앞순번(기존)에 통합
                    seqRedirect.set(cust.seq, existing);
                    const primary = seqToCustomer.get(existing)!;
                    // 후순위 데이터의 보충 정보 병합
                    const pRaw = primary.raw;
                    const cRaw = cust.raw;
                    if (!pRaw["주소(대표)"] && cRaw["주소(대표)"]) pRaw["주소(대표)"] = cRaw["주소(대표)"];
                    if (cRaw["추가 연락처"]) {
                        pRaw["추가 연락처"] = [pRaw["추가 연락처"], cRaw["추가 연락처"]].filter(Boolean).join(",");
                    }
                    if (cRaw["추가 주소"]) {
                        pRaw["추가 주소"] = [pRaw["추가 주소"], cRaw["추가 주소"]].filter(Boolean).join(",");
                    }
                    if (cRaw["보유 상품"]) {
                        pRaw["보유 상품"] = [pRaw["보유 상품"], cRaw["보유 상품"]].filter(Boolean).join(",");
                    }
                    if (cRaw["비고"] && pRaw["비고"]) pRaw["비고"] = `${pRaw["비고"]}\n${cRaw["비고"]}`;
                    else if (cRaw["비고"]) pRaw["비고"] = cRaw["비고"];
                    // 메모는 별개 채팅 메시지이므로 각각 생성 (후순위 memo도 보존)
                    if (cust.memo) primary.memo = primary.memo ? `${primary.memo}\n---\n${cust.memo}` : cust.memo;
                } else {
                    phoneToSeq.set(cust.normalizedPhone, cust.seq);
                    seqToCustomer.set(cust.seq, cust);
                }
            }

            setProgress(20);

            // ══════════════════════════════════════════════════════════════════
            // STEP 4: Firestore 기존 고객 조회 (중복 체크용)
            // ══════════════════════════════════════════════════════════════════
            const existingSnap = await getDocs(collection(db, "customers"));
            const phoneIndex = new Map<string, { id: string; data: any }>();
            existingSnap.docs.forEach(d => {
                const cd = d.data();
                const norm = normalizePhone(cd.phone);
                if (norm) phoneIndex.set(norm, { id: d.id, data: cd });
                (cd.sub_phones || []).forEach((sp: string) => {
                    const n = normalizePhone(sp);
                    if (n) phoneIndex.set(n, { id: d.id, data: cd });
                });
            });

            setProgress(30);

            // ══════════════════════════════════════════════════════════════════
            // STEP 5: 고객 등록/병합 + 채팅 메시지 생성
            // ══════════════════════════════════════════════════════════════════
            const seqToDocId = new Map<number, string>();
            const seqToName = new Map<number, string>();
            const uniqueCustomers = Array.from(seqToCustomer.values());
            const memoMessages: { customerId: string; content: string }[] = [];

            for (let i = 0; i < uniqueCustomers.length; i++) {
                const cust = uniqueCustomers[i];
                const row = cust.raw;
                const existing = phoneIndex.get(cust.normalizedPhone);
                const distributor = cellStr(row, "관리 총판*") || "TEASY";
                const managerName = cellStr(row, "담당 직원");
                const manager = resolveManager(managerName, managerMap, duplicateNames);

                try {
                    if (existing) {
                        // ── 중복 → 병합 ──
                        const batch = writeBatch(db);
                        const updates: Record<string, any> = {};
                        const incomingSubPhones = splitComma(row["추가 연락처"]);
                        const incomingSubAddresses = splitComma(row["추가 주소"]);
                        const incomingProducts = splitComma(row["보유 상품"]);
                        const incomingAddress = cellStr(row, "주소(대표)");

                        if (incomingSubPhones.length > 0) {
                            updates.sub_phones = mergeArrays(existing.data.sub_phones || [], incomingSubPhones);
                        }
                        if (incomingAddress) {
                            if (!existing.data.address) {
                                updates.address = incomingAddress;
                            } else if (existing.data.address !== incomingAddress) {
                                updates.sub_addresses = mergeArrays(
                                    existing.data.sub_addresses || [],
                                    [incomingAddress, ...incomingSubAddresses]
                                );
                            }
                        }
                        if (incomingSubAddresses.length > 0 && !updates.sub_addresses) {
                            updates.sub_addresses = mergeArrays(existing.data.sub_addresses || [], incomingSubAddresses);
                        }
                        if (incomingProducts.length > 0) {
                            updates.ownedProducts = mergeArrays(existing.data.ownedProducts || [], incomingProducts);
                        }
                        if (!existing.data.distributor && distributor) updates.distributor = distributor;
                        if (row["라이선스"] && !existing.data.license) updates.license = cellStr(row, "라이선스");
                        if (row["비고"]) {
                            updates.notes = existing.data.notes
                                ? `${existing.data.notes}\n${cellStr(row, "비고")}`
                                : cellStr(row, "비고");
                        }
                        if (!existing.data.manager && manager.uid !== SYSTEM_UID) {
                            updates.manager = manager.name;
                            updates.managerId = manager.uid;
                        }

                        if (Object.keys(updates).length > 0) {
                            updates.updatedAt = serverTimestamp();
                            batch.update(doc(db, "customers", existing.id), updates);
                            await batch.commit();
                        }

                        seqToDocId.set(cust.seq, existing.id);
                        seqToName.set(cust.seq, existing.data.name);
                        result.mergedCount++;
                        result.mergedList.push({ name: existing.data.name, phone: cust.phone });

                        // 메모 → 채팅
                        if (cust.memo) memoMessages.push({ customerId: existing.id, content: cust.memo });

                    } else {
                        // ── 신규 등록 ──
                        const newRef = doc(collection(db, "customers"));
                        const newCustomer: Record<string, any> = {
                            no: cust.seq,
                            name: cust.name,
                            phone: cust.phone,
                            address: cellStr(row, "주소(대표)"),
                            sub_phones: splitComma(row["추가 연락처"]),
                            sub_addresses: splitComma(row["추가 주소"]),
                            ownedProducts: splitComma(row["보유 상품"]),
                            distributor,
                            manager: manager.name,
                            managerId: manager.uid,
                            license: cellStr(row, "라이선스"),
                            notes: cellStr(row, "비고"),
                            registeredDate: cust.registeredDate,
                            lastConsultDate: cust.registeredDate || null,
                            createdAt: serverTimestamp(),
                        };

                        const batch = writeBatch(db);
                        batch.set(newRef, newCustomer);
                        await batch.commit();

                        seqToDocId.set(cust.seq, newRef.id);
                        seqToName.set(cust.seq, cust.name);
                        phoneIndex.set(cust.normalizedPhone, { id: newRef.id, data: newCustomer });
                        result.newCount++;

                        // 메모 → 채팅
                        if (cust.memo) memoMessages.push({ customerId: newRef.id, content: cust.memo });
                    }
                } catch (err: any) {
                    result.errors.push(`고객 "${cust.name}" 처리 실패: ${err.message}`);
                    result.errorCount++;
                    result.failedRows.push({ sheetName: CUSTOMER_SHEET.name, row, reason: err.message });
                }

                // seqRedirect로 후순위 순번 → 같은 docId/name 매핑
                seqRedirect.forEach((primarySeq, redirectSeq) => {
                    if (primarySeq === cust.seq) {
                        const docId = seqToDocId.get(cust.seq);
                        const name = seqToName.get(cust.seq);
                        if (docId) seqToDocId.set(redirectSeq, docId);
                        if (name) seqToName.set(redirectSeq, name);
                    }
                });

                setProgress(30 + Math.round(((i + 1) / uniqueCustomers.length) * 25));
            }

            // 채팅 메시지 생성 (메모)
            for (const msg of memoMessages) {
                try {
                    await addDoc(collection(db, "customer_comments"), {
                        customerId: msg.customerId,
                        content: msg.content,
                        senderId: SYSTEM_UID,
                        senderName: SYSTEM_NAME,
                        createdAt: serverTimestamp(),
                    });
                } catch (err: any) {
                    result.errors.push(`채팅 메시지 생성 실패: ${err.message}`);
                }
            }

            setProgress(60);

            // ══════════════════════════════════════════════════════════════════
            // STEP 6: 보고서 시트 파싱 + 등록
            // ══════════════════════════════════════════════════════════════════

            // 기존 보고서 카운트 조회 (sequenceNumber용)
            const seqNumMap = new Map<string, number>(); // "customerId_type" → count

            const allReportRows: { sheetName: string; activityType: string; row: any; rowIdx: number }[] = [];

            for (const config of REPORT_SHEETS) {
                const sheet = workbook.Sheets[config.name];
                if (!sheet) continue;
                const rows: any[] = XLSX.utils.sheet_to_json(sheet);
                rows.forEach((row, idx) => {
                    allReportRows.push({
                        sheetName: config.name,
                        activityType: config.activityType,
                        row,
                        rowIdx: idx + 2
                    });
                });
            }

            // 기존 보고서 수 조회 (sequenceNumber 계산)
            for (const docId of new Set(seqToDocId.values())) {
                try {
                    const actSnap = await getDocs(collection(db, "customers", docId, "activities"));
                    actSnap.docs.forEach(d => {
                        const ad = d.data();
                        const key = `${docId}_${ad.type}`;
                        seqNumMap.set(key, (seqNumMap.get(key) || 0) + 1);
                    });
                } catch { /* ignore */ }
            }

            setProgress(65);

            // 배치 처리
            let batchCount = 0;
            let currentBatch = writeBatch(db);
            const latestDateMap = new Map<string, string>(); // customerId → latest date

            for (let i = 0; i < allReportRows.length; i++) {
                const { sheetName, activityType, row, rowIdx } = allReportRows[i];
                const seq = Number(row["순번*"]);
                const customerId = seqToDocId.get(seq);
                const customerName = seqToName.get(seq);

                if (!customerId || !customerName) {
                    result.errors.push(`${sheetName} 행 ${rowIdx}: 순번 '${seq}'에 해당하는 고객 없음`);
                    result.errorCount++;
                    result.failedRows.push({ sheetName, row, reason: "고객 매칭 실패" });
                    continue;
                }

                // 헤더 매핑 (시트별 칼럼명 기반)
                const typeInfo = SHEET_TYPE_MAP[sheetName];
                if (!typeInfo) {
                    result.errors.push(`${sheetName} 행 ${rowIdx}: 알 수 없는 시트`);
                    result.errorCount++;
                    continue;
                }

                // 등록일 가져오기
                const custData = seqToCustomer.get(seq) || seqToCustomer.get(seqRedirect.get(seq) || seq);
                const regDate = custData?.registeredDate || "";

                // 일시 칼럼 이름 찾기 (시트마다 다름: "접수 일시", "시연 일시", ...)
                const dateKey = Object.keys(row).find(k => k.includes("일시")) || "";
                const dateVal = resolveDate(row[dateKey], regDate);

                // 담당자/작성자
                const mgrName = cellStr(row, "담당자");
                const writerName = cellStr(row, "작성자");
                const mgr = resolveManager(mgrName, managerMap, duplicateNames);
                const writer = resolveManager(writerName, managerMap, duplicateNames);

                // sequenceNumber
                const seqKey = `${customerId}_${activityType}`;
                const currentSeqNum = (seqNumMap.get(seqKey) || 0) + 1;
                seqNumMap.set(seqKey, currentSeqNum);

                const activityRef = doc(collection(db, "customers", customerId, "activities"));
                const activity: Record<string, any> = {
                    customerId,
                    customerName,
                    type: typeInfo.type,
                    typeName: currentSeqNum > 1 ? `${typeInfo.typeName} (${currentSeqNum})` : typeInfo.typeName,
                    sequenceNumber: currentSeqNum,
                    date: dateVal,
                    manager: mgr.uid,
                    managerName: writer.name,
                    managerRole: mgr.role,
                    memo: cellStr(row, "참고 사항"),
                    createdAt: serverTimestamp(),
                };

                // 시트 타입별 추가 필드
                switch (activityType) {
                    case "inquiry":
                        activity.channel = cellStr(row, "유입 채널");
                        activity.nickname = cellStr(row, "닉네임");
                        activity.product = cellStr(row, "문의 상품");
                        activity.result = cellStr(row, "상담 결과");
                        break;
                    case "demo_schedule":
                        activity.product = cellStr(row, "시연 상품");
                        activity.location = cellStr(row, "방문 주소");
                        activity.phone = cellStr(row, "현장 연락처");
                        break;
                    case "demo_complete":
                        activity.product = cellStr(row, "시연 상품");
                        activity.location = cellStr(row, "방문 주소");
                        activity.phone = cellStr(row, "현장 연락처");
                        activity.result = cellStr(row, "시연 결과");
                        activity.discountType = cellStr(row, "할인 제안");
                        activity.discountValue = cellStr(row, "제안 금액");
                        break;
                    case "purchase_confirm":
                        activity.payMethod = cellStr(row, "결제 방식");
                        activity.amount = cellNum(row, "결제 금액");
                        activity.discount = cellStr(row, "할인 내역");
                        activity.discountAmount = cellNum(row, "할인 금액");
                        activity.product = cellStr(row, "구매 상품");
                        break;
                    case "install_schedule":
                        activity.product = cellStr(row, "시공 상품");
                        activity.location = cellStr(row, "방문 주소");
                        activity.phone = cellStr(row, "현장 연락처");
                        break;
                    case "install_complete":
                        activity.product = cellStr(row, "시공 상품");
                        activity.location = cellStr(row, "주소");
                        activity.phone = cellStr(row, "현장 연락처");
                        break;
                    case "as_schedule":
                        activity.asType = cellStr(row, "유형 선택");
                        activity.product = cellStr(row, "관련 상품");
                        activity.location = cellStr(row, "방문 주소");
                        activity.phone = cellStr(row, "현장 연락처");
                        break;
                    case "as_complete":
                        activity.asType = cellStr(row, "유형 선택");
                        activity.product = cellStr(row, "점검 상품");
                        activity.location = cellStr(row, "방문 주소");
                        activity.phone = cellStr(row, "현장 연락처");
                        activity.supportContent = cellStr(row, "지원 내용");
                        break;
                    case "remoteas_complete":
                        activity.asType = cellStr(row, "유형 선택");
                        activity.product = cellStr(row, "점검 상품");
                        activity.supportContent = cellStr(row, "지원 내용");
                        break;
                }

                currentBatch.set(activityRef, activity);
                batchCount++;
                result.reportCount++;

                // lastConsultDate 추적
                if (dateVal) {
                    const prev = latestDateMap.get(customerId);
                    if (!prev || dateVal > prev) latestDateMap.set(customerId, dateVal);
                }

                // 배치 커밋
                if (batchCount >= BATCH_LIMIT) {
                    await currentBatch.commit();
                    currentBatch = writeBatch(db);
                    batchCount = 0;
                }

                setProgress(65 + Math.round(((i + 1) / allReportRows.length) * 25));
            }

            // 잔여 배치 커밋
            if (batchCount > 0) await currentBatch.commit();

            setProgress(92);

            // ══════════════════════════════════════════════════════════════════
            // STEP 7: lastConsultDate 업데이트
            // ══════════════════════════════════════════════════════════════════
            const lcBatch = writeBatch(db);
            let lcCount = 0;

            for (const [customerId, latestDate] of latestDateMap.entries()) {
                lcBatch.update(doc(db, "customers", customerId), {
                    lastConsultDate: latestDate,
                });
                lcCount++;
                if (lcCount >= BATCH_LIMIT) {
                    await lcBatch.commit();
                    lcCount = 0;
                }
            }
            if (lcCount > 0) await lcBatch.commit();

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

    return { importCustomers, downloadFailedTemplate, progress, isProcessing };
};
