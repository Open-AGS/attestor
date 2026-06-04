# Consequence Admission Guard Depth Validation - 2026-06-04

## Recent Fixes Chain-Effect Check

- Source of truth: `origin/master`.
- Source HEAD: `c2c03e231ea206617fec672cc778c224efedc3c1`.
- Recent merged chain:
  - `1bbd08fb93b363e26f0a7422bb98ae264ea56ad2` hardened generic admission
    hard invariants.
  - `55dea52ccfbf11bb91a994f941680f687dc22f74` aligned finance admission
    with generic guard families.
  - `afd87447b095aa861e461abaf37b55c1b10f7dbb` aligned presentation binding
    with downstream execution-proof semantics.
  - `c2c03e231ea206617fec672cc778c224efedc3c1` added route-level adversarial
    admission fixtures.
- Direct regression checked by the merged slices: generic route behavior,
  property invariants, finance projection behavior, downstream contract
  proof semantics, presentation binding, and customer gate proof semantics.
- Cross-fix interaction checked: the finance projection reuses the single
  consequence-admission guard model; presentation binding and downstream
  execution proof both keep `admission-receipt` out of execution-proof
  satisfaction.

## Validation Frame

Scope: repo-side guard-depth evidence for consequence admission after the
hard-invariant, finance-parity, execution-proof, and adversarial route-fixture
work merged.

Protected principles:

- fail-closed boundary
- customer authority
- proof integrity
- auditability
- no overclaim
- replay and idempotency safety

External anchors:

- NIST SP 800-218 SSDF provides common secure-development practice vocabulary:
  <https://csrc.nist.gov/pubs/sp/800/218/final>.
- OWASP SAMM control verification expects security controls to be tested when
  their use changes and regression tests to guard fixed issues:
  <https://owaspsamm.org/model/verification/requirements-driven-testing/stream-a/>.
- OWASP ASVS provides technical-control verification vocabulary and stable
  requirement referencing discipline:
  <https://owasp.org/www-project-application-security-verification-standard/>.

These anchors support the evidence-mapping shape only. They are not
certifications and do not prove Attestor production readiness.

## Inspected Files

- `src/consequence-admission/generic-hard-invariants.ts`
- `src/consequence-admission/generic-engine.ts`
- `src/consequence-admission/finance.ts`
- `src/consequence-admission/facade.ts`
- `src/consequence-admission/downstream-enforcement-contract.ts`
- `src/consequence-admission/presentation-binding.ts`
- `src/consequence-admission/customer-gate.ts`
- `tests/critical-admission-property-suite.test.ts`
- `tests/generic-admission-guard-route-matrix.test.ts`
- `tests/generic-admission-routes.test.ts`
- `tests/generic-admission-mode-ladder.test.ts`
- `tests/consequence-admission-proof-discipline.test.ts`
- `tests/consequence-admission-finance.test.ts`
- `tests/consequence-admission-facade.test.ts`
- `tests/downstream-presentation-binding.test.ts`
- `tests/downstream-enforcement-contract.test.ts`
- `tests/consequence-admission-customer-gate.test.ts`
- `docs/audit/control-map.md`
- `docs/audit/report-index.md`
- `docs/audit/finding-index.md`

## Evidence Summary

| Evidence slice | Repo-side state | Locking evidence |
|---|---|---|
| Generic admission hard invariants | `closed repo-side / live-proof-only boundaries remain` | `tests/critical-admission-property-suite.test.ts`; `tests/generic-admission-guard-route-matrix.test.ts`; `tests/generic-admission-mode-ladder.test.ts`; `tests/generic-admission-routes.test.ts`; `tests/consequence-admission-proof-discipline.test.ts` |
| Finance vs generic guard parity | `closed repo-side / live-proof-only boundaries remain` | `tests/consequence-admission-finance.test.ts`; `tests/consequence-admission-facade.test.ts` |
| Customer gate, downstream contract, and presentation binding consistency | `closed repo-side / live-proof-only boundaries remain` | `tests/downstream-presentation-binding.test.ts`; `tests/downstream-enforcement-contract.test.ts`; `tests/consequence-admission-customer-gate.test.ts` |
| Route-level adversarial admission fixtures | `closed repo-side / live-proof-only boundaries remain` | `tests/generic-admission-guard-route-matrix.test.ts` |

## Repo-Side Result

The merged guard-depth chain gives repository evidence that:

- high-risk generic admissions cannot stay `admit` when required structured
  guard metadata is missing, empty, caller-supplied, or adversarial in the
  covered route/property cases;
- finance admission reuses matching generic guard families when structured
  metadata is present, instead of creating a weaker parallel path;
- downstream execution proof and presentation binding do not count an
  `admission-receipt` as execution authority;
- route-level adversarial fixtures now cover missing money-movement amount,
  missing money-movement recipient, missing data-disclosure scope, and missing
  authority-change mode metadata.

## Non-Claims

This is repo-side validation only.

It does not prove live customer PEP no-bypass, production deployment,
compliance readiness, external KMS/HSM signing, live connector metadata
provenance, live approval-workflow proof, live shared-store behavior, full
line-by-line behavioral audit of all consequence-admission files, production
security posture, or enterprise readiness.

The generic and finance guards still depend on customer, operator, adapter,
policy-store, evidence-store, IdP, approval-workflow, source-control,
package-registry, provenance-system, runtime-inventory, reviewer-workflow, and
agent-runtime systems to supply trustworthy structured metadata where those
guard families need it.

## Control-Map Alignment

This validation does not create a new production claim. It adds a focused
control-map evidence row so reviewers can find the merged guard-depth tests
without treating the broader consequence-admission boundary as fully audited.

`finding-index.md` does not need a new row for this slice because no new
repo-proven P0/P1 finding is introduced here. Existing rows such as OPS-167,
FIN-ADMISSION-01, OPS-214, and OPS-215 remain the finding-level closure
records.

## Verification

Evidence already merged before this alignment slice:

- `npm run test:critical-admission-property-suite`
- `npm run test:generic-admission-guard-route-matrix`
- `npm run test:generic-admission-mode-ladder`
- `npm run test:generic-admission-routes`
- `npm run test:consequence-admission-proof-discipline`
- `npm run test:consequence-admission-finance`
- `npm run test:consequence-admission-facade`
- `npm run test:downstream-presentation-binding`
- `npm run test:downstream-enforcement-contract`
- `npm run test:consequence-admission-customer-gate`
- `npm run typecheck`
- `npm run typecheck:hygiene`
- `npm run build`

This docs-alignment slice must keep the audit evidence checks green before it
is merged.

## Verdict

Repo-side guard-depth evidence is integrated for the scoped chain.

Live proof still required: yes.

Production readiness proven: no.

Enterprise readiness proven: no.

Next target: live customer PEP no-bypass, KMS/HSM signing, shared-store, and
operator deployment proof remain separate work before stronger live or
limited-enforcement claims.
