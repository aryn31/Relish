import Link from "next/link";
import { db, inr, fmtDate } from "@/lib/db";
export default async function Page({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s = "pending" } = await searchParams;
  const states = s === "approved" ? ["approved"] : s === "rejected" ? ["rejected"] : ["submitted", "returned"];
  const rows = (await db.prepare(`SELECT a.id,a.state,a.updated_at,r.name,r.type,r.address,f.amount_paise,f.state fs FROM applications a JOIN restaurants r ON r.id=a.restaurant_id JOIN setup_fees f ON f.restaurant_id=r.id WHERE a.state = ANY(string_to_array(?, ',')) ORDER BY a.updated_at DESC`).all(states.join(","))) as any[];
  const counts = (await db.prepare("SELECT COUNT(*) FILTER (WHERE state IN ('submitted','returned')) p, COUNT(*) FILTER (WHERE state='approved') a, COUNT(*) FILTER (WHERE state='rejected') r FROM applications").get()) as { p: number; a: number; r: number };
  const tab = (k: string, l: string, n: number) => <Link key={k} href={`/super/applications?s=${k}`} style={s === k ? { background: "var(--accent)", color: "#fff" } : undefined}>{l} ({n})</Link>;
  return (
    <div><h1 style={{ marginTop: 0 }}>Restaurant applications</h1>
      <nav className="tabs">{tab("pending", "Pending", counts.p)}{tab("approved", "Approved", counts.a)}{tab("rejected", "Rejected", counts.r)}</nav>
      {rows.length === 0 ? <p className="muted">Nothing here.</p> : <div className="stack">{rows.map((a) => (
        <div className="card row" key={a.id}><div className="grow"><strong>{a.name}</strong><div className="muted">{a.type} · {a.address}</div><div className="muted">Updated {fmtDate(a.updated_at)}{a.amount_paise ? ` · fee ${inr(a.amount_paise)} (${a.fs})` : ""}</div></div>
          <span className={`badge ${a.state}`}>{a.state}</span><Link className="btn" href={`/super/apps/${a.id}`}>Review</Link></div>))}</div>}
    </div>
  );
}
