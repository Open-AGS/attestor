# Ops Sweep 22 - Consequence-Admission Engine Deep Audit

Status: read-only audit. No remediation written. This sweep maps the action-side
consequence-admission engine after the release-engine triad audits:
release-kernel (Sweep 19), release-enforcement-plane (Sweep 20), and
release-policy-control-plane (Sweep 21).

## 0. Recent Fixes Chain-Effect Check

One merge into `origin/master` since Sweep 21 was drafted:

- PR #528 / merge commit `ed35469021441c63e8044f78646262c345ee9e7f` - "Add Sweep 21 release policy control audit"

Chain-effect verdict: PR #528 is docs-only. It does not touch
`src/consequence-admission/**`, `src/service/http/routes/generic-admission-routes.ts`,
`src/service/consequence-shared-atomic-stores.ts`, or admission/consequence tests.
No regression, no config drift, and no closed-finding reopening is visible in
Sweep 22 scope.

`origin/master` remains the source of truth. The local root checkout was
ahead/behind and dirty during the audit and was not used as authority.

## 1. Validation Frame

| Field | Value |
|---|---|
| Source of truth HEAD | `origin/master @ ed35469021441c63e8044f78646262c345ee9e7f` |
| Phase | Phase 1 - Live Shadow Readiness; substrate for Phase 2 - Limited Live Enforcement |
| Baseline blocker in scope | Customer PEP no-bypass remains live-proof-only; shared replay/introspection and retry stores remain live-proof-only |
| Protected principles | fail-closed boundary; customer authority; replay and idempotency safety; tenant isolation; data minimization and redaction; no overclaim; auditability; operational boundedness |
| Scope | `src/consequence-admission/**` plus the service route/bootstrap touchpoints for generic admission and shared atomic stores |
| Audit depth | spec, entry-point, exported constants, critical-path sampling, route/bootstrap touchpoints, and test inventory |
| No-claim | This is not a full line-by-line behavioral audit of all 155 source files and all 53 admission/consequence-related tests |

Sweep 22 verifies how the consequence-admission engine strengthens the single
Attestor consequence boundary: it shapes admission/review/block decisions and
evidence contracts before actions become real consequences. It does not grant
authority, reduce review, write policy, or activate live enforcement by itself.

## 2. Inspected Files

| File / family | Depth | Why selected |
|---|---|---|
| `src/consequence-admission/index.ts` | targeted-deep | central contract barrel: 2440 lines, 235 `export` statements, four-decision model, generic admission envelope, retry budget, feedback |
| `src/consequence-admission/facade.ts` | targeted-deep | explicit surface gate: `finance-pipeline-run` and `crypto-execution-plan`; no automatic pack detection |
| `src/consequence-admission/retry-attempt-ledger.ts` | targeted-deep | retry-attempt ledger contract, shared-atomic store kind, fail-closed shared-store contract reference |
| `src/service/consequence-shared-atomic-stores.ts` | targeted-deep | Postgres schema/RLS contract for consequence retry and presentation replay shared stores |
| `src/consequence-admission/customer-pep-runtime-adoption.ts` | targeted-deep | customer PEP no-overclaim proof contract; `productionReady: false`, `activatesEnforcement: false` |
| `src/consequence-admission/protected-admission-e2e-proof-plan.ts` | targeted | E2E proof-plan blockers for PEP, introspection, KMS, replay, and shared-store proof |
| `src/consequence-admission/agent-loop-abuse-guard.ts` | targeted | loop-abuse throttle/hold contract and fail-closed route behavior |
| `src/consequence-admission/no-go-condition-ledger.ts` | targeted | LLM/natural-language bypass and untrusted-hold-source reason codes |
| `src/consequence-admission/tamper-evident-history.ts` | targeted | digest-only tamper-evident history with `rawPayloadStored: false` |
| `src/consequence-admission/presentation-replay-ledger.ts` | targeted | atomic `setIfAbsent` replay ledger contract |
| `src/consequence-admission/downstream-enforcement-contract.ts` | targeted | downstream contract typed `failClosed: true` |
| `src/service/http/routes/generic-admission-routes.ts` | targeted | hosted generic admission route: tenant binding, agent-loop guard, protected token issuance, shadow recording |
| `docs/audit/{finding-index,report-index,current-posture-baseline,control-map,live-proof-register}.md` | targeted | index/baseline/live-proof alignment |

## 3. Skipped Files

The following families were inventoried at source/test-file level but were not
line-by-line behaviorally audited:

| Family | Examples | Risk of skipping |
|---|---|---|
| `policy-foundry-*` | hosted onboarding workflow, adversarial replay executor, hosted review surface, live downstream replay | branching behavior could hide policy foundry trust-origin or replay gaps |
| `shadow-*` | runtime activation runner, runtime pipeline, downstream integration proof, promotion packet | shadow activation and downstream proof semantics need a dedicated behavioral sweep before stronger claims |
| `golden-refund-*` | demo and readiness fixtures | lower risk, but demo/readiness semantics remain report-only here |
| assurance / invariant / measurement | invariant promotion gate, promotion runner, relationship-aware monotone fusion, conflict abstention gate | internal decision math and promotion gates deserve a separate audit under the Canonical Math Rule before behavioral claims |
| `action-surface-*` | action surface graph/profiler/intake/onboarding | onboarding/action-surface claims are contract-ready, not live-runtime proof |
| tests | 53 admission/consequence-related test files | test assertion depth was not audited; only inventory was confirmed |

This limitation is captured as OPS-166 and OPS-171.

## 4. Positive Observations

| ID | Observation | Evidence (`origin/master`) | Why it matters |
|---|---|---|---|
| OPS22-POS-01 | The facade is explicit-surface only: accepted surfaces are `finance-pipeline-run` and `crypto-execution-plan`; `explicitSurfaceRequired: true`, `automaticPackDetection: false`, `publicHostedCryptoRouteClaimed: false`. | `src/consequence-admission/facade.ts:28-30,71-88,160-177` | no silent pack detection or public hosted crypto route overclaim |
| OPS22-POS-02 | The core admission model has exactly four canonical decisions: `admit`, `narrow`, `review`, `block`. | `src/consequence-admission/index.ts:171-178` | decision vocabulary is finite and machine-readable |
| OPS22-POS-03 | `narrow` decisions require at least one explicit constraint. | `src/consequence-admission/index.ts:2014-2016` | prevents a weak "narrow" label with no downstream restriction |
| OPS22-POS-04 | Native decision mapping must match the canonical decision. | `src/consequence-admission/index.ts:2020-2023` | prevents two competing decision truths in one response |
| OPS22-POS-05 | Generic admission checks expose `adapter-readiness` as an explicit check kind and missing adapter readiness becomes `adapter-readiness-missing`. | `src/consequence-admission/index.ts:263-264,1199-1203,1587-1593` | adapter readiness is visible as an operator/customer integration control |
| OPS22-POS-06 | Retry-budget evaluation is a first-class entry point. | `src/consequence-admission/index.ts:618-626,1830-1832` | retry behavior is contract-shaped instead of ad hoc |
| OPS22-POS-07 | Retry-attempt ledger has a `shared-atomic` store kind and points at `src/service/consequence-shared-atomic-stores.ts` for production shared-store proof. | `src/consequence-admission/retry-attempt-ledger.ts:114-115,192-194,795-797` | multi-instance retry safety has a named closure path |
| OPS22-POS-08 | Shared atomic stores define Postgres tables for consequence retry and presentation replay and reject raw payload storage. | `src/service/consequence-shared-atomic-stores.ts:27-30,45,58-63,262-263,347-348` | digest-only store design is repo-proven |
| OPS22-POS-09 | Shared atomic store posture is honest: `rlsPolicyInstalled: true`, but `rlsForced: false` and `productionSharedRuntimeWired: false`. | `src/service/consequence-shared-atomic-stores.ts:61-63,466-470` | prevents overclaiming live multi-instance enforcement |
| OPS22-POS-10 | Customer PEP runtime adoption explicitly returns `productionReady: false` and `activatesEnforcement: false`. | `src/consequence-admission/customer-pep-runtime-adoption.ts:241-244,660-685,728-730` | repo-side proof plan is kept separate from live PEP proof |
| OPS22-POS-11 | Protected admission E2E proof plan names blockers for PEP bypass, online introspection, and production shared-store gaps. | `src/consequence-admission/protected-admission-e2e-proof-plan.ts:61-70,390-414,488-529` | live-proof blockers are explicit and machine-readable |
| OPS22-POS-12 | No-go ledger treats `llm-summary` and `tool-output` as source kinds and has explicit `untrusted-hold-source`, `natural-language-bypass-attempted`, and `natural-language-bypass-inferred` reason codes. | `src/consequence-admission/no-go-condition-ledger.ts:54-72,298-299,347-374` | model or tool text cannot silently release a hold |
| OPS22-POS-13 | Tamper-evident history is digest-oriented, append-only, and `rawPayloadStored: false`. | `src/consequence-admission/tamper-evident-history.ts:91-140,336-337,764-805` | audit history avoids raw payload retention claims |
| OPS22-POS-14 | Presentation replay ledger declares `atomicSetIfAbsent: true`, SHA-256 replay-key indexing, no raw replay keys, and fail-closed shared-store contract. | `src/consequence-admission/presentation-replay-ledger.ts:104-115,162-163,348-357,561-617` | replay safety has a concrete atomicity contract |
| OPS22-POS-15 | Downstream enforcement contract is typed `failClosed: true`. | `src/consequence-admission/downstream-enforcement-contract.ts:92-93,170-171,373-374,499-500` | downstream consumers are contractually fail-closed |
| OPS22-POS-16 | Generic admission route returns 403 on tenant mismatch, 503 when the agent-loop guard is unavailable, 429/409 when loop guard blocks/throttles, and 503 when shadow recording is unavailable. | `src/service/http/routes/generic-admission-routes.ts` targeted route evidence | route-side failure modes are fail-closed instead of silently admitting |
| OPS22-POS-17 | Reverse coupling into the release triad is minimal: `src/release-kernel/**` and `src/release-policy-control-plane/**` have no reverse imports from consequence-admission; `src/release-enforcement-plane/telemetry.ts` is the only reverse importer. | `git grep -l "from '../consequence-admission" -- src/release-kernel/ src/release-policy-control-plane/ src/release-enforcement-plane/` | the admission engine does not become a parallel release authority |
| OPS22-POS-18 | `index.ts` publishes a descriptor that centralizes decisions, generic modes, pack families, retry defaults, downstream statuses, and reason-code families. | `src/consequence-admission/index.ts:545-548,2214-2217` plus export inventory | the contract surface is discoverable and versionable |

## 5. Findings

| ID | Severity | State | Title | Evidence (`origin/master`) | Protected principle | Recommended next action |
|---|---:|---|---|---|---|---|
| OPS-166 | P2 | `not proven` | Consequence-admission line-by-line behavioral audit depth gap | Sweep 22 maps 155 source files and 53 admission/consequence-related tests, but does not line-by-line audit all branches in `policy-foundry-*`, `shadow-*`, `golden-refund-*`, assurance/invariant, action-surface, customer-gate, or test assertion families. | auditability; no overclaim | Keep as a non-blocking sweep-budget disclosure; spawn focused sub-sweeps only where module-specific risk warrants. |
| OPS-167 | P2 | `open / partial-repo` | Caller-supplied `observedFeatures` trust origin is not mechanically separated from operator-derived evidence | `createGenericAdmissionEnvelope` normalizes `observedFeatures`; `observedFeatureTrue(input, 'adapterReady')` drives `adapter-readiness` pass/fail and `adapterReady` appears in generic material. Hosted route payload accepts the feature map before shadow recording. Tenant binding, plan-mode gates, and loop-abuse guard mitigate, but the feature trust origin is not explicitly operator-bound in the core contract. | fail-closed boundary; customer authority | Document `observedFeatures` as upstream/operator-derived evidence; add an operator-attested feature-origin marker or route-side restriction before stronger hosted admission claims. |
| OPS-168 | P2 | `open / partial-repo` | Consequence retry-attempt ledger shared-store proof gap | `retry-attempt-ledger.ts` declares `shared-atomic` and references `src/service/consequence-shared-atomic-stores.ts`; shared store schema exists, but `productionSharedRuntimeWired: false` and `rlsForced: false` remain. Multi-instance retry-budget enforcement is not live-proven. | replay and idempotency safety; auditability | Add `LP-CONSEQUENCE-RETRY-ATTEMPT-LEDGER-SHARED-STORE`; capture RLS-forced/shared-store runtime proof before multi-instance retry-budget claims. |
| OPS-169 | P1 baseline continuation | `accepted limitation` | Customer PEP runtime adoption remains live-proof-only, not a new repo-side P1 | `customer-pep-runtime-adoption.ts` returns `productionReady: false` and `activatesEnforcement: false`; `protected-admission-e2e-proof-plan.ts` is a proof-plan evaluation and does not deploy or operate a PEP. This continues the baseline `Customer PEP no-bypass` P0 live-proof blocker. | customer authority; fail-closed boundary; no overclaim | Do not treat repo contracts as live PEP proof. Keep `LP-CUSTOMER-PEP-NO-BYPASS` as the closure gate. |
| OPS-170 | P3 | `open / partial-repo` | `index.ts` size and barrel surface deserve a focused sub-sweep before deeper behavior claims | `src/consequence-admission/index.ts` is 2440 lines with 235 `export` statements and centralizes normalization, generic envelope creation, retry-budget evaluation, feedback, and descriptors. | auditability; operational boundedness | Run a focused sub-sweep on `createConsequenceAdmissionResponse`, `createGenericAdmissionEnvelope`, and retry-budget branches, or split the file when next touching admission core. |
| OPS-171 | P2 | `open / partial-repo` | Consequence-admission family sub-sweeps are needed before family-level behavioral claims | Sweep 22 inventoried but did not behaviorally audit the `policy-foundry-*`, `shadow-*`, assurance/invariant, action-surface, customer-gate, and admission test families. | auditability; no overclaim | Prioritize sub-sweeps only when needed: policy-foundry runtime, shadow-runtime/downstream integration, customer-gate behavioral, invariant promotion, or admission test assertion inventory. |

## 6. Consequence-Admission Surface Matrix

| Layer | Module / contact point | Authority | Feeds | Authority NOT held |
|---|---|---|---|---|
| Engine contract barrel | `src/consequence-admission/index.ts` | contract-shaping and advisory | admission responses, feedback, retry-budget evaluation, descriptors | cannot grant authority, reduce review, or activate enforcement |
| Facade | `facade.ts` | explicit surface selection | finance pipeline admission and crypto execution-plan admission | cannot auto-detect packs or claim a public hosted crypto route |
| Generic admission route | `src/service/http/routes/generic-admission-routes.ts` | mode-gated hosted route | shadow admission record, loop-abuse guard, protected token issuance | cannot prove live PEP no-bypass |
| Retry budget | `index.ts` and `retry-attempt-ledger.ts` | hard-floor retry binding | retry admission attempts and shared-store proof path | cannot prove multi-instance shared-store runtime without live proof |
| No-go ledger | `no-go-condition-ledger.ts` | hard block / review pressure | hold/no-go evaluation | cannot let natural language or LLM summaries release a hold |
| Presentation replay | `presentation-replay-ledger.ts` | atomic replay guard | downstream enforcement and customer gate | cannot prove live shared-store atomicity without deployment proof |
| Tamper-evident history | `tamper-evident-history.ts` | append-only audit evidence | audit exports and dashboards | cannot claim compliance or immutable external storage |
| Customer PEP adoption | `customer-pep-runtime-adoption.ts` | readiness proof-plan only | customer PEP adoption package and E2E proof plan | cannot deploy or operate customer PEP; cannot claim production readiness |
| Shared atomic stores | `src/service/consequence-shared-atomic-stores.ts` | schema/RLS contract | retry-attempt and presentation replay shared stores | cannot claim production wiring while `productionSharedRuntimeWired: false` |
| Release triad bridge | `src/release-enforcement-plane/telemetry.ts` | telemetry import only | data-minimization telemetry | no reverse release authority |

## 7. Verification

Repo evidence checks on `origin/master @ ed35469021441c63e8044f78646262c345ee9e7f`:

| Question | Source | Verdict |
|---|---|---|
| Is PR #528 merged and is `origin/master` at the Sweep 21 merge commit? | `gh pr view 528`; `git rev-parse origin/master` | repo-proven |
| Are there 155 consequence-admission source files? | `git ls-tree -r --name-only origin/master src/consequence-admission/` | repo-proven |
| Are there 53 admission/consequence-related tests by filename search? | `git ls-tree -r --name-only origin/master tests/` filtered by `admission|consequence` | repo-proven |
| Is the facade explicit-surface and no automatic pack detection? | `facade.ts:28-30,71-88,160-177` | repo-proven |
| Is `observedFeatures.adapterReady` caller-supplied and used for adapter readiness? | `index.ts:1167-1203,1416-1418` | repo-proven gap, OPS-167 |
| Is shared retry store production runtime wired? | `retry-attempt-ledger.ts:192-194,795-797`; `consequence-shared-atomic-stores.ts:61-63,466-470` | partial-repo gap, OPS-168 |
| Is customer PEP no-bypass live-proven? | `customer-pep-runtime-adoption.ts:660-685`; `protected-admission-e2e-proof-plan.ts:520-529` | not proven / accepted limitation, OPS-169 |
| Does consequence-admission reverse-import into release-kernel or policy-control? | `git grep -l "from '../consequence-admission"` over release triad paths | repo-proven minimal reverse coupling |

Checks not run:

- `npm run typecheck`, `npm run verify`, and admission test suites were not run because this PR is documentation/audit integration only and changes no TypeScript source. The relevant verification tier is the docs/evidence system plus targeted repository reads.
- Full line-by-line behavioral audit of all 155 source files and 53 tests was not run; this is the point of OPS-166/171.

## 8. Discrepancy Check Against Indexes

| Topic | Current index state | Sweep 22 result | Required update |
|---|---|---|---|
| `OPS-SWEEP-21` next target | `report-index.md` names `src/consequence-admission/**` as Sweep 22 candidate | fulfilled by this report | add `OPS-SWEEP-22` row |
| Existing finding sequence | `finding-index.md` currently ends with OPS-165 before standing blockers | Sweep 22 drafts OPS-166..171 | add rows without promoting OPS-169 as a new repo-side P1 |
| Customer PEP no-bypass | standing P0 `needs live test` | confirmed as live-proof-only; no contradiction | keep P0 blocker; add OPS-169 as accepted limitation/baseline continuation |
| Shared replay/introspection | standing P0/P1 live-proof gap | consequence retry shared-store gap joins the same pattern | add live-proof row for consequence retry ledger shared store |
| Service/API boundary | Sweep 13 route layer already audited generic admission routes | Sweep 22 is module/substrate audit, not a duplicate | update baseline/control map with module-level substrate evidence |

## 9. Chain Reactions

| Change candidate | Downstream effect | Risk | Proof needed |
|---|---|---|---|
| OPS-167 feature-origin documentation or operator-attested marker | makes `observedFeatures` trust origin explicit | low to medium depending on whether routes change | route/test proof if behavior changes; docs-only if only claim text is narrowed |
| OPS-168 live-proof register entry | makes multi-instance retry-budget claim live-proof gated | low docs/live-proof change | `LP-CONSEQUENCE-RETRY-ATTEMPT-LEDGER-SHARED-STORE` capture |
| OPS-170 focused `index.ts` sub-sweep or future split | reduces audit burden for core admission builder | medium if refactor is code-changing | targeted tests for response/envelope/retry branches |
| OPS-171 family sub-sweeps | avoids overclaiming policy-foundry/shadow/invariant behavior | low as audit-only | dedicated sub-sweep reports |

## 10. Coverage Delta

| Sweep | Scope | Depth |
|---|---|---|
| Sweep 19 | `src/release-kernel/**` | decision/log/evidence-pack/checks/canonicalization targeted-deep |
| Sweep 20 | `src/release-enforcement-plane/**` | spec, entry-point, export, and test-inventory over 22 files |
| Sweep 21 | `src/release-policy-control-plane/**` | spec, entry-point, targeted-deep, and test-inventory over 18 files |
| Sweep 22 | `src/consequence-admission/**` | spec, entry-point, exported constants, critical-path sampling, route/bootstrap touchpoints, and test inventory over 155 files |

Coverage delta: the release-engine triad is now paired with the action-side
consequence-admission substrate map. The map is intentionally honest about
depth: it is strong enough for index/baseline posture, but not enough to claim
line-by-line behavioral correctness for every policy-foundry, shadow, invariant,
or action-surface module.

## 11. Index Updates Applied

This PR adds:

- this Sweep 22 report;
- `OPS-SWEEP-22` in `report-index.md`;
- OPS-166..171 in `finding-index.md`;
- a consequence-admission substrate row in `current-posture-baseline.md`;
- a consequence-admission boundary row in `control-map.md`;
- `LP-CONSEQUENCE-RETRY-ATTEMPT-LEDGER-SHARED-STORE` in `live-proof-register.md`.

No source code or tests are changed.

## 12. Verdict

- **Is the Sweep 22 report complete?** Yes at spec, entry-point, exported-constant, critical-path, route/bootstrap, and inventory depth.
- **Is there a repo-proven P0?** No.
- **Is there a new repo-proven P1?** No. OPS-169 is a baseline continuation confirming the standing Customer PEP no-bypass live-proof blocker.
- **Is remediation required?** Small documentation/live-proof work is recommended: OPS-167 feature trust-origin clarification and OPS-168 live-proof gate. Code remediation should wait until a focused behavior change is chosen.
- **Can the next sweep proceed without Sweep 22 remediation?** Yes. The open gaps are localized and do not invalidate the release-engine triad.
- **Recommended next locked target:** either close OPS-167/168 as a small docs/live-proof PR, or start Sweep 23 on `src/crypto-execution-admission/**` plus `src/crypto-authorization-core/**`, the crypto consumer side of the admission facade.

## Final Checkpoint

- Done: read-only Sweep 22 audit integrated for `origin/master @ ed35469021441c63e8044f78646262c345ee9e7f`.
- Not done: no line-by-line behavioral audit of all 155 source files; no source remediation; no test assertion-depth audit over the 53 admission/consequence-related tests.
- Files intentionally untouched: `src/consequence-admission/**`, `tests/**`, service source.
- Remaining blockers: Customer PEP no-bypass live proof, shared store live proof, branch protection, KMS runtime signing, and other standing Phase 1/2 blockers remain separate.
