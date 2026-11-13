import QRCode from "qrcode";
import { requireRestAdmin } from "@/lib/auth";
import { getRestaurant } from "@/lib/restaurant";
import { baseUrl } from "@/lib/mail";
import PrintButton from "./PrintButton";
// Print-ready page: use the browser's Print → "Save as PDF" for a PDF.
export default async function Page() {
  const u = await requireRestAdmin(); const r = getRestaurant(u.restaurant_id)!;
  const img = await QRCode.toDataURL(`${baseUrl()}/r/${r.slug}`, { width: 700, margin: 2 });
  return <div style={{ textAlign: "center", padding: 40 }}><h1>{r.name}</h1><p style={{ fontSize: 22 }}>Scan to see our menu and order</p><img src={img} alt="Menu QR" width={420} height={420} /><p><PrintButton /></p></div>;
}
