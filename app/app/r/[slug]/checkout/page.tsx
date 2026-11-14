import { getBySlug } from "@/lib/restaurant";
import { getUser } from "@/lib/auth";
import { tr, STR } from "@/lib/i18n";
import Checkout from "./Checkout";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const r = await getBySlug(slug); const u = await getUser(); const { lang } = await tr();
  if (!r) return <main><h1>Not found</h1></main>;
  return <Checkout restaurantId={r.id} slug={r.slug} name={r.name} signedIn={!!u && u.role === "customer"} staff={!!u && u.role !== "customer"}
    labels={{ ...STR.en, ...(lang === "hi" ? (STR.hi as Record<string, string>) : {}) }} />;
}
