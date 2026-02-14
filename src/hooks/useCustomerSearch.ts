
import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { collection, query, where, orderBy, getDocs, limit, startAt, endAt } from "firebase/firestore";
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
    initialViewMode?: "recent" | "all";
}

export const useCustomerSearch = ({ initialViewMode = "recent" }: UseCustomerSearchProps = {}) => {
    const [viewMode, setViewMode] = useState<"recent" | "all">(initialViewMode);
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
            const qRegister = query(
                collection(db, "customers"),
                where("registeredDate", ">=", oneMonthAgo),
                orderBy("registeredDate", "desc")
            );
            // 최근 활동(상담) 있는 고객 (최근 1개월)
            const qActivity = query(
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
        enabled: viewMode === "recent" && !debouncedQuery // 검색어가 없을 때만 사용
    });

    // 2. 전체 고객 fetching (ViewMode = 'all' 일 때)
    const { data: allCustomers = [], isLoading: isAllLoading } = useQuery({
        queryKey: ["customers", "all"],
        queryFn: async () => {
            const q = query(collection(db, "customers"), orderBy("createdAt", "desc"));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
        },
        staleTime: 1000 * 60 * 5,
        enabled: viewMode === "all" && !debouncedQuery // 검색어가 없을 때만 사용
    });

    // 3. 서버 검색 (검색어가 있을 때)
    // Firestore는 'OR' 쿼리가 제한적이므로, 이름/전화번호 각각 쿼리 후 병합
    const { data: searchResults = [], isLoading: isSearchLoading } = useQuery({
        queryKey: ["customers", "search", debouncedQuery],
        queryFn: async () => {
            if (!debouncedQuery) return [];
            const term = debouncedQuery.trim();

            // 3-1. Exact & StartWith Match for Name (대소문자 구분 이슈로 인해 firestore 쿼리는 한계가 있음. 
            // 하지만 여기선 일단 이름/전화번호 prefix 쿼리 시도. 
            // *중요*: Firestore는 full-text search 미지원. 
            // 대안: 클라이언트 필터링이 가장 정확하지만, 데이터가 너무 많으면 불가.
            // 타협안: 
            // A. 이름으로 쿼리 (orderBy name) -> 한글은 범위 쿼리 가능
            // B. 전화번호로 쿼리 (orderBy phone)

            // 여기서는 효율을 위해 "전체 데이터를 가져오는 것"보다는 
            // "검색어와 관련된 후보군"을 최대한 가져오는 전략 사용.
            // 하지만 Firestore의 한계로 인해, '부분 일치'는 어렵다.
            // 따라서, 검색 모드에서는 어쩔 수 없이 "전체 데이터를 로딩해서 클라이언트 필터링" 하는 전략으로 회귀하거나,
            // 혹은 "전체 데이터" 캐시가 있다면 그걸 쓰고, 없다면 서버에서 "이름이 일치하는" 것만 가져와야 함.

            // [전략 수정]: 
            // 검색어가 입력되면 -> '전체 데이터'가 캐시되어 있는지 확인.
            // 있다면 -> 클라이언트 필터링 (가장 빠름)
            // 없다면 -> 서버에서 '모든' 데이터를 가져오는게 아니라, 
            // "이름 순 정렬"된 리스트에서 binary search 하듯 가져와야 하는데 Firestore는 불가능.
            // 현실적 대안: 5000명 정도는 텍스트만 가져오면 1MB 내외임.
            // 검색 시 -> "전체 데이터 로딩" (ViewMode='all'과 동일한 동작) 후 필터링이 UX상 가장 정확함.
            // 부분 로딩으로는 '010-1234' 검색 시 중간 번호 매칭을 찾을 수 없음.

            // 결론: 검색 시에는 '전체 데이터' 쿼리를 수행하되, 결과만 리턴.
            const q = query(collection(db, "customers"), orderBy("createdAt", "desc"));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
        },
        staleTime: 1000 * 60 * 5, // 전체 데이터 캐시 공유
        enabled: !!debouncedQuery
    });

    // 결과 합성
    const finalData = useMemo(() => {
        // 1. 검색 모드
        if (debouncedQuery) {
            const q = normalize(debouncedQuery);
            return searchResults.filter(c => {
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

    }, [debouncedQuery, viewMode, recentCustomers, allCustomers, searchResults]);

    const isLoading =
        (!!debouncedQuery && isSearchLoading) ||
        (viewMode === "all" && !debouncedQuery && isAllLoading) ||
        (viewMode === "recent" && !debouncedQuery && isRecentLoading);

    return {
        customers: finalData,
        isLoading,
        viewMode,
        setViewMode,
        searchQuery,
        setSearchQuery
    };
};
