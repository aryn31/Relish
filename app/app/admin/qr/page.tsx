import QRCode from "qrcode";
import { requireRestAdmin } from "@/lib/auth";
import { getRestaurant } from "@/lib/restaurant";
import { baseUrl } from "@/lib/mail";
export default async function Page() {
  const u = await requireRestAdmin(); const r = getRestaurant(u.restaurant_id)!;
  const url = `${baseUrl()}/r/${r.slug}`; const svg = await QRCode.toDataURL(url, { width: 360, margin: 2 });
  return (
    <div className="stack" style={{ maxWidth: 420 }}>
      <p>This QR code opens your menu. Put it on tables, the counter or the door.</p>
      <img src={svg} alt={`QR code for ${r.name}`} width={260} height={260} />
      <p className="muted">{url}</p>
      <p className="row"><a className="btn" href={`/api/qr/${r.slug}`}>Download PNG</a><a className="btn alt" href="/admin/qr/print" target="_blank">Print page</a></p>
    </div>
  );
}
