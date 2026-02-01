// src/components/features/customer/reports/InstallScheduleForm/types.ts
export interface SelectedItem {
    id: string; // For supplies: product_id + "_" + supply_id (auto) or supply_id (manual)
    name: string;
    quantity: number;
    category?: string;
    isAuto?: boolean;
    linkedId?: string; // Links supply to a specific product
}

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
