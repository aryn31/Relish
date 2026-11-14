import Link from "next/link";
import NavLink from "./NavLink";
import Logo from "./Logo";
import Icon, { type IconName } from "./Icon";
import { signOut } from "@/app/actions/auth";
const ICONS: Record<string, IconName> = { Setup: "list", Home: "dash", Dashboard: "dash", Orders: "receipt", Menu: "utensils", Tables: "table", Payments: "wallet", "UPI QR": "qr", "QR code": "qr", "Restaurant info": "store", Account: "settings", Preview: "search", Overview: "dash", Applications: "file", Restaurants: "store", "Admin accounts": "users", "Order lookup": "search", "Sent emails": "mail" };
/** Dark-green floating sidebar layout for dashboards. Hides the public header/footer. */
export default function Shell({ subtitle, links, children }: { subtitle: string; links: [string, string][]; children: React.ReactNode }) {
  return (
    <div className="shell"><style>{"header.top,footer{display:none}body{background-image:none}"}</style>
      <aside className="side">
        <Link href="/" className="logo"><Logo />Relish</Link><small>{subtitle}</small>
        {links.map(([h, l]) => <NavLink key={h} href={h}><Icon name={ICONS[l] ?? "dash"} size={18} />{l}</NavLink>)}
        <form action={signOut} className="out"><button>Sign out</button></form>
      </aside>
      <div className="content">{children}</div>
    </div>
  );
}
