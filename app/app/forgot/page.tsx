import { forgot } from "../actions/auth";
import AuthShell from "@/components/AuthShell";
import Flash from "@/components/Flash";
import { tr } from "@/lib/i18n";
export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams; const { _ } = await tr();
  return <AuthShell title={_("Reset password")}><Flash sp={sp} />
    <p className="muted">{_("Google users: recover access through Google.")}</p>
    <form action={forgot}><label htmlFor="email">{_("Email")}</label><input id="email" name="email" type="email" required /><p><button>{_("Send reset link")}</button></p></form></AuthShell>;
}
