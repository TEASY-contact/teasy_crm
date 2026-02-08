# 시연 완료 (Demo Complete) 무결점 준수 엔지니어링 명세서 (v10.0 - Final Truth)

본 문서는 리팩토링 시 **비기능적/기능적 변화를 감지하고 원래의 상태로 복원하기 위한 절대적 기준점(Baseline)**이 되며, 1번부터 100번까지의 명세는 코드의 바이너리 수준 정합성을 가집니다.

---

## [DOMAIN 01: UI 물리 엔진 및 스타일링 명세 (Atomic UI / Physics)]

1. **모달 규격**: `TeasyModal` 사용, `size="lg"` 고정.
2. **포커스 가드(Silent Guard)**: `Box`로 구현, `ref={silentRef}`, `tabIndex={0}`, `position="absolute"`, `top="-100px"`, `left="-100px"`, `opacity={0}`, `pointerEvents="none"`. (v126.3)
3. **로딩 커버 오버레이**: `isLoading` 시 `Flex` 노출, `bg="whiteAlpha.800"`, `zIndex={20}`, `backdropFilter="blur(2px)"`, `borderRadius="md"`.
4. **스피너 규격**: `Spinner` 사용, `size="xl"`, `color="brand.500"`, `thickness="4px"`. 텍스트 `"처리 중..."`.
5. **폼 레이아웃**: `VStack align="stretch" spacing={6}`.
6. **완료 일시**: `TeasyDateTimeInput` 사용, `limitType="past"` (과거 기록 원칙).
7. **담당자 선택**: `CustomSelect` 사용, `placeholder="선택"`. 옵션 `managerOptions`.
8. **방문 주소**: `TeasyInput` 사용, `placeholder="입력"`. `normalizeText` 적용.
9. **연락처 입력**: `TeasyPhoneInput` 사용, `placeholder="000-0000-0000"`.
10. **시연 상품 선택**: `CustomSelect` 사용, `placeholder="선택"`. 옵션 `products`.
11. **시연 결과 선택**: `CustomSelect` 사용, `placeholder="선택"`. (`RESULTS` 옵션: 구매의향 높음/보통/낮음 3종).
12. **할인 제안 선택**: `CustomSelect` 사용, `placeholder="선택"`. (`DISCOUNT_TYPES` 옵션: 현금 할인, 네이버 쿠폰 등).
13. **금액 입력 필드**: `discountType === "현금 할인"` 시 노출. `TeasyFormLabel sub`와 `TeasyInput` 조합.
14. **쿠폰 선택 필드**: `discountType === "네이버 쿠폰"` 시 노출. `CustomSelect` (`NAVER_COUPONS` 옵션).
15. **참고 사항**: `TeasyTextarea` 사용, `placeholder="입력"`. `applyColonStandard` 적용.
16. **견적서 섹션**: `TeasyFormGroup p={2}` 내부 `ReportFileList` 연동.
17. **견적서 업로드 버튼**: `Badge as="button" w="full" h="32px" bg="gray.100" color="gray.600" border="1px solid" borderColor="gray.200" borderRadius="10px" fontSize="xs" fontWeight="600"`.
18. **사진 그리드**: `PhotoGrid` 사용. `Box p={4} border="1px dashed" borderColor="gray.200" borderRadius="xl" bg="white"`.
19. **유니버셜 뷰어**: `TeasyUniversalViewer` 연동 (인덱스 동기화 로직 포함).
20. **토스트 알림**: 성공 시 `3000ms`, `position="top"`.

---

## [DOMAIN 02: 비즈니스 로직 및 런타임 명세 (Logic / Engine)]

101. **데이터 상속 (v124.81)**: 신규 작성 시 `activities`를 역순 조회하여 마지막 `demo_schedule` 데이터(`manager`, `location`, `phone`, `product`)를 자동으로 폼 초기값에 주입.
102. **날짜 기본값**: 현재 시각 기반 `YYYY-MM-DD  HH:mm` (공백 2칸) 포맷 생성.
103. **현금 할인 포맷팅**: 숫자 외 문자 제거 후 `Intl.NumberFormat` 적용, 접두사 `-` 강제 부여 (예: `-10,000`).
104. **페인트 가드 (Paint Guard - 100ms)**: 제출 트랜잭션 전 `100ms` 지연을 통해 로딩 UI 활성화 보장. (v126.3)
105. **수정/삭제 제한 가드 (Surgical Guard)**: 작성 후 **3영업일**이 경과한 경우 수정 및 삭제 불가 (`isWithinBusinessDays` 사용). (v126.93)
106. **권한 예외 (Master Bypass)**: `role === 'master'` 유저는 3영업일 제한에 구애받지 않고 모든 활동 수정 가능.
107. **사진 한도 및 중복 방지 (v124.76)**: 최대 **15장** (`DEMO_CONSTANTS.MAX_PHOTOS`). 저장 전 Base URL 비교를 통한 지문 기반 사진 중복 저장 차단 엔진 작동.
108. **견적서 명명 규칙**: `getTeasyStandardFileName(customer.name, '견적', date)` 엔진 사용. 확장자는 대문자로 통일.
109. **리소스 물리 파기 (Physical Cleanup)**: 사진/견적서 삭제 시 Firebase Storage에서 실제 파일을 `deleteObject`로 즉각 제거하여 스토리지 낭비 방지.
110. **시퀀스 동기화 (Core Sync)**: 활동 생성 시 마지막 `demo_schedule`의 `sequenceNumber`를 상속받아 타임라인 상의 논리적 그룹핑 정합성 유지. (v124.81)
111. **필수 검증 (제출)**: 담당자, 상품, 결과, 할인 종류 필수 선택.
112. **쿼리 동기화 (500ms Delay)**: 저장/삭제 성공 시 500ms 지연 후 `activities`, `customer`, `customers` 쿼리 캐시 일괄 무효화. (v123.03)

---

## [DOMAIN 03: 타임라인 렌더링 엔진 명세 (Timeline Specification)]

141. **배지 속성**: `demo_complete` 시 테마 `purple`, 라벨 `"시연 완료"`. (v123.70)
142. **정보 노출 순서**: 일시 -> 담당 -> 주소 -> 전화 -> 상품 -> 결과 -> 할인 -> 견적서 -> 사진.
143. **할인 표시**: `discountType`과 `discountValue` 결합 출력.
144. **견적서 표시**: `"견적"` 라벨 사용. 파일 리스트 `showConfirm={true}` (확인 버튼 노출).
145. **사진 표시**: `"사진"` 라벨 사용.
146. **날짜 포맷**: 연원일-시분 사이 공백 2칸 강제. (`YYYY-MM-DD  HH:mm`)

---

## [DOMAIN 05: 원자 단위 정밀 명세 (Atomic Truth 100 - Logic & Style Atoms)]

1. `DemoCompleteForm`의 담당자 선택 플레이스홀더는 `"선택"`임.
2. `TeasyDateTimeInput`의 `limitType`은 `"past"`로 설정되어 있음.
3. 방문 주소 입력란 플레이스홀더는 `"입력"`임.
4. 연락처 입력란 플레이스홀더는 `"000-0000-0000"`임.
5. 시연 결과(`result`) 선택 플레이스홀더는 `"선택"`임. (옵션: 구매의향 높음/보통/낮음)
6. 할인 제안(`discountType`) 선택 플레이스홀더는 `"선택"`임.
7. 할인 금액 입력란 `TeasyFormLabel`의 `sub` 속성값이 `true`임.
8. 견적서 업로드 버튼 배지의 높이 `h`는 `32px`, 너비 `w`는 `"full"`임.
9. 업로드 버튼 배지 배경색은 `"gray.100"`, 테두리는 `"1px solid gray.200"`임.
10. 업로드 버튼 배지 모서리 곡률 `borderRadius`는 `"10px"`임.
11. 업로드 버튼 배지 폰트 크기는 `xs`, 두께는 `600`임.
12. 사진 그리드 부모 `Box`의 테두리는 `"1px dashed"`, 컬러는 `"gray.200"`임.
13. 사진 그리드 모서리 곡률은 `"xl"`, 패딩은 `4`임.
14. 토스트 알림 성공 시 노출 위치는 `"top"`, 지속 시간은 `3000ms`임.
15. `getTeasyStandardFileName` 엔진에 `category` 값으로 `"견적"` 전달.
16. `isLoading` 오버레이 배경색은 `whiteAlpha.800`, 블러 `2px`임. (v126.3)
17. 스피너 굵기 `thickness`는 `4px`, 색상은 `"brand.500"`임.
18. `Silent Focus Guard` 위치는 `top="-100px"`, `left="-100px"`임.
19. 신규 작성 시 `activities.reverse().find(a => a.type === "demo_schedule")` 로직 작동.
20. `sequenceNumber` 상속 시 예약 데이터가 없으면 가용한 다음 시퀀스로 부여.
21. 현금 할인 입력 시 실시간 숫자 외 문자 제거 정규식: `/[^0-9]/g`.
22. 금액 실시간 포맷팅 접두사 `-` 강제 결합: `-${Intl.NumberFormat().format(num)}`.
23. `discountType` 변경 시 `discountValue` 즉시 초기화 핸들러 탑재.
24. `DEMO_CONSTANTS.MAX_PHOTOS` 값은 `15`임.
25. 사진 중복 체크 로직: 작성 중인 `pendingFiles` 내 `file.name + file.size` 비교.
26. 제출 시 `isSubmitting.current` Ref를 통한 중복 저장 원천 차단.
27. 페인트 가드 `setTimeout` 지연 시간은 `100ms`임. (v126.3)
28. 스토리지 최하위 경로 규칙: `site_photos/${customerId}/` 임.
29. `cleanupOrphanedPhotos` 함수는 유실된 자원을 `Promise.allSettled`로 일괄 정리함.
30. `DemoCompleteForm.displayName` 속성값은 `"DemoCompleteForm"` 임.
31. 타임라인 배지 테마 컬러는 `"purple"` 임. (v123.70)
32. 타임라인 배지 라벨은 `"시연 완료"` 임.
33. 타임라인 정보 노출 시 날짜-시간 사이 공백 2칸 강제.
34. 타임라인 견적서 파일 리스트의 `showConfirm` 속성은 `true`임.
35. 타임라인 사진 라벨은 `"사진"` 임.
36. 상담일 업데이트 시 고객 문서의 `lastConsultDate` 필드를 `formData.date`로 갱신함.
37. 자산 연동 로직은 본 보고서 시점에서는 기록용으로만 사용됨.
38. 담당자 `CustomSelect` 옵션은 `managerOptions` 임.
39. 시연 상품 `CustomSelect` 옵션은 `products` 메타데이터임.
40. 할인 제안 옵션 리스트 상수는 `DISCOUNT_TYPES` 임.
41. 할인 제안 내 `"네이버 쿠폰"` 명칭은 코드의 `CustomSelect` 옵션과 일치함.
42. 주소/연락처 상속 실패 시 빈 문자열을 초기값으로 사용.
43. `useDemoCompleteForm` 유도 훅은 `onClose` 성공 여부를 불리언으로 반환.
44. 폼 하단 버튼 그룹의 `TeasyButton` 명칭은 `"저장"`과 `"취소"`임.
45. `isLoading` 상태일 때 저장 버튼에 로딩 스피너 및 비활성화 적용.
46. `updatedAt` 필드는 항상 서버 타임스탬프(`serverTimestamp()`) 사용.
47. 활동 문서 `type` 필드값은 `"demo_complete"` 임.
48. 활동 문서 내 `typeName` 필드값은 `"시연 완료"` 임.
49. `normalizeText`는 저장 시 주소 및 상품명 텍스트 정제에 사용됨.
50. `applyColonStandard`는 메모 필드 텍스트 정제 표준임.
51. 파일 뷰어 `TeasyUniversalViewer`는 모달 내부 종속적으로 렌더링됨.
52. 사진 그리드 내부 `onRemoveClick` 시 실제 URL이면 클린업 대상 배열에 적치.
53. 폼 내부 모든 `VStack` 정렬은 `stretch` 임.
54. `Silent Focus Guard` 박스는 `pointerEvents="none"` 처리됨.
55. 견적서 파일 업로드 시 `Math.random().toString(36)` 기법으로 임시 ID 할당.
56. `ReportFileList` 컴포넌트 호출 시 `type="quote"` 속성 전달.
57. 사진 그리드 내 삭제 버튼 클릭 시 `window.confirm` 메시지 출력 로직.
58. 제출 성공 시 `invalidateQueries`는 최소 3곳(`activities`, `customer`, `customers`)에 실행.
59. `DemoCompleteForm` 컴포넌트의 루트 엘리먼트는 `Box` 임.
60. 담당자 필드 읽기 전용 시 `managerOptions.find(o => o.value === manager)?.label` 패턴 사용.
61. `discountValue` 필드 렌더링 조건: `discountType === "현금 할인" || discountType === "네이버 쿠폰"`.
62. 금액 관련 포맷팅 라이브러리는 `Intl.NumberFormat` 표준 엔진 사용.
63. 타임라인 날짜 표시 형식: `YYYY-MM-DD  HH:mm` (공백 2칸).
64. 견적서 업로드 한도 도달 시 버튼 클릭 원천 차단 및 토스트 알림.
65. `useReportMetadata`를 통해 실시간 매니저 옵션(권한 포함) 수신.
66. 활동 문서 내 `createdBy`는 활동 저장자의 `uid` 임.
67. 매니저 이름은 활동 문서의 `managerName` 필드에 기록됨.
68. 사진 그리드 내부 `framer-motion` 애니메이션 적용 (Layout transition).
69. 폼 전체 컨테이너의 `spacing`은 `6`임.
70. `HStack` 하위 요소 간격 `spacing`은 `4`임.
71. 모든 입력 필드의 `fontSize`는 `"sm"` 규격 준수.
72. `TeasyDateTimeInput`의 `limitType="past"`는 미래 선택 불가(과거/현재만 가능)를 정의함.
73. 삭제 시 `window.confirm` 메시지: `"정말 이 [시연 완료] 보고서를 삭제하시겠습니까?\n첨부된 모든 사진 데이터도 영구히 삭제됩니다."`.
74. 삭제 트랙잭션 성공 시 Storage 자원 정리(`deleteObject`)가 동반됨.
75. 브라우저 언어 설정과 무관하게 `Asia/Seoul` 기준 날짜 문자열 정적 기록.
76. `getTeasyStandardFileName` 엔진에서 파일 확장자는 대문자(`ext.toUpperCase()`)로 변환.
77. `ThinParen` 컴포넌트는 모든 파일 명칭 렌더링 시 공백 처리를 담당함.
78. 타임라인 관리 `STEP_LABELS` 내 `demo_complete` 키값은 `"시연 완료"` 임.
79. 타임라인 관리 `demo_schedule` 키값은 `"시연 확정"` 으로 동기화됨.
80. `TeasyUniversalViewer` 내부 닫기 버튼은 상단 우측 고정임.
81. 활동 문서 내 `managerRole` 필드에 담당자 권한 기록 사양.
82. 활동 수정 3영업일 가드 로직 성공 시 `onClose` 호출.
83. 담당자 선택 안함(`""`) 시 제출 버튼 유효성 검사 차단.
84. `CustomSelect` 드롭다운의 `zIndex`는 모달 내부에서 최상위 유지.
85. 활동 문서 내 `customerName` 필드는 가시성 확보를 위해 포함됨.
86. 트랜잭션 오류 발생 시 `toast`를 통해 에러 메시지 사용자 노출.
87. `isSaving` 변수는 `useDemoCompleteForm` 훅 내부에서 `isLoading`으로 관리.
88. `finalPhotos` 및 `finalQuotes` 배열 빌드 후 최종 트랜잭션 수행.
89. `normalizeText` 유틸리티는 `src/utils/textFormatter.ts`의 `export` 함수임.
90. `applyColonStandard`는 메모 필드 내 콜론(`:`)의 물리적 위치 정합 규격.
91. 폼 내부 `FormControl`의 유효성 검사 순서는 위에서 아래 방향임.
92. `TeasyPhoneInput` 상속값 및 `formatPhone` 적용 규격 준수.
93. 전체 기획 명세서의 버전은 `v10.0` 임.
94. 내부 로직의 비교 연산자는 `!==` 및 `===` 만 사용함.
95. `DemoCompleteForm` 컴포넌트 파일의 끝은 `"DemoCompleteForm"` 명칭 익스포트임.
96. `isReadOnly` 모드 시 사진 추가 및 삭제 버튼은 비노출됨.
97. 타임라인에서 다중 상품인 경우 동그라미 숫자가 자동으로 붙음.
98. `customer_meta` 내 문서 ID는 `${customer.id}_demo` 임.
99. `totalCount` 업데이트 시 `increment(1)` 사용 대신 수동 트랜잭션 계산 보존.
100. `updatedAt` 필드는 Firestore 서버 로컬 타임이 아닌 `serverTimestamp()` 객체임.
