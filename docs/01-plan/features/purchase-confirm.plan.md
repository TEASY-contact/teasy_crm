# 구매 확정 (Purchase Confirm) 기획서

구매 확정 양식은 영업의 최종 결실인 **'매출 확정 및 납품 준비'**를 기록하는 가장 중요한 문서입니다. 결제 방식에 따른 증빙 관리와 납품할 제품군을 정밀하게 정의하도록 설계되었습니다.

---

## 1. 시각 표준 및 UI/UX (Visual & UX)

시스템 전반의 **'Teasy Premium Vibe'**와 전역 시각 표준(v124.71)을 준수합니다.

### 1.1 모달 디자인 상세 (Modal Design Specs)
*   **상품 관리 엔진 (v124.7x)**:
    *   **드래그 앤 드롭**: `framer-motion`의 `Reorder` 컴포넌트 사용. 드래그 핸들 영역 조작 시 `scale: 1.02`, `shadow` 피드백.
    *   **수량 제어**: `-` / `배지` / `+` 버튼 체계. 0 이하 시 삭제 확인 팝업 노출.
    *   **인덱싱**: `getCircledNumber`를 통해 브랜드 컬러 원형 숫자 부여.
    *   **카테고리 자동 감지 (Auto-detect)**: 수정 진입 시 기존 상품의 ID를 분석하여 `Product` 또는 `Inventory` 카테고리를 자동 선택.
    *   **선택 프로세스**: 카테고리 선행 선택 후에만 상품 추가 드롭다운(`isDisabled`) 활성화.
*   **결제 및 증빙 섹션**:
    *   **배경 그룹화**: 결제 매출 상세 영역은 `gray.50` 배경 박스 내 배치.
    *   **증빙 파일 액션**: 업로드된 파일명 옆에 **'확인 / 다운로드 / 삭제'** 버튼 체계와 `gray.300` `/` 구분자 활용. (입금 시에만 노출)
*   **배송 정보 섹션 (Inventory 전용)**:
    *   상품 카테고리가 **'Inventory'**이면서 항목이 추가된 경우 하단 노출.
    *   배송지 주소는 고객 기본 주소(`customer.address`)를 자동 상속.
    *   **발송 일자**: 발송 완료 후 기록하는 원칙에 따라 **과거 시점만 선택 가능** (`limitType="future"`).
*   **플레이스홀더 및 규격 (Verbatim)**:
    *   배송 주소 `placeholder="주소 입력"`, 송장 번호 `placeholder="숫자 입력"`.
    *   구매 일시는 **미래 시점 선택 불가** (`limitType="future"`: Future Disable).
    *   공통 `h="45px"`, `borderRadius="10px"` 준수.

### 1.2 타임라인 카드 UI (Timeline Representation)
*   **헤더**: '구매 확정' 배지(**Color: `purple`**), 구매 일시, 작성자 성명.
*   **정보 리스트**:
    *   **상품**: `상품 :  [{categoryLabel}] {productList}` 
        *   `categoryLabel`: 시공(product) / 배송(inventory)
        *   카테고리명 배지(`gray.100`) + 원형 숫자 순번 + CRM 변환 명칭 통합 노출.
    *   **결제**: `결제 :  {payMethod}`
    *   **금액 (Sub)**: `금액 :  {amount}원` (천 단위 콤마, `isSubItem: true`, `isFirstSubItem: true`)
    *   **할인 (Sub)**: `할인 :  {discount} ({Value})` 
        *   `Value`는 `discountAmount`일 경우 포맷팅된 금액(마이너스 기호 포함), 유저 아이디(userId)일 경우 아이디 노출. (`isSubItem: true`)
    *   **증빙 (Sub)**: `증빙 :  {FileName}` (입금 시에만 `TimelineFileList` 노출, `isSubItem: true`)
    *   **배송 (Inventory 전용)**: 
        *   `배송 :  {shipmentDate}  /  {deliveryAddress}` 통합 노출.
        *   `업체 (Sub)`: {courier} (CJ, 로젠, 우체국 / `isSubItem: true`, `isFirstSubItem: true`)
        *   `송장 (Sub)`: {trackingNumber} (`isSubItem: true`)

---

## 2. 기능 및 비즈니스 로직 (Functionality & Logic)

### 2.1 원자적 트랜잭션 및 재고 관리 (Integrity)
*   **Atomicity (원자성)**: 
    *   `runTransaction` 내에서 **[재고 차감 → Assets 로그 생성 → 고객 ownedProducts 합산 → 순번 발행 → 마스터 갱신]**이 단일 사이클로 처리됨.
*   **사전 읽기 (Pre-transaction Read)**: 
    *   트랜잭션 진입 전 품목별 총 차감 수량을 `aggregatedProductsMap`으로 선계산한 뒤, 트랜잭션 내에서 메타 데이터를 읽어들임.
*   **자가 치유 (Self-Healing)**: 
    *   DB 업데이트 후 백그라운드에서 `performSelfHealing` 로직이 전체 재고 합산 값을 재검증하여 일관성 확보.
 
 ### 2.2 동적 UI 로직 (Dynamic Logic)
 *   **결제 방식별 할인 옵션 (Conditional Options)**: `payMethod` 선택에 따라 할인 드롭다운 메뉴가 즉시 변경됨.
     *   **"입금"**: `["미적용", "현금 할인"]`
     *   **"네이버"**: `["미적용", "divider", "할인쿠폰 5%", "할인쿠폰 8%"]`
     *   **그 외 (자사몰 등)**: `["미적용", "divider", "쿠폰 할인"]`

### 2.2 자원 관리 및 데이터 표준 (Integration)
*   **파일명 정규화 (Regex)**: 업로드 시 모든 공백 및 보이지 않는 특수 문자를 언더바(`_`)로 치환.
    *   **Pattern**: `/[\s\u00A0\u1680\u180e\u2000-\u200a\u202f\u205f\u3000\ufeff]/g`
*   **물리적 소거**: 보고서 삭제 시 연결된 세금계산서 파일 `deleteObject` 수행.
*   **삭제 복구 (Recovery)**: 보고서 삭제 시 차감되었던 재고 수량을 `lastAction: "delete_recovery"` 플래그와 함께 자동 복구.

### 2.3 필수 입력 및 검증 (Form Validation)
*   **배송 정보 정합성**: 배송 업체(`courier`) 또는 송장 번호(`trackingNumber`) 입력 시에만 **발송 주소(`deliveryAddress`)**가 필수 검증됨 (단순 발송일자 존재 시엔 미검증).
*   **공통 필수**: 구매 일시, 담당자, 결제 방식, 결제 금액, 상품(최소 1개, 배열 길이 체크).

---

## 3. 시각 브랜드 세부 표준 (Visual Brand Standards)
*   **콜론 규격 (Verbatim Spacing)**: 모든 라벨의 콜론은 반드시 **'전 1칸, 후 2칸'** 공백 규격(` :  `)을 준수함.
*   **ThinParen 적용**: 수량(`×`), 괄호(`()`), 슬래시(`/`), 대괄호(`[]`) 등 모든 보조 기호는 `ThinParen` 적용.
*   **날짜 표기**: 연-월-일과 시:분 사이에 **2칸 공백** 사용. (`YYYY-MM-DD  HH:mm`)

---

## 4. 버전 기록 (Version History)

| 버전 | 날짜 | 변경 사항 |
|:---|:---|:---|
| v1.0 | 2026-02-03 | 구매 확정 기획서 초안 작성 |
| v1.1 | 2026-02-03 | 할인/증빙/배송 계층형(SubItem) 노출 및 금액 포맷팅 반영 |
| v1.2 | 2026-02-03 | 재고 삭제 복구(delete_recovery) 및 파일명 정규화 Regex 명문화 |

---
> [!IMPORTANT]
> 본 문서는 '구매 확정' 모듈의 구현 기준점입니다. 결제 증빙 관리와 재고 트랜잭션의 무결성을 위해 본 지침을 최우선으로 준수합니다.
