# 시공 확정 (Install Schedule) 무결점 준수 엔지니어링 명세서 (v9.1 - Final Truth)

본 문서는 리팩토링 시 **비기능적/기능적 변화를 감지하고 원래의 상태로 복원하기 위한 절대적 기준점(Baseline)**입니다. 1번부터 800번까지의 모든 명세는 실제 코드의 바이너리 수준 정합성을 가지며, 리팩토링 후 이 문서와 대조하여 단 하나의 Props나 로직이라도 다를 경우 즉각 수정되어야 합니다.

---

## [DOMAIN 01: UI 물리 엔진 및 스타일링 명세 (Atomic UI / Physics)]

1. **모달 규격**: `TeasyModal` 사용, `size="lg"` 고정.
2. **포커스 가드(Silent Guard)**: `Box`로 구현, `ref={silentRef}`, `tabIndex={0}`, `position="absolute"`, `top="-100px"`, `left="-100px"`, `opacity={0}`, `pointerEvents="none"`. (v126.3)
3. **로딩 커버 오버레이**: `isLoading` 시 `Flex` 노출, `bg="whiteAlpha.800"`, `zIndex={20}`, `backdropFilter="blur(2px)"`, `borderRadius="md"`.
4. **스피너 규격**: `Spinner` 사용, `size="xl"`, `color="brand.500"`, `thickness="4px"`. 텍스트 `"처리 중..."`.
5. **폼 레이아웃**: `VStack align="stretch" spacing={6}`.
6. **시공 일시**: `TeasyDateTimeInput` 사용, `limitType="past"` (미래 선택만 가능 / 과거 선택 차단).
7. **담당자 선택**: `CustomSelect` 사용, `placeholder="선택"`.
8. **방문 주소**: `TeasyInput` 사용, `placeholder="전국 시공 주소 입력"`. `normalizeText` 적용.
9. **연락처 입력**: `TeasyPhoneInput` 사용, `placeholder="000-0000-0000"`.
10. **시공 상품 섹션**: 상속된 상품 존재 시 `CustomSelect` 비노출. 상속 상품은 수정 불가(`isInherited` 가드).
11. **리스트 아이템**: `HStack justify="space-between" bg="white" px={3} py={1.5} minH="36px" borderRadius="md" shadow="xs" border="1px solid" borderColor="gray.100"`.
12. **준비 물품 구분선**: 자동 물량(isAuto)과 수동 물량 사이 `borderTop="1px dashed" borderColor="purple.200"` 표시.
13. **수행 요망 섹션**: `bg="gray.50" p={3} border="1px" borderColor="gray.100"` 내부 시공 전/후 분리.
14. **체크리스트 입력 행**: `bg="white" px={3} py={1.5} minH="36px" borderRadius="md" shadow="xs" border="1px solid" borderColor="gray.100"`. `MdRemove`, `MdAdd` 버튼 포함.
15. **순서 변경**: `framer-motion`의 `Reorder` 사용. `MdDragHandle` (size 18) 아이콘 적용.
16. **토스트 알림**: 순서 변경 시 `1500ms`, 성공 시 `2000ms`, `position="top"`.

---

## [DOMAIN 02: 비즈니스 로직 및 런타임 명세 (Logic / Engine)]

101. **데이터 상속 (Inheritance)**:
    - 주소/연락처: 마지막 `demo_schedule` -> `customer` 정보 순으로 채널링 상속.
    - 시공 상품: 활동 로그 중 `purchase_confirm` (category: 'product') 중 현재 시공 예약 차수와 일치하는 것을 자동 검색하여 상속.
    - 사진: 마지막 `demo_complete` 활동의 사진 전체 상속.
102. **날짜 기본값**: 현재 시각 기반 `YYYY-MM-DD  HH:mm` (공백 2칸) 포맷 생성. (v124.8)
103. **UI 잠금 (Lock-In)**: 상속된 시공 상품은 `isInherited` 플래그를 통해 삭제 및 수량 조절 버튼 비활성화.
104. **페인트 가드 (Paint Guard - 100ms)**: 제출 트랜잭션 전 `100ms` 지연을 통해 UI 로딩 상태 렌더링 보장. (v126.3)
105. **수정/삭제 제한 가드 (Surgical Guard)**: 작성 후 **3영업일**이 경과한 경우 수정 및 삭제 불가 (`isWithinBusinessDays` 유틸 사용). (v126.93)
106. **권한 예외 (Master Bypass)**: `role === 'master'` 권한 보유자는 3영업일 제한에 관계없이 모든 활동 수정 가능.
107. **재고 차감 정합성 (Inventory Sync - Atomic Memory State)**:
    - **Atomic Transaction**: 트랜잭션 내에서 `MetaTracker`를 통해 기존 자산 복구(Rollback)와 신규 자산 차감(Deduction)을 원자적으로 수행.
    - **MetaTracker**: `Map<MetaID, { ref, data, deltaStock, deltaOutflow }>` 구조로 메모리 상에서 모든 변동을 추적 후 최종 커밋.
    - **수정 안전성**: 수정 시 기존 자산의 `lastOutflow`만큼 재고를 복구하고, 수정된 내용으로 다시 차감하여 증발 방지.
    - **차감 키**: `meta_${name.trim()}_${(category || "").trim()}` 조합 사용.
    - **출급 로그**: `assets` 컬렉션에 `lastRecipient`, `lastOutflow` 정보를 포함하여 즉각 생성.
108. **상품-소모품 수량 동기화**: `product` 수량 변경 시 연동된 `isAuto` 소모품의 수량을 `composition` 비율에 맞춰 실시간 재계산.
109. **셀프 힐링 (Self-Healing)**: 저장/삭제 성공 후 파편화된 재고 정합성을 맞추기 위해 `performSelfHealing` 백그라운드 엔진 가동.
110. **필수 검증 (제출)**: 일시, 담당자, 주소, 연락처, 시공 상품(1개 이상) 필수.
111. **데이터 정제**: 제출 시 전체 필드 `normalizeText` 및 메모 `applyColonStandard` 적용.
112. **쿼리 동기화 (500ms Delay)**: 저장/삭제 성공 시 500ms 지연 후 `activities`, `customer`, `customers`, `assets` 쿼리 캐시 일괄 무효화. (v123.03)

---

## [DOMAIN 03: 타임라인 렌더링 엔진 명세 (Timeline Specification)]

141. **배지 속성**: `install_schedule` 시 테마 `brand`, 라벨 `"시공 확정"`.
142. **정보 노출 순서**: 일시 -> 담당 -> 주소 -> 전화 -> 시공 상품 -> 준비 물품 -> 수행 요망 업무.
143. **준비 물품 렌더링**: 수동 추가 물품은 상품명 뒤 `(추가)` 라벨 부여.
144. **날짜 포맷**: 연월일-시분 사이 공백 2칸 강제.

---

## [DOMAIN 05: 원자 단위 정밀 명세 (Atomic Truth 100 - Logic & Style Atoms)]

본 섹션은 코드의 바이너리 수준 정합성을 수호하기 위한 100가지 미세 사양입니다.

1. `InstallScheduleForm`의 담당자 선택 플레이스홀더는 `"선택"`임.
2. `TeasyDateTimeInput`의 `limitType`은 `"past"`로 설정되어 있으며, 이는 과거 선택을 제한(미래만 가능)함을 의미함.
3. 주소 입력란 플레이스홀더는 `"전국 시공 주소 입력"`임.
4. 연락처 입력란 플레이스홀더는 `"000-0000-0000"`임.
5. 시공 상품 선택 `CustomSelect` 플레이스홀더는 `"선택"`임.
6. 준비 물품 선택 `CustomSelect` 플레이스홀더는 `"물품 추가"`임.
7. 리스트 아이템 `HStack` 내 좌우 패딩 `px`는 `3`, 상하 `py`는 `1.5`임.
8. 아이템 컨테이너의 최소 높이 `minH`는 `36px`임.
9. 아이템 배경색은 `"white"`, 테두리는 `"1px solid gray.100"`임.
10. 드래그 핸들 `MdDragHandle`의 사이즈는 `18`임.
11. 수량 배지(`Badge`)의 배경색은 `"purple.50"`, 글자색은 `"purple.700"`임.
12. 수량 배지의 높이 `h`는 `20px`, 글자 크기는 `11px`임.
13. 수량 배지의 최소 너비 `minW`는 `24px`임.
14. 수량 배지 모서리 반경은 `"sm"`, 폰트 두께는 `700`임.
15. 자동 추가 물량 구분선의 색상은 `"purple.200"`, 스타일은 `"dashed"`임.
16. 업무 요청 섹션 배경색은 `"gray.50"`, 패딩 `p`는 `3`임.
17. 업무 요청 행의 `bg`는 `"white"`, 전후 분리 마커는 `"✓"` (gray.400)임.
18. 토스트 알림 성공 시 노출 위치는 `"top"`, 지속 시간은 `2000ms`임.
19. 순서 변경 성공 시 토스트의 지속 시간은 `1500ms`임.
20. `isLoading` 오버레이 배경색은 `whiteAlpha.800`, 블러 `2px`임.
21. 스피너 굵기 `thickness`는 `4px`, 색상은 `"brand.500"`임.
22. `Silent Focus Guard` 위치는 `top="-100px"`, `left="-100px"`임. (v126.3)
23. 상속 상품 삭제 버튼 은닉 조건: `p.isInherited === true`.
24. 상속 상품 수량 조절 버튼 은닉 조건: `p.isInherited === true`.
25. 재고 차감 시 `asset_meta` 조회 키는 `meta_${name}_${category}` 조합임. (p.masterId 아님)
26. 시연 완료 사진 상속 시 `demo_complete` 활동의 사진 전량을 상속함.
27. 날짜 기본 포맷: `YYYY-MM-DD  HH:mm` (공백 2칸).
28. `composition` 파싱 엔진: 유니코드 원문자 및 곱셈 기호 `×` 완벽 대응 로직 탑재.
29. `handleUpdateQty` 시 상속 상품은 조기 리턴(Early Return) 처리로 보호됨.
30. 페인트 가드 `setTimeout` 지연 시간은 `100ms`임. (v126.3)
31. `InstallScheduleForm.displayName` 속성값은 `"InstallScheduleForm"` 임.
32. 타임라인 대시보드 배지 테마는 `"brand"`, 라벨은 `"시공 확정"` 임.
33. 타임라인 정보 노출 시 날짜-시간 사이 공백 2칸 강제.
34. 수동 추가 물품 타임라인 라벨 접미사: `(추가)`.
35. `ownedProducts` 가산 로직은 예약 단계인 본 폼에서 실행하지 않음.
36. 담당자 `CustomSelect` 옵션은 `managerOptions` 임.
37. 시공 상품 `CustomSelect` 옵션은 `products` 메타데이터임.
38. 준비 물품 `CustomSelect` 옵션은 `inventoryItems` 메타데이터임.
39. `TeasyPhoneInput` 상속값 및 `formatPhone` 적용 규격 준수.
40. `useInstallScheduleForm` 훅의 `submit` 함수는 `runTransaction`을 원자적으로 수행함.
41. 폼 하단 버튼 그룹의 `TeasyButton` 명칭은 `"저장"`과 `"취소"`임.
42. `isSaving` 상태 시 저장 버튼은 `isLoading={true}` 속성 가짐.
43. `updatedAt` 필드는Firestore 서버의 `serverTimestamp()` 사용.
44. 활동 문서 `type` 필드값은 `"install_schedule"` 임.
45. 활동 문서 내 `typeName` 필드값은 `"시공 확정"` 임.
46. `normalizeText`는 주소 및 업무 요청 필드 저장 시 텍스트 정제에 사용됨.
47. `applyColonStandard`는 메모 필드 텍스트 정렬 정합성 전용임.
48. `StandardReportForm`과의 정합성을 위해 일자 입력 필드 규격 통일.
49. `Silent Focus Guard` 박스는 `pointerEvents="none"` 처리됨.
50. `isLoading` 오버레이 `zIndex`는 `20`임.
51. 상담일 업데이트 시 고객 문서의 `lastConsultDate` 필드를 동시 갱신함.
52. `InstallScheduleForm` 내부의 모든 `VStack` 정렬은 `stretch` 임.
53. 수량 변경 시 불변성 유지를 위해 `map` 함수를 통한 새 배열 반환 규격 준수.
54. `handleUpdateQty` 시 수량 1 미만 차단 로직 포함.
55. 활동 수정 3영업일 가드는 `isWithinBusinessDays` 유틸 기반임.
56. 마스터 권한 보유 시 3영업일 경과 후에도 삭제/수정 버튼이 활성화됨.
57. 제출 성공 시 `invalidateQueries`는 최소 4곳(`activities`, `customer`, `customers`, `assets`) 실행.
58. `Reorder.Item` 드래그 동작 시 ` controls.start(e)` 호출 보장.
59. `ProductListItem` 간격 `marginBottom`은 `0px`로 밀착 설계됨.
60. 타임라인 로딩 스켈레톤의 `noOfLines`는 `3`임.
61. `assets` 문서 내 `editLog` 필드는 차감 사유를 상세 기술함.
62. `useInstallScheduleForm`의 초기화 이펙트 의존성 배열에 `initialData` 및 `activities` 포함.
63. 자산 메타 업데이트 시 `totalOutflow` 필드에 수량 누적 합산.
64. 자산 입출고 로그 생성 시 `lastOperator`는 선택된 담당자의 이름임.
65. `TeasyUniversalViewer`는 시공 확정 폼에서 사진 확인 시 `Box` 레이아웃 유지.
66. `getTeasyStandardFileName` 엔진에서 파일 확장자는 대문자로 통일. (v124.9)
67. `ThinParen` 컴포넌트는 모든 파일 명칭 렌더링 시 적용됨.
68. 활동 수정 3영업일 경과 여부는 `holidayMap`을 반영한 영업일 기준임.
69. 활동 삭제 시 `window.confirm` 메시지는 보고서와 재고 기록 파기 경고를 포함함.
70. 삭제 성공 후 토스트 상태는 `"info"`임.
71. 자산 메타의 `lastAction` 필드에 `"install_schedule_deduction"` 기록.
72. 활동 문서 내 `createdBy`는 활동 저장자의 `uid` 임.
73. 활동 문서 내 `customerName` 필드는 검색 로직을 위해 중복 기록됨.
74. 트랜잭션 성공 후 `onClose`는 `finally` 구문 외부에서 성공 시에만 호출.
75. `isSaving` 변수는 `useState(false)`로 초기화되어 `setIsLoading`으로 관리됨.
76. 자산 정사복구(`performSelfHealing`) 함수는 `assets` 로그 전수 검사 로직 보유.
77. `normalizeText` 유틸리티는 `src/utils/textFormatter.ts`의 `export` 함수임.
78. `applyColonStandard`는 메모 필드 내 콜론의 물리 위치 정합 규격.
79. 폼 내부의 `FormControl`은 `Box`로 래핑되어 간격 조절됨.
80. 전체 기획 명세서의 버전은 `v9.1` 임.
81. 내부 로직의 모든 문자열 비교는 엄격 비교(`===`)를 사용함.
82. `InstallScheduleForm` 컴포넌트의 끝은 `"InstallScheduleForm"` 명칭 익스포트임.
83. 재고 차급 트랜잭션 시 준비 물품의 중복 항목은 `Map`을 통해 합산 처리 후 1회 차감.
84. `isInherited` 상품 삭제 시도 시 `isInherited` 가드로 인해 버튼 자체가 렌더링되지 않음.
85. 타임라인 준비 물품 출력 시 `(추가)` 라벨은 수동으로 추가된 소모품에만 붙음.
86. `lastConsultDate` 갱신 시 `formData.date`를 사용하여 타 문서와 정합성 유지.
87. 중복 저장 방지를 위해 `isSubmitting.current` Ref 가드 장착.
88. 이미지 업로드 시 `uniquePending` 로직을 통해 동일 파일의 동시 업로드 원천 차단.
89. `URL.createObjectURL` 사용 시 `removePhoto` 핸들러에서 `revokeObjectURL` 즉시 호출.
90. 활동 문서 내 `managerRole` 필드에 담당자 권한 기록 사양 포함.
91. 사진 한도(`INSTALL_SCHEDULE_CONSTANTS.MAX_PHOTOS`)는 `15`장임.
92. `handleFileUpload` 함수 내에서 이미지 파일 타입(`image/`) 검증 루틴 보유.
93. `StandardReportForm` 과의 일시 입력 필드 물리적 UI 디자인 통일.
94. 차감 항목 배지 컬러 `purple.50` 및 `purple.700` 은 리비전 v126.3 규격임.
95. 폼 레이아웃의 `VStack align="stretch" spacing={6}` 은 컨테이너 표준임.
96. `MdAdd` 및 `MdRemove` 아이콘의 사이즈는 `20` 수준으로 통일.
97. `SelectedProduct` 및 `SelectedItem` 타입은 `types.ts`에 정의됨.
98. `composition` 파싱 시 수량 정보가 없는 경우 기본값 `1` 적용.
99. 트랜잭션 오류 시 `console.error`에 상세 스택 트레이스 기록.
100. 모든 리포트 폼 중 설정 확정 보고서만 유일하게 실시간 재고 차감 로직을 포함함.
