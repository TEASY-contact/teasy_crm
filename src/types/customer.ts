// src/types/customer.ts
export interface Customer {
    id: string;
    no?: number;
    name: string;
    phone: string;
    address: string;
    distributor?: string;
    sub_phones?: string[];
    sub_addresses?: string[];
    ownedProducts?: string[];
    manager: string;
    registeredDate: string;
    license?: string;
    notes?: string;
    lastConsultDate: string | null;
    isLocked: boolean;
    lockedBy: string | null;
}

