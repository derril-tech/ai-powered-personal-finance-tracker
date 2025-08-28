# Chaos Tests

Scenarios:
- Connector outages (5xx), rate limits (429), timeouts
- FX API down
- S3 transient errors

How to run:
- Use `nock` in Node or `pytest` with `responses` in Python to simulate upstream failures.
- Verify retries with backoff/jitter, circuit breaking, and fallbacks.

Scripts:
- See `infra/tests/k6/import_burst.js` for load.
- Add service-specific chaos specs alongside unit tests to validate retry policies.
