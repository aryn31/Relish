import { db } from "@/lib/db";
import { createAdmin, toggleAdmin, recoverAdmin } from "@/app/actions/super";
import Flash from "@/components/Flash";
import Confirm from "@/components/Confirm";
export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const rs = db.prepare("SELECT id,name FROM restaurants ORDER BY name").all() as { id: number; name: string }[];
  const as = db.prepare("SELECT u.*, r.name rname FROM users u JOIN restaurants r ON r.id=u.restaurant_id WHERE u.role='restaurant_admin' ORDER BY r.name,u.id").all() as any[];
  return (
    <div><Flash sp={sp} />
      <h2 style={{ marginTop: 0 }}>Add an admin to a restaurant</h2>
      <form action={createAdmin} className="row"><select name="restaurant_id" aria-label="Restaurant" style={{ width: "auto" }}>{rs.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
        <input name="name" placeholder="Name" required aria-label="Name" /><input name="email" type="email" placeholder="Email" required aria-label="Email" /><button>Create</button></form>
      <h2>Admin accounts</h2>
      <table className="t"><tbody>{as.map((a) => (<tr key={a.id}><td><strong>{a.name}</strong><div className="muted">{a.email} · {a.rname}</div></td><td><span className="badge">{a.disabled ? "Disabled" : "Active"}</span></td>
        <td className="row"><form action={toggleAdmin}><input type="hidden" name="id" value={a.id} /><Confirm className="alt" message="Change this account's access?">{a.disabled ? "Enable" : "Disable"}</Confirm></form>
          <form action={recoverAdmin}><input type="hidden" name="id" value={a.id} /><button className="alt">Send recovery link</button></form></td></tr>))}</tbody></table>
    </div>
  );
}
