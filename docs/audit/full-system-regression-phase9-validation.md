# Full-System Regression Phase 9 Validation Intake

Status: no-runtime / test-lock validation intake. This report reconciles an
external Phase 9 full-system regression report against current `origin/master`
evidence. The external report is treated as reviewer input, not authority.

## Recent Fixes Chain-Effect Check

Source of truth: `origin/master @ b7a55d5f7cb801442c6c18fcabeb5192788dab91`.

Recent relevant changes:

- PR #714 / `8d1f0ce6` surfaced scope-guard reasons on generic admission
  per-check output and changed narrowed scope outcomes to warn the policy
  check.
- PR #722 / `68407546` hardened hosted generic-admission tenant and
  shadow-recording checks.
- PR #724 / `e1e21054` clarified the scope tenant boundary no-claim.
- PR #730 / `b7a55d5f` integrated the scope/webhook validation packet as a
  no-code report and report-index row.

Chain-effect verdict: PR #730 is docs/index-only and did not change runtime
behavior. It does, however, supersede parts of the external Phase 9 report by
recording current evidence for hosted tenant binding, webhook localization, and
shadow-recording fail-closed behavior.

## Validation Frame

| Field | Value |
|---|---|
| Source of truth | `origin/master`, not local `master` |
| Current HEAD | `b7a55d5f7cb801442c6c18fcabeb5192788dab91` |
| External report basis | Reviewer-reported `025b2dee` audit basis with drift through `9b0a0344`; current validation continues through merge commit `b7a55d5f` |
| Protected principles | auditability; fail-closed boundary; tenant isolation; proof integrity; no overclaim; operational boundedness |
| Scope | Phase 9 P2/P3 claims, with a narrow lock-test for generic admission guard reason-code surfacing |
| No-claim | This is not a full line-by-line refactor audit, production-readiness update, enterprise-readiness update, or live proof capture |

## Inspected Files

- `AGENTS.md`
- `docs/audit/current-posture-baseline.md`
- `docs/audit/report-index.md`
- `docs/audit/finding-index.md`
- `docs/audit/control-map.md`
- `docs/audit/live-proof-register.md`
- `docs/audit/attestor-audit-remediation-tracker.md`
- `docs/audit/consequence-admission-scope-webhook-validation.md`
- `README.md`
- `docs/01-overview/repository-navigator.md`
- `docs/02-architecture/scope-explosion-guard.md`
- `docs/02-architecture/scripts-inventory.md`
- `docs/05-proof/failure-modes-and-controls.md`
- `src/consequence-admission/contracts.ts`
- `src/consequence-admission/generic-engine.ts`
- `src/consequence-admission/scope-explosion-guard.ts`
- `src/service/http/routes/generic-admission-routes.ts`
- `scripts/probe/probe-consequence-admission-package-surface.mjs`
- `scripts/verify/verify-mq-cert.ts`
- `scripts/verify/verify-mq-kit.ts`
- `tests/generic-admission-mode-ladder/drift-authority-scope-tests.ts`
- `tests/scripts-inventory-docs.test.ts`

`CLAUDE.md` was not present in the current checkout.

## Skipped Files

- Full `src/service/**` and `src/consequence-admission/**` line-by-line audit.
- Full OpenAPI, package export, admin-helper, and control-plane-store byte
  audit.
- Full baseline scorecard rewrite.
- Live provider, customer PEP, shared-store/RLS, KMS, branch-protection, or
  deployment proof capture.

## Trust Boundaries And Relevant Surfaces

- Generic admission reason-code surfacing is a reviewer/operator evidence
  surface. It must not silently lose guard reason codes at the per-check layer.
- The scope guard remains a requested-vs-approved metadata guard. It does not
  grant tenant authority, prove tenant isolation, or replace the hosted route,
  customer gate, trusted policy store, or live shared-store/RLS boundary.
- Scripts inventory is maintainer reference only. Naming a script in the
  inventory does not make it production proof or an npm gate.

## Claim Reconciliation

| External claim | Current classification | Repository evidence | Action in this slice |
|---|---|---|---|
| No P0/P1 found in the external Phase 9 review. | `partial-repo` | Current report/finding indexes still show no new repo-proven P0/P1 from this packet; GitHub checks for PR #730 passed. | Keep no-P0/P1 as a scoped validation statement, not a full security certification. |
| P2-1 scope guard tenant dimension is self-referential for package callers. | `repo-proven accepted limitation` | `scope-explosion-guard.ts` compares requested vs approved tenant metadata; docs state package callers must source approved scope from a trusted policy source. Hosted route mismatch bypass is `contradicted`. | No runtime code change. Keep no-claim boundary; separate design change required before changing package semantics. |
| P2-2 baseline HEAD is stale relative to the refactor wave. | `repo-proven / partial-repo` | `current-posture-baseline.md` records Baseline HEAD `2292828d`; report-index now carries later sweep/intake rows through `b7a55d5f`. | No broad baseline rewrite in this slice. Baseline reconciliation remains a separately scoped task only if material posture changes are being updated. |
| P3-1 missing `recordShadowAdmission` silently skips shadow recording. | `contradicted` | `generic-admission-routes.ts` returns 503 `shadow-recording-unavailable` when `recordShadowAdmission` is absent or throws; route tests cover the path. | No code action. |
| P3-2 scope reason surfacing was fixed by PR #714. | `repo-proven closed` | `GENERIC_ADMISSION_SCOPE_EXPLOSION_REASON_CODES.has(reason)` is present in `reasonCodesForCheck`; tests cover narrowed scope reasons on the policy check. | No runtime action. |
| P3-3 guard reason-code allowlist is maintenance-fragile. | `repo-proven hardening opportunity` | Current code maps known generic guard reason-code sets manually in `reasonCodesForCheck`. | Added a lock test that every `GENERIC_ADMISSION_*_REASON_CODES` set exported by `contracts.ts` is referenced in the per-check mapping. |
| P3-4 public "9 guard" count is stale. | `not proven` as a current public-doc defect | Targeted scan did not find a current public "9 guard" claim requiring correction; one SVG label refers to 9 covered profiles, not guard count. | No doc action. |
| P3-5 package-surface split scripts are orphaned. | `contradicted` for `surface-01..07`; `partial-repo` for MQ helpers | The surface split files are imported by `probe-consequence-admission-package-surface.mjs`, which is exposed through `package.json`. `verify-mq-kit.ts` and `verify-mq-cert.ts` live under the documented multi-query kit verify family. | Clarified the scripts inventory examples to name both MQ helper scripts. |

## Chain Reactions

- Direct regression: none expected; no runtime source changed.
- Downstream caller breakage: none expected; the added test reads source files
  and does not alter public exports.
- Defense-in-depth weakening: none.
- Behavior change: none.
- Cross-fix interaction: aligns PR #714 reason surfacing with the current
  report-index evidence from PR #730.
- Test coverage drift: reduced for generic admission reason-code surfacing.
- Config/manifest drift: none.
- Docs/index drift: this report adds the required report-index intake row for
  the Phase 9 external report.
- Previously closed finding reopened: no repo-proven P0/P1 reopened.

## Coverage Delta

Added a regression check inside `npm run test:generic-admission-mode-ladder`:
the generic admission mode ladder now fails if a
`GENERIC_ADMISSION_*_REASON_CODES` set exported by `contracts.ts` is not mapped
into `reasonCodesForCheck`.

Verified in this slice:

- `npm run test:generic-admission-mode-ladder`
- `npm run test:generic-admission-routes`
- `npm run test:scope-explosion-guard`
- `npm run test:scripts-inventory-docs`
- `npm run check:security-evidence-system`
- `npm run test:security-evidence-system`
- `npm run test:audit-finding-test-coverage`
- `git diff --check`

Tier 4 `npm run verify` was not run; this is a narrow docs/test-lock slice, not
a runtime rewiring or release-prep gate.

## Verdict

The Phase 9 report is integrated as a current `origin/master` validation intake.
No new repo-proven P0/P1 was found in this slice. One P3 maintenance risk is
reduced by a source-level lock test, and the MQ helper inventory is clarified.
The scope-tenant package concern remains an explicit accepted limitation /
design boundary, not a hosted tenant-isolation bypass.

## Next Locked Target

If more work is desired from the Phase 9 report, scope it separately:

- baseline reconciliation against current `origin/master`, if material posture
  text needs updating;
- package/OpenAPI/admin-helper byte audit;
- package-level scope guard design change, only after deciding whether to add
  a trusted authenticated tenant anchor or keep the current no-claim boundary.

## Final Checkpoint

- Scoped validation complete: yes, for Phase 9 report intake.
- Another round required: no for this no-runtime/test-lock slice.
- Repo-proven P0/P1 introduced: no.
- Live proof needed: unchanged. Customer PEP no-bypass, external KMS runtime
  signing, shared replay/introspection, live tenant shared-store/RLS, and live
  provider endpoint proofs remain required.
- Production proven: no.
- Enterprise ready: no.
