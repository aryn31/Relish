import Link from "next/link";
import Logo from "./Logo";
import { signOut } from "@/app/actions/auth";
/** Dark-green sidebar layout for dashboards. Hides the public header/footer. */
export default function Shell({ subtitle, links, children }: { subtitle: string; links: [string, string][]; children: React.ReactNode }) {
  return (
    <div className="shell"><style>{"header.top,footer{display:none}"}</style>
      <aside className="side">
        <Link href="/" className="logo"><Logo />Relish</Link><small>{subtitle}</small>
        {links.map(([h, l]) => <Link key={h} href={h}>{l}</Link>)}
        <form action={signOut} className="out"><button>Sign out</button></form>
      </aside>
      <div className="content">{children}</div>
    </div>
  );
}
