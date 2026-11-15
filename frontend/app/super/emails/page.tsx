import { tr } from "@/lib/i18n";
import PageHead from "@/components/PageHead";
import { load } from "@/lib/api";
export default async function Page() {
  const { fd } = await tr();
  const { emails: es } = await load<{ emails: { id: number; to_addr: string; subject: string; body: string; ts: string }[] }>("/api/super/emails", "/super/emails");
  return <div><PageHead title="Sent emails" sub="Development mail log. No email provider is connected yet." />
    {es.map((e) => <div className="card" key={e.id} style={{ marginBottom: 8 }}><strong>{e.subject}</strong> <span className="muted">→ {e.to_addr} · {fd(e.ts)}</span><div style={{ wordBreak: "break-all" }}>{e.body}</div></div>)}</div>;
}
