import { load } from "@/lib/api";
import { createAdmin, toggleAdmin, recoverAdmin } from "@/app/actions/super";
import PageHead from "@/components/PageHead";
import Flash from "@/components/Flash";
import Confirm from "@/components/Confirm";
import { tr } from "@/lib/i18n";
export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams; const { _ } = await tr();
  const { restaurants: rs, admins: as } = await load<{ restaurants: { id: number; name: string }[]; admins: { id: number; name: string; email: string; disabled: number; restaurant_id: number; rname: string }[] }>("/api/super/admins", "/super/admins");
  return (
    <div><PageHead title="Admin accounts" sub="Create, disable or recover restaurant admins." /><Flash sp={sp} />
      <h2 style={{ marginTop: 0, fontSize: "1.2rem" }}>{_("Add an admin to a restaurant")}</h2>
      <form action={createAdmin} className="row card"><select name="restaurant_id" aria-label={_("Restaurant")} style={{ width: "auto" }}>{rs.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
        <input name="name" placeholder={_("Name")} required aria-label={_("Name")} /><input name="email" type="email" placeholder={_("Email")} required aria-label={_("Email")} /><button>{_("Create")}</button></form>
      <h2>{_("Admin accounts")}</h2>
      <table className="t"><tbody>{as.map((a) => (<tr key={a.id}><td><strong>{a.name}</strong><div className="muted">{a.email} · {a.rname}</div></td><td><span className="badge">{a.disabled ? _("Disabled") : _("Active")}</span></td>
        <td className="row"><form action={toggleAdmin}><input type="hidden" name="id" value={a.id} /><Confirm className="alt" message={_("Change this account's access?")}>{a.disabled ? _("Enable") : _("Disable")}</Confirm></form>
          <form action={recoverAdmin}><input type="hidden" name="id" value={a.id} /><button className="alt">{_("Send recovery link")}</button></form></td></tr>))}</tbody></table>
    </div>
  );
}
