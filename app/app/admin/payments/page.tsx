import { requireRestAdmin } from "@/lib/auth";
import { db, inr, fmtDate } from "@/lib/db";
import { getRestaurant } from "@/lib/restaurant";
import { uploadUpi, confirmPayment } from "@/app/actions/admin";
import Flash from "@/components/Flash";
import Confirm from "@/components/Confirm";

export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams; const u = await requireRestAdmin(); const r = getRestaurant(u.restaurant_id)!;
  const owed = db.prepare("SELECT * FROM orders WHERE restaurant_id=? AND payment_status='pending' AND status!='cancelled' ORDER BY created_at").all(r.id) as any[];
  const outstanding = owed.reduce((s, o) => s + o.total_paise, 0);
  return (
    <div><Flash sp={sp} />
      <h2 style={{ marginTop: 0 }}>UPI QR code</h2>
      <p className="muted">Upload the image of your UPI QR code. Customers see it only after placing an order.</p>
      <form action={uploadUpi} className="row"><input type="file" name="upi" accept="image/jpeg,image/png,image/webp" required className="grow" /><button>{r.upi_qr ? "Replace" : "Upload"}</button></form>
      {r.upi_qr ? <p className="ok">✓ UPI QR code uploaded.</p> : <p className="bad">Not uploaded yet.</p>}
      {r.state !== "pending" && <>
        <h2>Outstanding balance: {inr(outstanding)}</h2>
        {r.state === "inactive" && <div className="msg">Restaurant is inactive: payments cannot be confirmed until it is reactivated.</div>}
        {owed.length === 0 ? <p className="muted">Nothing outstanding.</p> :
          <table className="t"><thead><tr><th>Order</th><th>Table</th><th>Amount</th><th>Method</th><th></th></tr></thead><tbody>
            {owed.map((o) => (
              <tr key={o.id}><td>#{o.number}<div className="muted">{fmtDate(o.created_at)}</div></td><td>{o.table_name}</td><td>{inr(o.total_paise)}</td>
                <td>{o.payment_method === "upi" ? "UPI" : "Cash"}{o.claimed_paid ? <div className="badge ok">Customer says paid</div> : null}<div className="muted">{o.status}</div></td>
                <td>{r.state === "active" && <form action={confirmPayment}><input type="hidden" name="id" value={o.id} /><input type="hidden" name="back" value="/admin/payments" /><Confirm message={`Confirm you received the full ${inr(o.total_paise)}?`}>Mark paid</Confirm></form>}</td></tr>))}
          </tbody></table>}
      </>}
    </div>
  );
}
