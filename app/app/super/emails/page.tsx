import { db, fmtDate } from "@/lib/db";
export default async function Page() {
  const es = await db.prepare("SELECT * FROM emails ORDER BY id DESC LIMIT 100").all() as any[];
  return <div><p className="muted">Development mail log (no email provider is connected yet).</p>
    {es.map((e) => <div className="card" key={e.id} style={{ marginBottom: 8 }}><strong>{e.subject}</strong> <span className="muted">→ {e.to_addr} · {fmtDate(e.ts)}</span><div style={{ wordBreak: "break-all" }}>{e.body}</div></div>)}</div>;
}
