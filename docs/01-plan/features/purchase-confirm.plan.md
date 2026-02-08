# 구매 확정 (Purchase Confirm) 무결점 준수 엔지니어링 명세서 (v9.1 - Final Truth)

본 문서는 리팩토링 시 **비기능적/기능적 변화를 감지하고 원래의 상태로 복원하기 위한 절대적 기준점(Baseline)**입니다. 1번부터 800번까지의 모든 명세는 실제 코드의 바이너리 수준 정합성을 가지며, 리팩토링 후 이 문서와 대조하여 단 하나의 Props나 로직이라도 다를 경우 즉각 수정되어야 합니다.

---

## [DOMAIN 01: UI 물리 엔진 및 스타일링 명세 (Atomic UI / Physics)]

1. **모달 규격**: `TeasyModal` 사용, `size="lg"` 고정.
2. **포커스 가드(Silent Guard)**: `Box`로 구현, `ref={silentRef}`, `tabIndex={0}`, `position="absolute"`, `top="-100px"`, `left="-100px"`, `opacity={0}`, `pointerEvents="none"`. (v126.3)
3. **로딩 커버 오버레이**: `isLoading` 시 `Flex` 노출, `bg="whiteAlpha.800"`, `zIndex={20}`, `backdropFilter="blur(2px)"`, `borderRadius="md"`.
4. **스피너 규격**: `Spinner` 사용, `size="xl"`, `color="brand.500"`, `thickness="4px"`. 텍스트 `"처리 중..."`.
5. **폼 레이아웃**: `VStack align="stretch" spacing={6}`.
6. **구매 일자**: `TeasyDateTimeInput` 사용, `limitType="future"` (미래 선택 방지 / 과거 및 현재만 가능).
7. **담당자 선택**: `CustomSelect` 사용, `placeholder="선택"`.
8. **상품 카테고리 기점**: `installation` (시공 필수) vs `delivery` (직배송/소모품) 분기 필터링 UI 탑재.
9. **상품 리스트 아이템**: `HStack justify="space-between" bg="white" px={3} py={1.5} minH="36px" borderRadius="md" shadow="xs" border="1px solid" borderColor="gray.100"`.
10. **금액 입력**: `TeasyInput` 사용. `replace(/[^0-9]/g, "")` 필터링 및 숫자 문자열 정규화.
11. **결제 수단**: `CustomSelect` 사용. (카드, 현금, 이체 등).
12. **배송 정보 섹션**: `Box bg="gray.50" borderRadius="md" p={3} border="1px" borderColor="gray.100"`. `productCategory === 'inventory'` 일 때만 활성화.
13. **택배사/운송장**: `TeasyInput` 사용. `courier` 또는 `trackingNumber` 입력 시 `deliveryAddress` 필수 검증 인터랙션 포함.
14. **파일 업로드 (세금계산서)**: `InquiryFileList` 연동. 버튼 배지 테마 `gray.100`.
15. **토스트 알림**: 성공 시 `2000ms`, 경고 시 `3000ms`, `position="top"`.

---

## [DOMAIN 02: 비즈니스 로직 및 런타임 명세 (Logic / Engine)]

101. **페인트 가드 (Paint Guard - 100ms)**: 제출 트랜잭션 전 `100ms` 지연을 통해 UI 로딩 상태 렌더링 보장. (v126.3)
102. **수정/삭제 제한 가드 (Surgical Guard)**: 작성 후 **3영업일**이 경과한 경우 수정 및 삭제 불가 (`isWithinBusinessDays` 유틸 사용). (v126.93)
103. **권한 예외 (Master Bypass)**: `role === 'master'` 유저는 3영업일 제한에 관계없이 모든 활동 수정 가능.
104. **상품 집계 (Aggregation)**: 제출 시 동일 `masterId` 또는 `id`를 가진 상품의 수량을 런타임에서 합산(`Map`)하여 정산 데이터 생성.
105. **재고 차감 로직 (Deduction)**: `productCategory === 'inventory'` 일 때만 재고 차감 기능 작동. `product` 카테고리는 시공 완료 시점에 차감됨.
106. **차감 키 정합성**: 정산 트랜잭션 내 `asset_meta` 조회 시 `masterId` 최우선 조회, 부재 시 `meta_name_category` 조합 사용.
107. **자산 로그 기록**: `editLog` 텍스트에 `"구매 확정 차감 (고객명) [Lock-Verified]"` 리터럴 포함.
108. **보유 상품 실시간 업데이트 (Owned Products Update)**: `inventory` 카테고리 구매 시 고객 문서의 `ownedProducts` 리스트에 가나다순으로 자동 가산 업데이트.
109. **파일 명명 엔진**: `getTeasyStandardFileName` 사용. 카테고리 `"전자세금계산서"` 전달.
110. **데이터 완전성 (Object.fromEntries)**: 제출 전 `undefined` 값을 원천 배제하여 Firestore 전송 에러 방지.
111. **쿼리 동기화 (500ms Delay)**: 저장/삭제 성공 시 500ms 지연 후 `activities`, `customer`, `customers`, `assets` 쿼리 캐시 일괄 무효화. (v123.03)

---

## [DOMAIN 03: 타임라인 렌더링 엔진 명세 (Timeline Specification)]

141. **배지 속성**: `purchase_confirm` 시 테마 `green`, 라벨 `"구매 확정"`.
142. **정보 노출 순서**: 일시 -> 담당 -> 카테고리 -> 상품 -> 금액 -> 결제수단 -> 배송정보 -> 세금계산서.
143. **금액 포맷팅**: `toLocaleString()` 적용하여 천 단위 콤마(` , `) 표기.
144. **배송 정보 표시**: 원문자(`①-⑳`)를 사용하여 택배사, 송장번호, 발송주소를 직렬화하여 출력.
145. **날짜 포맷**: 연월일-시분 사이 공백 2칸 강제.

---

## [DOMAIN 05: 원자 단위 정밀 명세 (Atomic Truth 100 - Logic & Style Atoms)]

본 섹션은 코드의 바이너리 수준 정합성을 수호하기 위한 100가지 미세 사양입니다.

1. `PurchaseForm`의 담당자 선택 플레이스홀더는 `"선택"`임.
2. `TeasyDateTimeInput`의 `limitType`은 `"future"`로 고정되어 있음.
3. 구매 일시는 `YYYY-MM-DD  HH:mm` (공백 2칸) 포맷으로 전송됨.
4. 결제 수단 `CustomSelect`의 `options`은 `PAYMENT_METHODS` 상수를 따름.
5. 금액 입력 필드의 `placeholder`는 `"0"` 혹은 `"구매 금액 입력"`임.
6. 리스트 아이템(`HStack`) 내부 패딩은 `px={3}, py={1.5}` 임.
7. 리스트 아이템 최소 높이 `minH`는 `36px`임.
8. 아이템 배경색은 `"white"`, 테두리는 `"1px solid gray.100"`임.
9. 드래그 핸들 `MdDragHandle` 사이즈는 `18`, 색상은 `"gray.300"`임.
10. 수량 표시 폰트 굵기는 `"bold"`, 색상은 `"brand.500"`임.
11. `productCategory`가 `"inventory"`일 때만 배송 정보 섹션이 가시화됨.
12. 배송 정보 박스의 배경색은 `"gray.50"`, 모서리 곡률은 `"md"`임.
13. 택배사 입력란 플레이스홀더는 `"택배사 입력"`임. (v124.9 기준)
14. 운송장 번호 입력란 플레이스홀더는 `"송장 번호 입력"`임.
15. 발송 주소 입력란 플레이스홀더는 `"발송 주소 입력"`임.
16. 수량 변경 시 `setFormData` 내부에서 `map` 함수를 사용하여 원자적 불불면성 유지.
17. 제출 시 연락처 문자열은 `replace(/[^0-9]/g, "")`를 통해 숫자만 추출됨.
18. `amount` 정규화 시 `parseInt` 가드가 작동하여 `NaN` 발생을 방지함.
19. `discountAmount` 미입력 시 하드코딩된 `"0"`으로 기본 정산됨.
20. 토스트 알림 성공 시 상태값은 `"success"`, 위치는 `"top"`임.
21. 3영업일 수정 제한 로직에 `holidayMap` 유틸리티 연동됨.
22. 마스터 우저 판별은 `userData.role === 'master'` 로 직결됨.
23. `Silent Focus Guard` 박스는 `pointerEvents="none"` 처리됨. (v126.3)
24. `isSubmittingRef.current`를 통한 원자적 서브밋 잠금 수행.
25. 트랜잭션 전 `existingAssets` 조회를 위해 `sourceActivityId` 쿼리 사용.
26. `Inventory Deductions` 시 `actionDate`는 `YYYY-MM-DD` 포맷임.
27. `asset_meta` 조회 시 `masterId`를 1순위 키로 조회하는 조건문 구현됨.
28. `Object.fromEntries` 필터링을 통해 `undefined` 필드 전송 차단.
29. `ownedProducts` 업데이트 전 `existingOwned` 파싱 정규식: `/^(.*)\s+x\s+(\d+)$/`.
30. 보유 상품 리스트 정렬 시 `localeCompare` 기반 가나다순 정합성 보장.
31. 재고 차감 로그(`editLog`) 텍스트는 `"구매 확정 차감 (고객명) [Lock-Verified]"` 임.
32. `sourceActivityId` 필드는 `assets` 문서와 `activities` 문서를 잇는 외래 키임.
33. 저장 성공 후 `performSelfHealing`은 백그라운드 독립 실행됨.
34. `queryClient` 무효화 전 `500ms` 인덱싱 대기 시간 강제.
35. `taxInvoice` 업로드 시 `storagePath`는 `tax_invoices/${customerId}/` 임.
36. `Electronic Tax Invoice` 파일명 생성 시 확장자는 소문자 원본을 따름.
37. `userId` 정규화 시 `normalizeText(val, true)` 엔지니어링 표준 적용.
38. 활동 문서 `type` 필드값은 리터럴 `"purchase_confirm"` 임.
39. 활동 문서 `typeName` 은 `"구매 확정"` 임.
40. 결제 금액 노출 시 `Intl.NumberFormat` 혹은 `toLocaleString()` 엔진 사용.
41. 타임라인 배지 테마는 `"green"` 임.
42. 타임라인 내 상품 정보 출력 시 원문자 `①-⑳` 사용 정합성 준수.
43. 배송 정보 직렬화 시 ` courier | trackingNumber | address ` 순서 고정.
44. 메모 필드 `applyColonStandard` 적용 시 `:` 전후 공백 보정 처리.
45. `StandardReportForm` 과의 일시 입력 필드 물리 디자인 1:1 일치.
46. 모달 헤더 텍스트 우측 `(수정)` 상태 표시 괄호 폰트 두께 `300`임.
47. `Silent Focus Guard` 탭인덱스는 `0`임.
48. `isLoading` 오버레이 배경 블러 강도는 `2px`, `zIndex`는 `20`임.
49. `PurchaseForm.displayName` 속성은 명시적으로 `"PurchaseForm"` 임.
50. 정산 트랜잭션 내 `customerRef` 업데이트 시 `lastConsultDate` 필드 반영.
51. 활동 삭제 시 `restoredOutflow` 는 활동 데이터에 기록된 실제 차감 수량임.
52. 자산 메타 업데이트 시 `lastAction` 필드명은 `"purchase_confirm_deduction"` 임.
53. 자산 메타 조회 지점의 슬래시(`/`)는 언더바(`_`)로 치환 가드 통과함.
54. `inventoryItems` 메타데이터 조회 훅은 `useReportMetadata` 임.
55. 수량 배지 배경색은 `"purple.50"`, 글자색은 `"purple.700"`임. (v124.9 기준 수렴)
56. 수량 조절 버튼 `MdRemove`, `MdAdd` 사이즈는 `xs`임.
57. 결제 수단 선택 시 `"기타"` 선택 시 하단에 사유 입력란 토글됨 (해당 로직 확인).
58. `PurchaseFormData` 인터페이스 내 `amount` 타입은 `string | number` 공용임.
59. `DeliveryInfo` 인터페이스는 `courier`, `trackingNumber`, `deliveryAddress` 필드 보유.
60. `pendingFile`은 단일 파일 객체(`File`) 타입임.
61. 세금계산서 파일명에 현재 날짜(`activityDate`) 반영 로직 탑재.
62. 제출 실패 시 `toast` 상태값은 `"error"` 임.
63. `isSubmitting` 더미 상태값 대신 `isSubmittingRef`를 통한 실제 런타임 제어.
64. `validate` 함수 결과값은 `{ isValid: boolean, message?: string }` 객체임.
65. 배송 정보 미입력 시 `courier`는 빈 문자열(`""`)로 저장됨.
66. `product` 카테고리 구매 시 배송 정보는 `deliveryAddress`만 상속됨.
67. `finalPhotos` 가 아닌 `finalTaxInvoice` 단일 첨부파일 구조임.
68. 이미지 뷰어 `TeasyUniversalViewer` 연동 사양 포함.
69. `getTeasyStandardFileName` 엔진에서 원문자 제거 루틴 탑재.
70. `applyColonStandard`는 메모 전문 필터임.
71. 100ms 페인트 가드는 제출 버튼 클릭 즉시 실행됨.
72. `activities` 배열의 초기값은 `[]` 임.
73. `productOption` 내 `category` 정보는 대문자로 유입되어도 소문자로 정규화됨.
74. `metaId` 생성 시 문자열 끝에 `_purchase` 접미사 부여 규격 준수.
75. 정산 로그 `lastOperator` 는 상담원의 실명(`managerName`) 임.
76. `updatedAt` 필드는Firestore 서버의 `serverTimestamp()` 사용.
77. `amount` 입력 중 숫자가 아닌 문자 입력 시 즉시 필터링됨.
78. `discountAmount` 입력 필드와 `amount` 필드의 `Variant` 는 동일함.
79. `FormControl` 은 `VStack` 내부에서 간격 `6` 단위로 배치됨.
80. `TeasyButton` 의 `colorScheme` 은 `"brand"` 임.
81. 활동 문서 내 `createdByName` 은 세션 상의 사용자 이름임.
82. 활동 문서 내 `sequenceNumber` 는 `purchase_confirm` 활동 갯수 + 1로 자동 보정.
83. `performSelfHealing` 성공 시 별도 알림을 주지 않는 백그라운드 처리 규격.
84. `customer_meta` 업데이트 시 `lastUpdatedAt` 필드 갱신 필수.
85. `DeliveryInfo` 내 `shipmentDate` 필드 데이터 포맷 준수.
86. `PurchaseForm` 컴포넌트 내부에서 `forwardRef` 사용 여부 확인 (`ForwardRefExoticComponent` 규격).
87. 타임라인 대시보드 내 보고서 내용 `Text`의 `lineHeight`는 `1.6`임.
88. 활동 삭제 후 토스트 메시지는 `"삭제 완료"` 임.
89. `restoredInflow` 정산 시 `lastInflow` 기록 존재 여부 가드 루틴 보유.
90. `isDeliveryItem` 플래그는 `asset` 로그 생성 시 메타데이터에서 상속됨.
91. 사진 업로드 한도가 아닌 파일 용량 한도(5MB) 체크 로직 보유 여부 확인. (현재는 무제한)
92. `PurchaseForm` 파일 확장자는 `.tsx` 임.
93. `usePurchaseForm` 파일 확장자는 `.ts` 임.
94. 모든 내부 훅은 `"use client"` 지시문을 최상단에 가짐.
95. `db` 및 `storage` 객체는 `@/lib/firebase` 에서 임포트함.
96. `Activity` 타입 정의는 `@/types/domain` 표준 패키지를 따름.
97. 상품 리스트 삭제 시 `confirm` 창 호출 시점은 `quantity` 가 0이 되는 순간임.
98. 전체 기획 명세서의 버전은 `v9.1` 임.
99. 내부 로직의 모든 문자열 비교는 `===` 엄격 비교만 사용함.
100. 100ms 페인트 가드는 트랜잭션 무결성을 위한 전제 조건임.
