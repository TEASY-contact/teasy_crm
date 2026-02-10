// src/hooks/useAutomationConfig.ts
"use client";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import {
    doc, getDoc, setDoc, collection, getDocs, serverTimestamp
} from "firebase/firestore";
import { User } from "@/types/domain";

export interface AutomationConfig {
    bizLicenseManagerId: string;    // 사업자등록증 담당자 UID
    taxInvoiceManagerId: string;    // 전자세금계산서 담당자 UID
}

const CONFIG_DOC_PATH = "admin_settings/automation_config";

export const useAutomationConfig = () => {
    const [config, setConfig] = useState<AutomationConfig>({
        bizLicenseManagerId: "",
        taxInvoiceManagerId: "",
    });
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Fetch config + users on mount
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // 1. Fetch automation config
                const configSnap = await getDoc(doc(db, CONFIG_DOC_PATH));
                if (configSnap.exists()) {
                    const data = configSnap.data();
                    setConfig({
                        bizLicenseManagerId: data.bizLicenseManagerId || "",
                        taxInvoiceManagerId: data.taxInvoiceManagerId || "",
                    });
                }

                // 2. Fetch active users (exclude banned)
                const userSnap = await getDocs(collection(db, "users"));
                const activeUsers = userSnap.docs
                    .map(d => ({ id: d.id, ...d.data() } as User))
                    .filter(u => u.status !== "banned")
                    .sort((a, b) => a.name.localeCompare(b.name));
                setUsers(activeUsers);
            } catch (e) {
                console.error("Failed to fetch automation config:", e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    // Save config
    const saveConfig = async (newConfig: AutomationConfig) => {
        setIsSaving(true);
        try {
            await setDoc(doc(db, CONFIG_DOC_PATH), {
                ...newConfig,
                updatedAt: serverTimestamp(),
            }, { merge: true });
            setConfig(newConfig);
            return true;
        } catch (e) {
            console.error("Failed to save automation config:", e);
            return false;
        } finally {
            setIsSaving(false);
        }
    };

    return { config, users, isLoading, isSaving, saveConfig };
};
