import { tr } from "@/lib/i18n";
import PageHead from "@/components/PageHead";
import { db } from "@/lib/db";
export default async function Page() {
  const { fd } = await tr();
  const es = await db.prepare("SELECT * FROM emails ORDER BY id DESC LIMIT 100").all() as any[];
  return <div><PageHead title="Sent emails" sub="Development mail log. No email provider is connected yet." />
    {es.map((e) => <div className="card" key={e.id} style={{ marginBottom: 8 }}><strong>{e.subject}</strong> <span className="muted">→ {e.to_addr} · {fd(e.ts)}</span><div style={{ wordBreak: "break-all" }}>{e.body}</div></div>)}</div>;
}
