import { db } from "@/lib/db";
export default async function Page() {
  const r = (await db.prepare("SELECT value FROM settings WHERE key='photo_credits'").get()) as { value: string } | undefined;
  const list = (r ? JSON.parse(r.value) : []) as { item: string; title: string; author: string; license: string; source: string }[];
  return (
    <main><h1>Photo credits</h1><p className="muted">Demo menu photos are from Wikimedia Commons under open licences.</p>
      {list.length === 0 ? <p>No credits.</p> : <ul>{list.map((c) => <li key={c.item}><strong>{c.item}</strong>: <a href={c.source}>{c.title}</a> by {c.author} — {c.license}</li>)}</ul>}
    </main>
  );
}
