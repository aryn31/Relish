import { db } from "@/lib/db";
import { fee, checklist, type Restaurant } from "@/lib/restaurant";
import { activateRestaurant, deactivateRestaurant } from "@/app/actions/super";
import Flash from "@/components/Flash";
import Confirm from "@/components/Confirm";
import Link from "next/link";
export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const rs = await db.prepare("SELECT * FROM restaurants ORDER BY id DESC").all() as Restaurant[];
  const info = new Map<number, { cl: Awaited<ReturnType<typeof checklist>>; f: NonNullable<Awaited<ReturnType<typeof fee>>> }>();
  for (const r of rs) info.set(r.id, { cl: await checklist(r), f: (await fee(r.id))! });
  return (
    <div><Flash sp={sp} />
      <table className="t"><thead><tr><th>Restaurant</th><th>State</th><th>Setup</th><th></th></tr></thead><tbody>{rs.map((r) => {
        const { cl, f } = info.get(r.id)!;
        return (<tr key={r.id}><td><strong>{r.name}</strong><div className="muted">{r.type} · {r.address}</div></td>
          <td><span className={`badge ${r.state}`}>{r.state}</span>{r.inactive_reason && <div className="muted">{r.inactive_reason}</div>}</td>
          <td className="muted">{cl.steps.filter((s) => !s.ok).map((s) => s.key).join(", ") || "complete"}<div>fee: {f.state}</div></td>
          <td>{r.state === "active" ? <form action={deactivateRestaurant} className="row"><input type="hidden" name="id" value={r.id} /><input name="reason" placeholder="Reason" required aria-label="Reason" style={{ width: 160 }} /><Confirm className="danger" message="Deactivate? It will be hidden and stop taking orders. Unpaid orders stay outstanding until reactivation.">Deactivate</Confirm></form>
            : r.state === "inactive" ? <form action={activateRestaurant}><input type="hidden" name="id" value={r.id} /><button className="alt" disabled={!cl.ok}>Reactivate</button></form>
            : <Link href="/super">—</Link>}</td></tr>); })}</tbody></table>
    </div>
  );
}
