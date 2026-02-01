// src/hooks/useReportMetadata.ts
"use client";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

export interface ManagerOption {
    value: string;
    label: string;
    role?: string;
    isDivider?: boolean;
    status?: string;
}

export interface ProductOption {
    value: string;
    label: string;
    isDivider?: boolean;
}

/**
 * Hook to fetch common metadata (Managers, Products) for report forms.
 * Prevents redundant fetch logic across different form components.
 */
export const useReportMetadata = () => {
    const [managerOptions, setManagerOptions] = useState<ManagerOption[]>([]);
    const [products, setProducts] = useState<ProductOption[]>([]);
    const [isLoadingMetadata, setIsLoadingMetadata] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoadingMetadata(true);
            try {
                // 1. Fetch Products and Dividers from Assets collection
                const qProducts = query(
                    collection(db, "assets"),
                    where("type", "in", ["product", "divider"])
                );
                const productSnapshot = await getDocs(qProducts);

                const fetchedProducts = productSnapshot.docs
                    .map(doc => {
                        const data = doc.data() as any;
                        // Filter out inventory-side dividers if any
                        if (data.type === "divider" && data.dividerType !== "product") return null;

                        return {
                            value: data.type === "divider" ? `divider_${doc.id}` : data.name,
                            label: data.type === "divider" ? "---" : data.name,
                            isDivider: data.type === "divider",
                            orderIndex: data.orderIndex || 999
                        };
                    })
                    .filter((item): item is any => item !== null)
                    .sort((a, b) => a.orderIndex - b.orderIndex);

                setProducts(fetchedProducts.length > 0 ? fetchedProducts : [
                    { value: "뷰라클", label: "뷰라클" },
                    { value: "CRM", label: "CRM" }
                ]);

                // 2. Fetch Users and Group into Managers
                const userSnap = await getDocs(collection(db, "users"));
                const allUsers = userSnap.docs.map(d => ({
                    uid: d.id,
                    ...d.data()
                })) as any[];

                const internalStaff = allUsers
                    .filter(u => ['master', 'admin', 'employee'].includes(u.role))
                    .map(u => ({
                        value: u.uid,
                        label: u.status === 'banned' ? `${u.name}(퇴)` : u.name,
                        role: u.role,
                        status: u.status
                    }))
                    .sort((a, b) => a.label.localeCompare(b.label)) as ManagerOption[];

                const partnerStaff = allUsers
                    .filter(u => u.role === 'partner')
                    .map(u => ({
                        value: u.uid,
                        label: u.status === 'banned' ? `${u.name}(퇴)` : u.name,
                        role: u.role,
                        status: u.status
                    }))
                    .sort((a, b) => a.label.localeCompare(b.label)) as ManagerOption[];

                const finalManagerOptions: ManagerOption[] = [...internalStaff];
                if (internalStaff.length > 0 && partnerStaff.length > 0) {
                    finalManagerOptions.push({ value: "divider", label: "---", isDivider: true });
                }
                finalManagerOptions.push(...partnerStaff);
                setManagerOptions(finalManagerOptions);

            } catch (error) {
                console.error("[useReportMetadata] Error fetching metadata:", error);
            } finally {
                setIsLoadingMetadata(false);
            }
        };

        fetchData();
    }, []);

    return { managerOptions, products, isLoadingMetadata };
};
