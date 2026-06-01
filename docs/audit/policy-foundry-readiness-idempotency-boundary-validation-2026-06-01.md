# Policy Foundry Readiness And Idempotency Boundary Validation - 2026-06-01

## Recent Fixes Chain-Effect Check

Current `origin/master` source head at validation start:

```text
90428266d7b43edad61119b03929ad9d3939769d
```

OPS-207 and OPS-208 remain closed repo-side on the current source: shadow
policy-candidate status actors are route-derived, and approved candidate state
is bound to the current candidate digest. This pass did not reopen those
findings. It found two narrower follow-up gaps in Policy Foundry readiness
inputs and hosted shadow-mutation idempotency wording.

## Validation Frame

Trust surface: Policy Foundry readiness and active-question routes, the
readiness evaluator, shadow mutation idempotency helper behavior, and the hosted
API authorization matrix.

Protected principles:

- customer authority
- proof integrity
- replay and idempotency safety
- tenant isolation
- no overclaim

Source anchors:

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html):
  authorization decisions should be validated on every request and denied by
  default.
- [NIST SP 800-162 ABAC](https://csrc.nist.gov/pubs/sp/800/162/upd2/final):
  access decisions are based on subject, object, operation, and environment
  attributes, not caller labels alone.
- [RFC 9110 HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html):
  `POST` can create or append server state and is not safe by default.
- [IETF HTTPAPI Idempotency-Key draft](https://www.ietf.org/archive/id/draft-ietf-httpapi-idempotency-key-header-07.html):
  archived work-in-progress pattern for using `Idempotency-Key` to make
  non-idempotent `POST`/`PATCH` retries fault-tolerant.
- [Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests?javascript=false&lang=node):
  official implementation pattern where a supplied idempotency key stores and
  replays the first result and rejects mismatched reuse.

These anchors support repository control design only. They do not prove
production readiness, compliance readiness, live shared-store behavior, or
customer PEP no-bypass.

## Inspected Files

- `src/consequence-admission/policy-foundry-readiness.ts`
- `src/service/http/routes/shadow-policy-foundry-promotion-routes.ts`
- `src/service/http/routes/shadow-mutation-route-helpers.ts`
- `src/service/hosted/hosted-api-authorization-matrix.ts`
- `tests/policy-foundry-readiness.test.ts`
- `tests/shadow-policy-foundry-readiness-routes.test.ts`
- `tests/hosted-api-authorization-matrix.test.ts`
- `tests/service-shadow-routes-http.test.ts`
- `tests/policy-foundry-onboarding-docs.test.ts`
- `docs/02-architecture/policy-foundry-onboarding.md`
- `docs/audit/current-posture-baseline.md`
- `docs/audit/report-index.md`
- `docs/audit/finding-index.md`
- `docs/audit/control-map.md`

## Findings

### OPS-209 - Policy Foundry readiness proof inputs were caller-shaped

State: closed repo-side / live-proof-only.

The readiness and active-question routes accepted `customerApproved` and
`tenantBoundaryProven` query parameters. The evaluator also treated tenant
boundary proof as true unless explicitly false. A caller could therefore make a
readiness result look stronger than the durable approval/proof state supported.

Remediation:

- `evaluatePolicyFoundryReadiness` now requires
  `tenantBoundaryProven === true`; omission is not proof.
- Hosted readiness and active-question routes reject caller-supplied
  `customerApproved` and `tenantBoundaryProven` query parameters.
- Hosted readiness derives customer approval only from a tenant-bound stored
  current candidate record whose digest matches the selected candidate and whose
  status is `approved` or `activated`.
- Tenant-boundary proof for the hosted route is route-owned: it follows the
  existing shadow route tenant assertions, not a caller flag.
- Route responses expose a compact `readinessProof` source summary.

Remaining boundary:

- This is still decision support and never auto-enforcement.
- Independently authenticated customer approval workflow proof, live shared
  candidate-store proof, customer PEP no-bypass, and production readiness remain
  live/operator work.

### OPS-210 - Hosted matrix overstated shadow mutation idempotency

State: closed repo-side / live-proof-only.

The hosted API authorization matrix classified shadow mutations as protected by
`tenant_shadow_idempotency_service`, while runtime behavior only uses the
idempotency service when `Idempotency-Key` is supplied. Keyless shadow mutation
requests proceed with tenant+route rate limiting, not service-level replay or
conflict records.

Remediation:

- The hosted matrix now labels shadow mutation idempotency as
  `optional_header_plus_rate_limit`.
- The matrix privacy/boundary text states that idempotent replay exists when the
  header is supplied and that keyless retries are bounded by route-scoped rate
  limits.
- Matrix tests lock the weaker, accurate classification.
- During matrix verification, two workflow billing routes were also added to
  the hosted authorization matrix so every registered hosted route still
  resolves to exactly one rule. This is matrix coverage only; it is not a live
  billing readiness claim.

Remaining boundary:

- `Idempotency-Key`-bound shadow mutation replay/conflict behavior remains
  repo-side evidence only until live shared-store proof is captured.
- Keyless shadow mutations are still permitted; they are rate-limited and
  audited, but they do not have service-level idempotency records.

## Chain Reactions

- Query-shaped readiness can no longer remove customer approval or
  tenant-boundary no-go evidence.
- Existing what-if style callers must use real stored candidate approval before
  the hosted readiness route can report enforce eligibility.
- Matrix consumers no longer see an unconditional idempotency claim for all
  shadow mutations.
- Workflow billing list and workflow checkout routes now have explicit hosted
  matrix rows, keeping route inventory and authorization documentation aligned.
- OPS-207 and OPS-208 stay closed; body-supplied actor labels and stale
  digest approvals remain blocked by the prior repo-side hardening.

## Coverage Delta

Added or updated locking coverage:

- `tests/policy-foundry-readiness.test.ts`
- `tests/shadow-policy-foundry-readiness-routes.test.ts`
- `tests/policy-foundry-active-questions.test.ts`
- `tests/policy-foundry-counterexample-ledger.test.ts`
- `tests/policy-foundry-policy-twin-summary.test.ts`
- `tests/hosted-api-authorization-matrix.test.ts`
- `tests/service-shadow-routes-http.test.ts`
- `tests/policy-foundry-onboarding-docs.test.ts`

Relevant verification:

- `npm run test:policy-foundry-readiness`
- `npm run test:shadow-policy-foundry-readiness-routes`
- `npm run test:policy-foundry-active-questions`
- `npm run test:policy-foundry-counterexample-ledger`
- `npm run test:policy-foundry-policy-twin-summary`
- `npm run test:hosted-api-authorization-matrix`
- `npm run test:service-shadow-routes-http`
- `npm run test:policy-foundry-onboarding-docs`
- `npm run test:audit-finding-test-coverage`
- `npm run test:baseline-alignment-contract`
- `npm run test:audit-finding-evidence`
- `npm run test:audit-evidence-navigator`
- `npm run typecheck`
- `npm run typecheck:hygiene`
- `git diff --check`

## Verdict

Both scoped findings were repo-proven and are remediated repo-side. The fix
keeps Policy Foundry inside the single Attestor consequence engine: it can add
review pressure and readiness evidence, but it cannot grant authority, activate
enforcement, or prove live production behavior.

## Final Checkpoint

Scoped repository remediation: complete with the listed local checks passing.

No repo-proven P0/P1 remains in this slice.

Live proof still needed:

- independently authenticated customer approval workflow proof
- live shared shadow candidate-store proof
- live shared shadow mutation idempotency proof
- customer PEP no-bypass proof
- production readiness proof

This report does not claim production readiness, compliance readiness,
enterprise readiness, customer PEP no-bypass, or live customer approval
workflow proof.
