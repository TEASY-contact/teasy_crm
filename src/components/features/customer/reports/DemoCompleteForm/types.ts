export const DEMO_CONSTANTS = {
    TYPE: "demo_complete",
    TYPE_NAME: "시연 완료",
    STORAGE_PATH_PREFIX: "site_photos",
    MAX_PHOTOS: 15,
    RESULTS: [
        { value: "구매의향 높음", label: "구매의향 높음" },
        { value: "구매의향 보통", label: "구매의향 보통" },
        { value: "구매의향 낮음", label: "구매의향 낮음" }
    ],
    DISCOUNT_TYPES: [
        { value: "할인 없음", label: "할인 없음" },
        { value: "divider", label: "---", isDivider: true },
        { value: "현금 할인", label: "현금 할인" },
        { value: "네이버 쿠폰", label: "할인 쿠폰" }
    ],
    NAVER_COUPONS: [
        { value: "네이버 5%", label: "네이버 5%" },
        { value: "네이버 8%", label: "네이버 8%" }
    ]
} as const;

export interface DemoCompleteFormData {
    date: string;
    manager: string;
    location: string;
    phone: string;
    product: string;
    result: string;
    discountType: string;
    discountValue: string;
    memo: string;
    photos: string[];
}

export interface DemoCompleteActivity extends DemoCompleteFormData {
    customerId: string;
    customerName: string;
    type: typeof DEMO_CONSTANTS.TYPE;
    typeName: string;
    managerName: string;
    managerRole: string;
    sequenceNumber?: number;
    updatedAt: any; // serverTimestamp
    createdAt?: any;
    createdBy?: string;
    createdByName: string;
}

export interface ManagerOption {
    value: string;
    label: string;
    role?: string;
}
