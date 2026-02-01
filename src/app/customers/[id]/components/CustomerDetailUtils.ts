// src/app/customers/[id]/components/CustomerDetailUtils.ts

export { DISTRIBUTOR_COLORS } from "@/utils/constants";

export const getOnlyDate = (dateStr?: string) => (dateStr || "").split(' ')[0] || "-";
