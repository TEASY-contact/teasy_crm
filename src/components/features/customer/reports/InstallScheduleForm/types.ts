// src/components/features/customer/reports/InstallScheduleForm/types.ts
import { SelectedItem } from "@/types/domain";
export type { SelectedItem };

export const INSTALL_SCHEDULE_CONSTANTS = {
    TYPE: "install_schedule",
    TYPE_NAME: "시공 예약",
    META_PREFIX: "install",
    MAX_PHOTOS: 10,
    STORAGE_PATH_PREFIX: "install_schedule"
} as const;

export interface InstallScheduleFormData {
    date: string;
    manager: string;
    location: string;
    phone: string;
    selectedProducts: SelectedItem[];
    selectedSupplies: SelectedItem[];
    tasksBefore: string[];
    tasksAfter: string[];
    photos: string[];
    memo: string;
}

export interface InstallScheduleFormHandle {
    submit: (managerOptions: any[]) => Promise<boolean>;
    delete: () => Promise<boolean>;
}
