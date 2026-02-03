# 방문 A/S 완료 (Visit A/S Complete) 기획서

방문 A/S 완료 양식은 현장에서 진행된 기술 지원 및 수리 업무의 결과를 최종적으로 기록하는 **'사후 서비스 결산 보고서'**입니다. `StandardReportForm` 표준을 사용하여 시공/방문과 일관된 UX를 제공하며, 이전 '방문 A/S 확정' 단계의 차수를 계승하여 서비스 이력을 통합 관리합니다.

---

## 1. 시각 표준 및 UI/UX (Visual & UX Master)

### 1.1 모달 시스템 및 표준 규격 (Standard Modal Specs)
*   **컴포넌트**: `TeasyModal` 표준. **`size="lg"`** 규격 사용.
*   **여백 및 구성**: 내부 패딩 **`p={8}`(32px)** 준수, `VStack spacing={6}` 배치.
*   **포커스 가드**: 모달 상단 **Focus Guard(`tabIndex={0}`)** 배치를 통해 입력 필드 자동 포커싱을 방지함.

### 1.2 스마트 입력 및 검증 (Smart Control)
*   **DateTime 제어**: 업무 완료 보고 성격상 **미래 시간 선택이 불가**함 (`limitType="future"`). 미래 시간 입력 시 `toast` 알림과 함께 현재 시간으로 자동 보정됨.
*   **동적 레이블링**: `StandardReportForm` 내에서 `reportType="as_complete"`일 때, 위치 입력 필드 라벨을 **"방문처"**로, 연락처 필드 라벨을 **"현장 연락처"**로 표시함.
*   **처리 피드백**: 저장 및 삭제 시 브랜드 컬러의 `Spinner`와 **"처리 중..."** 텍스트를 통해 상태를 전달함.

---

## 2. 업무 설계 및 데이터 관리 (Engineering & Data)

### 2.1 폼 필드 구성 (Form Consistency)
*   **필수 항목**: 완료 일시, 담당자, 보고 내용(메모)은 필수(`isRequired`) 기재 사항임.
*   **데이터 상속 (Auto-fill)**:
    *   신규 작성 시 가장 최근의 **'방문 A/S 확정'(`as_schedule`)** 문서로부터 담당자, 방문처, 현장 연락처, 관련 상품 정보를 자동으로 상속함.
    *   상속된 연락처는 `formatPhone` 유틸리티를 통해 `000-0000-0000` 규격으로 즉시 포맷팅됨.

### 2.2 비즈니스 로직 및 트랜잭션 (Logic & Transaction)
*   **원자적 저장 (runTransaction)**:
    1.  `activities` 컬렉션에 `as_complete` 타입 문서 생성.
    2.  고객 메타(`customer_meta`, ID: `{customerId}_as_complete`)의 `lastSequence` 및 `totalCount` 갱신.
    3.  고객 마스터(`customers`)의 `lastConsultDate`를 A/S 완료 일시로 갱신.
*   **차수 계승 (Sequence Pairing)**: `as_complete`는 새로운 번호를 생성하는 대신, 페어링된 **`as_schedule`의 `sequenceNumber`를 그대로 계승**하여 하나의 서비스 세션으로 묶어 관리함 (v124.81 로직).
*   **정규화**: `applyColonStandard`를 적용하여 보고 내용 내 콜론 공백 규격을 강제함.

---

## 3. 타임라인 표현 표준 (Timeline Identity)

*   **식별자**: '방문 A/S 완료' 배지(**Color: `purple`**, `TeasyBadge` 표준 적용).
*   **정보 리스트 (Standard Visit Layout)**:
    *   **일시**: `일시 :  {date}  {time}`
    *   **담당**: `담당 :  {managerName}`
    *   **방문처**: `방문처 :  {location}` (Complete 타입 특화 라벨)
    *   **전화**: `전화 :  010-0000-0000`
    *   **상품**: `상품 :  {product}` (`ThinParen` 적용)
*   **참고 사항**: 고유의 그레이 메모 박스(`gray.50`) 및 제목 '· 참고사항'과 함께 노출.

---

## 4. 버전 기록 (Version History)

| 버전 | 날짜 | 변경 사항 |
|:---|:---|:---|
| v1.0 | 2026-02-04 | 방문 A/S 완료 기획서 초안 작성 및 sequenceNumber 계승 로직 명세화 |

---
> [!IMPORTANT]
> 본 기획서는 `as_complete` 모듈의 구현 기준입니다. '방문 A/S 확정'과의 데이터 계승 및 차수 일치는 이력 관리의 핵심이므로 반드시 준수되어야 합니다.
