// src/components/features/customer/reports/PurchaseConfirmForm/types.ts
import { DeliveryInfo, InquiryFile as TaxInvoiceFile } from "@/types/domain";

export interface SelectedProduct {
    id: string;
    name: string;
    quantity: number;
    masterId?: string;
}

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
