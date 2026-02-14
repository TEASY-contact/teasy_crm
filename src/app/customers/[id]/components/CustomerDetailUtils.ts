// src/app/customers/[id]/components/CustomerDetailUtils.ts

export const getOnlyDate = (dateStr?: string) => (dateStr || "").split(' ')[0] || "-";
