
export type WorkRequestStatus = 'pending' | 'review_requested' | 'approved' | 'rejected';

export interface WorkRequestAttachment {
    url: string;
    name: string;
    createdAt: string;
}

export interface WorkRequestMessage {
    id: string; // UUID or timestamp based
    senderId: string; // 'me' or user UID, but for DB it should be UID
    content: string;
    timestamp: any; // Firestore Timestamp or string for serialization
    time?: string; // Formatted time string for UI (e.g. "오전 10:00")
}

export interface WorkRequest {
    id: string;
    title: string;
    content: string;
    senderId: string;
    receiverId: string; // Target user UID
    status: WorkRequestStatus;
    attachments?: WorkRequestAttachment[];
    messages?: WorkRequestMessage[];
    relatedActivityId?: string | null;
    createdAt: any;
    updatedAt: any;
    lastReadTimestamp?: any; // For unread message divider logic
    readStatus?: Record<string, boolean>; // { [userId]: boolean }
}
