import Link from "next/link";
import { db } from "@/lib/db";
import { tr } from "@/lib/i18n";
import type { Restaurant } from "@/lib/restaurant";
import Icon from "@/components/Icon";

const PAGE = 12;
type Row = Restaurant & { cover: string | null };
export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; p?: string }> }) {
  const { q = "", type = "", p = "1" } = await searchParams; const { t, _ } = await tr();
  const page = Math.max(1, Number(p) || 1);
  const where = ["r.state='active'"]; const args: (string | number)[] = [];
  if (q) { where.push("r.name ILIKE ?"); args.push(`%${q}%`); }
  if (type) { where.push("r.type=?"); args.push(type); }
  const list = (await db.prepare(`SELECT r.*, (SELECT image FROM items WHERE restaurant_id=r.id AND deleted=0 AND image IS NOT NULL ORDER BY id LIMIT 1) cover FROM restaurants r WHERE ${where.join(" AND ")} ORDER BY r.name LIMIT ? OFFSET ?`).all(...args, PAGE + 1, (page - 1) * PAGE)) as Row[];
  const types = ((await db.prepare("SELECT DISTINCT type FROM restaurants WHERE state='active' ORDER BY type").all()) as { type: string }[]).map((x) => x.type);
  const collage = ((await db.prepare("SELECT DISTINCT ON (i.restaurant_id) i.image FROM items i JOIN restaurants r ON r.id=i.restaurant_id WHERE r.state='active' AND i.image IS NOT NULL AND i.deleted=0 ORDER BY i.restaurant_id, i.id DESC LIMIT 3").all()) as { image: string }[]).map((x) => x.image);
  const n = (await db.prepare("SELECT (SELECT COUNT(*) FROM restaurants WHERE state='active') r, (SELECT COUNT(*) FROM items i JOIN restaurants r ON r.id=i.restaurant_id WHERE r.state='active' AND i.deleted=0) d, (SELECT COUNT(*) FROM orders) o").get()) as { r: number; d: number; o: number };
  const chipHref = (ty: string) => `/?${new URLSearchParams({ ...(q && { q }), ...(ty && { type: ty }) })}#restaurants`;
  const qs = (k: number) => `/?${new URLSearchParams({ ...(q && { q }), ...(type && { type }), p: String(k) })}#restaurants`;
  const cuisines = ["Biryani", "Paneer Tikka", "Masala Chai", "Pizza", "Butter Chicken", "Cappuccino", "Gulab Jamun", "Burgers", "Dal Makhani", "Pasta", "Kulfi", "Naan"];
  return (
    <main>
      <section className="hero">
        <div>
          <span className="eyebrow"><Icon name="spark" size={14} /> {_("Dine-in ordering, reimagined")}</span>
          <h1>{_("Discover great food.")} <em>{_("Order with ease.")}</em></h1>
          <p className="lead">{_("Scan the QR at your table, browse the menu with photos, order and pay — no waiting for the waiter.")}</p>
          <form className="search" action="/#restaurants"><input name="q" defaultValue={q} placeholder={t("search")} aria-label={t("search")} /><button><Icon name="search" size={16} />{t("go")}</button></form>
          <div className="stats"><div><b>{n.r}</b><span>{_("Restaurants")}</span></div><div><b>{n.d}+</b><span>{_("Dishes")}</span></div><div><b>{n.o}+</b><span>{_("Orders served")}</span></div></div>
        </div>
        {collage.length >= 3 && <div className="collage" aria-hidden="true">
          {collage.map((c) => <img key={c} src={`/api/img/${c}`} alt="" />)}
          <div className="float-chip a"><i><Icon name="qr" size={16} /></i>{_("Scan & order")}</div>
          <div className="float-chip b"><i><Icon name="check" size={16} /></i>{_("Table 5 · Confirmed")}</div>
        </div>}
      </section>

      <div className="marquee" aria-hidden="true"><div>{[...cuisines, ...cuisines].map((c, i) => <span key={i}>{c}</span>)}</div></div>

      <section id="restaurants">
        <div className="sec-head"><div><span className="eyebrow">{_("Explore")}</span><h2>{_("Find your next meal")}</h2></div>
          <form className="row" action="/#restaurants" style={{ flexWrap: "nowrap" }}>{type && <input type="hidden" name="type" value={type} />}<input name="q" defaultValue={q} placeholder={t("search")} aria-label={t("search")} style={{ minWidth: 230 }} /><button className="alt"><Icon name="search" size={16} /></button></form></div>
        <div className="chips"><a className={`chip ${type ? "" : "on"}`} href={chipHref("")}>{t("all_types")}</a>{types.map((x) => <a key={x} className={`chip ${type === x ? "on" : ""}`} href={chipHref(x)}>{_(x)}</a>)}</div>
        {list.length === 0 ? <p className="muted">{t("none_found")}</p> :
          <div className="rgrid" style={{ marginTop: 10 }}>
            {list.slice(0, PAGE).map((r) => (
              <Link href={`/r/${r.slug}`} className="rcard" key={r.id}>
                {r.cover && <img src={`/api/img/${r.cover}`} alt="" />}
                <span className="tag">{_(r.type)}</span><span className="go"><Icon name="up" size={20} /></span>
                <div className="body"><h3>{r.name}</h3><div className="loc"><Icon name="pin" size={14} />{r.address}</div>{r.description && <p className="desc">{r.description}</p>}</div>
              </Link>))}
          </div>}
        <p className="row" style={{ marginTop: 18 }}>{page > 1 && <Link className="btn alt" href={qs(page - 1)}>← {t("prev")}</Link>}{list.length > PAGE && <Link className="btn alt" href={qs(page + 1)}>{t("next")} →</Link>}</p>
      </section>

      <div className="sec-head"><div><span className="eyebrow">{_("How it works")}</span><h2>{_("From table to plate in three taps")}</h2></div></div>
      <section className="bento">
        <div className="tile t1"><h3>{t("how_c")}</h3>
          {[t("how_c1"), t("how_c2"), t("how_c3")].map((s, i) => <div className="step" key={i}><b>{i + 1}</b><span>{s}</span></div>)}</div>
        <div className="tile t2"><h3>{t("benefits")}</h3>
          {[t("b1"), t("b2"), t("b3"), t("b4"), t("b5"), t("b6")].map((s, i) => <div className="benefit" key={i}><i><Icon name="check" size={18} /></i>{s}</div>)}</div>
        <div className="tile t3"><h3>{t("how_o")}</h3>
          <div className="steps6">{[t("o1"), t("o2"), t("o3"), t("o4"), t("o5"), t("o6")].map((s, i) => <div className="step" key={i}><b>{i + 1}</b><span>{s}</span></div>)}</div></div>
      </section>

      <section className="cta"><h2>{t("hero_o")}</h2><p style={{ opacity: .85, margin: "0 0 26px", fontSize: "1.05rem" }}>{t("o6")}</p><Link className="btn hot lg" href="/owner/register">{t("register_cta")} <Icon name="right" size={18} /></Link></section>
    </main>
  );
}
