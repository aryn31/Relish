"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { MenuData } from "./MenuView";
import { readCart, writeCart, cartCount, type Cart } from "@/lib/cart";

const inr = (p: number) => { const [i, d] = (p / 100).toFixed(2).split("."); const l = i.slice(-3), r = i.slice(0, -3); return "₹" + (r ? r.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," : "") + l + "." + d; };

export default function MenuClient({ restaurantId, slug, name, menu, labels, disabled }: { restaurantId: number; slug: string; name: string; menu: MenuData; labels: Record<string, string>; disabled?: boolean }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [pick, setPick] = useState<Record<number, number>>({});
  useEffect(() => { setCart(readCart()); }, []);

  function add(item: MenuData["cats"][0]["items"][0]) {
    const pid = pick[item.id] ?? item.portions.find((p) => p.available)?.id; const p = item.portions.find((x) => x.id === pid); if (!p) return;
    let c = cart && cart.restaurantId === restaurantId ? cart : null;
    if (!c && cart && cart.lines.length && !confirm("Your cart has items from another restaurant. Clear it and start a new cart here?")) return;
    c = c ?? { restaurantId, slug, name, updated: Date.now(), lines: [] };
    const ex = c.lines.find((l) => l.portionId === p.id);
    if (ex) ex.qty = Math.min(ex.qty + 1, 50); else c.lines.push({ itemId: item.id, portionId: p.id, name: item.name, portion: p.label, price: p.price, qty: 1 });
    c.updated = Date.now(); writeCart(c); setCart({ ...c });
  }
  const mine = cart && cart.restaurantId === restaurantId ? cart : null;
  const count = mine ? cartCount(mine) : 0, total = mine ? mine.lines.reduce((s, l) => s + l.price * l.qty, 0) : 0;

  return (
    <>
      {menu.cats.length === 0 && <p className="muted">No items yet.</p>}
      {menu.cats.length > 1 && <nav className="mnav chips">{menu.cats.map((c) => <a key={c.id} className="chip" href={`#cat-${c.id}`}>{c.name}</a>)}</nav>}
      {menu.cats.map((c) => (
        <section key={c.id} id={`cat-${c.id}`} className="cathead"><h2>{c.name}</h2>
          <div className="mgrid">
          {c.items.map((i) => {
            const sel = i.portions.find((p) => p.id === (pick[i.id] ?? i.portions.find((x) => x.available)?.id)); const ok = i.available && i.portions.some((p) => p.available);
            const multi = i.portions.length > 1 || !!i.portions[0]?.label;
            return (
              <div className="mcard" key={i.id} style={ok ? undefined : { opacity: .6 }}>
                <div className="ph">{i.image && <img src={`/api/img/${i.image}`} alt={i.name} loading="lazy" />}
                  {i.veg !== null && <span className="vt"><span className={`dot ${i.veg ? "v" : "n"}`} />{i.veg ? labels.veg : labels.nonveg}</span>}</div>
                <div className="info">
                  <h3>{i.name}</h3>
                  {i.description && <p className="d">{i.description}</p>}
                  {multi && <select aria-label="Portion" value={sel?.id} onChange={(e) => setPick({ ...pick, [i.id]: Number(e.target.value) })}>
                    {i.portions.map((p) => <option key={p.id} value={p.id} disabled={!p.available}>{p.label} — {inr(p.price)}{p.available ? "" : ` (${labels.unavailable})`}</option>)}</select>}
                  <div className="foot">
                    <span className="price">{inr((sel ?? i.portions[0]).price)}</span>
                    {ok ? <button className="addbtn" aria-label={`${labels.add_to_cart} ${i.name}`} disabled={disabled || !sel?.available} onClick={() => add(i)}>+</button> : <span className="badge cancelled">{labels.unavailable}</span>}
                  </div>
                </div>
              </div>);
          })}
          </div>
        </section>))}
      {!disabled && count > 0 && <div className="cartbar"><span>{count} item{count > 1 ? "s" : ""} · <strong>{inr(total)}</strong></span><Link className="btn" href={`/r/${slug}/checkout`}>{labels.checkout} →</Link></div>}
    </>
  );
}
