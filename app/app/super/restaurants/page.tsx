import { db } from "@/lib/db";
import { fee, checklist, feeEnabled, type Restaurant } from "@/lib/restaurant";
import { activateRestaurant, deactivateRestaurant } from "@/app/actions/super";
import PageHead from "@/components/PageHead";
import Flash from "@/components/Flash";
import Confirm from "@/components/Confirm";
import Link from "next/link";
import { tr } from "@/lib/i18n";
const NAMES: Record<string, string> = { approved: "approval", fee: "setup fee", upi: "UPI QR", menu: "menu", table: "a table", reviewed: "owner review" };
const FEE: Record<string, string> = { not_assigned: "not assigned", awaiting: "awaiting payment", confirmed: "confirmed" };
export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams; const { _ } = await tr();
  const rs = await db.prepare("SELECT * FROM restaurants ORDER BY id DESC").all() as Restaurant[];
  const info = new Map<number, { cl: Awaited<ReturnType<typeof checklist>>; f: NonNullable<Awaited<ReturnType<typeof fee>>> }>();
  for (const r of rs) info.set(r.id, { cl: await checklist(r), f: (await fee(r.id))! });
  return (
    <div><PageHead title="Restaurants" sub={_("{n} on the platform", { n: rs.length })} /><Flash sp={sp} />
      <table className="t"><thead><tr><th>{_("Restaurant")}</th><th>{_("State")}</th><th>{_("Setup")}</th><th>{_("Action")}</th></tr></thead><tbody>{rs.map((r) => {
        const { cl, f } = info.get(r.id)!;
        return (<tr key={r.id}><td><strong>{r.name}</strong><div className="muted">{r.type} · {r.address}</div></td>
          <td><span className={`badge ${r.state}`}>{_(r.state)}</span>{r.inactive_reason && <div className="muted">{r.inactive_reason}</div>}</td>
          <td>{cl.ok ? <span className="badge active">{_("Ready")}</span> : <span className="muted" style={{ fontSize: ".85rem" }}>{_("Waiting on {items}", { items: cl.steps.filter((s) => !s.ok).map((s) => _(NAMES[s.key])).join(", ") })}</span>}{feeEnabled() && <div className="muted" style={{ fontSize: ".8rem", marginTop: 4 }}>{_("Fee:")} {_(FEE[f.state] ?? f.state)}</div>}</td>
          <td>{r.state === "active" ? <form action={deactivateRestaurant} className="row" style={{ flexWrap: "nowrap", gap: 6 }}><input type="hidden" name="id" value={r.id} /><input name="reason" placeholder={_("Reason")} required aria-label={_("Reason")} style={{ width: 130, padding: "8px 12px" }} /><Confirm className="danger" message={_("Deactivate? It will be hidden and stop taking orders. Unpaid orders stay outstanding until reactivation.")}>{_("Deactivate")}</Confirm></form>
            : r.state === "inactive" ? <form action={activateRestaurant}><input type="hidden" name="id" value={r.id} /><button className="alt" disabled={!cl.ok}>{_("Reactivate")}</button></form>
            : <span className="muted" style={{ fontSize: ".85rem" }}>{_("Owner is setting up")}</span>}</td></tr>); })}</tbody></table>
    </div>
  );
}
