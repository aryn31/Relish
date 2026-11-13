import { getBySlug } from "@/lib/restaurant";
import MenuView from "@/components/MenuView";
import { tr, STR } from "@/lib/i18n";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const r = getBySlug(slug); const { t, lang } = await tr();
  // PUB-01/06: only Active shows a menu; everything else (incl. unknown slugs) gets the same "unavailable" page.
  if (!r || r.state !== "active") return <main><h1>{r?.state === "inactive" ? r.name : "Restaurant"}</h1><div className="msg">{t("unavailable_page")}</div></main>;
  return <MenuView r={r} labels={{ ...STR.en, ...(lang === "hi" ? (STR.hi as Record<string, string>) : {}) }} open />;
}
