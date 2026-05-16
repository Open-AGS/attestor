# Cryptography Policy

Status: repository cryptography posture and key-management boundary.

This policy summarizes the code-level cryptography choices. It is not an HSM,
KMS, or customer key-management program.

Official anchors:

- [NIST SP 800-57 Part 1 Rev. 5](https://csrc.nist.gov/pubs/sp/800/57/pt1/r5/final)
- [FIPS 186-5](https://csrc.nist.gov/pubs/fips/186-5/final)
- [RFC 5280](https://datatracker.ietf.org/doc/html/rfc5280)

## Repository Posture

| Area | Current stance |
|---|---|
| Signing algorithm | Ed25519 for Attestor signing surfaces. |
| Verification | PKI-bound verification requires an out-of-band trusted CA fingerprint for independent third-party trust. |
| Certificate validity | Certificates carry validity windows and revocation inputs. |
| Fingerprints | Signing key fingerprints use widened truncated SHA-256 identity material per F5 validation. |
| Canonicalization | Attestor-specific strict canonical JSON; RFC 8785/JCS interoperability is not claimed. |
| Local key persistence | Key-pair persistence routes through atomic file writes where implemented by current helpers. |
| Legacy material | Legacy unbounded certificate acceptance is explicit, warning-bearing, and not the default. |
| Transparency | Public Rekor-style transparency log is not implemented or claimed. |
| KMS/HSM | External KMS/HSM custody remains future work unless a deployment implements and verifies it separately. |

## Tenant Signer / External KMS Boundary

The tenant signer boundary contract is now explicit in
`src/service/bootstrap/release-tenant-signer-boundary.ts`. It defines the
minimum shape a future per-tenant release signer must satisfy before Attestor
can narrow signer-compromise blast radius:

- tenant identity is bound by digest in the signer descriptor
- raw tenant id, raw key reference, and raw payload are not stored in the
  descriptor or fake-signature artifact
- runtime-memory and runtime-file PEM signers remain shared-runtime signers and
  are not production-ready tenant isolation
- tenant-scoped external KMS/HSM signers must be non-exportable, externally
  rotated, live sign/verify probed, and fail closed without local fallback
- live provider verification must come from a structured digest-only proof
  envelope, not from a bare boolean claim
- each external provider contract must pin the provider-native signing
  algorithm and input mode, not only the portable release-token algorithm; this
  prevents accidental double hashing, unsupported provider/algorithm pairings,
  and ambiguous adapter behavior
- confidential-compute signing additionally requires verified attestation
  evidence before the boundary contract is satisfied

The first external provider adapter target is Google Cloud KMS with
`EC_SIGN_ED25519` and raw signing input, as recorded in
[External KMS/HSM provider decision](../02-architecture/external-kms-hsm-provider-decision.md).
AWS KMS remains the next compatible candidate; Azure Key Vault / Managed HSM
remains a future ES256/PS256 or algorithm-migration path, not the first
Ed25519 release-token adapter.

Official provider anchors:

- AWS KMS supports asymmetric signing keys, including Ed25519, where the
  private signing key does not leave KMS unencrypted, and the `Sign` API
  requires callers to record the KMS key and signing algorithm. `MessageType`
  must distinguish raw messages from precomputed digests:
  [AWS KMS asymmetric keys](https://docs.aws.amazon.com/kms/latest/developerguide/symmetric-asymmetric.html),
  [AWS KMS Sign](https://docs.aws.amazon.com/kms/latest/APIReference/API_Sign.html)
- Google Cloud KMS supports asymmetric signing algorithms including Ed25519,
  and separates SOFTWARE, HSM, HSM_SINGLE_TENANT, EXTERNAL, and EXTERNAL_VPC
  protection levels. Its asymmetric signing API accepts either raw data or a
  digest that must match the key version algorithm:
  [Google Cloud KMS algorithms](https://cloud.google.com/kms/docs/algorithms),
  [Google Cloud KMS asymmetricSign](https://cloud.google.com/kms/docs/reference/rest/v1/projects.locations.keyRings.cryptoKeys.cryptoKeyVersions/asymmetricSign),
  [Google Cloud KMS protection levels](https://cloud.google.com/kms/docs/protection-levels)
- Azure Key Vault and Managed HSM support sign/verify over locally hashed
  inputs, and Managed HSM provides single-tenant HSM-backed key isolation.
  Current repository policy does not mark Azure Ed25519 as supported because
  the public Key Vault signature algorithm set records ES*/PS*/RS*/HS* ids but
  not EdDSA:
  [Azure Key Vault key operations](https://learn.microsoft.com/en-us/azure/key-vault/keys/about-keys-details),
  [Azure Key Vault Sign](https://learn.microsoft.com/en-us/rest/api/keyvault/keys/sign/sign),
  [Azure Managed HSM overview](https://learn.microsoft.com/en-us/azure/key-vault/managed-hsm/overview)

This is a contract and fake-adapter test boundary. It does not wire a live AWS,
GCP, Azure, HSM, or confidential-compute signer into release-token issuance.
The structured proof envelope is the required shape for a future live adapter;
it is not itself evidence that a provider was called unless an operator or
adapter supplies fresh provider-derived sign/verify evidence.

## Key Boundary

The strongest production posture is:

1. external key custody or explicit shared PKI path attestation
2. pinned trust root distribution
3. short-lived signing leaves
4. revocation list propagation
5. verifier-side refusal without trust root
6. rotation and incident runbook

## Non-Claims

Attestor does not claim public transparency-log inclusion, customer-owned KMS
custody, HSM-backed signing, or third-party trust when the verifier accepts only
kit-contained trust material.
