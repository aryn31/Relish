import { load } from "@/lib/api";
import { tr } from "@/lib/i18n";
type Credit = { item: string; title: string; author: string; license: string; source: string };
export default async function Page() {
  const { _ } = await tr();
  const list = (await load<{ credits: Credit[] }>("/api/public/credits", "/credits")).credits ?? [];
  return (
    <main><h1>{_("Photo credits")}</h1><p className="muted">{_("Demo menu photos are from Wikimedia Commons under open licences.")}</p>
      {list.length === 0 ? <p>{_("No credits.")}</p> : <ul>{list.map((c) => <li key={c.item}><strong>{c.item}</strong>: <a href={c.source}>{c.title}</a> {_("by")} {c.author} — {c.license}</li>)}</ul>}
    </main>
  );
}
