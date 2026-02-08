# 신규 문의 (New Inquiry) 무결점 준수 엔지니어링 명세서 (v9.2 - Final Truth)

본 문서는 리팩토링 시 **비기능적/기능적 변화를 감지하고 원래의 상태로 복원하기 위한 절대적 기준점(Baseline)**입니다. 1번부터 800번까지의 모든 명세는 실제 코드의 바이너리 수준 정합성을 가지며, 리팩토링 후 이 문서와 대조하여 단 하나의 Props나 로직이라도 다를 경우 즉각 수정되어야 합니다.

---

## [DOMAIN 01: UI 물리 엔진 및 스타일링 명세 (Atomic UI / Physics)]

1. **모달 규격**: `TeasyModal` 사용, `size="lg"` 고정.
2. **포커스 가드(Silent Guard)**: `Box`로 구현, `ref={silentRef}`, `tabIndex={0}`, `position="absolute"`, `top="-100px"`, `left="-100px"`, `opacity={0}`, `pointerEvents="none"`. (v126.3)
3. **로딩 커버 오버레이**: `isLoading` 시 `Flex` 노출, `bg="whiteAlpha.800"`, `zIndex={20}`, `backdropFilter="blur(2px)"`, `borderRadius="md"`.
4. **스피너 규격**: `Spinner` 사용, `size="xl"`, `color="brand.500"`, `thickness="4px"`. 텍스트 `"처리 중..."`.
5. **접수 일시**: `TeasyDateTimeInput` 사용, `limitType="future"` (미래 선택 방지).
6. **담당자 선택**: `CustomSelect` 사용, `placeholder="선택"`.
7. **유입 채널 선택**: `CustomSelect` 사용, `placeholder="선택"`. (`전화 문의`, `네이버 톡톡`, `채널톡`, `기타`).
8. **조건부 입력 그룹**: `TeasyFormGroup` 내부 채널별 동적 렌더링.
    - `전화 문의`: `TeasyPhoneInput` 및 `녹취 업로드` 배지 버튼.
    - `네이버 톡톡/채널톡`: `닉네임` 입력을 위한 `TeasyInput`.
    - `기타`: `유입 채널 상세` 입력을 위한 `TeasyInput`.
9. **녹취 업로드 버튼**: `Badge as="button" px={3} h="32px" bg="gray.100" color="gray.600" border="1px solid" borderColor="gray.200" borderRadius="10px" fontSize="xs" fontWeight="600"`.
10. **견적서 업로드 버튼**: `Badge as="button" w="full" h="32px" bg="gray.100" color="gray.600" border="1px solid" borderColor="gray.200" borderRadius="10px" fontSize="xs" fontWeight="600"`.
11. **문의 상품/상담 결과**: `CustomSelect` 사용. `HStack`으로 1:1 배치.
12. **참고 사항**: `TeasyTextarea` 사용, `placeholder="입력"`. `applyColonStandard` 적용.
13. **파일 리스트**: `ReportFileList` 연동 (녹취 및 견적서 분리 표시).
14. **오디오 플레이어**: `TeasyAudioPlayer` 연동.
15. **토스트 알림**: 성공 시 `2000ms`, `position="top"`.

---

## [DOMAIN 02: 비즈니스 로직 및 런타임 명세 (Logic / Engine)]

101. **상태 초기화 (Inheritance)**: 신규 접수 시 `customer.phone` 정보를 `formatPhone` 처리하여 연락처 필드에 자동 상속.
102. **날짜 기본값**: 현재 시각 기반 `YYYY-MM-DD  HH:mm` (공백 2칸) 포맷 생성. (v124.8)
103. **페인트 가드 (Paint Guard - 100ms)**: 제출 트랜잭션 전 `100ms` 지연을 통해 UI 로딩 상태 렌더링을 확실히 보장. (v126.3)
104. **수정/삭제 제한 가드 (Surgical Guard)**: 작성 후 **3영업일**이 경과한 경우 수정 및 삭제 불가 (`isWithinBusinessDays` 유틸 사용). (v126.93)
105. **권한 예외 (Master Bypass)**: `role === 'master'` 권한 보유자는 3영업일 제한에 관계없이 모든 활동 수정 가능.
106. **파일 명명 규칙**: `getTeasyStandardFileName(customer.name, category, date, index, total)` 엔진 사용 및 확장자 수동 보존.
107. **메타 락킹 (Meta-Locking)**: `customer_meta/${customer.id}_inquiry` 문서를 통해 시퀀스 번호 및 전체 개수 관리.
108. **데이터 정합성 (Normalization)**:
    - 연락처: 숫자 외 문자 제거 후 저장 (`replace(/[^0-9]/g, "")`).
    - 텍스트: 닉네임, 상품명에 `normalizeText` 적용.
    - 메모: `:` 전후 공백 규격화를 위해 `applyColonStandard` 적용.
109. **리소스 파기 (Cleanup)**: 삭제 시 Firebase Storage 실물 파일(녹취, 견적서) `deleteObject` 연쇄 수행.
110. **쿼리 동기화 (500ms Delay)**: 저장/삭제 성공 시 500ms 지연 후 `activities`, `customer`, `customers` 쿼리 캐시 일괄 무효화. (v123.03)

---

## [DOMAIN 03: 타임라인 렌더 엔진 명세 (Timeline Specification)]

141. **배지 속성**: `new_inquiry` 시 테마 `purple`, 라벨 `"신규 문의"`.
142. **정보 노출 순서**: 일시 -> 담당 -> 채널(닉네임/연락처 포함) -> 상품 -> 결과 -> 견적서 -> 녹취.
143. **채널 정보 표시**: 
    - 전화: `전화 문의 (010-0000-0000)`
    - 톡톡/채널톡: `네이버 톡톡 (닉네임)`
144. **견적서 렌더링**: `"견적"` 라벨 (`purple.50/600`) 및 `TeasyUniversalViewer` 연동.
145. **녹취 렌더링**: `"녹취"` 라벨 (`teal.50/600`) 및 `TeasyAudioPlayer` 연동.
146. **날짜 포맷**: 연월일-시분 사이 공백 2칸 강제.

---

## [DOMAIN 05: 원자 단위 정밀 명세 (Atomic Truth 100 - Logic & Style Atoms)]

본 섹션은 코드의 바이너리 수준 정합성을 수호하기 위한 100가지 미세 사양입니다.

1. `InquiryForm`의 담당자 선택 플레이스홀더는 `"선택"`임.
2. `TeasyDateTimeInput`의 `limitType`은 `"future"`로 설정되어 미래 선택을 제한함.
3. 유입 채널(`channel`) 선택 플레이스홀더는 `"선택"`임.
4. `전화 문의` 선택 시 `TeasyPhoneInput`이 즉시 렌더링됨.
5. 닉네임(`nickname`) 입력 필드의 플레이스홀더는 `"입력"`임.
6. 닉네임 입력 필드의 `maxLength` 제한은 현재 코드상 명시되어 있지 않음.
7. 녹취 업로드 배지 버튼의 높이 `h`는 `32px`임.
8. 견적서 업로드 배지 버튼의 너비 `w`는 `"full"`, 높이 `h`는 `32px`임.
9. 업로드 배지의 배경색은 `"gray.100"`, 테두리는 `"1px solid gray.200"`임.
10. 업로드 배지의 모서리 곡률 `borderRadius`는 `"10px"`임.
11. 업로드 배지의 폰트 크기는 `xs`, 폰트 두께는 `600`임.
12. 문의 상품/상담 결과 `CustomSelect`의 간격은 `VStack spacing={6}` 내에 위치함.
13. `TeasyAudioPlayer` 파일 목록 내 `ThinParen` 적용은 `ReportFileList` 공통 모듈에서 처리됨.
14. `isLoading` 커버 배경색은 `whiteAlpha.800`, 블러는 `2px`임.
15. 스피너 굵기 `thickness`는 `4px`, 색상은 `"brand.500"`임.
16. `Silent Focus Guard` 위치는 `top="-100px"`, `left="-100px"`임. (v126.3)
17. 채널 변경 시 닉네임 상태 관리 핸들러 로직 탑재.
18. `handleChannelChange` 실행 시 기존 입력값의 정규화(`normalizeText`) 처리는 제출 시점에 확정됨.
19. 문의 결과 옵션 중 `"시연 확정"`은 단순 라벨값으로 저장됨.
20. `InquiryForm.displayName` 속성값은 `"InquiryForm"` 임.
21. 페인트 가드 `setTimeout` 지연 시간은 `100ms`임. (v126.3)
22. `customer.phone` 정보를 연락처 필드로 자동 상속할 때 `formatPhone` 사용.
23. 견적서 업로드 한도 검증 로직: `quotes.length < 1`.
24. 파일 명칭 생성 시 `index`와 `total` 파라미터를 엔진에 전달 (동적 파일명).
25. 닉네임 필드 저장 시 `normalizeText`를 통한 `trim()` 및 공백 정제 수행.
26. 메모 입력란 `applyColonStandard` 적용 시 `:` 전후 공백 규격 준수.
27. `customer_meta` 문서 ID 규칙: `${customer.id}_inquiry`.
28. 파일 삭제 시 `URL.revokeObjectURL`을 통한 메모리 해제 로직 포함.
29. `cleanupStorage` 비동기 함수는 `Promise.allSettled`로 리소스 파기 수행.
30. 저장 성공 후 토스트 알림의 `duration`은 `2000ms`, 노출 위치는 `"top"`임.
31. `TeasyModal` 의 `size`는 `"lg"` 고정임.
32. 타임라인 배지 테마는 `"purple"`, 라벨은 `"신규 문의"` 임.
33. 타임라인 정보 노출 시 날짜와 시간 사이 공백 2칸 강제.
34. 전화 문의 시 타임라인 라벨 패턴: `전화 문의 (010-XXXX-XXXX)`.
35. 닉네임 노출 시 타임라인 라벨 패턴: `채널명 (닉네임)`.
36. `TeasyAudioPlayer`는 모달 형태로 호출 가능함.
37. 연락처 저장 규격: 숫자만 추출 (`replace(/[^0-9]/g, "")`).
38. `useInquiryForm` 훅의 `submit` 함수는 비동기(`async`)로 동작함.
39. `managerOptions` 및 `products` 데이터는 `useReportMetadata`에서 수신함.
40. 문의 채널 옵션: `전화 문의, 네이버 톡톡, 채널톡, 기타`.
41. `TeasyPhoneInput` 초기값 할당 시 `customer.phone` 폴백 루틴 보유.
42. 폼 하단 버튼 그룹의 `TeasyButton` 명함은 `"저장"`과 `"취소"`임.
43. `isLoading` 상태 오버레이의 `zIndex`는 `20`임.
44. 상담일 업데이트 시 고객 문서의 `lastConsultDate` 필드를 `formData.date`로 갱신함.
45. `updatedAt` 필드는Firestore 서버의 `serverTimestamp()` 사용.
46. 활동 문서의 `type` 필드값은 `"inquiry"` 임.
47. `ReportFileList` 내 파일명에서 확장자는 시각적으로 제거됨 (엔진 처리).
48. `Silent Focus Guard`의 `tabIndex`는 `0`, `pointerEvents`는 `"none"`임.
49. `ThinParen` 컴포넌트는 모든 파일 명칭의 괄호 규격화를 담당함.
50. 상담 결과 `CustomSelect` 옵션: `구매 예정, 시연 확정, 시연 고민, 관심 없음`.
51. 견적서 추가 시 `handleFileAdd(files, 'quote')` 호출 및 카운트 검증.
52. 녹취 파일 추가 시 `handleFileAdd(files, 'recording')` 호출 (멀티 업로드 가능).
53. 파일 삭제 시 `handleFileRemove`를 통한 상태 및 메모리 일괄 해제.
54. `InquiryForm` 컴포넌트 내부 텍스트는 `Chakra UI Text` 규격 준수.
55. 타임라인 `"견적"` 라벨 배경색은 `purple.50`, 글자색은 `purple.600`임.
56. 타임라인 `"녹취"` 라벨 배경색은 `teal.50`, 글자색은 `teal.600`임.
57. 활동 저장 성공 시 500ms 지연 후 쿼리 무효화(Indexing 대기).
58. 전화 문의 시 `formatPhone(customer?.phone || "")`을 통한 번호 상속.
59. `useImperativeHandle`로 외부 노출되는 `submit` 함수는 `managerOptions`를 필수로 받음.
60. 모든 파일명 정합성 처리에 `normalizeText` 및 공백 치환 로직 포함.
61. 전체 기획 명세서의 버전은 `v9.2` 임.
62. 내부 로직의 비교 연산자는 `!==` 및 `===` 만 사용함.
63. `isLoading` 커버는 `borderRadius="md"` 곡률 적용됨.
64. 작성 후 3영업일 경과 시 수정 및 삭제 버튼 클릭 시 차단 토스트 노출.
65. 마스터 유저는 활동 문서의 `createdAt`과 관계없이 항상 수정 권한을 가짐.
66. 활동 문서 내 `lastOperator` 필드에 선택된 담당자의 이름 문자열 기록.
67. 닉네임 입력란 `onChange` 시 필터링 없이 정제는 제출 시 수행.
68. `CustomSelect` 드롭다운의 `maxHeight`는 `300px` 규격 준수.
69. 전화 문의 시 파일이 0개인 상태로 제출 불가(Validation).
70. `applyColonStandard`는 메모 필드 내 콜론의 전후 공백을 `(공백):(공백)`으로 통일함.
71. 폼 초기 마운트 시 `silentRef.current.focus()`를 통한 포커스 트래핑.
72. `TeasyUniversalViewer` 내부 다운로드 버튼은 물리 위치 규격 준수.
73. `getTeasyStandardFileName` 엔진에서 파일 확장자는 대문자로 통일. (v124.9)
74. `ThinParen` 컴포넌트는 모든 파일 목록에서 공통적으로 적용됨.
75. 파일 목록에서 `showConfirm`이 `true`일 때만 체크박스 혹은 확인 버튼 노출.
76. 활동 삭제 시 `window.confirm` 메시지는 `"정말 이 [신규 문의] 보고서를 삭제하시겠습니까?"`임.
77. 삭제 성공 후 토스트 상태는 `"info"`임.
78. `StandardReportForm`과의 정합성을 위해 일자 입력 필드 규격 통일.
79. 브라우저 타임존과 관계없이 한국 표준시 기준으로 데이터 정규화.
80. `ReportFileList` 내 삭제 버튼 호버 시 `bg`는 `"red.400"`, `color`는 `white`임.
81. `InquiryForm.displayName` 속성을 통해 리액트 트리 엔진에서의 정체성 확립.
82. 활동 문서 내 `managerRole` 필드에 담당자 권한 기록 사양 탑재.
83. 활동 수정 3영업일 가드 로직 성공 시 `onClose` 호출 보장.
84. 담당자 선택 안함(`""`) 시 제출 버튼 유효성 검사 차단.
85. `CustomSelect` 드롭다운의 `zIndex`는 `9999` 수준의 최상위 유지.
86. 활동 문서 내 `customerName` 필드는 가시성 확보를 위해 포함됨.
87. 트랜잭션 오류 발생 시 `toast`를 통해 에러 메시지 사용자 노출.
88. `isSaving` 변수는 `useState(false)`로 초기화되어 제출 시 `true`로 제어. (v126.3)
89. `finalQuotes` 및 `finalRecordings` 배열 빌드 후 최종 트랜잭션 수행.
90. `normalizeText` 유틸리티는 `src/utils/textFormatter.ts`의 `export` 함수임.
91. `applyColonStandard`는 메모 필드 전용 필터임.
92. 폼 내부 `FormControl`의 유효성 검사 순서는 위에서 아래 방향임.
93. `TeasyPhoneInput` 상속값 및 `formatPhone` 적용 규격 준수.
94. 활동 문서 내 `updatedAt` 필드는 수정 시점의 `serverTimestamp()` 임.
95. `InquiryForm` 파일의 끝은 `InquiryForm` 명칭 익스포트임.
96. `isReadOnly` 모드 시 모든 `Badge` 업로드 버튼은 클릭 방지(`cursor="default"`) 및 비활성화.
97. 타임라인에서 다중 상품인 경우 동그라미 숫자가 자동으로 붙음.
98. `customer_meta` 업데이트 시 `totalCount`는 수동 트랜잭션 계산 보존.
99. ‘기타’ 채널 선택 시 입력한 채널 상세가 타임라인 배지 텍스트로 치환됨.
100. 100ms 페인트 가드는 모든 리포트 폼의 기본 물리 정합 규격임.
