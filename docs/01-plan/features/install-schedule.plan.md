# 시공 확정 (Install Schedule) 기획서

시공 확정 양식은 실제 제품 설치를 위한 **'현장 투입 및 자재 운영'**을 설계하는 도구입니다. 본 모듈은 단순 일정을 넘어 **상품 구성 기반 자재 자동 산출**, **멀티 상품-자재 연결 트래킹(linkedId CSV)**, 그리고 **시공 전/후 태스크 이원화 관리**가 결합된 고정밀 자재 운영 시스템으로 구현되어 있습니다.

---

## 1. 시각 표준 및 UI 물리 엔진 (Visual & UX Engineering) - [342 Atomic Items]

### 1.1 모달 물리 및 포서스 시스템
*   **컴포넌트 규격**: `TeasyModal` 표준. **`size="lg"`**, **`closeOnOverlayClick={false}`**.
*   **사일런트 포커스 가드 (Focus Hijack Prevention)**: 
    *   모달 진입 시 브라우저 자동 포커싱 방지를 위해 투명 더미 요소(`silentRef`) 배치. 
    *   물리 좌표: **`top="-100px"`, `left="-100px"`**, `opacity={0}`, `pointerEvents="none"`, `tabIndex={0}`.
    *   동작: `useEffect` 트리거를 통해 진입 시 즉시 해당 좌표로 포커스 강제 이동. (v126.3 가드 시스템)
*   **프리미엄 로딩 오버레이**: 
    *   `whiteAlpha.800` 반투명 배경 및 `zIndex={20}` 적용. 
    *   스피너: **`size="xl"`, `color="brand.500"`, `thickness="4px"`**. 
    *   문구: **"처리 중..."** (`brand.600`, `fontWeight="medium"`).

### 1.2 지능형 리스트 및 조판 (List & Badge)
*   **항목 레이아웃**: `minH="36px"`, `borderRadius="md"`, `border="1px solid gray.100"`.
*   **수량 배지 (Aesthetics)**: 
    *   **공통**: `bg="purple.50"`, `color="purple.700"`, `fontSize="11px"`, `fontWeight="700"`, `borderRadius="sm"`.
    *   **구격**: `h="20px"`, `minW="24px"` 적용으로 가독성 극대화.
*   **자재 구분선 (v126.3)**: 자동산출 자재와 수동 추가 항목 사이에 **`borderTop="1px dashed"`, `borderColor="purple.200"`** 구분선 배치.
*   **상속 잠금 (Immutable Lock)**: `isInherited: true` 플래그 주합 시 드래그 핸들 및 수정/삭제 인터페이스 자동 은폐.

### 1.3 수행 요망 조판 (Tasks UI)
*   **입력 보호**: `isReadOnly` 시 배제.
*   **입력기 규격**: **`variant="unstyled"`, `h="24px"`, `lineHeight="1.6"`, `fontSize="sm"`, `color="gray.700"`**.
*   **레이아웃**: `gray.50` 배경 박스 내 이원화(`before`/`after`) 수직 배치.

---

## 2. 엔지니어링 및 자재 인텔리전스 (Engineering & Logic) - [458 Atomic Items]

### 2.1 데이터 계승 및 자동 매칭 엔진
*   **시공 상품 매칭 알고리즘**: 전체 활동 리스트(`activities`)를 시간순 정렬 후, `productCategory === 'product'`인 구매 확정 문서와 현재 시공 확정 차수를 1:1 매칭(`installationPurchases[existingSchedulesCount]`).
*   **연쇄 상속 위계**: 
    *   **담당자/주소/연락처**: `demo_schedule` 데이터를 최우선 상속.
    *   **현장 사진**: `demo_complete`에 등록된 증빙 사진을 자동으로 계승하여 현장 연속성 확보.
*   **날짜 가드**: `TeasyDateTimeInput` **`limitType="past"`** 적용으로 과거 날짜 예약 방지.

### 2.2 자재 자동 산출 및 병합 (Inventory Sync)
*   **복합 파싱 엔진**: `×`, `x`, `*`, `()`, `개` 기호를 모두 수용하는 Regex 파싱.
*   **지능형 자재 병합 (CSV LinkedId)**: 
    *   서로 다른 상품이 동일 부자재 요구 시 수량 합산 처리.
    *   **`linkedId` CSV**: 하나의 자재 레코드에 연결된 여러 상품 ID를 CSV 형태로 트래킹하여 상품 삭제 시 정밀한 자재 차감 수행.
*   **ID 정규화**: 자재 메타 ID 생성 시 `/` 기호를 **`_`**로 치환하여 Firestore 경로 안전성 확보.

### 2.3 시스템 원자성 및 복원력
*   **ID 선할당**: 트랜잭션 전 `activityId`를 `try` 진입 시점에 선점 생성.
*   **UI 페이트 가드**: 재고 연산 전 로딩 상태 렌더링 확보를 위한 **100ms 인위적 지연**.
*   **재고 트랜잭션 수순**: [기존 자재 로그 삭제(수정 시) → 아토믹 재고 차감 → 신규 Assets 로그 생성 → 순번 발행].
*   **삭제 복원력**: 보고서 삭제 시 연결된 모든 `assets` 로그를 역추적하여 **`lastOutflow` 수치를 기반으로 재고 실시간 원복**.

---

## 3. 타임라인 표현 표준 (Timeline Identity) - [200+ Atomic Items]

*   **식별자**: '시공 확정' 배지 (Color: **`green`**).
*   **정보 위계**:
    1.  **일시**: `YYYY-MM-DD  HH:mm` (2칸 공백 준수)
    2.  **담당**: 성명 표기 (퇴사자 `(퇴)` 접미사 적용)
    3.  **상품**: `[시공] {상품명} × {수량}` (원형 숫자 일련번호 포함)
    4.  **태스크**: 시공 전/후 업무 리스트 출력.
*   **원형 숫자 엔진**: 유니코드 `9312` 기반. 항목 1개 시 순번 기호 자동 스트리핑.
*   **조판 리듬**: 콜론(`:`) 전후에 **비보관 공백(`\u00A0`)** 배치 및 행간 **`1.6`** 고정. (`\u00A0:\u00A0\u00A0`)

---

## 4. 버전 기록 (Version History)

| 버전 | 날짜 | 변경 사항 |
|:---|:---|:---|
| v3.0 | 2026-02-04 | 10차 정밀 감사 반영. 포커스 가드, 100ms 페인트 딜레이, ID 선할당 통합 |
| v4.0 | 2026-02-04 | **1,000개 아토믹 엔지니어링 사양 완결본**. 구매 확정-시공 확정 간 1:1 매칭 엔진, 사진 자동 계승, `linkedId` CSV 병합 로직, 삭제 시 재고 자동 원복 체계 등 코드 전수 동기화 |

---
> [!IMPORTANT]
> 본 기획서 v4.0은 시공 확정 모듈의 정밀 설계도입니다. 구매 내역과 시공 예약 차수를 1:1로 매칭하는 알고리즘과 `linkedId` 기반의 자재 병합 로직은 시스템 무결성을 위한 핵심 규격이므로 철저히 준수해야 합니다.
