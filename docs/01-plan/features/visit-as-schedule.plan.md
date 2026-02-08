# 방문 A/S 예약 (Visit A/S Schedule) 무결점 준수 엔지니어링 명세서 (v9.1 - Final Truth)

본 문서는 리팩토링 시 **비기능적/기능적 변화를 감지하고 원래의 상태로 복원하기 위한 절대적 기준점(Baseline)**입니다. 1번부터 800번까지의 모든 명세는 실제 코드의 바이너리 수준 정합성을 가지며, 리팩토링 후 이 문서와 대조하여 단 하나의 Props나 로직이라도 다를 경우 즉각 수정되어야 합니다.

---

## [DOMAIN 01: UI 물리 엔진 및 스타일링 명세 (Atomic UI / Physics)]

1. **모달 규격**: `TeasyModal` 사용, `size="lg"` 고정.
2. **포커스 가드(Silent Guard)**: `Box`로 구현, `ref={silentRef}`, `tabIndex={0}`, `position="absolute"`, `top="-100px"`, `left="-100px"`, `opacity={0}`, `pointerEvents="none"`. (v126.3)
3. **로딩 커버 오버레이**: `isLoading` 시 `Flex` 노출, `bg="whiteAlpha.800"`, `zIndex={20}`, `backdropFilter="blur(2px)"`, `borderRadius="md"`.
4. **스피너 규격**: `Spinner` 사용, `size="xl"`, `color="brand.500"`, `thickness="4px"`. 텍스트 `"처리 중..."`.
5. **폼 레이아웃**: `VStack align="stretch" spacing={6}`.
6. **일시 입력**: `TeasyDateTimeInput` 사용, `limitType="past"` (과거 선택 방지 / 미래만 선택 가능).
7. **담당자 선택**: `CustomSelect` 사용, `placeholder="선택"`.
8. **방문 주소**: `TeasyInput` 사용, `placeholder="현장 주소 입력"`. `normalizeText` 적용.
9. **연락처 입력**: `TeasyPhoneInput` 사용, `placeholder="000-0000-0000"`.
10. **유형 선택**: `CustomSelect` 사용, `placeholder="A/S 유형 선택"`.
11. **관련 상품/준비 물품 선택**: `CustomSelect` 사용, `placeholder="상품/물품 선택"`. 선택 시 `value=""` 즉시 초기화.
12. **아이템 컨테이너**: `HStack justify="space-between" bg="white" px={3} py={1.5} minH="36px" borderRadius="md" shadow="xs" border="1px solid" borderColor="gray.100"`.
13. **아이템 활성 상태**: `_active={{ bg: "brand.50", borderColor: "brand.200" }}`.
14. **드래그 핸들**: `MdDragHandle` (size 18) 아이콘 적용. `controls.start(e)` 호출.
15. **증상/요망 입력 영역**: `Box bg="gray.50" borderRadius="md" p={3} border="1px" borderColor="gray.100"`.
16. **입력 행 스타일**: `HStack spacing={3} bg="white" px={3} py={1.5} minH="38px" borderRadius="md" shadow="xs" border="1px solid" borderColor="gray.100"`.
17. **입력 행 상호작용**: `transition="all 0.2s"`, `_hover={{ transform: "translateY(-1px)", shadow: "sm", borderColor: "brand.100" }}`.
18. **사진 그리드**: `PhotoGrid` 사용. `Box p={4} border="1px dashed" borderColor="gray.200" borderRadius="xl" bg="white"`.
19. **참고 사항**: `TeasyTextarea` 사용, `placeholder="입력"`. `applyColonStandard` 적용.
20. **토스트 알림**: 순서 변경 시 `1500ms`, 성공 시 `2000ms`, `position="top"`.

---

## [DOMAIN 02: 비즈니스 로직 및 런타임 명세 (Logic / Engine)]

101. **페인트 가드 (Paint Guard - 100ms)**: 제출 트랜잭션 전 `100ms` 지연을 통해 UI 로딩 상태 렌더링 보장. (v126.3)
102. **수정/삭제 제한 가드 (Surgical Guard)**: 작성 후 **3영업일**이 경과한 경우 수정 및 삭제 불가 (`isWithinBusinessDays` 유틸 사용). (v126.93)
103. **권한 예외 (Master Bypass)**: `role === 'master'` 유저는 3영업일 제한에 관계없이 모든 활동 수정 가능.
104. **상태 초기화 (Inheritance)**: 신규 작성 시 `customer.phone` 또는 마지막 활동 주소/전화번호 자동 상속 루틴 탑재.
105. **동적 행 관리**: 증상/업무 행 삭제 시 최소 1개 유지 가드 (`length <= 1` 시 `[""]`로 리셋).
106. **수량 하한 가드**: 1 미만 차감 시 `window.confirm` 메시지 출력 및 불리언 확인 로직.
107. **자산 동기화 (Atomic Memory State)**:
    - **Atomic Transaction**: 트랜잭션 내에서 `MetaTracker`를 통해 기존 자산 복구(Rollback)와 신규 자산 차감(Outflow)을 원자적으로 수행.
    - **MetaTracker**: `Map<MetaID, { ref, data, deltaStock, deltaOutflow }>` 구조로 메모리 상에서 모든 변동을 추적.
    - **수정 안전성**: Snaphost Data Overwriting 방지를 위해 트랜잭션 내에서 로드한 메타데이터에 Delta를 누적하여 최종 상태 커밋.
108. **보고서 연쇄 동기화 (Core Sync)**:
    - 활동 수정 시 동일 `sequenceNumber`를 가진 `as_complete` 보고서가 존재할 경우 `asType` 즉시 동기화.
    - 타입 변경 시 완료 보고서의 타입 종속 첨부파일(영상 등)을 조건부 삭제(Nuke) 처리.
109. **리소스 물리 파기 (Physical Cleanup)**: 삭제 시 Firebase Storage 실물 파일(사진) `deleteObject` 수행.
110. **셀프 힐링 (Self-Healing)**: 저장/삭제 성공 후 파편화된 재고 정합성을 맞추기 위해 `performSelfHealing` 백그라운드 엔진 가동.
111. **필수 검증 (제출)**: 일시, 담당자, 유형, 주소, 연락처, 접수 증상(1개 이상), 수행 요망(1개 이상) 필수.
112. **쿼리 동기화 (500ms Delay)**: 저장/삭제 성공 시 500ms 지연 후 `activities`, `customer`, `customers`, `assets` 쿼리 캐시 일괄 무효화. (v123.03)

---

## [DOMAIN 03: 타임라인 렌더링 엔진 명세 (Timeline Specification)]

141. **배지 속성**: `as_schedule` 시 테마 `pink`, 라벨 `"방문 A/S 확정"`.
142. **정보 노출 순서**: 일시 -> 담당 -> 유형 -> 주소 -> 전화 -> 점검(상품) -> 증상 -> 업무 -> 준비(물품).
143. **증상/업무 직렬화**: 2개 이상일 때 원문자(`①`, `②`) 번호 부여하여 줄바꿈(`\n`) 출력.
144. **준비 물품 노출**: `준비` 라벨 사용. `①물품명 × 수량` 패턴 정합성 준수.
145. **메모 박스**: `· 참고사항` 헤더 포함 `gray.50` 박스 렌더링.
146. **날짜 포맷**: 연월일-시분 사이 공백 2칸 강제.

---

## [DOMAIN 05: 원자 단위 정밀 명세 (Atomic Truth 100 - Logic & Style Atoms)]

본 섹션은 코드의 바이너리 수준 정합성을 수호하기 위한 100가지 미세 사양입니다.

1. `AsScheduleForm`의 담당자 선택 플레이스홀더는 `"선택"`임.
2. `TeasyDateTimeInput`의 `limitType`은 `"past"`로 설정되어 과거 선택을 제한함.
3. 방문 주소 입력란 플레이스홀더는 `"현장 주소 입력"`임.
4. 연락처 입력란 플레이스홀더는 `"000-0000-0000"`임.
5. A/S 유형 선택 `CustomSelect` 플레이스홀더는 `"A/S 유형 선택"`임.
6. 관련 상품 선택 `CustomSelect` 플레이스홀더는 `"상품 선택"`임.
7. 준비 물품 선택 `CustomSelect` 플레이스홀더는 `"물품 선택"`임.
8. 참고 사항 `TeasyTextarea` 플레이스홀더는 `"입력"`임. (v124.9 기준 수렴)
9. 리스트 아이템 `HStack` 패딩은 `px={3}, py={1.5}` 임.
10. 아이템 컨테이너 최소 높이 `minH`는 `36px`임.
11. 아이템 배경색은 `"white"`, 테두리는 `"1px solid gray.100"`임.
12. 활성 상태 아이템 배경색은 `"brand.50"`, 테두리는 `"brand.200"`임.
13. 드래그 핸들 `MdDragHandle` 사이즈는 `18`, 색상은 `"gray.300"`임.
14. 증상/요망 섹션 배경색은 `"gray.50"`, 모서리 곡률은 `"md"`임.
15. 입력 행 스타일 `minH`는 `38px`, 호버 시 `translateY(-1px)` 효과 적용.
16. 호버 시 테두리 색상은 `"brand.100"`, 그림자는 `"sm"` 임.
17. 인라인 입력 필드 `TeasyInput`은 `variant="unstyled"`, `h="24px"` 임.
18. 순번 표시 폰트 크기는 `sm`, 색상은 `"brand.500"`, 너비 `minW`는 `20px`임.
19. 순번 숫자는 `getCircledNumber`를 통해 원문자로 변환됨.
20. 제어 버튼 유닛 사이 `Divider` 높이는 `10px`임.
21. 사진 그리드 부모 `Box` 패딩은 `4`, 테두리는 `"dashed gray.200"`임.
22. 토스트 성공 알림 지속 시간은 `2000ms`, 노출 위치는 `"top"`임.
23. 순서 변경 토스트 알림 지속 시간은 `1500ms`임.
24. `isLoading` 오버레이 배경은 `whiteAlpha.800`, 블러 `2px`임.
25. 3영업일 수정 제한 로직에 `holidayMap` 유틸리티 연동됨.
26. `initialData` 부재 시 날짜 기본 공백 규격은 리터럴 공백 2개임. (YYYY-MM-DD  HH:mm)
27. 연락처 상속 시 `customer.phone` 정보를 우선 채량함.
28. 증상 입력 행 삭제 시 `length === 1`이면 `[""]`로 초기화 루틴 수행.
29. `rowId` 생성 방식은 `Math.random().toString(36)` 임.
30. 수량 델타 계산 시 `Number(qty) || 0` 가드 통과함.
31. 재고 차감 트랜잭션 전 `existingAssets` 스냅샷 조회 필수.
32. Surgical Sync: 기존 출고 물량을 `totalOutflow`에서 먼저 차감 후 신규 물량 합산.
33. 자산 메타 조회 지점은 `meta_name_category` 조합임. (install-schedule 정합성 공유)
34. 감사 로그 메시지 접미사는 고객 명칭을 포함한 차감 사양 기술.
35. `sequenceNumber`는 `as_schedule` 전용 카운터 엔진 사용.
36. 보고서 유형 변경 시 `as_complete` 연동 문서의 첨부파일 스토리지 물리 삭제 수행.
37. 삭제 트리거: `commitmentFiles`, `collectionVideo`, `reinstallationVideo` 등 타입 종속 자원.
38. `normalizeText`는 주소 및 모든 증상/업무 필드에 적용됨.
39. `applyColonStandard`는 메모 전문 필터임.
40. `AsScheduleForm.displayName` 속성값은 `"AsScheduleForm"` 임.
41. 타임라인 대시보드 배지 테마는 `"pink"`, 라벨은 `"방문 A/S 확정"` 임.
42. 타임라인 내 증상/업무 직렬화 시 원문자 `①-⑳` 사용 및 `\n` 결합 출력.
43. 메모 박스 상단 `· 참고사항` 헤더의 자간 및 폰트 두께 규격 준수.
44. `PhotoGrid` 내부 `onRemoval` 시 실제 URL이면 클린업 대상 배열에 적치.
45. `isLoading` 상태가 `true`일 때 저장 버튼은 `disabled` 속성 부여됨.
46. `TeasyModal` 컨테이너 `size`는 `"lg"` 고정임.
47. `Silent Focus Guard` 위치는 `top="-100px"`, `left="-100px"`임. (v126.3)
48. `Silent Focus Guard` 박스는 `pointerEvents="none"` 처리됨.
49. 상담원 정보 업데이트 시 `Activities` 문서의 `managerRole` 필드 기록.
50. `updatedAt` 필드는Firestore 서버의 `serverTimestamp()` 사용.
51. 활동 문서 `type` 필드값은 `"as_schedule"` 임.
52. `StandardReportForm`과 일자 입력 필드 UI 물리 사양 1:1 일치.
53. `useAsScheduleForm` 훅의 `submit` 함수는 `runTransaction`을 포함함.
54. 폼 하단 버튼 그룹의 `TeasyButton` 명칭은 `"저장"`과 `"취소"`임.
55. 수량 변경 성공 시 UI 스케일링 `0.98` 애니메이션 적용.
56. 담당자 `CustomSelect` 옵션은 `managerOptions` 임.
57. 관련 상품 `CustomSelect` 옵션은 `products` 메타데이터임.
58. 준비 물품 `CustomSelect` 옵션은 `inventoryItems` 메타데이터임.
59. `handleUpdateQty` 시 수량 1 미만 차단 가드 루틴 보유.
60. 제출 성공 시 `queryClient.invalidateQueries`는 최소 4곳 실행.
61. `AsScheduleForm` 컴포넌트의 루트 엘리먼트는 `Box` 임.
62. `Reorder.Item` 드래그 아이템의 실시간 순서 정합성 보장.
63. `ProductListItem` 간격 `marginBottom`은 `0px`임.
64. 타임라인 로딩 스켈레톤의 `noOfLines`는 `3`임.
65. `assets` 문서 내 `editLog` 필드는 정산 사유를 상세 기술함.
66. `useAsScheduleForm`의 초기화 이펙트 의존성 배열에 `initialData` 포함.
67. 자산 메타 업데이트 시 `totalOutflow` 누적 가산 수행.
68. 자산 입출고 로그 생성 시 `lastOperator`는 선택된 담당자 이름임.
69. `TeasyUniversalViewer`는 시각적 사진 확인 목적으로만 연동됨.
70. 파일 명칭 생성 시 대문자 확장자 통일 규격 준수. (v124.9)
71. 폼 데이터 정규화 시 `trim()` 및 특수공백 제거 처리.
72. 활동 문서 내 `lastOperator`는 `managerName`과 동일함.
73. `createdBy`는 활동 저장자의 `uid` 임.
74. 활동 문서 내 `customerName` 필드 검색 편의를 위해 포함.
75. 트랜잭션 성공 후 `onClose`는 비동기 처리 완료 후 호출.
76. `isSaving` 변수 대신 `isLoading` 상태값으로 UI 통합 제어.
77. `finalData` 객체 생성 시 날짜 문자열 `YYYY-MM-DD  HH:mm` 준수.
78. `normalizeText`는 `src/utils/textFormatter.ts`의 표준 엔진임.
79. `applyColonStandard`는 메모 필드 내 콜론의 전후 공백 보정.
80. `TeasyModal`의 크기는 `"lg"` 고정임.
81. 폼 내부 `HStack`의 `spacing`은 `4`임.
82. 모든 입력 필드의 `fontSize`는 `"sm"` 규격 준수.
83. 브라우저 타임존과 관계없이 한국 표준시 기준으로 데이터 정규화.
84. `getTeasyStandardFileName` 엔진에 `category` 값으로 `"A/S예약"` 전달.
85. `ThinParen` 컴포넌트는 모든 파일 목록에서 공통 적용됨.
86. 활동 삭제 시 `window.confirm` 메시지는 A/S 예약 전용 상구 사용.
87. 삭제 성공 후 토스트 상태는 `"info"`임.
88. `StandardReportForm`과의 정합성을 위해 일자 입력 필드 규격 통일.
89. `isLoading` 오버레이 배경 블러 강도는 `2px`임.
90. 페인트 가드 `setTimeout` 지연 시간은 `100ms`임. (v126.3)
91. `Badge` 배지 내부 텍스트 변환은 `"none"`임.
92. `MdAdd` 및 `MdRemove` 아이콘의 기본 색상은 `"gray.600"`임.
93. 폼 내부의 `FormControl`은 `Box`로 래핑되어 간격 조절됨.
94. 전체 기획 명세서의 버전은 `v9.1` 임.
95. 내부 로직의 모든 문자열 비교는 엄격 비교(`===`)를 사용함.
96. `AsScheduleForm` 파일의 끝은 `AsScheduleForm` 명칭 익스포트임.
97. `useImperativeHandle`을 통해 `submit`과 `handleDelete` 외부 노출.
98. 활동 문서 내 `customerAddress` 중복 기록 사양 보유.
99. `InquiryForm`과 달리 연락처 필드에 상속 후 수정 가능 상태 유지.
100. 100ms 페인트 가드는 트랜잭션 무결성을 위한 전제 조건임.
