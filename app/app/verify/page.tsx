import Link from "next/link";
import { db } from "@/lib/db";
import { useToken } from "@/lib/auth";
export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const uid = token ? useToken(token, "verify") : null;
  if (uid) db.prepare("UPDATE users SET email_verified=1 WHERE id=?").run(uid);
  return <main><h1>{uid ? "Email verified" : "Link invalid or expired"}</h1>
    <p>{uid ? <Link className="btn" href="/admin">Continue</Link> : <Link href="/admin">Go to your dashboard to request a new link.</Link>}</p></main>;
}
