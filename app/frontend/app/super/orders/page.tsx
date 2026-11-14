import { load } from "@/lib/api";
import { inr } from "@/lib/format";
import { supportRevertPayment } from "@/app/actions/super";
import PageHead from "@/components/PageHead";
import Flash from "@/components/Flash";
import Confirm from "@/components/Confirm";
import { tr } from "@/lib/i18n";
type Order = { id: number; number: number; cname: string; table_name: string; status: string; payment_status: string; payment_method: string; created_at: string; total_paise: number };
type Line = { id: number; qty: number; item_name: string; portion_name: string; line_paise: number };
// SA-03: individual order lookup for support and disputes only.
export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string; r?: string; n?: string }> }) {
  const sp = await searchParams; const { _, fd } = await tr();
  const q = new URLSearchParams(); if (sp.r) q.set("r", sp.r); if (sp.n) q.set("n", sp.n);
  const { restaurants: rs, order: o, lines } = await load<{ restaurants: { id: number; name: string }[]; order: Order | null; lines: Line[] }>(`/api/super/orders?${q}`, "/super/orders");
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
