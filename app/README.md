# Relish — Multi-Restaurant Ordering Platform (PRD v2.0, release 1)

Next.js 15 (App Router, server actions) + PostgreSQL.

## Run
    docker compose up -d     # PostgreSQL 16 in Docker (port 5433, data in the relish-data volume)
    npm install
    npm run seed        # demo data (optional, safe to re-run)
    npm run photos      # download real food photos from Wikimedia Commons (optional; see /credits)
    npm run dev         # http://localhost:3000

Tables are created automatically on first start. Config in `.env.local`: `DATABASE_URL`, `SESSION_SECRET`,
`SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`, `BASE_URL` (change the secrets before real use).
Feature switches (both off for now): `SETUP_FEE_ENABLED=true` brings back the one-time setup fee step; `EMAIL_VERIFICATION_ENABLED=true` brings back owner email verification. With both off, a restaurant registration goes straight to the super admin for review.

Optional `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` enable Google sign-in (redirect URI `{BASE_URL}/api/google`).

## Demo logins (after `npm run seed`)
With `DEMO_MODE=true` (set in `.env.local`) the sign-in page shows a **Demo accounts** panel: click any account to sign in.
**Turn `DEMO_MODE` off in production.**

| Role | Email | Password |
|---|---|---|
| Super admin | super@example.com | ChangeMe123! |
| Restaurant admin (live) | owner@greenfork.demo, owner@spicegarden.demo, owner@lakeview.demo | Demo@1234 |
| Second admin, same restaurant | staff@greenfork.demo | Demo@1234 |
| Restaurant admin (deactivated) | owner@urbanbites.demo | Demo@1234 |
| Applicant: awaiting review | owner@royalbites.demo, owner@tandoori.demo | Demo@1234 |
| Applicant: approved, fee unpaid | owner@pizzapalace.demo | Demo@1234 |
| Applicant: returned for corrections | owner@cloudkitchen.demo | Demo@1234 |
| Applicant: rejected | owner@saffron.demo | Demo@1234 |
| Applicant: email not verified | owner@newbistro.demo | Demo@1234 |
| Customers | rohan@demo.com, meera@demo.com, karan@demo.com, ayesha@demo.com, vikram@demo.com, sneha@demo.com, arjun@demo.com, fatima@demo.com | Demo@1234 |

## Tests
`npm run build && npx next start -p 3100`, then `BASE=http://localhost:3100 npm run e2e`
(re-seed first; it drives real server actions: ordering, duplicates, payments, cancellation, onboarding, deactivation).

Emails are stored in the DB and shown at `/super/emails` (swap `lib/mail.ts` for a real provider).
Back up the database and the `uploads/` folder.
