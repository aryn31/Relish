import type { Request, Response, NextFunction } from "express";

/** Throw from any route: becomes `{ error, redirect? }` with the given HTTP status.
 *  `error` is the user-facing English message (the frontend translates it). */
export class HttpError extends Error {
  constructor(public status: number, message: string, public redirect?: string) { super(message); }
}
export const fail = (message: string, status = 400, redirect?: string): never => { throw new HttpError(status, message, redirect); };

/** Success response: `{ ok: true, message?, ...data }`. */
export const ok = (res: Response, data: Record<string, unknown> = {}) => { res.json({ ok: true, ...data }); };

/** Client IP. The frontend forwards the browser's IP in x-forwarded-for. */
export const clientIp = (req: Request) => String(req.headers["x-forwarded-for"] ?? "").split(",")[0].trim() || req.socket.remoteAddress || "local";

export const str = (v: unknown) => String(v ?? "").trim();
export const num = (v: unknown) => Number(v);
export const id = (req: Request, key = "id") => { const v = Number(req.params[key]); if (!Number.isInteger(v) || v <= 0) fail("Not found.", 404); return v; };

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) { res.status(err.status).json({ error: err.message, ...(err.redirect ? { redirect: err.redirect } : {}) }); return; }
  const e = err as { code?: string; type?: string };
  if (e?.code === "LIMIT_FILE_SIZE") { res.status(400).json({ error: "Image must be 5 MB or smaller." }); return; }
  if (e?.type === "entity.parse.failed") { res.status(400).json({ error: "Invalid request." }); return; }
  console.error(err);
  res.status(500).json({ error: "Something went wrong. Please try again." });
}
