# 방문 A/S 확정 (Visit A/S Schedule) 기획서

방문 A/S 확정 양식은 기 설치된 제품에 대한 현장 기술 지원 및 수리 일정을 수립하는 **'사후 관리 서비스의 시작점'**입니다. `StandardReportForm` 기반의 표준 방문 규격을 준수하며, 현장 주소와 연락처, 관련 상품 정보를 통합 관리하여 효율적인 A/S 엔지니어 투입을 지원합니다.

---

## 1. 시각 표준 및 UI/UX (Visual & UX Master)

### 1.1 모달 시스템 및 표준 규격 (Standard Modal Specs)
*   **컴포넌트**: `TeasyModal` 표준. **`size="lg"`** 규격이며, **`closeOnOverlayClick={false}`**를 적용함.
*   **여백 및 구성**: 내부 패딩 **`p={8}`(32px)**을 준수하며, `VStack spacing={6}`을 통해 항목을 수직 정렬함.
*   **포커스 가드**: 모달 상단에 투명한 **Focus Guard(`tabIndex={0}`)**를 배치하여 자동 포커스로 인한 입력 방해를 차단함.

### 1.2 스마트 입력 및 검증 (Smart Control)
*   **DateTime 제어**: 미래 일정을 확정하는 업무 성격에 따라 **과거 시간 선택이 불가**함 (`limitType="past"`). 과거 시간 입력 시 `toast` 알림 후 현재 시간으로 자동 복구됨. 
*   **동적 레이블링**: `StandardReportForm` 내에서 `reportType="as_schedule"`일 때, 위치 입력 필드 라벨을 **"장소"**로, 연락처 필드 라벨을 **"현장 연락처"**로 자동 전환함.
*   **처리 피드백**: 저장 중에는 `Spinner`와 함께 **"처리 중..."** 텍스트를 노출하여 사용자의 명확한 대기를 유도함.

---

## 2. 업무 설계 및 데이터 관리 (Engineering & Data)

### 2.1 폼 필드 구성 (Form Consistency)
*   **필수 항목**: 완료 일시, 담당자, 보고 내용(메모)은 필수(`isRequired`) 항목임.
*   **선택 항목**: "장소", "현장 연락처", "관련 상품"은 필요에 따라 추가 기재하며, 누락 시 타임라인에서 해당 행을 자동 숨김 처리하여 UI 노이즈를 방지함.
*   **자동 상속(Auto-fill)**:
    *   **장소**: 고객 기본 주소(`customer.address`)를 우선적으로 상속.
    *   **연락처**: 고객 기본 연락처(`customer.phone`)를 상속하며, 외장 유틸리티를 통해 `000-0000-0000` 포맷을 자동 적용.
    *   **담당자**: 기본 담당자(`defaultManager`)를 최상단에 배치하되 사용자 선택 가능.

### 2.2 비즈니스 로직 및 트랜잭션 (Logic & Transaction)
*   **원자적 저장 (runTransaction)**:
    1.  `activities` 컬렉션에 `as_schedule` 타입의 신규 문서 생성.
    2.  고객 메타(`customer_meta`, ID: `{customerId}_as_schedule`)의 `lastSequence`를 1 증가시키고 `totalCount` 갱신.
    3.  고객 마스터(`customers`)의 `lastConsultDate`를 A/S 예정 일시로 갱신하여 상담 현황 동기화.
*   **순번 관리**: `as_schedule`은 독자적인 `sequenceNumber`를 부여받으며, 이는 추후 '방문 A/S 완료' 시점에 상속되는 기준 데이터로 사용됨.
*   **텍스트 표준화**: 메모 입력 값은 `applyColonStandard`를 거쳐 콜론 전후 공백 규격을 강제 정형화함.

---

## 3. 타임라인 표현 표준 (Timeline Identity)

*   **식별자**: '방문 A/S 확정' 배지(**Color: `pink`**, `TeasyBadge` 표준 적용).
*   **정보 리스트 (Standard Visit Layout)**:
    *   **일시**: `일시 :  {date}  {time}`
    *   **담당**: `담당 :  {managerName}`
    *   **장소**: `장소 :  {location}` (Schedule 타입 특화 라벨)
    *   **전화**: `전화 :  010-0000-0000`
    *   **상품**: `상품 :  {product}` (`ThinParen` 적용)
    *   **물품**: `물품 :  {selectedSupplies}` (기존 기록 존재 시 노출)
*   **참고 사항**: 수직 계층 구조가 유지되는 전용 그레이 메모 박스에 '보고 내용' 데이터를 출력.

---

## 4. 버전 기록 (Version History)

| 버전 | 날짜 | 변경 사항 |
|:---|:---|:---|
| v1.0 | 2026-02-04 | 방문 A/S 확정 기획서 초안 작성 및 StandardReportForm 로직 명세화 |

---
> [!IMPORTANT]
> 본 기획서는 `StandardReportForm`을 통해 구현된 '방문 A/S 확정' 모듈의 최종 명세입니다. 일시 선택의 과거 제한(`limitType="past"`) 및 콜론 공백 규격은 시스템 데이터 정합성을 위한 필수 요건입니다.
