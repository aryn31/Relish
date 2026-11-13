import Shell from "@/components/Shell";
import { requireSuper } from "@/lib/auth";
export default async function L({ children }: { children: React.ReactNode }) {
  await requireSuper();
  return <Shell subtitle="Super Admin" links={[["/super", "Dashboard"], ["/super/restaurants", "Restaurants"], ["/super/admins", "Admin accounts"], ["/super/orders", "Order lookup"], ["/super/emails", "Sent emails"]]}>{children}</Shell>;
}
