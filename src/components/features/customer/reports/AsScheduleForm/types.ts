// src/components/features/customer/reports/AsScheduleForm/types.ts
import { ActivityType } from "@/types/domain";

export interface AsScheduleFormData {
    date: string;
    manager: string;
    location: string;
    phone: string;
    product: string;
    symptoms: string[];
    photos: string[];
    memo: string;
}

export interface AsScheduleFormHandle {
    submit: (managerOptions: any[]) => Promise<boolean>;
    delete: () => Promise<boolean>;
}

export const AS_SCHEDULE_CONSTANTS = {
    TYPE: "as_schedule" as ActivityType,
    TYPE_NAME: "방문 A/S 확정",
    META_PREFIX: "as_schedule",
    MAX_PHOTOS: 10,
    STORAGE_PATH_PREFIX: "activities/as_schedule"
};
