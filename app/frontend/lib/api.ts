import "server-only";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

/** Address of the backend API, reachable from the frontend server (e.g. a private network URL). */
export const backendUrl = () => (process.env.BACKEND_URL || "http://localhost:4000").replace(/\/$/, "");

export type ApiBody = { ok?: boolean; error?: string; message?: string; redirect?: string; [k: string]: unknown };
export type ApiRes<T = Record<string, unknown>> = { ok: boolean; status: number; data: T & ApiBody };

/** Call the backend from the frontend server, forwarding the user's session cookie and IP. */
async function call<T>(method: string, path: string, body?: unknown): Promise<ApiRes<T>> {
  const jar = await cookies(); const h = await headers();
  const hdr: Record<string, string> = { accept: "application/json" };
  const session = jar.get("session")?.value;
  if (session) hdr.cookie = `session=${session}`;
  const ip = h.get("x-forwarded-for") ?? h.get("x-real-ip");
  if (ip) hdr["x-forwarded-for"] = ip;
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) { hdr["content-type"] = "application/json"; payload = JSON.stringify(body); }
  let res: Response;
  try { res = await fetch(backendUrl() + path, { method, headers: hdr, body: payload, cache: "no-store" }); }
  catch { return { ok: false, status: 503, data: { error: "The service is temporarily unavailable. Please try again." } as T & ApiBody }; }
  let data = {} as T & ApiBody;
  try { data = (await res.json()) as T & ApiBody; } catch { /* non-JSON */ }
  return { ok: res.ok, status: res.status, data };
}

export const api = {
  get: <T = Record<string, unknown>>(path: string) => call<T>("GET", path),
  post: <T = Record<string, unknown>>(path: string, body: unknown = {}) => call<T>("POST", path, body),
  patch: <T = Record<string, unknown>>(path: string, body: unknown = {}) => call<T>("PATCH", path, body),
  put: <T = Record<string, unknown>>(path: string, body: unknown = {}) => call<T>("PUT", path, body),
  del: <T = Record<string, unknown>>(path: string, body?: unknown) => call<T>("DELETE", path, body),
  /** multipart/form-data (file uploads) */
  form: <T = Record<string, unknown>>(path: string, fd: FormData, method = "POST") => call<T>(method, path, fd),
};

/** GET data for a page. 401 → sign-in page, 403 → home, 404 → not-found page. */
export async function load<T>(path: string, next = "/"): Promise<T & ApiBody> {
  const r = await api.get<T>(path);
  if (r.status === 401) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (r.status === 403) redirect("/");
  if (r.status === 404) notFound();
  if (!r.ok) throw new Error(r.data.error || `API error ${r.status} for ${path}`);
  return r.data;
}
