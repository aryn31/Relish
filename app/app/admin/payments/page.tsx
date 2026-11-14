import { requireRestAdmin } from "@/lib/auth";
import { db, inr } from "@/lib/db";
import { getRestaurant } from "@/lib/restaurant";
import { uploadUpi, confirmPayment } from "@/app/actions/admin";
import PageHead from "@/components/PageHead";
import { Wallet } from "lucide-react";
import Flash from "@/components/Flash";
import Confirm from "@/components/Confirm";
import { tr } from "@/lib/i18n";

export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const { _, fd } = await tr(); const sp = await searchParams; const u = await requireRestAdmin(); const r = (await getRestaurant(u.restaurant_id))!;
  const owed = await db.prepare("SELECT * FROM orders WHERE restaurant_id=? AND payment_status='pending' AND status!='cancelled' ORDER BY created_at").all(r.id) as any[];
  const outstanding = owed.reduce((s, o) => s + o.total_paise, 0);
  return (
    <div><PageHead title="Payments & UPI" sub="Confirm payments and see what is still owed." /><Flash sp={sp} />
      <div className="card qrcard">
        {r.upi_qr ? <img src="/api/upi/mine" alt={_("Your UPI QR")} width={150} height={150} style={{ borderRadius: 16, border: "1px solid var(--line)" }} /> : <div className="thumb" style={{ width: 150, height: 150, display: "grid", placeItems: "center" }}>{_("No QR")}</div>}
        <div><h3 style={{ marginTop: 0 }}>{_("UPI QR code")}</h3>
          <p className="muted" style={{ marginTop: 0 }}>{_("Customers see it only after placing an order.")} {r.upi_qr ? <span className="ok">✓ {_("Uploaded")}</span> : <span className="bad">{_("Not uploaded yet")}</span>}</p>
          <form action={uploadUpi} className="row"><input type="file" name="upi" accept="image/jpeg,image/png,image/webp" required className="grow" /><button>{r.upi_qr ? _("Replace") : _("Upload")}</button></form></div></div>
      {r.state !== "pending" && <>
        <div className="card stat" style={{ margin: "20px 0 14px" }}><span className="ic violet"><Wallet size={22} /></span><div><div className="muted">{_("Outstanding balance")}</div><h1>{inr(outstanding)}</h1></div></div>
        {r.state === "inactive" && <div className="msg">{_("Restaurant is inactive: payments cannot be confirmed until it is reactivated.")}</div>}
        {owed.length === 0 ? <p className="muted">{_("Nothing outstanding.")}</p> :
          <table className="t"><thead><tr><th>{_("Order")}</th><th>{_("Table")}</th><th>{_("Amount")}</th><th>{_("Method")}</th><th></th></tr></thead><tbody>
            {owed.map((o) => (
              <tr key={o.id}><td>#{o.number}<div className="muted">{fd(o.created_at)}</div></td><td>{o.table_name}</td><td>{inr(o.total_paise)}</td>
                <td><div className="row" style={{ gap: 6 }}><span className="badge">{o.payment_method === "upi" ? "UPI" : _("Cash")}</span><span className={`badge ${o.status}`}>{_(o.status)}</span>{o.claimed_paid ? <span className="badge ok">{_("Customer says paid")}</span> : null}</div></td>
                <td>{r.state === "active" && <form action={confirmPayment}><input type="hidden" name="id" value={o.id} /><input type="hidden" name="back" value="/admin/payments" /><Confirm message={_("Confirm you received the full {amt}?", { amt: inr(o.total_paise) })}>{_("Mark paid")}</Confirm></form>}</td></tr>))}
          </tbody></table>}
      </>}
    </div>
  );
}
