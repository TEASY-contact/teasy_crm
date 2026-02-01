// src/hooks/useAutoLock.ts
"use client";
import { useEffect, useRef } from "react";
import { useToast } from "@chakra-ui/react";

export const useAutoLock = (isEditing: boolean, onLock: () => void) => {
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const toast = useToast();

    const resetTimer = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (isEditing) {
            timerRef.current = setTimeout(() => {
                onLock();
                toast({
                    title: "자동 잠금 해제",
                    description: "활동이 없어 잠금이 해제되었습니다. 다시 시도해주세요.",
                    status: "info",
                    duration: 5000,
                    isClosable: true,
                });
            }, 600000); // 10 minutes (v122.0)
        }
    };

    useEffect(() => {
        const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart"];
        events.forEach((name) => document.addEventListener(name, resetTimer));
        resetTimer();
        return () => {
            events.forEach((name) => document.removeEventListener(name, resetTimer));
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [isEditing]);
};
