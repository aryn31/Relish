import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { api } from "@/lib/api";
import { inr } from "@/lib/format";
import { tr } from "@/lib/i18n";
import { reportPaid, switchMethod, requestCancel } from "@/app/actions/customer";
import { ArrowLeft, Check, X, Clock, PartyPopper } from "lucide-react";
import Flash from "@/components/Flash";
import AutoRefresh from "@/components/AutoRefresh";
import Confirm from "@/components/Confirm";

type Detail = {
  order: { id: number; public_id: string; number: number; status: "pending" | "completed" | "cancelled"; payment_status: "pending" | "paid"; payment_method: string; claimed_paid: number; prep_minutes: number | null; table_name: string; total_paise: number; created_at: string; rname: string; slug: string; rstate: string; has_upi_qr: boolean };
  lines: { id: number; item_name: string; portion_name: string; qty: number; unit_paise: number; line_paise: number }[];
  cancel: { status: string; reason: string } | null;
};

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string; new?: string }> }) {
  const { id } = await params; const sp = await searchParams; await requireUser(`/orders/${id}`); const { t, _, fd } = await tr();
  // ROLE-04/AUTH-07: customers only see their own orders.
  const res = await api.get<Detail>(`/api/orders/${encodeURIComponent(id)}`);
  if (res.status === 401) redirect(`/login?next=${encodeURIComponent(`/orders/${id}`)}`);
  if (!res.ok && res.status !== 404) throw new Error(res.data.error || `API error ${res.status}`);
  const o = res.ok ? res.data.order : undefined;
  if (!o) return <main><h1>{_("Order not found")}</h1><Link href="/orders">{t("my_orders")}</Link></main>;
  const lines = res.data.lines; const cr = res.data.cancel ?? undefined;
  const payable = o.payment_status === "pending" && o.status !== "cancelled";
  const pid = <input type="hidden" name="pid" value={id} />;
  return (
    <main>
      <Link className="crumb" href="/orders"><ArrowLeft size={16} /> {t("my_orders")}</Link>
      <Flash sp={sp} /><AutoRefresh seconds={20} />
      {sp.new && <div className="msg good"><PartyPopper size={20} /> {_("Order placed! The restaurant has received it.")}</div>}
      <div className="pagehead"><div><h1 style={{ marginBottom: 6 }}>{o.rname} · #{o.number}</h1>
        <div className="statusbar"><span className={`badge ${o.status}`}>{t(o.status)}</span><span className={`badge ${o.payment_status}`}>{o.payment_status === "paid" ? t("paid") : t("payment_pending")}</span><span className="muted">{t("table")} {o.table_name} · {fd(o.created_at)}</span></div></div>
        <Link className="btn alt" href={`/r/${o.slug}`}>{t("view_menu")}</Link></div>
      <div className="cols">
        <div className="stack">
          <div className="card"><h3 style={{ marginTop: 0 }}>{_("Order status")}</h3>
            <ul className="tl" style={{ marginTop: 14 }}>
              <li className="done"><span className="pt"><Check size={15} /></span><strong>{_("Order placed")}</strong><div className="muted">{fd(o.created_at)}</div></li>
              {o.status === "cancelled" ? <li className="bad"><span className="pt"><X size={15} /></span><strong>{t("cancelled")}</strong></li> : <>
                <li className={o.status === "completed" ? "done" : "now"}><span className="pt">{o.status === "completed" ? <Check size={15} /> : <Clock size={14} />}</span><strong>{o.status === "completed" ? _("Prepared & served") : _("Being prepared")}</strong>
                  {o.status === "pending" && <div className="muted">{o.prep_minutes != null ? `${t("prep_time")}: ${o.prep_minutes} ${t("minutes")}` : _("The restaurant will set an estimated time")}</div>}</li>
                <li className={o.status === "completed" ? "done" : ""}><span className="pt">{o.status === "completed" && <Check size={15} />}</span><strong>{t("completed")}</strong></li></>}
            </ul></div>
          <div className="card items-list"><h3 style={{ marginTop: 0 }}>{_("Items")}</h3>
            {lines.map((l) => <div className="kv" key={l.id}><span>{l.qty} × {l.item_name}{l.portion_name ? ` (${l.portion_name})` : ""}</span><strong>{inr(l.line_paise)}</strong></div>)}
            <div className="big-total"><span>{t("total")}</span><span>{inr(o.total_paise)}</span></div></div>
          {o.status === "cancelled" && o.payment_status === "paid" && <div className="msg">{t("cancelled_paid_note")}</div>}
          {cr?.status === "requested" && <div className="msg">{t("cancel_sent")}</div>}
          {cr?.status === "rejected" && o.status === "pending" && <div className="msg">{t("cancel_rejected")}</div>}
          {o.status === "pending" && cr?.status !== "requested" && (
            <details className="card"><summary style={{ cursor: "pointer", fontWeight: 650 }}>{t("request_cancel")}</summary>
              <form action={requestCancel}>{pid}<label htmlFor="reason">{t("reason")}</label><input id="reason" name="reason" required maxLength={300} />
                <p><Confirm className="alt" message={_("Send a cancellation request to the restaurant?")}>{t("request_cancel")}</Confirm></p></form></details>)}
        </div>
        <div className="stack sticky">
          {payable && o.rstate === "active" && <div className="card stack">
            <h3 style={{ margin: 0 }}>{t("payment")}</h3>
            {o.payment_method === "upi" ? <>
              <p style={{ margin: 0 }}>{_("Scan with any UPI app and pay exactly {amt}.", { amt: "\u0000" }).split("\u0000").map((x, i) => i === 0 ? x : [<strong key="a">{inr(o.total_paise)}</strong>, x])}</p>
              {o.has_upi_qr && <div className="qrbox"><img src={`/api/upi/${id}`} alt={_("UPI QR code")} width={200} height={200} style={{ maxWidth: "100%", height: "auto" }} /></div>}
              {o.claimed_paid ? <div className="msg good" style={{ margin: 0 }}>{t("claimed")}</div> : <form action={reportPaid}>{pid}<button style={{ width: "100%" }}>{t("i_paid")}</button></form>}
              {o.status === "pending" && <form action={switchMethod} style={{ textAlign: "center" }}>{pid}<input type="hidden" name="method" value="cash" /><button className="link">{t("pay_cash")}</button></form>}
            </> : <>
              <p style={{ margin: 0 }}>{_("Pay {amt} in cash at the counter. The restaurant will mark it as paid.", { amt: "\u0000" }).split("\u0000").map((x, i) => i === 0 ? x : [<strong key="a">{inr(o.total_paise)}</strong>, x])}</p>
              {o.status === "pending" && <form action={switchMethod}>{pid}<input type="hidden" name="method" value="upi" /><button className="alt" style={{ width: "100%" }}>{t("pay_upi")}</button></form>}
            </>}
          </div>}
          {payable && o.rstate !== "active" && <div className="msg">{t("unavailable_page")} {_("You cannot pay through the app right now.")}</div>}
          {o.payment_status === "paid" && <div className="card" style={{ textAlign: "center" }}><Check size={28} color="#15803d" /><h3 style={{ margin: "6px 0 0" }}>{_("Payment received")}</h3></div>}
        </div>
      </div>
    </main>
  );
}
