import { tr } from "@/lib/i18n";
/** Shows a flash message (translated to the current language when a translation exists). */
export default async function Flash({ sp }: { sp: { ok?: string; err?: string } }) {
  const { _ } = await tr();
  if (sp.err) return <div className="msg err" role="alert">{_(sp.err)}</div>;
  if (sp.ok) return <div className="msg good" role="status">{_(sp.ok)}</div>;
  return null;
}
