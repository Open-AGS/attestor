# F2-AG-1 / F4-LLM06-A Customer Gate Enforcement Validation

Status: `partial`.

This note validates the project-owner supplied finding that the customer-side
consequence gate can remain an honor-system if a downstream system does not
independently enforce the Attestor decision.

## Scope

Files inspected:

- `src/consequence-admission/customer-gate.ts`
- `src/consequence-admission/generic-protected-release-token.ts`
- `src/consequence-admission/customer-pep-runtime-adoption.ts`
- `src/service/generic-admission-protected-route.ts`
- `src/service/release-token-introspection-store.ts`
- `src/consequence-admission/downstream-enforcement-contract.ts`
- `src/consequence-admission/verifier-helper.ts`
- `src/release-kernel/release-token.ts`
- `src/release-enforcement-plane/`
- `tests/consequence-admission-customer-gate.test.ts`
- `tests/downstream-enforcement-contract.test.ts`
- `tests/consequence-verifier-helper.test.ts`
- `tests/release-enforcement-plane-online-verifier.test.ts`
- `tests/release-token-introspection-store.test.ts`
- `docs/08-deployment/release-enforcement-plane-envoy.md`

## Validation Result

The finding is valid for `customer-gate.ts` by itself.

`evaluateConsequenceAdmissionGate(...)` returns a structured decision and an
instruction string. It can throw through
`assertConsequenceAdmissionGateAllows(...)`.

`evaluateConsequenceAdmissionGateWithSignedBearerToken(...)` adds a
compatibility path for signed bearer release tokens. It verifies the release
token signature, audience, tenant binding, and admission proof reference by
token id and token digest. It records digest/token metadata only and fails
closed for introspection-required or sender-constrained tokens that require the
release-enforcement plane.

`evaluateConsequenceAdmissionGateWithReleaseEnforcement(...)` adds a protected
bridge for customer-operated release-enforcement verifiers. It does not
reimplement DPoP, mTLS, SPIFFE, HTTP Message Signature, online introspection, or
replay consumption. It requires a supplied release-enforcement verification
result to be valid, sender-constrained, online-checked, replay-consumed,
tenant/audience matched, and bound to an admission `release-token` proof
reference by token id and digest.

`issueGenericAdmissionProtectedReleaseToken(...)` adds a generic high-risk
admission issuance contract. For allowed enforcing admissions whose protected
profile requires the release-enforcement plane, it issues a sender-constrained,
tenant-bound, audience-scoped release token and recreates the admission with a
`release-token` proof reference by token id and digest. The sanitized envelope
does not store the raw token.

When `issueGenericAdmissionProtectedReleaseToken(...)` receives the hosted
release-token introspection authority, it registers the issued token by token id
and release-decision metadata. This narrows the repo-side gap between generic
consequence authorization and online introspection without storing the raw token
in admission or shadow records.

The hosted generic admission route now has an active DPoP sender-confirmation
bridge. It validates a token-request DPoP proof from the `DPoP` header, derives
the `cnf.jkt` confirmation, and uses the runtime release-token issuer to issue
caller-only protected authorization material for high-risk generic admissions.
Missing or invalid DPoP proof fails closed before shadow recording. Hosted
bootstrap wires the release-token introspection store into this issuer path and
the route readiness proof now blocks `production-shared` when token
introspection, token-use replay-consumption, or DPoP sender-proof replay
storage is missing or runtime-local.

`evaluateCustomerPepRuntimeAdoption(...)` adds a customer PEP runtime adoption
proof contract. It is ready only when the scoped customer runtime uses the
release-enforcement plane profile, covers all protected routes, is fail-closed,
has no bypass routes, integrates the verifier, requires sender-constrained
presentation, requires online token introspection, requires replay consumption,
binds proof/audience/tenant fields, uses durable replay and introspection
stores, records health/rollback/kill-switch/monitoring/audit/customer-approval
evidence, carries activation handoff and receipt digests, and stores no raw
token, raw payload, or provider body.

A customer runtime that ignores the helper can still execute the downstream
action. The signed bearer path also does not consume replay, perform online
introspection, or prove sender constraint.

The finding is too broad if it is applied to the entire repository.

The repo now has a stronger downstream enforcement architecture:

- `downstream-enforcement-contract.ts` defines fail-closed boundary checks for
  admission id, admission digest, decision, consequence kind, risk class,
  downstream system, policy ref, proof ref, idempotency key, and narrow
  constraint acknowledgement.
- `verifier-helper.ts` wraps that downstream contract into an assertable helper,
  but its descriptor intentionally says `cryptographicTokenVerification: false`.
- `release-token.ts` and `release-enforcement-plane/` implement the signed
  release-token path and verifier surface for protected release flows.

Therefore, the accurate status is:

```text
customer-gate helper alone: partial / honor-system risk remains
signed-bearer customer-gate helper: cryptographic compatibility verifier for low-risk paths, no replay/introspection/sender constraint
release-enforcement customer-gate helper: consumes a proven release-enforcement verifier result for protected paths, but does not operate the customer PEP
downstream contract helper: fail-closed structural verifier, not cryptographic
release-enforcement plane: signed-token enforcement pattern exists
generic protected release-token issuance helper: can issue sender-constrained protected tokens for allowed high-risk generic admissions when configured
hosted generic DPoP issuer bridge: validates token-request DPoP proof and issues caller-only protected tokens in hosted non-production profiles
customer PEP runtime adoption proof: can prove scoped fail-closed runtime adoption evidence, but does not deploy or operate the PEP
protected enforcement profile: routes high-risk/customer-sensitive paths to the release-enforcement plane
hosted durable introspection/replay wiring: registers issued protected tokens in the release-token introspection authority and blocks production-shared readiness unless token introspection and token-use replay-consumption storage are shared
hosted DPoP proof replay readiness: blocks production-shared readiness unless the DPoP sender-proof replay store is configured as shared
hosted generic admission protected route: requires the protected issuer for high-risk hosted generic admissions and blocks production-shared readiness until the issuer boundary has structured external live provider proof
```

## Corrected Finding

F2-AG-1 / F4-LLM06-A should not say "Attestor has no downstream enforcement
model." That is stale.

It should say:

```text
The customer-gate helper is not the protected enforcement path. It is a
convenience wrapper around an admission response, with an optional signed bearer
release-token verifier for low-risk compatibility paths. High-impact downstream
systems must use the downstream contract verifier and, where protected
cryptographic enforcement is required, the release-enforcement plane or an
equivalent sender-constrained signed-token verifier. The generic
consequence-admission route now has a protected release-token issuance hook, but
customer runtime configuration and non-bypassable PEP adoption still determine
whether every protected consequence is forced through it.
The customer PEP runtime adoption proof now records that adoption evidence in a
machine-readable artifact, but it is still customer/runtime evidence rather than
hosted production configuration or infrastructure deployment.
```

## Remaining Work

Before this can be marked `fixed`, Attestor still needs protected runtime
closure beyond the repository-side contract:

1. Customer-operated live PEP deployment evidence shows the
   release-enforcement verifier, replay store, token-introspection authority,
   and sender-constrained proof validation are active before protected
   consequences can execute.
2. Hosted production configuration still needs live issuer and sender-proof
   deployment evidence with an external KMS/HSM-backed issuer boundary and
   structured live provider proof so protected high-risk generic admissions are
   not relying on runtime-local signer material or bare external labels.

Current repo evidence supports `partial`, not `fixed`. The signed bearer helper
narrows the low-risk cryptographic compatibility gap, and the
release-enforcement customer-gate helper narrows the protected verifier-consumer
gap. The generic protected release-token issuer narrows the consequence-to-token
binding gap, but it does not activate a customer runtime or prove hosted
production configuration by itself.

The customer PEP runtime adoption proof narrows the non-bypassable adoption gap
by requiring scoped route coverage, fail-closed PEP behavior, sender-constrained
presentation, online introspection, replay consumption, durable stores, customer
approval, and activation receipt evidence before a runtime adoption claim is
allowed. It still does not deploy Envoy/Istio/OPA/Hono/Node middleware, operate
the customer gateway, migrate stores, or prove hosted production configuration.

The protected customer enforcement profile narrows the remaining gap by making
the adoption rule machine-readable: R3/R4 and other production-sensitive
consequences must use the release-enforcement plane, require sender-constrained
presentation, require online introspection, require replay consumption, and
forbid bearer-only/helper-only protected execution. That profile is a contract
selector, not token issuance or customer-runtime activation by itself.

The hosted generic admission protected route proof, DPoP issuer bridge, and
durable introspection/replay wiring
narrow the hosted configuration gap: the service bootstrap now requires
protected release-token issuance for high-risk generic admissions, validates
token-request DPoP proof into `cnf.jkt`, registers issued protected tokens in
the release-token introspection authority, exposes the route proof through
health/readiness diagnostics, and fails closed when sender confirmation,
shared token replay/introspection storage, or shared DPoP proof replay storage
is absent. It still does not configure a live external KMS/HSM signer, deployed
customer-operated PEP, DPoP proof replay backend, or live production
environment; production-shared route readiness remains blocked while the issuer
boundary is runtime-local, lacks structured live provider proof, or lacks shared
sender-proof replay storage.

## Tests

Focused test:

```bash
npm run test:f2-customer-gate-validation
npm run test:consequence-admission-protected-enforcement-profile
npm run test:customer-pep-runtime-adoption
npm run test:consequence-admission-customer-gate
npm run test:generic-admission-protected-route
npm run test:hosted-generic-admission-sender-confirmation
npm run test:release-enforcement-plane-dpop
npm run test:generic-admission-protected-release-token
npm run test:release-token-introspection-store
```

Related tests:

```bash
npm run test:consequence-admission-customer-gate
npm run test:downstream-enforcement-contract
npm run test:consequence-verifier-helper
npx tsx tests/release-enforcement-plane-online-verifier.test.ts
```
