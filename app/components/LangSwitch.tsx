"use client";
import { useRouter } from "next/navigation";
export default function LangSwitch({ lang }: { lang: string }) {
  const r = useRouter();
  return (
    <select aria-label="Language" value={lang} style={{ width: "auto", padding: "4px 6px" }}
      onChange={async (e) => { await fetch("/api/lang", { method: "POST", body: e.target.value }); r.refresh(); }}>
      <option value="en">English</option><option value="hi">हिन्दी</option>
    </select>
  );
}
