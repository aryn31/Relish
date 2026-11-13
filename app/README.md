# Relish — Multi-Restaurant Ordering Platform (PRD v2.0, release 1)

Next.js 15 (App Router, server actions) + SQLite (better-sqlite3). No external services needed to run.

    npm install
    npm run dev          # http://localhost:3000

Config in `.env.local` (change before real use): `SESSION_SECRET`, `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`, `BASE_URL`.
Optional: `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` enable "Continue with Google" (redirect URI: `{BASE_URL}/api/google`).

Emails (verification, reset, application/fee notices) are saved to the DB and printed to the console; the super admin can read
them at `/super/emails`. Swap `lib/mail.ts` for a real provider (SMTP/Resend) to send real mail.

Roles: customer · restaurant admin (`/admin`) · super admin (`/super`, seeded on first run).
Data: `data/app.db` (SQLite) and `uploads/` (images, UPI QRs) — back both up.
