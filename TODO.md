# TODO.md — AI-Powered Personal Finance Tracker


PHASE 1:
- [x] Initialize monorepo (apps/frontend, apps/api, services/workers, packages/shared).
- [x] Configure TypeScript project refs, ESLint/Prettier, commit hooks; strict mode everywhere.
- [x] Provision Postgres 16 with TimescaleDB + pgvector; enable extensions; set up roles and RLS templates.
- [x] Provision Redis (TLS) and NATS (auth, subjects, DLQ); create infra Terraform modules.
- [x] Create S3/R2 buckets (statements, exports, bundles) with lifecycle and SSE-KMS.
- [x] Scaffold NestJS API (OpenAPI 3.1, Problem+JSON, Zod, Casbin RBAC, Idempotency-Key, Request-ID).
- [x] Implement auth (JWT) + refresh; orgs/users/households; memberships with roles (owner/admin/member/viewer).
- [x] Add SSO/OIDC stub for coach access; map to roles.
- [x] Migrations: orgs, users, households, memberships, connections, accounts, transactions (hypertable), merchants, categories, budgets, budget_lines, goals, recurring, forecasts, anomalies, rules, alerts, reports, audit_log.
- [x] Seed default category tree and example merchants.
- [x] Connections API: create connection (provider param), get link token (Plaid/Tink/TrueLayer), receive webhook endpoints with signature verification.
- [x] ETL worker: pull accounts/balances/transactions; dedupe by hash; mark transfers; FX normalize amounts.
- [x] Manual import: CSV/OFX/QIF/MT940 parsers; column mapper UI; validation errors.
- [ ] PDF statement parser (tables) with fallback OCR for scans; attach to account/month.
- [x] FX worker: daily ECB/OpenExchange pull; cache rates; historical conversion helper.
- [x] Merchant resolver: embedding generator (name + descriptor) + fuzzy matcher; canonical merchant table; website/country/MCC enrichment.
- [x] Category classifier: baseline rules + ML (logistic/LightGBM); confidence + SHAP-like explanation; per-user overrides and learning.
- [x] Transfer detection: intra-household account moves; collapse duplicates; mark `is_transfer`.
- [x] Recurring detector: cadence via interval variance/periodogram; amount window; next_due estimator; price-hike/missed flags.
- [x] Income detection: employer/client detection; net vs gross heuristic; tag paydays.
- [x] Rules engine: JSON expression parser (merchant contains, amount between, regex on descriptor, country, time); actions (set category/tag/note/exclude/split/alert); retroactive apply.

PHASE 2:
- [x] Budgets API: create budget (period, start, buffer); budget_lines CRUD (envelopes, rollover flags); safe-to-spend calculation.
- [x] Shared budgets across household members; per-account visibility controls.
- [x] Goals API: create goal (target amount/date, account); suggestion engine for contributions; what-if calculator.
- [x] Forecast worker: SARIMAX/Prophet per household/category/account; holiday effects; p50/p90 bands; store forecasts.
- [x] Bill predictions from recurring detector; surface in forecasts page and alerts.
- [x] Anomaly worker: residual z-scores + Isolation Forest per merchant/category; reason text; thresholds configurable.
- [x] Verdict feedback: mark legit/fraud; update thresholds or retrain schedule; maintain precision/recall stats.
- [x] Alerts service: budget breach, low balance, upcoming bill, anomaly; email/push/webhook; dedupe and snooze.
- [x] Monthly report generator: PDF (WeasyPrint/ReportLab) + XLSX (openpyxl) + CSV; upload to S3; signed URL.
- [x] JSON bundle exporter (accounts, transactions, categories, budgets, forecasts, anomalies, rules, reports).
- [x] API endpoints: transactions list (filters, cursor), categories/assign, rules create, budgets/lines, goals, forecasts get, anomalies get/verdict, reports create, exports ledger.
- [x] Rate limits per org/IP; cost counters for usage-based add-ons.
- [x] Frontend shell with PrimeReact theme + Tailwind utilities; dark mode.
- [x] Dashboard page: net worth trend, upcoming bills, budget status, recent anomalies; SSR snapshot + WS updates.
- [x] Accounts page: connector flows (Plaid/Tink/TrueLayer UI), account list, balances, sync button.
- [x] Transactions page: virtualized table; search, filters, bulk recategorize, split editor, rule creation from selection; show confidence/explanations.
- [x] Budgets page: envelope/zero-based views; drag allocation; rollover toggles; progress donuts; safe-to-spend indicator.
- [x] Goals page: create/edit goals; contribution suggestions; what-if sliders.


PHASE 3:
- [x] Subscriptions page: recurring list, cadence, next due, price-hike/missed flags, cancel tips.
- [x] Forecasts page: cashflow line with p50/p90 bands; category forecasts; upcoming bills list; SSE refresh.
- [x] Alerts center: anomaly/budget/bill alerts; one-click legit/fraud/category change; snooze.
- [x] Reports page: month selector; PDF viewer; export CSV/XLSX; share read-only link.
- [x] Rule Builder UI: visual condition builder; preview affected transactions; save & run retroactively.
- [x] Import wizard UI: CSV/OFX/QIF/MT940 mapping; PDF attach; error review.
- [x] Real-time WS topics wired: balances, budget progress, alerts; SSE for long imports and forecasts.
- [x] Continuous aggregates in Timescale for ledger rollups (daily totals by category/account/household).
- [x] Redis caches: FX rates, merchant cache, category map, forecast snapshots.
- [x] Observability: OTel spans for sync/enrich/forecast/anomaly/report; Grafana dashboards; Sentry alerts (connector failures, parse errors, model regressions).
- [x] Security: KMS-encrypted connector tokens; secrets rotation; signed URLs; S3 prefix isolation; strict CSP/HSTS.
- [x] RLS policies for all multi-tenant tables; per-account visibility enforcement; unit tests for RLS.
- [x] Data retention & DSR endpoints (export/delete household data); consent logging.

PHASE 4:
- [x] Billing/usage: seats and add-ons (extra connectors, advanced forecasts); usage metering endpoints.
- [x] CI/CD: GitHub Actions (lint, typecheck, unit/integration, Docker build, scan, sign, deploy); blue/green deploy; migration approvals.
- [x] Seed demo household with synthetic accounts/transactions, budgets, forecasts, anomalies, reports.
- [x] Unit tests: merchant normalization, classifier thresholds, transfer detection, recurring finder, forecast components, anomaly thresholds, rule engine.
- [x] Integration tests: connector sync → enrichment → budgets → forecasts → alerts; FX normalization; report generation.
- [x] Regression tests: model drift monitors (MAPE tracking), rule collisions, export consistency.
- [x] E2E (Playwright): connect/import → categorize → set budget → forecast → receive anomaly → export report.
- [x] Load tests: burst imports (CSV 100k), webhook storms; verify pagination and backpressure.
- [x] Chaos tests: connector outages/429/5xx; FX API down; S3 transient errors; ensure retries/backoff/jitter.
- [x] Accessibility: keyboard nav on tables, ARIA for charts, high-contrast; screen-reader labels on amounts/changes.
- [x] Localization: next-intl, currency/number/date formats; multi-currency display; RTL support.
