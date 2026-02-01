// src/utils/excelSecurity.ts
import { format } from "date-fns";

/**
 * v122.0 Excel Password Policy: 0 + MMDD + 9!!
 * Based on the download date.
 */
export const generateExcelPassword = () => {
    const mmdd = format(new Date(), "MMdd");
    return `0${mmdd}9!!`;
};
