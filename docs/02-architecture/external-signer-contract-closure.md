# External Signer Contract Closure

Status: repository-side contract closure for Attestor unlock step 03. This is
not a live Google Cloud KMS adapter, not external key custody evidence, and not
a production readiness claim.

## Decision

The external release signer contract is closed enough for the first provider
adapter PR to start. Future signer adapters must satisfy the tenant signer
boundary through a structured live provider proof envelope, not through a local
PEM key, a generic `external-kms` string, or a bare
`liveProviderVerified=true` boolean.

The first real adapter target remains Google Cloud KMS with:

```text
providerClass: gcp-kms
portable release algorithm: Ed25519 / EdDSA
provider native algorithm: EC_SIGN_ED25519
provider sign input mode: raw
minimum promotion protection posture: hsm or stronger
```

## Closed Contract

`src/service/bootstrap/release-tenant-signer-boundary.ts` now treats the live
provider proof as the promotion boundary. A proof must bind:

- tenant id by digest
- key reference by digest
- key id
- release-token algorithm
- provider-native signing algorithm
- provider sign input mode
- provider protection level
- standard Attestor challenge digest
- signature digest
- verification digest
- provider sign request digest
- provider response digest
- signed and verified timestamps
- verification result
- raw provider response redaction state

The descriptor records the provider protection level plus provider request and
response digests. It still stores no raw tenant id, raw key reference, raw
payload, raw provider response, credential value, or provider body.

## Fail-Closed Rules

The contract remains blocked when:

- the live proof is missing
- the proof is stale
- the proof timestamp is in the future
- signature verification failed
- the proof descriptor does not match tenant, key, algorithm, provider-native
  algorithm, input mode, public key reference, or challenge digest
- provider protection level is `software` or `unknown`
- the provider algorithm is unsupported
- key id contains the raw tenant id
- confidential signing is requested without attestation evidence
- a fake external KMS signer is used outside tests

These failures produce machine-readable blockers such as
`live-provider-proof-stale`, `live-provider-proof-descriptor-mismatch`,
`live-provider-proof-verification-failed`, and
`live-provider-protection-level-insufficient`.

## Fake Adapter Boundary

The fake external KMS signer remains test-only. It can satisfy the static
descriptor contract for conformance testing, but it carries
`fake-external-kms-test-only` and cannot satisfy production readiness. It is
useful for checking tenant digest binding, payload digest binding, provider
algorithm/input-mode binding, and raw-material redaction before a live provider
adapter exists.

## Diagnostics Boundary

The release signing provider runtime still supports only:

```text
runtime-ephemeral
file-pem
external-kms
```

`external-kms` still fails closed in runtime bootstrap until a real provider is
wired into runtime release-token issuance. Step 04 adds the first Google Cloud
KMS proof adapter, but bootstrap still refuses to fall back to local signing
material until issuance itself is external-signer-backed.

Step 04 may add a provider-specific Google Cloud KMS runtime path, but it must
use this proof contract and must not silently fall back to `file-pem` or
`runtime-ephemeral`.

## Primary Source Anchors

Reviewed on 2026-05-16:

- Google Cloud KMS documents `EC_SIGN_ED25519`, the asymmetric signing API,
  and protection levels. These anchor the GCP proof fields for provider-native
  algorithm, raw input mode, request/response digesting, and protection level:
  [Google Cloud KMS algorithms](https://cloud.google.com/kms/docs/algorithms),
  [Cloud KMS asymmetricSign](https://cloud.google.com/kms/docs/reference/rest/v1/projects.locations.keyRings.cryptoKeys.cryptoKeyVersions/asymmetricSign),
  [Cloud KMS protection levels](https://cloud.google.com/kms/docs/protection-levels).
- AWS KMS documents `ED25519_SHA_512` and `MessageType` for raw-vs-digest
  signing. This remains the second-provider capability comparison anchor:
  [AWS KMS Sign](https://docs.aws.amazon.com/kms/latest/APIReference/API_Sign.html).
- Azure Key Vault documents digest-based sign inputs and ES*/PS*/RS*/HS*
  algorithms. This keeps Azure out of the first Ed25519 adapter path:
  [Azure Key Vault Sign](https://learn.microsoft.com/en-us/rest/api/keyvault/keys/sign/sign).

These anchors are contract-design evidence only. They do not prove a live
provider call.

## Non-Claims

This contract closure does not claim:

- live Google Cloud KMS signing
- external KMS/HSM custody
- customer-owned key custody
- production readiness
- multi-cloud signer support
- confidential-compute signing
- public transparency-log inclusion

It only closes the repository-side proof envelope and diagnostics contract that
the first real provider adapter must satisfy.
