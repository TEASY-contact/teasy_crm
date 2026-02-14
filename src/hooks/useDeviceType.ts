// src/hooks/useDeviceType.ts
"use client";
import { useState, useEffect } from "react";

const MOBILE_BREAKPOINT = 768;

interface DeviceType {
    isMobile: boolean;
    isDesktop: boolean;
    screenWidth: number;
}

/**
 * 화면 크기 기반 디바이스 타입 감지 훅
 * - mobile: ~767px
 * - desktop: 768px~
 * SSR 환경에서는 기본적으로 desktop으로 처리
 */
export const useDeviceType = (): DeviceType => {
    const [screenWidth, setScreenWidth] = useState<number>(
        typeof window !== "undefined" ? window.innerWidth : 1024
    );

    useEffect(() => {
        const handleResize = () => setScreenWidth(window.innerWidth);
        window.addEventListener("resize", handleResize);
        // 초기값 보정 (SSR → Client hydration)
        setScreenWidth(window.innerWidth);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const isMobile = screenWidth < MOBILE_BREAKPOINT;

    return {
        isMobile,
        isDesktop: !isMobile,
        screenWidth
    };
};
