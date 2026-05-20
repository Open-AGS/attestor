# Attestor Observability Bundle

This bundle ships a local, persisted observability stack for Attestor:

- `attestor-api` with OTLP logs, traces, and metrics enabled
- `otel-collector` for signal fan-out and Prometheus export
- `prometheus` + `alertmanager` for scrape + alert evaluation
- `grafana` for dashboards
- `tempo` for trace storage
- `loki` for structured log storage
- `alertmanager-config-renderer` for severity-based webhook/email routing from environment variables or mounted secret files

Start it with:

```bash
npm run render:observability-credentials
docker compose -f docker-compose.observability.yml up --build
```

The bundled Prometheus job scrapes `GET /api/v1/metrics` using a dedicated bearer token generated into `.attestor/observability/credentials/prometheus-metrics-token`, so operators do not need to expose the broader admin API key to the metrics pipeline. The default local token is generated outside the repository; set `ATTESTOR_METRICS_API_KEY` or `ATTESTOR_METRICS_API_KEY_FILE` before rendering for non-local environments.

Shipped production-oriented defaults in this bundle:

- Prometheus remote-write receiver enabled so Tempo metrics-generator can write span-metrics + service-graph telemetry
- multi-window burn-rate SLO recording rules and alert rules for API availability and latency
- Loki compactor retention enabled with a profile/env-driven 14-day default
- Tempo trace retention and metrics-generator enabled with 14-day defaults
- severity/team-based Alertmanager routing with Watchdog and critical-over-warning inhibition
- local Loki tenant isolation enabled with the `X-Scope-OrgID` tenant header
- explicit collector-to-backend TLS mode flags (`TEMPO_OTLP_INSECURE`, `LOKI_OTLP_INSECURE`) so plaintext in-cluster telemetry remains a deliberate deployment choice

Optional Alertmanager delivery wiring comes from:

- `ALERTMANAGER_DEFAULT_WEBHOOK_URL`
- `ALERTMANAGER_CRITICAL_WEBHOOK_URL`
- `ALERTMANAGER_WARNING_WEBHOOK_URL`
- `ALERTMANAGER_DEFAULT_SLACK_WEBHOOK_URL`
- `ALERTMANAGER_DEFAULT_SLACK_CHANNEL`
- `ALERTMANAGER_WARNING_SLACK_WEBHOOK_URL`
- `ALERTMANAGER_WARNING_SLACK_CHANNEL`
- `ALERTMANAGER_CRITICAL_PAGERDUTY_ROUTING_KEY`
- `ALERTMANAGER_SECURITY_WEBHOOK_URL`
- `ALERTMANAGER_BILLING_WEBHOOK_URL`
- `ALERTMANAGER_EMAIL_TO`
- `ALERTMANAGER_EMAIL_FROM`
- `ALERTMANAGER_SMARTHOST`
- `ALERTMANAGER_SMTP_AUTH_USERNAME`
- `ALERTMANAGER_SMTP_AUTH_PASSWORD`
- every secret-like value also supports a `*_FILE` variant for mounted Docker/Kubernetes secrets
- `ALERTMANAGER_PRODUCTION_MODE=true` enables fail-fast validation so incomplete production routing is rejected instead of silently rendering a partial config

Credential bundle rendering:

- `npm run render:observability-credentials`
- emits a redacted summary plus:
  - local `.env` material for the Docker bundle
  - a Prometheus bearer-token file consumed via `credentials_file`
  - a Grafana Cloud collector Secret manifest
  - an Alertmanager routing Secret manifest

Profile-driven SLO / retention tuning:

- `npm run benchmark:observability -- --prometheus-url=http://127.0.0.1:9090 --alertmanager-url=http://127.0.0.1:9093`
- captures real Prometheus request-rate / availability / p95-latency data plus optional Alertmanager alert counts into `benchmark.json`
- `npm run render:observability-profile -- --input=.attestor/observability/calibration/latest/benchmark.json --profile=ops/observability/profiles/regulated-production.json`
- shipped profiles live under `ops/observability/profiles/`

Rollout-near receiver probe:

- `npm run probe:observability-receivers -- --prometheus-url=http://127.0.0.1:9090 --alertmanager-url=http://127.0.0.1:9093`
- emits real OTLP trace/log/metric traffic through the configured exporter env
- forces a telemetry flush
- verifies Prometheus and Alertmanager API auth against the configured endpoints

Route-level alert routing probe:

- `npm run probe:alert-routing`
- renders the current Alertmanager config from env / `*_FILE` inputs
- simulates representative `default`, `critical`, `warning`, `security`, `billing`, and `Watchdog` alert fanout
- fails if required fallback/severity routes resolve to receivers without delivery targets

Promotion-ready release preflight:

- `npm run probe:observability-release-inputs -- --provider=<generic|grafana-cloud|grafana-alloy> --benchmark=.attestor/observability/calibration/latest/benchmark.json --prometheus-url=http://127.0.0.1:9090 --alertmanager-url=http://127.0.0.1:9093`
- validates the required managed-backend credential inputs for the selected provider
- validates External Secrets store wiring when `ATTESTOR_OBSERVABILITY_SECRET_MODE=external-secret`
- dry-runs the full `render:observability-release-bundle` pipeline
- then runs both `probe:observability-receivers` and `probe:alert-routing` so OTLP flush, API auth, and Alertmanager fanout validation are part of the same promotion gate

Promotion packet:

- `npm run render:observability-promotion-packet -- --provider=<generic|grafana-cloud|grafana-alloy> --benchmark=.attestor/observability/calibration/latest/benchmark.json --prometheus-url=http://127.0.0.1:9090 --alertmanager-url=http://127.0.0.1:9093`
  - renders the release bundle into a stable output directory
  - runs the full observability release preflight
  - summarizes missing managed-backend inputs, promotion readiness, and recommended apply flow in one checkpoint packet
- `npm run render:production-readiness-packet -- --observability-provider=<generic|grafana-cloud|grafana-alloy> --observability-benchmark=.attestor/observability/calibration/latest/benchmark.json --ha-provider=<generic|aws|gke> --ha-benchmark=.attestor/ha-calibration/latest.json --prometheus-url=http://127.0.0.1:9090 --alertmanager-url=http://127.0.0.1:9093`
  - reuses the observability and HA promotion packets
  - adds benchmark freshness gating for both benchmark files
  - emits one final readiness packet for environment promotion

Managed cloud secret bootstrap:

- `npm run render:secret-manager-bootstrap -- --provider=<aws|gke|all> --output-dir=.attestor/secret-bootstrap`
  - emits AWS IRSA and GKE Workload Identity `ClusterSecretStore` manifests
  - emits the exact remote secret catalog expected by the shipped observability + HA ExternalSecret overlays
  - emits a seed payload contract so the real values can be loaded into the cloud secret manager instead of git
  - keeps path-style remote keys on AWS and normalizes them into Google Secret Manager-safe ids on GKE while preserving the logical path in the generated catalog

External Secrets lifecycle tuning:

- `ATTESTOR_OBSERVABILITY_EXTERNAL_SECRET_STORE_KIND` (default `ClusterSecretStore`)
- `ATTESTOR_OBSERVABILITY_EXTERNAL_SECRET_REFRESH_INTERVAL` (default `1h`)
- `ATTESTOR_OBSERVABILITY_EXTERNAL_SECRET_CREATION_POLICY` (default `Owner`)
- `ATTESTOR_OBSERVABILITY_EXTERNAL_SECRET_DELETION_POLICY` (optional)

Managed collector rollout:

- `ops/kubernetes/observability/` now ships a gateway-style Collector Deployment with HPA, PDB, RBAC, `k8sattributes`, and `resourcedetection`
- `ops/kubernetes/observability/providers/grafana-alloy/` is now the recommended managed production runtime and swaps the gateway to `grafana/alloy` via `bin/otelcol`
- `ops/kubernetes/observability/providers/grafana-cloud/` remains the upstream-collector compatibility path using Collector `basicauth` with endpoint/username/token secrets instead of a raw Authorization header
- `ops/kubernetes/observability/providers/external-secrets/` ships `ExternalSecret` templates for the Grafana Cloud collector secret and Alertmanager routing secret
- the current live GKE runtime path is Attestor API/worker -> `attestor-observability-receiver.attestor-observability.svc.cluster.local:4318` -> Grafana Alloy -> managed backend, so `GET /api/v1/admin/telemetry` is the fastest way to separate app-runtime OTLP wiring from downstream destination credential issues
- the current recommended managed-backend auth shape is a **single Grafana Cloud OTLP gateway** (`otlp-gateway-.../otlp`) with the stack's Grafana tenant id as the basic-auth username, not the older split Prometheus/Loki/Tempo tenant-id pattern
- `benchmark:observability` is the intended last-mile tuning bridge before calling the shipped SLO/retention defaults production-final

Boundary:

- This is a shipped operator bundle and collector gateway rollout, not a fully managed hosted observability service.
- Default retention and SLO thresholds are opinionated first production defaults and should still be tuned against real traffic and compliance requirements.
- Production paging destinations still require environment-specific webhook/SMTP credentials and escalation policy choices.
- The local Loki/Tempo backends use local filesystem storage for evaluation and shadow rehearsal. Production storage, encryption-at-rest, and backup/restore evidence remain live ops proof unless the managed-backend provider path is used and probed.
- Local collector-to-Loki/Tempo traffic defaults to in-cluster plaintext behind NetworkPolicy. Limited enforcement needs service-mesh mTLS, managed backend TLS, or an explicit accepted-risk proof.
