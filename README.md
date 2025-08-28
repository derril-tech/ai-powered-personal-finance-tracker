# AI-Powered Personal Finance Tracker

A secure, multi-tenant personal finance platform for households and organizations. It unifies financial accounts, auto-categorizes transactions, detects recurring bills, builds budgets and goals, forecasts cashflow, flags anomalies, and generates monthly reports and exports.

## What it is
- A full-stack, AI-assisted Personal Finance Manager (PFM) built as a monorepo
- Backend: NestJS API gateway with PostgreSQL 16 + TimescaleDB + pgvector, Redis, NATS, S3
- Frontend: Next.js 14 with PrimeReact + Tailwind, WS/SSE for realtime
- Workers: Python services for ETL, enrichment, forecasting, anomalies, reports

## What it does (key features)
- Accounts & Imports: Connect providers (Plaid/Tink/TrueLayer) and import CSV/OFX/QIF/MT940/PDF
- Categorization: Rules + ML classifier (confidence + explanations); per-user overrides
- Subscriptions & Bills: Detect cadence, next due, price hikes/missed payments
- Budgets & Goals: Envelope/zero-based budgets, safe-to-spend; goal suggestions and what-ifs
- Forecasts: SARIMAX/Prophet cashflow/category forecasts with p50/p90 bands and holiday effects
- Anomalies: Residual z-scores + Isolation Forest with reason text and verdict feedback
- Rules Engine: JSON expression builder; preview and retroactive apply
- Alerts: Budget breach, low balance, upcoming bill, anomaly; email/push/webhook; snooze/dedupe
- Reports & Exports: Monthly PDF/XLSX/CSV, JSON bundles with signed URLs
- Security & Compliance: RLS tenant isolation, KMS-encrypted tokens, strict CSP/HSTS
- Observability: OpenTelemetry traces/metrics, Grafana dashboards, Sentry error tracking
- Billing & Usage: Plans, add-ons, usage metering, payment methods

## Why it matters (future potential)
- Autonomous Finance Coach: Personalized nudges, savings opportunities, and anomaly explanations
- Bill Intelligence: Negotiation suggestions, provider switching recommendations
- Scenario Planning: Multi-goal forecasts, stress tests, and macro sensitivity
- Marketplace & Integrations: Connect tax, lending, and investing partners via secure APIs
- Continuous Learning: On-device privacy-preserving models and federated improvements

---

## Monorepo Layout
```
apps/
  frontend/           # Next.js app (PrimeReact, Tailwind)
  api/                # NestJS API (OpenAPI, RBAC, RLS, rate limits)
services/
  workers/            # Python workers (etl, fx, merchant, categorize, recurring, forecast, anomaly, report, alert)
infra/
  grafana/            # Dashboards
  terraform/          # S3 prefix isolation, etc.
  tests/              # Load (k6) and chaos docs
packages/
  shared/             # Shared libs/types (if any)
```

## Quick Start (Windows PowerShell)
Prereqs: Docker, Node 20, npm, (optional) k6 for load tests.

```powershell
cd C:\Users\User\Documents\Projects\ai-powered-personal-finance-tracker
# Start deps
docker run --name timescaledb -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d timescale/timescaledb:2.14.2-pg16
docker run --name redis -p 6379:6379 -d redis:7-alpine

# Env
$env:DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/postgres'
$env:REDIS_URL = 'redis://localhost:6379'

# Install
npm ci

# Seed demo data
npx ts-node apps/api/scripts/seed-demo.ts

# Run API (new terminal recommended)
npm run -w apps/api start

# Run Frontend (new terminal)
npm run -w apps/frontend dev
```

Open the frontend at http://localhost:3000 and sign in/register (local dev) to explore. Use the Billing, Imports, Forecasts, Alerts, Reports, and Rules pages.

## Configuration
Create a `.env` for local overrides (and `.env.example` for sharing defaults):
- API: `DATABASE_URL`, `DATABASE_SSL`, `REDIS_URL`, `NODE_ENV`
- Security: `AWS_REGION`, `AWS_KMS_KEY_ID`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- Storage: `S3_BUCKET_NAME`
- Telemetry: `OTEL_EXPORTER_OTLP_ENDPOINT`, `SENTRY_DSN`
- Frontend: `NEXT_PUBLIC_API_URL` (if API served separately)

All HTTP clients set timeouts and minimal retries; secrets are never logged.

## Scripts
- Lint/Typecheck/Build
  - `npm run -w apps/api lint|typecheck|build`
  - `npm run -w apps/frontend lint|typecheck|build`
- Tests (API)
  - `npm run -w apps/api test`
- E2E (Frontend)
  - `npx playwright install`
  - `npx playwright test -c apps/frontend/playwright.config.ts`
- Load (optional)
  - `k6 run infra/tests/k6/import_burst.js`

## CI/CD
- GitHub Actions CI: lint, typecheck, unit/integration, build, Docker build + Trivy scan
- GitHub Actions CD: environment-gated workflow with blue/green deploy placeholders and migration approval step

## Observability
- OpenTelemetry spans/metrics across API, workers, Redis, Postgres
- Grafana dashboards under `infra/grafana/dashboards`
- Sentry for error tracking and performance profiling

## Security & Privacy
- PostgreSQL Row-Level Security (RLS) for tenant isolation
- KMS encryption for connector tokens and secrets; S3 signed URLs
- Strict CSP/HSTS; rate limiting; idempotency keys and request IDs

## Roadmap
- Rich AI advisor, scenario planning, and automated insights
- Expanded connectors and institution coverage
- Mobile-first progressive web app with offline snapshots
- Enterprise SSO and advanced role management

## Contributing
- Conventional commits, small PRs, tests for changes
- Keep docs in sync: update `PLAN.md`, `TODO.md`, `DONE.md`, `DECISIONS.log`, `ARCH.md`

## License
See `LICENSE`.
