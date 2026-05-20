# Attestor Kubernetes Observability Gateway Bundle

This bundle ships a Collector gateway rollout for Kubernetes, aligned with the
OpenTelemetry gateway deployment pattern.

It assumes:

- external or already-deployed Tempo, Loki, and Prometheus-compatible backends
- a cluster that can run a Deployment + HPA + PDB
- OTLP traffic from Attestor API/worker pods pointing at the gateway service

The bundle includes:

- Collector gateway `Deployment` with `2` replicas
- OTLP gRPC/HTTP `Service`
- `PodDisruptionBudget`
- `HorizontalPodAutoscaler`
- namespace-scoped `NetworkPolicy` resources with default deny plus explicit
  OTLP, metrics, DNS, local backend, and HTTPS egress allowlists
- `ServiceAccount` + `ClusterRole` + `ClusterRoleBinding` for the Kubernetes
  attributes processor
- `k8sattributes` + `resourcedetection` + `memory_limiter` + `batch`
  processors
- an explicit non-root collector security context. The ServiceAccount token is
  intentionally mounted because the Kubernetes attributes processor uses
  read-only Kubernetes metadata RBAC.
- Pod Security Admission namespace labels for the `restricted` profile.

Before applying it, replace:

- `tempo.attestor-observability.svc.cluster.local:4317`
- `http://loki.attestor-observability.svc.cluster.local:3100/otlp`
- `attestor-observability`

The base manifest keeps the local Tempo/Loki endpoint placeholders in the same
namespace as the collector gateway and ships namespace-scoped NetworkPolicy
resources so namespace-scoped NetworkPolicy proof does not silently diverge
from the rendered deployment. If a target cluster uses a shared `monitoring`
namespace, managed backend, service mesh, or a stricter egress gateway, render a
release bundle with explicit `ATTESTOR_OBSERVABILITY_TEMPO_OTLP_ENDPOINT` and
`ATTESTOR_OBSERVABILITY_LOKI_OTLP_ENDPOINT` values and include the final
NetworkPolicy or equivalent platform policy in live proof.

Typical apply flow:

```powershell
kubectl apply -k ops/kubernetes/observability
kubectl rollout status deployment/attestor-otel-gateway -n attestor-observability
```

Managed backend overlays:

- `kubectl apply -k ops/kubernetes/observability/providers/grafana-alloy`
- `kubectl apply -k ops/kubernetes/observability/providers/grafana-cloud`
- `kubectl apply -k ops/kubernetes/observability/providers/external-secrets`

These overlays rewire the gateway to export traces, metrics, and logs to a
managed OTLP backend while still keeping the local Prometheus scrape surface for
gateway health.

The Grafana Alloy overlay is the recommended production path and runs the
Grafana-supported Alloy OTel Engine (`grafana/alloy` + `bin/otelcol`) against
the same Collector-compatible OTLP pipeline. The Grafana Cloud overlay keeps the
upstream collector image path with Collector `basicauth`, and the External
Secrets overlay ships placeholder `ExternalSecret` resources for both collector
and Alertmanager routing credentials.

Retention/SLO tuning can now be rendered separately from benchmark data via:

- `npm run render:observability-profile -- --input=.attestor/observability/latest.json --profile=ops/observability/profiles/regulated-production.json`

And a self-contained release bundle can now be rendered via:

- `npm run render:observability-release-bundle -- --provider=<generic|grafana-cloud|grafana-alloy> --benchmark=.attestor/observability/latest.json --output-dir=.attestor/observability/release`
- `npm run probe:observability-release-inputs -- --provider=<generic|grafana-cloud|grafana-alloy> --benchmark=.attestor/observability/latest.json --prometheus-url=<url> --alertmanager-url=<url>`

That release bundle composes:

- the base Kubernetes collector gateway resources
- the managed-backend provider overlay
- rendered secret or `ExternalSecret` resources
- rendered Alertmanager routing config
- rendered SLO/rule/retention artifacts from the selected benchmark profile

Before calling the managed backend wiring production-ready, a rollout-near probe is also available:

- `npm run probe:observability-receivers -- --prometheus-url=<url> --alertmanager-url=<url>`
- `npm run probe:alert-routing`
- `npm run probe:observability-release-inputs -- --provider=<generic|grafana-cloud|grafana-alloy> --benchmark=.attestor/observability/latest.json --prometheus-url=<url> --alertmanager-url=<url>`
- `npm run render:observability-promotion-packet -- --provider=<generic|grafana-cloud|grafana-alloy> --benchmark=.attestor/observability/latest.json --prometheus-url=<url> --alertmanager-url=<url>`

That probe:

- emits real OTLP trace/log/metric traffic through the configured exporter env
- forces a telemetry flush
- checks Prometheus API auth with a lightweight instant query
- checks Alertmanager API auth with an alerts listing call
- simulates Alertmanager routing fanout for default/critical/warning/security/billing/watchdog alerts from the rendered config
- validates provider credentials plus External Secrets store/lifecycle inputs and dry-runs the full release-bundle render before probing receivers and route fanout
- emits a single promotion packet summary that captures readiness state, missing inputs, bundle location, and recommended apply flow
- `npm run render:production-readiness-packet -- --observability-provider=<generic|grafana-cloud|grafana-alloy> --observability-benchmark=.attestor/observability/latest.json --ha-provider=<generic|aws|gke> --ha-benchmark=.attestor/ha-calibration/latest.json --prometheus-url=<url> --alertmanager-url=<url>`
  - emits one combined environment-promotion packet that fuses observability and HA readiness, including benchmark freshness gating
- `npm run render:secret-manager-bootstrap -- --provider=<aws|gke|all> --output-dir=.attestor/secret-bootstrap`
  - emits AWS IRSA and GKE Workload Identity `ClusterSecretStore` manifests plus the exact remote secret catalog expected by the observability ExternalSecret overlay
