export const SCHEDULE_CONSTANTS = {
    TYPE: "demo_schedule",
    TYPE_NAME: "시연 확정",
} as const;

export interface DemoScheduleFormData {
    date: string;
    manager: string;
    location: string;
    phone: string;
    product: string;
    memo: string;
}

export interface DemoScheduleFormHandle {
    submit: () => Promise<boolean>;
    delete: () => Promise<boolean>;
}

export interface DemoScheduleActivity extends DemoScheduleFormData {
    customerId: string;
    customerName: string;
    type: typeof SCHEDULE_CONSTANTS.TYPE;
    typeName: string;
    managerName: string;
    managerRole: string;
    sequenceNumber?: number;
    updatedAt: any; // serverTimestamp
    createdAt?: any;
    createdBy?: string;
    createdByName?: string;
    modificationHistory?: import("@/types/domain").ModificationLog[];
}
