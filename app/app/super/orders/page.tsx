import { db, inr } from "@/lib/db";
import { supportRevertPayment } from "@/app/actions/super";
import PageHead from "@/components/PageHead";
import Flash from "@/components/Flash";
import Confirm from "@/components/Confirm";
import { tr } from "@/lib/i18n";
// SA-03: individual order lookup for support and disputes only.
export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string; r?: string; n?: string }> }) {
  const sp = await searchParams; const { _, fd } = await tr();
  const rs = await db.prepare("SELECT id,name FROM restaurants ORDER BY name").all() as { id: number; name: string }[];
  const o = sp.r && sp.n ? await db.prepare("SELECT o.*, u.name cname FROM orders o JOIN users u ON u.id=o.customer_id WHERE o.restaurant_id=? AND o.number=?").get(Number(sp.r), Number(sp.n)) as any : null;
  const lines = o ? await db.prepare("SELECT * FROM order_lines WHERE order_id=?").all(o.id) as any[] : [];
  return (
    <div><PageHead title="Order lookup" sub="For support and disputes only." /><Flash sp={sp} />
      <form className="row card" action="/super/orders"><select name="r" defaultValue={sp.r} style={{ width: "auto" }} aria-label={_("Restaurant")}>{rs.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select><input name="n" type="number" placeholder={_("Order #")} defaultValue={sp.n} style={{ width: 120 }} aria-label={_("Order number")} /><button>{_("Find")}</button></form>
      {sp.n && !o && <p>{_("No such order.")}</p>}
      {o && <div className="card" style={{ marginTop: 12 }}><strong>#{o.number}</strong> · {o.cname} · {_("table")} {o.table_name} · {_(o.status)} · {_("payment")} {_(o.payment_status)} ({_(o.payment_method)}) · {fd(o.created_at)}
        <ul>{lines.map((l) => <li key={l.id}>{l.qty} × {l.item_name} {l.portion_name} — {inr(l.line_paise)}</li>)}</ul><strong>{inr(o.total_paise)}</strong>
        {o.payment_status === "paid" && <form action={supportRevertPayment} className="row" style={{ marginTop: 8 }}><input type="hidden" name="id" value={o.id} /><input name="note" placeholder={_("Reason for correction")} required style={{ width: 240 }} /><Confirm className="danger" message={_("Revert this payment to Pending (support correction)?")}>{_("Revert payment (correction)")}</Confirm></form>}</div>}
    </div>
  );
}
