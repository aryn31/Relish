import Flash from "@/components/Flash";
import RegisterForm from "./RegisterForm";
export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams;
  return <main style={{ maxWidth: 520 }}><h1>Register your restaurant</h1><Flash sp={sp} /><RegisterForm /></main>;
}
