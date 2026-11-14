import type { Restaurant, MenuData } from "@/lib/types";
import MenuClient from "./MenuClient";
import Icon from "./Icon";
import { tr } from "@/lib/i18n";

export type { MenuData };

/** Restaurant page body: header + menu. Data comes from the backend (public menu, admin preview or super-admin preview). */
export default async function MenuView({ r, menu, cover, preview, labels, open }: { r: Pick<Restaurant, "id" | "slug" | "name" | "type" | "address" | "phone" | "description">; menu: MenuData; cover: string | null; preview?: boolean; labels: Record<string, string>; open: boolean }) {
  const { _ } = await tr();
  return (
    <main>
      <div className="mhero">{cover && <img src={`/api/img/${cover}`} alt="" />}
        <div className="in"><span className="badge">{_(r.type)}</span><h1>{r.name}</h1>
          <div className="meta"><span><Icon name="pin" size={15} />{r.address}</span><span><Icon name="phone" size={15} />{r.phone}</span></div>
          {r.description && <p style={{ margin: "10px 0 0", maxWidth: 620, opacity: .9 }}>{r.description}</p>}</div></div>
      {preview && <div className="msg">{_("PREVIEW — this is how your page will look. It is private and cannot take orders.")}</div>}
      {!open && !preview && <div className="msg err">{labels.closed_cart}</div>}
      <MenuClient restaurantId={r.id} slug={r.slug} name={r.name} menu={menu} labels={labels} disabled={preview || !open} />
    </main>
  );
}
