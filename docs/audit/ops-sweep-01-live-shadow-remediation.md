# Ops Sweep 01 Live Shadow Remediation

Status: repo-side remediation complete for Ops Sweep 01; live ops proof still required

This record covers repository-side hardening after Ops Sweep 01. It does not
claim ops readiness, live shadow readiness, production readiness, or enterprise
readiness.

## Scope

- `ops/kubernetes/ha/api-deployment.yaml`
- `ops/kubernetes/ha/worker-deployment.yaml`
- `ops/kubernetes/ha/worker-serviceaccount.yaml`
- `ops/kubernetes/ha/kustomization.yaml`
- `scripts/probe-ha-release-inputs.ts`
- `scripts/render-ha-release-bundle.ts`
- HA Kubernetes and release-bundle tests
- `ops/kubernetes/ha/networkpolicy.yaml`
- `ops/kubernetes/ha/providers/gke/gcpbackendpolicy.yaml`
- `ops/kubernetes/ha/providers/external-secrets/clustersecretstore.gke.example.yaml`
- `scripts/check/check-ops-live-shadow-readiness.mjs`

## External Anchors

- NIST SP 800-218 SSDF: repository-side verification and release evidence.
- NIST CSF 2.0 Govern: policy and oversight before live deployment.
- Kubernetes security context documentation: non-root and privilege controls.
- Kubernetes NetworkPolicy documentation: network isolation remains cluster
  policy and needs live CNI proof.
- GKE Gateway/Cloud Armor documentation: HTTPS listener and security policy
  wiring need environment-specific proof.

## Findings Addressed

### OPS-03 - Worker pod uses default ServiceAccount

- Previous state: open, repo-proven.
- New state: fixed repo-side.
- Repository evidence: `worker-serviceaccount.yaml` defines
  `attestor-worker-runtime` with `automountServiceAccountToken: false`;
  `worker-deployment.yaml` sets `serviceAccountName:
  attestor-worker-runtime`.
- Why applicable: worker compromise should not inherit the namespace default
  ServiceAccount.
- Why not overclaimed: this does not prove GCP IAM least privilege; the worker
  currently receives no Workload Identity annotation in the static manifest.

### OPS-07 - Hosted MFA encryption key optional in HA API manifest

- Previous state: open, partial-repo.
- New state: fixed repo-side.
- Repository evidence: `ATTESTOR_ACCOUNT_MFA_ENCRYPTION_KEY` no longer uses
  `optional: true` in the API deployment.
- Why applicable: hosted MFA encryption key is production-required by runtime
  behavior and should not be optional in the HA manifest.
- Why not overclaimed: this does not prove the external secret backend contains
  the key; that still requires ops proof.

### OPS-06 - Tag-only image refs in live HA promotion path

- Previous state: open, repo-proven for static manifests.
- New state: fixed for rendered live HA release path.
- Repository evidence: `probe-ha-release-inputs.ts` and
  `render-ha-release-bundle.ts` reject production HA image refs that are not
  digest-pinned.
- Why applicable: live shadow should not depend on mutable image tags.
- Why not overclaimed: static bootstrap manifests still use example tags and are
  not a live-shadow release contract.

### OPS-01 - Active base Gateway is HTTP bootstrap

- Previous state: open / needs ops proof.
- New state: repo-side proof-gated; live closure requires proof.
- Repository evidence: the base Gateway remains HTTP bootstrap, but the rendered
  HA release bundle rewrites GKE routes to the HTTPS Gateway listener and the HA
  README marks HTTP bootstrap as not live-shadow ready. The live gate requires
  `ATTESTOR_LIVE_SHADOW_HTTPS_PROOF=verified` before a live-shadow claim.
- Why applicable: public live shadow traffic must use HTTPS.
- Why not overclaimed: the active static bootstrap manifest is still HTTP by
  design; live closure requires applying and probing the rendered HTTPS bundle.

### OPS-02 - ClusterSecretStore backend proof

- Previous state: open / needs ops proof.
- New state: repo-side proof-gated; live closure requires proof.
- Repository evidence: `clustersecretstore.gke.example.yaml` shows a GCP Secret
  Manager `ClusterSecretStore` using Workload Identity, and the live gate
  requires `ATTESTOR_CLUSTER_SECRET_STORE_PROOF=verified`.
- Why applicable: live shadow cannot rely on an implicit external secret store.
- Why not overclaimed: the manifest is an example; the target cluster must apply
  a real store and prove ExternalSecret sync.

### OPS-04 - No NetworkPolicy in ops

- Previous state: open, repo-proven.
- New state: fixed repo-side; live closure requires proof.
- Repository evidence: `networkpolicy.yaml` is now part of the HA
  kustomization. It defines default deny, API and worker health ingress, DNS,
  observability, Cloud SQL proxy, Redis, and HTTPS egress allowlists.
- Why applicable: live shadow needs explicit network isolation or an equivalent
  cluster-level policy.
- Why not overclaimed: CNI enforcement and target environment reachability still
  need a live test, enforced by `ATTESTOR_NETWORK_POLICY_PROOF=verified`.

### OPS-05 - CloudArmor WAF in example only

- Previous state: open, repo-proven.
- New state: fixed repo-side; live closure requires proof.
- Repository evidence: active `gcpbackendpolicy.yaml` references
  `securityPolicy: attestor-api-armor-policy`, and the live gate requires
  `ATTESTOR_EDGE_WAF_PROOF=verified`.
- Why applicable: live shadow should not leave edge L7 policy implicit.
- Why not overclaimed: the named Cloud Armor policy must exist and be attached
  in the target project.

## Verification

- `npm run test:kubernetes-ha-bundle`
- `npm run test:ha-release-bundle-render`
- `npm run test:ha-release-input-probe`
- `npm run test:ops-live-shadow-readiness`
- `npm run check:ops-live-shadow`
- `npm run typecheck`
- `npm run typecheck:hygiene`

## Remaining No-Go Conditions

Live shadow remains `not proven` until:

- rendered HTTPS Gateway/route is applied and probed,
- ClusterSecretStore backend and Workload Identity binding are verified,
- GCP IAM least privilege is verified,
- NetworkPolicy or equivalent cluster isolation is documented and tested,
- CloudArmor/WAF decision is documented and, if enabled, probed,
- shared replay/introspection stores are live-tested across instances.

These are live proof requirements, not unresolved repository remediation for
Ops Sweep 01.
