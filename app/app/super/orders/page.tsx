import { db, inr, fmtDate } from "@/lib/db";
import { supportRevertPayment } from "@/app/actions/super";
import Flash from "@/components/Flash";
import Confirm from "@/components/Confirm";
// SA-03: individual order lookup for support and disputes only.
export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string; r?: string; n?: string }> }) {
  const sp = await searchParams;
  const rs = db.prepare("SELECT id,name FROM restaurants ORDER BY name").all() as { id: number; name: string }[];
  const o = sp.r && sp.n ? db.prepare("SELECT o.*, u.name cname FROM orders o JOIN users u ON u.id=o.customer_id WHERE o.restaurant_id=? AND o.number=?").get(Number(sp.r), Number(sp.n)) as any : null;
  const lines = o ? db.prepare("SELECT * FROM order_lines WHERE order_id=?").all(o.id) as any[] : [];
  return (
    <div><Flash sp={sp} /><p className="muted">For support and disputes only.</p>
      <form className="row" action="/super/orders"><select name="r" defaultValue={sp.r} style={{ width: "auto" }} aria-label="Restaurant">{rs.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select><input name="n" type="number" placeholder="Order #" defaultValue={sp.n} style={{ width: 120 }} aria-label="Order number" /><button>Find</button></form>
      {sp.n && !o && <p>No such order.</p>}
      {o && <div className="card" style={{ marginTop: 12 }}><strong>#{o.number}</strong> · {o.cname} · table {o.table_name} · {o.status} · payment {o.payment_status} ({o.payment_method}) · {fmtDate(o.created_at)}
        <ul>{lines.map((l) => <li key={l.id}>{l.qty} × {l.item_name} {l.portion_name} — {inr(l.line_paise)}</li>)}</ul><strong>{inr(o.total_paise)}</strong>
        {o.payment_status === "paid" && <form action={supportRevertPayment} className="row" style={{ marginTop: 8 }}><input type="hidden" name="id" value={o.id} /><input name="note" placeholder="Reason for correction" required style={{ width: 240 }} /><Confirm className="danger" message="Revert this payment to Pending (support correction)?">Revert payment (correction)</Confirm></form>}</div>}
    </div>
  );
}
