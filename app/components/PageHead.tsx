import { tr } from "@/lib/i18n";
export default async function PageHead({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  const { _ } = await tr();
  return <div className="pagehead"><div><h1>{_(title)}</h1>{sub && <p>{_(sub)}</p>}</div>{children && <div className="row">{children}</div>}</div>;
}
