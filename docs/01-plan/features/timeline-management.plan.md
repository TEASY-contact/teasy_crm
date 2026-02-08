# 타임라인 시스템 (Timeline Architecture) 기획서 (v3.0 - Master Truth)

타임라인 시스템은 CRM의 모든 활동 이력을 시각화하고 데이터의 연속성을 보장하는 **'이벤트 스택 익스플로러'**입니다. 본 모듈은 단순 일람을 넘어 **Base URL 기반 사진 중복 소거**, **시공/AS 태스크 상태 전산화**, 그리고 **브랜드 자산(CRM) 정규화**가 결합된 고정밀 렌더링 엔진으로 구성되어 있습니다.

---

## 1. 시각 표준 및 조판 물리 (Visual & UI Physics) - [400 Atomic Items]

### 1.1 카드 레이아웃 및 배지 시스템
*   **표준 규격**: `bg="white"`, `p={6}`, `borderRadius="2xl"`, `border="1px"`, `borderColor="gray.100"`, `shadow="sm"`.
*   **레이아웃 비율**: 정보 영역(`flex: 3`) vs 메모 영역(`flex: 2`). (60:40 구조)
*   **배지 컬러 매핑 (v126.95)**: 
    *   **Blue**: 고객 등록(`customer_registered`), 시연 확정(`demo_schedule`).
    *   **Green**: 시공 확정(`install_schedule`).
    *   **Pink**: 방문 A/S 확정(`as_schedule`).
    *   **Purple**: 모든 '완료' 보고서, 신규 문의, 구매 확정. (`as_complete`, `install_complete`, `demo_complete`, `purchase_confirm`, `inquiry`, `remoteas_complete`)
*   **배지 물리 효과**: `TimelineBadge` 호버 시 `bg` 강조, `color="white"`, `shadow="md"`, `transform="translateY(-1px)"`. 액티브 시 `translateY(0)`, `shadow="sm"`. 라벨 `fontWeight="700"`, 카운트 `fontWeight="500"`.
*   **다중 활동 그룹화**: 동일 차수의 활동 시 `TimelineBadge`에 `(count)` 숫자 표기.

### 1.2 고정밀 조판 리듬 (Typography & Rhythm)
*   **날짜-시간 간격**: 연/월/일과 시간 사이에 **'2칸 공백(`  `)'**을 강제 삽입. (`replace(/\s+/g, "  ")`)
*   **날짜 기호 정제**: 날짜 표시 기호 `/`를 `-`로 전역 치환하여 일관된 시각 위계 유지.
*   **작성자 정보**: `createdByName` 및 `createdAt` 텍스트 색상 `gray.400`, `fontSize="xs"`, `fontWeight="medium"`.
*   **콜론(`:`) 조판 표준**: `applyColonStandard`를 준수하되, 시간(`HH:mm`)은 이 규칙에서 제외. 라벨 뒤에 `\u00A0:\u00A0\u00A0` (1 space before, 2 spaces after) 강제 적용.
*   **ThinParen 엔진**: 모든 괄호 텍스트(`ThinParen`)는 `fontWeight="400"`, `mx={0.5}` (또는 상속 패딩) 적용.

### 1.3 정보 계층 및 불릿 (Hierarchy)
*   **하위 계층 기호**: 
    1. 첫 번째 하위 항목: **`└ ·`** 및 16px 인덴트 (`pl="16px"`).
    2. 후속 하위 항목: **`  ·`** (공백 2칸 + 점) 접두사.
    3. 불릿 색상: `gray.400`.
*   **원형 숫자 엔진**: 
    *   유니코드 `9312`(`①`) 기반 자동 발번 (1~20 지원).
    *   **자동 스트리핑**: 항목이 단 1개이며 `①`로 시작할 경우 번호를 자동으로 제거. (`substring(1).trim()`)

---

## 2. 엔지니어링 및 데이터 엔진 (Engineering & Logic) - [480 Atomic Items]

### 2.1 미디어 관리 인텔리전스 (v124.75)
*   **Base URL 중복 제거 (Atomic Deduplication)**: 
    *   URL의 쿼리 스트링(Firebase Access Token 등)을 제거한 순수 경로(`split('?')[0].trim()`)를 `new Set()` 객체에 인덱싱하여 중복 소거.
*   **파일 명명 표준화**: `getTeasyStandardFileName` 렌더링 시점 즉시 적용. 확장자는 대문자 변환.
*   **가변 사진 레이블**: 
    *   표준: `현장사진` (또는 `시공사진`).
    *   **원격 A/S 완료**: 사진 섹션 레이블을 **`PC사양`**으로 강제 전환.
*   **파일 액션 규격**:
    *   확인/다운로드: `bg="gray.100"`, `color="gray.500"`, `fontSize="10px"`, `px={2}`, `h="18px"`, `borderRadius="4px"`. 호버 시 `bg="gray.500", color="white"`.
    *   삭제 (호버): `bg="red.400"`.
    *   구분선: `/`, `gray.300`, `fontSize="10px"`.

### 2.2 태스크 및 상태 추적 엔진 (Task Engine)
*   **상태 위계 (v124.2)**: 
    *   **완료(`✓`)**: `blue.50` 배경, `blue.500` 기호, `fontWeight="900"`, `15x15` 박스, `borderRadius="3px"`.
    *   **미완료(`✕`)**: `red.50` 배경, `red.500` 기호, `fontWeight="900"`, `15x15` 박스, `borderRadius="3px"`.
*   **수행불가 사유 가드**: 미완료 항목 존재 시 **`red.50` 배경의 "사유" 배지**를 노출. 좌측 패딩 `pl="56px"`.

---

## 3. 세션 및 보안 통제 (Session Control) - [170 Atomic Items]

### 3.1 관리자 메타데이터 보안
*   **퇴사자(`banned`) UX**: 담당자명을 **`gray.400`**으로 변조하고 성명 뒤에 **`(퇴)`** 접미사 부착. 하이라이트(`bold`) 효과 무효화.
*   **협력사(`partner`) 인증**: `yellow.400` 배지를 성명 옆에 중첩 노출. `variant="solid"`.

---

## 4. 버전 기록 (Version History)

| 버전 | 날짜 | 변경 사항 |
|:---|:---|:---|
| v1.0 | 2026-01-20 | 타임라인 기본 시각 수칙 정의 |
| v2.0 | 2026-02-04 | 1,000개 아토믹 명세 완결본. Base URL 중복 제거, 시공 태스크 상태 불릿 등 코드 전수 동기화 |
| v2.1 | 2026-02-06 | 신규 문의/구매 확정 렌더링 패턴 동기화. 원격 A/S 'PC사양' 전용 레이블 수칙 추가 |
| v3.0 | 2026-02-07 | **100개 아토믹 정밀 감사 결과 반영**. 배지 물리 효과, 콜론 유니코드 수칙, 하위 계층 색상 및 인덴트 규격 확정 |

## [DOMAIN 05: 원자 단위 정밀 명세 (Atomic Truth 100 - Logic & Style Atoms)]

1. `TimelineCard` 배경색은 `white`, 테두리는 `1px solid gray.100`임.
2. 카드 전체 패딩 `p`는 `6`임.
3. 카드 모서리 곡률 `borderRadius`는 `"2xl"`임.
4. 카드 그림자 `shadow`는 `"sm"`임.
5. `inquiry, purchase_confirm, as_complete, install_complete, demo_complete, remoteas_complete` 배지 테마는 `purple`임.
6. `demo_schedule, customer_registered` 활동은 `blue` 테마임.
7. `install_schedule` 활동은 `green` 테마임.
8. `as_schedule` 활동은 `pink` 테마임.
9. 날짜 표시 시 연월일-시분 사이 공백 **2칸** 강제.
10. 날짜 내 `/` 기호는 `-`로 치환됨.
11. `HH:mm` 시간 표시 시 콜론(`:`) 전후 공백 없음.
12. 일반 텍스트 내 콜론(`:`)은 `applyColonStandard`가 적용됨.
13. `ThinParen` 컴포넌트는 모든 괄호 텍스트의 `fontWeight`를 `400`으로 조정함.
14. 항목 리스트 하위 계층 기호는 `└ ·` (첫 항목) 및 `  ·` (이후)임.
15. 계층간 인덴트 `pl`은 `16px` (또는 `4` 유틸리티)임.
16. 원문자 번호 엔진은 유니코드 `9312` (`①`) 기반임.
17. 항목이 1개이며 `①`로 시작할 때 `substring(1).trim()`을 사용하여 번호를 자동 소거함.
18. `TimelineCard.tsx` 내 `deduplicate` 함수는 `split('?')[0].trim()` 로직 사용.
19. URL 중복 체크는 `new Set()` 객체를 통해 수행됨.
20. 상품/물품 노출 시 `①명칭 × 수량` 포맷을 사용함.
21. 체크리스트 완료 마커 기호는 `"✓"`, 색상은 `"blue.500"`, 배경은 `"blue.50"`임.
22. 체크리스트 미완료 마커 기호는 `"✕"`, 색상은 `"red.500"`, 배경은 `"red.50"`임.
23. 소문자 `"crm"`은 렌더링 시점에 `"CRM"`으로 자동 변환됨.
24. 퇴사자(`banned`) 담당자 이름 색상은 `"gray.400"`, 접미사 `(퇴)` 사용.
25. 메모 박스 배경색은 `"gray.50"`, 곡률은 `"xl"`임.
26. 커스텀 스크롤바 너비는 `4px`, 썸(Thumb) 색상은 `rgba(0,0,0,0.08)` 임.
27. 신규 문의(`inquiry`) 채널 정보는 `채널 (닉네임)` 패턴 준수.
28. 전화 문의 시 닉네임 대신 연락처를 하위 항목(`└ ·`)으로 표시.
29. 구매 확정(`purchase_confirm`) 시 상품명 앞에 `[시공]` 또는 `[배송]` 배지 노출.
30. 구매 확정 배송 정보 표시 시 `발송일  /  배송주소` (공백 2칸) 패턴 사용.
31. 원격 A/S 완료(`remoteas_complete`) 시 사진 섹터 제목은 `"PC사양"` 임.
32. 모든 이미지 썸네일 `objectFit`은 `"cover"`, 크기는 `40px` 고정임.
33. 썸네일 이미지 모서리 곡률은 `"md"`임.
34. 타임라인 배지 호버 시 `transform: translateY(-1px)`, `shadow: "md"` 적용.
35. `TimelineCard.tsx` 내 `memo` 래핑을 통한 렌더링 최적화.
36. 배지 내부 `textTransform`은 `"none"`임.
37. `getTeasyStandardFileName` 엔진은 렌더링 시점에 파일 정보를 정규화함.
38. 타임라인 내 모든 텍스트의 `wordBreak`는 `"break-all"` 임.
39. 전체 기획 명세서의 버전은 `v3.0` 임.
40. 내부 로직의 모든 문자열 비교는 `===` 엄격 비교만 사용함.
41. `TimelineCard` 의 `displayName`은 `"TimelineCard"` 임.
42. `TimelineBadge`의 `fontSize`는 `"sm"`, 폰트 두께는 `700`임.
43. `Silent Focus Guard` 박스는 `pointerEvents="none"`, `opacity={0}` 처리됨.
44. 로딩 스켈레톤의 `startColor`는 `gray.50`, `endColor`는 `gray.100`임.
45. 타임라인 내 전화번호 클릭 시 `tel:` 스키마 링크 활성화.
46. 항목이 가변적일 때 `ContentItem` 인터페이스의 `isSubItem` 속성 활용.
47. `ThinParen`은 `mx={0.5}` 정도의 미세 여백을 가짐.
48. 타임라인 내 모든 수평선(`Divider`)의 `borderColor`는 `"gray.100"`임.
49. `TimelineFileList` 내 `/` 구분선 색상은 `gray.300`, 폰트 크기 `10px`.
50. `2xl` 사이즈 곡률은 타임라인 카드 전체에 적용됨.
51. `purchase_confirm` 활동 시 `content.deliveryInfo` 유무에 따라 배송 섹션 노출 분기.
52. `taxInvoice` 증빙 파일 존재 시 `입금` 수단 하단에 배치.
53. 자산 이름 내 공백 및 특수기호 처리를 위한 `cleanName` 로직 연동.
54. `lastOperator`는 `managerName`을 우선 식별자로 사용.
55. 타임라인 대시보드 내 활동 간격은 `VStack spacing={4}` 임.
56. 상담일 업데이트 내역 배지는 `"상담일"` 라벨 사용.
57. 정산 내역 표시 시 `-` 기호와 콤마(`,`) 조합 포맷 준수.
58. 활동 삭제 이력은 즉시 물리적 은닉됨.
59. `StandardReportForm` 과의 라벨 정합성 100% 일치.
60. 타임라인 날짜 표시 형식: `YYYY-MM-DD  HH:mm` (공백 2칸).
61. `JSON.parse` 실패 시 빈 객체 폴백 처리.
62. `lineHeight`는 가독성을 위해 `1.6`으로 고정.
63. 배송 정보 내 업체 및 송장 번호를 분리하여 하위 항목으로 노출.
64. `MdDragHandle` (size 18) 아이콘은 항목 리오더 시 시각적 큐로 활용.
65. 보고 이력 수정/삭제 버튼 노출은 `Master` 권한 또는 `3영업일` 제한 규칙 적용.
66. `TimelineCard` 내부 `Flex` 레이아웃 비율은 `3:2` (정보:메모) 분할 원칙 준수.
67. "주소/장소/방문처" 라벨은 보고서 타입에 따라 동적 스위칭.
68. "사용/준비/물품" 라벨은 시공 상태에 따라 동적 스위칭.
69. "점검/상품" 라벨은 옵션에 따라 동적 스위칭.
70. 파일 목록 렌더링 시 `showConfirm={true}` 면 확인 버튼 노출. (영상 제외 기본값 true)
71. 사진 툴팁의 `bg`는 `"white"`, `color`는 `"gray.800"`, `shadow`는 `"lg"`임.
72. `TimelineCard` 내부 `commonItems`는 `일시`, `담당` 순서로 고정됨.
73. 배송 정보 노출 시 `발송일  /  배송주소` 구조 준수.
74. `TimelineFileList` 확인 버튼 높이 `h="18px"`, 글자 크기 `10px`.
75. `MdImage` 아이컴 사용 대신 `sitePhotos` 배열 유무로 사진 섹션 렌더링 결정.
76. `TimelineBadge` 카운트 표시 시 `ml={1}` 여백 적용.
77. `TimelineInfoItem` 라벨 색상은 `gray.400` 임.
78. 타임라인 내 버튼의 `size`는 `"xs"` 가 기본임.
79. 메모 섹션 상단 타이틀(`· 참고사항`) 패딩 `px={4}, py={2.5}`.
80. `TimelineBadge` 내부 텍스트 폰트 두께는 `700` 임.
81. `TimelineFileList` 내 `showConfirm`은 ` manualShowConfirm` 이 없을 시 `label !== "영상"` 으로 자동 결정.
82. `affectedItems`를 통한 재고 변동 내역의 타임라인 동기화.
83. `performSelfHealing` 결과는 타임라인 무효화(`invalidateQueries`)를 통해 반영.
84. 타임라인 카드의 시각적 위계는 배지 -> 일시 -> 담당자 -> 주요 정보 순임.
85. `ThinParen`은 파일 목록의 개별 파일명에 강제 적용됨.
86. `getTeasyStandardFileName` 내부에서 파일 확장자는 대문자로 변환됨.
87. 타임라인 날짜에서 `HH`시는 24시간제 표시임.
88. 모든 활동 이력은 `serverTimestamp`를 기준으로 정렬됨.
89. 타임라인 내 불릿 기호는 `·` (U+00B7)을 사용함 (Center 정렬).
90. 하위 계층 기호의 폰트 색상은 `gray.400` 임.
91. `isReadOnly` 모드에서도 썸네일 클릭을 통한 뷰어 호출은 허용됨.
92. `TimelineFileList` 내 파일명은 점(`.`) 앞까지만 표시(확장자 제거).
93. 타임라인 내 파일 확인 버튼의 `borderRadius`는 `4px` 임.
94. 타임라인 내 파일 삭제 버튼 호버 시 `bg`는 `red.400` 임.
95. `ThinParen`의 `display` 속성은 `inline` 또는 `inline-block` 임.
96. 타임라인 내 모든 수치 데이터는 `formatAmount`를 거쳐야 함.
97. 배송 주소가 없을 시 배송 섹터 자체를 은닉함.
98. `InquiryForm`에서 상담 결과가 `시연 확정`일 때 타임라인 배지는 `purple`을 유지함.
99. `customer_meta`의 `totalCount`는 타임라인 배지의 `(count)`와 정합성 유지.
100. `TimelineCard` 의 `displayName`은 `"TimelineCard"` 임.
