# Baseline Specification: Customer Management & Timeline

This document captures the current (Visual Freeze) state of the CRM before the real-time (`onSnapshot`) migration.

## 1. Customer Management Page (`/customers`)
- **UI Structure (CustomerTable)**: 
  - **Fixed Layout**: `tableLayout: "fixed"`.
  - **Column Widths**: Box(3%), No.(6%), Name(10%), Phone(12%), Address(28%), Owned Products(18%), Distributor(9%), Reg. Date(10%), Detail(4%).
  - **Truncation**: Uses `TruncatedTooltip` (only shows mapping on hover if text is clipped).
- **Search Logic**:
  - **Normalization**: Keyword and data are both converted to lowercase and stripped of hyphens/spaces (`replace(/[-\s]/g, "")`).
  - **Fields**: Matches name, phone, sub_phones, address, sub_addresses, license, ownedProducts, notes, and distributor.
- **Sorting Options**: "선택 안함", "이름 가나다", "등록일", "활동일".
- **Security Actions**: Bulk delete, Download (Selected/All), and Bulk Register are strictly restricted to the **Master** role.

## 2. Customer Detail & Timeline (`/customers/[id]`)

### 📋 UI Structure (TimelineCard & Items)
- **Visual Standards**:
  - **Date Formatting**: `YYYY-MM-DD  HH:mm`. Components (`TimelineInfoItem`, `TimelineFileList`) automatically replace a single space with **double-spaces**.
  - **Hierarchy Symbols**: `└ ·` for first sub-item, `  ·` for subsequent (16px indent).
  - **Colon Spacing**: Enforces **" 1 space before : 2 spaces after "** rule via `applyColonStandard`. Time formats (e.g., `HH:mm`) and digit ranges are **strictly excluded** from this rule.
  - **Manager Status**: `(퇴)` for banned managers and text colored `gray.400` (Highlighting disabled).
  - **Partner Status**: `partner` role displays a `yellow.400` "협력사" badge.
  - **Text Separation**: `\u00A0:\u00A0\u00A0` separator in `TimelineInfoItem`.
  - **Product Listing**: "crm" is normalized to **"CRM"**. Multi-item products use `①`, `②`.
  - **TimelineBadge**: Displays `(count)` for multiple activities. Hover effect includes `translateY(-1px)`.
  - **Memo Box**: Uses specific scrollbar styling: `width: 4px`, `background: rgba(0,0,0,0.08)`, `borderRadius: 10px`.
  - **Dynamic Labels**: Labels like "주소/장소", "사용/준비" change based on `stepType`.

### 🛠️ Logic & Data Handling
- **Timeline Sorting**: Ascending (Oldest first). Priority: `date` (numbers only) -> `sequenceNumber` -> `createdAt`.
- **Date Normalization**: All business logic (Sorting, Holiday checks) uses **Asia/Seoul (KST)** timezone.
- **Inheritance**: Completion reports inherit `manager`, `location`, `phone`, `product` from schedules.
- **Permissions**:
  - **Edit Window**: Author/Admin can only edit within **3 business days** (Excluding weekends and official Korean holidays).
  - **Holiday Sync**: Uses triple-redundant APIs (hyunbin.page, taetae98coding, Nager.Date).
  - **Delete**: STRICTLY restricted to the **Master** role.
- **Form & Media Logic**:
  - **Focus Guard**: Modals use an invisible `tabIndex={0}` Box to prevent focus jumping.
  - **File Viewers**:
    - **Standard Naming**: Enforces `{CleanCustomer}_{Category}_{YYYYMMDD}` via `getTeasyStandardFileName`.
    - **Audio**: Automatically plays on open; supports `MP3`, `WAV`, `M4A`, `AAC`, `OGG`, `WMA`, `WEBM`.
    - **PDF**: Uses `iframe` with `#view=FitV&toolbar=0&navpanes=0`. Default scale `0.18`.
    - **Images**: Default scale `0.80`.
    - **Downloads**: Sequential download with **200ms delay** per file to prevent browser blocking.
  - **Data Integrity**:
    - **Dropdown Deduplication**: Products and Inventory lists are deduplicated by name during fetch.
    - **Sequence Pairing**: Completion reports (`as_complete`, `demo_complete`) sync their `sequenceNumber` with their authorizing `schedule` records.
    - **Locked State**: New customers initialized with `isLocked: false` and `lockedBy: null`.
    - **Default Manager**: Registration defaults to "정민권".
- **Profile Data**:
  - **Owned Products**: Auto-cumulative update via `purchase_confirm`.
  - **License**: **Manual Field Only**.
  - **Last Consult Date**: Updated by all reports.
