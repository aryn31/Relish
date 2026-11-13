import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
export async function POST(req: Request) {
  const v = (await req.text()) === "hi" ? "hi" : "en";
  (await cookies()).set("lang", v, { path: "/", maxAge: 365 * 86400 });
  const u = await getUser();
  if (u) db.prepare("UPDATE users SET lang=? WHERE id=?").run(v, u.id);
  return new Response("ok");
}
