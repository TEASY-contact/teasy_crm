import { SelectedItem } from "../InstallScheduleForm/types";
import { ActivityType, InquiryFile, ManagerOption } from "@/types/domain";

export interface AsCompleteFormData {
    date: string;
    manager: string;
    asType: string;
    location: string;
    phone: string;
    selectedProducts: SelectedItem[]; // "점검 상품"
    symptoms: { text: string; completed: boolean }[]; // "점검 증상"
    tasks: { text: string; completed: boolean }[]; // "수행 결과"
    selectedSupplies: SelectedItem[]; // "사용 내역" (Inventory settlement)
    symptomIncompleteReason: string; // "점검 불가 사유 (증상용)"
    taskIncompleteReason: string; // "점검 불가 사유 (수행결과용)"
    photos: string[];
    memo: string; // "참고 사항"
    commitmentFiles: InquiryFile[]; // "시공 확약서" (2 images mandatory)
    collectionVideo: InquiryFile | null; // "수거 전 동영상" (1 video mandatory)
    reinstallationVideo: InquiryFile | null; // "설치 후 동영상" (1 video mandatory)
}

export interface AsCompleteFormHandle {
    submit: (managerOptions: ManagerOption[]) => Promise<boolean>;
    delete: () => Promise<boolean>;
}

export const AS_COMPLETE_CONSTANTS = {
    TYPE: "as_complete" as ActivityType,
    TYPE_NAME: "방문 A/S 완료",
    META_PREFIX: "as_complete",
    MAX_PHOTOS: 15,
    STORAGE_PATH_PREFIX: "activities/as_complete"
};
