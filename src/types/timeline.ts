// src/types/timeline.ts
import { ReactNode } from "react";
import { Activity, InquiryFile, ModificationLog, SelectedProduct, SelectedItem } from "./domain";

export type StepType =
    | 'inquiry' | 'demo_schedule' | 'demo_complete' | 'purchase_confirm'
    | 'install_schedule' | 'install_complete' | 'as_schedule' | 'as_complete' | 'remoteas_complete';

export interface ContentItem {
    label: string;
    value: string | number | boolean | null | ReactNode;
    isHighlight?: boolean;
    isSubItem?: boolean;
    isFirstSubItem?: boolean;
    isCustomValue?: boolean;
    pl?: string;
}

export interface TimelineItem {
    id: string;
    stepType: StepType;
    createdAt: string;
    createdBy: string;
    createdByName: string;
    managerName?: string;
    managerRole?: string;
    content: Record<string, unknown> | Activity;
    customerName?: string;

    // Activity fields accessed via `{ ...item, ...(item.content || {}) }` spread
    date?: string;
    memo?: string;
    channel?: string;
    nickname?: string;
    product?: string;
    location?: string;
    phone?: string;
    result?: string;
    asType?: string;
    supportContent?: string;
    region?: string;
    startTime?: string;

    // File attachments
    recordings?: InquiryFile[];
    quotes?: InquiryFile[];
    photos?: string[];
    commitmentFiles?: InquiryFile[];
    collectionVideo?: InquiryFile | null;
    reinstallationVideo?: InquiryFile | null;
    taxInvoice?: InquiryFile;

    // Structured data
    selectedProducts?: SelectedProduct[] | SelectedItem[];
    selectedSupplies?: SelectedItem[];
    modificationHistory?: ModificationLog[];

    // Purchase specific
    payMethod?: string;
    amount?: number;
    discount?: string;
    discountAmount?: number;
    discountType?: string;
    discountValue?: string;
    name?: string;
}
