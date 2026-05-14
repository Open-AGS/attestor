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
`assertConsequenceAdmissionGateAllows(...)`, but it does not issue, verify, or
consume a cryptographic downstream authorization token. A customer runtime that
ignores the helper can still execute the downstream action.

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
downstream contract helper: fail-closed structural verifier, not cryptographic
release-enforcement plane: signed-token enforcement pattern exists
generic consequence admission path: not proven to auto-issue protected tokens
```

## Corrected Finding

F2-AG-1 / F4-LLM06-A should not say "Attestor has no downstream enforcement
model." That is stale.

It should say:

```text
The customer-gate helper is not the protected enforcement path. It is a
convenience wrapper around an admission response. High-impact downstream systems
must use the downstream contract verifier and, where cryptographic enforcement
is required, the release-enforcement plane or an equivalent signed-token
verifier. The generic consequence-admission route is not yet proven to
automatically issue or require such a token for every admitted consequence.
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

Current repo evidence supports `partial`, not `fixed`.

## Tests

Focused test:

```bash
npm run test:f2-customer-gate-validation
```

Related tests:

```bash
npm run test:consequence-admission-customer-gate
npm run test:downstream-enforcement-contract
npm run test:consequence-verifier-helper
npm run test:release-enforcement-plane-online-verifier
```
