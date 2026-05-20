# Ops Sweep 01 Live Shadow Remediation

Status: partial remediation for `origin/master`

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
- New state: proof-gated, not fully closed.
- Repository evidence: the base Gateway remains HTTP bootstrap, but the rendered
  HA release bundle rewrites GKE routes to the HTTPS Gateway listener and the HA
  README now marks HTTP bootstrap as not live-shadow ready.
- Why applicable: public live shadow traffic must use HTTPS.
- Why not overclaimed: the active static bootstrap manifest is still HTTP by
  design; live closure requires applying and probing the rendered HTTPS bundle.

## Findings Not Closed By This PR

- OPS-02 `ClusterSecretStore` backend proof: renderer support exists, but live
  closure requires the generated ClusterSecretStore and cloud IAM binding.
- OPS-04 NetworkPolicy: requires cluster-specific CNI, DNS, Redis, Postgres,
  OTel, and Cloud SQL egress decisions. Blind default-deny would risk breaking
  live shadow.
- OPS-05 CloudArmor: an example exists, but activation depends on project quota
  and named policy existence.

## Verification

- `npm run test:kubernetes-ha-bundle`
- `npm run test:ha-release-bundle-render`
- `npm run test:ha-release-input-probe`
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
