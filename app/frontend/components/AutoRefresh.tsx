"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
/** Polls by re-rendering server components (ORD-06/07). Optional beep when `count` increases. */
export default function AutoRefresh({ seconds = 25, count, sound }: { seconds?: number; count?: number; sound?: boolean }) {
  const r = useRouter(); const prev = useRef(count);
  useEffect(() => { const i = setInterval(() => r.refresh(), seconds * 1000); return () => clearInterval(i); }, [r, seconds]);
  useEffect(() => {
    if (sound && count !== undefined && prev.current !== undefined && count > prev.current) {
      try { const c = new AudioContext(), o = c.createOscillator(); o.connect(c.destination); o.start(); setTimeout(() => o.stop(), 250); } catch {}
    }
    prev.current = count;
  }, [count, sound]);
  return null;
}
