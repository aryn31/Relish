import Link from "next/link";
import { requireRestAdmin } from "@/lib/auth";
import { db, inr, fmtDate } from "@/lib/db";
import { getRestaurant, application, fee, checklist } from "@/lib/restaurant";
import { resendVerification, submitApplication, startNewApplication, markReviewed } from "@/app/actions/owner";
import Flash from "@/components/Flash";
import Icon, { type IconName } from "@/components/Icon";
import PageHead from "@/components/PageHead";
import AutoRefresh from "@/components/AutoRefresh";

export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams; const u = await requireRestAdmin(); const r = (await getRestaurant(u.restaurant_id))!;
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
      <div><PageHead title={`Welcome back, ${u.name.split(" ")[0]}`} sub={`Here is what is happening at ${r.name} today.`}><Link className="btn alt" href="/admin/orders">Open orders</Link></PageHead><Flash sp={sp} /><AutoRefresh seconds={25} count={pend} sound />
        {r.state === "inactive" && <div className="msg err"><strong>Your restaurant is inactive</strong>{r.inactive_reason ? `: ${r.inactive_reason}` : ""}. You can view records but cannot take new orders or confirm payments. Contact the platform team.</div>}
        <div className="grid">
          <Link className="card" href="/admin/orders"><div className="stat"><span className="ic amber"><Icon name="bell" size={22} /></span><div><div className="muted">New and pending orders</div><h1>{pend}</h1></div></div></Link>
          <Link className="card" href="/admin/orders?status=pending&pay=&date="><div className="stat"><span className="ic red"><Icon name="ban" size={22} /></span><div><div className="muted">Cancellation requests</div><h1 className={cancels ? "bad" : ""}>{cancels}</h1></div></div></Link>
          <Link className="card" href="/admin/payments"><div className="stat"><span className="ic blue"><Icon name="mobile" size={22} /></span><div><div className="muted">"Customer says paid" – to confirm</div><h1>{claims}</h1></div></div></Link>
          <Link className="card" href="/admin/payments"><div className="stat"><span className="ic violet"><Icon name="wallet" size={22} /></span><div><div className="muted">Outstanding balance</div><h1>{inr(owed)}</h1></div></div></Link>
        </div>
        <h2>Today</h2>
        <div className="grid">{([["receipt", "Total orders", today.total, ""], ["clock", "Pending", today.pending, "amber"], ["check", "Completed", today.completed, "green"], ["x", "Cancelled", today.cancelled, "red"]] as [IconName, string, number, string][]).map(([ic, k, v, c]) => <div className="card stat" key={k}><span className={`ic ${c}`}><Icon name={ic} size={22} /></span><div><div className="muted">{k}</div><h1>{v}</h1></div></div>)}</div>
        <h2>Recent orders <Link href="/admin/orders?status=&pay=&date=" style={{ fontSize: ".9rem", fontWeight: 400 }}>View all →</Link></h2>
        {recent.length === 0 ? <p className="muted">No orders yet.</p> : <table className="t"><thead><tr><th>Order</th><th>Table</th><th>Amount</th><th>Payment</th><th>Status</th><th>When</th></tr></thead><tbody>
          {recent.map((o) => <tr key={o.id}><td>#{o.number}</td><td>{o.table_name}</td><td>{inr(o.total_paise)}</td><td>{o.payment_method === "upi" ? "UPI" : "Cash"}</td><td><span className={`badge ${o.status}`}>{o.status}</span></td><td className="muted">{fmtDate(o.created_at)}</td></tr>)}</tbody></table>}
        {off.length > 0 && <p><strong>Marked unavailable:</strong> {off.map((i) => i.name).join(", ")} · <Link href="/admin/menu">Manage menu</Link></p>}
        <p className="muted">Customers can find you at <Link href={`/r/${r.slug}`}>/r/{r.slug}</Link>.</p>
      </div>);
  }

  // ---- Onboarding (REG-05/06) ----
  const labels: Record<string, [string, string]> = {
    approved: ["Application approved", "/admin"], fee: ["Setup fee confirmed", "/admin"], upi: ["Upload your UPI QR code", "/admin/payments"],
    menu: ["Add a category and at least one available item with a price", "/admin/menu"], table: ["Add at least one active table", "/admin/tables"], reviewed: ["Review your restaurant details", "/admin/info"],
  };
  const stateText: Record<string, string> = { draft: "Not submitted yet", submitted: "Submitted — waiting for review", returned: "Returned for corrections", approved: "Approved", rejected: "Not approved" };
  return (
    <div className="stack" style={{ maxWidth: 680 }}><Flash sp={sp} /><AutoRefresh seconds={60} />
      <div className="card"><h3 style={{ marginTop: 0 }}>Application status: {stateText[app.state]}</h3>
        {app.reason && <p className="msg err"><strong>Message from the platform team:</strong> {app.reason}</p>}
        {!u.email_verified && <div className="msg">Please verify your email (check your inbox). <form action={resendVerification} style={{ display: "inline" }}><button className="link">Send the link again</button></form></div>}
        {app.state === "draft" && <><p><strong>Next:</strong> check your details and the <Link href="/admin/preview">preview of your page</Link>, then submit for review.</p>
          <p className="row"><Link href="/admin/info" className="btn alt">Edit details</Link><form action={submitApplication}><button disabled={!u.email_verified}>Submit for review</button></form></p></>}
        {app.state === "returned" && <><p><strong>Next:</strong> fix the points above in <Link href="/admin/info">Restaurant info</Link>, then resubmit.</p><form action={submitApplication}><button disabled={!u.email_verified}>Resubmit for review</button></form></>}
        {app.state === "submitted" && <p><strong>Next:</strong> nothing to do. We will email you when we have reviewed it.{f.state !== "confirmed" && " Your setup fee will be shown here once assigned."}</p>}
        {app.state === "rejected" && <><p>You can start a new application with the same account.</p><form action={startNewApplication}><button>Start new application</button></form></>}
      </div>
      <div className="card"><h3 style={{ marginTop: 0 }}>Setup fee</h3>
        {f.state === "not_assigned" && <p className="muted">Not assigned yet. We will tell you the amount after reviewing your application.</p>}
        {f.state === "awaiting" && <><p><strong>{inr(f.amount_paise!)}</strong> — awaiting payment.</p><p className="muted">Pay this one-time fee outside the app using the method the platform team gave you. We confirm once we receive it.</p></>}
        {f.state === "confirmed" && <p className="ok">✓ {inr(f.amount_paise!)} — payment confirmed.</p>}
      </div>
      <div className="card"><h3 style={{ marginTop: 0 }}>Checklist</h3>
        <ul style={{ listStyle: "none", padding: 0 }}>{cl.steps.map((s) => (
          <li key={s.key}>{s.ok ? <span className="ok">✓ </span> : <span className="muted">○ </span>}
            {s.key === "approved" || s.key === "fee" || app.state === "approved" ? <Link href={labels[s.key][1]}>{labels[s.key][0]}</Link> : labels[s.key][0]}
            {!s.ok && !["approved", "fee"].includes(s.key) && app.state !== "approved" && <span className="muted"> (unlocks after approval)</span>}</li>))}</ul>
        {app.state === "approved" && !r.details_reviewed && <form action={markReviewed}><button className="alt">I have reviewed my details</button></form>}
        <p className="muted">When every step is done your restaurant goes live automatically.</p>
      </div>
    </div>
  );
}
