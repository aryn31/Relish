import { requireRestAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { addTable, renameTable, toggleTable } from "@/app/actions/admin";
import PageHead from "@/components/PageHead";
import Flash from "@/components/Flash";
import { tr } from "@/lib/i18n";
export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const { _ } = await tr(); const sp = await searchParams; const u = await requireRestAdmin();
  const tables = await db.prepare("SELECT * FROM tables_ WHERE restaurant_id=? ORDER BY id").all(u.restaurant_id) as { id: number; name: string; active: number }[];
  return (
    <div><PageHead title="Tables" sub="Customers pick one of your active tables when ordering." /><Flash sp={sp} />
      <form action={addTable} className="row card" style={{ maxWidth: 560 }}><input className="grow" name="name" placeholder={_("Table name or number, e.g. 5")} aria-label={_("Table name")} required /><button>{_("Add table")}</button></form>
      <div className="tgrid" style={{ marginTop: 14 }}>
        {tables.map((t) => (
          <div className="card stack" key={t.id}>
            <div className="row"><strong>{_("Table {name}", { name: t.name })}</strong><span className={`badge ${t.active ? "active" : "inactive"}`}>{t.active ? _("Active") : _("Inactive")}</span></div>
            <form action={renameTable} className="row"><input type="hidden" name="id" value={t.id} /><input className="grow" name="name" defaultValue={t.name} aria-label={_("Table name")} /><button className="alt">{_("Rename")}</button></form>
            <form action={toggleTable}><input type="hidden" name="id" value={t.id} /><button className="alt">{t.active ? _("Deactivate") : _("Activate")}</button></form>
          </div>))}
        {tables.length === 0 && <p className="muted">{_("No tables yet. Add at least one.")}</p>}
      </div>
    </div>
  );
}
