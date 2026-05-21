# SaaS Onboarding Platform

A production-ready multi-tenant SaaS onboarding system with a super-admin dashboard, automatic tenant/subdomain creation, WhatsApp conversational onboarding flow, customer-facing onboarding forms, analytics, and subscription management.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Frontend: React + Vite + Tailwind + shadcn/ui + TanStack Query + wouter

## Where things live

```
artifacts/api-server/src/
  routes/
    auth.ts               # POST /api/auth/login, /logout
    admin/
      tenants.ts          # CRUD /api/admin/tenants
      subscriptions.ts    # /api/admin/subscriptions, /api/admin/tenants/:id/subscriptions
      analytics.ts        # /api/admin/analytics, /api/admin/tenants/:id/analytics
      onboarding.ts       # /api/admin/tenants/:id/onboarding, /api/admin/onboarding/:id
    public.ts             # /api/public/tenants/:slug (+ onboarding submit)
    whatsapp.ts           # /api/whatsapp/webhook, /send, /sessions
  middlewares/auth.ts     # JWT requireAdmin middleware
  lib/slugify.ts          # Auto-generates unique URL slugs from tenant names

artifacts/dashboard/src/
  pages/
    login.tsx             # /login — password auth
    dashboard.tsx         # / — platform analytics overview
    tenants.tsx           # /tenants — list + create + delete
    tenant-detail.tsx     # /tenants/:id — tabs: overview, onboarding, subscriptions, analytics
    subscriptions.tsx     # /subscriptions — all subscriptions
    whatsapp.tsx          # /whatsapp — WhatsApp sessions + send message
    onboard.tsx           # /onboard/:slug — PUBLIC customer onboarding form
  components/layout.tsx   # Sidebar layout + AuthGuard

lib/db/src/schema.ts      # DB source of truth (tenants, subscriptions, onboarding_submissions,
                          #   whatsapp_sessions, whatsapp_messages, analytics_events)
lib/api-spec/             # OpenAPI spec (source of truth for API contract)
lib/api-zod/              # Generated Zod validation schemas
lib/api-client-react/     # Generated React Query hooks
```

## Architecture decisions

- **Contract-first API**: OpenAPI spec in `lib/api-spec` drives both Zod validation (server) and React Query hooks (client) via Orval codegen. Never write raw fetch calls in the frontend.
- **JWT auth via `SESSION_SECRET`**: Admin login uses plaintext password comparison against `ADMIN_PASSWORD` env var. JWT has 24h expiry. Frontend stores token in localStorage, wires it via `setAuthTokenGetter` from `@workspace/api-client-react`.
- **Auto slug/subdomain**: `uniqueSlug()` in `lib/slugify.ts` generates a URL-safe, collision-free slug from the tenant name. Subdomain = slug.
- **WhatsApp flow state machine**: Stored in `whatsapp_sessions.flow_step` (welcome → business_name → contact_name → email → phone → industry → notes → complete). Each incoming message advances the flow and auto-replies. Requires `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN` env vars.
- **Multi-tenant isolation**: All admin routes require JWT. Public routes (`/api/public/...`) are scoped by slug/tenant. WhatsApp sessions are associated to tenants via `whatsapp_phone_number_id`.

## Product

- **Super admin dashboard**: Login → analytics overview → tenant CRUD → per-tenant detail (subscriptions, onboarding submissions, analytics)
- **Tenant management**: Create tenants (auto-generates slug + subdomain), set plan (free/starter/pro/enterprise), manage status
- **Customer onboarding**: Shareable link at `/onboard/:slug` — customers fill a form, admin reviews/approves/rejects submissions from the dashboard
- **WhatsApp onboarding**: Webhook-based conversational flow that collects business info via WhatsApp messages and creates onboarding submissions
- **Subscriptions**: Create and manage billing subscriptions per tenant with monthly/yearly cycles

## User preferences

- Admin password is set via `ADMIN_PASSWORD` env var (currently "ReservaAI2026#")

## Gotchas

- Always run `pnpm --filter @workspace/api-spec run codegen` after changing the OpenAPI spec
- Always run `pnpm --filter @workspace/db run push` after changing `lib/db/src/schema.ts`
- WhatsApp webhook requires `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN` env vars — the server degrades gracefully without them (send returns `no_phone_number_id_configured` status)
- Drizzle: never chain two `.where()` calls — use `and()` from `drizzle-orm` instead

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
