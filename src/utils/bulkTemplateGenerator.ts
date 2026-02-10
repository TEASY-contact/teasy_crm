// src/utils/bulkTemplateGenerator.ts
"use client";

/**
 * 일괄 등록 표준 엑셀 템플릿 생성 (10개 시트)
 *
 * - 시트명/칼럼명은 CRM 보고서 UI 항목명과 동일
 * - Sheet 2~10의 순번/고객명/연락처는 VLOOKUP으로 Sheet1 자동 참조
 * - 일시 빈칸 → 등록일 → 오늘 날짜 (useBulkImport에서 처리)
 * - 담당자/작성자 빈칸 또는 연동 실패 → "시스템" (useBulkImport에서 처리)
 * - 메모(Sheet1) → 채팅 메시지 생성 (useBulkImport에서 처리)
 */

/** Sheet1 고객 정보 */
export const CUSTOMER_SHEET = {
    name: "고객 정보",
    headers: [
        "순번*", "고객명*", "연락처(대표)*", "추가 연락처", "주소(대표)",
        "추가 주소", "보유 상품", "관리 총판*", "담당 직원",
        "라이선스", "비고", "메모", "등록일"
    ],
    widths: [8, 14, 16, 20, 30, 30, 24, 12, 12, 16, 20, 24, 14],
};

/** Sheet 2~10: 보고서 시트 */
export const REPORT_SHEETS = [
    {
        name: "신규 문의",
        activityType: "inquiry",
        headers: [
            "순번*", "고객명", "연락처",
            "접수 일시", "담당자", "작성자",
            "유입 채널", "닉네임", "문의 상품",
            "상담 결과", "참고 사항"
        ],
        widths: [8, 14, 16, 18, 12, 12, 14, 14, 20, 14, 24],
    },
    {
        name: "시연 확정",
        activityType: "demo_schedule",
        headers: [
            "순번*", "고객명", "연락처",
            "시연 일시", "담당자", "작성자",
            "시연 상품", "방문 주소", "현장 연락처",
            "참고 사항"
        ],
        widths: [8, 14, 16, 18, 12, 12, 20, 24, 16, 24],
    },
    {
        name: "시연 완료",
        activityType: "demo_complete",
        headers: [
            "순번*", "고객명", "연락처",
            "완료 일시", "담당자", "작성자",
            "시연 상품", "방문 주소", "현장 연락처",
            "시연 결과", "할인 제안", "제안 금액",
            "참고 사항"
        ],
        widths: [8, 14, 16, 18, 12, 12, 20, 24, 16, 14, 14, 12, 24],
    },
    {
        name: "구매 확정",
        activityType: "purchase_confirm",
        headers: [
            "순번*", "고객명", "연락처",
            "구매 일시", "담당자", "작성자",
            "결제 방식", "결제 금액", "할인 내역",
            "할인 금액", "구매 상품", "참고 사항"
        ],
        widths: [8, 14, 16, 18, 12, 12, 12, 12, 12, 12, 24, 24],
    },
    {
        name: "시공 확정",
        activityType: "install_schedule",
        headers: [
            "순번*", "고객명", "연락처",
            "시공 일시", "담당자", "작성자",
            "시공 상품", "방문 주소", "현장 연락처",
            "참고 사항"
        ],
        widths: [8, 14, 16, 18, 12, 12, 20, 24, 16, 24],
    },
    {
        name: "시공 완료",
        activityType: "install_complete",
        headers: [
            "순번*", "고객명", "연락처",
            "완료 일시", "담당자", "작성자",
            "시공 상품", "주소", "현장 연락처",
            "참고 사항"
        ],
        widths: [8, 14, 16, 18, 12, 12, 20, 24, 16, 24],
    },
    {
        name: "방문 AS 확정",
        activityType: "as_schedule",
        headers: [
            "순번*", "고객명", "연락처",
            "방문 일시", "담당자", "작성자",
            "유형 선택", "관련 상품", "방문 주소",
            "현장 연락처", "참고 사항"
        ],
        widths: [8, 14, 16, 18, 12, 12, 14, 20, 24, 16, 24],
    },
    {
        name: "방문 AS 완료",
        activityType: "as_complete",
        headers: [
            "순번*", "고객명", "연락처",
            "완료 일시", "담당자", "작성자",
            "유형 선택", "점검 상품", "방문 주소",
            "현장 연락처", "지원 내용", "참고 사항"
        ],
        widths: [8, 14, 16, 18, 12, 12, 14, 20, 24, 16, 24, 24],
    },
    {
        name: "원격 AS 완료",
        activityType: "remoteas_complete",
        headers: [
            "순번*", "고객명", "연락처",
            "지원 일시", "담당자", "작성자",
            "유형 선택", "점검 상품", "지원 내용",
            "참고 사항"
        ],
        widths: [8, 14, 16, 18, 12, 12, 14, 20, 24, 24],
    },
];

/**
 * Sheet 2~10에 VLOOKUP 수식 삽입
 * A열(순번)을 기준으로 Sheet1의 고객명(B)/연락처(C)를 자동 참조
 */
function addAutoRefFormulas(ws: any, XLSX: any, maxRows: number) {
    for (let row = 2; row <= maxRows; row++) {
        // B열: 고객명
        const cellB = XLSX.utils.encode_cell({ r: row - 1, c: 1 });
        ws[cellB] = {
            t: "s",
            f: `IFERROR(VLOOKUP(A${row},'고객 정보'!$A:$B,2,FALSE),"")`,
        };
        // C열: 연락처
        const cellC = XLSX.utils.encode_cell({ r: row - 1, c: 2 });
        ws[cellC] = {
            t: "s",
            f: `IFERROR(VLOOKUP(A${row},'고객 정보'!$A:$C,3,FALSE),"")`,
        };
    }
}

export const generateBulkTemplate = async () => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const FORMULA_ROWS = 5001; // 최대 5,000건

    // Sheet 1: 고객 정보
    const wsCustomer = XLSX.utils.aoa_to_sheet([CUSTOMER_SHEET.headers]);
    wsCustomer["!cols"] = CUSTOMER_SHEET.widths.map(w => ({ wch: w }));
    wsCustomer["!rows"] = [{ hpt: 24 }];
    XLSX.utils.book_append_sheet(wb, wsCustomer, CUSTOMER_SHEET.name);

    // Sheet 2~10: 보고서 시트
    REPORT_SHEETS.forEach(config => {
        const ws = XLSX.utils.aoa_to_sheet([config.headers]);
        ws["!cols"] = config.widths.map(w => ({ wch: w }));
        ws["!rows"] = [{ hpt: 24 }];

        // 순번/고객명/연락처 자동 참조 수식
        addAutoRefFormulas(ws, XLSX, FORMULA_ROWS);

        // 수식 범위 포함
        const lastCol = XLSX.utils.encode_col(config.headers.length - 1);
        ws["!ref"] = `A1:${lastCol}${FORMULA_ROWS}`;

        XLSX.utils.book_append_sheet(wb, ws, config.name);
    });

    XLSX.writeFile(wb, "TEASY_CRM_일괄등록_양식.xlsx");
};
