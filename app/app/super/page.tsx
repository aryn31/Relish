import Link from "next/link";
import { db, inr, fmtDate, setting } from "@/lib/db";
import { saveSettings } from "@/app/actions/super";
import Flash from "@/components/Flash";
export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const c = (q: string) => (db.prepare(q).get() as { c: number }).c;
  const stats: [string, number][] = [
    ["Total restaurants", c("SELECT COUNT(*) c FROM restaurants")], ["Active", c("SELECT COUNT(*) c FROM restaurants WHERE state='active'")], ["Inactive", c("SELECT COUNT(*) c FROM restaurants WHERE state='inactive'")],
    ["Applications awaiting review", c("SELECT COUNT(*) c FROM applications WHERE state='submitted'")], ["Setup fees awaiting confirmation", c("SELECT COUNT(*) c FROM setup_fees WHERE state='awaiting'")],
    ["Registered customers", c("SELECT COUNT(*) c FROM users WHERE role='customer' AND disabled=0")]];
  const apps = db.prepare("SELECT a.id,a.state,a.updated_at,r.name,f.state fs,f.amount_paise FROM applications a JOIN restaurants r ON r.id=a.restaurant_id JOIN setup_fees f ON f.restaurant_id=r.id WHERE a.state='submitted' OR (a.state='approved' AND f.state='awaiting') ORDER BY a.updated_at").all() as any[];
  return (
    <div><Flash sp={sp} />
      <div className="grid">{stats.map(([k, v]) => <div className="card stat" key={k}><span className="ic">{v > 0 ? "●" : "○"}</span><div><div className="muted">{k}</div><h1>{v}</h1></div></div>)}</div>
      <h2>Needs your attention</h2>
      {apps.length === 0 ? <p className="muted">Nothing waiting.</p> : <table className="t"><tbody>{apps.map((a) => (
        <tr key={a.id}><td><strong>{a.name}</strong><div className="muted">{fmtDate(a.updated_at)}</div></td>
          <td>{a.state === "submitted" ? "Awaiting review" : `Approved · fee ${inr(a.amount_paise)} awaiting payment`}</td><td><Link className="btn alt" href={`/super/apps/${a.id}`}>Open</Link></td></tr>))}</tbody></table>}
      <h2>Settings</h2>
      <form action={saveSettings} className="row"><label style={{ margin: 0 }}>Max pending orders per customer per restaurant</label><input name="max_pending" type="number" min={1} max={50} defaultValue={setting("max_pending_per_restaurant", 5)} style={{ width: 90 }} /><button className="alt">Save</button></form>
    </div>
  );
}
