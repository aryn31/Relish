import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db, inr, fmtDate } from "@/lib/db";
import { tr } from "@/lib/i18n";
import { updateProfile, deleteMyAccount } from "../actions/auth";
import Flash from "@/components/Flash";
import AutoRefresh from "@/components/AutoRefresh";
import Confirm from "@/components/Confirm";

export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams; const u = await requireUser("/orders"); const { t } = await tr();
  const orders = await db.prepare("SELECT o.*, r.name rname FROM orders o JOIN restaurants r ON r.id=o.restaurant_id WHERE o.customer_id=? ORDER BY o.id DESC LIMIT 100").all(u.id) as any[];
  return (
    <main style={{ maxWidth: 720 }}><h1>{t("my_orders")}</h1><Flash sp={sp} /><AutoRefresh seconds={25} />
      {orders.length === 0 && <p className="muted">No orders yet. <Link href="/#restaurants">{t("find")}</Link></p>}
      <div className="stack">{orders.map((o) => (
        <Link key={o.id} href={`/orders/${o.public_id}`} className="card" style={{ display: "block", color: "inherit", textDecoration: "none" }}>
          <div className="row"><strong>{o.rname} #{o.number}</strong><span className={`badge ${o.status}`}>{t(o.status)}</span><span className={`badge ${o.payment_status}`}>{o.payment_status === "paid" ? t("paid") : t("payment_pending")}</span><span className="muted" style={{ marginLeft: "auto" }}>{fmtDate(o.created_at)}</span></div>
          <div>{inr(o.total_paise)} · {t("table")} {o.table_name}</div></Link>))}</div>
      {u.role === "customer" && <><h2>Account</h2>
        <form action={updateProfile} className="row"><input type="hidden" name="back" value="/orders" /><input className="grow" name="name" defaultValue={u.name} aria-label={t("name")} /><button className="alt">{t("save")}</button></form>
        <form action={deleteMyAccount} style={{ marginTop: 12 }}><Confirm className="link" message="Delete your account? Your name is removed from past orders; the restaurants keep the order records.">Delete my account</Confirm></form></>}
    </main>
  );
}
