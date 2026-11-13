export default function Flash({ sp }: { sp: { ok?: string; err?: string } }) {
  if (sp.err) return <div className="msg err" role="alert">{sp.err}</div>;
  if (sp.ok) return <div className="msg good" role="status">{sp.ok}</div>;
  return null;
}
