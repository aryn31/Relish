import { requireRestAdmin } from "@/lib/auth";
import { getRestaurant } from "@/lib/restaurant";
import MenuView from "@/components/MenuView";
import { STR, tr, type K } from "@/lib/i18n";
export default async function Page() {
  const { t } = await tr(); const u = await requireRestAdmin();
  const labels = Object.fromEntries((Object.keys(STR.en) as K[]).map((k) => [k, t(k)])) as typeof STR.en;
  return <MenuView r={(await getRestaurant(u.restaurant_id))!} preview labels={labels} open={false} />;
}
