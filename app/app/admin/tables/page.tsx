import { requireRestAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { addTable, renameTable, toggleTable } from "@/app/actions/admin";
import Flash from "@/components/Flash";
export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams; const u = await requireRestAdmin();
  const tables = db.prepare("SELECT * FROM tables_ WHERE restaurant_id=? ORDER BY id").all(u.restaurant_id) as { id: number; name: string; active: number }[];
  return (
    <div style={{ maxWidth: 560 }}><Flash sp={sp} />
      <form action={addTable} className="row"><input className="grow" name="name" placeholder="Table name or number, e.g. 5" aria-label="Table name" required /><button>Add table</button></form>
      <table className="t" style={{ marginTop: 14 }}><tbody>
        {tables.map((t) => (
          <tr key={t.id}>
            <td><form action={renameTable} className="row"><input type="hidden" name="id" value={t.id} /><input className="grow" name="name" defaultValue={t.name} aria-label="Table name" /><button className="alt">Rename</button></form></td>
            <td><span className={`badge ${t.active ? "active" : "inactive"}`}>{t.active ? "Active" : "Inactive"}</span></td>
            <td><form action={toggleTable}><input type="hidden" name="id" value={t.id} /><button className="alt">{t.active ? "Deactivate" : "Activate"}</button></form></td>
          </tr>))}
        {tables.length === 0 && <tr><td className="muted">No tables yet. Add at least one.</td></tr>}
      </tbody></table>
    </div>
  );
}
