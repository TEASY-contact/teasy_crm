// src/hooks/useWorkOrder.ts
import { db } from "@/lib/firebase";
import {
    doc, updateDoc, arrayUnion, arrayRemove, serverTimestamp, deleteDoc,
    addDoc, collection, query, where, orderBy, onSnapshot
} from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { WorkRequest, WorkRequestStatus, WorkRequestMessage } from "@/types/work-order";

export const useWorkOrder = () => {
    const { userData } = useAuth();

    // Fetch Requests (Sender OR Receiver) - Real-time
    const getRequests = (userId: string, callback: (requests: WorkRequest[]) => void, role?: string) => {
        if (!userId) return () => { };

        let q;
        if (role === 'master' || role === 'admin') {
            q = query(collection(db, "work_requests"));
        } else {
            q = query(
                collection(db, "work_requests"),
                where("participants", "array-contains", userId)
            );
        }

        return onSnapshot(q, {
            next: (snapshot) => {
                const data = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as WorkRequest[];

                // Sort client-side to avoid complex index requirements
                const sortedData = data.sort((a, b) => {
                    const timeA = a.createdAt?.toMillis?.() || 0;
                    const timeB = b.createdAt?.toMillis?.() || 0;
                    return timeB - timeA;
                });

                callback(sortedData);
            },
            error: (error) => {
                console.error("Firestore Query Error:", error);
            }
        });
    };

    const createRequest = async (title: string, content: string, receiverId: string, attachments: any[] = [], relatedActivityId?: string) => {
        if (!userData) throw new Error("Unauthorized");

        const newRequest = {
            title,
            content,
            senderId: userData.uid,
            receiverId,
            participants: [userData.uid, receiverId], // For easier querying
            status: 'pending' as WorkRequestStatus,
            attachments,
            relatedActivityId: relatedActivityId || null,
            messages: [],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            lastReadTimestamp: serverTimestamp(),
            readStatus: {
                [userData.uid]: true,
                [receiverId]: false
            }
        };

        await addDoc(collection(db, "work_requests"), newRequest);
    };

    const handleStatusChange = async (requestId: string, newStatus: WorkRequestStatus, additionalData: any = {}) => {
        const ref = doc(db, "work_requests", requestId);
        const updateData: any = {
            status: newStatus,
            updatedAt: serverTimestamp(),
            ...additionalData
        };

        if (newStatus === 'review_requested') {
            updateData.reviewRequestedAt = serverTimestamp();
        }

        await updateDoc(ref, updateData);
    };

    const sendMessage = async (requestId: string, content: string) => {
        if (!userData) return;

        const message: WorkRequestMessage = {
            id: Date.now().toString(), // Simple ID
            senderId: userData.uid,
            content,
            timestamp: new Date().toISOString(),
            time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
        };

        const ref = doc(db, "work_requests", requestId);
        await updateDoc(ref, {
            messages: arrayUnion(message),
            updatedAt: serverTimestamp()
        });
    };

    const addAttachment = async (requestId: string, fileUrl: string, fileName: string) => {
        const ref = doc(db, "work_requests", requestId);
        await updateDoc(ref, {
            attachments: arrayUnion({ url: fileUrl, name: fileName, createdAt: new Date().toISOString() })
        });
    };

    const removeAttachment = async (requestId: string, file: any) => {
        const ref = doc(db, "work_requests", requestId);
        await updateDoc(ref, {
            attachments: arrayRemove(file)
        });
    };

    const updateRequest = async (requestId: string, title: string, content: string) => {
        const ref = doc(db, "work_requests", requestId);
        await updateDoc(ref, {
            title,
            content,
            updatedAt: serverTimestamp()
        });
    };

    const deleteRequest = async (requestId: string) => {
        await deleteDoc(doc(db, "work_requests", requestId));
    };

    const markAsRead = async (requestId: string) => {
        if (!userData) return;
        const ref = doc(db, "work_requests", requestId);
        await updateDoc(ref, {
            [`readStatus.${userData.uid}`]: true,
            updatedAt: serverTimestamp()
        });
    };

    return { getRequests, createRequest, handleStatusChange, sendMessage, addAttachment, removeAttachment, updateRequest, deleteRequest, markAsRead };
};
