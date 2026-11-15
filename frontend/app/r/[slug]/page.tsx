import { api } from "@/lib/api";
import type { Restaurant, MenuData } from "@/lib/types";
import MenuView from "@/components/MenuView";
import { tr, STR } from "@/lib/i18n";

type Pub = { restaurant: Restaurant; open: boolean; menu: MenuData | null; cover: string | null };
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const res = await api.get<Pub>(`/api/restaurants/${encodeURIComponent(slug)}`); const { t, _, lang } = await tr();
  if (!res.ok && res.status !== 404) throw new Error(res.data.error || `API error ${res.status}`);
  const r = res.ok ? res.data.restaurant : undefined;
  // PUB-01/06: only Active shows a menu; everything else (incl. unknown slugs) gets the same "unavailable" page.
  if (!r || r.state !== "active" || !res.data.menu) return <main><h1>{r?.state === "inactive" ? r.name : _("Restaurant")}</h1><div className="msg">{t("unavailable_page")}</div></main>;
  return <MenuView r={r} menu={res.data.menu} cover={res.data.cover} labels={{ ...STR.en, ...(lang === "hi" ? (STR.hi as Record<string, string>) : {}) }} open />;
}
