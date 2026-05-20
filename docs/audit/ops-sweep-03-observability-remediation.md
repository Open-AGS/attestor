# OPS-SWEEP-03 Observability Remediation

## Scope

- Source report scope: observability, alerting, log storage, data minimization,
  and live-shadow kill-switch visibility.
- Validation source of truth: `origin/master`
- Validation HEAD before remediation: `68c5efe7901e70a38750889f0123d676fa98bfa7`
- Protected principles: data minimization and redaction, runtime readiness,
  operational boundedness, auditability, no overclaim.

## Repository Remediation

| Finding | State | Repo evidence | Remaining limitation |
|---|---|---|---|
| OPS-25 empty Alertmanager receivers | closed / live-proof-only | `ops/observability/alertmanager/alertmanager.yml` now uses secret-file webhook receiver configs; `scripts/render-alertmanager-config.mjs` continues to fail fast in production mode; `tests/ops-sweep-03-observability-remediation.test.ts` locks the contract. | Live paging still requires real receiver URLs and an alert delivery probe. |
| OPS-26 literal Prometheus metrics token | closed | `ops/observability/prometheus/prometheus.yml` uses `authorization.credentials_file`; `scripts/render-observability-credentials.ts` emits `prometheus-metrics-token`; compose mounts that file read-only. | Token rotation and secret backend proof remain live ops work. |
| OPS-27 Loki unauthenticated local API | closed for local bundle / live-proof-only for production | `ops/observability/loki/loki.yml` sets `auth_enabled: true`; OTel and Grafana use `X-Scope-OrgID`. | Production Loki or managed backend access control still needs deployment proof. |
| OPS-28/OPS-29 collector backend TLS ambiguity | closed as explicit accepted limitation | Collector configs use `TEMPO_OTLP_INSECURE` and `LOKI_OTLP_INSECURE` instead of hardcoded ambiguity. | In-cluster plaintext is still accepted only behind NetworkPolicy; limited enforcement needs mTLS, managed TLS, or explicit accepted-risk proof. |
| OPS-30 missing security event alerts | closed for baseline coverage | `ops/observability/prometheus/alerts.yml` adds admin auth failure, security rejection spike, and webhook signature failure alerts with `team: security`. | Per-tenant abuse alerting still depends on live label availability and route metrics. |
| OPS-31 retention mismatch | closed | Loki retention now reads `ATTESTOR_OBSERVABILITY_LOKI_RETENTION_PERIOD`; profile renderer already emits the matching env. | Operators must feed profile-generated retention env into the selected runtime. |
| OPS-32/OPS-33 local Loki/Tempo storage | accepted limitation | `ops/observability/README.md` now states local filesystem storage is evaluation/shadow rehearsal only. | Production object-store/encryption/backup proof remains live ops evidence. |
| OPS-34 env resource detector leak surface | closed | Kubernetes collector configs now use `detectors: [system]`, not `[env, system]`. | Application logs still need redaction coverage before public demo. |
| OPS-35 missing cost/budget visibility | partial / live-proof-only | `AttestorBudgetTelemetryMissing` alert makes missing budget telemetry visible. | Actual cloud billing alerts remain a live cloud proof. |
| OPS-36 Watchdog repeat interval | accepted limitation | unchanged; synthetic Watchdog remains a routing-path probe. | None for repository scope. |
| OPS-37 limited inhibit rules | accepted limitation | unchanged; critical-over-warning inhibition remains narrow by design. | Escalation policy tuning remains live ops work. |

## Chain-Effect Checks

- The Prometheus credential change also updates the credential renderer,
  compose mount, README, and tests so the API token source and scrape token
  source stay consistent.
- Loki tenant auth changes add both write-side (`OTel X-Scope-OrgID`) and
  read-side (`Grafana X-Scope-OrgID`) headers, avoiding a half-enabled Loki
  auth state.
- Removing the collector env detector is mirrored across base, Grafana Cloud,
  and Grafana Alloy Kubernetes configmaps.
- Local plaintext collector-to-backend traffic was not silently claimed fixed;
  it is explicit env-controlled posture plus live proof for stronger runtimes.

## Verification

Targeted checks:

- `npm run test:ops-sweep-03-observability-remediation`
- `npm run test:observability-bundle`
- `npm run test:kubernetes-observability-bundle`
- `npm run test:observability-credentials-render`
- `npm run test:alertmanager-config-render`
- `npm run test:alert-routing-probe`
- `npm run test:observability-profile-render`

Broad checks should include TypeScript and evidence-system gates before merge.

## What This Does Not Prove

- It does not prove production observability readiness.
- It does not prove real PagerDuty/Slack/email/webhook delivery.
- It does not prove live Loki/Tempo object storage, encryption-at-rest, or
  backup/restore behavior.
- It does not prove cloud budget alert delivery.
- It does not prove application log redaction is complete.
