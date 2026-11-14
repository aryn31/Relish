export default function PageHead({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return <div className="pagehead"><div><h1>{title}</h1>{sub && <p>{sub}</p>}</div>{children && <div className="row">{children}</div>}</div>;
}
