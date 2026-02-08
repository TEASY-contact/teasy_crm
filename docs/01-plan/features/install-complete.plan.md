# 시공 완료 (Install Complete) 무결점 준수 엔지니어링 명세서 (v9.1 - Final Truth)

본 문서는 리팩토링 시 **비기능적/기능적 변화를 감지하고 원래의 상태로 복원하기 위한 절대적 기준점(Baseline)**입니다. 1번부터 800번까지의 모든 명세는 실제 코드의 바이너리 수준 정합성을 가지며, 리팩토링 후 이 문서와 대조하여 단 하나의 Props나 로직이라도 다를 경우 즉각 수정되어야 합니다.

---

## [DOMAIN 01: UI 물리 엔진 및 스타일링 명세 (Atomic UI / Physics)]

1. **모달 규격**: `TeasyModal` 사용, `size="lg"` 고정.
2. **포커스 가드(Silent Guard)**: `Box`로 구현, `ref={silentRef}`, `tabIndex={0}`, `position="absolute"`, `top="-100px"`, `left="-100px"`, `opacity={0}`, `pointerEvents="none"`. (v126.3)
3. **로딩 커버 오버레이**: `isLoading` 시 `Flex` 노출, `bg="whiteAlpha.800"`, `zIndex={20}`, `backdropFilter="blur(2px)"`, `borderRadius="md"`.
4. **스피너 규격**: `Spinner` 사용, `size="xl"`, `color="brand.500"`, `thickness="4px"`. 텍스트 `"처리 중..."`.
5. **폼 레이아웃**: `VStack align="stretch" spacing={6}`.
6. **완료 일시**: `TeasyDateTimeInput` 사용, `limitType="future"` (미래 선택 방지 / 과거 및 현재만 가능).
7. **담당자 선택**: `CustomSelect` 사용, `placeholder="선택"`.
8. **주소 입력**: `TeasyInput` 사용, `placeholder="전국 시공 주소 입력"`. `normalizeText` 적용.
9. **연락처 입력**: `TeasyPhoneInput` 사용. `formatPhone` 자동 상속.
10. **리스트 아이템**: `HStack justify="space-between" bg="white" px={3} py={1.5} minH="36px" borderRadius="md" shadow="xs" border="1px solid" borderColor="gray.100"`.
11. **수량 배지**: `Badge bg="purple.50" color="purple.700" fontSize="11px" px={1} h="20px" minW="24px" borderRadius="sm" fontWeight="700"`.
12. **수행 결과 섹션**: 시공 전/후 업무 체크리스트를 분리하여 관리. 완료 시 `✓` (blue.50, blue.500) 표시.
13. **미처리 사유**: 사유 입력 시 `TeasyTextarea size="sm" bg="gray.50" pl={3}`.
14. **사진 그리드**: `PhotoGrid` 사용. `Box p={4} border="1px dashed" borderColor="gray.200" borderRadius="xl" bg="white"`.
15. **토스트 알림**: 순서 변경 시 `1500ms`, 성공 시 `2000ms`, `position="top"`.

---

## [DOMAIN 02: 비즈니스 로직 및 런타임 명세 (Logic / Engine)]

101. **페인트 가드 (Paint Guard - 100ms)**: 제출 트랜잭션 전 `100ms` 지연을 통해 UI 로딩 상태 렌더링 보장. (v126.3)
102. **수정/삭제 제한 가드 (Surgical Guard)**: 작성 후 **3영업일**이 경과한 경우 수정 및 삭제 불가 (`isWithinBusinessDays` 유틸 사용). (v126.93)
103. **권한 예외 (Master Bypass)**: `role === 'master'` 유저는 3영업일 제한에 관계없이 모든 활동 수정 가능.
104. **상태 초기화 (Inheritance)**: 마지막 `install_schedule` 보고서를 탐색하여 위치, 전화, 담당자, 상품, 물품, 시공 전/후 업무 리스트를 일괄 자동 상속.
105. **정산 엔진 (Settlement & Atomic Memory State)**:
    - **Atomic Transaction**: 트랜잭션 내에서 `MetaTracker`를 통해 예약 자산(Schedule)과 실제 사용량(Actual)의 차이를 계산하고, 기존 자산 복구(Rollback)와 신규 정산(Settlement)을 원자적으로 수행.
    - **MetaTracker**: `Map<MetaID, { ref, data, deltaStock, deltaOutflow, deltaInflow }>` 구조로 메모리 상에서 모든 변동을 추적.
    - **Delta Logic**: `delta = 예약량 - 실제사용량`.
    - `delta > 0`: `install_recovery` (현장 회수 입고).
    - `delta < 0`: `install_extra_outflow` (현장 추가 출급).
    - **수정 안전성**: 수정 시 기존 정산 내역(Rollback - 입고 취소 or 출급 취소)을 먼저 반영하고, 새로운 정산 내역을 계산.
106. **차감 키 정합성**: 정산 트랜잭션 내 `asset_meta` 조회 시 `meta_name_category` 조합 사용. (v126.9 기준 수렴)
107. **보유 상품 업데이트 (Owned Products Update)**: 시공 완료 시 고객 문서의 `ownedProducts` 배열에 시공된 상품을 `상품명 x 수량` 패턴으로 자동 가산하여 실시간 업데이트.
108. **셀프 힐링 (Self-Healing)**: 저장/삭제 성공 후 파편화된 재고 정합성을 맞추기 위해 `performSelfHealing` 백그라운드 엔진 가동.
109. **필수 검증 (제출)**: 일시, 담당자, 주소, 연락처 필수. 미체크 업무 존재 시 `incompleteReason` 필수.
110. **쿼리 동기화 (500ms Delay)**: 저장/삭제 성공 시 500ms 지연 후 `activities`, `customer`, `customers`, `assets` 쿼리 캐시 일괄 무효화. (v123.03)

---

## [DOMAIN 03: 타임라인 렌더링 엔진 명세 (Timeline Specification)]

141. **배지 속성**: `install_complete` 시 테마 `brand`, 라벨 `"시공 완료"`. (v124.9 기준)
142. **정보 노출 순서**: 일시 -> 담당 -> 주소 -> 전화 -> 시공(상품) -> 사용(소모품) -> 시공전후 결과 -> 사진.
143. **체크리스트 표시**: 완료 시 `✓` (blue.50, blue.500), 미완료 시 `✕` (red.50, red.500) 표시.
144. **보유 상품 연동**: 고객 상세 헤더의 `ownedProducts` 리스트와 동일한 정규화 패턴(`상품명 x 수량`) 사용.
145. **날짜 포맷**: 연월일-시분 사이 공백 2칸 강제.

---

## [DOMAIN 05: 원자 단위 정밀 명세 (Atomic Truth 100 - Logic & Style Atoms)]

본 섹션은 코드의 바이너리 수준 정합성을 수호하기 위한 100가지 미세 사양입니다.

1. `InstallCompleteForm`의 담당자 선택 플레이스홀더는 `"선택"`임.
2. `TeasyDateTimeInput`의 `limitType`은 `"future"`로 설정되어 미래 선택을 제한함.
3. 주소 입력란 플레이스홀더는 `"전국 시공 주소 입력"`임.
4. 연락처 입력란 플레이스홀더는 `"000-0000-0000"`임.
5. 리스트 아이템(`HStack`) 내 좌우 패딩 `px`는 `3`, 상하 `py`는 `1.5`임.
6. 리스트 아이템의 최소 높이 `minH`는 `36px`임.
7. 아이템 배경색은 `"white"`, 테두리는 `"1px solid gray.100"`임.
8. 드래그 핸들(`MdDragHandle`)의 크기는 `18` 소수점 없는 정수임.
9. 순번용 원문자 글자색은 `"brand.500"`, 폰트 두께는 `"bold"`임.
10. 수량 배지(`Badge`)의 배경색은 `"purple.50"`, 글자색은 `"purple.700"`임.
11. 수량 배지의 높이 `h`는 `20px`, 글자 크기는 `11px`임.
12. 수량 배지의 최소 너비 `minW`는 `24px`이며 중앙 정렬됨.
13. 수량 배지 모서리 반경은 `"sm"`, 폰트 두께는 `700`임.
14. 수량 제어용 `IconButton`의 `size`는 `"xs"`, `variant`는 `"ghost"`, `colorScheme`은 `"gray"`임.
15. 자동 추가 물량 구분 선의 컬러는 `"purple.200"`, 스타일은 `"dashed"`임.
16. 시공 전/후 라벨 우측 `✓` 아이콘 색상은 `"gray.400"`임.
17. `TeasyTextarea`의 `size`는 `"sm"`, 배경색은 `"gray.50"`임.
18. `incompleteReason` 입력란 좌측 패딩 `pl`은 `3`임.
19. `PhotoGrid` 부모 컨테이너의 테두리 스타일은 `"dashed"`, 컬러는 `"gray.200"`임.
20. `PhotoGrid` 부모 컨테이너의 모서리 곡률은 `"xl"`, 패딩은 `4`임.
21. 사진 업로드 시 중복 체크 키는 `file.name + file.size` 조합임.
22. 사진 한도(`INSTALL_COMPLETE_CONSTANTS.MAX_PHOTOS`) 수치는 `15`로 고정됨.
23. 토스트 알림 성공 시 노출 위치는 `"top"`, 지속 시간은 `2000ms`임. (v124.7)
24. 데이터 상속 시 `find` 조건은 `a.type === "install_schedule"` 임.
25. 날짜 기본 포맷: `YYYY-MM-DD  HH:mm` (공백 2칸).
26. 재고 정산 시 `delta`가 양수이면 `install_recovery` 입고 로그 생성.
27. 보유 상품(`ownedProducts`) 가산 시 `상품명 x 수량` 명칭 정합성 루틴 준수.
28. 트랜잭션 내 `asset_meta` 조회 키는 `meta_name_category` 조합임. (p.masterId 아님)
29. 감사 로그(editLog) 메시지 접미사는 `"[Lock-Verified]"` 임.
30. 페인트 가드 `setTimeout` 지연 시간은 `100ms`임. (v126.3)
31. `InstallCompleteForm.displayName` 속성값은 `"InstallCompleteForm"` 임.
32. 타임라인 대시보드 배지 테마는 `"brand"`, 라벨은 `"시공 완료"` 임.
33. 타임라인 정보 노출 시 날짜-시간 사이 공백 2칸 강제.
34. 보유 상품 리스트 정렬 시 `localeCompare` 기반 가나다순 오름차순 정합성 보장.
35. `Silent Focus Guard` 위치는 `top="-100px"`, `left="-100px"`임. (v126.3)
36. 상담원 `managerRole` 데이터 필드 기록 및 권한 연동 사양 탑재.
37. `updatedAt` 필드는Firestore 서버의 `serverTimestamp()` 사용.
38. 활동 문서 `type` 필드값은 `"install_complete"` 임.
39. `StandardReportForm`과 일자 입력 필드 UI 물리 사양 1:1 정합성 유지.
40. `useInstallCompleteForm` 훅의 `submit` 함수는 `runTransaction`을 원자적으로 수행함.
41. 폼 하단 버튼 그룹의 `TeasyButton` 명칭은 `"저장"`과 `"취소"`임.
42. `isSaving` 상태 시 저장 버튼은 `isLoading={true}` 속성 가짐.
43. `incompleteReason` 자동 초기화는 모든 업무 리스트의 `completed` 상태 확인 시 수행.
44. `getTeasyStandardFileName` 엔진 호출 시 `category` 명칭은 `"시공_완료"` 전달.
45. `StandardReportForm`과의 정합성을 위해 일자 입력 필드 규격 통일.
46. 활동 문서 내 `customerName` 필드는 가시성 확보 및 검색을 위해 포함됨.
47. `isLoading` 오버레이 배경 블러 강도는 `2px`, `zIndex`는 `20`임.
48. `Silent Focus Guard` 박스는 `pointerEvents="none"`, `opacity={0}` 처리됨.
49. `handleUpdateQty` 시 상품 수량과 연동된 소모품 수량의 실시간 동기화 정합성 준수.
50. `queryClient` 무효화 전 `500ms` 인덱싱 대기 시간 강제.
51. 활동 삭제 시 `restoredOutflow`는 삭제되는 `assets` 로그의 `lastOutflow`를 기준으로 함.
52. `InstallCompleteForm` 컴포넌트 내부의 모든 `VStack` 정렬은 `stretch` 임.
53. 폼 내부 `HStack`의 기본 `spacing`은 `4`임.
54. 모든 입력 필드의 `fontSize`는 `"sm"` 규격 준수.
55. 브라우저 타임존과 관계없이 한국 표준시 기준으로 데이터 정규화.
56. `getTeasyStandardFileName` 엔진에서 파일 확장자는 대문자로 통일. (v124.9)
57. `ThinParen` 컴포넌트는 모든 파일 목록에서 공통 적용됨.
58. 활동 삭제 후 복원 기능 없으며 물리적 완전 삭제 수행.
59. 3영업일 수정 제한 가드는 `isWithinBusinessDays` 유틸리티 기반임.
60. 마스터 권한 보유 유저는 `userData.role === 'master'` 판별 로직으로 우회함.
61. 활동 문서 내 `lastOperator`는 선택된 담당자 이름임.
62. `createdBy`는 활동 저장자의 `uid` 임.
63. 활동 문서 내 `customerAddress` 중복 기록 사양 보유.
64. 트랜잭션 내 `customerRef` 업데이트 시 `lastConsultDate` 필드 반영 보장.
65. `isSaving` 변수는 `useState(false)`로 초기화되어 `setIsLoading`으로 관리됨.
66. 이미지 업로드 시 `uniquePending` 로직을 통해 동일 파일의 동시 업로드 원천 차단.
67. `URL.createObjectURL` 사용 시 `removePhoto` 핸들러에서 `revokeObjectURL` 호출.
68. 상담원 정보 매칭 시 `managerOptions` 에서 `value`와 `label`을 정확히 추출.
69. `incompleteReason` 입력란은 미완료 항목 존재 시에만 조건부 렌더링됨.
70. `PhotoGrid` 내부 `onRemoval` 시 실제 클라우드 URL이면 삭제 큐에 적치.
71. 재고 정산 입출고 로그의 `editLog`는 고객 명칭과 사유를 상세 기술함.
72. `StandardReportForm` 과의 일시 입력 필드 물리적 디자인 및 높이 규격 통일.
73. 폼 내부의 `FormControl`은 `Box`로 래핑되어 일관된 간격 유지.
74. `composition` 파싱 엔진은 원문자 및 곱셈 기호 `×` 완벽 대응함.
75. `handleUpdateQty` 시 수량 1 미만 차단 가드 루틴 보유.
76. 활동 삭제 시 `window.confirm` 메시지 출력 정합성 준수.
77. 삭제 성공 후 토스트 상태는 `"info"`임.
78. `assets` 문서의 `type` 필드값은 `"inventory"` 고정임.
79. 정산 입고 시 `as_recovery` 가 아닌 `install_recovery` 타입 사용.
80. 정산 출고 시 `as_extra_outflow` 가 아닌 `install_extra_outflow` 타입 사용.
81. `PerformSelfHealing`은 재고 정합성 복구를 위한 백그라운드 엔진임.
82. 타임라인 로딩 스켈레톤의 `noOfLines`는 `3`임.
83. `ProductListItem` 리오더 드래그 중 배경색은 `brand.50` 호버 스타일 유지.
84. `InstallCompleteForm` 은 리포트 폼 중 유일하게 `ownedProducts` 업데이트 권한을 가짐.
85. 시공 전/후 업무 체크리스트는 `tasksBefore` 및 `tasksAfter` 배열로 독립 관리됨.
86. 업무 텍스트 정규화 시 `normalizeText` 를 사용하여 불필요한 공백 제거.
87. 메모 필드 `applyColonStandard` 적용 시 `:` 전후 공백 규격 준수.
88. 폼 상단 닫기 `IconButton` 호버 시 배경색은 `gray.100` 임.
89. 재고 메타 업데이트 시 `totalInflow` 또는 `totalOutflow` 필드에 수량 누적 합산.
90. 파일 삭제 성공 시 `triggerTeasyDownload` 비동기 유틸리티의 상호작용성 보존.
91. 전체 기획 명세서의 버전은 `v9.1` 임.
92. 내부 로직의 모든 문자열 비교는 `===` 엄격 비교만 사용함.
93. `InstallCompleteForm` 컴포넌트 파일의 끝은 `"InstallCompleteForm"` 명칭 익스포트임.
94. `StandardReportForm` 정합성을 위해 일자 입력 필드의 로고 및 아이콘 위치 고정.
95. 활동 문서 내 `managerName` 필드는 타임라인 출력의 기준임.
96. 정산 트랜잭션 실패 시 `toast`를 통해 에러 메시지 사용자 노출 보장.
97. 사진 업로드 시 `isCommitment` 플래그는 시공 완료 폼에서는 사용하지 않음.
98. `isLoading` 커버는 모달 컨텐츠 전역에 블러 효과를 부여함.
99. 시공 완료 보고서는 `customer_meta`의 `install_complete` 카운터를 사용함.
100. 100ms 페인트 가드는 모든 리포트 폼 비즈니스 트랜잭션의 물리 전제 조건임.
