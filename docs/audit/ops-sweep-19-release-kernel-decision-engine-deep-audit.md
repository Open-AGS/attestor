# Ops Sweep 19 - Release-Kernel Decision Engine Deep Audit

Status: read-only audit. No remediation written in this report. No runtime
behavior changed. This is engine-substrate sweep 2 after Sweep 18 signing
surface, focused on `src/release-kernel/**` and the two `src/release-layer/**`
barrels.

## 0. Recent Fixes Chain-Effect Check

One merge into `origin/master` since Sweep 18:

- PR #525 / commit `65503364` - "Add Sweep 18 signing surface audit".
- Merge head: `136688fbab3ec83be116c0bf315f419656a50a4f`.

Files changed by PR #525 were docs-only: `docs/audit/ops-sweep-18-signing-surface-deep-audit.md`
and audit index updates. PR #525 did not touch `src/release-kernel/**`,
`src/release-layer/**`, release-kernel tests, or release-policy-control
internals.

Chain-effect verdict: no regression, config drift, or defense-in-depth weakening
was found for the Sweep 19 scope. The only material follow-up is a wording
clarification: Sweep 18 correctly narrowed OPS-143 to the primitive signing
surface, but Sweep 19 confirms the release evidence-pack layer itself is DSSE
and in-toto-shaped.

## 1. Validation Frame

| Field | Value |
|---|---|
| Source of truth HEAD | `origin/master @ 136688fbab3ec83be116c0bf315f419656a50a4f` |
| Phase | Phase 1 - Live Shadow Readiness; substrate for Phase 2 - Limited Live Enforcement |
| Baseline blockers in scope | `Proof / signature / key authority`; `Token / replay / idempotency`; evidence-pack and release-token substrate behind existing KMS/replay live-proof gaps |
| Protected principles | proof integrity; release provenance; auditability; fail-closed boundary; replay and idempotency safety; no overclaim; operational boundedness |
| Scope | 22 `src/release-kernel/**` source files plus 2 `src/release-layer/**` barrels; deep audit focused on decision engine, decision log, evidence pack, token introspection, deterministic checks, canonicalization, first hard gateway wedge, and object model |
| External anchors | RFC 8785 JSON Canonicalization Scheme; DSSE v1.0 envelope shape; in-toto Statement v1; SLSA v1.0 provenance; CWE-345, CWE-693, CWE-829 |

## 2. Inspected Files

| File | Depth | Why selected |
|---|---|---|
| `src/release-kernel/release-decision-engine.ts` | targeted body read | Entry point for `createReleaseDecisionEngine`, policy resolution, fail-closed unmatched policy behavior, deterministic-check path, and decision logging |
| `src/release-kernel/release-decision-log.ts` | targeted body read | Hash-chained decision log, file-backed writer, `randomUUID()` entry IDs, and chain verifier |
| `src/release-kernel/release-evidence-pack.ts` | targeted body read | DSSE + in-toto Statement v1 envelope, evidence-pack issuer, content digest, and verification result surface |
| `src/release-kernel/release-introspection.ts` | targeted body read | Release-token registry, active/inactive introspection, lifecycle states, in-memory and file-backed store variants |
| `src/release-kernel/release-deterministic-checks.ts` | full head/body read | Mechanical deterministic checks and category outcomes |
| `src/release-kernel/release-canonicalization.ts` | full read | Release output/consequence canonicalization and hash bundle |
| `src/signing/sign.ts` | full canonicalization read | Parity comparison against release canonicalization |
| `src/release-kernel/first-hard-gateway-wedge.ts` | full read | Frozen product-decision wedge contract |
| `src/release-kernel/release-policy.ts` | targeted body read | Dynamic first hard gateway release policy |
| `src/release-layer/{finance,index}.ts` | inventory | Re-export/barrel layer, not the decision engine itself |
| release-kernel tests | inventory | Confirms broad 1:1 regression-lock surface |

## 3. Skipped Files

| File / path | Why skipped | Risk | Queue priority |
|---|---|---|---|
| Full body of `release-evidence-pack.ts` lines after the type/interface block | DSSE/in-toto envelope shape and verification entry points were verified; full issuer/store correctness is separately covered by release-evidence-pack tests | medium | dedicated evidence-pack interop sub-sweep if external verifier interoperability becomes a release claim |
| `compiled-policy-*`, `consequence-rollout`, finance release modules, `release-shadow-mode`, `release-token`, `release-verification`, `reviewer-queue`, `risk-controls`, `types` | Inventory and test coverage confirmed; these are adjacent kernel modules, not the core decision-engine path audited line-by-line here | low-medium | future sub-sweeps if rollout, reviewer, or token semantics become the target |
| `src/release-enforcement-plane/**` | Separate runtime enforcement subsystem: DPoP, HTTP message signatures, middleware, online/offline verifier, envoy ext-authz | medium | recommended Sweep 20 |
| `src/release-policy-control-plane/**` | Separate policy-control subsystem; routes were audited in Sweep 12, internals were not | medium | recommended after enforcement-plane |

No critical release-kernel decision-engine file was skipped at the core audit
layer.

## 4. Positive Observations

| ID | Observation | Evidence | Why it matters |
|---|---|---|---|
| OPS19-POS-01 | Release evaluation phases are typed: `policy-resolution`, `deterministic-checks`, `review`, `terminal-accept`, `terminal-deny`. | `release-decision-engine.ts:54-59` | Phase transitions are enumerable, not free-text. |
| OPS19-POS-02 | Unmatched policy scope fails closed with a denied skeleton and terminal-deny phase. | `release-decision-engine.ts:353-394` | Unknown consequence scope cannot accidentally proceed. |
| OPS19-POS-03 | Policy matching is structural: active status plus output contract, capability boundary, and target kind. | `release-decision-engine.ts:335-350` | Scope binding is not based on policy name alone. |
| OPS19-POS-04 | Evaluation result carries policy provenance, including compiled policy hash / IR hash where available. | `release-decision-engine.ts:100-138,395-442` | Decision lineage remains audit-friendly. |
| OPS19-POS-05 | Deterministic checks are mechanical and explicitly avoid model/heuristic authority. | `release-deterministic-checks.ts:1-53` | Supports the deterministic control boundary. |
| OPS19-POS-06 | Decision-log entries include sequence, previous digest, and entry digest; verifier rejects chain mismatch. | `release-decision-log.ts:478-522` | Tamper evidence exists at the decision-log layer. |
| OPS19-POS-07 | File-backed decision-log reads/appends are wrapped in `withFileLock`. | `release-decision-log.ts:549-583` | Single-instance/file-backed durability is bounded and serialized. |
| OPS19-POS-08 | Release evidence packs use `application/vnd.in-toto+json` payload type and in-toto Statement v1 `_type`. | `release-evidence-pack.ts:34-36,143-159` | Confirms the DSSE/in-toto-shaped release evidence layer. |
| OPS19-POS-09 | Evidence-pack DSSE pre-auth encoding uses the `DSSEv1` prefix before signing/verifying. | `release-evidence-pack.ts:633-641,910-961` | Avoids raw payload signing ambiguity. |
| OPS19-POS-10 | Issued evidence packs include `bundleDigest`, `keyId`, `publicKeyFingerprint`, and `issuedAt`. | `release-evidence-pack.ts:161-171,929-1038` | External validation can bind content and key identity. |
| OPS19-POS-11 | Release-token introspection has four typed states: issued, revoked, expired, consumed. | `release-introspection.ts:43-44` | Lifecycle handling is explicit. |
| OPS19-POS-12 | Active and inactive introspection results are different types. | `release-introspection.ts:143-198` | Inactive tokens cannot be accidentally treated as authorized by shape alone. |
| OPS19-POS-13 | Release canonicalization binds output and consequence hashes separately. | `release-canonicalization.ts:44-59,183-203` | Runtime consequence matching can differ from output artifact matching without losing traceability. |
| OPS19-POS-14 | The first hard gateway wedge is a frozen product decision with explicit target kinds and out-of-scope list. | `first-hard-gateway-wedge.ts:37-98` | Scope drift is constrained in code, not only prose. |
| OPS19-POS-15 | The dynamic first hard gateway policy consumes the static wedge for consequence type, risk class, and target kinds. | `release-policy.ts:182-238` | The default policy is anchored to the wedge contract. |
| OPS19-POS-16 | Current test inventory includes 24 release-kernel test files plus release-layer tests. | `git ls-tree` inventory | Regression-lock surface is broad, even though this sweep did not audit every test body. |

## 5. Findings

| ID | Severity | State | Title | Evidence | Protected principle | Recommended next action |
|---|---:|---|---|---|---|---|
| OPS-147 | P1 | `disputed/closed` | OPS-143 evidence-pack clarification: release evidence packs are DSSE + in-toto-shaped, while primitive signing remains Attestor-specific canonical JSON. | `release-evidence-pack.ts:34-36` defines DSSE payload type and in-toto Statement v1; `:143-159` defines statement/envelope shapes; `:633-641` uses DSSE PAE; Sweep 18 OPS-143 already scoped the ambiguity to primitive signing wording. | proof integrity; no overclaim | Mark OPS-143 closed by narrower wording; keep the distinction in control-map and baseline. |
| OPS-148 | P2 | `open / partial-repo` | Two canonicalization implementations exist without a parity test. | `src/signing/sign.ts:10-56,72-153` and `src/release-kernel/release-canonicalization.ts:19-59,153-203` both implement strict key-sorted canonical JSON with different spec IDs. | proof integrity; auditability | Add `tests/canonicalization-parity.test.ts` or consolidate into one shared canonicalization module. |
| OPS-149 | P2 | `closed repo-side / live-proof-only` | Original audit evidence: `release-decision-log.ts:549-583` used per-path file locks and could not prove multi-instance production behavior. Post-remediation evidence: `src/service/release-decision-log-store.ts`, `src/service/bootstrap/release-runtime.ts`, `tests/release-decision-log-store.test.ts`, `tests/production-shared-request-path-cutover.test.ts`, and `tests/production-shared-multi-instance-recovery.test.ts` now provide the shared PostgreSQL release-decision-log path and embedded multi-instance proof. | replay and idempotency safety; auditability | Capture `LP-RELEASE-DECISION-LOG-SHARED-STORE` before external customer-operated production or limited-enforcement HA claims. |
| OPS-150 | P2 | `accepted limitation` | Decision-log `entryId` is intentionally non-deterministic. | `release-decision-log.ts:453-474` uses `randomUUID()` before digesting the entry. | auditability; replay and idempotency safety | Keep; tests should assert digest, sequence, and chain integrity rather than exact UUIDs. |
| OPS-151 | P2 | `open / partial-repo` | No direct parity test locks the frozen wedge against the dynamic first gateway policy. | `first-hard-gateway-wedge.ts:37-98`; `release-policy.ts:182-238`; default engine policy at `release-decision-engine.ts:443`. | release provenance; no overclaim | Add a parity test asserting target kinds, consequence type, risk class, and review/enforcement mode remain aligned. |
| OPS-152 | P3 | `closed` | Deterministic checks have an explicit per-evaluation observation-array resource budget. | `release-deterministic-checks.ts` exports `RELEASE_DETERMINISTIC_CHECK_OBSERVATION_BUDGET`, fails closed with `deterministic-check-resource-budget`, and returns before category iteration when observation arrays exceed budget; `tests/release-kernel-release-deterministic-checks.test.ts` locks adversarial over-budget coverage. | operational boundedness | Keep route/API payload-size budgets aligned if this input becomes newly externally reachable; this does not claim general production DoS resistance. |
| OPS-153 | P3 | `accepted limitation` | Default in-memory release-token introspection store is not persistent across restarts. | `release-introspection.ts:639-668` provides both in-memory and file-backed stores; production must use the shared-control-plane path before HA claims. | replay and idempotency safety; runtime readiness | Keep as bootstrap discipline; pair with existing shared replay/introspection live-proof work rather than adding a report-only LP row. |

## 6. Release-Kernel Surface Matrix

| # | Artifact group | Files | Audit depth | Test evidence | Affected findings |
|---:|---|---|---|---|---|
| 1 | Decision engine | `release-decision-engine.ts` | deep | `tests/release-kernel-release-decision-engine.test.ts` | OPS-151 |
| 2 | Decision log | `release-decision-log.ts` | deep | `tests/release-kernel-release-decision-log.test.ts`, `tests/release-decision-log-store.test.ts` | OPS-149, OPS-150 |
| 3 | Evidence pack | `release-evidence-pack.ts` | deep type/envelope verification | `tests/release-kernel-release-evidence-pack.test.ts`, `tests/release-evidence-pack-store.test.ts` | OPS-147 |
| 4 | Introspection | `release-introspection.ts` | targeted | `tests/release-kernel-release-introspection.test.ts` | OPS-153 |
| 5 | Deterministic checks | `release-deterministic-checks.ts` | deep | `tests/release-kernel-release-deterministic-checks.test.ts` | OPS-152 |
| 6 | Canonicalization | `release-canonicalization.ts`, `src/signing/sign.ts` | deep comparison | `tests/release-kernel-release-canonicalization.test.ts` | OPS-148 |
| 7 | First hard gateway wedge + policy | `first-hard-gateway-wedge.ts`, `release-policy.ts` | targeted | `tests/release-kernel-first-hard-gateway-wedge.test.ts`, `tests/release-kernel-release-policy.test.ts` | OPS-151 |
| 8 | Object model + types | `object-model.ts`, `types.ts`, `risk-controls.ts` | inventory | `tests/release-kernel-object-model.test.ts`, `tests/release-kernel-types.test.ts`, `tests/release-kernel-risk-controls.test.ts` | none new |
| 9 | Policy compilation / rollout | `compiled-policy-*`, `consequence-rollout.ts`, `release-policy-rollout.ts`, `release-shadow-mode.ts` | inventory | matching release-kernel tests | none new |
| 10 | Finance release builders | `finance-*-release.ts` | inventory | matching finance release-kernel tests | none new |
| 11 | Token / verification / reviewer queue | `release-token.ts`, `release-verification.ts`, `reviewer-queue.ts` | inventory | matching release-kernel tests | none new |
| 12 | Release-layer barrels | `src/release-layer/{finance,index}.ts` | inventory | release-layer tests | none new |

Coverage: 22 release-kernel source files plus 2 release-layer barrels inventoried;
8 core surfaces deep-audited.

## 7. Verification

| Question | Source | Verdict |
|---|---|---|
| Does the decision engine fail closed on unmatched policy scope? | `release-decision-engine.ts:353-394` | repo-proven |
| Does policy matching require active status and structural scope match? | `release-decision-engine.ts:335-350` | repo-proven |
| Are deterministic checks mechanical rather than model-authoritative? | `release-deterministic-checks.ts:1-53` | repo-proven |
| Is the decision log hash-chained and verifier-enforced? | `release-decision-log.ts:478-522` | repo-proven |
| Is the file-backed decision log serialized? | `release-decision-log.ts:549-583` | repo-proven for file-backed/single-instance use; not production HA proof |
| Is the evidence pack DSSE + in-toto-shaped? | `release-evidence-pack.ts:34-36,143-159,633-641` | repo-proven |
| Is every issued pack content and key bound? | `release-evidence-pack.ts:161-171,929-1038` | repo-proven |
| Are release-token lifecycle states typed? | `release-introspection.ts:43-44,143-198` | repo-proven |
| Are signing canonicalization and release canonicalization parity-tested? | `src/signing/sign.ts`, `release-canonicalization.ts`, test inventory | gap - OPS-148 |
| Is static wedge to dynamic policy parity directly tested? | `first-hard-gateway-wedge.ts`, `release-policy.ts`, release-kernel tests | gap - OPS-151 |
| Is in-memory introspection a production HA store? | `release-introspection.ts:639-668` | no - accepted limitation OPS-153 |

Verdict: release-kernel decision, log, evidence-pack, deterministic-check,
canonicalization, introspection, and wedge surfaces are repo-proven strong at the
engine level. Remaining issues are mostly parity tests and production bootstrap
discipline, not new behavioral P0/P1 runtime defects.

## 8. Discrepancy Check Against Indexes

| Topic | Current index state | Sweep 19 result | Required update |
|---|---|---|---|
| OPS-143 | `open / partial-repo`, P2 wording ambiguity | clarified: evidence pack is DSSE + in-toto-shaped; primitive signing remains Attestor-specific canonical JSON | mark OPS-143 `disputed/closed` and add OPS-147 clarification row |
| `Proof / signature / key authority` | score 8 | evidence-pack layer now explicitly repo-proven as DSSE/in-toto-shaped; parity and KMS gaps remain | update row text but keep score 8 until OPS-148/141/142 close |
| `OPS-SWEEP-19` report-index row | absent | this report is partial/read-only | add row |
| Live proof register | original audit had no `LP-RELEASE-DECISION-LOG-SHARED-STORE` row | post-remediation now adds the gate through OPS-149 | keep `ATTESTOR_RELEASE_DECISION_LOG_SHARED_STORE_PROOF` live-only until external customer-operated PostgreSQL proof is captured |

## 9. Chain Reactions

| Change candidate | Downstream effect | Risk | Test / proof needed |
|---|---|---|---|
| OPS-147 close/narrow OPS-143 wording | Removes a no-overclaim ambiguity without changing runtime behavior | low | docs/index update only |
| OPS-148 canonicalization parity test | CI catches drift between signing and release hash material | low | fixture corpus through both canonicalizers |
| OPS-149 production bootstrap docs/gate | Prevents file-backed decision log from being mistaken for multi-instance proof | low-medium | future shared-store live probe |
| OPS-151 wedge-policy parity test | Freezes first hard gateway product decision mechanically | low | direct test against static wedge and dynamic policy |
| OPS-152 resource budget | Adds adversarial boundedness around deterministic checks | low | repo-side closed by `tests/release-kernel-release-deterministic-checks.test.ts`; keep route/API parser budgets aligned if new external inputs are added |
| OPS-153 introspection bootstrap docs | Keeps HA claims tied to shared-store deployment | low | existing shared replay/introspection proof path |

## 10. Coverage Delta

- Before Sweep 19: release-kernel had broad test inventory, but the decision
  engine, evidence pack, and canonicalization layer had not been consolidated
  into a current audit report after the signing sweep.
- After Sweep 19: 22 release-kernel files plus 2 release-layer barrels are
  inventoried; 8 core surfaces are deep-audited; DSSE/in-toto evidence-pack
  support is repo-proven; OPS-143 is closed by scope clarification; parity and
  production-bootstrap follow-ups are named.
- No production readiness claim is made. KMS runtime signing, keyless CA
  production fail-closed behavior, shared replay/introspection store, and
  multi-instance decision-log proof remain separate blockers or live-proof
  work.

## 11. Draft Index Updates

This report updates:

- `docs/audit/finding-index.md`
- `docs/audit/report-index.md`
- `docs/audit/control-map.md`
- `docs/audit/current-posture-baseline.md`

Post-remediation note: the original read-only audit did not update
`docs/audit/live-proof-register.md`. OPS-149 remediation now adds
`LP-RELEASE-DECISION-LOG-SHARED-STORE` and
`ATTESTOR_RELEASE_DECISION_LOG_SHARED_STORE_PROOF`, because the shared
PostgreSQL release-decision-log path and runtime cutover are now repo-proven.

## 12. Verdict

- Is Sweep 19 complete as a read-only audit? Yes.
- Is there a repo-proven P0? No.
- Is there a repo-proven P1? OPS-147 is P1-severity in audit bookkeeping because
  it corrects/narrows a proof-integrity wording ambiguity; it is not a new
  behavioral P1.
- Is remediation required? Post-remediation status: OPS-148, OPS-149, and
  OPS-151 are repo-side closed; OPS-149 remains live-proof-only for external
  customer-operated PostgreSQL/rehearsal evidence; OPS-153 remains accepted
  bootstrap discipline.
- Can the next sweep proceed? Yes.
- Recommended Sweep 20: `src/release-enforcement-plane/**`, the runtime
  enforcement counterpart to this release-kernel decision layer.

Final checkpoint:

- Done: Sweep 19 report integrated against `origin/master @ 136688fb...`;
  release-kernel inventory updated to current repo shape; DSSE/in-toto evidence
  pack layer verified; OPS-147..153 drafted.
- Not done: no runtime remediation; no canonicalization parity test; no
  wedge-policy parity test; no live shared decision-log proof.
- Next action: commit report/index updates, open PR, and wait for checks.
