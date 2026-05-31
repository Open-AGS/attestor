# Pipeline Release-Token Boundary Validation - 2026-05-31

Status: partial / boundary hardening remediated.

This intake validates an external release-token and reviewer-authority report
against current repository evidence. It does not import raw report text as
authority; each finding below is classified from repository evidence and
official protocol/security anchors.

## Validation Frame

| Field | Value |
|---|---|
| Source HEAD | `04356f88dbe01da83ad7fe222126f6bd78c8a7c3` |
| Branch | `hardening/report-intake-validation` |
| Protected principles | tenant isolation; fail-closed boundary; proof integrity; customer authority; replay and idempotency safety; no overclaim |
| Source anchors | OAuth Bearer Token usage RFC 6750; OAuth DPoP RFC 9449; OAuth Token Introspection RFC 7662; OWASP Authorization Cheat Sheet |

## Inspected Files

- `src/service/http/routes/pipeline-execution-routes.ts`
- `src/service/http/routes/pipeline-filing-routes.ts`
- `src/service/http/routes/release-review-routes.ts`
- `src/release-kernel/release-verification.ts`
- `src/release-kernel/release-token.ts`
- `src/release-kernel/release-introspection.ts`
- `src/release-kernel/reviewer-queue.ts`
- `src/service/bootstrap/api-route-runtime.ts`
- `src/service/bootstrap/http-route-builders.ts`
- `tests/release-kernel-release-verification.test.ts`
- `tests/pipeline-filing-default-secure.test.ts`
- `tests/service-pipeline-routes-idempotency.test.ts`

## Findings

### OPS-179 - Finance Filing Release Tokens Lacked Tenant/Sender Binding

State: repo-proven, remediated repo-side.

Repository evidence showed accepted finance filing release decisions issued
release tokens without `tenant_id` or `cnf` sender confirmation, and returned
the raw authorization token to the caller. The filing token issue path now binds
the token to the route tenant and requires a DPoP sender confirmation before an
accepted filing release token is issued.

Authority boundary: this is repository-side token-binding hardening. It does
not prove production KMS/HSM signing, customer PEP no-bypass, or live shared
store behavior.

### OPS-180 - Filing Export Verification Omitted Tenant/Sender Binding

State: repo-proven, remediated repo-side.

Repository evidence showed `/api/v1/filing/export` verified audience, target,
output hash, consequence hash, introspection, and token-use consumption, but did
not pass the route tenant into release-token verification. The route now passes
`expectedTenantId`, requires a sender-constrained release token, and forwards
the DPoP proof for local proof-of-possession verification.

Authority boundary: DPoP proof validation and token-use consumption are
repository-side checks. Live multi-instance replay/introspection proof remains
separate.

### OPS-181 - Body Reviewer Fields Could Satisfy Financial Review Approval

State: repo-proven, remediated repo-side.

Repository evidence showed `reviewerName` body fields could become
`ReviewerIdentity`, satisfy the financial pipeline approval input, and create a
signed reviewer endorsement. The route now treats body reviewer fields as
non-authority request metadata only. Approval authority requires verified OIDC
reviewer identity on this route.

Authority boundary: this closes the body-field authority path for the pipeline
route. It does not replace release-review admin route authorization or prove a
live enterprise identity provider configuration.

## Positive Observations

- The release-token verifier already supported `expectedTenantId` at the
  low-level token verifier.
- The introspection registry already stored token tenant and sender
  confirmation metadata when tokens carried those claims.
- The existing hosted DPoP sender-confirmation resolver could be reused for the
  pipeline and release-review token issue paths instead of creating a second
  product surface.

## Remaining Proof

- Customer PEP no-bypass remains live-proof-only.
- Production deployment, KMS/HSM signer, live shared introspection/replay
  stores, and enterprise identity-provider behavior remain unproven.
- DPoP proof replay durability for production-shared deployments remains tied
  to the existing hosted DPoP proof replay store and live proof gates.

## Verdict

Repo-side hardening is scoped to the validated release-token tenant/sender
binding and body-reviewer authority gaps. No production, compliance, customer
PEP no-bypass, KMS, or enterprise readiness claim is made by this intake.
