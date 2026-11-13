import Link from "next/link";
import { login } from "../actions/auth";
import Flash from "@/components/Flash";
import { tr } from "@/lib/i18n";
export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string; ok?: string; err?: string }> }) {
  const sp = await searchParams; const { t } = await tr(); const next = sp.next || "/";
  return (
    <main style={{ maxWidth: 420 }}>
      <h1>{t("login")}</h1><Flash sp={sp} />
      {process.env.GOOGLE_CLIENT_ID && <><a className="btn" style={{ display: "block", textAlign: "center" }} href={`/api/google?next=${encodeURIComponent(next)}`}>{t("google")}</a><p className="muted" style={{ textAlign: "center" }}>{t("or")}</p></>}
      <form action={login}>
        <input type="hidden" name="next" value={next} />
        <label htmlFor="email">{t("email")}</label><input id="email" name="email" type="email" required autoComplete="email" />
        <label htmlFor="password">{t("password")}</label><input id="password" name="password" type="password" required autoComplete="current-password" />
        <p><button>{t("login")}</button></p>
      </form>
      <p><Link href="/forgot">{t("forgot")}</Link></p>
      <p>{t("no_account")} <Link href={`/register?next=${encodeURIComponent(next)}`}>{t("create_account")}</Link></p>
    </main>
  );
}
