import QRCode from "qrcode";
import { load } from "@/lib/api";
import { baseUrl } from "@/lib/config";
import type { Restaurant } from "@/lib/types";
import { tr } from "@/lib/i18n";
import PrintButton from "./PrintButton";
// Print-ready page: use the browser's Print → "Save as PDF" for a PDF.
export default async function Page() {
  const { _ } = await tr(); const { restaurant: r } = await load<{ restaurant: Restaurant }>("/api/admin/info", "/admin/qr/print");
  const img = await QRCode.toDataURL(`${baseUrl()}/r/${r.slug}`, { width: 700, margin: 2 });
  return <div style={{ textAlign: "center", padding: 40 }}><h1>{r.name}</h1><p style={{ fontSize: 22 }}>{_("Scan to see our menu and order")}</p><img src={img} alt={_("Menu QR")} width={420} height={420} /><p><PrintButton /></p></div>;
}
