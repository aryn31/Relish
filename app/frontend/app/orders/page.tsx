import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { load } from "@/lib/api";
import { inr } from "@/lib/format";
import { tr } from "@/lib/i18n";
import { updateProfile, deleteMyAccount } from "../actions/auth";
import PageHead from "@/components/PageHead";
import Flash from "@/components/Flash";
import AutoRefresh from "@/components/AutoRefresh";
import Confirm from "@/components/Confirm";

type Order = { id: number; public_id: string; number: number; status: "pending" | "completed" | "cancelled"; payment_status: "pending" | "paid"; table_name: string; total_paise: number; created_at: string; rname: string; cover: string | null };

export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams; const u = await requireUser("/orders"); const { t, _, fd } = await tr();
  const { orders } = await load<{ orders: Order[] }>("/api/orders", "/orders");
  return (
    <main style={{ maxWidth: 820 }}><PageHead title={t("my_orders")} sub={_("Track your orders and payments.")} /><Flash sp={sp} /><AutoRefresh seconds={25} />
      {orders.length === 0 && <p className="muted">{_("No orders yet.")} <Link href="/#restaurants">{t("find")}</Link></p>}
      <div className="stack">{orders.map((o) => (
        <Link key={o.id} href={`/orders/${o.public_id}`} className="card ordcard">
          {o.cover ? <img className="im" src={`/api/img/${o.cover}`} alt="" /> : <div className="im" />}
          <div className="info"><div className="row"><strong style={{ fontSize: "1.05rem" }}>{o.rname}</strong><span className="muted">#{o.number}</span></div>
            <div className="row" style={{ margin: "6px 0" }}><span className={`badge ${o.status}`}>{t(o.status)}</span><span className={`badge ${o.payment_status}`}>{o.payment_status === "paid" ? t("paid") : t("payment_pending")}</span></div>
            <div className="muted" style={{ fontSize: ".88rem" }}>{t("table")} {o.table_name} · {fd(o.created_at)}</div></div>
          <div className="tot">{inr(o.total_paise)}</div></Link>))}</div>
      {u.role === "customer" && <><h2 style={{ fontSize: "1.2rem" }}>{_("Account")}</h2>
        <form action={updateProfile} className="row"><input type="hidden" name="back" value="/orders" /><input className="grow" name="name" defaultValue={u.name} aria-label={t("name")} /><button className="alt">{t("save")}</button></form>
        <form action={deleteMyAccount} style={{ marginTop: 12 }}><Confirm className="link" message={_("Delete your account? Your name is removed from past orders; the restaurants keep the order records.")}>{_("Delete my account")}</Confirm></form></>}
    </main>
  );
}
