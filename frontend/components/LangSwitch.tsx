"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Globe } from "lucide-react";

/** Segmented English / हिन्दी toggle. `dark` variant is for the dashboard sidebar. */
export default function LangSwitch({ lang, dark }: { lang: string; dark?: boolean }) {
  const r = useRouter();
  const [cur, setCur] = useState(lang);
  const [pending, start] = useTransition();
  async function pick(v: "en" | "hi") {
    if (v === cur) return;
    setCur(v);
    try { await fetch("/api/lang", { method: "POST", body: v }); } catch {}
    start(() => r.refresh());
  }
  return (
    <div className={`lang ${dark ? "dark" : ""}`} role="group" aria-label="Language" aria-busy={pending}>
      <Globe size={15} aria-hidden="true" />
      <button type="button" className={cur === "en" ? "on" : ""} aria-pressed={cur === "en"} onClick={() => pick("en")}>EN</button>
      <button type="button" className={cur === "hi" ? "on" : ""} aria-pressed={cur === "hi"} onClick={() => pick("hi")} lang="hi">हिन्दी</button>
    </div>
  );
}
