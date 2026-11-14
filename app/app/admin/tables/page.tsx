import { requireRestAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { addTable, renameTable, toggleTable } from "@/app/actions/admin";
import PageHead from "@/components/PageHead";
import Flash from "@/components/Flash";
export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams; const u = await requireRestAdmin();
  const tables = await db.prepare("SELECT * FROM tables_ WHERE restaurant_id=? ORDER BY id").all(u.restaurant_id) as { id: number; name: string; active: number }[];
  return (
    <div style={{ maxWidth: 560 }}><PageHead title="Tables" sub="Customers pick one of your active tables when ordering." /><Flash sp={sp} />
      <form action={addTable} className="row"><input className="grow" name="name" placeholder="Table name or number, e.g. 5" aria-label="Table name" required /><button>Add table</button></form>
      <div className="tgrid" style={{ marginTop: 14 }}>
        {tables.map((t) => (
          <div className="card stack" key={t.id}>
            <div className="row"><strong>Table {t.name}</strong><span className={`badge ${t.active ? "active" : "inactive"}`}>{t.active ? "Active" : "Inactive"}</span></div>
            <form action={renameTable} className="row"><input type="hidden" name="id" value={t.id} /><input className="grow" name="name" defaultValue={t.name} aria-label="Table name" /><button className="alt">Rename</button></form>
            <form action={toggleTable}><input type="hidden" name="id" value={t.id} /><button className="alt">{t.active ? "Deactivate" : "Activate"}</button></form>
          </div>))}
        {tables.length === 0 && <p className="muted">No tables yet. Add at least one.</p>}
      </div>
    </div>
  );
}
