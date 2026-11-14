import Link from "next/link";
import { requireRestAdmin, emailVerificationEnabled } from "@/lib/auth";
import { db, inr } from "@/lib/db";
import { getRestaurant, application, fee, checklist, feeEnabled } from "@/lib/restaurant";
import { resendVerification, submitApplication, startNewApplication, markReviewed } from "@/app/actions/owner";
import { Check } from "lucide-react";
import Flash from "@/components/Flash";
import Icon, { type IconName } from "@/components/Icon";
import PageHead from "@/components/PageHead";
import AutoRefresh from "@/components/AutoRefresh";
import { tr } from "@/lib/i18n";

export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const { _, fd } = await tr(); const sp = await searchParams; const u = await requireRestAdmin(); const r = (await getRestaurant(u.restaurant_id))!;
  const app = (await application(r.id))!, f = (await fee(r.id))!, cl = await checklist(r);

  if (r.state !== "pending") {
    const c = async (q: string) => ((await db.prepare(q).get(r.id)) as { c: number }).c;
    const pend = await c("SELECT COUNT(*) c FROM orders WHERE restaurant_id=? AND status='pending'");
    const cancels = await c("SELECT COUNT(*) c FROM cancel_requests cr JOIN orders o ON o.id=cr.order_id WHERE o.restaurant_id=? AND cr.status='requested'");
    const claims = await c("SELECT COUNT(*) c FROM orders WHERE restaurant_id=? AND claimed_paid=1 AND payment_status='pending' AND status!='cancelled'");
    const owed = await c("SELECT COALESCE(SUM(total_paise),0) c FROM orders WHERE restaurant_id=? AND payment_status='pending' AND status!='cancelled'");
    const today = (await db.prepare("SELECT COUNT(*) total, COUNT(*) FILTER (WHERE status='pending') pending, COUNT(*) FILTER (WHERE status='completed') completed, COUNT(*) FILTER (WHERE status='cancelled') cancelled FROM orders WHERE restaurant_id=? AND (created_at AT TIME ZONE 'Asia/Kolkata')::date=(now() AT TIME ZONE 'Asia/Kolkata')::date").get(r.id)) as { total: number; pending: number; completed: number; cancelled: number };
    const recent = (await db.prepare("SELECT * FROM orders WHERE restaurant_id=? ORDER BY id DESC LIMIT 6").all(r.id)) as { id: number; number: number; table_name: string; total_paise: number; payment_method: string; status: string; created_at: string }[];
    const off = await db.prepare("SELECT name FROM items WHERE restaurant_id=? AND deleted=0 AND available=0").all(r.id) as { name: string }[];
    return (
      <div><PageHead title={`Welcome back, ${u.name.split(" ")[0]}`} sub={`Here is what is happening at ${r.name} today.`}><Link className="btn alt" href="/admin/orders">{_("Open orders")}</Link></PageHead><Flash sp={sp} /><AutoRefresh seconds={25} count={pend} sound />
        {r.state === "inactive" && <div className="msg err"><strong>{_("Your restaurant is inactive")}</strong>{r.inactive_reason ? `: ${r.inactive_reason}` : ""}. {_("You can view records but cannot take new orders or confirm payments. Contact the platform team.")}</div>}
        <div className="grid">
          <Link className="card" href="/admin/orders"><div className="stat"><span className="ic amber"><Icon name="bell" size={22} /></span><div><div className="muted">{_("New and pending orders")}</div><h1>{pend}</h1></div></div></Link>
          <Link className="card" href="/admin/orders?status=pending&pay=&date="><div className="stat"><span className="ic red"><Icon name="ban" size={22} /></span><div><div className="muted">{_("Cancellation requests")}</div><h1 className={cancels ? "bad" : ""}>{cancels}</h1></div></div></Link>
          <Link className="card" href="/admin/payments"><div className="stat"><span className="ic blue"><Icon name="mobile" size={22} /></span><div><div className="muted">{_("\"Customer says paid\" – to confirm")}</div><h1>{claims}</h1></div></div></Link>
          <Link className="card" href="/admin/payments"><div className="stat"><span className="ic violet"><Icon name="wallet" size={22} /></span><div><div className="muted">{_("Outstanding balance")}</div><h1>{inr(owed)}</h1></div></div></Link>
        </div>
        <h2>{_("Today")}</h2>
        <div className="grid">{([["receipt", "Total orders", today.total, ""], ["clock", "Pending", today.pending, "amber"], ["check", "Completed", today.completed, "green"], ["x", "Cancelled", today.cancelled, "red"]] as [IconName, string, number, string][]).map(([ic, k, v, c]) => <div className="card stat" key={k}><span className={`ic ${c}`}><Icon name={ic} size={22} /></span><div><div className="muted">{_(k)}</div><h1>{v}</h1></div></div>)}</div>
        <h2>{_("Recent orders")} <Link href="/admin/orders?status=&pay=&date=" style={{ fontSize: ".9rem", fontWeight: 400 }}>{_("View all")} →</Link></h2>
        {recent.length === 0 ? <p className="muted">{_("No orders yet.")}</p> : <table className="t"><thead><tr><th>{_("Order")}</th><th>{_("Table")}</th><th>{_("Amount")}</th><th>{_("Payment")}</th><th>{_("Status")}</th><th>{_("When")}</th></tr></thead><tbody>
          {recent.map((o) => <tr key={o.id}><td>#{o.number}</td><td>{o.table_name}</td><td>{inr(o.total_paise)}</td><td>{o.payment_method === "upi" ? "UPI" : _("Cash")}</td><td><span className={`badge ${o.status}`}>{_(o.status)}</span></td><td className="muted">{fd(o.created_at)}</td></tr>)}</tbody></table>}
        {off.length > 0 && <p><strong>{_("Marked unavailable:")}</strong> {off.map((i) => i.name).join(", ")} · <Link href="/admin/menu">{_("Manage menu")}</Link></p>}
        <p className="muted">{_("Customers can find you at")} <Link href={`/r/${r.slug}`}>/r/{r.slug}</Link>.</p>
      </div>);
  }

  // ---- Onboarding (REG-05/06) ----
  const labels: Record<string, [string, string]> = {
    approved: [_("Application approved"), "/admin"], fee: [_("Setup fee confirmed"), "/admin"], upi: [_("Upload your UPI QR code"), "/admin/payments"],
    menu: [_("Add a category and at least one available item with a price"), "/admin/menu"], table: [_("Add at least one active table"), "/admin/tables"], reviewed: [_("Review your restaurant details"), "/admin/info"],
  };
  const stateText: Record<string, string> = { draft: _("Not submitted yet"), submitted: _("Submitted — waiting for review"), returned: _("Returned for corrections"), approved: _("Approved"), rejected: _("Not approved") };
  return (
    <div><PageHead title="Get your restaurant live" sub="Finish these steps and your restaurant goes live automatically." /><Flash sp={sp} /><AutoRefresh seconds={60} />
      <div className="cols"><div className="stack">
      <div className="card"><div className="row" style={{ justifyContent: "space-between" }}><h3 style={{ margin: 0 }}>{_("Application")}</h3><span className={`badge ${app.state === "returned" ? "pending" : app.state === "submitted" ? "pending" : app.state}`}>{stateText[app.state]}</span></div>
        {app.reason && <p className="msg err"><strong>{_("Message from the platform team:")}</strong> {app.reason}</p>}
        {emailVerificationEnabled() && !u.email_verified && <div className="msg">{_("Please verify your email (check your inbox).")} <form action={resendVerification} style={{ display: "inline" }}><button className="link">{_("Send the link again")}</button></form></div>}
        {app.state === "draft" && <><p><strong>{_("Next:")}</strong> {_("check your details and the")} <Link href="/admin/preview">{_("preview of your page")}</Link>{_(", then submit for review.")}</p>
          <div className="row"><Link href="/admin/info" className="btn alt">{_("Edit details")}</Link><form action={submitApplication}><button>{_("Submit for review")}</button></form></div></>}
        {app.state === "returned" && <><p><strong>{_("Next:")}</strong> {_("fix the points above in")} <Link href="/admin/info">{_("Restaurant info")}</Link>{_(", then resubmit.")}</p><form action={submitApplication}><button>{_("Resubmit for review")}</button></form></>}
        {app.state === "submitted" && <p><strong>{_("Next:")}</strong> {_("nothing to do. We will email you when we have reviewed it.")}{feeEnabled() && f.state !== "confirmed" && " " + _("Your setup fee will be shown here once assigned.")}</p>}
        {app.state === "approved" && <p><strong>{_("Next:")}</strong> {_("finish the checklist on the right. Your restaurant goes live as soon as every step is done.")}</p>}
        {app.state === "rejected" && <><p>{_("You can start a new application with the same account.")}</p><form action={startNewApplication}><button>{_("Start new application")}</button></form></>}
      </div>
      {feeEnabled() && <div className="card"><h3 style={{ marginTop: 0 }}>{_("Setup fee")}</h3>
        {f.state === "not_assigned" && <p className="muted">{_("Not assigned yet. We will tell you the amount after reviewing your application.")}</p>}
        {f.state === "awaiting" && <><p><strong>{inr(f.amount_paise!)}</strong> — {_("awaiting payment.")}</p><p className="muted">{_("Pay this one-time fee outside the app using the method the platform team gave you. We confirm once we receive it.")}</p></>}
        {f.state === "confirmed" && <p className="ok">✓ {inr(f.amount_paise!)} — {_("payment confirmed.")}</p>}
      </div>}
      </div>
      <div className="card sticky"><div className="row" style={{ justifyContent: "space-between" }}><h3 style={{ margin: 0 }}>{_("Setup checklist")}</h3><span className="muted">{_("{done} of {total} done", { done: cl.steps.filter((x) => x.ok).length, total: cl.steps.length })}</span></div>
        <div className="progress" style={{ margin: "12px 0 16px" }}><i style={{ width: `${(cl.steps.filter((x) => x.ok).length / cl.steps.length) * 100}%` }} /></div>
        {cl.steps.map((s) => { const link = s.key === "approved" || s.key === "fee" ? "/admin" : app.state === "approved" ? labels[s.key][1] : null; const inner = <><span className="ci">{s.ok && <Check size={14} />}</span><span style={{ flex: 1 }}>{labels[s.key][0]}{!s.ok && !["approved", "fee"].includes(s.key) && app.state !== "approved" && <span className="muted"> · {_("unlocks after approval")}</span>}</span></>; return link && !s.ok ? <Link key={s.key} href={link} className="chk">{inner}</Link> : <div key={s.key} className={`chk ${s.ok ? "done" : ""}`}>{inner}</div>; })}
        {app.state === "approved" && !r.details_reviewed && <form action={markReviewed}><button className="alt">{_("I have reviewed my details")}</button></form>}
        <p className="muted" style={{ marginBottom: 0 }}>{_("When every step is done your restaurant goes live automatically.")}</p>
      </div></div>
    </div>
  );
}
