# Ops Sweep 07 - Profiles, Provider Overlays, And Live Proof Capture

Status: repository remediation landed in this branch; live proof remains outside
the repository.

This report validates and remediates the Sweep 07 intake against
`origin/master @ 1ea495a39ff06d4ce9ff009234ee70d1d911054d`. It does not claim
live-shadow readiness, production readiness, enterprise readiness, or provider
deployment completion.

## 0. Recent Fixes Chain-Effect Check

Previous merge:

- PR #513 / merge `1ea495a39ff06d4ce9ff009234ee70d1d911054d`
  - scope: OPS-SWEEP-06 admin route authorization
  - files touched: `src/service/**`, admin route tests, audit indexes

Chain-effect verdict:

- Direct regression into Sweep 07 scope: none. PR #513 did not modify
  profile renderers, provider overlays, KEDA manifests, observability provider
  overlays, or `scripts/check/check-ops-live-shadow-readiness.mjs`.
- Defense-in-depth weakening: none. PR #513 added admin live proof entries and
  did not relax existing ops gates.
- Docs/index drift: intentional. `control-map.md` now points to remaining
  profiles, provider overlays, and live proof capture, which is this sweep.

## 1. Validation Frame

| Field | Value |
|---|---|
| Source of truth | `origin/master @ 1ea495a39ff06d4ce9ff009234ee70d1d911054d` |
| Phase | Phase 1 - Live Shadow Readiness |
| Baseline blocker | Ops/IAM/K8s/secrets review and remaining provider/live proof capture |
| Protected principles | runtime readiness; operational boundedness; auditability; release provenance; fail-closed boundary; data minimization and redaction; no overclaim |
| Scope | HA profiles, AWS/GKE/KEDA provider overlays, observability Grafana provider overlays, observability profile renderer, and live proof gate/register alignment |

External anchors used as implementation references:

- AWS Load Balancer Controller ingress annotations: TLS certificate ARN,
  SSL policy, listener ports, SSL redirect, and WAFv2 annotation contracts.
  <https://kubernetes-sigs.github.io/aws-load-balancer-controller/v2.11/guide/ingress/annotations/>
- KEDA Redis Lists scaler docs: `enableTLS` and `TriggerAuthentication`.
  <https://keda.sh/docs/2.19/scalers/redis-lists/>
- KEDA Prometheus scaler docs: bearer/TLS/basic auth through
  `authenticationRef`.
  <https://keda.sh/docs/2.19/scalers/prometheus/>
- Kubernetes Kustomize Secret docs: `kubectl apply -k` applies generated or
  listed resources, so placeholder Secret manifests must not be applyable
  defaults.
  <https://kubernetes.io/docs/tasks/configmap-secret/managing-secret-using-kustomize/>

These anchors support implementation shape only. They are not certification
claims.

## 2. Inspected Files

| Path | Depth | Why |
|---|---|---|
| `scripts/render-ha-profile.ts` | full | HA profile output behavior and SLO summary |
| `scripts/render-observability-profile.ts` | full | SLO burn-rate rule generation and zero-budget divisor risk |
| `scripts/check/check-ops-live-shadow-readiness.mjs` | full | live proof env gate vs register alignment |
| `ops/kubernetes/ha/providers/aws/**` | full | AWS ALB HTTPS/WAF parity |
| `ops/kubernetes/ha/providers/gke/**` | targeted | GKE parity reference |
| `ops/kubernetes/ha/providers/keda/**` | full | Redis TLS and Prometheus auth boundary |
| `ops/kubernetes/ha/profiles/**` | full | renderer contract and AKS limitation |
| `ops/kubernetes/observability/providers/{grafana-cloud,grafana-alloy,external-secrets}/**` | full | placeholder secret safety and External Secrets path |
| `ops/observability/prometheus/alerts.yml` | targeted | SLO burn-rate alert wiring |
| `docs/audit/{current-posture-baseline,finding-index,report-index,control-map,live-proof-register}.md` | targeted | evidence index reconciliation |
| `tests/{ops-live-shadow-readiness,kubernetes-ha-bundle,kubernetes-observability-bundle,observability-profile-render}.test.ts` | full/targeted | regression coverage |

## 3. Finding Disposition

| ID | Intake state | Validation result | Remediation |
|---|---|---|---|
| OPS-65 live proof gate/register drift | P1 open | repo-proven | Closed repo-side. `LIVE_PROOF_FLAGS` now covers every `required` or `repo-gated` register entry with stage-aware live-shadow / limited-enforcement gating. |
| OPS-66 observability placeholder Secret applied as resource | P1 open | repo-proven | Closed. Grafana Cloud and Alloy kustomizations no longer apply `secret-template.yaml`; READMEs direct operators to External Secrets or environment-owned Secrets. |
| OPS-67 profile renderer emits on SLO miss | P2 accepted limitation | repo-proven accepted limitation | Documented. Renderers intentionally emit review artifacts; READMEs warn not to apply failed-SLO output without an operator decision. |
| OPS-68 generated SLO alerts not wired | P2 open | contradicted by repo | Disputed/closed. Current `ops/observability/prometheus/alerts.yml` already contains `AttestorAvailabilityErrorBudget*` and `AttestorLatencyErrorBudget*`, and existing tests lock them. |
| OPS-69 AWS HA overlay HTTPS/WAF parity gap | P1 open | repo-proven | Closed repo-side. Added AWS HTTPS/WAF example and provider README; live ACM/WAF proof still required. |
| OPS-70 AKS/Azure parity absence | P2 accepted limitation | repo-proven accepted limitation | Documented in provider README; no AKS parity claim is made. |
| OPS-71 observability profile zero-budget divisor | P2 open | repo-proven | Closed. Renderer rejects targets that produce no non-zero rounded error budget before writing Prometheus rules. |
| OPS-72 KEDA Redis TLS / Prometheus auth boundary | P2 open | repo-proven | Closed repo-side. Added KEDA README boundary, Redis TLS example, Prometheus TriggerAuthentication example, and proof flags. |

## 4. Remediation Summary

Repository changes:

- Expanded `scripts/check/check-ops-live-shadow-readiness.mjs` to gate all live proof
  register entries through explicit env flags.
- Added `--stage=live-shadow|limited-enforcement|enterprise-pilot` for
  cumulative proof gating without forcing Phase 2 customer PEP/KMS proof into
  a Phase 1 live-shadow check.
- Added AWS HTTPS/WAF example and AWS provider README.
- Removed placeholder Grafana Cloud / Grafana Alloy Secret templates from
  kustomize `resources`.
- Added KEDA Redis TLS and Prometheus auth examples, plus README proof
  boundaries.
- Added observability profile error-budget validation.
- Documented renderer emit-on-fail behavior and AKS/Azure non-claim.
- Updated audit indexes and baseline to reconcile OPS-65..OPS-72.

## 5. Chain-Effect Check

| Surface | Effect |
|---|---|
| Direct regression | None expected. Changes are scoped to ops docs/manifests, profile renderer validation, live proof gate, and tests. |
| Downstream caller breakage | `check:ops-live-shadow -- --mode=live` is stricter because it now requires all live-shadow proof flags. This is intentional no-overclaim behavior. |
| Defense-in-depth | Strengthened. Placeholder Secrets are no longer applyable resources; live proof gates now align with the register. |
| Config/manifest drift | Reduced by AWS/KEDA examples and register/gate alignment. |
| Docs drift | Reduced by updating baseline, finding index, report index, control map, and live proof register. |
| Test coverage drift | Reduced by targeted tests for live proof stages, AWS/KEDA examples, placeholder Secret safety, and zero-budget profile rejection. |
| Closed finding reopened | OPS-68 is explicitly disputed/closed because current repo evidence already wires burn-rate alerts. |

## 6. Live Proof Flags After Sweep 07

Live-shadow stage now requires:

- `ATTESTOR_LIVE_SHADOW_HTTPS_PROOF`
- `ATTESTOR_CLUSTER_SECRET_STORE_PROOF`
- `ATTESTOR_NETWORK_POLICY_PROOF`
- `ATTESTOR_EDGE_WAF_PROOF`
- `ATTESTOR_GCP_IAM_LEAST_PRIVILEGE_PROOF`
- `ATTESTOR_RELEASE_RUNTIME_PKI_STORAGE_PROOF`
- `ATTESTOR_TLS_MATERIAL_SOURCE_PROOF`
- `ATTESTOR_OBSERVABILITY_ALERT_DELIVERY_PROOF`
- `ATTESTOR_OBSERVABILITY_BACKEND_AUTH_PROOF`
- `ATTESTOR_OBSERVABILITY_STORAGE_PROOF`
- `ATTESTOR_BUDGET_ALERTING_PROOF`
- `ATTESTOR_SHARED_REPLAY_STORE_PROOF`
- `ATTESTOR_POSTGRES_PITR_OFFSITE_PROOF`
- `ATTESTOR_REDIS_AUTH_BOUNDARY_PROOF`
- `ATTESTOR_OBSERVABILITY_POD_SECURITY_PROOF`
- `ATTESTOR_ADMIN_ACTOR_ROLE_SPLIT_PROOF`
- `ATTESTOR_ADMIN_RATE_LIMIT_PROOF`
- `ATTESTOR_KEDA_REDIS_TLS_PROOF`
- `ATTESTOR_KEDA_PROMETHEUS_AUTH_PROOF`

Limited-enforcement stage additionally requires:

- `ATTESTOR_SHARED_INTROSPECTION_STORE_PROOF`
- `ATTESTOR_CUSTOMER_PEP_NO_BYPASS_PROOF`
- `ATTESTOR_KMS_RUNTIME_SIGNING_PROOF`
- `ATTESTOR_DEGRADED_MODE_OUTAGE_PROOF`

## 7. Remaining Limitations

- Repository-side provider examples do not prove live AWS/GKE/IAM/WAF/secret
  manager state.
- KEDA examples do not prove live Redis TLS posture or Prometheus query
  authentication.
- External KMS/HSM signing, customer PEP no-bypass, shared replay store, shared
  introspection store, and degraded-mode outage behavior still require live
  proof.
- Azure / AKS is not supported in this repo state and must not be claimed.
- The AWS HTTPS manifest uses placeholders only; real ARNs stay outside the
  repository.

## 8. Verification Plan

Targeted repo checks for this remediation:

- `npm run test:ops-live-shadow-readiness`
- `npm run test:kubernetes-ha-bundle`
- `npm run test:kubernetes-observability-bundle`
- `npm run test:observability-profile-render`
- `npm run test:security-evidence-system`
- `npm run test:audit-finding-evidence`
- `npm run check:security-evidence-system`
- `npm run check:baseline-alignment`
- `npm run typecheck`
- `npm run typecheck:hygiene`
- `git diff --check`

Tier 4 `npm run verify` is not required for this docs/manifests/profile/gate
slice unless CI or follow-up evidence shows broader runtime drift.

## 9. Verdict

- Sweep 07 is complete repo-side for OPS-65, OPS-66, OPS-69, OPS-71, and
  OPS-72.
- OPS-67 and OPS-70 remain accepted limitations.
- OPS-68 is disputed/closed by current repository evidence.
- No production-ready, enterprise-ready, or live-shadow-ready claim is made.
- Remaining work is live proof capture and the next scoped ops sweep.
