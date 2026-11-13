import Link from "next/link";
import { db } from "@/lib/db";
import { tr } from "@/lib/i18n";
import type { Restaurant } from "@/lib/restaurant";

const PAGE = 12;
export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; p?: string }> }) {
  const { q = "", type = "", p = "1" } = await searchParams; const { t } = await tr();
  const page = Math.max(1, Number(p) || 1);
  const where = ["state='active'"]; const args: (string | number)[] = [];
  if (q) { where.push("name LIKE ?"); args.push(`%${q}%`); }
  if (type) { where.push("type=?"); args.push(type); }
  const list = db.prepare(`SELECT * FROM restaurants WHERE ${where.join(" AND ")} ORDER BY name LIMIT ? OFFSET ?`).all(...args, PAGE + 1, (page - 1) * PAGE) as Restaurant[];
  const types = (db.prepare("SELECT DISTINCT type FROM restaurants WHERE state='active' ORDER BY type").all() as { type: string }[]).map((x) => x.type);
  const qs = (n: number) => `/?${new URLSearchParams({ ...(q && { q }), ...(type && { type }), p: String(n) })}#restaurants`;
  return (
    <main>
      <section className="hero">
        <h1>{t("hero_c")}</h1>
        <p>{t("hero_o")}</p>
        <form className="search" action="/#restaurants"><input name="q" defaultValue={q} placeholder={t("search")} aria-label={t("search")} /><button>{t("go")}</button></form>
        <div className="feats"><div><span>🍽</span>Dine in</div><div><span>▣</span>Scan QR</div><div><span>🛒</span>Order online</div><div><span>✓</span>Easy &amp; simple</div></div>
      </section>

      <section id="restaurants">
        <h2>{t("find")}</h2>
        <form className="row" action="/">
          <input className="grow" name="q" defaultValue={q} placeholder={t("search")} aria-label={t("search")} />
          <select name="type" defaultValue={type} style={{ width: "auto" }} aria-label="Type"><option value="">{t("all_types")}</option>{types.map((x) => <option key={x}>{x}</option>)}</select>
          <button>{t("go")}</button>
        </form>
        {list.length === 0 ? <p className="muted">{t("none_found")}</p> :
          <div className="grid" style={{ marginTop: 14 }}>
            {list.slice(0, PAGE).map((r) => (
              <div className="card" key={r.id}>
                <h3 style={{ marginTop: 0 }}>{r.name}</h3>
                <div className="muted">{r.type} · {r.address}</div>
                {r.description && <p>{r.description.slice(0, 120)}</p>}
                <Link className="btn" href={`/r/${r.slug}`}>{t("view_menu")}</Link>
              </div>))}
          </div>}
        <p className="row">{page > 1 && <Link href={qs(page - 1)}>← {t("prev")}</Link>}{list.length > PAGE && <Link href={qs(page + 1)}>{t("next")} →</Link>}</p>
      </section>

      <section className="grid" style={{ marginTop: 40 }}>
        <div><h2>{t("how_c")}</h2><ol><li>{t("how_c1")}</li><li>{t("how_c2")}</li><li>{t("how_c3")}</li></ol></div>
        <div><h2>{t("benefits")}</h2><ul><li>{t("b1")}</li><li>{t("b2")}</li><li>{t("b3")}</li><li>{t("b4")}</li><li>{t("b5")}</li><li>{t("b6")}</li></ul></div>
        <div><h2>{t("how_o")}</h2><ol><li>{t("o1")}</li><li>{t("o2")}</li><li>{t("o3")}</li><li>{t("o4")}</li><li>{t("o5")}</li><li>{t("o6")}</li></ol></div>
      </section>
      <p style={{ textAlign: "center", marginTop: 32 }}><Link className="btn" href="/owner/register">{t("register_cta")}</Link></p>
    </main>
  );
}
