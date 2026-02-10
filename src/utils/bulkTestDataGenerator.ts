// src/utils/bulkTestDataGenerator.ts
"use client";

/**
 * ⚠️ 임시 테스트 전용 — 배포 전 삭제 필요
 * 일괄 등록 테스트용 더미 데이터 엑셀 생성기 (1,000건)
 */

import { CUSTOMER_SHEET, REPORT_SHEETS } from "./bulkTemplateGenerator";

// ─── 더미 데이터 풀 ──────────────────────────────────────────────────────

const LAST_NAMES = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임", "한", "오", "서", "신", "권", "황", "안", "송", "류", "홍"];
const FIRST_NAMES = ["민준", "서윤", "예준", "서연", "도윤", "하윤", "시우", "지유", "주원", "하은", "지호", "수아", "지한", "지아", "건우", "다은", "우진", "채원", "선우", "소율", "현우", "지민", "준서", "유나", "태윤", "은서", "시현", "민서", "도현", "하린"];
const CITIES = ["서울시 강남구", "서울시 서초구", "서울시 송파구", "서울시 마포구", "서울시 용산구", "부산시 해운대구", "부산시 남구", "인천시 남동구", "대구시 수성구", "대전시 유성구", "광주시 서구", "경기도 성남시", "경기도 수원시", "경기도 용인시", "경기도 고양시", "경기도 안양시", "경기도 화성시", "경기도 파주시", "충남 천안시", "전북 전주시"];
const DETAILS = ["역삼동 123-4", "반포대로 45", "잠실동 78-9", "상암로 12", "이태원로 33", "센텀중앙로 55", "대연동 88", "구월동 22", "범어동 11", "봉명동 99", "치평동 44", "분당구 정자동 33", "영통구 매탄동 55", "수지구 죽전동 77", "일산서구 탄현동 22", "동안구 비산동 11", "동탄면 반송동 66", "금촌동 33", "불당동 88", "완산구 효자동 44"];
const PRODUCTS = ["TEASY Pro", "TEASY Lite", "TEASY Premium", "TEASY Basic", "TEASY Enterprise", "TEASY Studio", "TEASY Home", "TEASY Office", "TEASY School", "TEASY Medical"];
const DISTRIBUTORS = ["TEASY", "대한총판", "서울대리점", "부산지사", "경기본부", "인천센터"];
const MANAGERS = ["홍길동", "김영희", "이철수", "박지민", "최수현", "정태윤", "강민호", "조은서", "윤서진", "장하나"];
const CHANNELS = ["전화 문의", "채널톡", "네이버 톡톡", "홈페이지", "소개/추천", "직접 방문"];
const RESULTS = ["상담완료", "보류", "재연락", "계약진행"];
const DEMO_RESULTS = ["긍정적", "보류", "재시연 요청", "계약진행", "거절"];
const PAY_METHODS = ["카드", "현금", "계좌이체", "할부", "리스"];
const AS_TYPES = ["정기점검", "고장수리", "부품교체", "업그레이드", "기타"];
const DISCOUNT_TYPES = ["없음", "현금 할인", "수량 할인", "프로모션", "VIP 할인"];
const MEMOS = [
    "기존 거래처, 관계 유지 필요",
    "신규 문의 고객, 후속 연락 예정",
    "시연 후 긍정적 반응, 견적 요청함",
    "AS 이력 있음, 사후관리 중요",
    "대량 구매 의향 있음, VIP 관리",
    "", "", "", "", "" // 50% 확률로 빈 메모
];

// ─── 유틸리티 ─────────────────────────────────────────────────────────────

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const pickN = <T>(arr: T[], n: number): T[] => {
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n);
};
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pad = (n: number) => String(n).padStart(2, "0");

const randomPhone = () => `010-${pad(rand(10, 99))}${pad(rand(10, 99))}-${pad(rand(10, 99))}${pad(rand(10, 99))}`;

const randomDate = (yearStart: number, yearEnd: number) => {
    const y = rand(yearStart, yearEnd);
    const m = rand(1, 12);
    const d = rand(1, 28);
    const h = rand(8, 18);
    const min = pick([0, 15, 30, 45]);
    return `${y}-${pad(m)}-${pad(d)}  ${pad(h)}:${pad(min)}`;
};

const randomDateOnly = (yearStart: number, yearEnd: number) => {
    const y = rand(yearStart, yearEnd);
    const m = rand(1, 12);
    const d = rand(1, 28);
    return `${y}-${pad(m)}-${pad(d)}`;
};

const randomProducts = (): string => {
    const count = rand(1, 3);
    return pickN(PRODUCTS, count).map(p => {
        const qty = rand(1, 5);
        return qty > 1 ? `${p}(${qty})` : p;
    }).join(", ");
};

// ─── 생성기 ──────────────────────────────────────────────────────────────

export const generateBulkTestData = async () => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const TOTAL = 1000;

    // 중복 테스트용: 순번 5,10,15,...는 이전 순번과 동일 연락처
    const phones: string[] = [];
    for (let i = 0; i < TOTAL; i++) {
        if (i > 0 && i % 5 === 4) {
            phones.push(phones[i - 1]); // 5번째마다 중복
        } else {
            phones.push(randomPhone());
        }
    }

    // ── Sheet 1: 고객 정보 ──
    const custRows: any[][] = [CUSTOMER_SHEET.headers];
    for (let i = 0; i < TOTAL; i++) {
        const seq = i + 1;
        const name = pick(LAST_NAMES) + pick(FIRST_NAMES);
        const phone = phones[i];
        const subPhone = rand(0, 3) === 0 ? randomPhone() : "";
        const addr = `${pick(CITIES)} ${pick(DETAILS)}`;
        const subAddr = rand(0, 4) === 0 ? `${pick(CITIES)} ${pick(DETAILS)}` : "";
        const products = randomProducts();
        const dist = pick(DISTRIBUTORS);
        const mgr = rand(0, 3) === 0 ? "" : pick(MANAGERS); // 25% 빈 담당자
        const license = rand(0, 2) === 0 ? `LIC-${String(rand(1000, 9999))}` : "";
        const notes = rand(0, 3) === 0 ? `고객 참고사항 #${seq}` : "";
        const memo = pick(MEMOS);
        const regDate = rand(0, 10) === 0 ? "" : randomDateOnly(2023, 2025); // 10% 빈 등록일

        custRows.push([seq, name, phone, subPhone, addr, subAddr, products, dist, mgr, license, notes, memo, regDate]);
    }
    const custWs = XLSX.utils.aoa_to_sheet(custRows);
    custWs["!cols"] = CUSTOMER_SHEET.widths.map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, custWs, CUSTOMER_SHEET.name);

    // ── Sheet 2~10: 보고서 시트 ──
    // 각 고객에게 확률적으로 보고서 할당
    const sheetDataMap = new Map<string, any[][]>();
    REPORT_SHEETS.forEach(config => {
        sheetDataMap.set(config.name, [config.headers]);
    });

    for (let seq = 1; seq <= TOTAL; seq++) {
        const custName = custRows[seq][1];
        const custPhone = custRows[seq][2];

        // 신규 문의 (60% 확률)
        if (rand(1, 10) <= 6) {
            const dateVal = rand(0, 8) === 0 ? "" : randomDate(2023, 2025);
            sheetDataMap.get("신규 문의")!.push([
                seq, custName, custPhone,
                dateVal, pick(MANAGERS), pick(MANAGERS),
                pick(CHANNELS), rand(0, 1) ? `닉네임${rand(100, 999)}` : "",
                pick(PRODUCTS), pick(RESULTS), rand(0, 2) === 0 ? `참고 #${seq}` : ""
            ]);
        }

        // 시연 확정 (30%)
        if (rand(1, 10) <= 3) {
            sheetDataMap.get("시연 확정")!.push([
                seq, custName, custPhone,
                randomDate(2023, 2025), pick(MANAGERS), pick(MANAGERS),
                pick(PRODUCTS), `${pick(CITIES)} ${pick(DETAILS)}`, randomPhone(),
                rand(0, 2) === 0 ? `시연 참고 #${seq}` : ""
            ]);
        }

        // 시연 완료 (20%)
        if (rand(1, 10) <= 2) {
            sheetDataMap.get("시연 완료")!.push([
                seq, custName, custPhone,
                randomDate(2024, 2025), pick(MANAGERS), pick(MANAGERS),
                pick(PRODUCTS), `${pick(CITIES)} ${pick(DETAILS)}`, randomPhone(),
                pick(DEMO_RESULTS), pick(DISCOUNT_TYPES), rand(0, 1) ? rand(50000, 500000) : "",
                rand(0, 2) === 0 ? `시연완료 메모 #${seq}` : ""
            ]);
        }

        // 구매 확정 (15%)
        if (rand(1, 10) <= 1 || (rand(1, 20) <= 1)) {
            sheetDataMap.get("구매 확정")!.push([
                seq, custName, custPhone,
                randomDate(2024, 2025), pick(MANAGERS), pick(MANAGERS),
                pick(PAY_METHODS), rand(100000, 5000000), pick(DISCOUNT_TYPES),
                rand(0, 300000), randomProducts(),
                rand(0, 2) === 0 ? `구매 메모 #${seq}` : ""
            ]);
        }

        // 시공 확정 (15%)
        if (rand(1, 10) <= 1 || (rand(1, 20) <= 1)) {
            sheetDataMap.get("시공 확정")!.push([
                seq, custName, custPhone,
                randomDate(2024, 2025), pick(MANAGERS), pick(MANAGERS),
                pick(PRODUCTS), `${pick(CITIES)} ${pick(DETAILS)}`, randomPhone(),
                ""
            ]);
        }

        // 시공 완료 (10%)
        if (rand(1, 10) <= 1) {
            sheetDataMap.get("시공 완료")!.push([
                seq, custName, custPhone,
                randomDate(2024, 2025), pick(MANAGERS), pick(MANAGERS),
                pick(PRODUCTS), `${pick(CITIES)} ${pick(DETAILS)}`, randomPhone(),
                ""
            ]);
        }

        // 방문 AS 확정 (10%)
        if (rand(1, 10) <= 1) {
            sheetDataMap.get("방문 AS 확정")!.push([
                seq, custName, custPhone,
                randomDate(2024, 2025), pick(MANAGERS), pick(MANAGERS),
                pick(AS_TYPES), pick(PRODUCTS), `${pick(CITIES)} ${pick(DETAILS)}`,
                randomPhone(), ""
            ]);
        }

        // 방문 AS 완료 (8%)
        if (rand(1, 12) <= 1) {
            sheetDataMap.get("방문 AS 완료")!.push([
                seq, custName, custPhone,
                randomDate(2024, 2025), pick(MANAGERS), pick(MANAGERS),
                pick(AS_TYPES), pick(PRODUCTS), `${pick(CITIES)} ${pick(DETAILS)}`,
                randomPhone(), `점검 완료 — ${pick(AS_TYPES)}`, ""
            ]);
        }

        // 원격 AS 완료 (8%)
        if (rand(1, 12) <= 1) {
            sheetDataMap.get("원격 AS 완료")!.push([
                seq, custName, custPhone,
                randomDate(2024, 2025), pick(MANAGERS), pick(MANAGERS),
                pick(AS_TYPES), pick(PRODUCTS), `원격 지원 내용 #${seq}`,
                ""
            ]);
        }
    }

    // 시트 추가
    REPORT_SHEETS.forEach(config => {
        const rows = sheetDataMap.get(config.name)!;
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws["!cols"] = config.widths.map(w => ({ wch: w }));
        XLSX.utils.book_append_sheet(wb, ws, config.name);
    });

    XLSX.writeFile(wb, "TEASY_CRM_테스트_데이터_1000건.xlsx");
};
