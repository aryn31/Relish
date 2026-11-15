import Link from "next/link";
import NavLink from "./NavLink";
import Logo from "./Logo";
import Icon, { type IconName } from "./Icon";
import LangSwitch from "./LangSwitch";
import { signOut } from "@/app/actions/auth";
import { tr } from "@/lib/i18n";
const ICONS: Record<string, IconName> = { Setup: "list", Home: "dash", Dashboard: "dash", Orders: "receipt", Menu: "utensils", Tables: "table", Payments: "wallet", "UPI QR": "qr", "QR code": "qr", "Restaurant info": "store", Account: "settings", Preview: "search", Overview: "dash", Applications: "file", Restaurants: "store", "Admin accounts": "users", "Order lookup": "search", "Sent emails": "mail" };
/** Dark-green floating sidebar layout for dashboards. Hides the public header/footer. */
export default async function Shell({ subtitle, links, children }: { subtitle: string; links: [string, string][]; children: React.ReactNode }) {
  const { _, lang } = await tr();
  return (
    <div className="shell"><style>{"header.top,footer{display:none}body{background-image:none}"}</style>
      <aside className="side">
        <Link href="/" className="logo"><Logo />Relish</Link><small>{_(subtitle)}</small>
        {links.map(([h, l]) => <NavLink key={h} href={h}><Icon name={ICONS[l] ?? "dash"} size={18} />{_(l)}</NavLink>)}
        <div style={{ marginTop: "auto" }}><LangSwitch lang={lang} dark /></div>
        <form action={signOut} style={{ marginTop: 0 }}><button>{_("Sign out")}</button></form>
      </aside>
      <div className="content">{children}</div>
    </div>
  );
}
