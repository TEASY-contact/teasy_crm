export const INQUIRY_CONSTANTS = {
    TYPE: "inquiry",
    TYPE_NAME: "신규 문의",
} as const;

export interface InquiryFormData {
    date: string;
    manager: string;
    channel: "전화 문의" | "네이버 톡톡" | "채널톡" | "기타" | "";
    nickname: string;
    phone: string;
    product: string;
    result: "구매 예정" | "시연 확정" | "시연 고민" | "관심 없음" | "";
    memo: string;
}

export interface InquiryFile {
    id: string;
    url: string;
    name: string;
    displayName: string;
    ext: string;
}

export interface InquiryFormHandle {
    submit: (managerOptions: any[]) => Promise<boolean>;
    delete: () => Promise<boolean>;
}

export interface InquiryActivity extends InquiryFormData {
    customerId: string;
    customerName: string;
    type: typeof INQUIRY_CONSTANTS.TYPE;
    typeName: typeof INQUIRY_CONSTANTS.TYPE_NAME;
    managerName: string;
    managerRole: string;
    recordings: InquiryFile[];
    quotes: InquiryFile[];
    sequenceNumber?: number;
    createdAt?: any;
    updatedAt: any;
    createdBy?: string;
    createdByName: string;
}
