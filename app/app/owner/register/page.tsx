import AuthShell from "@/components/AuthShell";
import Flash from "@/components/Flash";
import RegisterForm from "./RegisterForm";
export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams;
  return <AuthShell title="Register your restaurant" blurb="Put your menu online, get a QR code for every table and manage orders and payments in one place."><Flash sp={sp} /><RegisterForm /></AuthShell>;
}
