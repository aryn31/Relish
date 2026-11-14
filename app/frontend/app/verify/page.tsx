import Link from "next/link";
import { api } from "@/lib/api";
import { tr } from "@/lib/i18n";
export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams; const { _ } = await tr();
  const uid = token ? !!(await api.post<{ verified: boolean }>("/api/auth/verify", { token })).data.verified : false;
  return <main><h1>{uid ? _("Email verified") : _("Link invalid or expired")}</h1>
    <p>{uid ? <Link className="btn" href="/admin">{_("Continue")}</Link> : <Link href="/admin">{_("Go to your dashboard to request a new link.")}</Link>}</p></main>;
}
