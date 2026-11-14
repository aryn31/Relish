import { requireRestAdmin } from "@/lib/auth";
import { getRestaurant } from "@/lib/restaurant";
import { saveInfo } from "@/app/actions/admin";
import PageHead from "@/components/PageHead";
import Flash from "@/components/Flash";
export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams; const u = await requireRestAdmin(); const r = (await getRestaurant(u.restaurant_id))!;
  return (
    <div style={{ maxWidth: 520 }}><PageHead title="Restaurant information" sub="What customers see on your page." /><Flash sp={sp} />
      <form action={saveInfo}>
        <label htmlFor="name">Restaurant name</label><input id="name" name="name" defaultValue={r.name} required />
        <label htmlFor="description">Short description</label><textarea id="description" name="description" defaultValue={r.description} rows={3} />
        <label htmlFor="type">Type</label><input id="type" name="type" defaultValue={r.type} required />
        <label htmlFor="address">Address</label><input id="address" name="address" defaultValue={r.address} required />
        <label htmlFor="phone">Contact number</label><input id="phone" name="phone" defaultValue={r.phone} required />
        <label htmlFor="fssai">FSSAI (optional)</label><input id="fssai" name="fssai" defaultValue={r.fssai ?? ""} />
        <label htmlFor="gstin">GSTIN (optional)</label><input id="gstin" name="gstin" defaultValue={r.gstin ?? ""} />
        <p><button>Save</button></p>
      </form>
      <p className="muted">To change the owner or primary account email, ask the platform team.</p>
    </div>
  );
}
