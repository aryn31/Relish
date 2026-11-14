import Shell from "@/components/Shell";
import { tr } from "@/lib/i18n";
import { load } from "@/lib/api";
import type { Restaurant, Application } from "@/lib/types";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { _ } = await tr(); const { restaurant: r, application: app } = await load<{ restaurant: Restaurant; application: Application | null }>("/api/admin/info", "/admin");
  const approved = app?.state === "approved";
  const tabs = r.state === "pending"
    ? [["/admin", "Setup"], ...(approved ? [["/admin/menu", "Menu"], ["/admin/tables", "Tables"], ["/admin/payments", "UPI QR"], ["/admin/info", "Restaurant info"]] : [["/admin/info", "Restaurant info"]]), ["/admin/preview", "Preview"]]
    : [["/admin", "Home"], ["/admin/orders", "Orders"], ["/admin/menu", "Menu"], ["/admin/tables", "Tables"], ["/admin/payments", "Payments"], ["/admin/info", "Restaurant info"], ["/admin/qr", "QR code"], ["/admin/settings", "Account"]];
  return (
    <Shell subtitle={r.name + (r.state === "active" ? "" : r.state === "inactive" ? ` · ${_("Inactive")}` : ` · ${_("Setting up")}`)} links={tabs as [string, string][]}>{children}</Shell>
  );
}
