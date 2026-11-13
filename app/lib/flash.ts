import { redirect } from "next/navigation";
/** Redirect with a message shown by <Flash/>. */
export function go(path: string, msg?: string, err = false): never {
  if (!msg) redirect(path);
  const u = new URL(path, "http://x");
  u.searchParams.set(err ? "err" : "ok", msg);
  redirect(u.pathname + u.search);
}
