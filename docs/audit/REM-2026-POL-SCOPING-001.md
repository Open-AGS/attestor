# REM-2026-POL-SCOPING-001 - Locale-Independent Policy Scope Precedence

Lifecycle state: fixed
Finding ID: AUD-2026-POL-SCOPING-001
Severity: low
Original report: legacy label `R26 B-081`
Original target ref: origin/master 2356f340d5922536f0155180185c8a404659a75d
Protected principle: proof integrity; fail-closed boundary; auditability
Trust surface: release policy control-plane scope precedence and activation resolution

## Repository Evidence

- `src/release-policy-control-plane/scoping.ts` used
  `left.selectorLabel.localeCompare(right.selectorLabel)` as the final
  tiebreak in `comparePolicyScopeMatches`.
- `createPolicyActivationTarget()` trims optional identifiers but does not
  enforce an ASCII-only charset.
- File-backed control-plane stores can rehydrate activation records from JSON,
  so malformed persisted selector shape is a relevant boundary to keep
  fail-closed.

## Risk Being Closed

If two matching activation candidates had the same precedence vector and
specificity score but different selector labels, locale-sensitive comparison
could make the selected winner depend on runtime collation behavior. A
malformed persisted selector could create that shape even though normal
constructor-created selectors are coherent.

## External Anchors

- ECMA-402 `String.prototype.localeCompare`: string comparison can be
  locale-sensitive through international collation behavior.
- RFC 8785 JSON Canonicalization Scheme: deterministic canonical ordering
  should avoid locale collation semantics.

## Why Applicable

Scope precedence decides which release policy activation wins. That winner can
feed bundle discovery and the active policy resolver, so deterministic ordering
and fail-closed ambiguity handling are part of the policy control-plane proof
boundary.

## Why Not Overclaimed

This remediation only changes the policy scope precedence comparator and
ambiguity detection. It does not claim every repository `localeCompare` use is
security-sensitive, and it does not add a full persisted-record schema
validator.

## Smallest Safe Fix

- Replace the selector-label tiebreak with binary string comparison.
- Treat same precedence vector and same specificity score as ambiguous,
  independent of selector label equality.
- Add an adversarial regression test that traps `String.prototype.localeCompare`
  and feeds malformed persisted selector labels through
  `resolvePolicyActivationPrecedence()`.

## Verification

```bash
npx tsx tests/release-policy-control-plane-scoping.test.ts
npm run test:audit-id-alias-registry
npm run test:audit-finding-evidence
npm run typecheck
npm run typecheck:hygiene
```

## Remaining Limitation

This fix keeps precedence resolution deterministic and fail-closed. A broader
runtime validator for all persisted policy activation records remains separate
future hardening if the file-backed store is promoted beyond evaluation use.
