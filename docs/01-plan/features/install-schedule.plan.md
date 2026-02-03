# 시공 확정 (Install Schedule) 기획서

시공 확정 양식은 실제 제품 설치를 위한 **'현장 투입 및 자재 운영'**을 설계하는 도구입니다. 시공될 상품에 필요한 각종 부자재를 자동으로 산출하고, 재고 시스템과 실시간으로 연동되어 오차 없는 시공 준비를 지원합니다.

---

## 1. 시각 표준 및 UI/UX (Visual & UX)

시스템 전반의 **'Teasy Premium Vibe'**와 고유의 리스트 레이아웃 표준을 준수합니다.

### 1.1 모달 디자인 상세 (Modal Design Specs)
    *   **헤더 타이틀 (Dynamic Title)**: 데이터 존재 여부(`initialData`)에 따라 **"시공 확정 수정"** 또는 **"시공 확정 등록"**으로 동적 분기.
    *   **레이아웃 (Responsive)**: 모달은 `isCentered`로 중앙 정렬되며 `ModalOverlay`를 포함. 최대 너비는 `600px`(`md`), 내부 패딩은 반응형(`base: 4`, `md: 6`) 적용.
    *   **섹션 스타일**: 각 섹션 헤더는 `fontSize="sm"`, `fontWeight="bold"`, `color="gray.700"` 스타일을, 섹션 간 구분선은 `my={6}` 여백을 준수. 섹션 내 스택 간격은 `spacing={4}`.
    *   **안전 장치**: 오버레이 클릭 시 닫히지 않도록 `closeOnOverlayClick={false}` 설정. 모달 타이틀은 `fontWeight="bold"` 적용. 닫기 버튼(`ModalCloseButton`) 포함.
    *   **로딩 UX**: 초기 진입 시 별도 스켈레톤 없이 폼이 즉시 렌더링. 버튼만 Loading Spinner 처리(`loadingText="저장 중"`). `isLoading` 상태와 `useRef`(`isSubmitting`)를 조합하여 이중으로 중복 제출 방지(Immediate Guard).
    *   **글로벌 리스트 표준 (Global List Representation Standard)**:
        *   확인(Read-Only) 모달 내 모든 리스트(상품, 자재, 업무 등)는 아래 표준을 준수함.
        *   **컨테이너**: `bg="white"`, `borderRadius="md"`, `border="1px solid"`, `borderColor="gray.100"`, `shadow="xs"`.
        *   **레이아웃**: `justify="space-between"`, 내부 패딩 `px={3}, py={1.5}`.
        *   **콘텐츠 (Left)**: 원형 숫자(`getCircledNumber`) + 텍스트(`Text` 컴포넌트 사용, `fontSize="sm"`, `fontWeight="medium"`).
        *   **콘텐츠 (Right)**: 정보 성격에 따른 `Badge` 배치 (수량, 카테고리, 상태 등).
    *   **상태 제어**: 로딩/제출 중이거나 닫기 시 `readOnly` 전환 및 `reset`을 통한 잔상 데이터 방지. 스크롤은 `scrollBehavior="inside"`로 내부 스크롤 처리.
    *   **파일 UX**: 업로드 시 `파일명 + 파일크기` 조합으로 중복 여부를 체크(Client-side). 전송 직전 `Map` 자료구조로 2차 중복 제거(Safety Net) 수행. 확장자 누락 시 `jpg` Fallback.
    *   **테마 정책**: 현재 Light Mode 색상(`white`, `gray.50` 등)이 하드코딩되어 있음. 구분선(`Divider`)은 기본 `gray.200`.
*   **지능형 리스트 시스템 (Product & Supply)**:
    *   **섹션 분리**: 상품 리스트(`gray.50`)와 자재 리스트(`purple.50`) 박스는 `minH="100px"` 높이와 `align="stretch"` 정렬을 유지.
    *   **합산/수동 구분 (v124.77)**: 자동산출 자재와 수동 추가 항목 사이에 `purple.200` 색상 Dashed Divider 배치. 아이템 간 구분선은 `purple.100`.
    *   **입력 필드**: 상품명/자재명 입력란에는 각각 `"상품명 입력"`, `"자재명 입력"` 플레이스홀더 적용.
    *   **아이콘 규격**: 항목 추가 버튼은 `FiPlus`(`leftIcon`), `w="full"` 너비 사용. 삭제 버튼은 `FiTrash2`(`size={14}`, `aria-label="삭제"`) 사용.
    *   **리스트 포맷**: 자재 리스트는 `{name}` 뒤에 `gray.400`, `fontSize="xs"` 스타일로 `({category})`를 병기.
    *   **인덱싱**: 외부 유틸리티 `getCircledNumber`를 통해 순번 부여.
    *   **안내 문구**: 자재 리스트 하단 우측 정렬된 `purple.400` 문구(`* 저장 시 위 물량만큼 재고에서 자동 차감됩니다.`) 노출.
    *   **자동 정리 (Cleanup)**: 상위 상품 삭제 시 연결된(`linkedId`) 자동 산출 자재(`isAuto`)도 함께 삭제되거나 수량 재계산.
*   **업무 지시서 디자인 (Task UX)**:
    *   **입력 환경**: 시공 전/후 섹션을 `white` 배경 내 `white` 카드 형태로 수직 리스트업. 아이템 간 간격은 `spacing={3}`(12px) 적용. 타이틀 색상은 `gray.400`.
    *   `tasksBefore`, `tasksAfter`는 `string[]` 배열로 관리되며 초기값은 `[""]`로 세팅. 업데이트 시 인덱스 기반 불변성 유지.
    *   `variant="unstyled"` 필드 사용으로 텍스트 기반 정보 기재 특화.
*   **사진 계승 인터페이스**:
    *   '시연 완료' 시점에 업로드된 사진이 있는 경우 '시공 확정' 양식 진입 시 자동으로 상속(Auto-fill)되어 사용자 편의성 제공.
    *   **최대 개수 제한**: 사진은 상수 `INSTALL_SCHEDULE_CONSTANTS.MAX_PHOTOS`(**15장**)를 참조하여 제한하며, 초과 시 "한도 초과" 경고 토스트 노출.
    *   **파일 핸들링**: `input type="file"`은 `hidden` 및 `multiple` 속성 사용. `accept="image/*"`로 이미지 파일만 제한.
    *   **미리보기 UI**: `SimpleGrid`(`columns={3}`, `spacing={2}`) 레이아웃. `AspectRatio`(`1:1`), `objectFit="cover"` 적용. 삭제 버튼은 `FiX` 아이콘, `size="xs"`, `colorScheme="red"`. Key는 인덱스 사용.
    *   사진 추가/삭제 시 `isSubmitting.current` 제어로 연산 안정성 확보. 언마운트 시 `revokeObjectURL`로 메모리 해제(Cleanup).
*   **플레이스홀더 및 규격 (Verbatim)**:
    *   방문 주소 `placeholder="전국 시공 주소 입력"`, 참고 사항 `placeholder="시공 시 주의사항 등 입력"`.
    *   시공 일시는 미래 예약을 위해 **과거 시점 선택 불가** (`limitType="past"`: Disable Past). 컴포넌트는 `TeasyDateTimeInput` 사용하며 `FiCalendar` 아이콘 배치.
    *   **입력 필드**: `bg="white"` 배경. 포커스 시 `focusBorderColor="purple.500"`.
    *   **담당자 항목**: 읽기 전용 상태일 때 `TeasyInput` 스타일로 표시되며, 담당자 성명(Label)이 출력됩니다.
    *   라벨 좌측에는 `FiCalendar`, `FiUser`, `FiMapPin`, `FiPhone` 아이콘을 배치합니다. (`InputGroup` 사용)
    *   **수량 필드**: `min={1}` 제한, `clampValueOnBlur={false}`, 고정 폭(`상품: 80px`, `자재: 70px`).
    *   **메모**: 참고 사항(`Textarea`)은 높이 `100px` 고정, 최대 글자 수 `200`자 제한, `resize="none"`.
    *   **버튼**: 저장 버튼(`colorScheme="purple"`), 취소 버튼(`variant="ghost"`, `mr={3}`)을 `ModalFooter` 우측에 정렬.
    *   공통 `h="45px"`, `borderRadius="10px"` 준수.

### 1.2 타임라인 카드 UI (Timeline Representation)
*   **헤더**: '시공 확정' 배지(**Color: `green`**, `TeasyBadge` 표준 컴포넌트), 시공 일시, 작성자 성명.
*   **정보 리스트**:
    *   **장소**: `장소 :  {location}` (TimelineCard.tsx 기준 라벨: "장소", Schedule 타입 특화)
    *   **전화**: `전화 :  000-0000-0000` (포맷팅 적용)
    *   **상품 (Clean)**: 원형 숫자 순번과 수량(`×`) 포함. 단, 단일 항목(`length=1`)인 경우 원형 숫자 자동 숨김 처리.
    *   **물품 (Clean)**: 원형 숫자 순번과 수량(`×`) 포함. 단일 항목 시 원형 숫자 자동 숨김.
    *   **업무 (Clean)**: '시공 전', '시공 후' 배지(`gray.100`, `fontSize: 10px`) 적용. 단일 항목 시 원형 숫자 자동 숨김.
    *   **사진**: 사진 계승 시 TimelineCard 내에서 `TeasyUniversalViewer` 컴포넌트를 사용하여 렌더링.
*   **참고 사항**: 고유의 그레이 메모 박스(`gray.50`) 및 제목 '· 참고사항'과 함께 노출.

---

## 2. 기능 및 비즈니스 로직 (Functionality & Logic)

### 2.1 자재 산출 및 통합 통합 엔진 (Merging v124.77)
*   **구성 해석 (Regex Priority)**: 상품의 `composition` 정보를 다음 **우선순위**로 매칭하여 추출.
    *   `/(.+)\s*[×x*]\s*(\d+)/`  >  `/(.+)\s*\((\d+)\)/`  >  `/(.+)\s*(\d+)개/`
    *   추출 시 `replace(/^[①-⑳]|^(\d+\.)/, "")`를 통해 인덱스 기호 강제 소거.
    *   **자동 마킹 (Origin)**: 산출된 자재는 `isAuto: true` 플래그가 강제 주입되며, 이는 **DB에 영구 저장(Persistence)**되어 추후 수정 시 자동/수동 판별 기준이 됨.
*   **지능형 합산 (LinkedId CSV)**: 동일 자재가 복수 상품에서 요구될 경우 `linkedId`에 상품 ID를 **CSV 포맷(`id1,id2`)**으로 다중 저장하여 관리.
*   **실시간 동적 싱크 (Simple Sum)**: 상위 상품 수량 변경 이벤트 발생 시, 연결된 `isAuto` 자재 수량을 **즉시 재계산(Recalculation Trigger)**하여 단순 1:1 합산으로 동기화.

### 2.2 자원 관리 및 데이터 계승 (Integration)
*   **데이터 계승 (Inheritance & Init)**: 
    *   **진입 방어**: 초기화 시 `updatedAt` 타임스탬프를 대조하여 중복 실행 및 무한 루프 방지.
    *   초기화 시 날짜는 현재 시간(`YYYY-MM-DD HH:mm`)을 기본값으로 `formatDate` 포맷터를 사용해 설정.
    *   **상태 동기화**: `isOpen` 혹은 `initialData`, `customer` 변경 감지 시 폼 상태를 강제로 재설정(Reset)하여 최신성 유지.
    *   **담당자 우선순위**: `customer.manager` > `userData` 순으로 설정하되, '시연 확정(`demo_schedule`)' 문서가 있다면 해당 담당자를 우선 상속. `role` 정보와 함께 저장.
    *   장소(`location`), 전화(`phone`)는 '시연 확정'(`demo_schedule`) 문서 혹은 고객 기본 정보에서 상속.
    *   초기 상속 시 전화번호는 외부 유틸 `formatPhone` 포맷팅(`000-0000-0000`) 적용. 값이 없으면 빈 문자열 Fallback. 저장 시에는 숫자만 남김(cleanPhone).
    *   사진(`photos`)은 '시연 완료'(`demo_complete`) 문서에서 상속.
*   **재고 및 고객 동기화**: `runTransaction` 내에서 다음 작업 수행.
    *   **고객 정보**: `customers` 컬렉션의 `lastConsultDate`를 **시공 예정일(`formData.date`)**로 반드시 갱신 및 `updatedAt` 동기화. `customer_meta`의 `totalCount` 증가.
    *   **사전 조회**: 수정 시(`activityId` 존재), 연결된 기존 자산 기록을 트랜잭션 진입 전 미리 조회(Pre-read).
    *   **ID 생성**: 신규 생성 시 `doc(collection(...)).id`를 통해 클라이언트 측에서 문서 ID를 선행 생성(Allocation).
    *   **재고 차감**: `aggregatedSuppliesMap`(`Name|Category` 키 기준 합산) 기반 원자적 차감. `asset_meta` ID는 `meta_Name_Category` 형식이며 슬래시는 언더스코어로 치환.
    *   **병렬 조회**: 다수 자재의 메타데이터 조회 시 `Promise.all`을 사용하여 병렬 처리 최적화.
    *   **재고 갱신**: `currentStock` 감소 및 `totalOutflow` 증가 동시 반영. 카테고리 누락 항목은 안전하게 Skip.
    *   **로그 생성**: `assets` 컬렉션에 `lastOperator` 기록. `lastAction`은 차감 시 `"install_schedule_deduction"`, 복구 시 `"delete_recovery"` 동적 할당.
    *   **입출고 기록**: 입고(`lastInflow`)는 `null`, 출고(`lastOutflow`)는 `quantity`로 명확히 기록.
    *   **로그 포맷**: `editLog` 필드는 `시공 확정 물품 차감 (고객명) [Lock-Verified]` 표준 포맷 준수.
    *   **저장 경로**: Firebase Storage (`activities/install`) 저장. 파일명은 `install_{timestamp}_{index}_{random}` 규칙 사용.
    *   **파일 처리**: `blob:` URL 제거(Cleanup Filter) 후 저장 시 실제 URL로 교체(Swap). Base URL 기준 중복 제거(Dedup) 수행.
    *   **후속 처리**: `performSelfHealing` 비동기 수행(Non-blocking). `pendingFiles` 상태 초기화 및 캐시 무효화(Key: `["activities", customer.id]`).
    *   **토스트**: 성공 시 `initialData` 유무에 따라 **"시공 확정 수정 완료"** 또는 **"시공 확정 등록 완료"** 메시지가 상단(`top`)에 2초(`2000ms`)간 노출.
    *   **메타데이터**: `updatedAt`은 Firebase `serverTimestamp` 사용. `createdAt`은 신규 시 `now`, 수정 시 유지.
    *   **데이터 필드**: `selectedProducts`, `selectedSupplies` 원본 배열과 요약 문자열 `product`를 함께 저장. 작성자 이름(`createdByName`) 및 타입명(`typeName`) 저장.
    *   **수정 시 (Modification)**: 기존 연결된 `assets` 기록은 **전체 삭제(Delete)** 후 신규 수량으로 재생성(Reset).
*   **삭제 복구**: 보고서 삭제 시 종속된 모든 사진 물리 소거(클라우드 URL 필터링 적용) 및 재고 기록 `delete_recovery`. `customer_meta.totalCount` 감소 시 음수 방지(`Math.max(0)`) 적용.
    *   **삭제 확인**: `window.confirm("보고서와 연결된 재고 기록 및 사진이 모두 삭제됩니다. 정말 삭제하시겠습니까?")` 경고 노출.

### 2.3 필수 입력 및 검증 (Form Validation)
*   **데이터 정제 (Sanitization)**: 저장 전 모든 `undefined` 값을 빈 문자열(`""`)로 변환하고 텍스트는 `trim()` 처리하여 데이터 무결성 보장.
*   **상품 선택 필수**: 시공할 상품이 최소 1개 이상 선택되어야 저장이 가능함. 빈 이름이나 **수량이 0 이하**인 상품/자재는 저장 시 **자동으로 필터링(Silent Filtering)**됨.
*   **공통 필수**: 시공 일시, 담당자, 방문 주소, 연락처.

---

## 3. 시각 브랜드 세부 표준 (Visual Brand Standards)
*   **콜론 규격 (Verbatim Spacing)**: 모든 라벨의 콜론은 반드시 **'전 1칸, 후 2칸'** 공백 규격(` :  `)을 준수함. 메모 필드는 저장 시 `applyColonStandard`를 통해 강제 적용.
*   **ThinParen 적용**: 수량(`×`), 괄호(`()`), 하이픈(`-`), 슬래시(`/`) 등 보조 기호는 `ThinParen` 적용.
*   **날짜 표기**: 연-월-일과 시:분 사이에 **2칸 공백** 사용. (`YYYY-MM-DD  HH:mm`)

---

## 4. 버전 기록 (Version History)

| 버전 | 날짜 | 변경 사항 |
|:---|:---|:---|
| v1.0 | 2026-02-03 | 시공 확정 기획서 초안 작성 |
| v1.1 | 2026-02-03 | TimelineCard 상세 노출 필드(장소/업무) 및 업무 지시서 초기값 반영 |
| v1.2 | 2026-02-03 | 자재 구성 파싱 Regex 정규식 및 데이터 계층 상속 지침 명문화 |
| v1.3 | 2026-02-03 | 글로벌 리스트 표현 표준 도입 (수행 요망 항목 적용) |

---
> [!NOTE]
> 본 문서는 '시공 확정' 모듈의 핵심 기준입니다. 특히 자재 통합 로직과 재고 차감의 무결성을 위해 본 설계를 최우선으로 준수합니다.
