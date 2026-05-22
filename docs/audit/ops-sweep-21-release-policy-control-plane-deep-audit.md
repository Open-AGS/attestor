# Ops Sweep 21 - Release-Policy-Control-Plane Deep Audit

Status: read-only audit integrated as a report. No runtime remediation was
written by this sweep. Engine-substrate sweep 4/N completes the
release-{kernel decision, enforcement runtime, policy-control authoring} triad.

Remediation follow-up, 2026-05-22: OPS-160 is repo-side closed by
proof-discipline docs and `tests/release-policy-control-plane-proof-discipline.test.ts`.
OPS-161 is closed repo-side and remains live-proof-only behind
`LP-POLICY-MUTATION-AUDIT-CHAIN-SHARED-STORE` /
`ATTESTOR_POLICY_MUTATION_AUDIT_CHAIN_PROOF`. OPS-162 remains accepted
limitation / live-proof-only behind
`LP-POLICY-ACTIVATION-APPROVAL-SHARED-STORE` /
`ATTESTOR_POLICY_ACTIVATION_APPROVAL_STORE_PROOF`. This follow-up does not
claim production readiness, enterprise readiness, or multi-instance durability.

Remediation follow-up, 2026-05-22 (OPS-163): focused approval-state and
scope-precedence depth is repo-side closed. `activation-approvals.ts` now
rejects post-expiry approval decisions and uses binary request ordering for
same-timestamp approval requests; `tests/release-policy-control-plane-activation-approvals.test.ts`
and `tests/release-policy-control-plane-scoping.test.ts` lock the approval
state machine, late-decision denial, reviewer separation, risk TTLs, scope
hierarchy, precedence, ambiguity, and descriptor alignment. Source anchors:
NIST SP 800-162 ABAC and OWASP Authorization Cheat Sheet guidance. This does
not claim multi-instance approval-store durability, live policy activation,
customer PEP no-bypass, production readiness, or a full line-by-line audit of
all release-policy-control-plane files.

## 0. Recent Fixes Chain-Effect Check

One merge into `origin/master` since Sweep 20 was drafted:

- PR #527 / commit `d5da5f63` - "Add Sweep 20 release enforcement audit"
- Merge head `f1d79d28797c3daea5d95eb145b3d3834a5b3155`

Files changed by PR #527 were docs-only. Chain-effect verdict: PR #527 does
not touch `src/release-policy-control-plane/**` or related tests. No
release-policy-control-plane regression, config drift, defense weakening, or
closed-finding reopening was found.

Sweep 20 OPS-155 remains open and independent of this policy-control-plane
scope.

## 1. Validation Frame

| Field | Value |
|---|---|
| Source of truth HEAD | `origin/master @ f1d79d28797c3daea5d95eb145b3d3834a5b3155` |
| Phase | Phase 1 - Live Shadow Readiness; substrate for Phase 2 - Limited Live Enforcement |
| Baseline blocker in scope | Release decision engine substrate: policy authoring, activation, approval, signing, scoping, and mutation audit log |
| Protected principles | release provenance; auditability; customer authority; fail-closed boundary; tenant isolation; replay and idempotency safety; no overclaim |
| Audit driver | Sweep 20 verdict: release-policy-control-plane completes the release-engine triad after release-kernel and release-enforcement-plane |
| External anchors | DSSE; in-toto Statement v1; RFC 8785 JSON Canonicalization Scheme as design vocabulary only; tamper-evident hash-chain audit log pattern; CWE-285, CWE-639, CWE-345, CWE-693, CWE-1289 |
| Scope | 18 files in `src/release-policy-control-plane/` totaling 6,656 lines; 19 dedicated `tests/release-policy-control-plane*.test.ts` files totaling 6,522 lines |

## 2. Inspected Files

| File | Lines | Depth | Evidence source | Why selected |
|---|---:|---|---|---|
| `src/release-policy-control-plane/bundle-signing.ts` | 309 | targeted-deep | local matches `origin/master` | DSSE + in-toto policy-bundle signing; EdDSA-only type narrowing; signer boundary non-claims |
| `src/release-policy-control-plane/bundle-format.ts` | 298 | targeted | local matches `origin/master` | DSSE/in-toto constants: `application/vnd.in-toto+json`, in-toto Statement v1, policy predicate type |
| `src/release-policy-control-plane/audit-log.ts` | 435 | targeted-deep | local matches `origin/master` | Tamper-evident policy mutation audit log; entry digest, previous digest, mutation digest, file lock |
| `src/release-policy-control-plane/scoping.ts` | 296 | targeted-deep | local matches `origin/master` | Scope precedence, deterministic specificity score, binary string tie-break; B-081 closure verification |
| `src/release-policy-control-plane/activation-approvals.ts` | 748 | targeted-deep | local matches `origin/master` | Approval state machine, gate statuses, reviewer separation, risk-class TTLs, in-memory/file-backed stores |
| `src/release-policy-control-plane/resolver.ts` | 347 | inventory | local matches `origin/master` | Active policy resolver surface |
| `src/release-policy-control-plane/runtime.ts` | 243 | inventory | local matches `origin/master` | Runtime policy lookup surface |
| `src/release-policy-control-plane/simulation.ts` | 215 | inventory | local matches `origin/master` | Policy simulation surface |
| 10 additional policy-control files | 3,765 | inventory | local matches `origin/master` | Records, cache, discovery, finance proving, impact summary, object model, store, test pack, types, barrel |
| 19 dedicated policy-control-plane tests | 6,522 | inventory | `git ls-tree` + local line counts | Per-module regression-lock signal plus admin-routes, platform-surface, and service-adoption tests |

## 3. Skipped Files

| File / path | Why skipped | Risk of skipping | Queue priority |
|---|---|---|---|
| Full body of `activation-approvals.ts` and `scoping.ts` | OPS-163 follow-up now covers the approval state machine and scope-precedence traversal at focused behavioral depth with dedicated tests; a full line-by-line audit of every branch is still not claimed | low | No immediate queue unless new module-specific risk appears |
| Full body of `bundle-signing.ts`, `audit-log.ts`, `resolver.ts`, `runtime.ts`, `simulation.ts` | Entry contracts and critical constants verified; implementation details rely on dedicated tests for this sweep | medium | Dedicated sub-sweep if interop or runtime activation risk appears |
| `src/service/http/routes/release-policy-control-routes.ts` | Route layer was already audited by Sweep 12 and OPS-100 remediation | low | No immediate queue |

Honesty disclosure: this sweep is spec + entry-point + targeted-deep + test
inventory. It is not a full line-by-line behavioral audit of all 6,656 source
lines. OPS-165 tracks that depth limit.

## 4. Positive Observations

| ID | Observation | Evidence (`origin/master`) | Why it matters |
|---|---|---|---|
| OPS21-POS-01 | Policy bundles use DSSE payload type `application/vnd.in-toto+json` and in-toto Statement v1 | `bundle-format.ts:22-24`, `bundle-signing.ts:62-66`; in-toto Statement v1 spec; DSSE spec | Extends Sweep 19 OPS-147: DSSE/in-toto is repo-proven for evidence packs and policy bundles |
| OPS21-POS-02 | Policy bundle signing is EdDSA-only by type narrowing | `bundle-signing.ts:39-42` | Algorithm surface is intentionally narrow |
| OPS21-POS-03 | Policy bundle signer boundary says `productionReady: false` and external KMS/HSM required for production | `bundle-signing.ts:114-130` | No overclaim on process-memory signing |
| OPS21-POS-04 | Policy mutation audit entries carry `sequence`, `mutationDigest`, `previousEntryDigest`, and `entryDigest` | `audit-log.ts:31-45` | Mutation audit is tamper-evident |
| OPS21-POS-05 | Policy mutation audit verification returns `valid`, `verifiedEntries`, and `brokenEntryId` | `audit-log.ts:57-61`, `audit-log.ts:244-279` | Chain verification is explicit |
| OPS21-POS-06 | File-backed policy mutation audit uses `withFileLock` | `audit-log.ts:4`, `audit-log.ts:376-381` | Single-node serialization is present; multi-instance proof still needs shared backing |
| OPS21-POS-07 | B-081 closure is repo-proven: `compareCanonicalLabels` uses binary string comparison, not `localeCompare` | `scoping.ts:126-130` | Scope tie-break is deterministic across locales |
| OPS21-POS-08 | Scope precedence order is frozen: account, tenant, wedge, domain, risk-class, consequence-type, cohort, plan | `scoping.ts:27-39` | Scope match is structural and ordered |
| OPS21-POS-09 | Specificity score uses unique bit positions per precedence dimension | `scoping.ts:120-124` | Most scope specificity ties are mechanically avoided |
| OPS21-POS-10 | Ambiguous top candidates are surfaced and winner becomes `null` | `scoping.ts:283-294` | Ambiguity is not silently resolved |
| OPS21-POS-11 | Approval gate statuses are typed and explicit | `activation-approvals.ts:40-51` | Approval state does not collapse to free text |
| OPS21-POS-12 | Approval requirement modes are `none`, `named-reviewer`, and `dual-approval` | `activation-approvals.ts:34-38` | Activation review policy is typed |
| OPS21-POS-13 | Distinct reviewer and requester-separation requirements are first-class fields | `activation-approvals.ts:57-58`, `activation-approvals.ts:610` | Separation-of-duties is represented in code |
| OPS21-POS-14 | Default approval TTL is bounded by risk class: R0/R1/R2 24h, R3 8h, R4 4h | `activation-approvals.ts:26-32` | Higher-risk approvals expire sooner |
| OPS21-POS-15 | Approval decisions and approval requests are content-addressed by digest | `activation-approvals.ts:71`, `activation-approvals.ts:91`, `activation-approvals.ts:294-310` | Approval records are tamper-evident |
| OPS21-POS-16 | Approval stores have in-memory and file-backed variants plus explicit test reset | `activation-approvals.ts:475-527` | Store boundary is visible and testable |
| OPS21-POS-17 | 19 dedicated tests cover the policy-control surface | `git ls-tree` inventory | Regression-lock evidence is broad |

## 5. Findings

| ID | Severity | State | Title | Evidence (`origin/master`) | Protected principle | Recommended next action |
|---|---:|---|---|---|---|---|
| OPS-160 | P2 | `open / partial-repo` | Sweep 19 OPS-147 DSSE/in-toto clarification should extend to policy bundles | `bundle-format.ts:22-24` declares DSSE/in-toto policy-bundle constants; `bundle-signing.ts:62-66` defines `PolicyBundleDsseEnvelope` | proof integrity; no overclaim | Update audit docs to state DSSE/in-toto interop is repo-proven for release-kernel evidence packs and release-policy-control-plane policy bundles |
| OPS-161 | P2 | `open / partial-repo` | Policy mutation audit log file-backed writer is not multi-instance proof | `audit-log.ts` uses `withFileLock` and default local path `.attestor/release-policy-mutation-audit-log.json` | replay and idempotency safety; auditability | Document production bootstrap requirement and add `LP-POLICY-MUTATION-AUDIT-CHAIN-SHARED-STORE` |
| OPS-162 | P2 | `accepted limitation` | Activation approval store production bootstrap requires shared backing for multi-instance claims | `activation-approvals.ts:475-527` has in-memory/file-backed constructors and reset-for-tests; shared-control-plane behavior is outside this file | replay and idempotency safety | Keep as bootstrap discipline; do not claim multi-instance approval durability from file-backed/in-memory stores |
| OPS-163 | P2 | `closed` | Approval state-machine and scope-precedence focused behavioral depth | `activation-approvals.ts` rejects approval decisions after request expiry and uses binary `compareCanonicalKeys` for same-timestamp request ordering; `tests/release-policy-control-plane-activation-approvals.test.ts` covers R4 dual approval, requester separation, post-expiry denial, distinct reviewers, expired/mismatched/bundle-digest gates, risk TTLs, locale-independent digest and list ordering, and file-backed persistence; `tests/release-policy-control-plane-scoping.test.ts` covers environment boundaries, wildcard matching, hierarchy validation, precedence, no-match handling, most-specific winner selection, same-precedence ambiguity, malformed-label ambiguity, and descriptor alignment | release provenance; auditability | Repo-side closed. Keep OPS-165 as the full-line-by-line depth disclosure; keep multi-instance approval durability live-proof-only under OPS-162. |
| OPS-164 | P3 | `accepted limitation` | Approval TTL defaults are hardcoded by risk class | `activation-approvals.ts:26-32` hardcodes 24h/8h/4h defaults; per-request `expiresAt` can override | operational boundedness; auditability | Keep; document deliberate hardcoding as safer than environment-wide loosening |
| OPS-165 | P3 | `not proven` | Sweep-budget line-by-line gap | 18 source files / 6,656 source lines; this sweep targeted 5 critical modules and inventoried the rest | auditability; no overclaim | Keep the disclosure; future sub-sweeps drill into specific modules |

## 6. Release-Policy-Control-Plane Surface Matrix

| # | File | Kind | Lines | Test file | Finding |
|---:|---|---|---:|---|---|
| 1 | `bundle-signing.ts` | signing | 309 | `tests/release-policy-control-plane-bundle-signing.test.ts` | OPS-160 |
| 2 | `bundle-format.ts` | format | 298 | `tests/release-policy-control-plane-bundle-format.test.ts` | OPS-160 |
| 3 | `audit-log.ts` | audit | 435 | `tests/release-policy-control-plane-audit-log.test.ts` | OPS-161 |
| 4 | `scoping.ts` | scoping | 296 | `tests/release-policy-control-plane-scoping.test.ts` | OPS-163 |
| 5 | `activation-approvals.ts` | approvals | 748 | `tests/release-policy-control-plane-activation-approvals.test.ts` | OPS-162/163/164 |
| 6 | `activation-records.ts` | records | 325 | `tests/release-policy-control-plane-activation-records.test.ts` | none new |
| 7 | `bundle-cache.ts` | cache | 252 | `tests/release-policy-control-plane-bundle-cache.test.ts` | none new |
| 8 | `discovery.ts` | discovery | 533 | `tests/release-policy-control-plane-discovery.test.ts` | none new |
| 9 | `finance-proving.ts` | proving | 433 | `tests/release-policy-control-plane-finance-proving.test.ts` | none new |
| 10 | `impact-summary.ts` | impact | 539 | `tests/release-policy-control-plane-impact-summary.test.ts` | none new |
| 11 | `object-model.ts` | model | 439 | `tests/release-policy-control-plane-object-model.test.ts` | none new |
| 12 | `resolver.ts` | resolver | 347 | `tests/release-policy-control-plane-resolver.test.ts` | OPS-165 |
| 13 | `runtime.ts` | runtime | 243 | covered by service-adoption/platform-surface tests | OPS-165 |
| 14 | `simulation.ts` | simulation | 215 | `tests/release-policy-control-plane-simulation.test.ts` | OPS-165 |
| 15 | `store.ts` | store | 472 | `tests/release-policy-control-plane-store.test.ts` | none new |
| 16 | `test-pack.ts` | test pack | 358 | `tests/release-policy-control-plane-test-pack.test.ts` | none new |
| 17 | `types.ts` | types | 259 | `tests/release-policy-control-plane-types.test.ts` | none new |
| 18 | `index.ts` | barrel | 155 | `tests/release-policy-control-plane-platform-surface.test.ts` | none new |

Additional tests: `tests/release-policy-control-plane-admin-routes.test.ts` and
`tests/release-policy-control-plane-service-adoption.test.ts`.

## 7. Verification

| Question | Source | Verdict |
|---|---|---|
| Are policy bundles DSSE + in-toto shaped? | `bundle-format.ts:22-24`; `bundle-signing.ts:62-66`; DSSE and in-toto specs | repo-proven |
| Is policy bundle signing EdDSA-only? | `bundle-signing.ts:39-42` | repo-proven |
| Is process-memory policy bundle signing explicitly not production ready? | `bundle-signing.ts:114-130` | repo-proven |
| Is policy mutation audit hash-chained? | `audit-log.ts:31-45`, `audit-log.ts:244-279` | repo-proven |
| Is policy audit file-backed writer multi-instance proof? | `audit-log.ts` local file path + `withFileLock` | not proven; OPS-161 |
| Does scoping avoid locale-sensitive tie-break? | `scoping.ts:126-130`; no `localeCompare` | repo-proven |
| Are ambiguous top policy candidates surfaced? | `scoping.ts:283-294` | repo-proven |
| Are approval gate outcomes typed? | `activation-approvals.ts:40-51` | repo-proven |
| Are approval TTLs risk-class bounded? | `activation-approvals.ts:26-32` | repo-proven |
| Are post-expiry approval decisions rejected before state mutation? | `activation-approvals.ts`; `tests/release-policy-control-plane-activation-approvals.test.ts` | repo-proven; OPS-163 closed |
| Does approval request listing avoid locale-sensitive tie-breaks? | `activation-approvals.ts`; `tests/release-policy-control-plane-activation-approvals.test.ts` | repo-proven; OPS-163 closed |
| Does scope precedence cover environment, hierarchy, specificity, and ambiguity behavior? | `scoping.ts`; `tests/release-policy-control-plane-scoping.test.ts`; NIST SP 800-162 ABAC; OWASP Authorization Cheat Sheet | repo-proven for repository behavior; source-backed for the access-control framing |
| Are full 6,656 lines line-by-line audited? | local line count + sweep scope | not proven; OPS-165 |

Verdict: the release-policy-control-plane is repo-proven at spec,
entry-point, targeted-deep, approval/scoping focused behavioral, and
test-inventory level. The main gaps are production bootstrap discipline and
the explicit OPS-165 line-by-line depth disclosure.

## 8. Discrepancy Check Against Indexes

| Topic | Current index state | Sweep 21 result | Required update |
|---|---|---|---|
| Sweep 19 OPS-147 | Evidence-pack DSSE/in-toto clarified | Extend to policy-bundle layer | Update finding/control/baseline text |
| B-081 | closed | `scoping.ts:126-130` confirms binary comparison, not `localeCompare` | no state change |
| `OPS-SWEEP-21` | not present | needed | add report-index row |
| OPS-160..165 | not present | needed | add finding-index rows |
| Policy mutation audit shared store proof | not present | needed | add live-proof register row |

## 9. Chain Reactions

| Change candidate | Downstream effect | Risk | Test / proof needed |
|---|---|---|---|
| OPS-160 doc extension | Proof/signing docs align with policy-bundle implementation | low | docs/evidence checks |
| OPS-161 live-proof row | Multi-instance policy mutation audit proof becomes explicit | low | live operator proof later |
| OPS-162 bootstrap discipline | Avoids claiming file-backed/in-memory approval store as HA proof | low | docs only |
| OPS-163 approval/scoping locks | Late approval decisions fail closed and approval/scope ordering stays deterministic | low | activation/scoping tests; no production or shared-store proof claim |

## 10. Coverage Delta

- Before this sweep: Sweep 12 covered release-policy-control routes; the engine
  internals were not consolidated in one audit report.
- After this sweep: 18/18 source files inventoried; 5 critical modules
  targeted-deep; 19 tests inventoried; DSSE/in-toto policy-bundle support and
  B-081 closure verified.
- After OPS-163 follow-up: activation approval late-decision denial and
  deterministic request ordering are runtime-wired and tested; scoping
  precedence, ambiguity, and descriptor alignment remain locked by dedicated
  tests.
- Corrected count: 6,656 source lines, not approximately 5,500.
- No production proof claim: KMS, customer PEP, shared replay/introspection,
  and multi-instance policy mutation audit proof remain external/runtime work.

## 11. Index Updates

This PR integrates:

- `docs/audit/finding-index.md`: OPS-160 through OPS-165 and OPS-147 text
  extension.
- `docs/audit/report-index.md`: `OPS-SWEEP-21`.
- `docs/audit/current-posture-baseline.md`: baseline HEAD/counts, proof/signing
  text, and release-policy-control substrate row.
- `docs/audit/control-map.md`: proof/signing authority text.
- `docs/audit/live-proof-register.md`: `LP-POLICY-MUTATION-AUDIT-CHAIN-SHARED-STORE`.
- OPS-163 follow-up: `activation-approvals.ts`,
  `tests/release-policy-control-plane-activation-approvals.test.ts`, and
  `tests/release-policy-control-plane-scoping.test.ts` plus audit index/report
  alignment.

## 12. Verdict

- Is the Sweep 21 report complete? Yes, at spec + entry-point + targeted-deep
  + test-inventory level. No, not as a full line-by-line behavioral audit of
  all 6,656 source lines.
- Is there a repo-proven P0? No.
- Is there a repo-proven P1? No.
- Is remediation required? OPS-160/161 and OPS-163 are repo-side remediated;
  OPS-162 remains an accepted live-proof-only limitation and OPS-165 remains a
  no-overclaim depth disclosure.
- Can the next sweep proceed without reopening Sweep 21 P2? Yes; keep only
  live proof and explicit depth-disclosure items visible.
- Recommended next target: continue the current remaining open/partial backlog
  rather than reopening closed Sweep 21 items without new evidence.

## Final Checkpoint

- Done: Sweep 21 report integrated for
  `origin/master @ f1d79d28797c3daea5d95eb145b3d3834a5b3155`; 18 source files,
  19 tests, DSSE/in-toto policy-bundle support, B-081 closure, approval state
  machine, and policy mutation audit log mapped. OPS-163 follow-up adds
  runtime-wired late-decision denial and deterministic approval ordering plus
  approval/scoping behavioral tests.
- Not done: no line-by-line behavioral audit of all 6,656 source lines; no
  production/shared-store proof; no customer PEP/no-bypass proof.
- Files changed by integration: this report plus audit indexes, baseline,
  control map, and live proof register.
- Next action: continue remaining open/partial backlog; do not claim
  production, enterprise, multi-instance approval durability, or full
  line-by-line release-policy-control-plane audit.
