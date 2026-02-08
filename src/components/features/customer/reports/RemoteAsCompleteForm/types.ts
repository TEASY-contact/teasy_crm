import { SelectedItem } from "../InstallScheduleForm/types";
export type { SelectedItem };

export interface SymptomItem {
    text: string;
    isResolved: boolean;
}

export interface RemoteAsCompleteFormHandle {
    submit: (managerOptions: any[]) => Promise<boolean>;
    delete: () => Promise<boolean>;
}

export interface RemoteAsCompleteFormData {
    date: string;
    manager: string;
    asType: string;
    location: string;
    phone: string;
    selectedProducts: SelectedItem[];
    symptoms: SymptomItem[];
    supportContent: string;
    selectedSupplies: SelectedItem[];
    deliveryInfo?: {
        courier: string;
        shipmentDate: string;
        trackingNumber: string;
        deliveryAddress: string;
    };
    photos: string[];
    memo: string;
    createdAt?: any;
}

export const REMOTE_AS_COMPLETE_CONSTANTS = {
    TYPE: "remoteas_complete",
    TYPE_NAME: "원격 A/S 완료",
    MAX_PHOTOS: 10,
    STORAGE_PATH_PREFIX: "activities/remote_as",
    META_PREFIX: "remoteas_complete"
};
