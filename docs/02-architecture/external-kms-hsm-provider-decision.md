# External KMS/HSM Provider Decision

Status: repository-side provider decision for Attestor unlock step 02. This is
not a live KMS/HSM adapter, not external key custody evidence, and not a
production readiness claim.

## Decision

Implement the first real external release signer adapter against **Google Cloud
KMS**.

The first adapter target is:

```text
providerClass: gcp-kms
portable release algorithm: Ed25519 / EdDSA
provider native algorithm: EC_SIGN_ED25519
provider sign input mode: raw
minimum promotion protection posture: HSM-backed or stronger provider proof
```

The adapter must fail closed unless the live provider proof records the selected
key version, provider-native algorithm, input mode, protection level, sign
request digest, signature digest, verification digest, and raw-provider-response
redaction state.

AWS KMS remains the second compatible adapter candidate. Azure Key Vault or
Azure Managed HSM remains a future ES256/PS256 or algorithm-migration candidate,
not the first Ed25519 release-token adapter.

## Why GCP First

The current repo already has a GKE-oriented production rehearsal path and Google
Secret Manager / External Secrets deployment posture. Choosing Google Cloud KMS
keeps the first live signer proof in the same cloud boundary as the existing
rehearsal target instead of adding cross-cloud credential handling before the
first external signer is proven.

Google Cloud KMS also fits the current tenant signer contract cleanly:

- the repo's current release-token signing posture centers Ed25519 / EdDSA
- Google Cloud KMS documents `EC_SIGN_ED25519`
- the `asymmetricSign` API accepts raw `data` for Ed25519 instead of forcing an
  ES/PS digest-signing path
- key versions expose a protection level that a digest-only live proof can bind
  without exposing key material or provider bodies
- the same provider family can later evaluate HSM, HSM single-tenant, EKM, or
  external VPC custody posture without changing the release-token algorithm

This is a sequencing choice, not a claim that Google Cloud KMS is universally
better than AWS KMS.

## Provider Matrix

| Provider | Decision | Ed25519 / EdDSA fit | Input-mode fit | Key custody posture | Reason |
|---|---|---|---|---|---|
| Google Cloud KMS | first adapter | Supported as `EC_SIGN_ED25519` in the current repo capability map and official algorithm docs. | Raw `data` signing for Ed25519 matches the Attestor EdDSA path. | Must prove HSM-backed or stronger selected key version before promotion; SOFTWARE is evaluation-only for this boundary. | Best fit for current GKE rehearsal posture and Ed25519 path. |
| AWS KMS | second adapter | Supported as `ED25519_SHA_512` in the current repo capability map and official signing docs. | `MessageType=RAW` is required for Ed25519 signing. | Strong external KMS candidate, but AWS custom key stores do not support asymmetric KMS keys, so customer-operated CloudHSM-through-KMS is not the first path. | Good follow-up provider after the GCP proof contract is live. |
| Azure Key Vault | not first | Current repo policy does not mark Azure Ed25519 as supported. | Sign operation signs a caller-provided digest for ES*/PS*/RS* algorithms. | Good managed key boundary for supported algorithms, but not the current Ed25519 path. | Requires ES256/PS256 release-token path or algorithm migration first. |
| Azure Managed HSM | not first | Same Ed25519 limitation for the current release-token path. | ES256/ES384/PS256 digest signing can fit a future non-EdDSA path. | Single-tenant HSM is attractive for a future Azure-specific path. | Keep in matrix, but do not block the first Ed25519 adapter on Azure. |
| Confidential compute signer | later | Depends on the selected provider and attestation mechanism. | Must bind attestation evidence to the signer proof. | Strong future option for confidential-attested tenant KMS. | Not the first adapter; first close external signer custody and sign/verify proof. |

## Required First Adapter Contract

Step 04 must not wire a generic `external-kms` fallback. It must expose a
provider-specific contract for Google Cloud KMS:

- selected key version resource name recorded only by digest or stable key id
  where safe
- tenant id and key reference never stored raw in public diagnostics
- provider-native algorithm pinned to `EC_SIGN_ED25519`
- provider sign input mode pinned to `raw`
- protection level recorded and evaluated against the selected promotion policy
- sign request digest and verification digest recorded without raw payloads
- raw provider request or response bodies not stored
- live sign/verify proof freshness enforced by the existing tenant signer proof
  max-age rule
- no local PEM fallback when the provider is configured
- startup and readiness fail closed when the selected provider or proof is
  missing, stale, mismatched, or downgraded

## No-Go Conditions

Do not start Step 04 if any of these remain unresolved:

- the selected Google Cloud KMS key version cannot use `EC_SIGN_ED25519`
- the adapter cannot prove raw-vs-digest input mode
- the proof cannot bind provider-native algorithm and protection level
- the proof would expose raw tenant id, raw key reference, raw payload, provider
  request body, provider response body, credential value, or database URL
- the runtime can silently fall back to `file-pem` or `runtime-ephemeral`
- verification requires trusting a bare `liveProviderVerified=true` boolean
- the PR would claim production readiness from a single provider adapter

## Repository Changes This Decision Enables

The next implementation PR should update the existing signer boundary without
changing Attestor's public product shape:

```text
src/service/bootstrap/release-tenant-signer-boundary.ts
src/service/bootstrap/release-signing-provider.ts
tests/production-tenant-signer-boundary.test.ts
tests/production-release-signing-provider.test.ts
docs/03-governance/cryptography-policy.md
docs/08-deployment/production-readiness.md
```

The likely new code should be small and provider-specific. A broad multi-cloud
abstraction should wait until at least one real provider is wired and verified.

## Primary Source Anchors

Reviewed on 2026-05-16:

- Google Cloud KMS documents `EC_SIGN_ED25519` and the asymmetric signing API
  with raw `data` or digest inputs: [Google Cloud KMS algorithms](https://cloud.google.com/kms/docs/algorithms),
  [Cloud KMS asymmetricSign](https://cloud.google.com/kms/docs/reference/rest/v1/projects.locations.keyRings.cryptoKeys.cryptoKeyVersions/asymmetricSign).
- Google Cloud KMS documents protection levels including software, HSM,
  HSM single-tenant, external, and external VPC options: [Cloud KMS protection
  levels](https://cloud.google.com/kms/docs/protection-levels).
- AWS KMS documents `ED25519_SHA_512` for signing and requires `MessageType`
  to distinguish raw messages from digests: [AWS KMS Sign](https://docs.aws.amazon.com/kms/latest/APIReference/API_Sign.html).
- AWS KMS custom key store documentation keeps asymmetric-key limitations
  relevant when comparing customer-operated HSM options: [AWS KMS key stores](https://docs.aws.amazon.com/kms/latest/developerguide/key-store-overview.html).
- Azure Key Vault documents digest-based sign inputs and ES*/PS*/RS*/HS*
  algorithm ids, while current Attestor policy does not mark Ed25519 as
  supported for Azure: [Azure Key Vault Sign](https://learn.microsoft.com/en-us/rest/api/keyvault/keys/sign/sign),
  [Azure Key Vault key details](https://learn.microsoft.com/en-us/azure/key-vault/keys/about-keys-details),
  [Azure Managed HSM](https://learn.microsoft.com/en-us/azure/key-vault/managed-hsm/overview).

These anchors are provider-selection evidence only. They do not prove that any
Attestor deployment has called those providers.

## Non-Claims

This decision does not claim:

- live Google Cloud KMS signing
- external KMS/HSM custody for Attestor
- customer-owned key custody
- production readiness
- multi-cloud signer support
- confidential-compute signing
- Azure or AWS adapters

It only selects the first provider and the minimum contract the first adapter
must satisfy.
