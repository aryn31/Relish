import { db } from "@/lib/db";
import { tr } from "@/lib/i18n";
export default async function Page() {
  const { _ } = await tr();
  const r = (await db.prepare("SELECT value FROM settings WHERE key='photo_credits'").get()) as { value: string } | undefined;
  const list = (r ? JSON.parse(r.value) : []) as { item: string; title: string; author: string; license: string; source: string }[];
  return (
    <main><h1>{_("Photo credits")}</h1><p className="muted">{_("Demo menu photos are from Wikimedia Commons under open licences.")}</p>
      {list.length === 0 ? <p>{_("No credits.")}</p> : <ul>{list.map((c) => <li key={c.item}><strong>{c.item}</strong>: <a href={c.source}>{c.title}</a> {_("by")} {c.author} — {c.license}</li>)}</ul>}
    </main>
  );
}
