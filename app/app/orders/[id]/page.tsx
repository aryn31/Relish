import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db, inr, fmtDate } from "@/lib/db";
import { tr } from "@/lib/i18n";
import { reportPaid, switchMethod, requestCancel } from "@/app/actions/customer";
import Flash from "@/components/Flash";
import AutoRefresh from "@/components/AutoRefresh";
import Confirm from "@/components/Confirm";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string; new?: string }> }) {
  const { id } = await params; const sp = await searchParams; const u = await requireUser(`/orders/${id}`); const { t } = await tr();
  // ROLE-04/AUTH-07: customers only see their own orders.
  const o = db.prepare("SELECT o.*, r.name rname, r.slug, r.state rstate, r.upi_qr FROM orders o JOIN restaurants r ON r.id=o.restaurant_id WHERE o.public_id=? AND o.customer_id=?").get(id, u.id) as any;
  if (!o) return <main><h1>Order not found</h1><Link href="/orders">{t("my_orders")}</Link></main>;
  const lines = db.prepare("SELECT * FROM order_lines WHERE order_id=?").all(o.id) as any[];
  const cr = db.prepare("SELECT * FROM cancel_requests WHERE order_id=? ORDER BY id DESC LIMIT 1").get(o.id) as { status: string; reason: string } | undefined;
  const payable = o.payment_status === "pending" && o.status !== "cancelled";
  const pid = <input type="hidden" name="pid" value={id} />;
  return (
    <main style={{ maxWidth: 640 }}><Flash sp={sp} /><AutoRefresh seconds={20} />
      {sp.new && <div className="msg good">Order placed! The restaurant has received it.</div>}
      <h1>{o.rname} · {t("order")} #{o.number}</h1>
      <div className="row"><span className={`badge ${o.status}`}>{t(o.status)}</span><span className={`badge ${o.payment_status}`}>{o.payment_status === "paid" ? t("paid") : t("payment_pending")}</span><span>{t("table")} {o.table_name}</span><span className="muted">{fmtDate(o.created_at)}</span></div>
      {o.prep_minutes != null && o.status === "pending" && <p>{t("prep_time")}: <strong>{o.prep_minutes} {t("minutes")}</strong></p>}
      <ul>{lines.map((l) => <li key={l.id}>{l.qty} × {l.item_name}{l.portion_name ? ` (${l.portion_name})` : ""} — {inr(l.line_paise)}</li>)}</ul>
      <h3>{t("total")}: {inr(o.total_paise)}</h3>
      {o.status === "cancelled" && o.payment_status === "paid" && <div className="msg">{t("cancelled_paid_note")}</div>}

      {payable && o.rstate === "active" && <div className="card stack">
        <h3 style={{ margin: 0 }}>{t("payment")}</h3>
        {o.payment_method === "upi" ? <>
          <p>Scan this QR with any UPI app and pay exactly <strong>{inr(o.total_paise)}</strong>.</p>
          {o.upi_qr && <img src={`/api/upi/${id}`} alt="UPI QR code" width={240} height={240} style={{ maxWidth: "100%", height: "auto" }} />}
          {o.claimed_paid ? <p className="ok">{t("claimed")}</p> : <form action={reportPaid}>{pid}<button>{t("i_paid")}</button></form>}
          {o.status === "pending" && <form action={switchMethod}>{pid}<input type="hidden" name="method" value="cash" /><button className="link">{t("pay_cash")}</button></form>}
        </> : <>
          <p>Pay <strong>{inr(o.total_paise)}</strong> in cash at the counter. The restaurant will mark it as paid.</p>
          {o.status === "pending" && <form action={switchMethod}>{pid}<input type="hidden" name="method" value="upi" /><button className="link">{t("pay_upi")}</button></form>}
        </>}
      </div>}
      {payable && o.rstate !== "active" && <div className="msg">{t("unavailable_page")} You cannot pay through the app right now.</div>}

      {cr?.status === "requested" && <div className="msg">{t("cancel_sent")}</div>}
      {cr?.status === "rejected" && o.status === "pending" && <div className="msg">{t("cancel_rejected")}</div>}
      {o.status === "pending" && cr?.status !== "requested" && (
        <details style={{ marginTop: 16 }}><summary>{t("request_cancel")}</summary>
          <form action={requestCancel}>{pid}<label htmlFor="reason">{t("reason")}</label><input id="reason" name="reason" required maxLength={300} />
            <p><Confirm className="alt" message="Send a cancellation request to the restaurant?">{t("request_cancel")}</Confirm></p></form></details>)}
      <p style={{ marginTop: 24 }}><Link href="/orders">← {t("my_orders")}</Link> · <Link href={`/r/${o.slug}`}>{t("view_menu")}</Link></p>
    </main>
  );
}
