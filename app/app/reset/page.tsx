import { resetPassword } from "../actions/auth";
import Flash from "@/components/Flash";
export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string; ok?: string; err?: string }> }) {
  const sp = await searchParams;
  return <main style={{ maxWidth: 420 }}><h1>Choose a new password</h1><Flash sp={sp} />
    <form action={resetPassword}><input type="hidden" name="token" value={sp.token || ""} />
      <label htmlFor="password">New password</label><input id="password" name="password" type="password" required minLength={8} />
      <p><button>Save password</button></p></form></main>;
}
