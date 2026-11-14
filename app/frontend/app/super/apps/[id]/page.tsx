import Link from "next/link";
import { api, load } from "@/lib/api";
import { inr } from "@/lib/format";
import { getConfig } from "@/lib/config";
import type { Restaurant, Fee, MenuData } from "@/lib/types";
import { assignFee, confirmFee, decideApplication } from "@/app/actions/super";
import MenuView from "@/components/MenuView";
import { STR, tr } from "@/lib/i18n";
import PageHead from "@/components/PageHead";
import { ArrowLeft } from "lucide-react";
import Flash from "@/components/Flash";
import Confirm from "@/components/Confirm";

type AppData = {
  application: { id: number; restaurant_id: number; state: string; reason: string | null; updated_at: string };
  restaurant: Restaurant; fee: Fee | null; owner: { name: string; email: string; email_verified: number } | null;
  dups: { id: number; name: string; state: string }[]; preview: { menu: MenuData; cover: string | null } | null;
};

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string; preview?: string }> }) {
  const { id } = await params; const sp = await searchParams; const { _, lang, fd } = await tr();
  const path = `/api/super/applications/${encodeURIComponent(id)}${sp.preview ? "?preview=1" : ""}`;
  const res = await api.get<AppData>(path);
  if (res.status === 404) return <p>{_("Not found.")}</p>;
  const data = res.ok ? res.data : await load<AppData>(path, `/super/apps/${id}`);
  const { application: a, restaurant: r, dups, preview } = data, f = data.fee!, owner = data.owner!;
  const { feeEnabled, emailVerificationEnabled } = await getConfig();
  const hidden = <input type="hidden" name="app_id" value={a.id} />;
  return (
    <div><Link className="crumb" href="/super/applications"><ArrowLeft size={16} /> {_("Applications")}</Link><Flash sp={sp} />
      <PageHead title={r.name} sub={_("Application #{n} · {date}", { n: a.id, date: fd(a.updated_at) })}><span className={`badge ${a.state}`}>{_(a.state)}</span></PageHead>
      <div className="cols">
      <div className="stack">
      {dups.length > 0 && <div className="msg err"><strong>{_("Possible duplicate:")}</strong> {dups.map((d) => `${d.name} (${_(d.state)})`).join(", ")} {_("matches by contact number or name + address. This is only a warning.")}</div>}
      <div className="card"><h3 style={{ marginTop: 0 }}>{_("Application details")}</h3>
        <div className="kv"><span>{_("Restaurant name")}</span><strong>{r.name}</strong></div><div className="kv"><span>{_("Type")}</span><strong>{_(r.type)}</strong></div><div className="kv"><span>{_("Address")}</span><strong>{r.address}</strong></div><div className="kv"><span>{_("Contact")}</span><strong>{r.phone}</strong></div>
        <div className="kv"><span>{_("Owner")}</span><strong>{owner.name}</strong></div><div className="kv"><span>{_("Email")}</span><strong>{owner.email}{emailVerificationEnabled && <> <span className={`badge ${owner.email_verified ? "active" : "inactive"}`}>{owner.email_verified ? _("verified") : _("not verified")}</span></>}</strong></div>
        {(r.fssai || r.gstin) && <div className="kv"><span>{_("FSSAI / GSTIN")}</span><strong>{r.fssai} {r.gstin}</strong></div>}
        {r.description && <div className="kv"><span>{_("About")}</span><strong>{r.description}</strong></div>}
        <p style={{ marginBottom: 0 }}><Link className="btn alt" href={`/super/apps/${a.id}?preview=1`}>{_("View private preview")}</Link></p></div>
      </div>
      <div className="stack sticky">

      {feeEnabled && <div className="card"><h3 style={{ marginTop: 0 }}>{_("Setup fee")} — {f.state === "not_assigned" ? _("not assigned") : f.state === "awaiting" ? _("awaiting payment") : _("confirmed")}</h3>
        {f.state !== "confirmed" ? <form action={assignFee} className="row">{hidden}<input name="amount" type="number" step="0.01" min="1" placeholder={_("Amount ₹")} defaultValue={f.amount_paise ? (f.amount_paise / 100).toFixed(2) : ""} aria-label={_("Fee amount")} style={{ width: 140 }} /><button className="alt">{f.state === "awaiting" ? _("Change fee") : _("Assign fee")}</button></form>
          : <p>{inr(f.amount_paise!)} ({_("locked")}){f.prev_amount_paise ? ` · ${_("previous")} ${inr(f.prev_amount_paise)}` : ""}</p>}
        {f.state === "awaiting" && <form action={confirmFee} style={{ marginTop: 8 }}>{hidden}<Confirm message={_("Confirm you have received this fee in your own records?")}>{_("Mark fee received")}</Confirm></form>}</div>}

      {a.state === "submitted" && <div className="card"><h3 style={{ marginTop: 0 }}>{_("Decision")}</h3>
        <form action={decideApplication} className="stack">{hidden}<label htmlFor="reason">{_("Reason (required to reject or return)")}</label><textarea id="reason" name="reason" rows={2} />
          <div className="row"><button name="decision" value="approve">{_("Approve")}</button><button className="alt" name="decision" value="return">{_("Return for corrections")}</button><button className="danger" name="decision" value="reject">{_("Reject")}</button></div></form></div>}
      </div></div>
      {sp.preview && preview && <><hr /><MenuView r={r} menu={preview.menu} cover={preview.cover} preview labels={lang === "hi" ? { ...STR.en, ...STR.hi } as Record<string, string> : STR.en} open={false} /></>}
    </div>
  );
}
