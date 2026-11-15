import { api } from "@/lib/api";
import type { Restaurant } from "@/lib/types";
import { getUser } from "@/lib/auth";
import { tr, STR } from "@/lib/i18n";
import Checkout from "./Checkout";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const res = await api.get<{ restaurant: Restaurant }>(`/api/restaurants/${encodeURIComponent(slug)}`); const u = await getUser(); const { lang } = await tr();
  if (!res.ok && res.status !== 404) throw new Error(res.data.error || `API error ${res.status}`);
  const r = res.ok ? res.data.restaurant : undefined;
  if (!r) return <main><h1>Not found</h1></main>;
  return <Checkout restaurantId={r.id} slug={r.slug} name={r.name} signedIn={!!u && u.role === "customer"} staff={!!u && u.role !== "customer"}
    labels={{ ...STR.en, ...(lang === "hi" ? (STR.hi as Record<string, string>) : {}) }} />;
}
