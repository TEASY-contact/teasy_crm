// src/components/features/customer/reports/InstallCompleteForm/types.ts
import { SelectedItem } from "../InstallScheduleForm/types";

export interface InstallCompleteFormData {
    date: string;
    manager: string;
    location: string;
    phone: string;
    selectedProducts: SelectedItem[];
    selectedSupplies: SelectedItem[];
    tasksBefore: { text: string; completed: boolean }[];
    tasksAfter: { text: string; completed: boolean }[];
    incompleteReason: string;
    photos: string[];
    memo: string;
}

export interface InstallCompleteFormHandle {
    submit: (managerOptions: any[]) => Promise<boolean>;
    delete: () => Promise<boolean>;
}
export const INSTALL_COMPLETE_CONSTANTS = {
    TYPE: "install_complete",
    TYPE_NAME: "시공 완료",
    META_PREFIX: "install",
    MAX_PHOTOS: 10,
    STORAGE_PATH_PREFIX: "install_complete"
} as const;
