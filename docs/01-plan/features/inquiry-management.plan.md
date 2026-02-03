# 신규 문의 (New Inquiry) 기획서

신규 문의 양식은 잠재 고객으로부터의 첫 접촉을 기록하고, 유입 경로와 초기 구매 의사를 파악하는 **'고객 여정의 통합 시작점'**입니다. 전화 문의, 네이버 톡톡, 채널톡, 기타 등 모든 채널을 단일 인터페이스에서 효율적으로 수용하도록 설계되었습니다.

---

## 1. 시각 표준 및 UI/UX (Visual & UX)

시스템 전반의 **'Teasy Premium Vibe'**와 전역 시각 표준(v124.71)을 준수하며, 채널별 특성에 최적화된 가변 UI를 제공합니다.

### 1.1 모달 디자인 상세 (Modal Design Specs)
*   **레이아웃 구성**:
    *   **섹션 분리**: `VStack spacing={6}`을 기반으로 한 논리적 그룹화.
    *   **2열 그리드 (HStack)**: [접수 일시-담당자], [문의 상품-상담 결과] 항목은 `HStack spacing={4}`를 통해 균형 잡힌 2열 배치.
*   **동적 가변 UI (Channel Specific)**:
    *   **가변 섹션**: 채널 선택 시 하단에 `white` 배경 박스(`borderRadius="xl"`, `p={4}`, `border="1px"`)가 노출됨. (Premium 일관성 유지)
    *   **"전화 문의" 선택 시**: 
        *   연락처 필드가 강조되며, 우측에 `bg="gray.100"`, `borderRadius="10px"`, `h="32px"` 규격의 **'녹취 업로드'** Badge 버튼 배치.
        *   연락처 필드는 고객의 기존 번호(`customer.phone`)를 기본값으로 계승.
        *   업로드된 녹취 파일은 커스텀 `ReportFileList`를 통해 하단에 리스트업됨.
    *   **"네이버 톡톡" / "채널톡" 선택 시**: 상세 필드 라벨이 `"닉네임"`으로 설정되며 필수 입력(`isRequired`) 처리됨.
    *   **"기타" 선택 시**: 상세 필드 라벨이 `"유입 채널 상세"`로 자동 전환되며, 선택 사항(`isRequired={false}`)으로 운영됨.
*   **플레이스홀더 및 규격 (Verbatim)**:
    *   **연락처**: `placeholder="000-0000-0000"`
    *   **기타 필드**: 선택 항목은 `placeholder="선택"`, 입력 항목은 `placeholder="입력"`.
    *   접수 일시는 **미래 시점 선택 불가** (`limitType="future"`).
    *   **공통 규격**: 모든 `TeasyInput` 및 `CustomSelect`는 `h="45px"`, `borderRadius="10px"` 준수.
    *   **읽기 전용 (Read-Only)**: '담당자', '유입 채널', '문의 상품', '상담 결과' 등 선택 필드는 `isReadOnly` 시 `TeasyInput`으로 전환하여 정보를 노출함.
    *   **글로벌 상속 (Global Inherited)**: `theme.ts`의 `letterSpacing: "0.5px"`를 상속받아 고급스러운 자간 유지.
*   **견적서 업로드 UI (Quote Section)**:
    *   필드 우측에 `bg="gray.100"`, `h="32px"`, `borderRadius="10px"` 규격의 **'파일 업로드'** Badge 버튼 배치.
*   **파일 상호작용 (Interaction)**:
    *   업로드된 파일 클릭 시 `TeasyUniversalViewer` (이미지/PDF) 또는 `TeasyAudioPlayer` (녹취)가 호출되어 즉시 내용을 확인 가능함.
*   **처리 상태 피드백**: 저장 중에는 `whiteAlpha.800` 오버레이와 함께 브랜드 컬러의 `Spinner (size="xl", thickness="4px")`가 노출되어 진행 상태를 알림.

### 1.2 타임라인 카드 UI (Timeline Representation)
*   **헤더**: '신규 문의' 배지(**Color: `purple`**), 접수 일시, 작성자 성명.
*   **헤더**: '신규 문의' 배지(**Color: `purple`**), 접수 일시, 작성자 성명.
*   **정보 리스트**:
    *   **공통 (Common)**:
        *   **일시**: `일시 :  {date}  {time}`
        *   **담당**: `담당 :  {managerName}`
    *   **채널**: `채널 :  {channel}${hasNickname ? ` ({nickname})` : ""}`
        *   `hasNickname` 로직: `content.nickname && content.channel !== "전화 문의"` 일 때 괄호 정보 노출.
    *   **전화 (Sub)**: 전화 문의인 경우에만 `전화 :  000-0000-0000` (포맷팅 적용)을 서브 항목(`isSubItem: true`, `isFirstSubItem: true`)으로 노출.
    *   **상품**: `상품 :  {product}` (입력값이 `crm`일 경우 대문자 `CRM`으로 자동 치환 노출)
    *   **결과**: `결과 :  {result}`
*   **파일 목록**: '녹취' 또는 '견적' 라벨과 함께 파일 리스트 노출. 파일명은 `getTeasyStandardFileName` 포맷 적용.
*   **참고 사항**: 고유의 그레이 메모 박스(`gray.50`) 내에 실시간 계층 구조 및 줄바꿈 유지 노출.

---

## 2. 기능 및 비즈니스 로직 (Functionality & Logic)

### 2.1 필수 입력 및 데이터 검증 (Validation)
*   **공통 필수**: 접수 일시, 담당자, 유입 채널, 문의 상품, 상담 결과(`result`).
*   **유입 채널별 제약**:
    *   **"전화 문의"**: 연락처(`phone`) 입력 및 최소 1개 이상의 녹취 파일 업로드 필수.
    *   **"네이버 톡톡" / "채널톡"**: 닉네임 입력 필수.
*   **검증 엔진**: `inquirySchema (Zod)`를 통한 데이터 형식 사전 검증 및 `future` 일자 선택 차단 (`limitType="future"`).

### 2.2 자원 및 연동 상세 (Integration & Physics)
*   **자원 산출 (Verbatim Options)**:
    *   **채널**: `"전화 문의"`, `"네이버 톡톡"`, `"채널톡"`, `"기타"`
    *   **상담 결과**: `"구매 예정"`, `"시연 확정"`, `"시연 고민"`, `"관심 없음"`
*   **원자적 트랜잭션 (Atomic Transaction)**: 
    *   `activities` 문서 생성, `customer_meta` (Prefix: `{customerId}_inquiry`) 순번 발행, 고객 마스터 `lastConsultDate` 갱신이 단일 트랜잭션 처리됨.
*   **담당자 옵션 로직**:
    *   `useReportMetadata` 훅을 통해 내부 직원과 협력사(Partner) 사이에 구분선(`divider`)을 자동 삽입하고, 퇴사자는 라벨에 `(퇴)`를 명시.
*   **리소스 정리 (Storage Physics)**: 
    *   보고서 삭제 시 해당 보고서와 연결된 모든 녹취 및 견적서 파일을 Firebase Storage에서 물리적으로 즉시 삭제(`deleteObject`).
    *   `URL.revokeObjectURL`을 통한 브라우저 메모리 관리 포함.

---

## 3. 시각 브랜드 세부 표준 (Visual Brand Standards)
*   **콜론 규격 (Verbatim Spacing)**: 모든 라벨의 콜론은 반드시 **'전 1칸, 후 2칸'** 공백 규격(` :  `)을 준수함.
*   **ThinParen 적용**: 괄호(`()`), 하이픈(`-`), 언더바(`_`) 등 특수 문자는 `ThinParen` 컴포넌트를 통해 흐릿하게 처리.
*   **날짜 표기**: 연-월-일과 시:분 사이에 **2칸 공백** 사용. (`YYYY-MM-DD  HH:mm`)

---

## 4. 버전 기록 (Version History)

| 버전 | 날짜 | 변경 사항 |
|:---|:---|:---|
| v1.0 | 2026-02-03 | 신규 문의 기획서 초안 작성 |
| v1.1 | 2026-02-03 | TimelineCard 상세 노출 로직(HasNickname) 및 "기타" 가변 UI 반영 |
| v1.2 | 2026-02-03 | Storage Physics 및 메모리 관리 지침 추가 |
| v1.3 | 2026-02-03 | 읽기 전용 선택 필드 TeasyInput 전환 및 가변 섹션 white 배경 표준화 |

---
> [!IMPORTANT]
> 본 문서는 '신규 문의' 모듈의 구현 기준점입니다. 모든 UI 로직과 파일 관리 규격은 본 문서와 전역 개발 표준을 최우선으로 따릅니다.
