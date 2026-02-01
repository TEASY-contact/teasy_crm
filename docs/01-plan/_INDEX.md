---
template: index
version: 1.0
description: Folder document index template
variables:
  - folder: 01-plan
  - phase: Plan
---

# 01-plan Index

> **PDCA Phase**: Plan
> **Last Updated**: 2026-01-31

---

## Document List

| Document | Status | Last Modified | Owner | Description |
|----------|--------|---------------|-------|-------------|
| [features/inventory-management.plan.md](./features/inventory-management.plan.md) | ✅ Approved | 2026-02-01 | TEASY | inventory-management Planning Document |
| [features/product-management.plan.md](./features/product-management.plan.md) | ✅ Approved | 2026-02-01 | Antigravity | product-management Planning Document |

---

## Status Legend

| Status | Meaning | Description |
|--------|---------|-------------|
| ✅ Approved | Finalized | Review complete, reference baseline |
| 🔄 In Progress | Working | Currently being written |
| 👀 In Review | Pending Review | Awaiting review |
| ⏸️ On Hold | Paused | Temporarily stopped |
| ❌ Deprecated | Obsolete | No longer valid |

---

## PDCA Status

```
Current Phase: [Plan] ← You are here

┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐
│  Plan  │───▶│ Design │───▶│   Do   │───▶│ Check  │
│        │    │        │    │ (Impl) │    │(Analyze)│
└────────┘    └────────┘    └────────┘    └────────┘
                                               │
                                               ▼
                                         ┌────────┐
                                         │  Act   │
                                         │(Improve)│
                                         └────────┘
```

---

## Folder Structure

```
01-plan/
├── _INDEX.md          ← Current file
├── features/
│   └── inventory-management.plan.md
└── ...
```

---

## Related Links

| Phase | Folder | Description |
|-------|--------|-------------|
| Plan | [01-plan/](../01-plan/_INDEX.md) | Planning documents |
| Design | [02-design/](../02-design/_INDEX.md) | Design documents |
| Analysis | [03-analysis/](../03-analysis/_INDEX.md) | Analysis results |
| Report | [04-report/](../04-report/_INDEX.md) | Completion reports |

---

## Notes

- Feature planning documents are located in the `features/` subdirectory.

---

## Update History

| Date | Changes |
|------|---------|
| 2026-01-31 | Index created |
