
import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { collection, where, orderBy, getDocs, query as fsQuery } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Customer } from "@/types/domain";

// 헬퍼: 문자열 정규화 (소문자, 공백/하이픈 제거)
const normalize = (val: string) => (val || "").toLowerCase().replace(/[-\s]/g, "");

// 헬퍼: 날짜 계산 (N일 전)
const getPastDateByDays = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
};

// 헬퍼: 날짜 계산 (N개월 전)
const getPastDate = (months: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() - months);
    return d.toISOString().split('T')[0];
};

// 공통: 날짜 범위 기반 고객 조회 (등록일 + 최근 활동일 합산)
const fetchCustomersByDateRange = async (sinceDate: string): Promise<Customer[]> => {
    const qRegister = fsQuery(
        collection(db, "customers"),
        where("registeredDate", ">=", sinceDate),
        orderBy("registeredDate", "desc")
    );
    const qActivity = fsQuery(
        collection(db, "customers"),
        where("lastConsultDate", ">=", sinceDate),
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
};

type ViewMode = "none" | "week" | "recent" | "all";

interface UseCustomerSearchProps {
    initialViewMode?: ViewMode;
}

export const useCustomerSearch = ({ initialViewMode = "week" }: UseCustomerSearchProps = {}) => {
    const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");

    // Debounce Search Query
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedQuery(searchQuery);
        }, 500);
        return () => clearTimeout(handler);
    }, [searchQuery]);

    // 1. 최근 1주일 고객 (기본 뷰 & "선택 안함" 뷰)
    const { data: weekCustomers = [], isLoading: isWeekLoading } = useQuery({
        queryKey: ["customers", "week"],
        queryFn: () => fetchCustomersByDateRange(getPastDateByDays(7)),
        staleTime: 0, // 항상 최신 데이터
        enabled: (viewMode === "week" || viewMode === "none") && !debouncedQuery
    });

    // 2. 최근 1개월 고객
    const { data: recentCustomers = [], isLoading: isRecentLoading } = useQuery({
        queryKey: ["customers", "recent"],
        queryFn: () => fetchCustomersByDateRange(getPastDate(1)),
        staleTime: 1000 * 60 * 60, // 1시간 캐시
        enabled: viewMode === "recent" && !debouncedQuery
    });

    // 3. 전체 고객 (ViewMode = 'all' 또는 검색 시 공용)
    const needsAllData = viewMode === "all" || !!debouncedQuery;
    const { data: allCustomers = [], isLoading: isAllLoading } = useQuery({
        queryKey: ["customers", "all"],
        queryFn: async () => {
            const q = fsQuery(collection(db, "customers"), orderBy("registeredDate", "desc"));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
        },
        staleTime: 1000 * 60 * 60 * 24, // 24시간 캐시
        enabled: needsAllData
    });

    const finalData = useMemo(() => {
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
        if (viewMode === "all") return allCustomers;

        // 3. 최근 1개월 모드
        if (viewMode === "recent") return recentCustomers;

        // 4. 최근 1주일 모드 또는 선택 안함 (기본)
        return weekCustomers;

    }, [debouncedQuery, viewMode, weekCustomers, recentCustomers, allCustomers]);

    const isLoading =
        (needsAllData && isAllLoading) ||
        (viewMode === "recent" && !debouncedQuery && isRecentLoading) ||
        ((viewMode === "week" || viewMode === "none") && !debouncedQuery && isWeekLoading);

    // 뷰 모드 변경 시 검색어 자동 초기화
    const handleSetViewMode = (mode: ViewMode) => {
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
