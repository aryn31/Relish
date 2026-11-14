/** ₹ with Indian digit grouping, e.g. ₹1,25,000.00 */
export const inr = (paise: number) => {
  const s = (paise / 100).toFixed(2);
  const [i, d] = s.split(".");
  const last3 = i.slice(-3), rest = i.slice(0, -3);
  return "₹" + (rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," : "") + last3 + "." + d;
};
/** Date and time in Indian time (IST), in English or Hindi. */
export function fmtDate(s: string | Date | null | undefined, lang = "en") {
  if (!s) return "";
  const d = s instanceof Date ? s : new Date(s);
  return d.toLocaleString(lang === "hi" ? "hi-IN" : "en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
