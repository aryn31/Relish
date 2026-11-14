import { resetPassword } from "../actions/auth";
import AuthShell from "@/components/AuthShell";
import Flash from "@/components/Flash";
import { tr } from "@/lib/i18n";
export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string; ok?: string; err?: string }> }) {
  const sp = await searchParams; const { _ } = await tr();
  return <AuthShell title={_("Choose a new password")}><Flash sp={sp} />
    <form action={resetPassword}><input type="hidden" name="token" value={sp.token || ""} />
      <label htmlFor="password">{_("New password")}</label><input id="password" name="password" type="password" required minLength={8} />
      <p><button>{_("Save password")}</button></p></form></AuthShell>;
}
