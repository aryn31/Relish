import Link from "next/link";
import PageHead from "@/components/PageHead";
import { load } from "@/lib/api";
import { inr } from "@/lib/format";
import { tr } from "@/lib/i18n";
export default async function Page({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s = "pending" } = await searchParams; const { _, fd } = await tr();
  const { rows, counts } = await load<{ rows: { id: number; state: string; updated_at: string; name: string; type: string; address: string; amount_paise: number | null; fs: string }[]; counts: { p: number; a: number; r: number } }>(`/api/super/applications?s=${encodeURIComponent(s)}`, "/super/applications");
  const tab = (k: string, l: string, n: number) => <Link key={k} href={`/super/applications?s=${k}`} style={s === k ? { background: "var(--accent)", color: "#fff" } : undefined}>{_(l)} ({n})</Link>;
  return (
    <div><PageHead title="Applications" sub="Review restaurants that want to join." />
      <nav className="tabs">{tab("pending", "Pending", counts.p)}{tab("approved", "Approved", counts.a)}{tab("rejected", "Rejected", counts.r)}</nav>
      {rows.length === 0 ? <p className="muted">{_("Nothing here.")}</p> : <div className="stack">{rows.map((a) => (
        <div className="card row" key={a.id}><div className="grow"><strong>{a.name}</strong><div className="muted">{a.type} · {a.address}</div><div className="muted">{_("Updated")} {fd(a.updated_at)}{a.amount_paise ? ` · ${_("fee")} ${inr(a.amount_paise)} (${_(a.fs)})` : ""}</div></div>
          <span className={`badge ${a.state === "returned" ? "pending" : a.state}`}>{_(a.state)}</span><Link className="btn" href={`/super/apps/${a.id}`}>{_("Review")}</Link></div>))}</div>}
    </div>
  );
}
