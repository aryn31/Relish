// Downloads real food photos from Wikimedia Commons (open licences) for menu items. `npm run photos`
import { db, pool } from "../src/db";
import { storeImage } from "../src/files";

const UA = "RelishDemo/1.0 (local demo app; food photo import)";
const Q: Record<string, string> = {
  "Classic Margherita Pizza": "margherita pizza", "Creamy Alfredo Pasta": "fettuccine alfredo", Cappuccino: "cappuccino coffee cup",
  "Gulab Jamun (2 pcs)": "gulab jamun", "Kulfi Falooda": "kulfi falooda", "Garlic Roti": "roti indian bread", "Butter Naan": "naan bread",
  "Veg Biryani": "vegetable biryani", "Aloo Tikki Burger": "aloo tikki burger", "Chicken Zinger": "fried chicken sandwich", "French Fries": "french fries",
  "Oreo Shake": "oreo milkshake", "Masala Chai": "masala chai", "Sweet Lassi": "lassi glass", "Cold Brew": "iced coffee glass", "Hot Chocolate": "hot chocolate mug",
  Tiramisu: "tiramisu dessert", "Club Sandwich": "club sandwich", "Hara Bhara Kebab": "hara bhara kabab", "Crispy Corn": "crispy corn snack", "Chicken 65": "chicken 65",
  "Gobi Manchurian": "gobi manchurian", "Butter Chicken": "butter chicken", "Mutton Rogan Josh": "rogan josh", "Chicken Biryani": "chicken biryani", "Palak Paneer": "palak paneer",
  "Dal Makhani": "dal makhani", "Paneer Butter Masala": "paneer butter masala", "Garlic Bread": "garlic bread", "Paneer Tikka": "paneer tikka",
};
const OK = /^(CC BY|CC BY-SA|CC0|Public domain|PD)/i;
const sniff = (b: Buffer) => (b[0] === 0xff && b[1] === 0xd8 ? "jpg" : b.subarray(1, 4).toString() === "PNG" ? "png" : b.subarray(0, 4).toString() === "RIFF" ? "webp" : null);
const strip = (h: string) => h.replace(/<[^>]*>/g, "").trim();

async function find(term: string) {
  const u = new URL("https://commons.wikimedia.org/w/api.php");
  u.search = new URLSearchParams({ action: "query", generator: "search", gsrsearch: `${term} filetype:bitmap`, gsrnamespace: "6", gsrlimit: "10", prop: "imageinfo", iiprop: "url|size|extmetadata", iiurlwidth: "640", format: "json" }).toString();
  const j: any = await (await fetch(u, { headers: { "user-agent": UA } })).json();
  const pages = Object.values(j.query?.pages ?? {}).sort((a: any, b: any) => a.index - b.index) as any[];
  for (const p of pages) {
    const ii = p.imageinfo?.[0]; if (!ii || ii.width < 500 || ii.height < 350) continue;
    const lic = ii.extmetadata?.LicenseShortName?.value ?? ""; if (!OK.test(lic)) continue;
    return { url: ii.thumburl as string, page: ii.descriptionurl as string, lic, author: strip(ii.extmetadata?.Artist?.value ?? "Unknown"), title: String(p.title).replace(/^File:/, "") };
  }
  return null;
}

async function main() {
  const names = ((await db.prepare("SELECT DISTINCT name FROM items WHERE deleted=0 ORDER BY name").all()) as { name: string }[]).map((r) => r.name);
  const prev = (await db.prepare("SELECT value FROM settings WHERE key='photo_credits'").get()) as { value: string } | undefined;
  const credits: Record<string, unknown>[] = prev ? JSON.parse(prev.value) : [];
  const done = new Set(credits.map((c) => c.item as string));
  for (const name of names) {
    if (done.has(name)) continue;
    try {
      let hit: Awaited<ReturnType<typeof find>> = null;
      for (let a = 0; a < 5; a++) { try { hit = await find(Q[name] ?? name); break; } catch { await new Promise((s) => setTimeout(s, 15000 * (a + 1))); } }
      if (!hit) { console.log(`✗ ${name}: no suitable photo`); continue; }
      let buf: Buffer | null = null;
      for (let a = 0; a < 4 && !buf; a++) { const r = await fetch(hit.url, { headers: { "user-agent": UA } }); if (r.ok) buf = Buffer.from(await r.arrayBuffer()); else await new Promise((s) => setTimeout(s, 2500 * (a + 1))); }
      const ext = buf && sniff(buf); if (!buf || !ext) { console.log(`✗ ${name}: download failed`); continue; }
      const file = await storeImage(buf, ext);
      await db.prepare("UPDATE items SET image=? WHERE name=? AND deleted=0").run(file, name);
      credits.push({ item: name, title: hit.title, author: hit.author, license: hit.lic, source: hit.page });
      console.log(`✓ ${name} ← ${hit.title} (${hit.lic})`);
    } catch (e) { console.log(`✗ ${name}: ${(e as Error).message}`); }
    await new Promise((s) => setTimeout(s, 6000));
    await db.prepare("INSERT INTO settings VALUES('photo_credits',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify(credits));
  }
  await db.prepare("INSERT INTO settings VALUES('photo_credits',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify(credits));
}
main().finally(() => pool.end());
