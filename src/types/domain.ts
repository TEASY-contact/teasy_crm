// src/types/domain.ts
import { Timestamp } from "firebase/firestore";

/**
 * Base document structure for Firestore
 */
export interface BaseDoc {
    id: string; // Document ID
    createdAt?: Timestamp | Date | any;
    updatedAt?: Timestamp | Date | any;
    createdBy?: string;
    createdByName?: string;
}

/**
 * Manager/Staff roles and status
 */
export type UserRole = 'master' | 'admin' | 'employee' | 'partner';
export type UserStatus = 'active' | 'banned' | 'inactive';

export interface User extends BaseDoc {
    uid: string; // Auth UID
    name: string;
    email: string;
    role: UserRole;
    status: UserStatus;
    phone?: string;
    badgeChar?: string;
    representativeColor?: string;
    kakaoWorkEnabled?: boolean;
    canAccessCustomerData?: boolean;
}

/**
 * UI Option Types
 */
export interface ManagerOption {
    value: string; // UID
    label: string; // Name
    role?: UserRole;
    isDivider?: boolean;
    status?: UserStatus;
}

export interface ProductOption {
    value: string; // Item Name or ID
    label: string;
    category?: string;
    isDivider?: boolean;
    isDeliveryItem?: boolean;
    orderIndex?: number;
}

/**
 * Customer domain
 */
export interface Customer extends BaseDoc {
    no?: number;
    name: string;
    phone: string;
    address: string;
    distributor?: string;
    sub_phones?: string[];
    sub_addresses?: string[];
    ownedProducts?: string[];
    manager?: string; // Manager name or ID
    managerId?: string; // Specific UID
    registeredDate?: string;
    license?: string;
    notes?: string;
    memo?: string;
    lastConsultDate: string | null;
    isLocked?: boolean;
    lockedBy?: string | null;
}

/**
 * Activity (Reports) domain
 */
export type ActivityType =
    | 'inquiry'
    | 'demo_schedule' | 'demo_complete'
    | 'purchase_confirm'
    | 'install_schedule' | 'install_complete'
    | 'as_schedule' | 'as_complete' | 'remoteas_complete'
    | 'customer_registered';

export interface Activity extends BaseDoc {
    customerId: string;
    customerName: string;
    type: ActivityType;
    typeName: string;
    date: string; // Action date (YYYY-MM-DD HH:mm)
    manager: string; // Manager UID
    managerName: string;
    managerRole: UserRole;
    memo: string;
    sequenceNumber?: number;

    // Optional fields depending on type
    product?: string;
    location?: string;
    phone?: string; // Field contact
    result?: string;

    // Purchase specific
    payMethod?: string;
    amount?: number;
    discount?: string;
    discountAmount?: number;
    userId?: string;
    productCategory?: 'product' | 'inventory';
    selectedProducts?: any[];
    selectedSupplies?: any[];
    tasksBefore?: any[];
    tasksAfter?: any[];
    incompleteReason?: string;
    deliveryInfo?: DeliveryInfo;
    taxInvoice?: InquiryFile;

    // Inquiry & Demo specific
    channel?: string;
    nickname?: string;
    recordings?: InquiryFile[];
    quotes?: InquiryFile[];
    photos?: string[];
    discountType?: string;
    discountValue?: string;

    // A/S specific
    symptoms?: any[];
    tasks?: any[];
    symptomIncompleteReason?: string;
    taskIncompleteReason?: string;
    asType?: string;
    actions?: any[];
    commitmentFiles?: InquiryFile[];
    collectionVideo?: InquiryFile | null;
    reinstallationVideo?: InquiryFile | null;

    // Compatibility for work_requests or nested content
    category?: string;
    content?: any;
}

export interface InquiryFile {
    id: string;
    url: string;
    name: string;
    displayName: string;
    ext: string;
}

export interface DeliveryInfo {
    courier: string;
    shipmentDate: string;
    trackingNumber: string;
    deliveryAddress: string;
}

/**
 * Assets (Inventory / Product) domain
 */
export interface Asset extends BaseDoc {
    type: 'inventory' | 'product' | 'divider';
    category: string;
    name: string;
    spec?: string;
    price?: number;
    stock?: number;
    orderIndex?: number;

    // Inventory specific
    lastInflow?: number | null;
    lastOutflow?: number | null;
    lastRecipient?: string;
    lastRecipientId?: string;
    isDeliveryItem?: boolean;
    sourceActivityId?: string;
    lastActionDate?: string;
    lastOperator?: string;
    editLog?: string;
    editTime?: string;
    editOperators?: string;

    // Product specific
    composition?: string;
    dividerType?: 'inventory' | 'product';
}
