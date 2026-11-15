# Relish — Multi-Restaurant Ordering Platform (PRD v2.0, release 1)
# Relish2 — Multi-Restaurant Ordering Platform (PRD v2.0, release 1)

The app is split into two services:

| Folder | What it is | Tech | Talks to |
|---|---|---|---|
| [`backend/`](backend/) | REST API — all business rules, auth/sessions, database, image storage, email | Node + Express + TypeScript, PostgreSQL | Postgres |
| [`frontend/`](frontend/) | Web UI — pages, design, Hindi/English | Next.js 15 (React) | the backend only (no database access) |

```
Browser ──► frontend (Next.js :3000) ──► backend (Express API :4000) ──► PostgreSQL
              │  pages render on the server and call the API
              └─ /api/* from the browser (images, QR, Google sign-in) is proxied to the backend
```

The browser only ever talks to the frontend, so there is one origin: no CORS setup, and the
session cookie works everywhere. The backend can stay on a private network.

## Run locally

```bash
docker compose up -d                 # PostgreSQL 16 in Docker (port 5433)

cd backend
cp .env.example .env.local           # first time only
npm install
npm run seed                         # demo data (optional, safe to re-run)
npm run photos                       # real food photos from Wikimedia Commons (optional)
npm run dev                          # API on http://localhost:4000

cd ../frontend                       # in a second terminal
cp .env.example .env.local           # first time only (set DEMO_MODE=true for the demo panel)
npm install
npm run dev                          # site on http://localhost:3000
```

Or run everything in Docker: `docker compose --profile app up -d --build` → http://localhost:3000

## Code map

**backend/**
- `src/index.ts`, `src/app.ts` — server start-up and route mounting
- `src/routes/` — the API, one file per area: `auth` (sign-in, account), `public` (home, restaurant menus),
  `customer` (cart check, orders, payments, cancellation), `owner` (restaurant registration),
  `admin` (restaurant dashboard), `super` (platform admin), `files` (images, UPI/menu QR), `google` (Google sign-in)
- `src/db.ts` (schema + queries), `src/auth.ts` (sessions, roles), `src/restaurant.ts` (activation rules),
  `src/menu.ts`, `src/files.ts` (images in Postgres), `src/mail.ts`, `src/http.ts` (errors/responses)
- `scripts/` — `seed.ts`, `photos.ts`, `e2e.mjs` (end-to-end tests)

**frontend/**
- `app/` — pages (`page.tsx` home, `r/[slug]` menu + checkout, `orders`, `login`…, `admin/*`, `super/*`)
- `app/actions/` — form handlers; each one calls the API
- `app/api/[...path]` — proxy to the backend; `app/api/lang`, `app/api/health`
- `lib/api.ts` (API client), `lib/auth.ts` (current user via the API), `lib/i18n.ts` + `lib/hi/` (Hindi), `components/`

## API conventions
- JSON in, JSON out. Success: `{ "ok": true, "message"?: "...", ...data }`. Error: HTTP 4xx `{ "error": "...", "redirect"?: "/path" }`.
- Messages are English; the frontend translates them for Hindi.
- Auth: a signed session cookie (`session`), issued by `POST /api/auth/login` (also returned as `token`).
- Image uploads are `multipart/form-data`.

## Configuration
- `backend/.env.example` — `DATABASE_URL`, `SESSION_SECRET`, `SUPER_ADMIN_EMAIL/PASSWORD`, `BASE_URL` (public site address),
  feature switches `SETUP_FEE_ENABLED` and `EMAIL_VERIFICATION_ENABLED` (both off for now), optional Google sign-in.
- `frontend/.env.example` — `BACKEND_URL` (API address from the frontend server), `BASE_URL`, `DEMO_MODE`.

## Demo logins (after `npm run seed`)
With `DEMO_MODE=true` (frontend) the sign-in page shows a **Demo accounts** panel: click any account to sign in.
**Turn `DEMO_MODE` off in production.**

| Role | Email | Password |
|---|---|---|
| Super admin | super@example.com | ChangeMe123! |
| Restaurant admin (live) | owner@greenfork.demo, owner@spicegarden.demo, owner@lakeview.demo | Demo@1234 |
| Second admin, same restaurant | staff@greenfork.demo | Demo@1234 |
| Restaurant admin (deactivated) | owner@urbanbites.demo | Demo@1234 |
| Applicant: awaiting review | owner@royalbites.demo, owner@tandoori.demo | Demo@1234 |
| Applicant: approved, setting up | owner@pizzapalace.demo | Demo@1234 |
| Applicant: returned for corrections | owner@cloudkitchen.demo | Demo@1234 |
| Applicant: rejected | owner@saffron.demo | Demo@1234 |
| Applicant: draft | owner@newbistro.demo | Demo@1234 |
| Customers | rohan@demo.com, meera@demo.com, karan@demo.com, ayesha@demo.com, vikram@demo.com, sneha@demo.com, arjun@demo.com, fatima@demo.com | Demo@1234 |

## Tests
End-to-end (drives the real site through the frontend and checks the database):
```bash
cd frontend && npm run build && npx next start -p 3100     # with the backend running on :4000
cd backend  && BASE=http://localhost:3100 npm run e2e
```
Re-seed afterwards; the tests change data.

Emails are stored in the database and shown at `/super/emails` (connect a real provider in `backend/src/mail.ts`).
Uploaded images are stored in the database by default. Set `S3_BUCKET` and the `AWS_*` variables on the backend
to store new images in an S3-compatible bucket instead (images are still served through `/api/img/…`, so the bucket can stay private).

## Deploying
See [DEPLOY.md](DEPLOY.md).
