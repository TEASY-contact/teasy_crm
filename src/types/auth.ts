// src/types/auth.ts
export type UserRole = 'master' | 'admin' | 'employee' | 'partner';

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
    status: 'active' | 'banned';
    bannedUntil?: string;
    createdAt?: any;
    lastLogin?: any;
}
