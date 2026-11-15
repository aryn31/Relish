import { load } from "@/lib/api";
import type { Restaurant, MenuData } from "@/lib/types";
import MenuView from "@/components/MenuView";
import { STR, tr, type K } from "@/lib/i18n";
export default async function Page() {
  const { t } = await tr();
  const d = await load<{ restaurant: Restaurant; menu: MenuData; cover: string | null }>("/api/admin/preview", "/admin/preview");
  const labels = Object.fromEntries((Object.keys(STR.en) as K[]).map((k) => [k, t(k)])) as typeof STR.en;
  return <MenuView r={d.restaurant} menu={d.menu} cover={d.cover} preview labels={labels} open={false} />;
}
