import "server-only";
import { go } from "./flash";
import type { ApiRes } from "./api";

/** Finish a server action from a backend response: redirect back with the backend's
 *  success/error message (shown and translated by <Flash/>). */
export function done(r: ApiRes<unknown>, back: string, okTo?: string): never {
  if (r.status === 401) go(`/login?next=${encodeURIComponent(back)}`);
  if (!r.ok) go(r.data.redirect ?? back, r.data.error ?? "Something went wrong. Please try again.", true);
  go(okTo ?? r.data.redirect ?? back, r.data.message);
}
