import { tr } from "@/lib/i18n";
export default async function P() { const { _ } = await tr(); return <main><h1>{_("Terms of Service")}</h1><p className="muted">{_("Content to be supplied by the business (PRD §17.3). Restaurants verify payments themselves; the platform does not hold or guarantee funds.")}</p></main>; }
