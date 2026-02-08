// src/hooks/useWorkManagerSettings.ts
"use client";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

export interface WorkManagerSettings {
    bizRegistrationManagerId?: string;
    taxInvoiceManagerId?: string;
    scheduleManagerId?: string;
    firstFollowupManagerId?: string;
    nthFollowupManagerId?: string;
}

export const useWorkManagerSettings = () => {
    const [settings, setSettings] = useState<WorkManagerSettings>({});
    const [isLoading, setIsLoading] = useState(true);

    const loadSettings = async () => {
        try {
            setIsLoading(true);
            const ref = doc(db, "settings", "work_managers");
            const snap = await getDoc(ref);
            if (snap.exists()) {
                setSettings(snap.data() as WorkManagerSettings);
            }
        } catch (e) {
            console.error("Failed to load work manager settings:", e);
        } finally {
            setIsLoading(false);
        }
    };

    const saveSettings = async (newSettings: WorkManagerSettings) => {
        try {
            const ref = doc(db, "settings", "work_managers");
            await setDoc(ref, {
                ...newSettings,
                updatedAt: serverTimestamp()
            });
            setSettings(newSettings);
        } catch (e) {
            console.error("Failed to save work manager settings:", e);
            throw e;
        }
    };

    useEffect(() => {
        loadSettings();
    }, []);

    return { settings, saveSettings, isLoading, refresh: loadSettings };
};
