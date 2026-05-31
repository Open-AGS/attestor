# Google Cloud KMS Release Signer Adapter

Status: repository-side adapter and probe contract for Attestor unlock step 04.
This is not live deployment evidence, not customer key custody evidence, and
not runtime release-token issuance wiring.

## Decision

The first real provider adapter is Google Cloud KMS for the existing Attestor
Ed25519 release-signing path:

```text
providerClass: gcp-kms
portable release algorithm: Ed25519 / EdDSA
provider native algorithm: EC_SIGN_ED25519
provider sign input mode: raw data
minimum accepted protection level: HSM, EXTERNAL, or EXTERNAL_VPC as configured
```

The adapter is implemented in
`src/service/bootstrap/gcp-kms-release-signer.ts`. It uses the Cloud KMS REST
`asymmetricSign` shape directly instead of adding a new package dependency.
That keeps the package surface narrow and makes the request/response contract
testable without Google credentials.

## Environment Contract

The GCP KMS config loader accepts only an explicit external signer declaration:

```text
ATTESTOR_RELEASE_SIGNING_PROVIDER=external-kms
ATTESTOR_EXTERNAL_KMS_PROVIDER=gcp-kms
ATTESTOR_GCP_KMS_KEY_VERSION_NAME=projects/.../locations/.../keyRings/.../cryptoKeys/.../cryptoKeyVersions/...
ATTESTOR_GCP_KMS_KEY_ID=<opaque release key id, no raw tenant id>
ATTESTOR_GCP_KMS_PUBLIC_KEY_REF=<non-secret public verification key reference>
ATTESTOR_GCP_KMS_EXPECTED_PROTECTION_LEVEL=hsm
ATTESTOR_GCP_KMS_ROTATION_REF=<operator rotation reference, optional>
```

The access token is not read from this config contract and is not stored in the
proof. A caller must provide an access-token function to the probe at runtime.
The probe sends the token only in the transport `Authorization` header.

## Probe Contract

`probeGcpKmsReleaseTenantSigner` signs the standard Attestor live-provider
challenge with Cloud KMS, verifies the returned signature locally with the
configured public key, and emits the closed tenant signer proof envelope.

The probe must prove all of the following before it returns a descriptor:

- request uses `EC_SIGN_ED25519`
- request uses the `data` field, not digest input
- request includes CRC32C for the raw challenge bytes
- response key version name matches the requested cryptoKeyVersion
- Cloud KMS reports `verifiedDataCrc32c=true`
- returned signature CRC32C matches the local calculation
- response protection level matches the configured expectation
- response protection level is not `SOFTWARE` or unknown
- signature verifies locally against the configured public key
- proof records provider request and response by digest only
- raw provider response, raw signature, access token, and raw tenant id are not
  returned in the proof result

If any of these checks fails, the adapter throws
`GcpKmsReleaseSignerAdapterError` and produces no production-oriented proof.

## Bootstrap Boundary

Runtime bootstrap still fails closed for
`ATTESTOR_RELEASE_SIGNING_PROVIDER=external-kms`. The GCP KMS probe proves that
a provider call can satisfy the repository-side signer boundary, but the
release-token issuer still uses the existing runtime PKI path. Until a later PR
wires issuance to the external signer path, bootstrap must refuse to fall back
to `file-pem` or `runtime-ephemeral`.

## Rotation And Compromise Notes

This PR records only adapter-side rotation references and proof freshness. It
does not create, rotate, disable, destroy, or recover Google Cloud KMS keys.
Operator runbooks still need:

- key-version creation and primary-version promotion
- old-key verification retention window
- compromised-key disable or destroy process
- IAM and workload-identity boundary
- public verification key distribution and pinning
- external-live probe execution evidence

## Primary Source Anchors

Reviewed on 2026-05-16:

- Google Cloud KMS algorithms document `EC_SIGN_ED25519` and its signing
  semantics: [Cloud KMS algorithms](https://cloud.google.com/kms/docs/algorithms).
- Google Cloud KMS `asymmetricSign` documents the REST endpoint, `data`,
  `dataCrc32c`, `verifiedDataCrc32c`, `signature`, `signatureCrc32c`, `name`,
  and `protectionLevel` response fields:
  [Cloud KMS asymmetricSign](https://cloud.google.com/kms/docs/reference/rest/v1/projects.locations.keyRings.cryptoKeys.cryptoKeyVersions/asymmetricSign).
- Google Cloud KMS protection-level documentation anchors the distinction
  between software, HSM, external, and external VPC key protection:
  [Cloud KMS protection levels](https://cloud.google.com/kms/docs/protection-levels).

These are engineering anchors only. They do not prove that the repository has a
live Google Cloud project, configured IAM, workload identity, key material,
network path, or production deployment.

## Non-Claims

Boundary: repository-side or evaluation evidence only: not production readiness,
customer deployment proof, customer no-bypass proof, native connector or live
integration coverage, compliance certification, or automatic policy activation.
Domain-specific authority still needs separate live proof.

It only adds the first real provider adapter/probe surface and keeps bootstrap
fail-closed until issuance is explicitly wired.
