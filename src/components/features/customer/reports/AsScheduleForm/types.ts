// src/components/features/customer/reports/AsScheduleForm/types.ts
import { ActivityType, SelectedItem } from "@/types/domain";
export type { SelectedItem };

export interface AsScheduleFormData {
    date: string;
    manager: string;
    asType: string;
    location: string;
    phone: string;
    selectedProducts: SelectedItem[];
    symptoms: string[];
    tasks: string[];
    selectedSupplies: SelectedItem[];
    photos: string[];
    memo: string;
    sequenceNumber?: number;
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
