import { cookies } from "next/headers";

const en = {
  site: "Relish", find: "Find restaurants", signin: "Sign in", signout: "Sign out", register_cta: "Register Your Restaurant",
  hero_c: "Discover Great Food. Order with Ease.", hero_o: "Bring Your Restaurant Online. Reach More Customers.",
  search: "Search by name", all_types: "All types", go: "Search", view_menu: "View Menu", none_found: "No restaurants found.",
  how_c: "How it works for customers", how_c1: "Find a restaurant or scan its QR code", how_c2: "Browse the menu and place your order", how_c3: "Track your order and pay",
  benefits: "Benefits for restaurant owners", b1: "A professional online presence", b2: "A menu QR code for your tables", b3: "Convenient ordering for customers", b4: "Update prices and availability easily", b5: "All orders in one place", b6: "Easy tracking of payments you are owed",
  how_o: "How to register your restaurant", o1: "Create an account and enter your restaurant details", o2: "Preview your page and submit for review", o3: "We review it and tell you your one-time setup fee", o4: "Pay the fee outside the app; we confirm it", o5: "Add your menu, tables and UPI QR code", o6: "Your restaurant goes live automatically",
  terms: "Terms of Service", privacy: "Privacy Policy", prev: "Previous", next: "Next", language: "Language",
  email: "Email", password: "Password", name: "Your name", save: "Save", cancel: "Cancel", back: "Back", submit: "Submit", delete: "Delete", add: "Add", edit: "Edit",
  google: "Continue with Google", or: "or", login: "Sign in", create_account: "Create account", forgot: "Forgot password?", no_account: "New customer?", have_account: "Already have an account?",
  cart: "Cart", add_to_cart: "Add", unavailable: "Unavailable", empty_cart: "Your cart is empty.", checkout: "Checkout", total: "Total", qty: "Qty", remove: "Remove",
  table: "Table", choose_table: "Choose your table", payment: "Payment", pay_upi: "Pay by UPI QR", pay_cash: "Pay cash at counter", place_order: "Place order",
  my_orders: "My orders", order: "Order", status: "Status", pending: "Pending", completed: "Completed", cancelled: "Cancelled", paid: "Paid", payment_pending: "Payment pending",
  prep_time: "Estimated preparation time", minutes: "minutes", claimed: "You said you paid. Waiting for the restaurant to confirm.", i_paid: "I have paid",
  request_cancel: "Request cancellation", reason: "Reason", cancel_sent: "Cancellation requested. The restaurant will decide.", cancel_rejected: "Cancellation was declined.",
  cancelled_paid_note: "Cancelled. Payment was received; any refund is handled directly by the restaurant outside this app.",
  unavailable_page: "This restaurant is currently unavailable.", closed_cart: "This restaurant is currently unavailable. You cannot check out right now.",
  veg: "Veg", nonveg: "Non-veg", price_changed: "Some prices changed. Please review and confirm.", confirm_prices: "Confirm new prices", item_gone: "Some items are no longer available. Remove them to continue.",
};
type K = keyof typeof en;
const hi: Partial<Record<K, string>> = {
  find: "रेस्टोरेंट खोजें", signin: "साइन इन", signout: "साइन आउट", register_cta: "अपना रेस्टोरेंट रजिस्टर करें",
  hero_c: "बेहतरीन खाना खोजें। आसानी से ऑर्डर करें।", hero_o: "अपना रेस्टोरेंट ऑनलाइन लाएँ। ज़्यादा ग्राहकों तक पहुँचें।",
  search: "नाम से खोजें", all_types: "सभी प्रकार", go: "खोजें", view_menu: "मेन्यू देखें", none_found: "कोई रेस्टोरेंट नहीं मिला।",
  how_c: "ग्राहकों के लिए यह कैसे काम करता है", how_c1: "रेस्टोरेंट खोजें या उसका QR कोड स्कैन करें", how_c2: "मेन्यू देखें और ऑर्डर करें", how_c3: "ऑर्डर ट्रैक करें और भुगतान करें",
  benefits: "रेस्टोरेंट मालिकों के लाभ", b1: "पेशेवर ऑनलाइन पहचान", b2: "आपकी टेबल के लिए मेन्यू QR कोड", b3: "ग्राहकों के लिए सुविधाजनक ऑर्डर", b4: "कीमत और उपलब्धता आसानी से बदलें", b5: "सभी ऑर्डर एक जगह", b6: "बकाया भुगतान का आसान हिसाब",
  how_o: "रेस्टोरेंट कैसे रजिस्टर करें", o1: "खाता बनाएँ और रेस्टोरेंट की जानकारी भरें", o2: "अपना पेज देखें और समीक्षा के लिए भेजें", o3: "हम समीक्षा करके आपकी एकमुश्त सेटअप फीस बताएँगे", o4: "फीस ऐप के बाहर चुकाएँ; हम पुष्टि करेंगे", o5: "मेन्यू, टेबल और UPI QR जोड़ें", o6: "आपका रेस्टोरेंट अपने आप लाइव हो जाएगा",
  terms: "सेवा की शर्तें", privacy: "गोपनीयता नीति", prev: "पिछला", next: "अगला", language: "भाषा",
  email: "ईमेल", password: "पासवर्ड", name: "आपका नाम", save: "सहेजें", cancel: "रद्द करें", back: "वापस", submit: "जमा करें", delete: "हटाएँ", add: "जोड़ें", edit: "बदलें",
  google: "Google से जारी रखें", or: "या", login: "साइन इन", create_account: "खाता बनाएँ", forgot: "पासवर्ड भूल गए?", no_account: "नए ग्राहक?", have_account: "पहले से खाता है?",
  cart: "कार्ट", add_to_cart: "जोड़ें", unavailable: "उपलब्ध नहीं", empty_cart: "आपका कार्ट खाली है।", checkout: "चेकआउट", total: "कुल", qty: "मात्रा", remove: "हटाएँ",
  table: "टेबल", choose_table: "अपनी टेबल चुनें", payment: "भुगतान", pay_upi: "UPI QR से भुगतान", pay_cash: "काउंटर पर नकद भुगतान", place_order: "ऑर्डर करें",
  my_orders: "मेरे ऑर्डर", order: "ऑर्डर", status: "स्थिति", pending: "लंबित", completed: "पूरा हुआ", cancelled: "रद्द", paid: "भुगतान हुआ", payment_pending: "भुगतान बाकी",
  prep_time: "अनुमानित तैयारी समय", minutes: "मिनट", claimed: "आपने भुगतान बताया है। रेस्टोरेंट की पुष्टि का इंतज़ार है।", i_paid: "मैंने भुगतान कर दिया",
  request_cancel: "रद्द करने का अनुरोध", reason: "कारण", cancel_sent: "रद्द करने का अनुरोध भेजा गया। रेस्टोरेंट निर्णय लेगा।", cancel_rejected: "रद्द करने का अनुरोध अस्वीकृत।",
  cancelled_paid_note: "रद्द। भुगतान मिल चुका है; रिफंड रेस्टोरेंट सीधे ऐप के बाहर संभालेगा।",
  unavailable_page: "यह रेस्टोरेंट अभी उपलब्ध नहीं है।", closed_cart: "यह रेस्टोरेंट अभी उपलब्ध नहीं है। अभी चेकआउट नहीं हो सकता।",
  veg: "शाकाहारी", nonveg: "मांसाहारी", price_changed: "कुछ कीमतें बदल गई हैं। कृपया देखकर पुष्टि करें।", confirm_prices: "नई कीमतें स्वीकार करें", item_gone: "कुछ आइटम अब उपलब्ध नहीं हैं। आगे बढ़ने के लिए हटाएँ।",
};

import { translate } from "./hi";
import { fmtDate } from "./format";
export type Lang = "en" | "hi";
export async function getLang(): Promise<Lang> {
  const c = (await cookies()).get("lang")?.value;
  return c === "hi" ? "hi" : "en";
}
/** Returns translator; missing Hindi falls back to English (I18N-04). */
export async function tr() {
  const l = await getLang();
  const t = (k: K) => (l === "hi" ? hi[k] : undefined) ?? en[k];
  /** English-as-key translator: _("Welcome back, {name}", { name }). Falls back to English. */
  const _ = (s: string, vars?: Record<string, string | number>) => translate(l, s, vars);
  const fd = (v: string | Date | null | undefined) => fmtDate(v, l);
  return { t, _, fd, lang: l };
}
export const STR = { en, hi };
export type { K };
