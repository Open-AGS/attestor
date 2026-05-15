# F6 Tenant-Bound Release Token Validation

Status: repository-side remediation slice for F6-T1 and F6-T6.

This validation narrows the multi-tenant signing finding from "tenant is only an
external request field" to "release-token artifacts can carry and verify an
explicit tenant binding." It does not claim per-tenant PKI, per-tenant signer
keys, KMS isolation, or live production tenant isolation.

## Source Finding

F6-T1 and F6-T6 identified that Attestor's release runtime uses shared PKI and a
shared release-token issuer across tenants. The original report also said a
crafted tenant body could be signed as another tenant. Fresh validation already
reduced that subclaim for `/api/v1/admissions`, because the generic admission
route overwrites or rejects mismatched body tenant IDs.

The remaining valid issue is the token/signing layer: prior release-token claims
did not carry a first-class tenant claim, so downstream verification could not
cryptographically compare the token tenant to the enforcement point tenant.
The later tenant signer boundary contract narrows the next implementation
shape, but it still does not replace the runtime-wide release signer.

## Repository Changes

- `ReleaseTokenClaims` now supports `tenant_id`.
- `ReleaseTokenIssueInput` and `buildReleaseTokenClaims` accept `tenantId`.
- `verifyIssuedReleaseToken` accepts `expectedTenantId` and rejects mismatched
  tenant claims.
- Release-token introspection persists and returns `tenant_id`, and treats
  registry/token tenant mismatch as `claim_mismatch`.
- Offline release-enforcement verification accepts `expected.tenantId` and
  returns `binding-mismatch` when token tenant and expected tenant differ.
- Verification and introspection snapshots now carry `tenantId` for audit
  records.
- Token exchange preserves the parent token's `tenant_id` on the exchanged
  token.

## Validation

`npm run test:f6-tenant-bound-release-token` verifies:

1. Issued release tokens include `tenant_id`.
2. Low-level token verification accepts the matching tenant.
3. Low-level token verification rejects a mismatched expected tenant.
4. Introspection returns `tenant_id` for active registered tokens.
5. Offline enforcement verification accepts matching tenant binding.
6. Offline enforcement verification rejects mismatched tenant binding with
   `binding-mismatch`.

## Remaining Boundary

This PR does not fully close F6-T6. The runtime signer and CA remain shared
runtime material. A signer-key compromise is still runtime-wide until Attestor
adds one of the following:

- per-tenant short-lived leaf signers under a shared CA;
- KMS/HSM-backed tenant-scoped signing keys;
- or a production profile that refuses tenant-scoped claims without tenant
  signer isolation.

`src/service/bootstrap/release-tenant-signer-boundary.ts` now defines that
future KMS/HSM contract and a fake external KMS test adapter. That contract
keeps raw tenant ids, raw key refs, and raw payloads out of the descriptor and
fake signature artifacts, but it does not activate runtime release-token signing
or prove a live cloud/HSM provider.

Therefore F6-T1 remains `partial`, and F6-T6 moves from `open` to `partial`.
