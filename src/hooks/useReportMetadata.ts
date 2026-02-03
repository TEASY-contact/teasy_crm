// src/hooks/useReportMetadata.ts
"use client";
import { useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useQuery } from "@tanstack/react-query";
import { Asset, User, ManagerOption, ProductOption } from "@/types/domain";

/**
 * Hook to fetch common metadata (Managers, Products, Holidays) for report forms.
 * Uses React Query for caching across different form components.
 */
export const useReportMetadata = () => {
    // 0. Fetch Korean Holidays from API (v124.88: Triple Redundancy)
    const { data: holidayMap } = useQuery({
        queryKey: ["holidays", "kr"],
        queryFn: async () => {
            const currentYear = new Date().getFullYear();
            const yearsToFetch = [currentYear - 1, currentYear, currentYear + 1];

            // Primary: hyunbinseo mirror (Single fetch)
            try {
                const res = await fetch("https://holidays.hyunbin.page/basic.json");
                if (res.ok) return await res.json();
            } catch (e) { console.warn("Primary Holiday API failed"); }

            // Backup 1: taetae98coding mirror (Yearly fetch)
            try {
                const backupMap: any = {};
                await Promise.all(yearsToFetch.map(async (year) => {
                    const bRes = await fetch(`https://taetae98coding.github.io/Holiday/holiday/${year}.json`);
                    if (bRes.ok) {
                        const data = await bRes.json();
                        backupMap[year] = backupMap[year] || {};
                        data.forEach((h: any) => {
                            if (h.isHoliday) {
                                let curr = new Date(h.start);
                                const end = new Date(h.endInclusive);
                                while (curr <= end) {
                                    backupMap[year][curr.toISOString().split('T')[0]] = [h.name];
                                    curr.setDate(curr.getDate() + 1);
                                }
                            }
                        });
                    }
                }));
                if (Object.keys(backupMap).length > 0) return backupMap;
            } catch (e) { console.warn("Backup 1 Holiday API failed"); }

            // Backup 2: Nager.Date Global API (Yearly fetch)
            try {
                const globalBackupMap: any = {};
                await Promise.all(yearsToFetch.map(async (year) => {
                    const gRes = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/KR`);
                    if (gRes.ok) {
                        const data = await gRes.json();
                        globalBackupMap[year] = globalBackupMap[year] || {};
                        data.forEach((h: any) => {
                            globalBackupMap[year][h.date] = [h.localName];
                        });
                    }
                }));
                if (Object.keys(globalBackupMap).length > 0) return globalBackupMap;
            } catch (e) { console.warn("Backup 2 Holiday API failed"); }

            throw new Error("All Holiday APIs failed");
        },
        staleTime: 1000 * 60 * 60 * 24, // 24 hours
        gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days
    });
    // 1. Fetch Assets (Inventory/Product/Divider)
    const { data: rawAssets = [], isLoading: isLoadingAssets } = useQuery({
        queryKey: ["assets", "metadata"],
        queryFn: async () => {
            const qAssets = query(
                collection(db, "assets"),
                where("type", "in", ["product", "inventory", "divider"])
            );
            const snapshot = await getDocs(qAssets);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Asset[];
        }
    });

    // 2. Fetch Users (Managers)
    const { data: allUsers = [], isLoading: isLoadingUsers } = useQuery({
        queryKey: ["users", "managers"],
        queryFn: async () => {
            const userSnap = await getDocs(collection(db, "users"));
            return userSnap.docs.map(d => ({
                id: d.id,
                ...d.data()
            })) as User[];
        }
    });

    // 3. Process Products & Inventory (Memoized)
    const processedAssets = useMemo(() => {
        const seenProducts = new Set();
        const fetchedProducts = rawAssets
            .filter(data => data.type === "product" || (data.type === "divider" && data.dividerType === "product"))
            .map(data => ({
                value: data.type === "divider" ? `divider_${data.id}` : data.name,
                label: data.type === "divider" ? "---" : data.name,
                isDivider: data.type === "divider",
                orderIndex: data.orderIndex ?? 999
            }))
            .sort((a, b) => a.orderIndex - b.orderIndex)
            .filter(item => {
                if (item.isDivider) return true;
                if (seenProducts.has(item.value)) return false;
                seenProducts.add(item.value);
                return true;
            });

        const seenInventory = new Set();
        const fetchedInventory = rawAssets
            .filter(data => data.type === "inventory" || (data.type === "divider" && data.dividerType === "inventory"))
            .map(data => ({
                value: data.type === "divider" ? `divider_${data.id}` : data.name,
                label: data.type === "divider" ? "---" : data.name,
                category: data.category || "",
                isDivider: data.type === "divider",
                isDeliveryItem: !!data.isDeliveryItem,
                orderIndex: data.orderIndex ?? 999
            }))
            .sort((a, b) => a.orderIndex - b.orderIndex)
            .filter(item => {
                if (item.isDivider) return true;
                if (seenInventory.has(item.value)) return false;
                seenInventory.add(item.value);
                return true;
            });

        return {
            products: fetchedProducts.length > 0 ? fetchedProducts : [
                { value: "뷰라클", label: "뷰라클" },
                { value: "CRM", label: "CRM" }
            ],
            inventoryItems: fetchedInventory
        };
    }, [rawAssets]);

    // 4. Process Manager Options (Memoized)
    const managerOptions = useMemo(() => {
        const internalStaff = allUsers
            .filter(u => ['master', 'admin', 'employee'].includes(u.role))
            .map(u => ({
                value: u.id,
                label: u.status === 'banned' ? `${u.name}(퇴)` : u.name,
                role: u.role,
                status: u.status
            }))
            .sort((a, b) => a.label.localeCompare(b.label)) as ManagerOption[];

        const partnerStaff = allUsers
            .filter(u => u.role === 'partner')
            .map(u => ({
                value: u.id,
                label: u.status === 'banned' ? `${u.name}(퇴)` : u.name,
                role: u.role,
                status: u.status
            }))
            .sort((a, b) => a.label.localeCompare(b.label)) as ManagerOption[];

        const final: ManagerOption[] = [...internalStaff];
        if (internalStaff.length > 0 && partnerStaff.length > 0) {
            final.push({ value: "divider", label: "---", isDivider: true });
        }
        final.push(...partnerStaff);
        return final;
    }, [allUsers]);

    return {
        managerOptions,
        products: processedAssets.products,
        inventoryItems: processedAssets.inventoryItems,
        rawAssets,
        holidayMap,
        isLoadingMetadata: isLoadingAssets || isLoadingUsers
    };
};
