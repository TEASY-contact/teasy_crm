# 시연 확정 (Demo Schedule) 무결점 준수 엔지니어링 명세서 (v10.0 - Final Truth)

본 문서는 리팩토링 시 **비기능적/기능적 변화를 감지하고 원래의 상태로 복원하기 위한 절대적 기준점(Baseline)**이 되며, 1번부터 100번까지의 명세는 코드의 바이너리 수준 정합성을 가집니다.

---

## [DOMAIN 01: UI 물리 엔진 및 스타일링 명세 (Atomic UI / Physics)]

1. **모달 규격**: `TeasyModal` 사용, `size="lg"` 고정.
2. **포커스 가드(Silent Guard)**: `Box`로 구현, `ref={silentRef}`, `tabIndex={0}`, `position="absolute"`, `top="-100px"`, `left="-100px"`, `opacity={0}`, `pointerEvents="none"`. (v126.3)
3. **로딩 커버 오버레이**: `isLoading` 시 `Flex` 노출, `bg="whiteAlpha.800"`, `zIndex={20}`, `backdropFilter="blur(2px)"`, `borderRadius="md"`.
4. **스피너 규격**: `Spinner` 사용, `size="xl"`, `color="brand.500"`, `thickness="4px"`. 텍스트 `"처리 중..."`.
5. **폼 레이아웃**: `VStack align="stretch" spacing={6}`.
6. **시연 일시**: `TeasyDateTimeInput` 사용, `limitType="future"` (미래 예약 원칙).
7. **담당자 선택**: `CustomSelect` 사용, `placeholder="선택"`. 옵션 `managerOptions`.
8. **방문 주소**: `TeasyInput` 사용, `placeholder="입력"`. `normalizeText` 적용.
9. **연락처 입력**: `TeasyPhoneInput` 사용, `placeholder="000-0000-0000"`.
10. **시연 상품 선택**: `CustomSelect` 사용, `placeholder="선택"`. 옵션 `products` (메타데이터).
11. **참고 사항**: `TeasyTextarea` 사용, `placeholder="입력"`. `applyColonStandard` 적용.
12. **토스트 알림**: 성공 시 `2000ms`, `position="top"`.

---

## [DOMAIN 02: 비즈니스 로직 및 런타임 명세 (Logic / Engine)]

101. **상태 초기화 (Inheritance)**: 신규 작성 시 `customer.address`와 `customer.phone`을 `location`, `phone` 필드에 자동 상속.
102. **날짜 기본값**: 현재 시각 기반 `YYYY-MM-DD  HH:mm` (공백 2칸) 포맷 생성.
103. **페인트 가드 (Paint Guard - 100ms)**: 제출 트랜잭션 시작 전 `100ms`의 의도적 지연을 주어 UI 로딩 상태를 확실히 렌더링 보장. (v126.3)
104. **수정/삭제 제한 가드 (Surgical Guard)**: 작성 후 **3영업일**이 경과한 경우 수정 및 삭제 불가 (`isWithinBusinessDays` 사용). (v126.93)
105. **권한 예외 (Master Bypass)**: `role === 'master'` 유저는 3영업일 제한에 구애받지 않고 모든 활동 수정 가능.
106. **데이터 정합성 (Normalization)**:
    - 연락처: 숫자 외 문자 제거 후 저장 (`replace(/[^0-9]/g, "")`).
    - 텍스트: 방문 주소, 시연 상품에 `normalizeText` 적용.
    - 메모: `:` 전후 공백 규격화를 위해 `applyColonStandard` 적용.
107. **메타 락킹 (Meta-Locking)**: `customer_meta/${customer.id}_demo_schedule` 문서를 통해 시퀀스 번호 및 전체 개수 관리.
108. **시퀀스 관리**: 신규 생성 시 `activities` 배열을 필터링하여 다음 `sequenceNumber`를 순차적으로 부여.
109. **트랜잭션 가드**: `runTransaction`을 사용하여 활동 데이터 생성과 고객 문서의 `lastConsultDate` 업데이트를 원자적으로 처리.
110. **캐시 무효화 (500ms Delay)**: 저장/삭제 성공 시 500ms 지연 후 `activities`, `customer`, `customers` 쿼리 캐시 일괄 무효화. (v123.03)

---

## [DOMAIN 03: 타임라인 렌더링 엔진 명세 (Timeline Specification)]

141. **배지 속성**: `demo_schedule` 시 테마 `blue`, 라벨 `"시연 확정"`.
142. **정보 노출 순서**: 일시 -> 담당 -> 주소 -> 전화 -> 상품.
143. **메모 박스**: `· 참고사항` 헤더 포함 `gray.50` 박스 렌더링.
144. **날짜 포맷**: 연원일-시분 사이 공백 2칸 강제. (`YYYY-MM-DD  HH:mm`)

---

## [DOMAIN 05: 원자 단위 정밀 명세 (Atomic Truth 100 - Logic & Style Atoms)]

1. `DemoScheduleForm`의 담당자 선택 플레이스홀더는 `"선택"`임.
2. `TeasyDateTimeInput`의 `limitType`은 `"future"`로 설정되어 있음.
3. 방문 주소 입력란 플레이스홀더는 `"입력"`임.
4. 연락처 입력란 플레이스홀더는 `"000-0000-0000"`임.
5. 시연 상품 선택 `CustomSelect` 플레이스홀더는 `"선택"`임.
6. 참고 사항 `TeasyTextarea` 플레이스홀더는 `"입력"`임.
7. `VStack` 전체 컨테이너의 `spacing`은 `6`임.
8. `isLoading` 오버레이 배경색은 `whiteAlpha.800`, 블러 `2px`임.
9. 스피너 굵기 `thickness`는 `4px`, 색상은 `"brand.500"`임.
10. `Silent Focus Guard` 박스 위치는 `top="-100px"`, `left="-100px"`임.
11. `TeasyDateTimeInput`은 `YYYY-MM-DD  HH:mm` (중간 공백 2개) 형식을 준수함.
12. 신규 작성 시 `customer.address`를 `location` 필드에 즉시 바인딩함.
13. 신규 작성 시 `customer.phone`을 `phone` 필드에 즉시 바인딩함.
14. 제출 전 `normalizeText` 적용 대상: `location`, `product`.
15. 제출 전 `applyColonStandard` 적용 대상: `memo`.
16. `DemoScheduleForm.displayName` 속성값은 `"DemoScheduleForm"` 임.
17. 페인트 가드 `setTimeout` 지연 시간은 `100ms`임. (v126.3)
18. `customer_meta` 내 문서 ID는 `${customer.id}_demo_schedule` 임.
19. `sequenceNumber` 부여 시 `activities.filter(a => a.type === 'demo_schedule')` 개수 + 1 로직 사용.
20. `sequenceNumber`는 1부터 시작하는 정수임.
21. 트랜잭션 내 `customerRef` 업데이트 시 `lastConsultDate` 필드를 `formData.date`로 갱신함.
22. 토스트 알림의 성공 노출 시간은 `2000ms`임.
23. 토스트 알림 위치는 `"top"` 고정임.
24. `TeasyModal` 컨테이너 `size`는 `"lg"` 고정임.
25. 타임라인 배지 테마는 `"blue"` 임. (v123.70)
26. 타임라인 배지 라벨은 `"시연 확정"` 임.
27. 타임라인 날짜 표시 히스토리 포맷: `YYYY-MM-DD  HH:mm` (공백 2칸).
28. 메모 영역 렌더링 시 `· 참고사항` 헤더의 폰트 크기는 `xs`, 굵기는 `bold`, 색상은 `gray.500`임.
29. 메모 박스 배경색은 `gray.50`, 패딩 `p={3}` 임.
30. 담당자 `CustomSelect` 옵션은 `managerOptions` 임.
31. 시연 상품 `CustomSelect` 옵션은 `products` 메타데이터임.
32. `TeasyPhoneInput` 내부 `onChange` 시 숫자만 필터링하는 로직 탑재.
33. 폼 하단 버튼 그룹의 `TeasyButton` 명칭은 `"저장"`과 `"취소"`임.
34. `isLoading === true` 시 로딩 오버레이와 스피너가 전체 화면을 덮음.
35. 연락처 상속 시 `customer.phone`이 공석일 경우 필드에 빈 문자열 주입.
36. `useDemoScheduleForm` 훅의 `submit` 함수는 `runTransaction`을 포함함.
37. 트랜잭션 오류 시 `console.error`에 `"Demo Schedule Submit Failure:"` 문구 포함.
38. 성공 시 `onClose`는 `submit` 결과가 `true`일 때만 호출됨.
39. 활동 문서 `type` 필드값은 `"demo_schedule"` 임.
40. 주소 입력 시 `normalizeText`는 특수문자 및 중복 공백 정규화 포함.
41. `isSubmitting.current` Ref를 통한 중복 저장 방지 기전 탑재. (v126.3)
42. `ReportDetailModal`에서 `activity.type === "demo_schedule"` 분기 처리됨.
43. 담당자 필드 읽기 전용 시 `managerOptions.find` 대조 로직 포함.
44. `transaction.update`를 사용하여 `lastConsultDate` 원자적 갱신.
45. `customer_meta` 업데이트 시 `totalCount: (Number(currentMeta.totalCount) || 0) + 1` 로직 사용.
46. 활동 문서 내 `managerRole` 필드에 담당자의 권한 정보를 박제함.
47. 시연 완료 시 예약 데이터의 `sequenceNumber`를 대조하여 연동함.
48. `Silent Focus Guard` 박스는 `pointerEvents="none"` 처리됨.
49. `isLoading` 오버레이 `zIndex`는 `20`임.
50. 상담일 업데이트 시 고객 문서의 `updatedAt` 필드를 `serverTimestamp()`로 갱신함.
51. 모든 컴포넌트 내부 텍스트는 `Chakra UI Text`로 래핑됨.
52. `DemoScheduleForm` 내부의 모든 `VStack` 정렬은 `stretch` 임.
53. `SCHEDULE_CONSTANTS.TYPE_NAME` 필드값은 `"시연 확정"` 임.
54. `CustomSelect` 드롭다운의 `zIndex`는 모달 내부에서 최상단 유지.
55. 폼 초기화 시 `initialData`가 있으면 해당 값으로 상태 동기화(`useEffect`).
56. 삭제 기능 호출 시 `window.confirm` 메시지는 `"정말 이 [시연 확정] 보고서를 삭제하시겠습니까?"`임.
57. 삭제 트랜잭션 시 `customer_meta`의 `totalCount`를 1 차감 (`Math.max(0, (Number(currentMeta.totalCount) || 0) - 1)`).
58. 활동 수정 3영업일 가드는 `isWithinBusinessDays` 유틸 사용.
59. `useDemoScheduleForm`은 `userData`를 통해 작성자 이름을 기록함.
60. 타임라인 카드의 정보 영역 `flex` 비율은 `3`임.
61. 타임라인 카드의 메모 영역 `flex` 비율은 `2`임 (내용물 존재 시).
62. `TeasyPhoneInput` 상속값 및 `formatPhone` 적용 규격 준수.
63. `useReportMetadata`를 통해 `products` 목록을 실시간 반영함.
64. `submit` 함수 내부에서 `activityId`가 없으면 `doc(collection(db, "activities")).id`를 선할당.
65. 트랜잭션 내 `activities` 컬렉션 저장 시 `serverTimestamp()` 사용.
66. `doc(db, "activities", targetActivityId)`를 정식 경로로 사용.
67. 작성자 이름 필드는 `createdByName` 임.
68. 타임라인 날짜 표시 형식: `YYYY-MM-DD  HH:mm` (공백 2칸).
69. 타임라인 관리 `STEP_LABELS` 내 `demo_schedule` 키값은 `"시연 확정"` 임.
70. `isReadOnly` 모드 시 모든 `TeasyInput` 및 `CustomSelect`는 비활성화됨.
71. 폼 제출 성공 후 `queryClient.invalidateQueries`는 3곳(`activities`, `customer`, `customers`) 실행.
72. `StandardReportForm`과 달리 시연 예약은 `DemoScheduleForm` 전용 컴포넌트 사용.
73. 폼 내부 `HStack` 간격 `spacing`은 `4`임.
74. `formData.phone`의 `replace(/[^0-9]/g, "")` 처리는 저장 직전 수행.
75. `DemoScheduleForm` 컴포넌트의 루트 엘리먼트는 `Box` 임.
76. 주소 입력 시 `normalizeText`는 특수문자 및 중복 공백 정규화 포함.
77. `ReportSelectionModal`에서 `demo_schedule`은 즉시 작성 가능 보고서임.
78. 활동 문서 내 `lastConsultDate`는 상담 히스토리의 정점임.
79. `createdBy`는 활동을 실제 저장한 유저의 `uid` 임.
80. `updatedAt` 필드는 활동 수정 시 항상 업데이트됨.
81. 활동 문서 내 `typeName` 필드값은 `SCHEDULE_CONSTANTS.TYPE_NAME` (`"시연 확정"`) 임.
82. 타임라인 카드 헤더 `fontWeight`는 `bold`, `fontSize`는 `sm` (또는 14px)임.
83. 타임라인 내 보고서 내용 `Text`의 `lineHeight`는 `1.6`임.
84. 활동 삭제 후 토스트 메시지는 `"삭제 완료"` 임.
85. `TeasyDateTimeInput`의 `limitType`은 `"future"`로 명시되어 미래 예약을 허용함.
86. 브라우저 타임존과 관계없이 한국 표준시(`Asia/Seoul`) 기준으로 데이터 정규화.
87. 모든 컴포넌트 내부에서 `forwardRef`를 통한 `submit/delete` 호출 인터페이스 보장.
88. 담당자 선택 안함(`""`) 시 제출 유효성 검사에서 차단(toast 노출).
89. 시연 상품은 `ProductOption` 타입을 따르는 단일 선택임.
90. 활동 문서 내 `customerName` 필드는 고객 목록 가독성을 위해 중복 기록됨.
91. 트랜잭션 성공 직후 `queryClient.invalidateQueries` 호출 전 500ms Painter 지연.
92. `handleDelete` 비동기 함수 내 `isLoading` 플래그를 통한 상태 제어.
93. `useDemoScheduleForm`의 리턴 객체에는 `submit`, `handleDelete` 포함.
94. `finalData` 구성 시 `serverTimestamp()`를 통한 불변 작성일 확보.
95. `normalizeText` 유틸리티는 `src/utils/textFormatter.ts`에 정의됨.
96. `applyColonStandard`는 메모 필드 전문 필터임.
97. 폼 내부의 `FormControl`은 `isRequired`를 통해 필수 여부 표시.
98. 전체 기획 명세서의 버전은 `v10.0` 임.
99. 내부 로직의 비교 연산자는 `!==` 및 `===` 만 사용함.
100. `DemoScheduleForm`의 `forwardRef` displayname은 `"DemoScheduleForm"`임.
