export type CartLine = { itemId: number; portionId: number; name: string; portion: string; price: number; qty: number };
export type Cart = { restaurantId: number; slug: string; name: string; updated: number; lines: CartLine[]; idem?: string };
const KEY = "cart-v1", WEEK = 7 * 86400_000; // CART-04

export function readCart(): Cart | null {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || "null") as Cart | null;
    if (!c || Date.now() - c.updated > WEEK) { localStorage.removeItem(KEY); return null; }
    return c;
  } catch { return null; }
}
export function writeCart(c: Cart | null) { try { c ? localStorage.setItem(KEY, JSON.stringify(c)) : localStorage.removeItem(KEY); } catch {} }
export const cartCount = (c: Cart) => c.lines.reduce((s, l) => s + l.qty, 0);
