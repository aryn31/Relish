import Link from "next/link";
import { db, inr, fmtDate } from "@/lib/db";
import { fee, getRestaurant } from "@/lib/restaurant";
import { assignFee, confirmFee, decideApplication } from "@/app/actions/super";
import MenuView from "@/components/MenuView";
import { STR } from "@/lib/i18n";
import Flash from "@/components/Flash";
import Confirm from "@/components/Confirm";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string; preview?: string }> }) {
  const { id } = await params; const sp = await searchParams;
  const a = await db.prepare("SELECT * FROM applications WHERE id=?").get(Number(id)) as { id: number; restaurant_id: number; state: string; reason: string | null; updated_at: string } | undefined;
  if (!a) return <p>Not found.</p>;
  const r = (await getRestaurant(a.restaurant_id))!, f = (await fee(r.id))!;
  const dups = await db.prepare("SELECT id,name,state FROM restaurants WHERE id!=? AND (phone_norm=? OR (lower(name)=lower(?) AND lower(address)=lower(?)))").all(r.id, (r as any).phone_norm ?? "", r.name, r.address) as any[];
  const hidden = <input type="hidden" name="app_id" value={a.id} />;
  const owner = await db.prepare("SELECT name,email,email_verified FROM users WHERE restaurant_id=? AND role='restaurant_admin' ORDER BY id LIMIT 1").get(r.id) as { name: string; email: string; email_verified: number };
  return (
    <div className="stack" style={{ maxWidth: 720 }}><Flash sp={sp} />
      <h1 style={{ marginBottom: 0 }}>{r.name}</h1><div className="muted">Application #{a.id} · {a.state} · {fmtDate(a.updated_at)}</div>
      {dups.length > 0 && <div className="msg err"><strong>Possible duplicate:</strong> {dups.map((d) => `${d.name} (${d.state})`).join(", ")} matches by contact number or name + address. This is only a warning.</div>}
      <div className="card"><div><span className="muted">Type:</span> {r.type}</div><div><span className="muted">Address:</span> {r.address}</div><div><span className="muted">Contact:</span> {r.phone}</div>
        <div><span className="muted">Owner:</span> {owner.name} · {owner.email} {owner.email_verified ? "(verified)" : "(NOT verified)"}</div>
        {(r.fssai || r.gstin) && <div><span className="muted">FSSAI/GSTIN:</span> {r.fssai} {r.gstin}</div>}
        {r.description && <div><span className="muted">About:</span> {r.description}</div>}
        <p><Link href={`/super/apps/${a.id}?preview=1`}>View private preview</Link></p></div>

      <div className="card"><h3 style={{ marginTop: 0 }}>Setup fee — {f.state === "not_assigned" ? "not assigned" : f.state === "awaiting" ? "awaiting payment" : "confirmed"}</h3>
        {f.state !== "confirmed" ? <form action={assignFee} className="row">{hidden}<input name="amount" type="number" step="0.01" min="1" placeholder="Amount ₹" defaultValue={f.amount_paise ? (f.amount_paise / 100).toFixed(2) : ""} aria-label="Fee amount" style={{ width: 140 }} /><button className="alt">{f.state === "awaiting" ? "Change fee" : "Assign fee"}</button></form>
          : <p>{inr(f.amount_paise!)} (locked){f.prev_amount_paise ? ` · previous ${inr(f.prev_amount_paise)}` : ""}</p>}
        {f.state === "awaiting" && <form action={confirmFee} style={{ marginTop: 8 }}>{hidden}<Confirm message="Confirm you have received this fee in your own records?">Mark fee received</Confirm></form>}</div>

      {a.state === "submitted" && <div className="card"><h3 style={{ marginTop: 0 }}>Decision</h3>
        <form action={decideApplication} className="stack">{hidden}<label htmlFor="reason">Reason (required to reject or return)</label><textarea id="reason" name="reason" rows={2} />
          <div className="row"><button name="decision" value="approve">Approve</button><button className="alt" name="decision" value="return">Return for corrections</button><button className="danger" name="decision" value="reject">Reject</button></div></form></div>}
      {sp.preview && <><hr /><MenuView r={r} preview labels={STR.en} open={false} /></>}
    </div>
  );
}
