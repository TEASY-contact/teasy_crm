// src/components/features/customer/reports/PurchaseConfirmForm/types.ts
import { DeliveryInfo, InquiryFile as TaxInvoiceFile, SelectedProduct } from "@/types/domain";
export type { SelectedProduct };

export interface PurchaseFormData {
    date: string;
    manager: string;
    selectedProducts: SelectedProduct[];
    payMethod: string;
    amount: string | number;
    discount: string;
    discountAmount: string | number;
    userId: string;
    memo: string;
    deliveryInfo: DeliveryInfo;
    taxInvoice?: TaxInvoiceFile;
}
