# 시공 완료 (Install Complete) 기획서

시공 완료 양식은 시공 확정 계획에 따라 실제 현장 설치가 완료되었음을 증빙하고, 최종 투입 자재와 시공 상태를 기록하는 **'시공 프로젝트의 최종 종료 보고서'**입니다. 본 모듈은 단순 기록을 넘어 **계획 대비 실사용 자재의 정밀 정산(Settlement)**, **보유자산 동기화**, 그리고 **미수행 업무 트래킹**이 결합된 고정밀 종료 프로세스로 구현되어 있습니다.

---

## 1. 시각 표준 및 UI 물리 엔진 (Visual & UX Engineering) - [342 Atomic Items]

### 1.1 모달 물리 및 포커스 시스템
*   **컴포넌트 규격**: `TeasyModal` 표준. **`size="lg"`**, **`closeOnOverlayClick={false}`**.
*   **사일런트 포커스 가드 (Focus Hijack Prevention)**: 
    *   모달 진입 시 브라우저 자동 포커싱 방지를 위해 투명 더미 요소(`silentRef`) 배치. 
    *   물리 좌표: **`top="-100px"`, `left="-100px"`**, `opacity={0}`, `pointerEvents="none"`, `tabIndex={0}`.
    *   동작: `useEffect` 트리거를 통해 진입 시 즉시 해당 좌표로 포커스 강제 이동. (v126.3 가드 시스템)
*   **프리미엄 로딩 오버레이**: 
    *   `whiteAlpha.800` 반투명 배경 및 `zIndex={20}` 적용. 
    *   스피너: **`size="xl"`, `color="brand.500"`, `thickness="4px"`**. 
    *   문구: **"처리 중..."** (`brand.600`, `fontWeight="medium"`).

### 1.2 지능형 리스트 및 조판 (List & Badge)
*   **항목 레이아웃**: `minH="36px"`, `borderRadius="md"`, `border="1px solid gray.100"`.
*   **수량 배지**: `bg="purple.50"`, `color="purple.700"`, `fontSize="11px"`, `fontWeight="700"`, `borderRadius="sm"`, `h="20px"`, `minW="24px"`.
*   **자재 구분선**: 자동산출(`isAuto`) 자재와 수동 추가 항목 사이에 **`borderTop="1px dashed"`, `borderColor="purple.200"`** 배치.

### 1.3 수행 결과 조판 및 로직 (Tasks UI)
*   **업무 상속**: `install_schedule`에서 정의된 태스크를 문자열에서 객체 형태(`{ text, completed: false }`)로 변환하여 상속.
*   **인터페이스 제한**: 시공 완료 단계에서는 태스크의 **추가/수정/삭제가 강제 차단**되며, 오직 **`completed` 체크박스 토글**만 허용.
*   **리액티브 클린업 (v126.9)**: 모든 업무가 체크(`allDone`)되어 수행불가 사유가 불필요해지는 즉시, **`incompleteReason` 필드를 자동으로 공백 초기화**하여 데이터 무결성 보장.

---

## 2. 엔지니어링 및 정산 아키텍처 (Engineering & Logic) - [476 Atomic Items]

### 2.1 정밀 재고 정산 엔진 (Settlement Intelligence)
*   **Delta 연산 알고리즘**: 계획(`reservedSupplies`) 대비 실제 투입(`actualSupplies`) 자재의 차이를 계산.
    *   **정산 수식**: `delta = reservedQty - actualQty`.
    *   **잔여 물량 (delta > 0)**: "현장 회수 입고" 처리. `lastAction: "install_recovery"`.
    *   **추가 사용 (delta < 0)**: "현장 추가 출급" 처리. `lastAction: "install_extra_outflow"`.
*   **로그 명확화**: 각 정산 건은 `editLog`에 `[현장 회수 입고]` 또는 `[현장 추가 출급]` 태그를 부착하여 기록.

### 2.2 데이터 계승 및 보유자산 동기화
*   **순번 계승**: 마지막 `install_schedule`의 `sequenceNumber`를 그대로 상속받아 프로젝트의 일관성 유지.
*   **보유자산 동기화 (Owned Sync)**: 
    *   설치 완료된 상위 상품(`selectedProducts`)을 고객의 `ownedProducts` 리스트에 아토믹하게 추가.
    *   **정렬 엔진**: 갱신 시 상품명을 **가나다 순(`localeCompare`)으로 자동 재정렬**.
*   **사진 무결성 가드**: 사진 업로드 시 **Base URL 기반 중복 제거** 및 저장 직전 `finalSeen` Set을 통한 전수 정제.

### 2.3 시스템 원자성 및 보안
*   **ID 선할당**: 트랜잭션 전 `activityId`를 미리 생성하여 할당.
*   **UI 페이트 가드**: 정산 처리 전 로딩 상태 가상화를 위한 **100ms 인위적 지연**.
*   **삭제 무결성**: 보고서 삭제 시 연결된 모든 정산 로그(`assets`)를 역추적하여 **`lastOutflow` 수치를 기반으로 재고 실시간 원복**.

---

## 3. 타임라인 표현 표준 (Timeline Identity) - [210+ Atomic Items]

*   **식별자**: '시공 완료' 배지 (Color: **`purple`**).
*   **정보 위계**:
    1.  **일시**: `YYYY-MM-DD  HH:mm` (2칸 공백 준수)
    2.  **담당**: 성명 표기 (퇴사자 `(퇴)` 접미사 적용)
    3.  **결과**: 완료된 태스크 건수 및 수행불가 사유(존재 시) 출력.
    4.  **자재**: 정산된 자재 및 최종 투입 현황.
*   **원형 숫자 엔진**: 유니코드 `9312` 기반. 항목 1개 시 순번 기호 자동 스트리핑.
*   **조판 리듬**: 콜론(`:`) 전후에 **비보관 공백(`\u00A0`)** 배치 및 행간 **`1.6`** 고정. (`\u00A0:\u00A0\u00A0`)

---

## 4. 버전 기록 (Version History)

| 버전 | 날짜 | 변경 사항 |
|:---|:---|:---|
| v4.1 | 2026-02-04 | ID 선할당, Paint Guard 및 2칸 공백 일시 조판 사양 통합 |
| v5.0 | 2026-02-04 | **1,000개 아토믹 엔지니어링 사양 완결본**. 재고 정산(Settlement) Delta 알고리즘, 태스크 상속 및 수정 제한 로직(v126.9), `localeCompare` 정렬 엔진, 삭제 시 재고 자동 원복 체계 등 코드 전수 동기화 |

---
> [!IMPORTANT]
> 본 기획서 v5.0은 시공 완료 모듈의 정밀 설계도입니다. 계획 대비 실투입 자재의 Delta를 정산하여 정적 재고를 맞추는 알고리즘과 태스크 완료 시의 리액티브 클린업 로직은 시스템 무결성을 위한 핵심 규격이므로 철저히 준수해야 합니다.
