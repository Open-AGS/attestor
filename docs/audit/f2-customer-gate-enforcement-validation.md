# F2-AG-1 / F4-LLM06-A Customer Gate Enforcement Validation

Status: `partial`.

This note validates the project-owner supplied finding that the customer-side
consequence gate can remain an honor-system if a downstream system does not
independently enforce the Attestor decision.

## Scope

Files inspected:

- `src/consequence-admission/customer-gate.ts`
- `src/consequence-admission/downstream-enforcement-contract.ts`
- `src/consequence-admission/verifier-helper.ts`
- `src/release-kernel/release-token.ts`
- `src/release-enforcement-plane/`
- `tests/consequence-admission-customer-gate.test.ts`
- `tests/downstream-enforcement-contract.test.ts`
- `tests/consequence-verifier-helper.test.ts`
- `tests/release-enforcement-plane-online-verifier.test.ts`
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
downstream contract helper: fail-closed structural verifier, not cryptographic
release-enforcement plane: signed-token enforcement pattern exists
generic consequence admission path: not proven to auto-issue protected tokens
protected enforcement profile: routes high-risk/customer-sensitive paths to the release-enforcement plane
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
consequence-admission route is not yet proven to automatically issue or require
such a token for every admitted consequence.
```

## Remaining Work

Before this can be marked `fixed`, Attestor needs one of these repo-proven
closures:

1. Generic consequence-admission responses for executable high-risk actions
   issue a signed, audience-scoped downstream authorization token, and
   downstream verifiers reject execution without it.
2. Public docs and tests make the customer-gate helper explicitly non-enforcing
   and require users to choose the release-enforcement plane or downstream
   contract helper for protected execution.

Current repo evidence supports `partial`, not `fixed`. The signed bearer helper
narrows the low-risk cryptographic compatibility gap, but does not close
protected downstream enforcement.

The protected customer enforcement profile narrows the remaining gap by making
the adoption rule machine-readable: R3/R4 and other production-sensitive
consequences must use the release-enforcement plane, require sender-constrained
presentation, require online introspection, require replay consumption, and
forbid bearer-only/helper-only protected execution. That profile is a contract
selector, not token issuance or customer-runtime activation by itself.

## Tests

Focused test:

```bash
npm run test:f2-customer-gate-validation
npm run test:consequence-admission-protected-enforcement-profile
npm run test:consequence-admission-customer-gate
```

Related tests:

```bash
npm run test:consequence-admission-customer-gate
npm run test:downstream-enforcement-contract
npm run test:consequence-verifier-helper
npm run test:release-enforcement-plane-online-verifier
```
