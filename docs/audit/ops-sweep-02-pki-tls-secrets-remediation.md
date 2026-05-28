# Ops Sweep 02 PKI/TLS/Secrets Remediation

Status: repo-side remediation complete for Ops Sweep 02; live ops proof still
required.

This record covers repository-side hardening after Ops Sweep 02. It does not
claim live-shadow readiness, production readiness, or enterprise readiness.

## Scope

- `ops/kubernetes/ha/release-runtime-pki-pvc.yaml`
- `ops/kubernetes/ha/README.md`
- `ops/kubernetes/ha/providers/cert-manager/README.md`
- `ops/kubernetes/ha/providers/external-secrets/README.md`
- `scripts/check/check-ops-live-shadow-readiness.mjs`
- `scripts/probe-ha-release-inputs.ts`
- `scripts/render-ha-release-bundle.ts`
- HA Kubernetes, release-bundle, release-probe, and ops live-shadow tests

## External Anchors

- Kubernetes PersistentVolumeClaim and StorageClass documentation:
  <https://kubernetes.io/docs/concepts/storage/persistent-volumes/>
- Kubernetes NetworkPolicy documentation:
  <https://kubernetes.io/docs/concepts/services-networking/network-policies/>
- cert-manager Certificate documentation:
  <https://cert-manager.io/docs/usage/certificate/>
- External Secrets Operator Google Secret Manager provider documentation:
  <https://external-secrets.io/latest/provider/google-secrets-manager/>
- Google Kubernetes Engine Gateway and backend policy documentation:
  <https://cloud.google.com/kubernetes-engine/docs/how-to/configure-gateway-resources>

## Finding Reconciliation

### OPS-06 - Static image tags

- Previous Sweep 02 state: listed as still open.
- Current state: contradicted for the live HA promotion path.
- Repository evidence: `probe-ha-release-inputs.ts` and
  `render-ha-release-bundle.ts` reject tag-only images for HA promotion and
  production HA release bundles; static manifests remain bootstrap examples.
- Why not overclaimed: static bootstrap tags are still present and are not a
  live-shadow release contract.

### OPS-07 - MFA encryption key optional

- Previous Sweep 02 state: listed as still open.
- Current state: closed.
- Repository evidence: `api-deployment.yaml` no longer marks
  `account-mfa-encryption-key` optional, and the ops live-shadow gate verifies
  this invariant.
- Why not overclaimed: this does not prove the target secret backend actually
  contains the key.

## Findings Addressed

### OPS-17 - Release-runtime PKI PVC storage boundary

- Previous state: open, repo-proven.
- New state: fixed repo-side; live closure requires proof.
- Repository evidence: `release-runtime-pki-pvc.yaml` now uses an explicit
  `storageClassName: attestor-release-runtime-pki-rwx`, labels the storage
  boundary, and names the live proof flag
  `ATTESTOR_RELEASE_RUNTIME_PKI_STORAGE_PROOF`.
- Additional evidence: `probe-ha-release-inputs.ts` requires
  `ATTESTOR_RELEASE_RUNTIME_PKI_STORAGE_CLASS`; `render-ha-release-bundle.ts`
  requires and injects that StorageClass for production HA release bundles.
- Why applicable: release-runtime PKI material is key-authority adjacent and
  must not silently inherit an unknown cluster default StorageClass.
- Why not overclaimed: this does not prove the target StorageClass is encrypted,
  backed up, RWX-capable, or non-exportable. External KMS/HSM remains the
  production signer blocker.

### OPS-18 - Parallel TLS material paths

- Previous state: open, repo-proven.
- New state: fixed repo-side as a deployment choice contract; live closure
  requires proof.
- Repository evidence: cert-manager and External Secrets README files now say
  not to apply both TLS paths together because both write `attestor-tls`.
  The live gate requires `ATTESTOR_TLS_MATERIAL_SOURCE_PROOF=verified`.
- Why applicable: two controllers writing the same TLS Secret can create
  operator confusion or last-writer-wins behavior.
- Why not overclaimed: the repository cannot prove which overlay the target
  cluster applied.

### OPS-19 / OPS-20 / OPS-24 - cert-manager placeholders and issuer ownership

- Previous state: open.
- New state: documented deployment contract; live closure requires proof.
- Repository evidence: the cert-manager README now states that
  `clusterissuer.example.yaml` is intentionally example-only and environment
  owned; hostname, issuer, and email must be replaced or rendered.
- Why applicable: placeholder DNS/email values must not be treated as deployable
  live-shadow evidence.
- Why not overclaimed: examples remain examples; rendered or applied live
  manifests must be verified separately.

### OPS-21 - Wildcard TCP 443 egress

- Previous state: open, repo-proven.
- New state: accepted limitation for the current HA overlay, documented and
  proof-gated.
- Repository evidence: HA README records that TCP 443 wildcard egress exists for
  external provider APIs and that higher-risk deployments should use service
  mesh, egress gateway, or equivalent domain-aware controls as part of
  `ATTESTOR_NETWORK_POLICY_PROOF`.
- Why applicable: if a pod is compromised, broad HTTPS egress can be used for
  exfiltration.
- Why not overclaimed: Stripe, identity, and model-provider integrations need
  external HTTPS; Kubernetes NetworkPolicy is IP/port oriented and does not
  provide domain-level policy by itself.

### OPS-22 - Cloud Armor policy referenced by name only

- Previous state: open / needs ops proof.
- New state: live-proof gated.
- Repository evidence: active GKE backend policy references
  `attestor-api-armor-policy`, and the live gate requires
  `ATTESTOR_EDGE_WAF_PROOF=verified`.
- Why applicable: the policy name alone does not prove WAF/rate-limit rules.
- Why not overclaimed: Cloud Armor policy definition and attachment are target
  project state, not repository state.

### OPS-23 - ExternalSecret refresh interval 1h

- Previous state: open, P3.
- New state: accepted limitation.
- Repository evidence: External Secrets README documents lifecycle tuning via
  `ATTESTOR_HA_EXTERNAL_SECRET_REFRESH_INTERVAL`; the probe validates interval
  syntax.
- Why applicable: rotated secrets can remain stale until the next refresh.
- Why not overclaimed: one hour is acceptable for this evaluation/live-shadow
  overlay when key rotation runbooks account for it.

## Verification

- `npm run check:ops-live-shadow`
- `npm run test:ops-live-shadow-readiness`
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
- CloudArmor/WAF policy rules and attachment are probed,
- release-runtime PKI StorageClass encryption/RWX/backup posture is verified,
- exactly one TLS material source is applied and verified,
- shared replay/introspection stores are live-tested across instances.

These are live proof requirements, not unresolved repository remediation for
Ops Sweep 02.
