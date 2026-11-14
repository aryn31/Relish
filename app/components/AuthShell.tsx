import { db } from "@/lib/db";
import { tr } from "@/lib/i18n";
/** Split-screen layout for sign-in / register pages. */
export default async function AuthShell({ title, blurb, children }: { title: string; blurb?: string; children: React.ReactNode }) {
  const { _ } = await tr();
  const pic = ((await db.prepare("SELECT image FROM items WHERE image IS NOT NULL AND deleted=0 ORDER BY id DESC LIMIT 1").get()) as { image: string } | undefined)?.image;
  return (
    <div className="auth">
      <aside className="pic">{pic && <img src={`/api/img/${pic}`} alt="" />}<div><span className="eyebrow" style={{ color: "#ffd68a" }}>Relish</span><h2>{_("Good food,")}<br />{_("zero waiting.")}</h2><p style={{ opacity: .85, maxWidth: 360 }}>{blurb ?? _("Scan, order and pay from your table. Restaurants manage everything in one place.")}</p></div></aside>
      <section className="form"><h1>{title}</h1>{children}</section>
    </div>
  );
}
