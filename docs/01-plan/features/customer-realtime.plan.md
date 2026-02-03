# Plan: Real-time Refactoring (onSnapshot)

This plan moves the CRM from a "Pull" (getDocs + artificial delay) model to a "Push" (onSnapshot + setQueryData) model. The primary objective is to maintain **absolute forensic fidelity** to the 26-tier audit results while achieving immediate state synchronization.

## 🛡️ Core Constraints (Audit Redlines)

The following rules **MUST** be preserved in the listener and refactoring logic without exception:

### 1. Visual & Typographic Standards
*   **ThinParen (300) Standard**: Standardize `fontWeight: 300` for exactly 8 characters across all components: `(`, `)`, `-`, `/`, `×`, `x`, `X`, `_`.
*   **Date/Time Injection**: Preserve the **Double-Space** (`  `) between YYYY-MM-DD and HH:mm via `\u00A0\u00A0` or manual injection. Convert all `/` to `-`.
*   **Colon Spacing**: Enforce the `1-before, 2-after` rule (`\u00A0:\u00A0\u00A0`) to prevent break-lines.
*   **Pixel-Perfect Atoms**: 
    *   Surname Badge: `transform: translate(0.3px, -0.5px)`.
    *   Premium Glassmorphism: Background opacity **15%** (`...15` hex suffix) + **15px** backdrop-filter blur.
    *   Button Physics: Hover `translateY(-1px)`, Active `scale(0.97)`.
*   **Tooltip Truncation**: Tooltips must only activate if `scrollWidth > clientWidth` (Intelligent Truncation Guard).

### 2. Analytical & Forensic Logic
*   **3-tier Timeline Sort**: Callbacks must execute: `[date.replace(/\D/g, "")] ASC` -> `[sequenceNumber] ASC` -> `[createdAt] ASC`.
*   **9-field Search Scope**: Normalization must use `/[-\s]/g` across Name, Phone, Sub-phones, Address, Sub-addresses, License, Products, Notes, and Distributor.
*   **Smart Name Normalization**: Force "crm" (any case) to uppercase **"CRM"**.
*   **Dynamic Timeline Labels**: Toggle labels based on context: "사용" (Complete), "준비" (Schedule), "물품" (Products).
*   **Geographic Parsing**: Remove "시" suffix; map "서울특별시" → "서울", "광주광역시" → "광주".

### 3. Business & Security Rules
*   **Edit Lock (3-Day Rule)**: Enforce the 3-business day restriction (using API holidays) for non-Master users.
*   **Inquiry Hard-Block**: "Phone" channel choice **must** block submission if `recordings` list is empty.
*   **Inquiry Data Succession**: Switching to "Phone" channel must instantly inherit `customer.phone`.
*   **Timeline Indentation (`pl: 56px`)**: Apply precise horizontal offset for outcome-reason boxes in the output view to align with status icons.
*   **Excel Security**: Passwords follow `0 + {MMDD} + 9!!` based on the download date.
*   **Multi-download Control**: Implement/Ensure the **200ms mechanical delay** between file triggers.

---

## 🛠️ Proposed Changes

### 1. [Component] Customer List
-   **Subscription**: Initialize `onSnapshot` for `collection(db, "customers")`.
-   **Integration**: Sync with `queryClient.setQueryData(["customers", "list"], ...)`. Remove artificial 500ms refresh delays.

### 2. [Component] Customer Detailed View
-   **Atomic Subscriptions**:
    -   Listener A: `doc(db, "customers", id)`.
    -   Listener B: `query(collection(db, "activities"), where("customerId", "==", id))`.
-   **Sort Lock**: Apply the **3-tier Sort Logic** immediately within the activities listener.
-   **Layout**: Maintain `maxH="calc(100vh - 250px)"` for detail modals and `400px` for selection menus.

### 3. [Component] Multimedia & Files
-   **PhotoViewer Geometry**: Lock to `maxW="90vw"` and `maxH="85vh"`.
-   **Storage**: Enforce customer-ID based siloing (`${customerId}/...`).

---

## ✅ Verification Protocol
1.  **Immediate Visibility**: Documents must appear instantly in the correct chronological slot upon transaction commit.
2.  **Pixel Parity**: Verify `0.3px` translation and `15px` blur via inspector.
3.  **ThinParen Coverage**: Ensure `x/X` is correctly light-weighted in all table cells.

---
**[🛡️ System Rules Check]**
1. ✅ **Unrequested Changes:** None.
2. ✅ **Visual Freeze:** Confirmed via 26-tier audit benchmarks.
3. ✅ **Dependencies:** Mapped across Auth, Assets, and MediaViewer.
