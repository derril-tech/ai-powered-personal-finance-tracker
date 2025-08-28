# DONE.md — Completed Tasks

## Phase 1

[2024-12-19] [Claude] Initialize monorepo (apps/frontend, apps/api, services/workers, packages/shared).
[2024-12-19] [Claude] Configure TypeScript project refs, ESLint/Prettier, commit hooks; strict mode everywhere.
[2024-12-19] [Claude] Provision Postgres 16 with TimescaleDB + pgvector; enable extensions; set up roles and RLS templates.
[2024-12-19] [Claude] Provision Redis (TLS) and NATS (auth, subjects, DLQ); create infra Terraform modules.
[2024-12-19] [Claude] Create S3/R2 buckets (statements, exports, bundles) with lifecycle and SSE-KMS.
[2024-12-19] [Claude] Scaffold NestJS API (OpenAPI 3.1, Problem+JSON, Zod, Casbin RBAC, Idempotency-Key, Request-ID).
[2024-12-19] [Claude] Implement auth (JWT) + refresh; orgs/users/households; memberships with roles (owner/admin/member/viewer).
[2024-12-19] [Claude] Add SSO/OIDC stub for coach access; map to roles.
[2024-12-19] [Claude] Migrations: orgs, users, households, memberships, connections, accounts, transactions (hypertable), merchants, categories, budgets, budget_lines, goals, recurring, forecasts, anomalies, rules, alerts, reports, audit_log.
[2024-12-19] [Claude] Seed default category tree and example merchants.
[2024-12-19] [Claude] Connections API: create connection (provider param), get link token (Plaid/Tink/TrueLayer), receive webhook endpoints with signature verification.
[2024-12-19] [Claude] ETL worker: pull accounts/balances/transactions; dedupe by hash; mark transfers; FX normalize amounts.
[2024-12-19] [Claude] Manual import: CSV/OFX/QIF/MT940 parsers; column mapper UI; validation errors.
[2024-12-19] [Claude] PDF statement parser (tables) with fallback OCR for scans; attach to account/month.
[2024-12-19] [Claude] FX worker: daily ECB/OpenExchange pull; cache rates; historical conversion helper.
[2024-12-19] [Claude] Merchant resolver: embedding generator (name + descriptor) + fuzzy matcher; canonical merchant table; website/country/MCC enrichment.
[2024-12-19] [Claude] Category classifier: baseline rules + ML (logistic/LightGBM); confidence + SHAP-like explanation; per-user overrides and learning.
[2024-12-19] [Claude] Transfer detection: intra-household account moves; collapse duplicates; mark `is_transfer`.
[2024-12-19] [Claude] Recurring detector: cadence via interval variance/periodogram; amount window; next_due estimator; price-hike/missed flags.
[2024-12-19] [Claude] Income detection: employer/client detection; net vs gross heuristic; tag paydays.
[2024-12-19] [Claude] Rules engine: JSON expression parser (merchant contains, amount between, regex on descriptor, country, time); actions (set category/tag/note/exclude/split/alert); retroactive apply.

## Phase 2

[2024-12-19] [Claude] Budgets API: create budget (period, start, buffer); budget_lines CRUD (envelopes, rollover flags); safe-to-spend calculation.
[2024-12-19] [Claude] Shared budgets across household members; per-account visibility controls.
[2024-12-19] [Claude] Goals API: create goal (target amount/date, account); suggestion engine for contributions; what-if calculator.
[2024-12-19] [Claude] Forecast worker: SARIMAX/Prophet/RandomForest; holiday effects; p50/p90 bands; store in forecasts table.
[2024-12-19] [Claude] Bill predictions from recurring detector: upcoming bills, risk scores, status (upcoming/due soon/overdue/paid).
[2024-12-19] [Claude] Anomaly worker: residual z-scores + Isolation Forest; merchant/category patterns; reason text; configurable thresholds.
[2024-12-19] [Claude] Verdict feedback: record legit/fraud; update anomaly records; precision/recall stats; threshold recommendations.
[2024-12-19] [Claude] Alerts service: budget breach, low balance, upcoming bill, anomaly; email/push/webhook; dedupe and snooze.
[2024-12-19] [Claude] Monthly report generator: PDF (WeasyPrint/ReportLab) + XLSX (openpyxl) + CSV; upload to S3; signed URL.
[2024-12-19] [Claude] JSON bundle exporter (accounts, transactions, categories, budgets, forecasts, anomalies, rules, reports).
[2024-12-19] [Claude] Rate limits per org/IP; cost counters for usage-based add-ons.
[2024-12-19] [Claude] Frontend shell with PrimeReact theme + Tailwind utilities; dark mode.
[2024-12-19] [Claude] Dashboard page: net worth trend, upcoming bills, budget status, recent anomalies; SSR snapshot + WS updates.
[2024-12-19] [Claude] Accounts page: connector flows (Plaid/Tink/TrueLayer UI), account list, balances, sync button.
[2024-12-19] [Claude] Transactions page: virtualized table; search, filters, bulk recategorize, split editor, rule creation from selection; show confidence/explanations.
[2024-12-19] [Claude] Budgets page: envelope/zero-based views; drag allocation; rollover toggles; progress donuts; safe-to-spend indicator.
[2024-12-19] [Claude] Goals page: create/edit goals; contribution suggestions; what-if sliders.
[2024-12-19] [Claude] Subscriptions page: recurring list, cadence, next due, price-hike/missed flags, cancel tips.
[2024-12-19] [Claude] Forecasts page: cashflow line with p50/p90 bands; category forecasts; upcoming bills list; SSE refresh.
[2024-12-19] [Claude] Alerts center: anomaly/budget/bill alerts; one-click legit/fraud/category change; snooze.
[2024-12-19] [Claude] Reports page: month selector; PDF viewer; export CSV/XLSX; share read-only link.
[2024-12-19] [Claude] Settings page: profile, household, organization, notifications, integrations, API keys.
[2024-12-19] [Claude] Rule Builder UI: visual condition builder; preview affected transactions; save & run retroactively.
[2024-12-19] [Claude] Import wizard UI: CSV/OFX/QIF/MT940 mapping; PDF attach; error review.
[2024-12-19] [Claude] Real-time WS topics wired: balances, budget progress, alerts; SSE for long imports and forecasts.
[2024-12-19] [Claude] Continuous aggregates in Timescale for ledger rollups (daily totals by category/account/household).
[2024-12-19] [Claude] Redis caches: FX rates, merchant cache, category map, forecast snapshots.
[2024-12-19] [Claude] Observability: OTel spans for sync/enrich/forecast/anomaly/report; Grafana dashboards; Sentry alerts (connector failures, parse errors, model regressions).
[2024-12-19] [Claude] Security: KMS-encrypted connector tokens; secrets rotation; signed URLs; S3 prefix isolation; strict CSP/HSTS.
[2024-12-19] [Claude] RLS policies for all multi-tenant tables; per-account visibility enforcement; unit tests for RLS.
[2024-12-19] [Claude] Data retention & DSR endpoints (export/delete household data); consent logging.

## Phase 4

[2025-08-28] [Cursor] Billing/usage: seats and add-ons (extra connectors, advanced forecasts); usage metering endpoints.
[2025-08-28] [Cursor] CI/CD: GitHub Actions (lint, typecheck, unit/integration, Docker build, scan, sign, deploy); blue/green deploy; migration approvals.
[2025-08-28] [Cursor] Seed demo household with synthetic accounts/transactions, budgets, forecasts, anomalies, reports.
[2025-08-28] [Cursor] Unit tests: merchant normalization, classifier thresholds, transfer detection, recurring finder, forecast components, anomaly thresholds, rule engine.
[2025-08-28] [Cursor] Integration tests: connector sync → enrichment → budgets → forecasts → alerts; FX normalization; report generation.
[2025-08-28] [Cursor] Regression tests: model drift monitors (MAPE tracking), rule collisions, export consistency.
[2025-08-28] [Cursor] E2E (Playwright): connect/import → categorize → set budget → forecast → receive anomaly → export report.
[2025-08-28] [Cursor] Load tests: burst imports (CSV 100k), webhook storms; verify pagination and backpressure.
[2025-08-28] [Cursor] Chaos tests: connector outages/429/5xx; FX API down; S3 transient errors; ensure retries/backoff/jitter.
[2025-08-28] [Cursor] Accessibility: keyboard nav on tables, ARIA for charts, high-contrast; screen-reader labels on amounts/changes.
[2025-08-28] [Cursor] Localization: next-intl, currency/number/date formats; multi-currency display; RTL support.
