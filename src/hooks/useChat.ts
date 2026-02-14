// src/hooks/useChat.ts
"use client";
import { useState, useEffect, useCallback } from "react";
import { db } from "@/lib/firebase";
import {
    collection, addDoc, query, orderBy, limit,
    onSnapshot, serverTimestamp, Timestamp
} from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";

export interface ChatMessage {
    id: string;
    text: string;
    senderId: string;
    senderName: string;
    createdAt: Date | null;
}

const CHAT_COLLECTION = "chat_messages";
const MESSAGE_LIMIT = 50;

export const useChat = () => {
    const { userData } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Real-time subscription
    useEffect(() => {
        const q = query(
            collection(db, CHAT_COLLECTION),
            orderBy("createdAt", "desc"),
            limit(MESSAGE_LIMIT)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs: ChatMessage[] = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    text: data.text || "",
                    senderId: data.senderId || "",
                    senderName: data.senderName || "알 수 없음",
                    createdAt: data.createdAt instanceof Timestamp
                        ? data.createdAt.toDate()
                        : null,
                };
            });
            // Reverse to show oldest first (bottom = newest)
            setMessages(msgs.reverse());
            setIsLoading(false);
        }, (error) => {
            console.error("Chat subscription error:", error);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Send message
    const sendMessage = useCallback(async (text: string) => {
        if (!text.trim() || !userData) return;

        try {
            await addDoc(collection(db, CHAT_COLLECTION), {
                text: text.trim(),
                senderId: userData.uid,
                senderName: userData.name || "알 수 없음",
                createdAt: serverTimestamp(),
            });
        } catch (error) {
            console.error("Failed to send message:", error);
            throw error;
        }
    }, [userData]);

    return {
        messages,
        isLoading,
        sendMessage,
        currentUserId: userData?.uid || "",
    };
};
