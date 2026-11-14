import "./globals.css";
import { Plus_Jakarta_Sans, Fraunces } from "next/font/google";
import Link from "next/link";
import type { Metadata } from "next";
import { getUser } from "@/lib/auth";
import { tr } from "@/lib/i18n";
import Logo from "@/components/Logo";
import Icon from "@/components/Icon";
import LangSwitch from "@/components/LangSwitch";
import { signOut } from "./actions/auth";

const sans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font", display: "swap" });
const serif = Fraunces({ subsets: ["latin"], variable: "--display", display: "swap", axes: ["opsz"] });
export const metadata: Metadata = { title: "Relish", description: "Discover restaurants, browse menus and order." };
export const dynamic = "force-dynamic";

export default async function Root({ children }: { children: React.ReactNode }) {
  const u = await getUser(); const { t, lang } = await tr();
  const home = u?.role === "super_admin" ? "/super" : u?.role === "restaurant_admin" ? "/admin" : null;
  return (
    <html lang={lang}><head><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
      <body className={`${sans.variable} ${serif.variable}`}>
        <header className="top"><div className="in">
          <Link href="/" className="logo"><Logo />{t("site")}</Link>
          <nav>
            <Link href="/#restaurants"><Icon name="search" size={16} />{t("find")}</Link>
            {u?.role === "customer" && <Link href="/orders"><Icon name="receipt" size={16} />{t("my_orders")}</Link>}
            {home && <Link href={home}><Icon name="dash" size={16} />Dashboard</Link>}
            <LangSwitch lang={lang} />
            {u ? <form action={signOut}><button className="link">{t("signout")} ({u.name.split(" ")[0]})</button></form>
              : <Link href="/login">{t("signin")}</Link>}
            {(!u || u.role === "customer") && <Link className="btn hot" href="/owner/register">{t("register_cta")}</Link>}
          </nav>
        </div></header>
        {children}
        <footer><Link href="/terms">{t("terms")}</Link> · <Link href="/privacy">{t("privacy")}</Link> · <Link href="/credits">Photo credits</Link></footer>
      </body></html>
  );
}
