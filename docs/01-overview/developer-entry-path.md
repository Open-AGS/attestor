# Developer Entry Path

Use this when you want to understand the main Attestor runtime path before
changing code.

Scope: this is a first-reading map for the shared happy path and its stop
points. It is not a full architecture map, a line-by-line audit, live proof, or
production readiness evidence.

## Run First

Start with the two smallest examples:

```bash
npm run example:admission
npm run example:non-bypassable-gateway
```

Stop when you can explain this path:

```text
proposed consequence
-> admission request
-> normalized input
-> guard evaluation
-> admit / narrow / review / block
-> proof refs and shadow record
-> customer gate before the downstream action
```

## Read The Path

Read these files in this order:

| Step | File | What to look for |
|---|---|---|
| 1 | `examples/first-useful-admission-demo.ts` | The smallest local request, decision, proof refs, and gate outcome. |
| 2 | `examples/non-bypassable-gateway-demo.ts` | A protected adapter that does not expose raw dispatch. |
| 3 | `src/service/http/routes/generic-admission-routes.ts` | `POST /api/v1/admissions`, tenant binding, idempotency, entitlement, loop guard, release token, and shadow recording. |
| 4 | `src/consequence-admission/generic-input-normalization.ts` | How incoming action fields become normalized admission input. |
| 5 | `src/consequence-admission/generic-engine.ts` | Guard orchestration, shadow decision reduction, effective decision, checks, constraints, and proof refs. |
| 6 | `src/consequence-admission/customer-gate.ts` | The customer-side gate that holds or proceeds before the real action. |
| 7 | `src/consequence-admission/downstream-enforcement-contract.ts` | Downstream binding checks for proof, idempotency, scope, and fail-closed behavior. |
| 8 | `src/consequence-admission/index.ts` | Public exports. Use it as a boundary, not as the first file to read end to end. |

## Guard Files

After the main path is clear, open only the guard that matches your change:

| Guard area | Start here |
|---|---|
| untrusted content or authority claims | `src/consequence-admission/untrusted-content-authority-guard.ts` |
| approval provenance | `src/consequence-admission/approval-provenance-guard.ts` |
| scope expansion | `src/consequence-admission/scope-explosion-guard.ts` |
| tool result poisoning | `src/consequence-admission/tool-result-poisoning-guard.ts` |
| stale authority policy | `src/consequence-admission/stale-authority-policy-guard.ts` |
| no-go holds | `src/consequence-admission/no-go-condition-ledger.ts` |
| retry behavior | `src/consequence-admission/retry-attempt-ledger.ts` |
| agent-loop abuse | `src/consequence-admission/agent-loop-abuse-guard.ts` |

## Tests To Open Next

| If you changed... | Read or run |
|---|---|
| generic admission route behavior | `tests/generic-admission-routes.test.ts` |
| route-to-guard coverage | `tests/generic-admission-guard-route-matrix.test.ts` |
| admission invariants | `tests/critical-admission-property-suite.test.ts` |
| customer gate behavior | `tests/consequence-admission-customer-gate.test.ts` |
| downstream enforcement binding | `tests/downstream-enforcement-contract.test.ts` |
| first-reader docs | `tests/repository-navigator-docs.test.ts` |

## Do Not Start With

- audit indexes, unless you are validating a claim;
- production or deployment docs, unless you are proving live readiness;
- every `package.json` script;
- every file under `src/consequence-admission/`.

## Boundaries

This page is repo-side navigation only.

```text
local example is not live customer enforcement
shadow record is not downstream execution
release proof is not customer PEP no-bypass proof
repo-side evidence is not production readiness
```

Next: use [Repository map](repository-map.md) for directory ownership and
[Test system map](../02-architecture/test-system-map.md) for check selection.
