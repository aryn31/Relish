import { forgot } from "../actions/auth";
import AuthShell from "@/components/AuthShell";
import Flash from "@/components/Flash";
export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams;
  return <AuthShell title="Reset password"><Flash sp={sp} />
    <p className="muted">Google users: recover access through Google.</p>
    <form action={forgot}><label htmlFor="email">Email</label><input id="email" name="email" type="email" required /><p><button>Send reset link</button></p></form></AuthShell>;
}
