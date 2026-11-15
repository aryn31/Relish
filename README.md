# Relish — Enterprise Multi-Restaurant Digital Ordering Platform

[![Node.js](https://img.shields.io/badge/Node.js-22_LTS-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15_(App_Router)-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x_|_7.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-5.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![CI](https://img.shields.io/badge/CI-GitHub_Actions-2088FF?logo=github-actions&logoColor=white)](.github/workflows/ci.yml)

Relish is a production-grade, multi-tenant digital ordering and restaurant management platform. Built to support contactless table-side dine-in operations, dynamic QR menus, kitchen order management, restaurant partner onboarding, and central platform governance, it is architected with a decoupled frontend and backend adhering to enterprise-tier security, strict data consistency, and zero-CORS reverse-proxy topology.

---

## Table of Contents

- [System Architecture](#system-architecture)
  - [Architectural Topology](#architectural-topology)
  - [Design Rationale: Single-Origin BFF Pattern](#design-rationale-single-origin-bff-pattern)
- [Core Platform Capabilities](#core-platform-capabilities)
  - [Customer Dine-In & Ordering Pipeline](#1-customer-dine-in--ordering-pipeline)
  - [Restaurant Partner Operations](#2-restaurant-partner-operations)
  - [Super-Admin Governance & Auditing](#3-super-admin-governance--auditing)
  - [Internationalization (i18n)](#4-internationalization-i18n)
- [Repository & Service Layout](#repository--service-layout)
- [Technology Stack](#technology-stack)
- [Security Architecture](#security-architecture)
- [Data Layer & Storage Architecture](#data-layer--storage-architecture)
  - [Relational Schema & Concurrency](#relational-schema--concurrency)
  - [Hybrid Asset Storage Engine](#hybrid-asset-storage-engine)
- [Local Development Setup](#local-development-setup)
  - [Prerequisites](#prerequisites)
  - [Option A: Hybrid Dev Mode (Recommended)](#option-a-hybrid-dev-mode-recommended)
  - [Option B: Fully Containerized Stack](#option-b-fully-containerized-stack)
- [Database Seeding & Test Fixtures](#database-seeding--test-fixtures)
  - [Seeding & Wikimedia Photo Hydration](#seeding--wikimedia-photo-hydration)
  - [Clean Unseeding](#clean-unseeding)
  - [Pre-Configured Demo Credentials](#pre-configured-demo-credentials)
- [Configuration Reference](#configuration-reference)
  - [Backend Environment Variables (`backend/.env.local`)](#backend-environment-variables-backendenvlocal)
  - [Frontend Environment Variables (`frontend/.env.local`)](#frontend-environment-variables-frontendenvlocal)
- [Testing & Quality Assurance](#testing--quality-assurance)
  - [Static Analysis](#static-analysis)
  - [End-to-End Regression Suite](#end-to-end-regression-suite)
  - [Continuous Integration Pipeline](#continuous-integration-pipeline)
- [Production Deployment & Runbook](#production-deployment--runbook)
  - [Deployment Topologies](#deployment-topologies)
  - [Observability & Health Checks](#observability--health-checks)
  - [Database Backups & Disaster Recovery](#database-backups--disaster-recovery)
  - [Production Readiness Checklist](#production-readiness-checklist)
- [API Design Standards](#api-design-standards)

---

## System Architecture

The platform is designed around a **Backend-for-Frontend (BFF) / Reverse-Proxy Architecture**. The browser interfaces exclusively with the Next.js frontend runtime, which acts as the unified origin, server-side renderer, and API proxy.

### Architectural Topology

```
                                  PUBLIC INTERNET
                                         │
                                         ▼ HTTPS / Port 443
                     ┌───────────────────────────────────────┐
                     │          Next.js 15 Frontend          │
                     │          (Port 3000 / Edge)           │
                     │  - React 19 Server Components         │
                     │  - Server Actions (RPC & Form Handlers)│
                     │  - Reverse Proxy: /api/*              │
                     └───────────────────┬───────────────────┘
                                         │
                             PRIVATE NETWORK / INTERNAL
                                         │
                                         ▼ HTTP / Port 4000
                     ┌───────────────────────────────────────┐
                     │          Express 5 REST API           │
                     │          (Port 4000 / Internal)       │
                     │  - Business Domain Rules & RBAC       │
                     │  - Transactional Consistency Engine   │
                     │  - Magic-Byte Media Ingestion         │
                     └──────────────┬─────────────────┬──────┘
                                    │                 │
                SQL Connections     ▼                 ▼   S3 API (Optional)
                     ┌──────────────────────┐  ┌──────────────────────┐
                     │    PostgreSQL 16     │  │ S3-Compatible Object │
                     │  - Advisory Locks    │  │ Storage (R2/S3/Neon) │
                     │  - Check Constraints │  │ (Private Ingress)    │
                     │  - Bytea Fallback    │  └──────────────────────┘
                     └──────────────────────┘
```

### Design Rationale: Single-Origin BFF Pattern

1. **Elimination of Cross-Origin Resource Sharing (CORS)**: Because client browsers only communicate with the Next.js host, complex CORS headers, preflight `OPTIONS` requests, and cross-domain security leakage are completely eliminated.
2. **Unified Cookie Boundary**: Cryptographically signed session tokens reside in `HttpOnly`, `SameSite=Lax` cookies scoped strictly to the primary domain. No credentials or JWTs are accessible via client-side JavaScript (`document.cookie`), mitigating Cross-Site Scripting (XSS) token extraction.
3. **Zero Public Attack Surface for the REST API**: The Express API server operates in a private network (e.g., Railway private networking, internal Docker bridge, or VPC). It requires no public IP address or internet gateway, isolating core business logic from direct public exposure.
4. **Optimized Server-to-Server Latency**: Server Actions and Server Components query the API over high-throughput private backplanes, enabling fast server-side HTML streaming to users.

---

## Core Platform Capabilities

### 1. Customer Dine-In & Ordering Pipeline

- **Contactless Table-Side Experience**: Scannable per-table QR codes encode absolute table-specific URLs, automatically setting dine-in context for customers.
- **Dynamic Catalog Discovery**: Category browsing, real-time item availability indicators, dietary classification (Vegetarian / Non-Vegetarian), and multi-portion variant selectors.
- **Cart Revalidation Engine (`/api/cart/check`)**: Synchronous pre-checkout validation verifying real-time restaurant open status, portion availability, active table statuses, and server-authoritative price totals.
- **Tamper-Resistant Idempotent Checkout**:
  - Orders accept client-side `expectedPrice` parameters verified inside an atomic database transaction. Any price mismatch caused by stale client tabs or manipulated payloads triggers an immediate rollback.
  - Client-generated idempotency keys (`idem_key`) prevent duplicate orders or double-billing on network retries.
- **Dual Payment Orchestration**:
  - **UPI Payments**: Interactive display of restaurant-specific UPI QR codes with a customer "Claim Paid" workflow.
  - **Cash Payments**: Direct cash-at-table settlement flag.
- **Order Lifecycle & Self-Service Cancellation**: Real-time order tracking (`pending` → `completed` / `cancelled`) with preparation time estimates (`prep_minutes`). Customers can submit structured cancellation requests prior to kitchen dispatch, managed via a database-enforced single open request rule.

### 2. Restaurant Partner Operations

- **Automated 6-Stage Activation Engine (PRD 5.4)**:
  A pending restaurant is blocked from public visibility until all operational conditions pass:
  1. Super-Admin application approval (`approved`).
  2. Setup fee confirmation (`confirmed`, toggleable via `SETUP_FEE_ENABLED`).
  3. Valid merchant UPI QR asset uploaded.
  4. Active menu structure (at least one category and one available portion-priced item).
  5. Active seating configuration (at least one active table).
  6. Owner verification and confirmation of business details.
- **Kitchen Display & Order Management**: Real-time order dispatch dashboard with kitchen preparation timer assignments, payment settlement toggles, cancellation request approvals/rejections, and order fulfillment controls.
- **Table Management & Auditability**: Dynamic table creation, table-level QR generation, and seating relocations tracked via immutable audit logs (`table_moves`).
- **Menu Catalog Engineering**: Hierarchical category reordering, multi-portion pricing (stored strictly in integer paise), availability toggles, and asset uploads.
- **Secondary Administrator Delegation**: Ability for restaurant owners to provision secondary staff administrators with scoped permissions.

### 3. Super-Admin Governance & Auditing

- **Partner Application Vetting**: Review incoming restaurant applications, inspect compliance credentials (FSSAI license numbers, GSTIN identifiers, normalized phone contacts), and issue decisions: Approve, Reject, or Return with feedback notes.
- **Operational Kill-Switch**: Immediate platform-wide restaurant activation or deactivation requiring an explicit operational justification (`inactive_reason`).
- **Comprehensive Audit Trail (`oplog`)**: Immutable record capturing actor identity, timestamp, action type, and JSON metadata across all administrative mutations.
- **Outbox Email Audit Trail (`emails`)**: Database-backed transactional email log tracking outbound customer and partner notices (verification links, password resets, onboarding approvals).
- **Runtime Feature Flags**: Dynamic control over mandatory onboarding setup fees and email verification workflows.

### 4. Internationalization (i18n)

- Complete bilingual localization (**English** and **Hindi - हिंदी**) spanning public storefronts, customer checkouts, restaurant partner portals, and administrative views.
- Cookie-persisted locale selection (`NEXT_LOCALE`) with automated fallbacks and zero layout shift.

---

## Repository & Service Layout

```
.
├── backend/                       # REST API & Business Logic Layer (Express 5 + TypeScript)
│   ├── src/
│   │   ├── routes/                # Modular route controllers
│   │   │   ├── admin.ts           # Restaurant manager dashboard API (/api/admin/*)
│   │   │   ├── auth.ts            # Authentication, session issuance, tokens (/api/auth/*)
│   │   │   ├── customer.ts        # Cart verification & idempotent orders (/api/cart/*, /api/orders/*)
│   │   │   ├── files.ts           # Media serving & upload endpoints (/api/img/*, /api/upload)
│   │   │   ├── google.ts          # OAuth2 Google sign-in integration (/api/google)
│   │   │   ├── owner.ts           # Partner registration lifecycle (/api/owner/*)
│   │   │   ├── public.ts          # Storefront discovery & catalog APIs (/api/public/*)
│   │   │   └── super.ts           # Platform governance & audit APIs (/api/super/*)
│   │   ├── app.ts                 # Express application assembly & middleware pipeline
│   │   ├── auth.ts                # JWT cryptography, session cookies, RBAC guards
│   │   ├── db.ts                  # PostgreSQL connection pool, migrations, AsyncLocalStorage
│   │   ├── files.ts               # Hybrid blob engine: PostgreSQL bytea & S3 driver
│   │   ├── http.ts                # HTTP response envelopes, custom error handling, IP sniffing
│   │   ├── index.ts               # Process entrypoint & graceful shutdown handlers
│   │   ├── mail.ts                # Outbox notification pipeline
│   │   ├── menu.ts                # Menu composition & formatting domain service
│   │   ├── restaurant.ts          # State engine, checklist verification, activation logic
│   │   └── upload.ts              # Multer memory storage configuration
│   ├── scripts/
│   │   ├── e2e.mjs                # Integration & regression test suite
│   │   ├── photos.ts              # Wikimedia Commons asset hydration script
│   │   ├── seed.ts                # Database fixture seeder (idempotent)
│   │   └── unseed.ts              # Fixture tear-down script (supports dry-run)
│   ├── Dockerfile                 # Multi-stage production container build
│   └── package.json
│
├── frontend/                      # Web UI Layer (Next.js 15 App Router + React 19)
│   ├── app/                       # App Router routes and page definitions
│   │   ├── actions/               # Server Actions for form handling and API dispatch
│   │   ├── admin/                 # Restaurant management portal
│   │   ├── api/                   # Reverse proxy handler (/api/[...path])
│   │   ├── orders/                # Customer order tracking views
│   │   ├── r/[slug]/              # Public restaurant storefront & checkout
│   │   ├── super/                 # Super-Admin platform dashboard
│   │   ├── layout.tsx             # Root application shell
│   │   └── page.tsx               # Marketplace discovery homepage
│   ├── components/                # Reusable UI component library
│   ├── lib/                       # API client, session helpers, cart state, i18n dictionaries
│   │   ├── api.ts                 # Typed fetch client communicating with backend
│   │   ├── auth.ts                # Server-side identity resolution
│   │   └── i18n.ts                # Translation loader & English/Hindi string maps
│   ├── Dockerfile                 # Production standalone Next.js container build
│   └── package.json
│
├── .github/
│   └── workflows/
│       └── ci.yml                 # Automated CI: Typecheck, Build, E2E Test, Container Build
├── docker-compose.yml             # Orchestration for local development and full-stack deploy
└── DEPLOY.md                      # Production deployment guides (Railway, Render, VPS)
```

---

## Technology Stack

| Layer | Technology | Architectural Rationale |
|---|---|---|
| **Frontend Framework** | **Next.js 15 (App Router)** | Hybrid SSR and Server Components for optimal SEO, low client bundle size, and fast initial paint. |
| **Frontend Library** | **React 19** | Modern React primitives with native Server Actions and progressive form enhancement. |
| **Backend Framework** | **Express 5** | High-throughput, low-overhead HTTP middleware pipeline with native Promise error handling. |
| **Language & Tooling** | **TypeScript 5.x / 7.x** | End-to-end static typing across domain models, API payloads, and database queries. |
| **Primary Database** | **PostgreSQL 16** | ACID-compliant relational engine utilizing connection pooling, advisory locks, and check constraints. |
| **Session Security** | **jose (HS256 JWT)** | Standards-compliant, lightweight cryptographic signing for stateless HttpOnly cookies. |
| **Password Hashing** | **bcryptjs** | Salted cryptographic password hashing with configurable complexity rounds. |
| **Blob / Asset Storage** | **Hybrid (Postgres Bytea / AWS S3 SDK v3)** | Zero-dependency deployment storing media in PostgreSQL by default, with transparent S3 uplift. |
| **Containerization** | **Docker & Compose** | Reproducible builds with multi-stage Dockerfiles matching cloud deployment targets. |

---

## Security Architecture

1. **Stateless Versioned Sessions**:
   - Authentication tokens are signed using JSON Web Signatures (HS256) via `jose`.
   - Instead of storing volatile session state in Redis or querying a token table on every request, tokens encapsulate a `session_version` attribute.
   - Incrementing a user's `session_version` in the database immediately and globally invalidates all active sessions across all devices without maintaining distributed token blacklists.
2. **Strict Role-Based Access Control (RBAC)**:
   - Dedicated middleware guards enforce access boundaries:
     - `requireUser`: Ensures an authenticated caller.
     - `requireRestAdmin`: Asserts `role === 'restaurant_admin'` and scopes data mutations strictly to the admin's assigned `restaurant_id`.
     - `requireSuper`: Restricts access to global administrative primitives.
3. **Defense-in-Depth Checkout Security**:
   - Price verification occurs strictly server-side inside transactional boundaries. Client carts cannot manipulate unit prices.
   - Integer paise representation eliminates IEEE 754 floating-point rounding errors in currency calculations.
4. **Binary Upload Sanitization**:
   - File uploads are validated via binary **magic-byte sniffing** (`sniff()`) rather than trusting user-supplied `Content-Type` headers or file extensions.
   - Enforces a 5MB payload ceiling and restricts types strictly to JPEG, PNG, and WebP.
5. **Infrastructure Hardening**:
   - HTTP response header protection disables `X-Powered-By`.
   - Upstream proxy trust enabled (`trust proxy: true`) for accurate client IP identification in rate-limiting pipelines.

---

## Data Layer & Storage Architecture

### Relational Schema & Concurrency

The system leverages PostgreSQL 16 features to guarantee data integrity under high concurrent loads:

- **Distributed Migration Lock**: During service startup, table creation and index validation execute behind a PostgreSQL advisory lock (`SELECT pg_advisory_lock(727001)`), ensuring safe, zero-race schema initialization across clustered replicas.
- **Idempotency Constraints**: The `orders` table enforces a composite uniqueness constraint on `(idem_key)` to guarantee that identical customer request retries return the original order record without re-execution.
- **Order Sequencing**: Restaurant orders utilize isolated auto-incrementing sequential numbers (`order_seq`) partitioned per restaurant, guaranteeing clean order numbers for kitchen tickets.
- **Partial Unique Indexes**: The cancellation subsystem employs a partial index (`CREATE UNIQUE INDEX one_open_cancel ON cancel_requests(order_id) WHERE status='requested'`) to strictly prohibit multiple open cancellation requests per order.
- **Transactional Context Propagation**: Transaction scopes leverage Node.js `AsyncLocalStorage` (`als`), allowing nested repository calls to bind to an active transaction client without manual dependency passing.

### Hybrid Asset Storage Engine

Relish implements a dual-mode storage subsystem (`backend/src/files.ts`):

1. **Embedded Database Storage (Default)**:
   - Uploaded media (food photos, UPI QR codes) are stored directly inside the PostgreSQL `files` table as binary blobs (`BYTEA`).
   - Enables zero-configuration deployments: database backups (`pg_dump`) automatically preserve all uploaded assets with zero external storage dependencies.
2. **Cloud Object Storage (Production Uplift)**:
   - Setting `S3_BUCKET` transparently redirects all new uploads to any S3-compatible storage tier (AWS S3, Cloudflare R2, MinIO, or Neon Object Storage).
   - Read operations automatically check PostgreSQL first, then fall back to S3, ensuring seamless zero-downtime migrations.
   - Storage buckets remain strictly private; all assets are served through authenticated streaming proxy endpoints (`/api/img/:name`).

---

## Local Development Setup

### Prerequisites

- **Node.js**: `v22.0.0` or higher (LTS recommended)
- **npm**: `v10.0.0` or higher
- **Docker & Docker Compose**: Engine 24.x+

### Option A: Hybrid Dev Mode (Recommended)

Run PostgreSQL in a container while executing the backend and frontend locally for instant live-reloading.

#### 1. Start the PostgreSQL Container

```bash
docker compose up -d
```
*Spins up PostgreSQL 16 on `localhost:5433` with data volume persistence (`relish-data`).*

#### 2. Configure & Start the Backend Service

```bash
cd backend
cp .env.example .env.local
npm install
npm run seed              # Seed database with baseline fixtures and demo accounts
npm run photos            # (Optional) Hydrate real food photos from Wikimedia Commons
npm run dev               # Starts API on http://localhost:4000 (with tsx watch)
```

#### 3. Configure & Start the Frontend Service

In a separate terminal:

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev               # Starts Next.js application on http://localhost:3000
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

### Option B: Fully Containerized Stack

To execute the entire multi-service stack inside Docker:

```bash
docker compose --profile app up -d --build
```

- Accessible at [http://localhost:3000](http://localhost:3000).
- Health check endpoint: [http://localhost:3000/api/health](http://localhost:3000/api/health).

---

## Database Seeding & Test Fixtures

### Seeding & Wikimedia Photo Hydration

The repository includes idempotent seeding utilities:

```bash
# Seed standard accounts, test restaurants, menus, portions, and tables
npm run seed --prefix backend

# Download high-resolution food assets from Wikimedia Commons
npm run photos --prefix backend
```

### Clean Unseeding

To safely remove test fixtures while preserving genuine restaurant and order records:

```bash
# Dry run: previews records marked for deletion
npm run unseed --prefix backend

# Execute deletion
npm run unseed --prefix backend -- --yes
```

### Pre-Configured Demo Credentials

When `DEMO_MODE=true` is set on the frontend, a quick-login drawer is available on the sign-in page (`/login`). In all environments, seeded accounts use the credentials below:

| Persona / Role | Email | Password | Operational State / Context |
|---|---|---|---|
| **Super Admin** | `super@example.com` | `ChangeMe123!` | Platform Owner with full governance permissions |
| **Restaurant Admin** | `owner@greenfork.demo` | `Demo@1234` | The Green Fork (Active restaurant, live menu) |
| **Restaurant Admin** | `owner@spicegarden.demo` | `Demo@1234` | Spice Garden (Active restaurant, live menu) |
| **Restaurant Admin** | `owner@lakeview.demo` | `Demo@1234` | Lakeview Bistro (Active restaurant, live menu) |
| **Secondary Admin** | `staff@greenfork.demo` | `Demo@1234` | The Green Fork (Staff administrator) |
| **Restaurant Admin** | `owner@urbanbites.demo` | `Demo@1234` | Urban Bites (**Deactivated** state with audit note) |
| **Applicant** | `owner@royalbites.demo` | `Demo@1234` | Royal Bites (**Submitted**, awaiting review) |
| **Applicant** | `owner@pizzapalace.demo` | `Demo@1234` | Pizza Palace (**Approved**, completing checklist) |
| **Applicant** | `owner@cloudkitchen.demo` | `Demo@1234` | Cloud Kitchen (**Returned** for corrections) |
| **Applicant** | `owner@saffron.demo` | `Demo@1234` | Saffron Grill (**Rejected** state) |
| **Applicant** | `owner@newbistro.demo` | `Demo@1234` | New Bistro (**Draft** application state) |
| **Customers** | `rohan@demo.com`<br>`meera@demo.com`<br>`karan@demo.com` | `Demo@1234` | Verified customer accounts with order history |

---

## Configuration Reference

### Backend Environment Variables (`backend/.env.local`)

| Variable | Type | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | String | `postgres://relish:relish@localhost:5433/relish` | PostgreSQL connection string |
| `DATABASE_SSL` | Boolean | `false` | Enable TLS for managed databases (Neon, RDS, Supabase) |
| `DATABASE_POOL_MAX` | Number | `10` | Maximum connections in PostgreSQL pool |
| `SESSION_SECRET` | String | `change-me` | Secret key used for signing HS256 JWT session tokens |
| `SUPER_ADMIN_EMAIL` | String | `admin@yourdomain.com` | Seeded super admin account email |
| `SUPER_ADMIN_PASSWORD` | String | `change-me-strong-password` | Seeded super admin account password |
| `BASE_URL` | String | `http://localhost:3000` | Canonical public URL of the frontend (used for QR generation and emails) |
| `PORT` | Number | `4000` | HTTP listening port for Express API |
| `SETUP_FEE_ENABLED` | Boolean | `false` | Enforce platform setup fee during partner activation |
| `EMAIL_VERIFICATION_ENABLED` | Boolean | `false` | Require email verification token prior to partner activation |
| `S3_BUCKET` | String | *Optional* | Target S3 bucket name. When omitted, images store in Postgres `files` |
| `AWS_ENDPOINT_URL_S3` | String | *Optional* | Custom S3 endpoint URL (for Cloudflare R2, MinIO, or Neon) |
| `AWS_ACCESS_KEY_ID` | String | *Optional* | S3 API credentials access key ID |
| `AWS_SECRET_ACCESS_KEY` | String | *Optional* | S3 API credentials secret access key |
| `AWS_REGION` | String | `us-east-1` | S3 bucket region |
| `S3_FORCE_PATH_STYLE` | Boolean | *Auto* | Force path-style bucket URLs (`true` for MinIO/R2) |
| `GOOGLE_CLIENT_ID` | String | *Optional* | Google OAuth Client ID for customer SSO |
| `GOOGLE_CLIENT_SECRET` | String | *Optional* | Google OAuth Client Secret |

### Frontend Environment Variables (`frontend/.env.local`)

| Variable | Type | Default | Description |
|---|---|---|---|
| `BACKEND_URL` | String | `http://localhost:4000` | Internal backend address reachable from Next.js server |
| `BASE_URL` | String | `http://localhost:3000` | Public URL of this site (embedded in table QR codes) |
| `DEMO_MODE` | Boolean | `false` | Enables one-click demo credentials drawer on `/login`. **Must be `false` in production.** |

---

## Testing & Quality Assurance

### Static Analysis

Both services enforce strict TypeScript compilation with zero-emit checks:

```bash
# Typecheck backend
npm run typecheck --prefix backend

# Typecheck frontend
npm run typecheck --prefix frontend
```

### End-to-End Regression Suite

The platform includes an automated integration suite (`backend/scripts/e2e.mjs`) that exercises live HTTP endpoints, Next.js Server Action RPCs, form submissions, and database constraints:

```bash
# 1. Build frontend standalone assets
npm run build --prefix frontend

# 2. Launch production Next.js instance on test port 3100
npx next start frontend -p 3100 &

# 3. Execute test suite against live backend (:4000) and frontend (:3100)
cd backend && BASE=http://localhost:3100 npm run e2e
```

**Validated Test Scenarios:**
- Customer authentication and bad credential rejections.
- Cart revalidation against server pricing and portion availability.
- Order placement with server price tampering detection (tampered prices rejected).
- Idempotent submission verification (duplicate `idem_key` returns existing order).
- Table selection validation.
- Customer order cancellation requests.
- Restaurant admin menu creation, category ordering, and portion price updates.
- Super-admin review workflows, state transitions, and audit logs.

### Continuous Integration Pipeline

The repository includes a GitHub Actions workflow (`.github/workflows/ci.yml`) triggered on every push and pull request. It spins up an ephemeral PostgreSQL 16 container, runs static type-checking across both workspaces, seeds the database, builds Next.js assets, builds Docker images, and executes the complete E2E test harness.

---

## Production Deployment & Runbook

For exhaustive hosting guides across specific cloud providers, refer to [DEPLOY.md](DEPLOY.md).

### Deployment Topologies

1. **PaaS (Railway / Render)**:
   - Deploy `backend/` as an internal/private service.
   - Deploy `frontend/` as a public web service with domain assignment.
   - Provision managed PostgreSQL 16 instance.
   - Set `BACKEND_URL` on the frontend to point to the private network DNS of the backend.
2. **Self-Hosted VPS (Docker Compose + Caddy)**:
   - Execute `docker compose --profile app up -d --build`.
   - Place a reverse proxy (e.g., Caddy or Nginx) in front of port `3000` to handle SSL/TLS termination.
3. **Decoupled Edge (Vercel + Managed Backend)**:
   - Host `frontend/` on Vercel.
   - Host `backend/` on any container runtime with public HTTPS, configuring `BACKEND_URL` accordingly.

### Observability & Health Checks

The platform exposes an integrated health probe:

- **Endpoint**: `GET /api/health`
- **Behavior**: Verifies that the Next.js runtime is responding, the backend service is reachable, and the PostgreSQL pool is active (`SELECT 1`).
- **Response**: `{"ok": true, "backend": true}` (HTTP 200) or HTTP 503 on database disruption.

### Database Backups & Disaster Recovery

Because uploaded media is preserved inside PostgreSQL by default, a standard PostgreSQL dump constitutes a complete system snapshot:

```bash
# Create complete backup (schema, data, and binary assets)
pg_dump "$DATABASE_URL" > relish-backup-$(date +%F).sql

# Restore snapshot
psql "$DATABASE_URL" < relish-backup-YYYY-MM-DD.sql
```

### Production Readiness Checklist

Before onboarding active merchants:
- [ ] Set `DEMO_MODE=false` in frontend production environment variables.
- [ ] Generate a secure 64-character session secret (`openssl rand -base64 48`).
- [ ] Update `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` to enterprise-managed credentials.
- [ ] Verify `BASE_URL` matches the final custom domain without a trailing slash (critical for printed table QR codes).
- [ ] Connect a production SMTP/transactional email provider in `backend/src/mail.ts`.
- [ ] Verify SSL enforcement (`DATABASE_SSL=true`) when connecting to remote managed databases.

---

## API Design Standards

The backend conforms to a standardized JSON envelope contract across all routes:

### Success Envelope
```json
{
  "ok": true,
  "message": "Operation completed successfully.",
  "data": {}
}
```

### Error Envelope
```json
{
  "error": "Human-readable error description.",
  "redirect": "/optional-client-redirect-path"
}
```

### API Namespace Taxonomy

| Prefix | Target Audience | Authentication / Authorization Guard |
|---|---|---|
| `/api/public/*` | Unauthenticated public | Public access (active restaurants only) |
| `/api/restaurants/*` | Unauthenticated public | Public access (active restaurants only) |
| `/api/auth/*` | All users | Session management & credential validation |
| `/api/cart/*` | Customer | Revalidation engine for active sessions |
| `/api/orders/*` | Customer | Authenticated customer role (`requireUser`) |
| `/api/owner/*` | Partner applicants | Public onboarding & rate-limited registration |
| `/api/admin/*` | Restaurant staff & owners | Restaurant admin guard (`requireRestAdmin`) |
| `/api/super/*` | Platform operators | Super admin guard (`requireSuper`) |
| `/api/img/*` | Public / Cached | Asset delivery proxy (Postgres bytea / S3 streaming) |
