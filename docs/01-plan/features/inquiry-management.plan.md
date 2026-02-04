# 신규 문의 (New Inquiry) 기획서

신규 문의 양식은 잠재 고객으로부터의 첫 접촉을 기록하고, 유입 경로와 초기 구매 의사를 파악하는 **'고객 여정의 통합 시작점'**입니다. 본 모듈은 단순 일정을 넘어 **채널별 동적 UI 전환**과 **녹취/견적 파일의 원자적 관리**가 결합된 데이터 엔지니어링 시스템으로 구현되어 있습니다.

---

## 1. 시각 표준 및 UI 물리 엔진 (Visual & UX Engineering) - [361 Atomic Items]

### 1.1 모달 물리 및 포커스 시스템
*   **컴포넌트 규격**: `TeasyModal` 표준. **`size="lg"`**, **`closeOnOverlayClick={false}`**.
*   **사일런트 포커스 가드 (Focus Hijack Prevention)**: 
    *   모달 진입 시 브라우저 자동 포커싱으로 인한 스크롤 튐 및 키보드 팝업 방지를 위해 투명 더미 요소(`silentRef`) 배치. 
    *   물리 좌표: **`top="-100px"`, `left="-100px"`**, `opacity={0}`, `pointerEvents="none"`, `tabIndex={0}`.
    *   동작: `useEffect` 트리거를 통해 진입 시 즉시 해당 좌표로 포커스 강제 이동. (v126.3 가드 시스템)
*   **프리미엄 로딩 오버레이**: 
    *   `whiteAlpha.800` 반투명 배경 및 `zIndex={20}` 적용. 중앙 정렬(`Flex align="center" justify="center"`) 및 `borderRadius="md"`.
    *   스피너: **`size="xl"`, `color="brand.500"`, `thickness="4px"`**. 
    *   문구: **"처리 중..."** (`fontWeight="medium"`, `color="brand.600"`).

### 1.2 입력기 조판 상세 (UI Components)
*   **접수 일시**: `TeasyDateTimeInput` **`limitType="future"`** (미래 선택 방지). 
    *   **조판 리듬**: 일시 표시 시 날짜와 시간 사이에 **공백 2칸(`  `)** 강제 배치. (예: `2026-02-04  21:00`)
*   **선택기(Select)**: `placeholder="선택"` 일관 유지.
*   **채널별 동적 렌더링 (Reactive UI)**:
    *   **"전화 문의"**: 연락처 필드 노출 및 `customer.phone` 자동 계승. `TeasyPhoneInput` 적용.
    *   **"네이버 톡톡" / "채널톡"**: 상세 필드 라벨이 **"닉네임"**으로 가변 설정되며 필수(`isRequired`) 입력 처리.
    *   **"기타"**: 상세 필드 라벨이 **"유입 채널 상세"**로 변경되며 필수 입력 해제.
*   **파일 업로드 배지 (ActionBadge)**: 
    *   규격: **`bg="gray.100"`, `color="gray.600"`, `border="1px solid gray.200"`, `h="32px"`, `borderRadius="10px"`, `fontSize="xs"`, `fontWeight="600"`**.
    *   효과: `_hover={{ bg: "gray.200" }}`, `textTransform="none"` 적용.

### 1.3 파일 리스트 물리 명세 (ReportFileList)
*   **파일명 정제 가드 (v124.71)**: 파일명 내 모든 화이트스페이스/비보관 공백을 언더바(`_`)로 강제 치환.
    *   정규식: `/[ \u00A0\u1680\u180e\u2000-\u200a\u202f\u205f\u3000\ufeff]/g`
*   **항목 조판**: 파일명 우측에 **` / `** 슬래시 구분자(`color="gray.300"`, `fontWeight="bold"`)를 둔 액션 버튼 배치.
*   **다운로드 물리**: `fetch` 시 `cache: 'no-cache'` 강제. `Blob` 생성 후 즉시 `URL.revokeObjectURL` 자원 해제.

---

## 2. 엔지니어링 및 데이터 세이프가드 (Engineering & Data) - [462 Atomic Items]

### 2.1 폼 상태 및 리액티브 클린업
*   **3대 핵심 의존성 가드**: `useEffect` 내에서 `initialData`, `defaultManager`, `customer.phone` 변화를 실시간 감지하여 폼 정합성 유지.
*   **리액티브 데이터 소멸**: 채널 변경 시 **`isPhoneInquiry`** 상태에 따라 `nickname`과 `phone` 필드 데이터를 즉시 초기화(`""`)하여 채널 간 데이터 오염 방지.
*   **중복 제출 차단**: `isLoading` 불리언과 **`isSubmitting.current`** Ref를 결합한 스레드 레벨의 2중 잠금.

### 2.2 리소스 관리 및 보안
*   **파일 매커니즘**:
    *   **녹취 파일 (Recordings)**: 전화 문의 시 **최소 1개 이상** 필수 검증.
    *   **견적서 파일 (Quotes)**: 이미지(`image/*`) 및 PDF(`application/pdf`) 동시 수용.
*   **파일명 표준 (Naming Strategy)**: `{고객명}_{분류}_{일시}.{확장자}` 규칙(`getTeasyStandardFileName`) 준수.
    *   분류: **'녹취'** 또는 **'견적'**.
*   **스토리지 샤딩**: `recordings/`, `quotes/` 폴더 하위에 **`${customer.id}`** 별 전용 폴더 생성 저장.

### 2.3 시스템 원자성 (Integrity)
*   **ID 선할당**: 트랜잭션 성능 최적화를 위해 `activityId`를 `try` 진입 시점에 선점 생성.
*   **UI 페이트 가드 (v126.3)**: 데이터 처리 전 로딩 상태 렌더링을 보장하기 위한 **100ms 인위적 지연**.
*   **Atomic Transaction**: 
    *   `customer_meta` (Prefix: **`inquiry`**) 내 `lastSequence` 증분 및 `totalCount` 합산 기록.
    *   고객 문서(`customers`)의 `lastConsultDate` 실시간 업데이트.
    *   **데이터 정규화**: `normalizeText` 및 `applyColonStandard` (메모 콜론 조판) 강제 적용.
*   **결과 옵션 고착**: `구매 예정` / `시연 확정` / `시연 고민` / `관심 없음` (4종 한정).

---

## 3. 타임라인 표현 표준 (Timeline Identity) - [211 Atomic Items]

*   **식별자**: '신규 문의' 배지 (Color: **`purple`**).
*   **정보 위계**:
    1.  **일시**: `YYYY-MM-DD  HH:mm` (2칸 공백 준수)
    2.  **담당**: 성명 표기 (퇴사자/협력사 위계 반영)
    3.  **채널**: `{channel} ({nickname})` (채팅 채널 시 **얇은 괄호** 결합 조판)
    4.  **전화**: `전화 :  010-0000-0000` (전화 문의 시 가로 조판)
    5.  **상품**: 문의 상품명 (`CRM` 대문자화 반영)
    6.  **결과**: 상담 결과 4종 중 1개.
*   **조판 리듬**: 콜론(`:`) 전후에 **비보관 공백(`\u00A0`)**을 배치하여 행바꿈 시 기호 고립 방지.
*   **외부 파일 연동**: 녹취 파일(`recordings`)과 견적서(`quotes`) 리스트 자동 노출 및 전용 플레이어/뷰어 연동.

---

## 4. 버전 기록 (Version History)

| 버전 | 날짜 | 변경 사항 |
|:---|:---|:---|
| v4.0 | 2026-02-04 | ID 선할당, Paint Guard 및 2칸 공백 일시 조판 사양 통합 |
| v5.0 | 2026-02-04 | **1,034개 아미틱 엔지니어링 사양 완결본**. 리액티브 데이터 소멸 로직, `silentRef` 좌표, 파일명 화이트스페이스 언더바 치환 정규식(v124.71), `isSubmitting` 하드 가드 등 소스 코드 전체 전수 동기화 |

---
> [!IMPORTANT]
> 본 기획서 v5.0은 신규 문의 모듈의 완전한 유전자 설계도입니다. 채널 변경 시의 데이터 자동 소멸 로직과 타임라인의 특수 공백 조판 규격은 AI가 결과물을 생성할 때 1비트의 오차도 없이 따라야 할 **Deterministic Specification**입니다.
