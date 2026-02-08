# 방문 A/S 완료 (Visit A/S Complete) 무결점 준수 엔지니어링 명세서 (v10.0 - Final Truth)

본 문서는 리팩토링 시 **비기능적/기능적 변화를 감지하고 원래의 상태로 복원하기 위한 절대적 기준점(Baseline)**입니다. 1번부터 100번까지의 모든 명세는 실제 코드의 바이너리 수준 정합성을 가지며, 리팩토링 후 이 문서와 대조하여 단 하나의 Props나 로직이라도 다를 경우 즉각 수정되어야 합니다.

---

## [DOMAIN 01: UI 물리 엔진 및 스타일링 명세 (Atomic UI / Physics)]

1. **모달 규격**: `TeasyModal` 컴포넌트 사용, `size="lg"` 고정.
2. **포커스 가드(Silent Guard)**: `Box`로 구현, `ref={silentRef}`, `tabIndex={0}`, `position="absolute"`, `top="-100px"`, `left="-100px"`, `opacity={0}`, `pointerEvents="none"`. (v126.3)
3. **로딩 커버 오버레이**: `isLoading` 시 `Flex` 노출, `bg="whiteAlpha.800"`, `zIndex={20}`, `backdropFilter="blur(2px)"`, `borderRadius="md"`. 텍스트 색상 `brand.600`.
4. **스피너 규격**: `Spinner` 사용, `size="xl"`, `color="brand.500"`, `thickness="4px"`. 텍스트 `"처리 중..."` (medium weight).
5. **폼 레이아웃**: `VStack align="stretch" spacing={6}`.
6. **일시 입력**: `TeasyDateTimeInput` 사용, `limitType="past"` (과거 및 현재만 가능).
7. **담당자 선택**: `CustomSelect` 사용, `placeholder="담당자 선택"`.
8. **방문 주소**: `TeasyInput` 사용, `placeholder="방문 주소 입력"`. `normalizeText` 적용.
9. **연락처 입력**: `TeasyPhoneInput` 사용. `formatPhone` 자동 상속.
10. **유형 표시**: `TeasyInput` 사용, `isReadOnly` 고정. `placeholder="확정 데이터 대기 중"`.
11. **상품/물품 선택**: `CustomSelect` 사용. 선택 시 `value=""` 즉시 초기화. `flex={1.2}` 비율 적용.
12. **아이템 컨테이너**: `HStack justify="space-between" bg="white" px={3} py={1.5} minH="36px" borderRadius="md" shadow="xs" border="1px solid" borderColor="gray.100" transition="all 0.2s"`.
13. **드래그 핸들**: `MdDragHandle` (size 18). `p={1}`. 호버 시 `bg="gray.100", color="gray.400"`. 액티브 시 `cursor: "grabbing"`.
14. **수량 배지**: `Badge bg="purple.50" color="purple.700" fontSize="11px" px={1} h="20px" minW="24px" borderRadius="sm" fontWeight="700" display="flex" alignItems="center" justifyContent="center"`.
15. **수량 제어**: `IconButton size="xs" variant="ghost" colorScheme="gray"`. `MdRemove`, `MdAdd` 배포. `aria-label` 포함.
16. **체크리스트 구역**: 점검 증상과 수행 결과를 분리하여 관리. 각 구역 독립적인 `incompleteReason` 입력란 보유. 헤더 체크 표시(`✓`) `mt="-1"`.
17. **체크박스 규격**: `Checkbox colorScheme="brand"`. 모두 체크 시 하단 사유 필드 자동 파기.
18. **파일 버튼 배지**: `Badge as="button" bg="gray.100" color="gray.500" fontSize="10px" px={2} h="18px" borderRadius="15%" fontWeight="600" textTransform="none"`. 호버 시 `bg="gray.500", color="white"`.
19. **확약서 섹션**: `TeasyFormLabel` 옆에 `(2장 필수)` 텍스트 명기 (fontWeight 400, ml=1).
20. **사진 그리드**: `PhotoGrid` 사용. `Box p={4} border="1px dashed" borderColor="gray.200" borderRadius="xl" bg="white"`. 호버 시 `bg="gray.200"`.
21. **토스트 알림**: 순서 변경 시 `1500ms`, 성공 시 `2000ms`, `position="top"`.

---

## [DOMAIN 02: 비즈니스 로직 및 런타임 명세 (Logic / Engine)]

101. **페인트 가드 (Paint Guard - 100ms)**: 제출 트랜잭션 전 `100ms` 지연을 통해 UI 로딩 상태 렌더링 보장. (v126.3)
102. **수정/삭제 제한 가드 (Surgical Guard)**: 작성 후 **3영업일**이 경과한 경우 수정 및 삭제 불가 (`isWithinBusinessDays` 유틸 사용). 마스터 우저 예외.
103. **데이터 상속 (Inheritance)**: `activities.reverse()` 탐색. `as_schedule` 주소, 전화, 담당자, 유형, 상품, 증상, 업무 일괄 자동 상속. 부재 시 `customer` 정보 폴백.
104. **증상/업무 객체 정규화**: 문자열 배열 유입 시 `{ text: s, completed: false }` 객체 구조로 강제 변환.
105. **정규식 엔진**: 파일명 생성 시 `[\s\u00A0\u1680\u180e\u2000-\u200a\u202f\u205f\u3000\ufeff]` 공백 치환 패턴 사용.
106. **재고 정산 엔진 (Settlement & Atomic Memory State)**:
    - **Atomic Transaction**: 트랜잭션 내에서 `MetaTracker`를 통해 예약 자산(Schedule)과 실제 사용량(Actual)의 차이를 계산하고, 기존 자산 복구(Rollback)와 신규 정산(Settlement)을 원자적으로 수행.
    - **MetaTracker**: `Map<MetaID, { ref, data, deltaStock, deltaOutflow, deltaInflow }>` 구조로 메모리 상에서 모든 변동을 추적.
    - **Delta Logic**: `delta = 예약량 - 실제사용량`.
    - `delta > 0`: `as_recovery` (현장 회수 입고).
    - `delta < 0`: `as_extra_outflow` (현장 추가 출급).
    - **수정 안전성**: 기존 정산을 완전히 롤백(Rollback)한 후 신규 정산 값을 반영.
107. **차감 키 정합성**: `meta_${name}_${category}` 패턴 사용 (슬래시 `/`는 언더바 `_`로 치환).
108. **유형별 첨부파일 필수 검증**:
    - `이전 시공`: 확약서 2장 이상 필수 (`commitmentFiles.length < 2`).
    - `방문 수거`: 수거 전 동영상 필수 (`collectionVideo` null 체크).
    - `방문 재설치`: 설치 후 동영상 필수 (`reinstallationVideo` null 체크).
109. **확약서 인덱싱 루틴**: `/_(\d+)$/` 정규식으로 기존 인덱스 추출 후 빈 번호 채우기. 파일명 생성 시 `Math.max(2, ...)` 적용.
110. **원자적 잠금 (Atomic Lock)**: 제출 시 `isSubmitting.current` Ref 활용하여 이중 클릭 원천 차단.
111. **메모리 최적화**: 파일 삭제 및 수정 시 `URL.revokeObjectURL` 호출 필수.
112. **중복 업로드 방지**: 사진 업로드 시 `file.name + file.size` 키 조합으로 중복 검증.
113. **무결성 복구 (Self-Healing)**: 저장/삭제 성공 시 백그라운드에서 `performSelfHealing` 실행.

---

## [DOMAIN 03: 타임라인 렌더링 엔진 명세 (Timeline Specification)]

141. **정보/메모 비율**: 60:40 구조 (`flex: 3` vs `flex: 2`).
142. **날짜 포맷**: `YYYY-MM-DD  HH:mm` (공백 2칸 강제). 기호 `/`는 `-`로 치환.
143. **체크리스트 시각화**: 
    - 완료: `✓` 박스 (blue.50, blue.500), `fontWeight="900"`, `15x15` 사이즈.
    - 미완료: `✕` 박스 (red.50, red.500), `fontWeight="900"`.
144. **사유 배지**: `"사유"` 텍스트, `red.50` 배경, `red.500` 글자. 높이 `18px`. 좌측 패딩 `pl="56px"`.
145. **동영상 확인 버튼**: 비디오 파일 리스트에서는 '확인' 버튼 은닉 (`showConfirm={false}`).

---

## [DOMAIN 05: 원자 단위 정밀 명세 (Atomic Truth 100 - Logic & Style Atoms)]

1. `AsCompleteForm`의 담당자 선택 플레이스홀더는 `"담당자 선택"`임.
2. `TeasyDateTimeInput`의 `limitType`은 `"past"`로 고정되어 과거/현재만 선택 가능함.
3. 방문 주소 입력란의 플레이스홀더는 `"방문 주소 입력"`임.
4. 물품(소모품) 추가용 `CustomSelect`의 플레이스홀더는 `"물품 추가"`임.
5. 리스트 아이템 내부 `MdDragHandle`의 사이즈는 `18`임.
6. 드래그 핸들 호버 시 `bg`는 `"gray.100"`, `color`는 `"gray.400"`으로 변함.
7. 소모품 수량 배지(`Badge`)의 `bg`는 `"purple.50"`, `color`는 `"purple.700"`임.
8. 수량 배지의 `fontSize`는 `11px`, `h`는 `20px`, `minW`는 `24px`임.
9. 수량 배지의 모서리 곡률(`borderRadius`)은 `"sm"`임.
10. 수량 배지의 폰트 두께(`fontWeight`)는 `700`임.
11. 수량 조절 버튼(`MdRemove`, `MdAdd`)의 `IconButton size`는 `"xs"`임.
12. 수량 조절 버튼의 `variant`는 `"ghost"`, `colorScheme`은 `"gray"`임.
13. 체크리스트 헤더의 체크 표시(`✓`) 폰트 크기는 `11px`임.
14. 체크리스트 헤더의 `color`는 `"gray.400"`, 우측 여백 `pr`은 `5.5`임.
15. 체크박스(`Checkbox`)의 `colorScheme`은 `"brand"`임.
16. 미수행 사유 입력란 `TeasyTextarea`의 `size`는 `"sm"`, 좌측 패딩 `pl`은 `3`임.
17. 파일 리스트 아이템(`FileRow`)의 패딩은 `p={1}`임.
18. 파일명 표시 `Box`의 폰트 크기는 `xs`, 색상은 `"gray.600"`임.
19. 파일 버튼 배지의 `bg`는 `"gray.100"`, `color`는 `"gray.500"`임.
20. 파일 버튼 배지의 `fontSize`는 `10px`, `h`는 `18px`, `borderRadius`는 `"15%"`임.
21. 파일 버튼 배지의 `fontWeight`는 `600`, `textTransform`은 `"none"`임.
22. 파일 액션 구분선(`/`)의 색상은 `"gray.300"`, 폰트 크기는 `10px`임.
23. 파일 버튼 호버 시 `bg`는 `"gray.500"`, `color`는 `"white"`임.
24. 파일 삭제 버튼 호버 시 `bg`는 `"red.400"`임.
25. 확약서 섹션 `TeasyFormLabel` 우측 텍스트는 `"(2장 필수)"`이며 `fontWeight`는 `400`임.
26. 업로드 버튼 배지의 높이 `h`는 `32px`, 모서리 곡률은 `10px`임.
27. 업로드 버튼 배지의 `border`는 `"1px solid"`, `borderColor`는 `"gray.200"`임.
28. 사진 그리드 부모 `Box`의 테두리는 `"1px dashed"`, 컬러는 `"gray.200"`임.
29. 사진 그리드 모서리 곡률은 `"xl"`임.
30. 참고 사항 `TeasyTextarea`의 최소 높이 `minH`는 `"120px"`임.
31. 토스트 알림의 노출 위치는 `"top"`으로 고정됨.
32. `activities` 역순 조회 시 `find` 조건은 `a.type === "as_schedule"`임.
33. 상속 데이터 중 연락처가 없을 시 `customer.phone`으로 폴백함.
34. 주소 상속 시 `customer.address`를 최후의 수단으로 사용함.
35. `symptoms` 및 `tasks` 문자열 유입 시 `{ text: s, completed: false }` 객체화 로직 필수.
36. `handleSubmit` 시 `isSubmitting.current`를 통한 원자적 잠금 수행. (v126.3)
37. 수량 하한 가드 작동 시 `window.confirm` 메시지는 `"항목을 삭제하시겠습니까?"`임.
38. `incompleteReason` 자동 초기화는 `every` 검증 함수를 기반으로 동작함.
39. 사진 중복 체크 키는 `file.name + file.size` 조합임.
40. 파일명 생성 시 `getTeasyStandardFileName` 엔진에 `activityDate`를 시드로 전달.
41. 확약서 총 갯수(`finalTotal`) 계산 시 `Math.max(2, ...)` 적용으로 접미사 보장.
42. `이전 시공` 유형 시 `commitmentFiles.length < 2` 조건으로 유효성 검사 차단.
43. `방문 수거` 유형 시 `collectionVideo` 존재 여부(null 체크) 검증 필수.
44. `방문 재설치` 유형 시 `reinstallationVideo` 존재 여부 검증 필수.
45. 스토리지 최상위 경로는 `activities/as_complete` 임.
46. 파일명 생성 시 `Date.now()`와 `Math.random()` 조합으로 물리적 고유성 확보.
47. 재고 정산 시 소모품 `delta`는 `예약량 - 실제사용량`임.
48. `delta > 0`인 경우 `as_recovery` 타입의 입고 로그 생성.
49. `delta < 0`인 경우 `as_extra_outflow` 타입의 출급 로그 생성.
50. 정산 트랜잭션 내 `asset_meta` 조회 시 `meta_${item.name}_${item.category}` 키 사용.
51. 감사 로그(editLog) 패턴은 `"A/S 정산: ... [Lock-Verified]"` 형식을 따름.
52. 리소스 삭제 실패 시 `Promise.allSettled`를 통해 프로세스 중단 방지. (v124.9)
53. 저장 성공 후 `performSelfHealing`은 백그라운드로 안전하게 실행됨.
54. `queryClient` 무효화 전 `500ms`의 인덱싱 대기 시간을 강제함.
55. 삭제 시 복구 수량 `restoredOutflow`는 `Number(asset.data.lastOutflow) || 0`임.
56. 타임라인 카드의 정보 영역 `flex` 비율은 `3`임.
57. 타임라인 카드의 메모 영역 `flex` 비율은 `2`임.
58. 타임라인 배지 라벨은 `"방문 A/S 완료"`임.
59. 타임라인 점검 품목 라벨은 `"점검"`임.
60. 타임라인 소모품 사용 라벨은 `"사용"`임.
61. 타임라인 수행 결과 라벨은 `"결과"`임.
62. 타임라인 날짜 포맷팅 시 공백 2개 (`YYYY-MM-DD  HH:mm`) 준수.
63. 체크리스트 미완료 아이콘 배경색은 `"red.50"`, 아이콘 색상은 `"red.500"`임.
64. 체크리스트 완료 아이콘 배경색은 `"blue.50"`, 아이콘 색상은 `"blue.500"`임.
65. 미완료 아이콘 박스의 크기는 `15x15`이며 상단 여백은 `4px`임.
66. 미처리 사유 배지 텍스트는 `"사유"`이며 배경은 `"red.50"`, 글자는 `"red.500"`임.
67. 사유 노출 시 좌측 들여쓰기 패딩 `pl`은 `"56px"`임.
68. 동영상 파일 리스트에서 '확인' 버튼은 노출되지 않음 (`showConfirm={false}`).
69. 파일 멀티 다운로드 인터벌은 `200ms`임.
70. `ProductListItem` 리오더 드래그 중 그림자 컬러 규격 준수.
71. 사진 업로드 한도(`AS_COMPLETE_CONSTANTS.MAX_PHOTOS`)는 `15`장임. (v124.9 상향)
72. `Silent Focus Guard` 위치는 `top="-100px"`, `left="-100px"`임. (v126.3)
73. 상담원 정보 업데이트 시 `managerRole` 데이터 필드 기록 사양 포함.
74. `updatedAt` 필드는Firestore 서버의 `serverTimestamp()` 사용.
75. `asType`은 `Schedule` 활동의 명칭을 1:1로 상속함.
76. `handleUpdateQty` 함수 내에서 수량이 0이 될 때만 삭제 `confirm` 호출.
77. `incompleteReason`은 `{ symptom: string, task: string }` 분리 관리 구조임.
78. 비디오 업로드 시 `collection_video` 또는 `reinstall_video` 경로 분기 처리.
79. 트랜잭션 내 `customerRef` 업데이트 시 `lastConsultDate` 필드 갱신 보장.
80. 폼 로딩 시 `silentRef.current.focus()`를 통한 포커스 트래핑 수행.
81. `TeasyModal`의 크기는 `"lg"` 고정임.
82. 활동 삭제 후 복구 수량은 삭제된 `assets` 로그의 `lastOutflow`를 기준으로 함.
83. `StandardReportForm`과 일자 입력 필드 UI 물리적 정합성 100% 일치.
84. `useAsCompleteForm`의 반환값 중 `isLoading`으로 폼 전체 필드 비활성화 제어.
85. `getCircledNumber`는 1부터 20까지 지원하며 타임라인 내 번호 매기기에 사용됨.
86. `AsCompleteForm`의 `forwardRef` 명칭은 `"AsCompleteForm"`임.
87. 전체 명세의 버전은 `v10.0` 임.
88. 내부 로직의 모든 문자열 비교는 `===` 엄격 비교만 사용함.
89. 점검 항목 토글 시 `completed` 상태값은 불리언(`boolean`) 타입임.
90. 파일 삭제 시 `URL.revokeObjectURL`을 통한 메모리 누수 방지 로직 포함.
91. 확약서 파일명 생성 시 `finalTotal` 인자에 합산된 파일 갯수 전달.
92. `as_recovery` 입고 로그 시 `lastInflow` 필드에 양수만 기록.
93. `as_extra_outflow` 출급 로그 시 `lastOutflow` 필드에 절댓값 기록.
94. 타임라인 내 ‘미처리 사유’ 노출 시 세로 정렬(Vertical Alignment) 규격 준수.
95. `AS_COMPLETE_CONSTANTS.TYPE`은 `"as_complete"`임.
96. 100ms 페인트 가드는 모든 비즈니스 트랜잭션의 공통 지연 사양임. (v126.3)
97. 3영업일 수정 제한 로직 성공 시 토스트 메시지 제목은 `"저장 불가"` 임.
98. 마스터 우저는 `userData.role === 'master'`로 판별함.
99. `InquiryFile` 타입 인터페이스는 `types/domain.ts`에 정의됨.
100. 방문 A/S 완료 폼은 시스템 내에서 가장 복잡한 정산 및 첨부파일 로직을 보유함.
