# Deploying Relish

Relish is two services plus one PostgreSQL database:

| Service | Folder | Dockerfile | Public? |
|---|---|---|---|
| **frontend** (Next.js site) | `frontend/` | `frontend/Dockerfile` | **yes** — this is your website |
| **backend** (Express API) | `backend/` | `backend/Dockerfile` | no — only the frontend needs to reach it |
| **PostgreSQL 16** | — | — | no |

Images are stored in the database, so **no disk/volume is needed**. Tables and the super admin
are created automatically when the backend first starts.

The steps use **Railway** (simplest). Any host that runs Dockerfiles works the same way — see the end.

---

## 1. Push the code

```bash
cd ~/Desktop/restro-menu
git add -A
git commit -m "Split into frontend and backend"
git push
```

## 2. Railway project

In your Railway project (or **New Project → Deploy from GitHub repo**):

1. **Database:** *Create → Database → Add PostgreSQL* (skip if you already have one).
2. **Backend service:** *Create → GitHub Repo →* your repo. Then *Settings → Source → Root Directory* = `backend`.
3. **Frontend service:** add the same repo again, *Root Directory* = `frontend`.
   On the frontend: *Settings → Networking → Generate Domain* (this is your site address).

> If you deployed the old single-folder version before, change that existing service's Root Directory
> to `frontend`, then add a new service for `backend`.

## 3. Variables

**backend** (Variables → Raw Editor):
```
DATABASE_URL=${{Postgres.DATABASE_URL}}
SESSION_SECRET=<output of: openssl rand -base64 48>
SUPER_ADMIN_EMAIL=<your email>
SUPER_ADMIN_PASSWORD=<a strong password>
BASE_URL=https://<your-frontend-domain>
PORT=4000
SETUP_FEE_ENABLED=false
EMAIL_VERIFICATION_ENABLED=false
```

**frontend:**
```
BACKEND_URL=http://${{backend.RAILWAY_PRIVATE_DOMAIN}}:4000
BASE_URL=https://<your-frontend-domain>
DEMO_MODE=false
```

- `backend` in `${{backend.…}}` is the backend service's name in Railway — use your actual service name.
- `BACKEND_URL` uses Railway's private network, so the backend never needs a public address.
- `BASE_URL` (same value on both) is your public site address with no trailing slash. It goes into the
  table QR codes, so set it before printing any.

## 4. Check

- `https://<your-site>/api/health` → `{"ok":true,"backend":true}` (frontend, backend and database all up)
- Sign in at `/login` with `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD`.
- Optional: *Settings → Deploy → Healthcheck Path* = `/api/health` on both services.

## 5. Demo data (optional)

Postgres service → **Connect** → copy the **Public Network** URL, then on your computer:

```bash
cd ~/Desktop/restro-menu/backend
DATABASE_URL="<public url>" npm run seed
DATABASE_URL="<public url>" npm run photos
```

(Add `DATABASE_SSL=true` in front if your provider requires TLS.)

## Image bucket (optional)

By default images are stored in Postgres. To store new images in an S3-compatible bucket
(Neon storage, AWS S3, Cloudflare R2…), add these to the **backend**:
```
AWS_ENDPOINT_URL_S3=<bucket endpoint>
AWS_ACCESS_KEY_ID=<access key id>
AWS_SECRET_ACCESS_KEY=<secret access key>
AWS_REGION=<region>
S3_BUCKET=<bucket name>
```
Images already in the database keep working. The bucket can stay private, because the backend serves images itself.
With a bucket, back up both the database and the bucket.

## Updating later

`git push` — Railway rebuilds only the service whose folder changed.

## Own domain

Frontend service → *Settings → Networking → Custom Domain*; add the CNAME at your DNS provider;
then update `BASE_URL` on **both** services.

## Backups

Railway → Postgres → **Backups**, or manually: `pg_dump "<public url>" > relish-backup.sql`.
Images live in the database, so that file is a complete backup.

---

## Other hosts

- **Render:** create a PostgreSQL, a *Private Service* from `backend/` (Docker) and a *Web Service* from
  `frontend/` (Docker). Set `BACKEND_URL` to the backend's internal address (e.g. `http://relish-backend:4000`).
  For an external database URL also set `DATABASE_SSL=true` on the backend.
- **Your own server (VPS):** `docker compose --profile app up -d --build` runs Postgres, backend and frontend
  (see `docker-compose.yml`; set `SESSION_SECRET`, `SUPER_ADMIN_*`, `BASE_URL` in a `.env` file next to it),
  then put a reverse proxy with HTTPS (e.g. Caddy) in front of port 3000.
- **Vercel (frontend only):** the frontend can run on Vercel with the backend elsewhere; set `BACKEND_URL`
  to the backend's public HTTPS address.

## Before real restaurants use it

- Keep `DEMO_MODE=false`.
- Email is not connected: password-reset links and owner notices appear only at `/super/emails`.
  Connect a provider in `backend/src/mail.ts`.
- Add the real Terms of Service and Privacy Policy text.
