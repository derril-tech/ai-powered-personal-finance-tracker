# AI‑POWERED PERSONAL FINANCE TRACKER — END‑TO‑END PRODUCT BLUEPRINT

*(React 18 + Next.js 14 App Router; **PrimeReact** + Tailwind utilities for UI; TypeScript‑first contracts; Node/NestJS API gateway; Python 3.11 ML workers (pandas, scikit‑learn, statsmodels/Prophet, PyOD); Postgres 16 + TimescaleDB for time‑series + pgvector for merchant embeddings; Redis; NATS event bus; S3/R2 for statements/exports; optional ClickHouse for analytics; multi‑tenant (households) with seats; usage‑based add‑ons.)*

---

## 1) Product Description & Presentation

**One‑liner**
“Connect your accounts and get automatic categorization, forecasts, and anomaly alerts — so you always know what’s coming and where to save.”

**What it produces**

* **Unified ledger** across accounts with normalized merchants, categories, currencies, and recurring bills/subscriptions.
* **Budgets & goals** with envelope/zero‑based options and rollover rules.
* **Forecasts** of cashflow, category spend, and bill due dates; probability bands.
* **Anomaly/fraud alerts** on unusual transactions and drift vs budget.
* **Reports/exports**: monthly PDF, CSV/XLSX, tax‑friendly category views, and a JSON bundle of the ledger.

**Scope/Safety**

* Read‑only finance tool; no payments initiated.
* Explicit data‑sharing controls; PII minimized and encrypted.
* Models explain their decisions (transparent categorization and anomaly reasons).

---

## 2) Target User

* Individuals and households wanting proactive budgeting and fraud detection.
* Creators/freelancers with irregular income.
* Financial coaches and small firms running client dashboards (multi‑tenant workspaces).

---

## 3) Features & Functionalities (Extensive)

### Data Ingestion & Connectors

* **Bank/API connectors:** Plaid (US/CA/EU), **Tink** (EU/UK), **TrueLayer** (UK/EU), Finicity (US). OAuth‑like flows; webhooks for updates.
* **Manual imports:** CSV/QIF/OFX/MT940; email‑in receipts; PDF statement parsing with table extraction.
* **Exchange rates:** daily FX from ECB/OpenExchange; historical normalization.

### Normalization & Enrichment

* **Merchant resolver:** fuzzy match + pgvector embedding similarity to unify merchant names (e.g., “AMZN Mktp” → “Amazon”).
* **Category engine:** hybrid rules + ML classifier (one‑vs‑rest logistic/LightGBM) with per‑user fine‑tuning; confidence scores with explanations.
* **Recurring detector:** periodogram + heuristic (month/week cadence) to find subscriptions and bills; missed/price‑hike flags.
* **Income identification:** detect employers/clients; net vs gross when paystub data present.

### Budgeting & Goals

* **Budget types:** envelope (category envelopes), zero‑based, simple monthly caps, “pay yourself first.”
* **Rollover & sweep rules:** leftover to savings/goal; deficit pull from buffer.
* **Goals:** target amount/date; suggest contribution schedule; what‑if sliders.
* **Shared budgets:** household members allocate categories with permissions.

### Forecasting & Insights

* **Cashflow forecast:** per‑account and consolidated using SARIMAX/Prophet with holiday effects; p50/p90 bands.
* **Category forecasts:** expected spend with seasonality; early warnings.
* **Bill predictions:** due date and amount windows from recurring detection.
* **Savings insights:** safe‑to‑spend and recommended transfers given goals.

### Anomaly & Fraud Detection

* **Outlier detection:** robust z‑score on residuals + **Isolation Forest**/ELLIPTIC envelope on per‑merchant vectors.
* **Rule exceptions:** merchant/country/device mismatch; time‑of‑day patterns.
* **Human‑in‑the‑loop:** mark as legitimate or fraud; model feedback loop.

### Views & Reporting

* **Dashboard:** net worth trend, upcoming bills, budget status, recent anomalies.
* **Transactions:** fast virtualized table, bulk recategorize, rule creation from selection.
* **Budgets:** envelope board, progress donuts, alerts.
* **Subscriptions:** list with churn/price‑hike flags.
* **Reports:** month/quarter/year; tax categories; export CSV/XLSX/PDF.

### Rules & Automations

* If‑this‑then‑that: merchant/amount/descriptor → set category, tag, note, exclude, split, or trigger alert.
* Schedules: monthly email of report; push alerts on budget breach/anomaly.
* Webhooks to Notion/Sheets for custom pipelines.

### Collaboration & Governance

* **Households/workspaces:** Owner, Admin, Member, Viewer; per‑account visibility.
* **Sharing:** read‑only links to specific reports; coach access with masked PII.
* **Audit log** of imports/edits/exports.

---

## 4) Backend Architecture (Extremely Detailed & Deployment‑Ready)

### 4.1 Topology

* **Frontend/BFF:** Next.js 14 (Vercel). Server Actions for signed uploads and light mutations; SSR for dashboards; ISR for sharable reports.
* **API Gateway:** **NestJS (Node 20)** — REST `/v1` (OpenAPI 3.1), Zod validation, Problem+JSON, RBAC (Casbin), RLS, rate limits, Idempotency‑Key, Request‑ID (ULID).
* **Workers (Python 3.11 + FastAPI control):**
  `etl-worker` (connector sync, CSV/PDF parse), `fx-worker`, `merchant-worker` (embedding/resolve), `categorize-worker`, `recurring-worker`, `forecast-worker` (SARIMAX/Prophet), `anomaly-worker` (PyOD), `report-worker` (PDF/XLSX), `alert-worker` (emails/push/webhooks).
* **Event Bus/Queues:** NATS (subjects: `conn.sync`, `tx.upsert`, `fx.update`, `cat.assign`, `forecast.run`, `anomaly.run`, `report.make`, `alert.fire`) + Redis Streams; Celery/RQ orchestration.
* **Datastores:** **Postgres 16 + TimescaleDB** (ledger, time‑series), **pgvector** (merchant embeddings), **S3/R2** (statements/exports), **Redis** (cache/session), optional **ClickHouse** (aggregated metrics).
* **Observability:** OpenTelemetry (traces/metrics/logs), Prometheus/Grafana, Sentry.
* **Secrets:** Cloud Secrets Manager/KMS; per‑connector token encryption.

### 4.2 Data Model (Postgres + TimescaleDB + pgvector)

```sql
-- Tenancy & Identity
CREATE TABLE orgs (id UUID PRIMARY KEY, name TEXT NOT NULL, plan TEXT DEFAULT 'free', region TEXT, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE users (id UUID PRIMARY KEY, org_id UUID REFERENCES orgs(id) ON DELETE CASCADE, email CITEXT UNIQUE NOT NULL, name TEXT, role TEXT DEFAULT 'member', tz TEXT, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE households (id UUID PRIMARY KEY, org_id UUID, name TEXT, created_by UUID, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE memberships (user_id UUID, household_id UUID, role TEXT CHECK (role IN ('owner','admin','member','viewer')), PRIMARY KEY(user_id, household_id));

-- Accounts & Connections
CREATE TABLE connections (id UUID PRIMARY KEY, org_id UUID, provider TEXT, access_token_enc TEXT, status TEXT, meta JSONB, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE accounts (id UUID PRIMARY KEY, org_id UUID, household_id UUID, connection_id UUID, name TEXT, institution TEXT, mask TEXT, currency TEXT, kind TEXT, balance NUMERIC, created_at TIMESTAMPTZ DEFAULT now());

-- Ledger (Timescale hypertable)
CREATE TABLE transactions (
  id UUID PRIMARY KEY,
  org_id UUID, household_id UUID, account_id UUID,
  ts TIMESTAMPTZ, posted_date DATE, amount NUMERIC, currency TEXT,
  merchant_raw TEXT, merchant_id UUID, category_id UUID, tags TEXT[],
  description TEXT, hash TEXT, is_transfer BOOLEAN DEFAULT FALSE, is_pending BOOLEAN DEFAULT FALSE, meta JSONB
);
SELECT create_hypertable('transactions', 'ts');

-- Merchants & Categories
CREATE TABLE merchants (id UUID PRIMARY KEY, name TEXT, normalized TEXT, embedding VECTOR(1536), website TEXT, country TEXT, mcc TEXT);
CREATE TABLE categories (id UUID PRIMARY KEY, parent_id UUID, code TEXT UNIQUE, name TEXT);

-- Budgets & Goals
CREATE TABLE budgets (id UUID PRIMARY KEY, household_id UUID, period TEXT CHECK (period IN ('monthly','weekly','custom')), start_date DATE, rollover BOOLEAN, buffer NUMERIC DEFAULT 0);
CREATE TABLE budget_lines (id UUID PRIMARY KEY, budget_id UUID REFERENCES budgets(id) ON DELETE CASCADE, category_id UUID, envelope NUMERIC, rollover BOOLEAN);
CREATE TABLE goals (id UUID PRIMARY KEY, household_id UUID, name TEXT, target_amount NUMERIC, target_date DATE, current NUMERIC DEFAULT 0, account_id UUID);

-- Recurring & Bills
CREATE TABLE recurring (id UUID PRIMARY KEY, household_id UUID, merchant_id UUID, amount_est NUMERIC, cadence TEXT, next_due DATE, last_seen DATE, status TEXT);

-- Forecasts & Anomalies
CREATE TABLE forecasts (id UUID PRIMARY KEY, household_id UUID, scope TEXT, key TEXT, horizon INT, p50 NUMERIC[], p90 NUMERIC[], model TEXT, updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE anomalies (id UUID PRIMARY KEY, transaction_id UUID, score NUMERIC, reason TEXT, created_at TIMESTAMPTZ DEFAULT now(), reviewed_by UUID, verdict TEXT);

-- Rules & Alerts
CREATE TABLE rules (id UUID PRIMARY KEY, household_id UUID, expr JSONB, actions JSONB, enabled BOOLEAN DEFAULT TRUE, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE alerts (id UUID PRIMARY KEY, household_id UUID, kind TEXT, payload JSONB, sent_at TIMESTAMPTZ);

-- Reports & Exports
CREATE TABLE reports (id UUID PRIMARY KEY, household_id UUID, month DATE, s3_key TEXT, meta JSONB, created_at TIMESTAMPTZ DEFAULT now());

-- Audit
CREATE TABLE audit_log (id BIGSERIAL PRIMARY KEY, org_id UUID, user_id UUID, action TEXT, target TEXT, meta JSONB, created_at TIMESTAMPTZ DEFAULT now());
```

**Invariants**

* RLS on `org_id`/`household_id`; connection tokens encrypted with KMS.
* `transactions.hash` prevents duplicates; transfer detection merges account‑to‑account moves.
* Budget lines must reference valid categories; forecasts versioned per model.

### 4.3 API Surface (REST `/v1`, OpenAPI)

**Auth/Orgs/Users**

* `POST /auth/login`, `POST /auth/refresh`, `GET /me`, `GET /usage`.

**Connections & Accounts**

* `POST /connections` `{provider}` → connector link token
* `POST /connections/:id/sync`
* `GET /accounts` / `GET /accounts/:id`
* Webhooks: `/webhooks/plaid|tink|truelayer` for updates.

**Transactions & Categories**

* `GET /transactions?from&to&account_id&category_id&q` (cursor)
* `POST /transactions/import` (CSV/OFX/QIF)
* `POST /categories/assign` `{transaction_ids, category_id}`
* `POST /rules` `{expr, actions}` → retroactive apply option.

**Budgets/Goals**

* `POST /budgets` `{period,start_date,buffer}`
* `POST /budgets/:id/lines` `{category_id,envelope,rollover}`
* `POST /goals` `{name,target_amount,target_date,account_id}`

**Forecasts/Anomalies**

* `GET /forecasts?scope=household|category|account&key=...`
* `POST /forecasts/retrain` `{scope}`
* `GET /anomalies?from&to&status`
* `POST /anomalies/:id/verdict` `{verdict:'legit'|'fraud'}`

**Reports/Exports**

* `POST /reports/monthly` `{month}` → signed URL
* `GET /exports/ledger.csv|xlsx|json`

**Conventions**

* Mutations require **Idempotency‑Key**; errors as **Problem+JSON**; cursor pagination; rate limits per org/IP.

### 4.4 Pipelines & Workers

**Connector Sync**

1. Receive webhook or manual sync → pull transactions → deduplicate → FX normalize → push to `tx.upsert`.
   **Enrichment**
2. Merchant embeddings + fuzzy match; category classifier with confidence threshold; rules applied; transfer detection.
   **Recurring & Bills**
3. Detect recurring using interval/variance heuristics; predict next due and expected amount.

**Forecasting**
4\) Build SARIMAX/Prophet models per household/category/account; exogenous variables: paydays, holidays, inflation proxy; update `forecasts`.
**Anomaly**
5\) Model residuals + Isolation Forest; generate `anomalies` with reasons; notify alert worker.
**Reporting**
6\) Render PDF/XLSX month report; upload to S3; email link.
**Alerts**
7\) Budget breach, low balance, upcoming bill, anomaly detected → email/push/webhook.

### 4.5 Realtime

* WebSocket channels: `household:{id}:balances`, `budget:{id}:progress`, `alerts:{id}`.
* SSE streaming for forecast updates and long imports.

### 4.6 Caching & Performance

* Redis caches: category map, merchant resolver, FX rates, forecast snapshots.
* Timescale compression & continuous aggregates for ledger rollups.
* Batch writes for imports; vector index warmers for merchant search.

### 4.7 Observability

* OTel spans: `sync.pull`, `enrich.match`, `classify.cat`, `forecast.run`, `anomaly.detect`, `report.render`.
* Metrics: sync latency, categorization accuracy (based on feedback), forecast MAPE, anomaly precision/recall (from verdicts), alert click‑through.
* Sentry: connector failures, parse errors, model regressions.

### 4.8 Security & Compliance

* TLS/HSTS/CSP; KMS‑wrapped secrets; signed URLs; RLS tenant isolation.
* Connector tokens stored encrypted; no card numbers or full account numbers at rest.
* DSR endpoints; retention windows; SSO/OIDC for coaches; audit log for access.
* GDPR/PSD2‑aware; consent records; data export/delete APIs.

---

## 5) Frontend Architecture (React 18 + Next.js 14)

### 5.1 Tech Choices

* **UI:** PrimeReact (DataTable, Calendar, Dialog, Toolbar, Chart) + Tailwind for layout.
* **Charts:** Recharts for time‑series & donuts.
* **State/Data:** TanStack Query; Zustand for UI panels; URL‑synced filters.
* **Realtime:** WS client with backoff; SSE for long tasks.
* **i18n/A11y:** next‑intl; keyboard‑first; ARIA roles for tables/charts.

### 5.2 App Structure

```
/app
  /(marketing)/page.tsx
  /(auth)/sign-in/page.tsx
  /(app)/dashboard/page.tsx
  /(app)/accounts/page.tsx
  /(app)/transactions/page.tsx
  /(app)/budgets/page.tsx
  /(app)/goals/page.tsx
  /(app)/subscriptions/page.tsx
  /(app)/forecasts/page.tsx
  /(app)/alerts/page.tsx
  /(app)/reports/page.tsx
  /(app)/settings/page.tsx
/components
  LedgerTable/*          // Virtualized table, inline edit, bulk actions
  BudgetBoard/*          // Envelopes, progress donuts
  CashflowChart/*        // Forecast with bands
  AnomalyPanel/*         // Reasons, actions
  RuleBuilder/*          // If-this-then-that
  ImportWizard/*         // CSV/OFX/PDF
  AccountConnect/*       // Plaid/Tink/TrueLayer flows
  GoalPlanner/*          // What-if sliders
  SubscriptionList/*     // Cadence, hikes, cancel tips
  ReportViewer/*
/lib
  api-client.ts
  ws-client.ts
  zod-schemas.ts
  rbac.ts
/store
  useLedgerStore.ts
  useBudgetStore.ts
  useForecastStore.ts
  useAlertStore.ts
```

### 5.3 Key Pages & UX Flows

**Onboarding**

* Connect bank via Plaid/Tink/TrueLayer or import CSV → initial categorization and forecast → set budgets/goals.

**Transactions**

* High‑performance table with search, filters, splits, bulk recategorize; create rule from selection; show model confidence + why.

**Budgets**

* Envelope/zero‑based views; drag to allocate; rollover toggles; alerts when drift exceeds threshold; safe‑to‑spend indicator.

**Forecasts**

* Cashflow line with p50/p90 bands; upcoming bills; what‑if sliders (reduce category X by Y%).

**Alerts**

* Unified center for anomaly/fraud, budget breach, upcoming bill; one‑click mark as legit, change category, or snooze.

**Reports**

* PDF viewer; export CSV/XLSX; share read‑only link with coach.

### 5.4 Component Breakdown (Selected)

* **LedgerTable/Row\.tsx**
  Props: `{ tx, onChange }`
  Shows merchant, category, rule match, model confidence; inline split editor; keyboard shortcuts.

* **RuleBuilder/Editor.tsx**
  Props: `{ rule, onSave }`
  Visual condition builder (merchant contains, amount between, descriptor regex); preview affected transactions.

* **CashflowChart/Forecast.tsx**
  Props: `{ series, p50, p90 }`
  Renders time‑series with bands; click to inspect components (trend/seasonality).

* **AnomalyPanel/Card.tsx**
  Props: `{ anomaly }`
  Displays reason (amount z‑score, geo mismatch, time pattern) with actions.

### 5.5 Data Fetching & Caching

* Server components for dashboard snapshots and reports.
* TanStack Query caches transaction pages; optimistic updates on recategorization/rules; WS updates budgets/alerts.
* Prefetch sequence: accounts → transactions → budgets → forecasts.

### 5.6 Validation & Error Handling

* Zod schemas; Problem+JSON renderer with remediation (connector revoked, CSV malformed).
* Guard: report generation disabled until categorization coverage ≥ X%; rule editor warns on overlapping rules.

### 5.7 Accessibility & i18n

* Semantic tables with keyboard navigation; high‑contrast mode; screen‑reader labels for charts; localized currency/number/date formats; multi‑currency display.

---

## 6) SDKs & Integration Contracts

**Sync Connection**

```http
POST /v1/connections/{id}/sync
```

**List Transactions**

```http
GET /v1/transactions?from=2025-08-01&to=2025-08-31&category_id=groceries
```

**Create Rule**

```http
POST /v1/rules
{"expr":{"merchant_contains":"AMZN","amount_gt":5},"actions":{"category_id":"shopping","tag":["online"]}}
```

**Monthly Report**

```http
POST /v1/reports/monthly {"month":"2025-08-01"}
```

**JSON Bundle** keys: `accounts[]`, `transactions[]`, `categories[]`, `budgets[]`, `forecasts[]`, `anomalies[]`, `rules[]`, `reports[]`.

---

## 7) DevOps & Deployment

* **FE:** Vercel (Next.js).
* **APIs/Workers:** Render/Fly/GKE; separate pools (etl, categorize, forecast, anomaly, report).
* **DB:** Managed Postgres + TimescaleDB + pgvector; PITR; read replicas.
* **Cache/Bus:** Redis + NATS; DLQ with retries/backoff/jitter.
* **Storage:** S3/R2 with lifecycle for statements/exports; CDN for downloads.
* **CI/CD:** GitHub Actions (lint/typecheck/unit/integration, Docker, scan, sign, deploy); blue/green; migration approvals.
* **IaC:** Terraform modules for DB/Redis/NATS/buckets/CDN/secrets/DNS.
* **Envs:** dev/staging/prod; region pinning; error budgets & alerts.

**Operational SLOs**

* End‑to‑end ingestion (1000 tx CSV) **< 45 s p95**.
* Forecast refresh (household scope) **< 12 s p95**.
* Anomaly detection batch (day) **< 4 s p95**.
* 5xx **< 0.5%/1k**.

---

## 8) Testing

* **Unit:** merchant normalization; category classifier thresholds; transfer detection; recurring finders; forecast components; anomaly thresholds.
* **Integration:** connector sync → enrichment → budgets → forecasts → alerts; FX normalization.
* **Regression:** model drift monitors; rules collision tests; report consistency.
* **E2E (Playwright):** connect/import → categorize → set budget → forecast → receive anomaly alert → export report.
* **Load:** burst imports and connector webhooks; high‑volume ledger queries.
* **Chaos:** connector outage; FX API down; delayed webhooks; ensure retries/backoff and user prompts.
* **Security:** RLS coverage; token encryption/decryption path; audit completeness.

---

## 9) Success Criteria

**Product KPIs**

* Categorization accuracy **≥ 92%** with user feedback loop.
* Forecast MAPE for cashflow **≤ 12%** over 30‑day horizon.
* Anomaly precision **≥ 70%** at default threshold.
* Weekly active households **≥ 60%** after 4 weeks; report open rate **≥ 50%**.

**Engineering SLOs**

* Pipeline success **≥ 99%** excl. connector outages; WS p95 **< 250 ms**; report render p95 **< 6 s**.

---

## 10) Visual/Logical Flows

**A) Connect/Import → Normalize → Categorize**
User links bank or uploads CSV → ETL normalizes → merchant resolve + category classify → ledger updated.

**B) Budget & Goals → Forecast**
User sets envelopes/goals → model computes cashflow/category forecasts → safe‑to‑spend shown.

**C) Monitor & Alert**
Rule and anomaly system flags events → user reviews and confirms → models learn from verdicts.

**D) Report & Share**
Generate monthly PDF/CSV → share read‑only link with household/coach → iterate budgets.
