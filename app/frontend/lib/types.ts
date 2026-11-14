/** Shapes returned by the backend API. */
export type Restaurant = { id: number; slug: string; name: string; owner_name?: string; email?: string; address: string; phone: string; type: string; description: string; upi_qr?: string | null; state: "pending" | "active" | "inactive"; inactive_reason?: string | null; details_reviewed?: number; fssai?: string | null; gstin?: string | null };
export type MenuData = { cats: { id: number; name: string; items: { id: number; name: string; description: string; image: string | null; veg: number | null; available: number; portions: { id: number; label: string; price: number; available: number }[] }[] }[] };
export type Checklist = { steps: { key: string; ok: boolean }[]; ok: boolean };
export type Fee = { amount_paise: number | null; state: string; prev_amount_paise: number | null };
export type Application = { id: number; state: string; reason: string | null };
