import AuthShell from "@/components/AuthShell";
import Flash from "@/components/Flash";
import RegisterForm from "./RegisterForm";
import { tr } from "@/lib/i18n";
import { getConfig } from "@/lib/config";
export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams; const { _ } = await tr(); const { emailVerificationEnabled } = await getConfig();
  return <AuthShell title={_("Register your restaurant")} blurb={_("Put your menu online, get a QR code for every table and manage orders and payments in one place.")}><Flash sp={sp} /><RegisterForm verify={emailVerificationEnabled} /></AuthShell>;
}
