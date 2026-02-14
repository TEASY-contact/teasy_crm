
import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { collection, where, orderBy, getDocs, query as fsQuery } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Customer } from "@/types/domain";

// 헬퍼: 문자열 정규화 (소문자, 공백/하이픈 제거)
const normalize = (val: string) => (val || "").toLowerCase().replace(/[-\s]/g, "");

// 헬퍼: 날짜 계산 (N개월 전)
const getPastDate = (months: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() - months);
    return d.toISOString().split('T')[0]; // "YYYY-MM-DD" 포맷 (문자열 비교용)
};

interface UseCustomerSearchProps {
    initialViewMode?: "none" | "recent" | "all";
}

export const useCustomerSearch = ({ initialViewMode = "none" }: UseCustomerSearchProps = {}) => {
    const [viewMode, setViewMode] = useState<"none" | "recent" | "all">(initialViewMode);
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");

    // Debounce Search Query
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedQuery(searchQuery);
        }, 500);
        return () => clearTimeout(handler);
    }, [searchQuery]);

    // 1. 최근 고객 (기본 뷰)
    const { data: recentCustomers = [], isLoading: isRecentLoading } = useQuery({
        queryKey: ["customers", "recent"],
        queryFn: async () => {
            const oneMonthAgo = getPastDate(1);
            // 최근 등록된 고객 (최근 1개월)
            const qRegister = fsQuery(
                collection(db, "customers"),
                where("registeredDate", ">=", oneMonthAgo),
                orderBy("registeredDate", "desc")
            );
            // 최근 활동(상담) 있는 고객 (최근 1개월)
            const qActivity = fsQuery(
                collection(db, "customers"),
                where("lastConsultDate", ">=", oneMonthAgo),
                orderBy("lastConsultDate", "desc")
            );

            const [snapReg, snapAct] = await Promise.all([getDocs(qRegister), getDocs(qActivity)]);

            const map = new Map<string, Customer>();
            snapReg.docs.forEach(d => map.set(d.id, { id: d.id, ...d.data() } as Customer));
            snapAct.docs.forEach(d => map.set(d.id, { id: d.id, ...d.data() } as Customer));

            return Array.from(map.values()).sort((a, b) => {
                const dateA = (a.lastConsultDate || a.registeredDate || "").replace(/\D/g, "");
                const dateB = (b.lastConsultDate || b.registeredDate || "").replace(/\D/g, "");
                return dateB.localeCompare(dateA);
            });
        },
        staleTime: 1000 * 60 * 5, // 5분 캐시
        enabled: viewMode === "recent" && !debouncedQuery // 검색어가 없고 recent 모드일 때만 사용
    });

    // 2. 전체 고객 (ViewMode = 'all' 또는 검색 시 공용)
    // 검색 모드에서도 동일한 queryKey를 사용하여 캐시 공유
    const needsAllData = (viewMode === "all" || !!debouncedQuery) && viewMode !== "none";
    const { data: allCustomers = [], isLoading: isAllLoading } = useQuery({
        queryKey: ["customers", "all"],
        queryFn: async () => {
            const q = fsQuery(collection(db, "customers"), orderBy("registeredDate", "desc"));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
        },
        staleTime: 1000 * 60 * 5,
        enabled: needsAllData
    });

    const finalData = useMemo(() => {
        // 0. 선택 안함 모드: 빈 테이블
        if (viewMode === "none") return [];

        // 1. 검색 모드: 전체 데이터에서 클라이언트 필터링
        if (debouncedQuery) {
            const q = normalize(debouncedQuery);
            return allCustomers.filter(c => {
                const fields = [
                    c.name, c.phone, ...(c.sub_phones || []),
                    c.address, ...(c.sub_addresses || []),
                    c.license, ...(c.ownedProducts || []),
                    c.notes, c.distributor
                ];
                return fields.some(f => normalize(f || "").includes(q));
            });
        }

        // 2. 전체 보기 모드
        if (viewMode === "all") {
            return allCustomers;
        }

        // 3. 최근 항목 모드 (기본)
        return recentCustomers;

    }, [debouncedQuery, viewMode, recentCustomers, allCustomers]);

    const isLoading =
        (needsAllData && isAllLoading) ||
        (viewMode === "recent" && !debouncedQuery && isRecentLoading);

    // 뷰 모드 변경 시 검색어 자동 초기화
    const handleSetViewMode = (mode: "none" | "recent" | "all") => {
        setSearchQuery("");
        setViewMode(mode);
    };

    return {
        customers: finalData,
        isLoading,
        viewMode,
        setViewMode: handleSetViewMode,
        searchQuery,
        setSearchQuery
    };
};
