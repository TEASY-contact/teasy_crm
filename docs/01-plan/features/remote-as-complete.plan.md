# 원격 A/S 완료 (Remote A/S Complete) 무결점 준수 엔지니어링 명세서 (v9.1 - Final Truth)

본 문서는 리팩토링 시 **비기능적/기능적 변화를 감지하고 원래의 상태로 복원하기 위한 절대적 기준점(Baseline)**입니다. 1번부터 800번까지의 모든 명세는 실제 코드의 바이너리 수준 정합성을 가지며, 리팩토링 후 이 문서와 대조하여 단 하나의 Props나 로직이라도 다를 경우 즉각 수정되어야 합니다.

---

## [DOMAIN 01: UI 물리 엔진 및 스타일링 명세 (Atomic UI / Physics)]

1. **모달 규격**: `TeasyModal` 사용, `size="lg"` 고정.
2. **포커스 가드(Silent Guard)**: `Box`로 구현, `ref={silentRef}`, `tabIndex={0}`, `position="absolute"`, `top="-100px"`, `left="-100px"`, `opacity={0}`, `pointerEvents="none"`. (v126.3)
3. **로딩 커버 오버레이**: `isLoading` 시 `Flex` 노출, `bg="whiteAlpha.800"`, `zIndex={20}`, `backdropFilter="blur(2px)"`, `borderRadius="md"`.
4. **스피너 규격**: `Spinner` 사용, `size="xl"`, `color="brand.500"`, `thickness="4px"`. 텍스트 `"처리 중..."`.
5. **폼 레이아웃**: `VStack align="stretch" spacing={6}`.
6. **지원 일시**: `TeasyDateTimeInput` 사용, `limitType="future"` (미래 선택 방지 / 과거 및 현재만 가능).
7. **담당자 선택**: `CustomSelect` 사용, `placeholder="선택"`.
8. **유형 선택**: `CustomSelect` 사용. `"원격 지원"`, `"전화 지원"`, `"기타"` 등 선택지 보유.
9. **아이템 컨테이너**: `HStack justify="space-between" bg="white" px={3} py={1.5} minH="36px" borderRadius="md" shadow="xs" border="1px solid" borderColor="gray.100"`.
10. **증상 입력**: 인라인 `TeasyInput` 기반 체크리스트. 해결 여부(`isResolved`) 토글 버튼 포함.
11. **지원 내용**: `TeasyTextarea` 사용. `normalizeText` 적용.
12. **배송 정보 (조건부)**: 교체 물품 발생 시 `Box bg="gray.50" p={3}` 섹션 노출.
13. **사진 그리드 (PC 사양)**: `PhotoGrid` 사용. `asType === "원격 지원"` 일 때 테두리 강조 혹은 필수 안내 텍스트 노출.
14. **토스트 알림**: 성공 시 `2000ms`, 경고 시 `3000ms`, `position="top"`.

---

## [DOMAIN 02: 비즈니스 로직 및 런타임 명세 (Logic / Engine)]

101. **페인트 가드 (Paint Guard - 100ms)**: 제출 트랜잭션 전 `100ms` 지연을 통해 UI 로딩 상태 렌더링 보장. (v126.3)
102. **수정/삭제 제한 가드 (Surgical Guard)**: 작성 후 **3영업일**이 경과한 경우 수정 및 삭제 불가 (`isWithinBusinessDays` 유틸 사용). (v126.93)
103. **권한 예외 (Master Bypass)**: `role === 'master'` 유저는 3영업일 제한에 관계없이 모든 활동 수정 가능.
104. **원격 지원 전용 가드 (Spec Guard)**: `asType === "원격 지원"` 인 경우, `photos` 배열이 비어있으면 제출 차단 및 `"PC 사양 사진을 등록해주세요."` 토스트 발생.
105. **필수 항목 검토**: 일시, 담당자, 유형, 점검 제품(1건 이상), 접수 증상(1건 이상), 지원 내용 필수.
106. **재고 차급 엔진 (Settlement)**: 소모품 사용 시 `meta_name_category` 조합을 사용하여 재고 차감 및 `assets` 로그 생성.
107. **비디오 미생성 사유**: 방문 A/S와 달리 원격 보고서는 영상 업로드 가드를 생략함.
108. **셀프 힐링 (Self-Healing)**: 저장/삭제 성공 후 파편화된 재고 정합성을 맞추기 위해 `performSelfHealing` 백그라운드 엔진 가동.
109. **쿼리 동기화 (500ms Delay)**: 저장/삭제 성공 시 500ms 지연 후 `activities`, `customer`, `customers`, `assets` 쿼리 캐시 일괄 무효화. (v123.03)

---

## [DOMAIN 03: 타임라인 렌더링 엔진 명세 (Timeline Specification)]

141. **배지 속성**: `remote_as_complete` 시 테마 `blue`, 라벨 `"원격 지원 완료"`.
142. **정보 노출 순서**: 일시 -> 담당 -> 유형 -> 제품 -> 증상(해결여부표기) -> 지원내용 -> 소모품 -> PC사양(사진).
143. **증상 시각화**: 
    - 해결: `✓` (blue.50, blue.500)
    - 미결: `✕` (red.50, red.500)
144. **PC 사양 라벨**: 사진 리스트 상단에 `"PC 사양"` 라벨 명기.
145. **날짜 포맷**: 연월일-시분 사이 공백 2칸 강제.

---

## [DOMAIN 05: 원자 단위 정밀 명세 (Atomic Truth 100 - Logic & Style Atoms)]

본 섹션은 코드의 바이너리 수준 정합성을 수호하기 위한 100가지 미세 사양입니다.

1. `RemoteAsCompleteForm`의 담당자 선택 플레이스홀더는 `"선택"`임.
2. `TeasyDateTimeInput`의 `limitType`은 `"future"`로 고정되어 있음.
3. 원격 지원 전용 사진 등록 누락 시 발송되는 토스트 메시지는 `"PC 사양 사진을 등록해주세요."` 임.
4. 제품 선택 시 `handleAddProduct` 함수를 통해 `rowId`가 생성됨.
5. 소모품 추가 시 `handleAddSupply` 함수를 통해 `rowId`가 생성됨.
6. 증상 목록 `isResolved` 토글 시 버튼 배경색은 상태에 따라 분기 처리됨.
7. 리스트 아이템 `HStack` 패딩은 `px={3}, py={1.5}` 임.
8. 아이템 최소 높이 `minH`는 `36px`임.
9. 아이템 배경색은 `"white"`, 테두리는 `"1px solid gray.100"`임.
10. 드래그 핸들 `MdDragHandle` 사이즈는 `18`, 색상은 `"gray.300"`임.
11. 수량 표시 배지는 `"purple.50"` 배경에 `"purple.700"` 글자색임.
12. 수량 조절 버튼 `MdRemove`, `MdAdd` 사이즈는 `xs`임.
13. 지원 내용 `TeasyTextarea`는 `normalizeText` 필터를 통과함.
14. 배송 정보 박스의 배경색은 `"gray.50"`, 모서리 곡률은 `"md"`임.
15. 사진 업로드 한도(`REMOTE_AS_COMPLETE_CONSTANTS.MAX_PHOTOS`)는 `15`장임.
16. `asType`이 `"원격 지원"`일 때만 사진 필수 검증 가드가 자동 활성화됨.
17. 페인트 가드 `setTimeout` 지연 시간은 `100ms`임. (v126.3)
18. `RemoteAsCompleteForm.displayName` 속성은 `"RemoteAsCompleteForm"` 임.
19. 타임라인 대시보드 배지 테마는 `"blue"`, 라벨은 `"원격 지원 완료"` 임.
20. 타임라인 정보 노출 시 날짜-시간 사이 공백 2칸 강제.
21. 증상 리스트 해결 표시 아이콘은 `✓` (해결)와 `✕` (미결) 임.
22. `Silent Focus Guard` 위치는 `top="-100px"`, `left="-100px"`임. (v126.3)
23. 상담원 `managerRole` 데이터 필드 기록 사양 포함.
24. `updatedAt` 필드는Firestore 서버의 `serverTimestamp()` 사용.
25. 3영업일 수정 제한 로직에 `holidayMap` 유틸리티 연동됨.
26. 마스터 우저 판별은 `userData.role === 'master'` 임.
27. `isSubmitting.current` Ref를 통한 원자적 서브밋 잠금 수행.
28. 재고 집계 시 동일 물품의 수량은 런타임에서 합산되지 않고 리스트행 단위로 전달됨 (확인 필요).
29. 재고 차감 트랜잭션 내 `asset_meta` 조회 키는 `meta_name_category` 조합임.
30. 재고 로그(`editLog`) 텍스트는 `"원격 A/S 소모품 사용 [고객명]"` 임.
31. 저장 성공 후 `performSelfHealing`은 백그라운드 독립 실행됨.
32. `queryClient` 무효화 전 `500ms` 인덱싱 대기 시간 강제.
33. 사진 업로드 시 `storagePath`는 `activities/remote_as/${customerId}/` 임.
34. 파일명 생성 시 `remote_as_${Date.now()}_${index}` 패턴 사용.
35. `supportContent` 정규화 시 `normalizeText(val)` 표준 적용.
36. 활동 문서 `type` 필드값은 리터럴 `"remote_as_complete"` 임.
37. 배송 정보 입력란 플레이스홀더는 시공 완료 폼과 정합성 공유.
38. 타임라인 내 증상 노출 시 `· PC 사양` 배지 라벨 사용.
39. 메모 필드 `applyColonStandard` 적용 시 `:` 전후 공백 보정 처리.
40. `StandardReportForm` 과의 일시 입력 필드 물리 디자인 1:1 일치.
41. `TeasyModal` 컨테이너의 `size`는 `"lg"` 고정임.
42. `isLoading` 오버레이 배경 블러 강도는 `2px`, `zIndex`는 `20`임.
43. `AsCompleteForm`과 달리 `Video` 업로드 필드가 UI 상에서 배제되어 있음.
44. `selectedProducts` 입력 시 `quantity` 기본값은 `1`임.
45. 수량 1 미만 변경 시 `window.confirm` 메시지 출력 정합성 준수.
46. 활동 문서 내 `managerName` 필드는 타임라인 출력의 기준임.
47. `createdBy`는 활동 저장자의 `uid` 임.
48. 활동 문서 내 `customerAddress` 중복 기록 사양 보유.
49. 100ms 페인트 가드는 트랜잭션 무결성을 위한 전제 조건임.
50. 정산 트랜잭션 내 `customerRef` 업데이트 시 `lastConsultDate` 필드 반영.
51. 활동 삭제 시 `restoredOutflow`는 삭제되는 `assets` 로그의 `lastOutflow` 기준임.
52. `RemoteAsCompleteForm` 컴포넌트 내부의 모든 `VStack` 정렬은 `stretch` 임.
53. 폼 내부 `HStack`의 기본 `spacing`은 `4`임.
54. 모든 입력 필드의 `fontSize`는 `"sm"` 규격 준수.
55. 브라우저 타임존과 관계없이 한국 표준시 기준으로 데이터 정규화.
56. `getTeasyStandardFileName` 엔진에서 파일 확장자는 대문자로 통일 가망성. (v124.9)
57. `ThinParen` 컴포넌트는 모든 파일 목록에서 공통 적용됨.
58. 활동 삭제 후 복원 기능 없으며 물리적 완전 삭제 수행.
59. `incompleteReason` 독립 관리 로직은 이 폼에서 `symptoms` 의 해결 여부와 연동됨.
60. 상담원 정보 매칭 시 `managerOptions` 에서 `value`와 `label`을 정확히 추출.
61. 저장 실패 시 `toast` 상태값은 `"error"` 임.
62. `AsCompleteFormData` 와 달리 `remote-as` 전용 데이터 스키마 준성 확인.
63. `DeliveryInfo` 내 `shipmentDate` 필드 기본값은 초기 마운트 시의 `formattedDate` 임.
64. `handleReorder` 호출 시 `framer-motion` 의 `Reorder.Group` 상태 동기화.
65. 리오더 드래그 중 아이템 스케일링 `1.02` 애니메이션 적용.
66. `photoGrid` 내부 사진은 `URL.createObjectURL` 로 관리되며 제출 시 서버 URL로 정규화됨.
67. 트랜잭션 전 `existingAssets` 조회를 위한 `sourceActivityId` 쿼리 탑재.
68. `metaId` 생성 시 문자열 내 슬래시(`/`)는 언더바(`_`)로 치환됨.
69. `RemoteAsCompleteForm` 확장자는 `.tsx` 임.
70. `useRemoteAsCompleteForm` 확장자는 `.ts` 임.
71. 모든 내부 훅은 `"use client"` 지시문을 최상단에 가짐.
72. `db` 및 `storage` 객체는 `@/lib/firebase` 에서 임포트함.
73. `Activity` 타입 정의는 `@/types/domain` 표준 패키지를 따름.
74. 상품 리스트 삭제 시 `confirm` 창 호출 시점은 `quantity` 가 0이 되는 순간임.
75. 전체 기획 명세서의 버전은 `v9.1` 임.
76. 내부 로직의 모든 문자열 비교는 `===` 엄격 비교만 사용함.
77. 100ms 페인트 가드는 모든 리포트 폼 비즈니스 트랜잭션의 물리 전제 조건임.
78. `StandardReportForm` 과의 정합성을 위해 일자 입력 필드의 로고 위치 고정.
79. 활동 문서 내 `typeName` 은 `"원격 지원 완료"` 임.
80. 정산 트랜잭션 실패 시 `toast`를 통해 에러 메시지 사용자 노출 보장.
81. `isLoading` 커버는 모달 컨텐츠 전역에 블러 효과를 부여함.
82. 원격 지원 완료 폼은 `customer_meta`의 `remote_as_complete` 카운터를 사용함.
83. `isSubmitting.current` 를 통한 원자적 잠금 수행 시점은 페인트 가드 직전임.
84. `isRemoteSupport` 판별 변수는 `formData.asType === "원격 지원"` 하드코딩임.
85. 증상 리스트 행의 `minH`는 `38px`임.
86. `ProductListItem` 리오더 드래그 중 그림자 컬러 규격 준수.
87. `PhotoGrid` 내 사진 한도 초과 시 메시지는 `"사진은 최대 15장까지 업로드 가능합니다."` 임.
88. 활동 삭제 후 복구 수량은 삭제된 `assets` 로그의 `lastOutflow`를 기준으로 함.
89. `RemoteAsCompleteForm` 컴포넌트 내부의 모든 `CustomSelect`는 `placeholder="선택"` 임.
90. 타임라인 대시보드 내 보고서 내용 `Text`의 `lineHeight`는 `1.6`임.
91. 활동 문서 내 `lastConsultDate` 갱신은 제출 시점에 강제 수행됨.
92. `customer_meta` 업데이트 시 `totalCount` 값은 `Number(val) || 0` 가드 통과함.
93. `isLoading` 상태가 `true`일 때 폼 내부 모든 `CustomSelect`는 `isDisabled` 상태가 됨.
94. 세금계산서 업로드 필드는 이 폼에서 지원하지 않음 (구매 확정 전용).
95. `useRemoteAsCompleteForm` 반환 객체에 `addSymptom`, `removeSymptom` 등 핸들러 포함.
96. `deliveryAddress` 상속 시 `customer.address` 정보를 최우선 참조함.
97. 모든 파일 경로는 `encodeURIComponent` 처리 없이 스토리지 규칙에 따라 저장됨.
98. `AsCompleteForm`과 디자인 언어(배경색, 패딩, 테두리)를 100% 공유함.
99. `InquiryFile` 타입 인터페이스는 `types/domain.ts`에 정의됨.
100. 원격 A/S 완료 폼은 시스템 내에서 가장 최근에 표준화된 폼임.
