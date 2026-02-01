// src/types/timeline.ts
export type StepType =
    | 'inquiry' | 'demo_schedule' | 'demo_complete' | 'purchase_confirm'
    | 'install_schedule' | 'install_complete' | 'as_schedule' | 'as_complete' | 'remoteas_complete';

export interface TimelineItem {
    id: string;
    stepType: StepType;
    createdAt: string;
    createdBy: string;
    createdByName: string;
    managerName?: string;
    managerRole?: string;
    content: any;
    customerName?: string;
}
