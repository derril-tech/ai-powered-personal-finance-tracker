# ARCH.md — AI-Powered Personal Finance Tracker

## Topology
- **Frontend/BFF:** Next.js 14 (Vercel). Server Actions for signed uploads/small mutations; SSR dashboards; ISR sharable reports; WS/SSE for live streams.
- **API Gateway:** NestJS (Node 20), REST `/v1`, OpenAPI 3.1, Zod DTOs, Problem+JSON, RBAC (Casbin), RLS, rate limits, Idempotency-Key, Request-ID (ULID).
- **Workers (Python 3.11 + FastAPI control):**
  - `etl-worker` (connectors, CSV/OFX/QIF/MT940/PDF parse, dedupe)
  - `fx-worker` (ECB/OpenExchange rates, cache)
  - `merchant-worker` (embeddings + fuzzy resolve)
  - `categorize-worker` (ML classifier + explanations)
  - `recurring-worker` (subscriptions/bills, due & hikes)
  - `forecast-worker` (SARIMAX/Prophet; p50/p90)
  - `anomaly-worker` (PyOD Isolation Forest + residuals)
  - `report-worker` (PDF/XLSX/CSV, S3 upload)
  - `alert-worker` (email/push/webhooks, dedupe/snooze)
- **Event Bus/Queues:** NATS (`conn.sync`, `tx.upsert`, `fx.update`, `cat.assign`, `forecast.run`, `anomaly.run`, `report.make`, `alert.fire`) + Redis Streams; Celery/RQ orchestration.
- **Datastores:** Postgres 16 + **TimescaleDB** (transactions hypertable, continuous aggregates) + **pgvector** (merchant embeddings); S3/R2 (statements/exports); Redis (cache/session); optional ClickHouse (aggregated analytics).
- **Observability:** OpenTelemetry (traces/metrics/logs), Prometheus/Grafana, Sentry.
- **Secrets:** Cloud Secrets Manager/KMS; connector tokens encrypted at rest.

## Data Model (high-level)
- Tenancy: `orgs`, `users`, `households`, `memberships` (roles: owner/admin/member/viewer).
- Connections/Accounts: provider creds, per-account meta, balances.
- Ledger: `transactions` hypertable (ts, amount, merchant_raw/merchant_id, category_id, tags, meta), dedupe hash, transfer flags.
- Merchants/Categories: canonical merchant with embedding; category tree.
- Budgets/Goals: budget with lines (envelopes), rollover/buffer; goals with targets/schedules.
- Recurring: cadence, next_due, last_seen, amount_est, status.
- Forecasts/Anomalies: arrays for p50/p90; anomaly score/reason/verdict.
- Rules/Alerts: JSON expressions & actions; alert log.
- Reports: month key, S3 key, meta (covering totals).
- Audit: immutable access/change log.

## API Surface (REST `/v1`)
- Auth/Users: `/auth/login`, `/auth/refresh`, `/me`, `/usage`.
- Connections: `POST /connections {provider}`, `/connections/:id/sync`, webhooks `/webhooks/plaid|tink|truelayer`.
- Accounts: `GET /accounts`, `GET /accounts/:id`.
- Transactions: `GET /transactions?...`, `POST /transactions/import`, `POST /categories/assign`, `POST /rules`.
- Budgets/Goals: `POST /budgets`, `POST /budgets/:id/lines`, `POST /goals`.
- Forecasts/Anomalies: `GET /forecasts?...`, `POST /forecasts/retrain`, `GET /anomalies?...`, `POST /anomalies/:id/verdict`.
- Reports/Exports: `POST /reports/monthly`, `GET /exports/ledger.csv|xlsx|json`.
- Conventions: Idempotency-Key; Problem+JSON; cursor pagination; per-org/IP rate limits.

## Pipelines
1. **Connector Sync:** webhook/manual → pull accounts/tx → dedupe → FX normalize → emit `tx.upsert`.
2. **Enrichment:** merchant resolver (embedding + fuzzy), categorizer (ML + rules), transfer detection.
3. **Recurring:** cadence detection, next due, price-hike/missed flags.
4. **Forecasting:** SARIMAX/Prophet per household/category/account; store p50/p90.
5. **Anomaly:** residual z-scores + Isolation Forest; reasons; alert on threshold.
6. **Reporting:** monthly PDF/XLSX/CSV + JSON bundle; upload S3; signed link.
7. **Alerts:** budget breach, low balance, upcoming bill, anomaly; dedupe/snooze; webhooks.

## Realtime
- WS topics: `household:{id}:balances`, `budget:{id}:progress`, `alerts:{id}`.
- SSE for long imports and forecast updates.

## Caching & Performance
- Redis: FX rates, merchant cache, category map, forecast snapshots.
- Timescale compression + continuous aggregates; vector index warmers.
- Batch upserts; pagination by (ts,id); backpressure on imports.

## Security & Compliance
- TLS/HSTS/CSP; tenant isolation via RLS; S3 prefix isolation; signed URLs.
- KMS-wrapped tokens; no PANs stored; DSR endpoints; consent & retention.
- SSO/OIDC (coach access); immutable audit trail.

## SLOs
- CSV 1k rows ingest < **45s p95**; forecast refresh < **12s p95**; anomaly batch (day) < **4s p95**.
- API 5xx < **0.5%/1k**; WS p95 < **250ms**; report render < **6s p95**.
