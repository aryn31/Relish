import { requireRestAdmin } from "@/lib/auth";
import { updateProfile } from "@/app/actions/auth";
import Flash from "@/components/Flash";
import { tr } from "@/lib/i18n";
export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const { _ } = await tr(); const sp = await searchParams; const u = await requireRestAdmin();
  return <div style={{ maxWidth: 420 }}><Flash sp={sp} />
    <form action={updateProfile}><input type="hidden" name="back" value="/admin/settings" />
      <label>{_("Your name")}</label><input name="name" defaultValue={u.name} /><label>{_("Email")}</label><input value={u.email} disabled />
      <p><button>{_("Save")}</button></p></form>
    <p className="muted">{_("To change your email or reset your password, use \"Forgot password\" on the sign-in page or contact the platform team.")}</p></div>;
}
