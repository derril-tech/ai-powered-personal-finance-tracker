# PLAN.md — AI-Powered Personal Finance Tracker

## Goal
Ship a secure, multi-tenant (households) finance tracker that unifies accounts, auto-categorizes transactions, detects recurring bills, builds budgets/goals, forecasts cashflow and category spend, flags anomalies/fraud, and produces monthly reports and exports.

## Build Strategy
- Single continuous build (no phases). Stand up core infra (Postgres+TimescaleDB+pgvector, Redis, NATS, S3) → connectors/imports → enrichment (merchant/category/recurring) → budgeting/goals → forecasting/anomaly → reports/alerts → polished UI.
- Frontend: Next.js 14, PrimeReact + Tailwind; SSR for dashboards/reports; WS/SSE for live balances/alerts.
- Backend: NestJS API gateway (OpenAPI, Problem+JSON, RBAC, RLS); Python workers for ETL, FX, merchant resolution, categorization, recurring, forecasting (SARIMAX/Prophet), anomaly (PyOD), reports, alerts.
- Data: Timescale hypertable for `transactions`; pgvector for merchant embeddings; continuous aggregates for rollups.
- Privacy & safety: read-only connectors; KMS-encrypted tokens; transparent model explanations; household permissions.

## Deliverables
- Bank connectors (Plaid/Tink/TrueLayer/Finicity) + CSV/OFX/QIF/MT940 + PDF statement import.
- Merchant resolver (embedding + fuzzy) and category classifier with explanations & feedback loop.
- Recurring/subscriptions detector with due-date and price-hike flags.
- Budgets (envelope/zero-based) with rollover/sweep; Goals with contribution schedules & what-ifs.
- Forecasts for cashflow/category and bill predictions with p50/p90 bands.
- Anomaly/fraud detection (residual z-score + Isolation Forest) with reasons and verdict training.
- Dashboards (net worth, upcoming bills, budgets, anomalies), transactions table, subscriptions, reports.
- Rules/automations, alerts (email/push/webhook), exports (PDF/CSV/XLSX/JSON bundle).
- Collaboration (households, roles, per-account visibility), audit, SSO (coach access).

## Non-Goals (V1)
- Initiating payments/transfers.
- Investment portfolio optimization or tax filing.
- Credit score pulls.

## Success Criteria
- Categorization accuracy ≥ **92%** (with feedback).
- Cashflow MAPE ≤ **12%** (30-day horizon).
- Anomaly precision ≥ **70%** at default threshold.
- Ingestion of 1k-row CSV < **45s p95**; forecast refresh < **12s p95**; report render < **6s p95**.
