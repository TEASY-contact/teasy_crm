// src/context/AuthContext.tsx
"use client";
import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, onSnapshot, updateDoc, setDoc, serverTimestamp, getDoc, query, where, getDocs, collection, deleteDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { UserData } from "@/types/auth";
import { useToast } from "@chakra-ui/react";
import { useRouter } from "next/navigation";

const AuthContext = createContext<{
    user: User | null;
    userData: UserData | null;
    loading: boolean;
} | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);
    const sessionInitialized = useRef(false);
    const [currentSessionId] = useState(() => {
        if (typeof window !== "undefined") {
            const savedId = sessionStorage.getItem("teasy_current_session_id");
            if (savedId) return savedId;
            const newId = Math.random().toString(36).substring(7);
            sessionStorage.setItem("teasy_current_session_id", newId);
            return newId;
        }
        return Math.random().toString(36).substring(7);
    });
    const toast = useToast();
    const router = useRouter();

    // 1. Core Auth State Listener
    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            if (currentUser) {
                setLoading(true); // Ensure loading is active when a user is found
            } else {
                setUserData(null);
                setLoading(false);
                sessionInitialized.current = false;
            }
            setUser(currentUser);
        });
        return () => unsubscribeAuth();
    }, []);

    // 2. Real-time User Data & Session Watcher
    useEffect(() => {
        if (!user) return;

        // Conscious Login Verification (v122.6 - Security Enhancement)
        // Prevents silent bypass of the login screen via Firebase persistent storage.
        const isConscious = typeof window !== "undefined" && sessionStorage.getItem("teasy_is_conscious_login") === "true";
        const isAtLogin = typeof window !== "undefined" && window.location.pathname === "/login";

        if (!isConscious && !isAtLogin) {
            console.log("[AUTH] Unconscious session detected (restore from persistence). Forcing re-login.");
            auth.signOut();
            setUserData(null);
            setLoading(false);
            router.push("/login");
            return;
        }

        // Force a fail-safe to prevent infinite loading
        const failSafe = setTimeout(() => {
            setLoading(false);
        }, 8000);

        const unsubscribeData = onSnapshot(
            doc(db, "users", user.uid),
            (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data() as UserData;

                    // 1. Ban Check
                    if (data.status === 'banned') {
                        auth.signOut();
                        toast({
                            title: "계정 정지 안내",
                            description: "해당 계정은 정지되었습니다. 관리자에게 문의하세요.",
                            status: "error",
                            position: "top",
                        });
                        router.push("/login");
                        return;
                    }

                    // 2. Single Device Login (v122.4 - Stronger)
                    const isLoginPage = typeof window !== "undefined" && window.location.pathname === "/login";
                    if (!isLoginPage && data.lastSessionId) {
                        if (data.lastSessionId === currentSessionId) {
                            sessionInitialized.current = true;
                        } else if (sessionInitialized.current) {
                            auth.signOut();
                            toast({
                                title: "로그아웃 알림",
                                description: "다른 기기에서 로그인하여 로그아웃되었습니다.",
                                status: "warning",
                                position: "top",
                            });
                            router.push("/login");
                            return;
                        }
                    }

                    // 3. Update Global State
                    const sanitizedData = {
                        ...data,
                        uid: user.uid,
                        name: data.name || user.displayName || "미등록 사용자"
                    };
                    setUserData(sanitizedData);
                    setLoading(false); // Data is ready
                    clearTimeout(failSafe);
                } else {
                    // Document doesn't exist yet, wait for setSession to create it
                    // But we don't clear loading here yet.
                }
            },
            (error) => {
                console.error("Auth Snapshot Error:", error);
                setLoading(false);
                clearTimeout(failSafe);
            }
        );

        // 3. User Identity Sync & Session Setup
        const setSession = async () => {
            try {
                const docRef = doc(db, "users", user.uid);
                const docSnap = await getDoc(docRef);

                let existingMappedData: any = {};
                const currentName = docSnap.exists() ? docSnap.data()?.name : null;
                const isPlaceholder = !currentName || currentName === "관리자" || currentName === "미등록 사용자";

                // Migration logic for admin-created placeholders
                if ((!docSnap.exists() || isPlaceholder) && user.email) {
                    const q = query(collection(db, "users"), where("email", "==", user.email));
                    const querySnap = await getDocs(q);
                    const legacyDoc = querySnap.docs.find(d =>
                        d.id !== user.uid &&
                        d.data().name &&
                        d.data().name !== "관리자" &&
                        d.data().name !== "미등록 사용자"
                    );

                    if (legacyDoc) {
                        existingMappedData = legacyDoc.data();
                        await deleteDoc(doc(db, "users", legacyDoc.id));
                    }
                }

                const initialData: any = {
                    ...existingMappedData,
                    lastSessionId: currentSessionId,
                    email: user.email,
                    lastLogin: serverTimestamp(),
                };

                if (!docSnap.exists() && !existingMappedData.name) {
                    initialData.name = user.displayName || "미등록 사용자";
                }

                await setDoc(docRef, initialData, { merge: true });
            } catch (err) {
                console.error("Session Update Error:", err);
            }
        };

        setSession();
        return () => {
            unsubscribeData();
            clearTimeout(failSafe);
        };
    }, [user, currentSessionId, router, toast]);

    const value = React.useMemo(() => ({
        user,
        userData,
        loading
    }), [user, userData, loading]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) throw new Error("useAuth must be used within AuthProvider");
    return context;
};
