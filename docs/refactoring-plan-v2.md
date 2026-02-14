# TEASY-CRM 리팩토링 계획서 v2

> 기준일: 2026-02-14 | 기반: 전체 코드 품질 분석 (3차 독립 검증 완료)

---

## 현황 요약

| 지표 | 수치 |
|---|---|
| 총 파일 | 142개 |
| 총 코드 | 26,070줄 |
| `: any` | **297줄** (312매치) |
| `as any` | **110줄** |
| `console.error` | 58건 |
| `console.warn` | 11건 |
| `console.log` | 0건 ✅ |
| 500줄+ 파일 | 14개 |
| 테스트 커버리지 | utils만 (8파일, 71테스트) |

---

## Phase 5: 공통 컴포넌트 `any` 제거

> **목표:** UI 공통 컴포넌트의 `any` → Props Interface 정의
> **위험도:** ⬇ 낮음 (타입만 변경, 시각 변화 없음)
> **예상 소요:** 15분

| 파일 | 현재 `any` 수 | 조치 |
|---|---|---|
| `FormElements.tsx` | `: any` 9개 | Props interface 정의 (`TeasyPhoneInputProps`, `TeasyDateTimeInputProps` 등) |
| `BaseAtoms.tsx` | `: any` 4개 | Props interface 정의 (`TeasyBadgeProps`, `SurnameBadgeProps` 등) |
| `Sidebar.tsx` | `: any` 1개 | `NavItemProps` interface 정의 |

**검증:** `npm run build` + `npx vitest run`

---

## Phase 6: Hooks `any` 제거 (Tier 1 — 소규모)

> **목표:** 단순 hooks의 `any` 제거
> **위험도:** ⬇ 낮음
> **예상 소요:** 20분

| 파일 | 현재 `any` 수 | 조치 |
|---|---|---|
| `useWorkOrder.ts` | `: any` 4개 | `attachments: WorkRequestAttachment[]`, `additionalData: Partial<WorkRequest>`, `updateData: Partial<WorkRequest>` |
| `useReportMetadata.ts` | `: any` 4개 | `backupMap: Record<string, string[]>`, `h: HolidayEntry` interface 정의 |
| `useTimelineIntegration.ts` | `: any` 2개 | `inventorySnaps: DocumentSnapshot[]`, `item: InventoryItem` |
| `useDistributorMaster.ts` | `: any` 1개 | `createdAt: Timestamp \| Date \| string` |
| `useAsTypeMaster.ts` | `: any` 1개 | `createdAt: Timestamp \| Date \| string` |
| `formatter.ts` | `: any` 1개 | `ts: Timestamp \| Date \| string` |
| `dateUtils.ts` | `: any` 2개 | `holidayMap: Record<string, string[]>` |
| `reportPureUtils.ts` | `: any` 3개 | `FileItem` interface + `Timestamp \| Date \| string` |
| `assetUtils.ts` | `: any` 3개 | `createdAt: Timestamp \| Date \| string`, `getAssetTimestamp` 파라미터, `updates: Partial<AssetData>` |

**검증:** `npm run build` + `npx vitest run`

---

## Phase 7: `catch (e: any)` → `unknown` 표준화

> **목표:** 모든 `catch (e: any)` → `catch (e: unknown)` + 타입 가드 패턴 적용
> **위험도:** ⬇ 낮음
> **예상 소요:** 15분

**대상 파일:** `admin/settings/page.tsx` (14개 중 대부분이 `catch (e: any)`), `useBulkImport.ts` (3건)

```typescript
// Before
catch (e: any) { toast({ title: e.message || "실패" }) }

// After
catch (e: unknown) {
  const msg = e instanceof Error ? e.message : "알 수 없는 오류";
  toast({ title: msg || "실패" });
}
```

**검증:** `npm run build` + `npx vitest run`

---

## Phase 8: `useBulkImport.ts` 리팩토링

> **목표:** 660줄 파일의 `any` 12개 제거 + 구조 분리
> **위험도:** 🟡 중간 (Excel import 로직이 복잡)
> **예상 소요:** 30분

| 조치 | 상세 |
|---|---|
| 타입 정의 | `ExcelRow`, `CustomerImportRow`, `ReportImportRow` interface 생성 |
| 헬퍼 함수 타입 | `normalizePhone(val: string \| number)`, `cellStr(row: ExcelRow, key: string)` 등 |
| `XLSX.utils.sheet_to_json` | 제네릭 `sheet_to_json<ExcelRow>()` 사용 |
| `phoneIndex` | `Map<string, { id: string; data: CustomerData }>` |

**검증:** `npm run build` + `npx vitest run` + 실제 Excel import 테스트 권장

---

## Phase 9: 보고서 Form Hooks `any` 제거

> **목표:** 9개 보고서 hook의 `any` 제거 (가장 큰 작업)
> **위험도:** 🟡 중간 (Firestore 트랜잭션 로직 포함)
> **예상 소요:** 40분

### 9-A. `metaTracker` 공통 타입 추출 (8개 파일에서 동일 패턴)

```typescript
// 신규: src/types/inventory.ts
interface MetaTracker {
  ref: DocumentReference;
  data: AssetMetaData;
  deltaStock: number;
  deltaOutflow: number;
}
```

**적용 파일:** useAsCompleteForm, useAsScheduleForm, useInstallCompleteForm, useInstallScheduleForm, usePurchaseForm (각 2건 × 5파일 = 10건 해소)

### 9-B. 개별 Form Hook 정리

| 파일 | 총 `any` | 주요 패턴 |
|---|---|---|
| `useRemoteAsCompleteForm.ts` | 22개 | `(initialData as any)`, `type: ... as any`, `(dataToSave as any)` |
| `useInstallCompleteForm.ts` | 17개 | metaTracker + `createdAt as any` |
| `useAsCompleteForm.ts` | 16개 | metaTracker + `createdAt as any` |
| `useDemoCompleteForm.ts` | 15개 | `createdAt as any`, 트랜잭션 데이터 |
| `useInquiryForm.ts` | 14개 | `channel as any`, `result as any`, Zod 연동 |
| `useAsScheduleForm.ts` | 14개 | metaTracker + `createdAt as any` |
| `useInstallScheduleForm.ts` | 12개 | metaTracker + `createdAt as any` |
| `useDemoScheduleForm.ts` | 9개 | `createdAt as any`, 트랜잭션 데이터 |
| `usePurchaseForm.ts` | 11개 | metaTracker + `createdAt as any` |

### 9-C. 공통 `createdAt as any` 해결

`createdAt as any` 패턴이 반복됨 → `BaseDoc`의 `createdAt` 타입이 이미 `Timestamp | Date | string`이므로, `toDate()` 호출 시 타입 가드 유틸 함수를 만들어 일괄 교체:

```typescript
// src/utils/timestampUtils.ts
export const toDateSafe = (ts: Timestamp | Date | string | undefined): Date => {
  if (!ts) return new Date();
  if (typeof ts === 'object' && 'toDate' in ts) return ts.toDate();
  if (ts instanceof Date) return ts;
  return new Date(ts);
};
```

**검증:** 각 Form별 생성/수정/삭제 기능 수동 테스트 권장

---

## Phase 10: UI 컴포넌트 `as any` 정리

> **목표:** 보고서 UI 컴포넌트 + 모달의 `as any` 제거
> **위험도:** ⬇ 낮음
> **예상 소요:** 20분

| 파일 | `as any` 수 | 주요 패턴 |
|---|---|---|
| `ReportDetailModal.tsx` | 5개 | `{...commonProps as any}` → `CommonFormProps` interface |
| `WorkRequestModal.tsx` | 7개 | `stepType: activity.type as any` → ActivityType 확장 |
| `CreateWorkRequestModal.tsx` | 4개 | 동일 패턴 |
| `RemoteAsComplete/index.tsx` | 7개 | `options={managerOptions as any}` → 제네릭 |
| `DemoComplete/index.tsx` | 4개 | 동일 패턴 |
| `MainDashboard.tsx` | 4개 | 타입 캐스팅 정리 |

**검증:** `npm run build` + 화면 UI 확인

---

## Phase 11 (선택): `console.error` 중앙화

> **목표:** 58개 `console.error` → 중앙 에러 로깅 유틸로 교체
> **위험도:** ⬇ 낮음
> **예상 소요:** 15분

```typescript
// src/utils/logger.ts
export const logError = (context: string, error: unknown) => {
  const msg = error instanceof Error ? error.message : String(error);
  console.error(`[${context}] ${msg}`, error);
  // 향후 Sentry/외부 로깅 서비스 연동 지점
};
```

---

## 실행 순서 및 우선순위

| 순서 | Phase | 해소 `any` 수 | 위험도 | 소요 |
|---|---|---|---|---|
| 1️⃣ | **Phase 5** (공통 컴포넌트) | ~14개 | ⬇ | 15분 |
| 2️⃣ | **Phase 6** (소규모 Hooks) | ~21개 | ⬇ | 20분 |
| 3️⃣ | **Phase 7** (catch `any`) | ~17개 | ⬇ | 15분 |
| 4️⃣ | **Phase 8** (useBulkImport) | ~12개 | 🟡 | 30분 |
| 5️⃣ | **Phase 9** (Form Hooks) | ~130개 | 🟡 | 40분 |
| 6️⃣ | **Phase 10** (UI `as any`) | ~31개 | ⬇ | 20분 |
| 7️⃣ | **Phase 11** (console 중앙화) | 0 | ⬇ | 15분 |
| | **합계** | **~225개** | | **~2시간 35분** |

> ⚠️ 나머지 ~182개(407-225)는 보고서 Form UI + 기타 분산 코드에 있으며, Phase 9-10 실행 시 추가 해소됩니다.

---

## 검증 프로토콜 (모든 Phase 공통)

1. `npx vitest run` — 71 테스트 통과 확인
2. `npx next build` — 전체 빌드 성공 확인
3. `git add . && git commit -m "Refactor Phase N: {summary}"`
4. 정합성 체크: 수정 파일과 연관 파일을 `view_file`로 직접 검사
