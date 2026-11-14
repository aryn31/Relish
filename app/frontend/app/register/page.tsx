import Link from "next/link";
import { registerCustomer } from "../actions/auth";
import AuthShell from "@/components/AuthShell";
import Flash from "@/components/Flash";
import { tr } from "@/lib/i18n";
export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string; ok?: string; err?: string }> }) {
  const sp = await searchParams; const { t, _ } = await tr(); const next = sp.next || "/";
  return (
    <AuthShell title={t("create_account")}><Flash sp={sp} />
      {process.env.GOOGLE_CLIENT_ID && <><a className="btn" style={{ display: "block", textAlign: "center" }} href={`/api/google?next=${encodeURIComponent(next)}`}>{t("google")}</a><p className="muted" style={{ textAlign: "center" }}>{t("or")}</p></>}
      <form action={registerCustomer}>
        <input type="hidden" name="next" value={next} />
        <label htmlFor="name">{t("name")}</label><input id="name" name="name" required autoComplete="name" />
        <label htmlFor="email">{t("email")}</label><input id="email" name="email" type="email" required autoComplete="email" />
        <label htmlFor="password">{t("password")}</label><input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
        <p className="muted">{_("At least 8 characters, with a letter and a number.")}</p>
        <p><button>{t("create_account")}</button></p>
      </form>
      <p>{t("have_account")} <Link href={`/login?next=${encodeURIComponent(next)}`}>{t("login")}</Link></p>
    </AuthShell>
  );
}
