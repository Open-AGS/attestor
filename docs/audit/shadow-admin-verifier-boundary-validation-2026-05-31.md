# Shadow, Admin, And Verifier Boundary Validation - 2026-05-31

## Validation Frame

- Source of truth: `origin/master`
- Validation HEAD: `71c71e7b8b0bb28e56c2c92c9b7e41b770bb2997`
- Scope: shadow customer activation receipts, admin/release actor attribution,
  and release enforcement-plane tenant binding.
- Protected principles: proof integrity, fail-closed boundary, tenant
  isolation, customer authority, auditability, and no overclaim.
- External anchors:
  - OWASP Authorization Cheat Sheet: deny by default, validate permissions on
    every request, and test authorization logic.
  - NIST SP 800-63B: authenticator output and channel/verifier binding should
    be validated by the verifier.
  - RFC 9449 DPoP: sender-constrained proof contrasts with bearer-only
    possession.

This validation is repository-side evidence only. It is not production,
customer deployment, compliance, live role-key, live shared-store, or customer
PEP no-bypass proof.

## Inspected Files

- `src/service/http/routes/shadow-customer-activation-routes.ts`
- `src/service/http/routes/shadow-routes.ts`
- `src/service/bootstrap/routes.ts`
- `src/service/shadow/shadow-persistence-types.ts`
- `src/service/shadow/shadow-persistence-store.ts`
- `src/service/shadow/shadow-persistence-helpers.ts`
- `src/service/http/routes/admin-route-helpers.ts`
- `src/service/http/release-admin-authorization.ts`
- `src/release-enforcement-plane/offline-verifier.ts`
- `tests/shadow-customer-activation-receipt.test.ts`
- `tests/service-shadow-routes-http.test.ts`
- `tests/shadow-route-tenant-boundary.test.ts`
- `tests/release-policy-control-plane-admin-routes.test.ts`
- `tests/release-enforcement-plane-offline-verifier.test.ts`
- `tests/release-enforcement-plane-online-verifier.test.ts`

## Findings And Remediation

### OPS-176 - Shadow Receipt Handoff Self-Attestation

State: `closed repo-side / live-proof-only`

Current repository evidence showed the customer activation receipt route accepted
a caller-supplied full handoff body. That made the receipt path depend on the
request body for proof material instead of a server-side handoff record.

Repository-side remediation:

- Added a file-backed evaluation store for shadow customer activation handoffs.
- Wired hosted shadow routes to record generated handoffs and look them up by
  tenant and handoff id.
- Changed receipt creation to accept only `handoffId` and `handoffDigest`.
- Rejects a caller-supplied `handoff` body.
- Fails closed when the handoff store or receipt store is unavailable.
- Fails closed when the stored handoff is missing or its digest does not match.
- Removed the stateless receipt success path.

Locking tests:

- `tests/shadow-customer-activation-receipt.test.ts`
- `tests/service-shadow-routes-http.test.ts`
- `tests/shadow-route-tenant-boundary.test.ts`
- `tests/shadow-persistence-store.test.ts`

Remaining limitation: the new store is evaluation file-backed storage. Live
multi-instance shared-store proof remains separate.

### OPS-177 - Admin Actor Header Attribution

State: `closed repo-side / live-proof-only`

Current repository evidence showed admin/release helper code accepted
request-supplied actor id/name and policy actor role headers after bearer-key
authorization. That made approval/audit actor identity too dependent on mutable
request headers.

Repository-side remediation:

- General admin route helper actor ids now come from the authorized credential
  role, not actor id/name headers.
- Release admin authorization now derives actor id, display name, and policy
  actor role from the authorized credential role.
- Policy approval tests now prove two credential-bound reviewers are required
  and header spoofing does not supply a distinct approval identity.

Locking test:

- `tests/release-policy-control-plane-admin-routes.test.ts`

Remaining limitation: live role-scoped key deployment and legacy superuser-key
handling remain live proof, not repository proof.

### OPS-178 - Offline Verifier Tenant Binding Default

State: `closed repo-side`

Current repository evidence showed the low-level offline verifier checked a
tenant only when the caller supplied `expected.tenantId`. Wrapper paths were
stronger, but direct low-level use could omit tenant binding without a visible
opt-out.

Repository-side remediation:

- The offline verifier now defaults expected tenant binding to the request
  enforcement point tenant.
- Explicit tenantless verification requires `expected.tenantId: null`.
- Verification output now includes `tenantBinding` metadata showing the
  expected source, claimed tenant, whether the check ran, and whether it
  matched.

Locking tests:

- `tests/release-enforcement-plane-offline-verifier.test.ts`
- `tests/release-enforcement-plane-online-verifier.test.ts`

Remaining limitation: this does not prove live customer PEP no-bypass, live
shared replay/introspection storage, or production deployment posture.

## Verdict

The scoped repository-side boundary hardening is implemented and test-backed in
this branch. It does not change the standing live-proof boundaries for customer
PEP no-bypass, role-scoped operator deployment, shared-store operation, KMS, or
production readiness.
