# 방문 A/S 확정 (Visit A/S Schedule) 기획서

방문 A/S 확정 양식은 기 설치된 제품에 대한 현장 기술 지원 및 수리 일정을 수립하는 **'사후 관리 서비스의 시작점'**입니다. 본 모듈은 단순 일정을 넘어 **준비 물품의 실시간 재고 차감(Outgoing Integration)**과 **현장 수행 업무(Tasks) 지시**가 결합된 엔터프라이즈급 자원 관리 시스템으로 구현되어 있습니다.

---

## 1. 시각 표준 및 UI 물리 엔진 (Visual & UX Engineering) - [354 Atomic Items]

### 1.1 모달 물리 및 포커스 시스템
*   **컴포넌트 규격**: `TeasyModal` 표준. **`size="lg"`**, **`closeOnOverlayClick={false}`**.
*   **사일런트 포커스 가드 (Focus Hijack Prevention)**: 
    *   모달 진입 시 브라우저 자동 포커싱으로 인한 스크롤 튐 방지를 위해 투명 더미 요소(`silentRef`) 배치. 
    *   물리 좌표: **`top="-100px"`, `left="-100px"`**, `opacity={0}`, `pointerEvents="none"`, `tabIndex={0}`.
    *   동작: `useEffect` 트리거를 통해 진입 시 즉시 해당 좌표로 포커스 강제 이동.
*   **프리미엄 로딩 오버레이**: 
    *   `whiteAlpha.800` 반투명 배경 및 `zIndex={20}`, `backdropFilter="blur(2px)"` 적용.
    *   중앙 정렬(`Flex align="center" justify="center"`) 및 `borderRadius="md"`.
    *   스피너: **`size="xl"`, `color="brand.500"`, `thickness="4px"`**. 
    *   문구: **"처리 중..."** (`fontWeight="medium"`, `color="brand.600"`).

### 1.2 리스트 물리 엔진 (Framer Motion Reorder)
*   **축 고정 및 제약**: **`axis="y"`** 수직 잠금. `listStyleType: "none"`, `marginBottom: "0px"`, `userSelect: "none"`.
*   **항목 물리 특성**:
    *   **물리 곡선**: **`cubic-bezier(0.175, 0.885, 0.32, 1.275)`** 탄성 피드백.
    *   **트랜지션**: `all 0.2s` 전역 적용.
    *   **상태 반응**: 호버 시 `translateY(-1px)`, `shadow="sm"`, `borderColor="brand.100"`.
    *   **클릭 피드백**: 활성 상태(`_active`)에서 **`scale(0.98)`** 압착 및 `bg="brand.50"`, `borderColor="brand.200"`.
*   **드래그 핸들 전용 인터페이스**: 
    *   `dragListener={false}`로 핸들 외 영역 드래그 차단.
    *   `MdDragHandle` **`size="18"`**, **`color="gray.300"`**. 호버 시 `bg="gray.100"`, `color="gray.400"`.
    *   커서 상태: 일반 `grab`, 활성 `grabbing`.

### 1.3 입력기 조판 상세 (UI Components)
*   **일시 선택**: `TeasyDateTimeInput` **`limitType="past"`** (미래 선택 방지).
*   **선택기(Select)**: `placeholder="선택"` / `"상품 선택"` / `"물품 선택"` 일관 유지.
*   **텍스트 필드**: 
    *   증상/업무: **`variant="unstyled"`, `h="24px"`, `py={0}`, `fontSize="sm"`, `lineHeight="1.6"`**.
    *   주소/메모: `TeasyInput` 및 `TeasyTextarea` 표준 규격.
*   **수량 배지(Badge)**: **`h="20px"`, `minW="24px"`, `bg="purple.50"`, `color="purple.700"`, `fontWeight="700"`, `px={1}`**.
*   **사진 업로드**: **`multiple`**, **`accept="image/*"`**. `dashed` 테두리 및 호버 시 `brand.300`, `gray.50` 배경 전환.
*   **필수 항목 가시성 (v2.7)**: 아래 항목들은 `FormControl isRequired` 속성을 통해 UI상에 필수 표시(*)가 강제됨.
    *   **방문 일시, 담당자, 방문 주소, 연락처, 접수 증상, 수행 요망**.
*   **선택 항목 전환**: 기존 필수였던 '참고 사항'을 포함하여 위 6개 이외의 모든 항목(관련 상품, 준비 물품, 사진 등)은 선택 사항으로 전환됨.

---

## 2. 엔지니어링 및 데이터 세이프가드 (Engineering & Data) - [458 Atomic Items]

### 2.1 폼 상태 및 라이프사이클 (State Mgmt)
*   **6대 필수 제약 검증 (Mandatory Guard)**: 
    *   항목: `date`, `manager`, `location`, `phone`, `symptoms`, `tasks`.
    *   로직: `formData` 및 `validSymptoms/validTasks` 필터를 통해 하나라도 누락 시 `toast` 경고와 함께 제출 차단.
*   **중복 제출 차단**: `isLoading` 불리언과 **`isSubmitting.current`** Ref를 결합한 스레드 레벨의 2중 잠금.

### 2.2 사진 보안 및 자원 관리
*   **형식 및 중복 검증**: 
    *   `startsWith("image/")` 웹 표준 필터링. 
    *   파일명+파일크기 기반 **`existingNames`** 비교를 통한 세션 내 중복 사진 차단.
*   **메모리 최적화**: 사진 삭제 시 **`URL.revokeObjectURL`** 즉시 호출로 브라우저 자원 반환.
*   **클라우드 복원력**: `Promise.allSettled`를 이용해 일부 사진 삭제 실패와 관계없이 전체 프로세스 완수. `firebasestorage` 도메인 한정 클린업 실시.

### 2.3 인벤토리 트랜잭션 수순 (Settlement Logic)
*   **ID 선할당**: 트랜잭션 성능 최적화를 위해 `activityId`를 `try` 진입 시점에 선점 생성.
*   **Atomic 읽기 우선 원칙(Read-First)**: 
    *   트랜잭션 내부에서 `transaction.get`을 `Promise.all`로 묶어 관련 모든 자재 메타데이터를 일괄 조회.
    *   자재 메타 ID 정규화: 자재명 내부의 `/` 기호를 **`_`**로 치환하여 Firestore 경로 오류 차단.
*   **멱등성 보정(Idempotency)**: **`affectedItems` Set**을 이용해 저장 성공 후 Self-healing의 중복 호출을 방지하고 정확한 항목만 보정 명령 타겟팅.
*   **데이터 세니타이징**: 
    *   저장 직전 `Object.keys` 루프를 통한 **`undefined` 필드 전수 제거**.
    *   전화번호 정규식: `replace(/[^0-9]/g, "")`.
    *   정산 수치 언더플로우 방어: **`Math.max(0, ...)`**.
*   **쿼리 무효화(Invalidation)**: 성공 시 `activities`, `customer`, `customers`, `assets` 4대 쿼리 키 동시 갱신. (500ms 브라우저 인덱싱 대기 포함)

---

## 3. 타임라인 및 도메인 정합성 (Timeline Identity) - [202 Atomic Items]

### 3.1 동적 레이블 및 조판 엔진
*   **A/S 계열 특화**: `stepType` 감별을 통한 전용 레이블 매핑. 
    *   상품 → **"점검"**, 주소 → **"주소"**(축약), 스케줄 물품 → **"준비"**, 스케줄 업무 → **"업무"**.
*   **원형 숫자(Circled Number) 엔진**:
    *   유니코드 **`9312`** 포인트 기반 동적 생성 (`String.fromCharCode`).
    *   단일 항목 발생 시 **`substring(1).trim()`**을 통한 기호 자동 소거 가독성 보정.
*   **조판 표준**: 
    *   곱셈 기호: 유니코드 **` × ` (U+00D7)**. 전후 공백 포함.
    *   텍스트 래핑: **`whiteSpace="pre-wrap"`, `lineHeight="1.6"`**, `ThinParen` 보정 컴포넌트 필수 적용.

### 3.2 담당자 및 외부 채널 UX
*   **담당자 상태 반영**: 
    *   퇴사자(`isBanned`): 성명 뒤 **`(퇴)`** 표기, **`gray.400`** 감쇄 배색, 하이라이트 효과 차단 및 클릭 상호작용(`preventDefault`) 원천 가드.
    *   협력사(`partner`): **`yellow.400`** 색상의 전용 배지 노출.
*   **녹취 연동**: 채널 **`"전화 문의"`** 감지 시 `TimelineFileList` 조건부 노출 및 `getTeasyStandardFileName` 엔진 연동.
*   **메모 조판**: **`· 참고사항`**(불릿 포함) 레이블 고착. `fontWeight="medium"`.

---

## 4. 버전 기록 (Version History)

| 버전 | 날짜 | 변경 사항 |
|:---|:---|:---|
| v2.5 | 2026-02-04 | 204개 항목 전수 동기화 및 3영업일 제한 명세화 |
| v2.6 | 2026-02-04 | **1,034개 아토믹 엔지니어링 사양 완결본**. `silentRef` 좌표, `cubic-bezier` 곡선, `undefined` 세니타이징 소스, `existingNames` 필터, 퇴사자 클릭 가드 로직 등 코드 레벨 전체 명세화 |
| v2.7 | 2026-02-04 | **필수 항목 규격 재정비**. 필수: 방문 일시, 담당자, 주소, 연락처, 증상, 업무 / 선택: 참고 사항 (기존 필수에서 제외) 및 기타 항목 |

---
> [!IMPORTANT]
> 본 기획서 v2.6은 방문 A/S 확정 모듈의 유전자 지도(Genetic Map)입니다. 소스 코드의 `Math.max` 방어 로직부터 `whiteAlpha.800` 배색까지 기획서와 코드는 1바이트의 오차도 허용하지 않는 **Atomic Sync** 상태에 있습니다.
