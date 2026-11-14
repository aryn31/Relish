"use client";
import { useT } from "./I18n";
type Acc = { email: string; pw: string; label: string; note: string };
const GROUPS: { title: string; items: Acc[] }[] = [
  { title: "Super admin", items: [{ email: "super@example.com", pw: "ChangeMe123!", label: "Platform admin", note: "Review and approve restaurant requests" }] },
  { title: "Restaurant owners", items: [
    { email: "owner@greenfork.demo", pw: "Demo@1234", label: "The Green Fork", note: "Live · orders, payments, cancellation request" },
    { email: "staff@greenfork.demo", pw: "Demo@1234", label: "The Green Fork (staff)", note: "Second admin on the same restaurant" },
    { email: "owner@spicegarden.demo", pw: "Demo@1234", label: "Spice Garden", note: "Live" },
    { email: "owner@lakeview.demo", pw: "Demo@1234", label: "Lakeview Dine", note: "Live" },
    { email: "owner@urbanbites.demo", pw: "Demo@1234", label: "Urban Bites", note: "Deactivated (read-only)" }] },
  { title: "Applicants", items: [
    { email: "owner@royalbites.demo", pw: "Demo@1234", label: "Royal Bites", note: "Waiting for review" },
    { email: "owner@pizzapalace.demo", pw: "Demo@1234", label: "Pizza Palace", note: "Approved · setting up" },
    { email: "owner@cloudkitchen.demo", pw: "Demo@1234", label: "Cloud Kitchen Co", note: "Returned for corrections" },
    { email: "owner@saffron.demo", pw: "Demo@1234", label: "Saffron Street", note: "Rejected" },
    { email: "owner@newbistro.demo", pw: "Demo@1234", label: "New Bistro", note: "Draft, not submitted yet" }] },
  { title: "Customers", items: [
    { email: "rohan@demo.com", pw: "Demo@1234", label: "Rohan Gupta", note: "Has pending and past orders" },
    { email: "meera@demo.com", pw: "Demo@1234", label: "Meera Nair", note: "" },
    { email: "sneha@demo.com", pw: "Demo@1234", label: "Sneha Iyer", note: "No orders yet" }] },
];

/** Demo-only quick sign-in. Rendered only when DEMO_MODE=true. */
export default function DemoAccounts() {
  const _ = useT();
  function use(a: Acc) {
    const e = document.getElementById("email") as HTMLInputElement | null, p = document.getElementById("password") as HTMLInputElement | null;
    if (!e || !p) return;
    e.value = a.email; p.value = a.pw; e.form?.requestSubmit();
  }
  return (
    <details open className="demo card" style={{ marginTop: 22, padding: 16 }}>
      <summary style={{ cursor: "pointer", fontWeight: 700 }}>{_("Demo accounts")} <span className="muted" style={{ fontWeight: 400 }}>· {_("click to sign in")}</span></summary>
      <div className="scroll">
      {GROUPS.map((g) => (
        <div key={g.title} style={{ marginTop: 12 }}>
          <div className="muted" style={{ fontSize: ".75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>{_(g.title)}</div>
          <div className="stack" style={{ gap: 6 }}>
            {g.items.map((a) => (
              <button key={a.email} type="button" className="alt demo-row" onClick={() => use(a)}>
                <span><b>{a.label}</b>{a.note && <small>{_(a.note)}</small>}</span><code>{a.email}</code>
              </button>))}
          </div>
        </div>))}
      </div>
      <p className="muted" style={{ fontSize: ".78rem", marginBottom: 0 }}>{_("Password for demo accounts")}: <code>Demo@1234</code></p>
    </details>
  );
}
