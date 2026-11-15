import { cookies } from "next/headers";
import { api } from "@/lib/api";

/** Switch language: remembered on the device, and on the account when signed in. */
export async function POST(req: Request) {
  const v = (await req.text()) === "hi" ? "hi" : "en";
  const jar = await cookies();
  jar.set("lang", v, { path: "/", maxAge: 365 * 86400 });
  if (jar.get("session")) await api.patch("/api/me/lang", { lang: v });
  return new Response("ok");
}
