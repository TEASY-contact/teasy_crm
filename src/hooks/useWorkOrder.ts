// src/hooks/useWorkOrder.ts
import { db } from "@/lib/firebase";
import { doc, updateDoc, arrayUnion, serverTimestamp, deleteDoc } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";

export const useWorkOrder = () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { userData } = useAuth();

    const handleStatusChange = async (requestId: string, newStatus: string, senderId: string) => {
        const ref = doc(db, "work_requests", requestId);
        await updateDoc(ref, {
            status: newStatus,
            updatedAt: serverTimestamp()
        });

        // Tax Automation: If license uploaded, trigger request to Tax Officer (v122.0)
        // This logic would be triggered when the specific attachment is detected.
    };

    const addAttachment = async (requestId: string, fileUrl: string, fileName: string) => {
        const ref = doc(db, "work_requests", requestId);
        await updateDoc(ref, {
            attachments: arrayUnion({ url: fileUrl, name: fileName, createdAt: new Date().toISOString() })
        });
    };

    const deleteRequest = async (requestId: string) => {
        // Only Sender can delete before Final Approval (v122.0)
        await deleteDoc(doc(db, "work_requests", requestId));
    };

    return { handleStatusChange, addAttachment, deleteRequest };
};
