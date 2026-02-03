# 원격 A/S 완료 (Remote A/S Complete) 기획서

원격 A/S 완료 양식은 현장 방문 없이 원격 제어 또는 유선 상담을 통해 해결된 기술 지원 내역을 기록하는 **'비대면 서비스 결산서'**입니다. 방문 정보(주소, 연락처)를 배제하고 오직 시간, 담당자, 상품, 조치 내용에만 집중하도록 설계된 경량 표준 양식입니다.

---

## 1. 시각 표준 및 UI/UX (Visual & UX Master)

### 1.1 모달 시스템 및 표준 규격 (Standard Modal Specs)
*   **컴포넌트**: `TeasyModal` 표준. **`size="lg"`** 규격 사용.
*   **여백 및 구성**: 내부 패딩 **`p={8}`(32px)** 준수, `VStack spacing={6}` 배치.
*   **포커스 가드**: 모달 상단 **Focus Guard(`tabIndex={0}`)** 배치를 통해 입력 필드 자동 포커싱을 방지함.

### 1.2 스마트 입력 및 검증 (Smart Control)
*   **DateTime 제어**: 완료 보고 성격상 **미래 시간 선택이 불가**함 (`limitType="future"`). 미래 시간 입력 시 `toast` 알림과 함께 현재 시간으로 자동 보정됨.
*   **필드 최적화 (Sparse UI)**: `StandardReportForm` 내에서 `reportType="remoteas_complete"`일 때, **"장소/방문처" 필드와 "현장 연락처" 필드를 자동으로 숨김** 처리하여 시각적 복잡도를 최소화함.
*   **처리 피드백**: 저장 및 삭제 시 브랜드 컬러의 `Spinner`와 **"처리 중..."** 텍스트를 통해 상태를 전달함.

---

## 2. 업무 설계 및 데이터 관리 (Engineering & Data)

### 2.1 폼 필드 구성 (Form Consistency)
*   **필수 항목**: 완료 일시, 담당자, 보고 내용(메모)은 필수(`isRequired`) 기재 사항임.
*   **선택 항목**: "관련 상품"은 필요 시 기재하며, 누락 시 타임라인에서 해당 행을 숨김.
*   **담당자 관리**: `ReportSelectionModal` 로직(v124.81)에 따라, 원격 A/S 진입 시 **현재 로그인 유저(`userData.uid`)를 기본 담당자로 자동 설정**하여 입력 단계를 단축함.

### 2.2 비즈니스 로직 및 트랜잭션 (Logic & Transaction)
*   **원자적 저장 (runTransaction)**:
    1.  `activities` 컬렉션에 `remoteas_complete` 타입 문서 생성.
    2.  고객 메타(`customer_meta`, ID: `{customerId}_remoteas_complete`)의 `lastSequence` 및 `totalCount` 갱신.
    3.  고객 마스터(`customers`)의 `lastConsultDate`를 조치 완료 일시로 갱신.
*   **차수 관리**: 원격 A/S는 독립적인 `sequenceNumber`를 순차적으로 발행함.
*   **정규화**: `applyColonStandard`를 적용하여 보고 내용 내 콜론 공백 규격을 강제함.

---

## 3. 타임라인 표현 표준 (Timeline Identity)

*   **식별자**: '원격 A/S 완료' 배지(**Color: `purple`**, `TeasyBadge` 표준 적용).
*   **정보 리스트 (Compact Layout)**:
    *   **일시**: `일시 :  {date}  {time}`
    *   **담당**: `담당 :  {managerName}`
    *   **상품**: `상품 :  {product}` (`ThinParen` 적용)
    *   *(장소 및 전화 항목은 출력에서 제외됨)*
*   **참고 사항**: 고유의 그레이 메모 박스(`gray.50`) 및 제목 '· 참고사항'과 함께 노출.

---

## 4. 버전 기록 (Version History)

| 버전 | 날짜 | 변경 사항 |
|:---|:---|:---|
| v1.0 | 2026-02-04 | 원격 A/S 완료 기획서 초안 작성 및 필드 제외 로직 명세화 |

---
> [!IMPORTANT]
> 본 기획서는 `remoteas_complete` 모듈의 구현 기준입니다. 불필요한 방문 정보 필드를 노출하지 않는 슬림화 로직을 철저히 준수하여 비대면 지원 서비스의 특성을 유지해야 합니다.
