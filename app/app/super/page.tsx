import Link from "next/link";
import { db, inr, setting } from "@/lib/db";
import { saveSettings } from "@/app/actions/super";
import Icon, { type IconName } from "@/components/Icon";
import PageHead from "@/components/PageHead";
import Flash from "@/components/Flash";
import { tr } from "@/lib/i18n";
const ICON: Record<string, [IconName, string]> = { "Total restaurants": ["store", ""], Active: ["check", "green"], Inactive: ["ban", "red"], "Applications awaiting review": ["file", "amber"], "Setup fees awaiting confirmation": ["wallet", "violet"], "Registered customers": ["users", "blue"] };
export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams; const { _, fd } = await tr();
  const c = async (q: string) => ((await db.prepare(q).get()) as { c: number }).c;
  const stats: [string, number][] = await Promise.all(([
    ["Total restaurants", "SELECT COUNT(*) c FROM restaurants"], ["Active", "SELECT COUNT(*) c FROM restaurants WHERE state='active'"], ["Inactive", "SELECT COUNT(*) c FROM restaurants WHERE state='inactive'"],
    ["Applications awaiting review", "SELECT COUNT(*) c FROM applications WHERE state='submitted'"], ["Setup fees awaiting confirmation", "SELECT COUNT(*) c FROM setup_fees WHERE state='awaiting'"],
    ["Registered customers", "SELECT COUNT(*) c FROM users WHERE role='customer' AND disabled=0"]] as [string, string][]).map(async ([k, q]) => [k, await c(q)] as [string, number]));
  const apps = await db.prepare("SELECT a.id,a.state,a.updated_at,r.name,f.state fs,f.amount_paise FROM applications a JOIN restaurants r ON r.id=a.restaurant_id JOIN setup_fees f ON f.restaurant_id=r.id WHERE a.state='submitted' OR (a.state='approved' AND f.state='awaiting') ORDER BY a.updated_at").all() as any[];
  return (
    <div><PageHead title="Platform dashboard" sub="Overview of the platform" /><Flash sp={sp} />
      <div className="grid">{stats.map(([k, v]) => <div className="card stat" key={k}><span className={`ic ${ICON[k]?.[1] ?? ""}`}><Icon name={ICON[k]?.[0] ?? "dash"} size={22} /></span><div><div className="muted">{_(k)}</div><h1>{v}</h1></div></div>)}</div>
      <h2>{_("Needs your attention")}</h2>
      {apps.length === 0 ? <p className="muted">{_("Nothing waiting.")}</p> : <table className="t"><tbody>{apps.map((a) => (
        <tr key={a.id}><td><strong>{a.name}</strong><div className="muted">{fd(a.updated_at)}</div></td>
          <td>{a.state === "submitted" ? _("Awaiting review") : _("Approved · fee {amt} awaiting payment", { amt: inr(a.amount_paise) })}</td><td><Link className="btn alt" href={`/super/apps/${a.id}`}>{_("Open")}</Link></td></tr>))}</tbody></table>}
      <h2>{_("Settings")}</h2>
      <form action={saveSettings} className="row"><label style={{ margin: 0 }}>{_("Max pending orders per customer per restaurant")}</label><input name="max_pending" type="number" min={1} max={50} defaultValue={await setting("max_pending_per_restaurant", 5)} style={{ width: 90 }} /><button className="alt">{_("Save")}</button></form>
    </div>
  );
}
