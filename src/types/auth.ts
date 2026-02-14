// src/types/auth.ts
export type { UserRole } from './domain';
import { UserRole, UserStatus } from './domain';
import { Timestamp } from "firebase/firestore";

export interface UserData {
    uid: string;
    name: string;
    email: string;
    role: UserRole;
    canAccessCustomerData: boolean;
    kakaoWorkEnabled: boolean;
    lastSessionId: string;
    badgeChar?: string;
    representativeColor: string;
    status: UserStatus;
    bannedUntil?: string;
    createdAt?: Timestamp | Date | string;
    lastLogin?: Timestamp | Date | string;
}
