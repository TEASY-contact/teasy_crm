// src/hooks/useChat.ts
"use client";
import { useState, useEffect, useCallback } from "react";
import { db } from "@/lib/firebase";
import {
    collection, addDoc, query, where,
    onSnapshot, serverTimestamp, Timestamp
} from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";

export interface ChatMessage {
    id: string;
    text: string;
    senderId: string;
    senderName: string;
    createdAt: Date | null;
    chatDate: string;
}

const CHAT_COLLECTION = "chat_messages";

const toDateString = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
};

export const useChat = (selectedDate: Date) => {
    const { userData } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const dateStr = toDateString(selectedDate);
    const todayStr = toDateString(new Date());
    const isToday = dateStr === todayStr;

    // Real-time subscription filtered by chatDate
    useEffect(() => {
        setIsLoading(true);

        const q = query(
            collection(db, CHAT_COLLECTION),
            where("chatDate", "==", dateStr)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs: ChatMessage[] = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    text: data.text || "",
                    senderId: data.senderId || "",
                    senderName: data.senderName || "알 수 없음",
                    chatDate: data.chatDate || "",
                    createdAt: data.createdAt instanceof Timestamp
                        ? data.createdAt.toDate()
                        : null,
                };
            });
            // Sort client-side (oldest first)
            msgs.sort((a, b) => {
                const ta = a.createdAt?.getTime() ?? Date.now();
                const tb = b.createdAt?.getTime() ?? Date.now();
                return ta - tb;
            });
            setMessages(msgs);
            setIsLoading(false);
        }, (error) => {
            console.error("Chat subscription error:", error);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [dateStr]);

    // Send message (only allowed for today)
    const sendMessage = useCallback(async (text: string) => {
        if (!text.trim() || !userData || !isToday) return;

        try {
            await addDoc(collection(db, CHAT_COLLECTION), {
                text: text.trim(),
                senderId: userData.uid,
                senderName: userData.name || "알 수 없음",
                chatDate: todayStr,
                createdAt: serverTimestamp(),
            });
        } catch (error) {
            console.error("Failed to send message:", error);
            throw error;
        }
    }, [userData, isToday, todayStr]);

    return {
        messages,
        isLoading,
        sendMessage,
        isToday,
        currentUserId: userData?.uid || "",
    };
};
