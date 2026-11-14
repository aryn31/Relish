import Link from "next/link";
import { requireRestAdmin } from "@/lib/auth";
import { db, inr, fmtDate } from "@/lib/db";
import { getRestaurant } from "@/lib/restaurant";
import { setPrep, completeOrder, confirmPayment, decideCancel, reassignTable } from "@/app/actions/admin";
import PageHead from "@/components/PageHead";
import Flash from "@/components/Flash";
import Confirm from "@/components/Confirm";
import AutoRefresh from "@/components/AutoRefresh";
import { redirect } from "next/navigation";

const PAGE = 20;
type O = { id: number; number: number; table_name: string; payment_method: string; payment_status: string; claimed_paid: number; status: string; prep_minutes: number | null; total_paise: number; created_at: string };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams; const u = await requireRestAdmin(); const r = (await getRestaurant(u.restaurant_id))!;
  if (r.state === "pending") redirect("/admin");
  const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
  const hasFilter = "status" in sp || "pay" in sp || "date" in sp;
  const status = hasFilter ? sp.status || "" : "pending", pay = sp.pay || "", date = hasFilter ? sp.date || "" : today;
  const page = Math.max(1, Number(sp.p) || 1);
  const where = ["restaurant_id=?"], args: (string | number)[] = [r.id];
  if (status) { where.push("status=?"); args.push(status); }
  if (pay) { where.push("payment_status=?"); args.push(pay); }
  if (date) { where.push("(created_at AT TIME ZONE 'Asia/Kolkata')::date=?::date"); args.push(date); }
  const orders = await db.prepare(`SELECT * FROM orders WHERE ${where.join(" AND ")} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...args, PAGE + 1, (page - 1) * PAGE) as O[];
  const pendingCount = (await db.prepare("SELECT COUNT(*) c FROM orders WHERE restaurant_id=? AND status='pending'").get(r.id) as { c: number }).c;
  const tables = await db.prepare("SELECT id,name FROM tables_ WHERE restaurant_id=? AND active=1").all(r.id) as { id: number; name: string }[];
  const det = new Map<number, { lines: unknown[]; cr: unknown }>();
  for (const o of orders.slice(0, PAGE)) det.set(o.id, { lines: await db.prepare("SELECT * FROM order_lines WHERE order_id=?").all(o.id), cr: await db.prepare("SELECT * FROM cancel_requests WHERE order_id=? ORDER BY id DESC LIMIT 1").get(o.id) });
  const self = "/admin/orders?" + new URLSearchParams(Object.entries(sp).filter(([k]) => k !== "ok" && k !== "err")).toString();
  const qs = (n: number) => `/admin/orders?${new URLSearchParams({ status, pay, date, p: String(n) })}`;

  return (
    <div><PageHead title="Orders" sub="Live orders refresh automatically." /><Flash sp={sp} /><AutoRefresh seconds={25} count={pendingCount} sound />
      {r.state === "inactive" && <div className="msg">Restaurant is inactive. You can complete orders and answer cancellation requests, but payments cannot be confirmed.</div>}
      <form className="row" action="/admin/orders">
        <select name="status" defaultValue={status} aria-label="Order status"><option value="">All statuses</option><option value="pending">Pending</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select>
        <select name="pay" defaultValue={pay} aria-label="Payment"><option value="">Any payment</option><option value="pending">Payment pending</option><option value="paid">Paid</option></select>
        <input type="date" name="date" defaultValue={date} aria-label="Date" style={{ width: "auto" }} />
        <button>Filter</button><Link href="/admin/orders?status=&pay=&date=">Show all</Link>
      </form>
      <p className="muted">Refreshes automatically · {pendingCount} pending now</p>
      {orders.length === 0 && <p className="muted">No orders match.</p>}
      <div className="stack">
        {orders.slice(0, PAGE).map((o) => {
          const lines = det.get(o.id)!.lines as { item_name: string; portion_name: string; qty: number; line_paise: number }[];
          const cr = det.get(o.id)!.cr as { status: string; reason: string } | undefined;
          return (
            <div className={`card ocard ${o.status}`} key={o.id}>
              <div className="row"><strong>#{o.number}</strong><span>Table {o.table_name}</span><span className={`badge ${o.status}`}>{o.status}</span>
                <span className={`badge ${o.payment_status}`}>{o.payment_status === "paid" ? "Paid" : "Payment pending"}</span>
                {o.claimed_paid && o.payment_status === "pending" && o.status !== "cancelled" ? <span className="badge ok">Customer says paid</span> : null}
                <span className="muted" style={{ marginLeft: "auto" }}>{fmtDate(o.created_at)}</span></div>
              <ul>{lines.map((l, i) => <li key={i}>{l.qty} × {l.item_name}{l.portion_name ? ` (${l.portion_name})` : ""} — {inr(l.line_paise)}</li>)}</ul>
              <div><strong>{inr(o.total_paise)}</strong> · {o.payment_method === "upi" ? "UPI" : "Cash"}{o.prep_minutes != null && ` · ~${o.prep_minutes} min`}</div>
              {o.status === "cancelled" && o.payment_status === "paid" && <div className="msg">Cancelled. Payment was received; any refund is handled directly with the customer outside this app.</div>}
              {cr?.status === "requested" && <div className="msg err"><strong>Cancellation requested:</strong> {cr.reason}
                <div className="row" style={{ marginTop: 8 }}>
                  <form action={decideCancel}><input type="hidden" name="id" value={o.id} /><input type="hidden" name="back" value={self} /><input type="hidden" name="decision" value="approve" /><Confirm className="danger" message="Approve cancellation? The order will be cancelled.">Approve</Confirm></form>
                  <form action={decideCancel}><input type="hidden" name="id" value={o.id} /><input type="hidden" name="back" value={self} /><input type="hidden" name="decision" value="reject" /><Confirm className="alt" message="Decline this request?">Decline</Confirm></form></div></div>}
              {o.status === "pending" && (
                <div className="row" style={{ marginTop: 8 }}>
                  <form action={setPrep} className="row"><input type="hidden" name="id" value={o.id} /><input type="hidden" name="back" value={self} /><input name="minutes" type="number" min={0} max={600} placeholder="Minutes" defaultValue={o.prep_minutes ?? ""} style={{ width: 90 }} aria-label="Preparation minutes" /><button className="alt">Set time</button></form>
                  <form action={reassignTable} className="row"><input type="hidden" name="id" value={o.id} /><input type="hidden" name="back" value={self} /><select name="table_id" style={{ width: "auto" }} aria-label="Table">{tables.map((t) => <option key={t.id} value={t.id}>Table {t.name}</option>)}</select><button className="alt">Move</button></form>
                  <form action={completeOrder}><input type="hidden" name="id" value={o.id} /><input type="hidden" name="back" value={self} /><Confirm message="Mark this order as completed (food served)?">Complete</Confirm></form>
                </div>)}
              {o.payment_status === "pending" && o.status !== "cancelled" && r.state === "active" && (
                <form action={confirmPayment} style={{ marginTop: 8 }}><input type="hidden" name="id" value={o.id} /><input type="hidden" name="back" value={self} /><Confirm className="alt" message={`Confirm you received the full ${inr(o.total_paise)}?`}>Mark paid ({inr(o.total_paise)})</Confirm></form>)}
            </div>);
        })}
      </div>
      <p className="row">{page > 1 && <Link href={qs(page - 1)}>← Newer</Link>}{orders.length > PAGE && <Link href={qs(page + 1)}>Older →</Link>}</p>
    </div>
  );
}
