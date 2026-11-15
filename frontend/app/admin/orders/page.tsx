import Link from "next/link";
import { load } from "@/lib/api";
import { inr } from "@/lib/format";
import { setPrep, completeOrder, confirmPayment, decideCancel, reassignTable } from "@/app/actions/admin";
import PageHead from "@/components/PageHead";
import Flash from "@/components/Flash";
import Confirm from "@/components/Confirm";
import AutoRefresh from "@/components/AutoRefresh";
import { redirect } from "next/navigation";
import { tr } from "@/lib/i18n";

type O = { id: number; number: number; table_name: string; payment_method: string; payment_status: string; claimed_paid: number; status: string; prep_minutes: number | null; total_paise: number; created_at: string;
  lines: { item_name: string; portion_name: string; qty: number; line_paise: number }[]; cr: { status: string; reason: string } | null };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { _, fd } = await tr(); const sp = await searchParams;
  const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
  const hasFilter = "status" in sp || "pay" in sp || "date" in sp;
  const status = hasFilter ? sp.status || "" : "pending", pay = sp.pay || "", date = hasFilter ? sp.date || "" : today;
  const page = Math.max(1, Number(sp.p) || 1);
  const self = "/admin/orders?" + new URLSearchParams(Object.entries(sp).filter(([k]) => k !== "ok" && k !== "err")).toString();
  const d = await load<{ restaurant: { state: string }; orders: O[]; hasMore: boolean; pendingCount: number; tables: { id: number; name: string }[] }>(
    `/api/admin/orders?${new URLSearchParams({ status, pay, date, p: String(page) })}`, self);
  const r = d.restaurant;
  if (r.state === "pending") redirect("/admin");
  const { orders, pendingCount, tables } = d;
  const qs = (n: number) => `/admin/orders?${new URLSearchParams({ status, pay, date, p: String(n) })}`;

  return (
    <div><PageHead title="Orders" sub="Live orders refresh automatically." /><Flash sp={sp} /><AutoRefresh seconds={25} count={pendingCount} sound />
      {r.state === "inactive" && <div className="msg">{_("Restaurant is inactive. You can complete orders and answer cancellation requests, but payments cannot be confirmed.")}</div>}
      <form className="row" action="/admin/orders">
        <select name="status" defaultValue={status} aria-label={_("Order status")}><option value="">{_("All statuses")}</option><option value="pending">{_("Pending")}</option><option value="completed">{_("Completed")}</option><option value="cancelled">{_("Cancelled")}</option></select>
        <select name="pay" defaultValue={pay} aria-label={_("Payment")}><option value="">{_("Any payment")}</option><option value="pending">{_("Payment pending")}</option><option value="paid">{_("Paid")}</option></select>
        <input type="date" name="date" defaultValue={date} aria-label={_("Date")} style={{ width: "auto" }} />
        <button>{_("Filter")}</button><Link href="/admin/orders?status=&pay=&date=">{_("Show all")}</Link>
      </form>
      <p className="muted">{_("Refreshes automatically · {n} pending now", { n: pendingCount })}</p>
      {orders.length === 0 && <p className="muted">{_("No orders match.")}</p>}
      <div className="stack">
        {orders.map((o) => {
          const { lines, cr } = o;
          return (
            <div className={`card ocard ${o.status}`} key={o.id}>
              <div className="row"><strong>#{o.number}</strong><span>{_("Table {name}", { name: o.table_name })}</span><span className={`badge ${o.status}`}>{_(o.status)}</span>
                <span className={`badge ${o.payment_status}`}>{o.payment_status === "paid" ? _("Paid") : _("Payment pending")}</span>
                {o.claimed_paid && o.payment_status === "pending" && o.status !== "cancelled" ? <span className="badge ok">{_("Customer says paid")}</span> : null}
                <span className="muted" style={{ marginLeft: "auto" }}>{fd(o.created_at)}</span></div>
              <ul>{lines.map((l, i) => <li key={i}>{l.qty} × {l.item_name}{l.portion_name ? ` (${l.portion_name})` : ""} — {inr(l.line_paise)}</li>)}</ul>
              <div><strong>{inr(o.total_paise)}</strong> · {o.payment_method === "upi" ? "UPI" : _("Cash")}{o.prep_minutes != null && ` · ${_("~{n} min", { n: o.prep_minutes })}`}</div>
              {o.status === "cancelled" && o.payment_status === "paid" && <div className="msg">{_("Cancelled. Payment was received; any refund is handled directly with the customer outside this app.")}</div>}
              {cr?.status === "requested" && <div className="msg err"><strong>{_("Cancellation requested:")}</strong> {cr.reason}
                <div className="row" style={{ marginTop: 8 }}>
                  <form action={decideCancel}><input type="hidden" name="id" value={o.id} /><input type="hidden" name="back" value={self} /><input type="hidden" name="decision" value="approve" /><Confirm className="danger" message={_("Approve cancellation? The order will be cancelled.")}>{_("Approve")}</Confirm></form>
                  <form action={decideCancel}><input type="hidden" name="id" value={o.id} /><input type="hidden" name="back" value={self} /><input type="hidden" name="decision" value="reject" /><Confirm className="alt" message={_("Decline this request?")}>{_("Decline")}</Confirm></form></div></div>}
              {o.status === "pending" && (
                <div className="row" style={{ marginTop: 8 }}>
                  <form action={setPrep} className="row"><input type="hidden" name="id" value={o.id} /><input type="hidden" name="back" value={self} /><input name="minutes" type="number" min={0} max={600} placeholder={_("Minutes")} defaultValue={o.prep_minutes ?? ""} style={{ width: 90 }} aria-label={_("Preparation minutes")} /><button className="alt">{_("Set time")}</button></form>
                  <form action={reassignTable} className="row"><input type="hidden" name="id" value={o.id} /><input type="hidden" name="back" value={self} /><select name="table_id" style={{ width: "auto" }} aria-label={_("Table")}>{tables.map((t) => <option key={t.id} value={t.id}>{_("Table {name}", { name: t.name })}</option>)}</select><button className="alt">{_("Move")}</button></form>
                  <form action={completeOrder}><input type="hidden" name="id" value={o.id} /><input type="hidden" name="back" value={self} /><Confirm message={_("Mark this order as completed (food served)?")}>{_("Complete")}</Confirm></form>
                </div>)}
              {o.payment_status === "pending" && o.status !== "cancelled" && r.state === "active" && (
                <form action={confirmPayment} style={{ marginTop: 8 }}><input type="hidden" name="id" value={o.id} /><input type="hidden" name="back" value={self} /><Confirm className="alt" message={_("Confirm you received the full {amt}?", { amt: inr(o.total_paise) })}>{_("Mark paid ({amt})", { amt: inr(o.total_paise) })}</Confirm></form>)}
            </div>);
        })}
      </div>
      <p className="row">{page > 1 && <Link href={qs(page - 1)}>← {_("Newer")}</Link>}{d.hasMore && <Link href={qs(page + 1)}>{_("Older")} →</Link>}</p>
    </div>
  );
}
