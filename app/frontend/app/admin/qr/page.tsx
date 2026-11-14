import QRCode from "qrcode";
import { load } from "@/lib/api";
import { baseUrl } from "@/lib/config";
import type { Restaurant } from "@/lib/types";
import PageHead from "@/components/PageHead";
import { tr } from "@/lib/i18n";
import { Download, Printer } from "lucide-react";
export default async function Page() {
  const { _ } = await tr(); const { restaurant: r } = await load<{ restaurant: Restaurant }>("/api/admin/info", "/admin/qr");
  const url = `${baseUrl()}/r/${r.slug}`; const img = await QRCode.toDataURL(url, { width: 480, margin: 2, color: { dark: "#0b3d2e" } });
  return (
    <div><PageHead title="Menu QR code" sub="Put it on tables, the counter or the door. It always opens your live menu." />
      <div className="card qrcard" style={{ maxWidth: 720 }}>
        <div className="qrbox"><img src={img} alt={_("QR code for {name}", { name: r.name })} width={240} height={240} /></div>
        <div className="stack"><h3 style={{ margin: 0 }}>{r.name}</h3><p className="muted" style={{ margin: 0, wordBreak: "break-all" }}>{url}</p>
          <div className="row"><a className="btn" href={`/api/qr/${r.slug}`}><Download size={16} /> {_("Download PNG")}</a><a className="btn alt" href="/admin/qr/print" target="_blank"><Printer size={16} /> {_("Print page")}</a></div></div></div>
    </div>
  );
}
