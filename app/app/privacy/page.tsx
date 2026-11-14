import { tr } from "@/lib/i18n";
export default async function P() { const { _ } = await tr(); return <main><h1>{_("Privacy Policy")}</h1><p className="muted">{_("Content to be supplied by the business (PRD §17.3). The super admin may view an individual order only for support and dispute purposes.")}</p></main>; }
