import { load } from "@/lib/api";
import type { Restaurant } from "@/lib/types";
import { saveInfo } from "@/app/actions/admin";
import PageHead from "@/components/PageHead";
import Flash from "@/components/Flash";
import { tr } from "@/lib/i18n";
export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const { _ } = await tr(); const sp = await searchParams; const { restaurant: r } = await load<{ restaurant: Restaurant }>("/api/admin/info", "/admin/info");
  return (
    <div style={{ maxWidth: 640 }}><PageHead title="Restaurant information" sub="What customers see on your page." /><Flash sp={sp} />
      <form action={saveInfo} className="card">
        <label htmlFor="name">{_("Restaurant name")}</label><input id="name" name="name" defaultValue={r.name} required />
        <label htmlFor="description">{_("Short description")}</label><textarea id="description" name="description" defaultValue={r.description} rows={3} />
        <label htmlFor="type">{_("Type")}</label><input id="type" name="type" defaultValue={r.type} required />
        <label htmlFor="address">{_("Address")}</label><input id="address" name="address" defaultValue={r.address} required />
        <label htmlFor="phone">{_("Contact number")}</label><input id="phone" name="phone" defaultValue={r.phone} required />
        <label htmlFor="fssai">{_("FSSAI (optional)")}</label><input id="fssai" name="fssai" defaultValue={r.fssai ?? ""} />
        <label htmlFor="gstin">{_("GSTIN (optional)")}</label><input id="gstin" name="gstin" defaultValue={r.gstin ?? ""} />
        <p><button>{_("Save")}</button></p>
      </form>
      <p className="muted">{_("To change the owner or primary account email, ask the platform team.")}</p>
    </div>
  );
}
