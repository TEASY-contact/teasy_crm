# 범용 업무 (Standard Report) 무결점 준수 엔지니어링 명세서 (v9.0 - Final Truth)

본 문서는 리팩토링 시 **비기능적/기능적 변화를 감지하고 원래의 상태로 복원하기 위한 절대적 기준점(Baseline)**입니다. 1번부터 800번까지의 모든 명세는 실제 코드의 바이너리 수준 정합성을 가지며, 리팩토링 후 이 문서와 대조하여 단 하나의 Props나 라벨이라도 다를 경우 즉각 수정되어야 합니다.

---

## [DOMAIN 01: UI 물리 엔진 및 스타일링 명세 (Atomic UI / Physics)]

1. **모달 규격**: `StandardReportForm`은 상위 모달의 규격을 따르며, 내부 레이아웃은 `VStack align="stretch" spacing={6}`.
2. **포커스 가드(Silent Guard)**: `Box`로 구현, `ref={silentRef}`, `tabIndex={0}`, `position="absolute"`, `top="-100px"`, `left="-100px"`, `opacity={0}`.
3. **로딩 커버 오버레이**: `isLoading` 시 `Flex` 노출, `bg="white" py={10}`, 중앙 `Spinner` 및 `"처리 중..."` 텍스트.
4. **날짜 및 시간**: `TeasyDateTimeInput` 사용.
    - `reportType`에 'schedule' 포함 시 `limitType="past"`.
    - 'complete' 포함 시 `limitType="future"`.
5. **담당자 선택**: `CustomSelect` 사용, `placeholder="담당자 선택"`.
6. **조건부 필드 노출 (isVisitType)**:
    - `hasLocation`: (schedule 타입? "장소" : "방문처") 라벨. `TeasyInput` 사용.
    - `hasPhone`: "현장 연락처" 라벨. `TeasyPhoneInput` 사용.
    - `hasProduct`: "품목" 라벨. `TeasyInput` 사용.
7. **보고 내용**: `TeasyTextarea` 사용, `minH="150px"`, `placeholder="업무 상세 내용을 입력하세요."`.
8. **텍스트 렌더링**: `formatPhone` 및 `applyColonStandard` 적용.

---

## [DOMAIN 02: 비즈니스 로직 및 런타임 명세 (Logic / Engine)]

101. **동적 필드 엔진 (Physics Engine)**: 
    - `reportType` 문자열에 `schedule`, `complete`, `install`, `as` 키워드가 포함될 경우 방문형 업무로 간주하여 장소/연락처/품목 필드를 동적으로 활성화.
    - 단, `remoteas_complete` (원격 A/S)의 경우 방문처/연락처 필드 강제 비활성화.
102. **상태 초기화 (Inheritance)**: 
    - 마지막 `as_schedule` 활동이 존재할 경우 담당자, 장소, 연락처, 품목 정보를 자동 상속.
    - 상속 데이터 부재 시 `customer` 기본 정보 상속.
103. **날짜 기본값**: 현재 시각 기반 `YYYY-MM-DD  HH:mm` (공백 2칸) 포맷 생성.
104. **시퀀스 동기화 (Pairing Logic)**:
    - `as_complete` 또는 `demo_complete` 저장 시, 직전 `as_schedule` 또는 `demo_schedule`의 시퀀스 번호를 자동 상속하여 타임라인 상의 묶음(Pairing) 처리.
105. **원자적 트랜잭션**: 활동 기록(`activities`), 고객 메타(`customer_meta`), 고객 상담일(`customers.lastConsultDate`) 정보를 하나의 트랜잭션으로 처리.
106. **메타 락킹**: `customer_meta/${customer.id}_${reportType}` 문서를 통해 각 업무 타입별 독립 시퀀스 및 개수 관리.
107. **데이터 정제**:
    - 연락처: 숫자 외 문자 제거 후 저장.
    - 텍스트: 장소, 품목에 `normalizeText` 적용.
    - 메모: `:` 전후 공백 규격화를 위해 `applyColonStandard` 적용.
108. **쿼리 동기화**: 저장/삭제 성공 후 500ms 지연 후 `activities`, `customer`, `customers` 쿼리 캐시 일괄 무효화.

---

## [DOMAIN 03: 타임라인 렌더링 엔진 명세 (Timeline Specification)]

141. **배지 속성**: 시스템에서 전달받은 `reportType` 및 `reportLabel`에 따라 동적 생성.
142. **정보 노출 순서**: 일시 -> 담당 -> (장소) -> (연락처) -> (품목) -> 보고 내용.
143. **날짜 포맷**: 연월일-시분 사이 공백 2칸 강제.

---

## [DOMAIN 05: 원자 단위 정밀 명세 (Atomic Truth 100 - Logic & Style Atoms)]

본 섹션은 코드의 바이너리 수준 정합성을 수호하기 위한 100가지 미세 사양입니다.

1. `StandardReportForm`의 담당자 선택 플레이스홀더는 `"담당자 선택"`임.
2. `TeasyDateTimeInput`은 `reportType`에 'schedule' 포함 시 `limitType="past"`를 가짐.
3. `TeasyDateTimeInput`은 `reportType`에 'complete' 포함 시 `limitType="future"`를 가짐.
4. 방문 주소(장소) 입력란 플레이스홀더는 업무 유형에 따라 가변적이나 기본 `"입력"`임.
5. 현장 연락처 입력란 플레이스홀더는 `"000-0000-0000"`임.
6. 품목 입력란 플레이스홀더는 `"입력"`임.
7. 보고 내용 `TeasyTextarea`의 최소 높이 `minH`는 `"150px"`임.
8. 보고 내용 플레이스홀더는 `"업무 상세 내용을 입력하세요."`임.
9. `VStack` 전체 컨테이너의 `spacing`은 `6`임.
10. `isLoading` 커버 배경색은 `"white"`, 패딩 `py`는 `10`임.
11. `Silent Focus Guard` 위치는 `top="-100px"`, `left="-100px"`임.
12. `Silent Focus Guard` 박스는 `pointerEvents="none"`, `opacity={0}`임.
13. `Silent Focus Guard`의 `tabIndex`는 `0`임.
14. 폼 로딩 시 `setTimeout 0` 포커스 보정 로직 포함.
15. `TeasyPhoneInput`은 읽기 전용 시 `formatPhone` 유틸리티를 적용함.
16. `reportType` 내 `remoteas_complete` 포함 시 `hasLocation`과 `hasPhone`은 강제 `false`임.
17. 방문형 업무 판정 키워드: `schedule, complete, install, as`.
18. 상속 데이터 조회 시 마지막 `as_schedule` 활동을 `find` 또는 `findLast`로 검색.
19. 날짜 기본 포맷: `YYYY-MM-DD  HH:mm` (공백 2칸).
20. `as_complete` 저장 시 직전 `as_schedule`의 `sequenceNumber`를 1:1 매칭함.
21. `demo_complete` 저장 시 직전 `demo_schedule`의 `sequenceNumber`를 1:1 매칭함.
22. `customer_meta` 문서 ID 규칙: `${customer.id}_${reportType}`.
23. 트랜잭션 내 `customerRef` 업데이트 시 `lastConsultDate` 갱신 필수.
24. 연락처 저장 시 숫자 외 문자 제거 정규식: `/[^0-9]/g`.
25. `normalizeText`는 장소, 품목, 메모 필드 전반에 적용됨.
26. `applyColonStandard`는 메모 필드 전용 콜론 공백 교정 필터임.
27. 저장 성공 후 500ms 지연 후 `invalidateQueries` 실행.
28. `StandardReportForm.displayName` 속성값은 `"StandardReportForm"` 임.
29. 타임라인 배지 테마 및 라벨은 `reportType` 매핑 테이블을 따름.
30. 타임라인 정보 노출 시 날짜-시간 사이 공백 2칸 강제.
31. 타임라인 내 정보 노출 순서: 일시 > 담당 > 장소 > 연락처 > 품목 > 내용.
32. `TeasyModal` 컨테이너 `size`는 상위 호출부 정의를 따르나 기본 `"lg"` 규격임.
33. `VStack` 내부 모든 컴포넌트 정렬은 `stretch` 임.
34. 담당자 `CustomSelect` 옵션은 `managerOptions` 임.
35. `isSaving` 상태 시 저장 버튼은 `isLoading={true}` 속성 가짐.
36. `updatedAt` 필드는 서버 타임스탬프(`serverTimestamp()`) 사용.
37. 활동 문서 `type` 필드값은 `reportType` 프로프 값을 그대로 사용.
38. 활동 문서 내 `typeName` 필드값은 `reportLabel` 프로프 값을 사용.
39. 주소 입력 시 `hasLocation` 라벨이 스케줄 타입일 경우 `"장소"`, 완료 타입일 경우 `"방문처"`로 가변 노출.
40. `StandardReportForm`은 `useImperativeHandle`을 통해 `submit`, `delete` 노출.
41. 활동 수정 3영업일 제한 로직 적용 가능 (상위 모달에서 제어).
42. `queryClient.invalidateQueries` 호출 대상에 `"activities"` 필수 포함.
43. 브라우저 타임존과 관계없이 한국 표준시 기준으로 데이터 정규화.
44. 모든 컴포넌트 내부 텍스트는 `Chakra UI Text`로 래핑됨.
45. `TeasyInput` 내부 에러 상태 표현 로직 (isRequired 위반 시).
46. 폼 데이터 초기값 바인딩 시 `initialData`가 `formData`보다 높은 우선순위 가짐.
47. `StandardReportForm` 컴포넌트의 루트 엘리먼트는 `Box` 임.
48. `TeasyDateTimeInput`의 `limitType` 동적 전환 이펙트 (`useEffect` 감시).
49. `StandardReportForm` 내부 `TeasyFormLabel` 폰트 크기 `"sm"` 고정.
50. `TeasyTextarea` 내부 폰트 라인 높이 `lineHeight="1.6"` 임.
51. 활동 문서 내 `lastOperator`는 선택된 담당자의 `name` 임.
52. 활동 문서 내 `createdBy`는 활동 저장자의 `uid` 임.
53. `customer_meta` 내 `totalCount` 업데이트 시 `increment(1)` 사용 가능.
54. 파일 업로드 기능은 범용 업무 폼에서 현재 지원하지 않음 (Standard 기준).
55. 활동 삭제 시 `window.confirm` 메시지는 상위 모달 규격을 따름.
56. 상담일 업데이트 시 고객 문서의 서버 타임스탬프(`lastUpdatedAt`) 동시 갱신.
57. 타임라인 카드 상단 헤더의 폰트 크기는 `14px`, 두께는 `bold`임.
58. 활동 삭제 후 토스트 상태는 `"info"`임.
59. `isLoading` 오버레이 배경 블러 강도는 부재 시 `0` 또는 기본 블러 적용.
60. `StandardReportForm`은 `memo` 래퍼를 통해 불필요한 리렌더링 방지.
61. 자산 연동 기능은 범용 업무 단계에서 현재 명시적 기능 부재 (단순 텍스트 기록).
62. `handleSave` 비동기 함수 내 `try-catch` 구문 보유.
63. `finalData` 객체 생성 시 날짜 문자열 정규화 수행.
64. `normalizeText`는 `src/utils/textFormatter.ts`에 정의됨.
65. `applyColonStandard`는 메모 필드에만 적용됨.
66. `TeasyModal`의 크기는 상위 호출부 정의(`lg` 권장)를 따름.
67. 폼 내부 `HStack`의 `spacing`은 `4`임.
68. 모든 입력 필드의 `fontSize`는 `"sm"` 규격 준수.
69. 타임라인 날짜 표시 형식: `YYYY-MM-DD  HH:mm` (공백 2칸).
70. 타임라인 날짜에서 `/`는 `-`로 치환됨.
71. 품목 필드 노출 조건: `hasProduct === true`.
72. 연락처 필드 노출 조건: `hasPhone === true`.
73. 장소 필드 노출 조건: `hasLocation === true`.
74. `hasVisitType` 상수가 `reportType`에 따라 `boolean`으로 계산됨.
75. `TeasyDateTimeInput`의 `placeholder`는 `"날짜 및 시간 선택"`임.
76. 활동 문서 내 `customerName` 필드 중복 기록.
77. 활동 문서 내 `customerId` 필드 보존.
78. 트랜잭션 성공 후 `onClose` 호출 시점은 `handleSubmit` 내부 `finally` 또는 `then` 임.
79. `isSaving` 변수는 초기값 `false` 임.
80. `StandardReportForm` 라이브러리 의존성: `chakra-ui`, `firebase/firestore`.
81. `normalizeText` 유틸리티 호출 시 다중 공백 제거 정규식 포함.
82. `applyColonStandard` 내부에 `replace(/:/g, " :  ")` 패턴 적용 가능 여부 (현재는 전후 공백 1칸 위주).
83. 타임라인 배지 컬러 hex값은 전달받은 테마(`teal`, `pink`, `orange` 등)를 따름.
84. 활동 삭제 시 물리적 삭제 여부 (Firestore `deleteDoc` 사용).
85. `sequenceNumber` 부여 로직은 업무 타입별 독립 카운터 사용.
86. 활동 문서 내 `inventoryDeducted` 플래그는 범용 업무에서 항상 `false` 또는 부재.
87. `isLoading` 오버레이 `zIndex`는 `20`임.
88. 툴팁(`Tooltip`) 지연 노출 시간은 `500ms`임.
89. `Badge` 배지 내부 텍스트 변환(`textTransform`)은 `"none"`임.
90. 폼 내부의 `FormControl`은 `Box`로 래핑되어 간격 조절됨.
91. 전체 기획 명세서의 버전은 `v9.0` 임.
92. 내부 로직의 모든 문자열 비교는 엄격 비교(`===`)를 사용함.
93. `StandardReportForm` 파일의 구성 요소는 `forwardRef`를 사용함.
94. `CustomSelect` 드롭다운의 최대 높이는 모달 높이에 따라 자동 조절됨.
95. 활동 문서 내 `customerAddress` 중복 기록 (hasLocation 시).
96. `page.tsx` 또는 `ReportDetailModal`에서 이 폼을 호출함.
97. `AsScheduleForm`과 연락처 필드 UI 규격 1:1 정합성 유지.
98. 활동 문서 내 `reportType` 필드값은 유니크한 문자열 키임.
99. 시퀀스 동기화 로직은 `type`이 `complete`로 끝나는 경우에만 트리거됨.
100. `StandardReportForm` 컴포넌트 파일의 끝은 `StandardReportForm.displayName` 설정임.
