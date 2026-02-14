// src/utils/typeGuards.ts
import { Timestamp } from "firebase/firestore";

/**
 * Firestore Timestamp 타입 가드
 * createdAt 등의 유니온 타입(string | Timestamp | Date)에서 안전하게 .toDate() 호출 가능
 */
export const isTimestamp = (val: unknown): val is Timestamp =>
    !!val && typeof (val as Timestamp).toDate === 'function';
