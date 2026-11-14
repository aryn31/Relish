import { D as pub } from "./public";
import { D as adm } from "./admin";
import { D as sup } from "./super";
import { D as com } from "./common";

/** English text → Hindi. Keys are the exact English strings used in the UI.
 *  Keys may contain {placeholders}; the same placeholders must appear in the Hindi value. */
export const HI: Record<string, string> = { ...com, ...pub, ...adm, ...sup };

type Tpl = { re: RegExp; names: string[]; hi: string };
let tpls: Tpl[] | null = null;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function templates(): Tpl[] {
  if (tpls) return tpls;
  tpls = [];
  for (const [k, v] of Object.entries(HI)) {
    if (!/\{\w+\}/.test(k)) continue;
    const names: string[] = [];
    const src = k.split(/(\{\w+\})/).map((part) => { const m = /^\{(\w+)\}$/.exec(part); if (m) { names.push(m[1]); return "(.+?)"; } return esc(part); }).join("");
    tpls.push({ re: new RegExp(`^${src}$`), names, hi: v });
  }
  return tpls;
}

/** Translate `s` to Hindi (exact match, then template match). Falls back to English, never blank (I18N-04). */
export function toHindi(s: string, vars?: Record<string, string | number>): string {
  let out: string | undefined = HI[s];
  if (out === undefined) {
    for (const t of templates()) {
      const m = t.re.exec(s);
      if (m) { out = t.hi.replace(/\{(\w+)\}/g, (_, n) => { const i = t.names.indexOf(n); return i >= 0 ? m[i + 1] : `{${n}}`; }); break; }
    }
  }
  const r = out ?? s;
  return vars ? r.replace(/\{(\w+)\}/g, (_, n) => String(vars[n] ?? `{${n}}`)) : r;
}
export const translate = (lang: string, s: string, vars?: Record<string, string | number>) => {
  const base = lang === "hi" ? toHindi(s, undefined) : s;
  return vars ? base.replace(/\{(\w+)\}/g, (_, n) => String(vars[n] ?? `{${n}}`)) : base;
};
