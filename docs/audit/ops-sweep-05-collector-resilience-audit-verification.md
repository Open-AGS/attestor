# Ops Sweep 05 - Collector Resilience And Audit Index Verification

## Validation Frame

- Current validation ref: `78e79a2208401dc140941af48a61baef97b7d1b9`
- Baseline phase: Phase 1 - Live Shadow Readiness
- Protected principles: runtime readiness, operational boundedness, auditability, no overclaim
- Source of truth: current `origin/master`, not local divergent files

## Sweep 04 Discrepancy Check

The Sweep 05 intake report used an older source ref for several checks. Current
`origin/master` contradicts the P0/P1 overclaim allegation for the indexed
Sweep 04 closures:

| Finding | Current repository evidence | Verdict |
|---|---|---|
| OPS-38 collector image tag | `ops/kubernetes/observability/deployment.yaml` uses `otel/opentelemetry-collector-contrib:0.152.0@sha256:...`; `tests/kubernetes-observability-bundle.test.ts` locks it. | `stale/closed` |
| OPS-39 Redis recovery auth | `ops/redis/redis-recovery.conf` uses `protected-mode yes`, an ACL file, and disables high-risk commands; `docker-compose.dr.yml` wires authenticated Redis. | `closed / live-proof-only` |
| OPS-40 PostgreSQL PITR local WAL archive | `ops/postgres/pitr/archive-wal.sh` exists, writes SHA-256 sidecars, and supports fail-closed offsite mirroring. | `partial / live-proof-only` |
| OPS-41 collector securityContext | `ops/kubernetes/observability/deployment.yaml` has pod/container security context hardening. | `closed` |
| OPS-44 backend namespace mismatch | Base collector endpoints use `tempo.attestor-observability.svc.cluster.local:4317` and `http://loki.attestor-observability.svc.cluster.local:3100/otlp`. | `closed for base bundle / live-proof-only` |

The P0 audit-governance claim is therefore `contradicted` for the current
repository state. The actionable remainder is the observability namespace
boundary around that collector bundle.

## Remediation

| ID | State | Repository change | Remaining limitation |
|---|---|---|---|
| OPS-54 | `closed / live-proof-only` | Added `ops/kubernetes/observability/networkpolicy.yaml` with default-deny and explicit OTLP, metrics, DNS, local backend, and HTTPS egress allowlists. The kustomization, readiness gate, renderer, and tests now require it. | Kubernetes NetworkPolicy requires a supporting CNI; live enforcement must be proven with `ATTESTOR_NETWORK_POLICY_PROOF`. |
| OPS-55 | `disputed/closed` | No Workload Identity annotation was added to the collector ServiceAccount. The base collector uses read-only Kubernetes metadata RBAC for `k8sattributes`; it does not call GCP APIs. | If a future collector path calls cloud APIs directly, add a scoped cloud identity binding then. |
| OPS-56 | `closed / live-proof-only` | Added restricted Pod Security Admission enforce/audit/warn labels to `ops/kubernetes/observability/namespace.yaml`. | Live Pod Security Admission behavior remains target-cluster proof. |

## Chain-Effect Check

- Direct regression: the collector keeps its intentional ServiceAccount token
  because `k8sattributes.auth_type: serviceAccount` still needs Kubernetes
  metadata RBAC.
- Downstream caller breakage: Attestor API/worker pods can still reach OTLP
  HTTP/gRPC on `4318`/`4317`; Prometheus-compatible scrapers can still reach
  `8889` from `monitoring`, `attestor`, or `attestor-observability`.
- Defense-in-depth: observability namespace moves from no namespace-local policy
  to default-deny plus explicit allowlists.
- Config/manifest drift: the release bundle renderer now emits the same
  NetworkPolicy and rewrites the self-namespace selector when
  `ATTESTOR_OBSERVABILITY_NAMESPACE` is overridden.
- Docs drift: finding index, report index, control map, live proof register, and
  Kubernetes observability README now describe the same boundary.
- Test coverage drift: `tests/kubernetes-observability-bundle.test.ts`,
  `tests/observability-release-bundle-render.test.ts`, and
  `scripts/check-ops-live-shadow-readiness.mjs` now check the new manifests.

## No-Claims

This remediation does not prove live CNI enforcement, managed backend auth,
Pod Security Admission enforcement in a target cluster, production readiness, or
enterprise readiness. Those remain live proof items.
