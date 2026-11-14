import { UtensilsCrossed, QrCode, ShoppingBag, CheckCircle2, Clock, XCircle, Receipt, IndianRupee, Users, Store, LayoutDashboard, Settings, Table2, ClipboardList, Mail, FileCheck, MapPin, Phone, ArrowUpRight, ArrowRight, Leaf, Wallet, Search, Plus, Sparkles, Bell, Ban, Smartphone, type LucideIcon } from "lucide-react";
const map = { utensils: UtensilsCrossed, qr: QrCode, bag: ShoppingBag, check: CheckCircle2, clock: Clock, x: XCircle, receipt: Receipt, rupee: IndianRupee, users: Users, store: Store, dash: LayoutDashboard, settings: Settings, table: Table2, list: ClipboardList, mail: Mail, file: FileCheck, pin: MapPin, phone: Phone, up: ArrowUpRight, right: ArrowRight, leaf: Leaf, wallet: Wallet, search: Search, plus: Plus, spark: Sparkles, bell: Bell, ban: Ban, mobile: Smartphone } satisfies Record<string, LucideIcon>;
export type IconName = keyof typeof map;
export default function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  const C = map[name]; return <C size={size} strokeWidth={2} className={className} aria-hidden="true" />;
}
