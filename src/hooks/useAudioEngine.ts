// src/hooks/useAudioEngine.ts
"use client";
import { useEffect, useRef, useCallback, useMemo } from 'react';

export const useAudioEngine = () => {
    const audioCtx = useRef<AudioContext | null>(null);
    const isRefreshingRef = useRef(false);

    const initAudio = useCallback(() => {
        if (!audioCtx.current) {
            audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            // Silent Pulse to unlock mobile audio (v122.0)
            const buffer = audioCtx.current.createBuffer(1, 1, 22050);
            const source = audioCtx.current.createBufferSource();
            source.buffer = buffer;
            source.connect(audioCtx.current.destination);
            source.start(0);
        }
    }, []);

    const playDingDong = useCallback(() => {
        if (!audioCtx.current || isRefreshingRef.current) return;

        // 0.5s Debounce (v122.0)
        isRefreshingRef.current = true;
        setTimeout(() => { isRefreshingRef.current = false; }, 500);

        if (audioCtx.current.state === 'suspended') {
            audioCtx.current.resume();
        }

        const now = audioCtx.current.currentTime;

        // "Ding" (600Hz, 0.8s)
        const osc1 = audioCtx.current.createOscillator();
        const gain1 = audioCtx.current.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(600, now);
        gain1.gain.setValueAtTime(0.3, now);
        gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
        osc1.connect(gain1);
        gain1.connect(audioCtx.current.destination);
        osc1.start(now);
        osc1.stop(now + 0.8);

        // "Dong" (480Hz, 1.0s) with 0.35s offset
        const osc2 = audioCtx.current.createOscillator();
        const gain2 = audioCtx.current.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(480, now + 0.35);
        gain2.gain.setValueAtTime(0.3, now + 0.35);
        gain2.gain.exponentialRampToValueAtTime(0.01, now + 1.35);
        osc2.connect(gain2);
        gain2.connect(audioCtx.current.destination);
        osc2.start(now + 0.35);
        osc2.stop(now + 1.35);

        // Vibration API for S25 (v122.0)
        if ("vibrate" in navigator) {
            navigator.vibrate([200, 100, 200]);
        }
    }, []);

    return useMemo(() => ({ initAudio, playDingDong }), [initAudio, playDingDong]);
};
