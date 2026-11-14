"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Smartphone, Banknote } from "lucide-react";
import { checkCart, placeOrder, type CheckResult } from "@/app/actions/customer";
import { useT } from "@/components/I18n";
import { readCart, writeCart, type Cart } from "@/lib/cart";

const inr = (p: number) => { const [i, d] = (p / 100).toFixed(2).split("."); const l = i.slice(-3), r = i.slice(0, -3); return "₹" + (r ? r.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," : "") + l + "." + d; };

export default function Checkout({ restaurantId, slug, name, signedIn, staff, labels: L }: { restaurantId: number; slug: string; name: string; signedIn: boolean; staff: boolean; labels: Record<string, string> }) {
  const r = useRouter(); const _ = useT();
  const [cart, setCart] = useState<Cart | null | undefined>(undefined);
  const [chk, setChk] = useState<CheckResult | null>(null);
  const [table, setTable] = useState(0); const [method, setMethod] = useState<"upi" | "cash">("upi");
  const [step, setStep] = useState(1); const [ack, setAck] = useState(false); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);

  async function revalidate(c: Cart) {
    const res = await checkCart(restaurantId, c.lines.map((l) => ({ portionId: l.portionId, qty: l.qty })));
    setChk(res);
  }
  useEffect(() => {
    const c = readCart();
    if (c && c.restaurantId === restaurantId && c.lines.length) {
      if (!c.idem) { c.idem = crypto.randomUUID(); writeCart(c); }
      setCart(c); revalidate(c);
      try { const t = Number(sessionStorage.getItem("co-table")); if (t) setTable(t); } catch {}
    } else setCart(null);
  }, []); // eslint-disable-line

  function update(c: Cart) { c.updated = Date.now(); c.idem = crypto.randomUUID(); writeCart(c); setCart({ ...c }); setAck(false); revalidate(c); }
  const setQty = (pid: number, q: number) => { if (!cart) return; cart.lines = cart.lines.map((l) => l.portionId === pid ? { ...l, qty: Math.max(1, Math.min(50, q)) } : l); update(cart); };
  const remove = (pid: number) => { if (!cart) return; cart.lines = cart.lines.filter((l) => l.portionId !== pid); if (!cart.lines.length) { writeCart(null); setCart(null); return; } update(cart); };

  if (cart === undefined) return <main>…</main>;
  if (!cart) return <main><h1>{L.cart}</h1><p>{L.empty_cart}</p><Link className="btn" href={`/r/${slug}`}>{L.view_menu}</Link></main>;
  if (!chk) return <main>…</main>;

  const byId = new Map(chk.lines.map((l) => [l.portionId, l]));
  const gone = cart.lines.filter((l) => !byId.get(l.portionId)?.ok);
  const changed = cart.lines.filter((l) => { const s = byId.get(l.portionId); return s?.ok && s.price !== l.price; });
  const canOrder = chk.open && gone.length === 0 && (changed.length === 0 || ack) && table > 0 && !busy;

  function accept() { if (!cart) return; cart.lines = cart.lines.map((l) => { const s = byId.get(l.portionId); return s?.ok ? { ...l, price: s.price } : l; }); update(cart); setAck(true); }

  async function submit() {
    if (!cart) return;
    if (!signedIn) { try { sessionStorage.setItem("co-table", String(table)); } catch {} r.push(`/login?next=${encodeURIComponent(`/r/${slug}/checkout`)}`); return; }
    setBusy(true); setErr("");
    const res = await placeOrder({ restaurantId, tableId: table, method, idem: cart.idem!, lines: cart.lines.map((l) => ({ portionId: l.portionId, qty: l.qty, expectedPrice: l.price })) });
    if ("error" in res) { setErr(res.error); setBusy(false); revalidate(cart); return; }
    writeCart(null); r.push(`/orders/${res.publicId}?new=1`);
  }

  const tableName = chk.tables.find((t) => t.id === table)?.name;
  const sum = (
    <aside className="card sticky">
      <h3 style={{ marginTop: 0 }}>{name}</h3>
      {cart.lines.map((l) => <div className="kv" key={l.portionId}><span>{l.qty} × {l.name}{l.portion ? ` (${l.portion})` : ""}</span><span>{inr((byId.get(l.portionId)?.ok ? byId.get(l.portionId)!.price : l.price) * l.qty)}</span></div>)}
      {tableName && <div className="kv"><span>{L.table}</span><strong>{tableName}</strong></div>}
      {step >= 2 && <div className="kv"><span>{L.payment}</span><strong>{method === "upi" ? "UPI" : _("Cash")}</strong></div>}
      <div className="big-total"><span>{L.total}</span><span>{inr(chk.total)}</span></div>
    </aside>
  );
  return (
    <main>
      <Link className="crumb" href={`/r/${slug}`}><ArrowLeft size={16} /> {name}</Link>
      <h1 style={{ marginTop: 4 }}>{L.checkout}</h1>
      <div className="stepper" style={{ maxWidth: 560 }}>{[[1, L.table], [2, L.payment], [3, _("Confirm")]].map(([n, l], i) => <span key={n as number} style={{ display: "contents" }}>{i > 0 && <hr />}<span className={`s ${step >= (n as number) ? "on" : ""}`}><b>{step > (n as number) ? <Check size={16} /> : n}</b>{l}</span></span>)}</div>
      {!chk.open && <div className="msg err">{L.closed_cart}</div>}
      {gone.length > 0 && <div className="msg err">{L.item_gone}</div>}
      {changed.length > 0 && !ack && <div className="msg err"><span>{L.price_changed}</span> <button className="alt" onClick={accept}>{L.confirm_prices}</button></div>}
      {err && <div className="msg err" role="alert">{err}</div>}
      {staff && <div className="msg">{_("Sign in with a customer account to order.")}</div>}
      <div className="cols">
        <div className="stack">
          {step === 1 && <>
            <div className="card"><h3 style={{ marginTop: 0 }}>{_("Your order")}</h3>
              {cart.lines.map((l) => { const s2 = byId.get(l.portionId); const bad = !s2?.ok; return (
                <div className="cline" key={l.portionId}>
                  <div><div className="nm">{l.name}{l.portion && <span className="muted"> · {l.portion}</span>}</div>
                    {bad && <div className="bad">{L.unavailable}</div>}{!bad && s2!.price !== l.price && <div className="bad">{inr(l.price)} → {inr(s2!.price)}</div>}
                    <button className="link" style={{ fontSize: ".82rem" }} onClick={() => remove(l.portionId)}>{L.remove}</button></div>
                  <div className="qty"><button aria-label={_("Decrease")} onClick={() => setQty(l.portionId, l.qty - 1)}>−</button><b>{l.qty}</b><button aria-label={_("Increase")} onClick={() => setQty(l.portionId, l.qty + 1)}>+</button></div>
                  <div className="pr">{inr((bad ? l.price : s2!.price) * l.qty)}</div>
                </div>); })}
            </div>
            <div className="card"><h3 style={{ marginTop: 0 }}>{L.choose_table}</h3>
              <div className="tchips">{chk.tables.map((t) => <button key={t.id} className={`tchip ${table === t.id ? "on" : ""}`} onClick={() => setTable(t.id)}><small>{L.table}</small>{t.name}</button>)}</div>
              {chk.tables.length === 0 && <p className="muted">{_("No tables available.")}</p>}</div>
            <button className="lg" disabled={!chk.open || gone.length > 0 || (changed.length > 0 && !ack) || table === 0 || staff} onClick={() => setStep(2)}>{L.next} <ArrowRight size={18} /></button></>}

          {step === 2 && <>
            <div className="card stack"><h3 style={{ marginTop: 0 }}>{L.payment}</h3>
              <label className={`opt ${method === "upi" ? "on" : ""}`}><i><Smartphone size={20} /></i><span><b>{L.pay_upi}</b><small>{_("Scan and pay after you place the order")}</small></span><input type="radio" name="m" checked={method === "upi"} onChange={() => setMethod("upi")} /></label>
              <label className={`opt ${method === "cash" ? "on" : ""}`}><i><Banknote size={20} /></i><span><b>{L.pay_cash}</b><small>{_("Pay at the counter when you are done")}</small></span><input type="radio" name="m" checked={method === "cash"} onChange={() => setMethod("cash")} /></label></div>
            <div className="row"><button className="alt" onClick={() => setStep(1)}><ArrowLeft size={16} /> {L.back}</button><button className="lg" onClick={() => setStep(3)}>{L.next} <ArrowRight size={18} /></button></div></>}

          {step === 3 && <>
            <div className="card"><h3 style={{ marginTop: 0 }}>{_("Review & confirm")}</h3>
              <div className="kv"><span>{L.table}</span><strong>{tableName}</strong></div>
              <div className="kv"><span>{L.payment}</span><strong>{method === "upi" ? L.pay_upi : L.pay_cash}</strong></div>
              <div className="kv"><span>{_("Items")}</span><strong>{cart.lines.reduce((n, l) => n + l.qty, 0)}</strong></div>
              <div className="big-total"><span>{L.total}</span><span>{inr(chk.total)}</span></div></div>
            <div className="row"><button className="alt" onClick={() => setStep(2)}><ArrowLeft size={16} /> {L.back}</button>
              <button className="hot lg" style={{ background: "linear-gradient(135deg,var(--saffron),var(--coral))" }} disabled={!canOrder || staff} onClick={submit}>{busy ? _("Placing…") : signedIn ? `${L.place_order} · ${inr(chk.total)}` : L.signin}</button></div></>}
        </div>
        {sum}
      </div>
    </main>
  );
}
