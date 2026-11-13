import { requireRestAdmin } from "@/lib/auth";
import { getRestaurant } from "@/lib/restaurant";
import MenuView from "@/components/MenuView";
import { STR } from "@/lib/i18n";
export default async function Page() {
  const u = await requireRestAdmin();
  return <MenuView r={getRestaurant(u.restaurant_id)!} preview labels={STR.en} open={false} />;
}
