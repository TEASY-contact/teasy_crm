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
