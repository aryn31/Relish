"use client";
import { useState } from "react";
import { useT } from "@/components/I18n";
import { registerRestaurant } from "@/app/actions/owner";

const TYPES = ["Vegetarian restaurant", "Cafe", "Fast food", "Family restaurant", "Bakery", "Other"];
export default function RegisterForm() {
  const _ = useT();
  const [step, setStep] = useState(1);
  const [d, setD] = useState({ name: "", owner: "", type: TYPES[0], address: "", phone: "", email: "", password: "", fssai: "", gstin: "" });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setD({ ...d, [k]: e.target.value });

  function next() {
    setErr("");
    if (step === 1 && (!d.name.trim() || !d.owner.trim() || !d.address.trim())) return setErr(_("Please fill in restaurant name, owner name and address."));
    if (step === 1 && d.phone.replace(/\D/g, "").length < 10) return setErr(_("Please enter a valid 10-digit contact number."));
    if (step === 2 && !/^\S+@\S+\.\S+$/.test(d.email)) return setErr(_("Please enter a valid email address."));
    if (step === 2 && !(d.password.length >= 8 && /[A-Za-z]/.test(d.password) && /\d/.test(d.password))) return setErr(_("Password must be at least 8 characters and include a letter and a number."));
    setStep(step + 1);
  }
  return (
    <form action={(fd) => { setBusy(true); return registerRestaurant(fd); }}>
      <div className="steps" aria-label={_("Step {n} of 3", { n: step })}>{[1, 2, 3].map((n) => <span key={n} className={n <= step ? "on" : ""} />)}</div>
      <p className="muted">{_("Step {n} of 3", { n: step })}</p>
      {err && <div className="msg err" role="alert">{err}</div>}
      {/* all fields stay mounted so data is preserved */}
      <div hidden={step !== 1}>
        <div className="two"><div><label htmlFor="name">{_("Restaurant name")}</label><input id="name" name="name" value={d.name} onChange={set("name")} /></div>
        <div><label htmlFor="owner">{_("Owner's name")}</label><input id="owner" name="owner" value={d.owner} onChange={set("owner")} /></div></div>
        <label htmlFor="type">{_("Restaurant type")}</label><select id="type" name="type" value={d.type} onChange={set("type")}>{TYPES.map((t) => <option key={t} value={t}>{_(t)}</option>)}</select>
        <label htmlFor="address">{_("Address")}</label><input id="address" name="address" value={d.address} onChange={set("address")} />
        <label htmlFor="phone">{_("Contact number")}</label><input id="phone" name="phone" inputMode="tel" value={d.phone} onChange={set("phone")} />
        <div className="two"><div><label htmlFor="fssai">{_("FSSAI (optional)")}</label><input id="fssai" name="fssai" value={d.fssai} onChange={set("fssai")} /></div>
        <div><label htmlFor="gstin">{_("GSTIN (optional)")}</label><input id="gstin" name="gstin" value={d.gstin} onChange={set("gstin")} /></div></div>
      </div>
      <div hidden={step !== 2}>
        <label htmlFor="email">{_("Email")}</label><input id="email" name="email" type="email" value={d.email} onChange={set("email")} autoComplete="email" />
        <label htmlFor="password">{_("Password")}</label><input id="password" name="password" type="password" value={d.password} onChange={set("password")} autoComplete="new-password" />
        <p className="muted">{_("At least 8 characters, with a letter and a number. We will email you a link to verify your address.")}</p>
      </div>
      {step === 3 && <div className="card stack"><h3 style={{ marginTop: 0 }}>{_("Review your details")}</h3>
        {([["Restaurant", d.name], ["Owner", d.owner], ["Type", _(d.type)], ["Address", d.address], ["Contact", d.phone], ["Email", d.email]] as const).map(([k, v]) => <div key={k}><span className="muted">{_(k)}: </span>{v}</div>)}
      </div>}
      <p className="row">
        {step > 1 && <button type="button" className="alt" onClick={() => setStep(step - 1)}>{_("Back")}</button>}
        {step < 3 ? <button type="button" onClick={next}>{_("Next")}</button> : <button disabled={busy}>{busy ? _("Creating…") : _("Create account")}</button>}
      </p>
    </form>
  );
}
