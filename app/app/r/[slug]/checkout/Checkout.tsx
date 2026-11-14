"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { checkCart, placeOrder, type CheckResult } from "@/app/actions/customer";
import { readCart, writeCart, type Cart } from "@/lib/cart";

const inr = (p: number) => { const [i, d] = (p / 100).toFixed(2).split("."); const l = i.slice(-3), r = i.slice(0, -3); return "₹" + (r ? r.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," : "") + l + "." + d; };

export default function Checkout({ restaurantId, slug, name, signedIn, staff, labels: L }: { restaurantId: number; slug: string; name: string; signedIn: boolean; staff: boolean; labels: Record<string, string> }) {
  const r = useRouter();
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

  return (
    <main style={{ maxWidth: 640 }}>
      <h1>{L.checkout} — {name}</h1>
      <div className="stepper">{[[1, L.table], [2, L.payment], [3, "Confirm"]].map(([n, l], i) => <span key={n as number} style={{ display: "contents" }}>{i > 0 && <hr />}<span className={`s ${step >= (n as number) ? "on" : ""}`}><b>{n}</b>{l}</span></span>)}</div>
      {!chk.open && <div className="msg err">{L.closed_cart}</div>}
      {gone.length > 0 && <div className="msg err">{L.item_gone}</div>}
      {changed.length > 0 && !ack && <div className="msg err">{L.price_changed} <button className="alt" onClick={accept}>{L.confirm_prices}</button></div>}
      {err && <div className="msg err" role="alert">{err}</div>}
      {staff && <div className="msg">Sign in with a customer account to order.</div>}
      <table className="t"><tbody>
        {cart.lines.map((l) => { const s = byId.get(l.portionId); const bad = !s?.ok; return (
          <tr key={l.portionId}><td><strong>{l.name}</strong>{l.portion && ` (${l.portion})`}{bad && <div className="bad">{L.unavailable}</div>}
            {!bad && s!.price !== l.price && <div className="bad">{inr(l.price)} → {inr(s!.price)}</div>}</td>
            <td><input type="number" min={1} max={50} value={l.qty} aria-label={L.qty} style={{ width: 70 }} onChange={(e) => setQty(l.portionId, Number(e.target.value))} /></td>
            <td>{inr((bad ? l.price : s!.price) * l.qty)}</td><td><button className="link" onClick={() => remove(l.portionId)}>{L.remove}</button></td></tr>); })}
      </tbody></table>
      <h3>{L.total}: {inr(chk.total)}</h3>

      {step === 1 && <>
        <label htmlFor="table">{L.choose_table}</label>
        <select id="table" value={table} onChange={(e) => setTable(Number(e.target.value))}>
          <option value={0}>—</option>{chk.tables.map((t) => <option key={t.id} value={t.id}>{L.table} {t.name}</option>)}</select>
        <p style={{ marginTop: 18 }}><button disabled={!chk.open || gone.length > 0 || (changed.length > 0 && !ack) || table === 0 || staff} onClick={() => setStep(2)}>{L.next} →</button></p></>}

      {step === 2 && <>
        <div className="card"><div className="row"><span>{L.table} <strong>{chk.tables.find((t) => t.id === table)?.name}</strong></span><button className="link" onClick={() => setStep(1)}>Change</button></div></div>
        <label>{L.payment}</label>
        <label style={{ fontWeight: 400 }}><input type="radio" checked={method === "upi"} onChange={() => setMethod("upi")} /> {L.pay_upi}</label>
        <label style={{ fontWeight: 400 }}><input type="radio" checked={method === "cash"} onChange={() => setMethod("cash")} /> {L.pay_cash}</label>
        <p className="row" style={{ marginTop: 18 }}><button className="alt" onClick={() => setStep(1)}>← {L.back}</button><button onClick={() => setStep(3)}>{L.next} →</button></p></>}

      {step === 3 && <>
        <div className="card stack"><div>{L.table}: <strong>{chk.tables.find((t) => t.id === table)?.name}</strong></div><div>{L.payment}: <strong>{method === "upi" ? L.pay_upi : L.pay_cash}</strong></div><div>{L.total}: <strong>{inr(chk.total)}</strong></div></div>
        <p className="row" style={{ marginTop: 18 }}><button className="alt" onClick={() => setStep(2)}>← {L.back}</button><button disabled={!canOrder || staff} onClick={submit}>{signedIn ? `${L.place_order} · ${inr(chk.total)}` : L.signin}</button></p></>}

      <p><Link href={`/r/${slug}`}>← {L.back}</Link></p>
    </main>
  );
}
