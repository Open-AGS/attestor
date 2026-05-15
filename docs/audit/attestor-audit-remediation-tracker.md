# Attestor Audit Remediation Tracker

Status: canonical tracker for project-owner supplied audit reports.

This tracker exists to prevent skipped findings, duplicate work, stale-report
confusion, and overclaiming. It is not a certification, not an independent
external audit, and not a claim of full production readiness.

## Tracker Rules

- `origin/master` is the source of truth.
- A finding is `fixed` only when the remediation PR is merged, checks are green,
  and the merge commit is verified on `origin/master`.
- A finding can be `superseded` or `invalid` only with repository evidence.
- A finding can be `partial` when the repo has a contract, guard, or test, but
  customer runtime enforcement, live deployment, or source-system evidence is
  still not proven.
- A finding that needs fresh validation is not treated as open exploit evidence
  until it is rechecked against current `origin/master`.
- External standards are engineering anchors only. They do not certify Attestor.

## Status Vocabulary

| Status | Meaning |
|---|---|
| `fixed` | Merged PR closes the scoped finding with tests/docs where needed. |
| `partial` | A repository-side slice is implemented, but live/customer/integration proof remains. |
| `open` | Validated as still needing remediation. |
| `needs-revalidation` | Report finding exists, but current master may already differ. |
| `accepted-limitation` | Real limitation, intentionally not claimed as solved. |
| `superseded` | Later architecture or code made the original finding stale. |
| `invalid-as-stated` | Current code does not support the finding as written. |
| `backlog` | Known follow-up, not next immediate PR. |

## Current Count

The report count below includes the detailed F4 redo and F5 redo reports. The
count intentionally separates stale worktree claims from active findings so a
later implementation pass does not re-open already-retired issues.

| Group | Total tracked | Closed / invalid-as-stated | Partial / limitation / backlog | Needs revalidation / open |
|---|---:|---:|---:|---:|
| F1 threat-model foundation | 6 | 1 | 5 | 0 |
| F2 agentic consequence surface | 10 | 2 | 8 | 0 |
| F3 cross-cutting guard readiness | 10 | 10 | 0 | 0 |
| F4 OWASP LLM redo, active findings | 14 | 5 | 9 | 0 |
| F4 stale worktree findings retired by fresh main | 3 | 0 | 3 | 0 |
| F5 signing layer redo | 21 | 14 | 7 | 0 |
| Final docs / claim alignment | 2 | 2 | 0 | 0 |
| F6 multi-tenant blast radius | 10 | 4 | 6 | 0 |
| F7 shadow infrastructure red-team | 10 | 8 | 2 | 0 |
| F8 operational resilience / chaos | 12 | 6 | 6 | 0 |
| F9 compliance gap analysis | 12 | 11 | 1 | 0 |
| F10 customer escape-hatch abuse | 12 | 8 | 4 | 0 |
| F11 supply-chain depth | 12 | 7 | 5 | 0 |
| F12 continuous red-team automation | 12 | 3 | 9 | 0 |

Remaining work after the final claim-alignment slice: 0 planned
PR-sized or validation-sized units in the current F1-F5 audit queue.

Remaining F6 queue after recipient/tenant runtime boundary bridge: 0 planned PR-sized
or validation-sized units.

F6 validation and tracker sync is the current closure record for the
multi-tenant blast-radius queue.

Historical F6 queue checkpoints retained for validation continuity:
Remaining F6 queue after RLS claim-alignment slice: 2 planned.
Remaining F6 queue after usage-meter shared-store boundary slice: 1 planned.

Remaining F7 queue after shadow readiness and claim alignment: 0 planned
PR-sized or validation-sized units.

Remaining F8 queue after operational resilience validation: 0 planned
PR-sized or validation-sized units.

Remaining F9 queue after compliance gap validation: 0 planned
documentation or validation units.

Remaining F10 queue after escape-hatch validation: 0 planned
repository-side units.

Remaining F11 queue after supply-chain depth validation: 0 planned
repository-side units.

Remaining F12 queue after continuous red-team validation: 0 planned
repository-side units.

Completion rule through F5: every F1-F5 row must end as `fixed`,
`invalid-as-stated`, `superseded`, `accepted-limitation`, or `backlog` with
evidence. No `needs-revalidation` row can remain before starting F6.

## Verified Merged Remediations

| PR | Merge commit | Scope |
|---|---|---|
| [#220](https://github.com/AI-gateway-systems/attestor/pull/220) | `594ae560970c4a13b746c9055a59da0d3e30e174` | F1 validation and first remediation slice |
| [#291](https://github.com/AI-gateway-systems/attestor/pull/291) | `b33bc24302d3ed52bb6f5c31644c520d21823e12` | F5 PKI verification binding |
| [#292](https://github.com/AI-gateway-systems/attestor/pull/292) | `42e54d258da8cedbac5d0e84d8a8d7c2f9213c9f` | F3 guard trust labels and scope closure |
| [#293](https://github.com/AI-gateway-systems/attestor/pull/293) | `c3ce7c7e649f25d59cc8b45ef8e5e2497fa00267` | F3 agent-loop shared storage readiness |
| [#294](https://github.com/AI-gateway-systems/attestor/pull/294) | `e7f18b61efd3c446e123300f690f127e073fd4ef` | F3 guard activation readiness contract |
| [#295](https://github.com/AI-gateway-systems/attestor/pull/295) | `d33a18d0c448abee1b1f2870798455a19be079ce` | F3 reviewer behavior fatigue telemetry |
| [#296](https://github.com/AI-gateway-systems/attestor/pull/296) | `05c50ea6375fee2718b5535fd0a25b53440b0f91` | F3 failure-mode guard coverage matrix |
| [#297](https://github.com/AI-gateway-systems/attestor/pull/297) | `2fe802535c209049bdf41328f95ef5287492a8b8` | F3 agentic supply-chain guard |
| [#298](https://github.com/AI-gateway-systems/attestor/pull/298) | `fc6ba99c8821782521774487dc3707ada4882e04` | F3 runtime failure-mode extensions |
| [#299](https://github.com/AI-gateway-systems/attestor/pull/299) | `84d27793b4717c46199c721280eb24275e200296` | F3 untrusted-content trust evidence |
| [#300](https://github.com/AI-gateway-systems/attestor/pull/300) | `ae3c2f96dc83332b5e0d30a37d8cc0f292efa0f2` | F2 multi-agent delegation guard |
| [#301](https://github.com/AI-gateway-systems/attestor/pull/301) | `de6e7f6c92a5e5a2a78b01ef0cdde371d23f9580` | Audit remediation tracker |
| [#302](https://github.com/AI-gateway-systems/attestor/pull/302) | `4d0ab899d6f630c099b1c3f02ebabba6319bd205` | F2 customer-gate enforcement validation |
| [#303](https://github.com/AI-gateway-systems/attestor/pull/303) | `c15f3c87864be4c61bf8522b4dcbd1f79cca1f8a` | F2 agent-payment settlement validation |
| [#304](https://github.com/AI-gateway-systems/attestor/pull/304) | `7a04f37dff84b6535e670ef6165d505b4ac01975` | F2 EIP-7702 delegation scope validation |
| [#305](https://github.com/AI-gateway-systems/attestor/pull/305) | `970aa169afe4ec82d2e324d6cf185b54dc6e25fe` | F2 downstream receipt omission validation |
| [#306](https://github.com/AI-gateway-systems/attestor/pull/306) | `28b801725b148acb852a4f9392e2e3e789055a50` | F2 evidence confidence validation |
| [#307](https://github.com/AI-gateway-systems/attestor/pull/307) | `d8ac6f0615f4c3877b111be45b025f280f0dcd4b` | F2 / F4 LLM provider supply-chain validation |
| [#308](https://github.com/AI-gateway-systems/attestor/pull/308) | `d8788fe5b0d8f753fb5d1f1e3b2d09f521760b26` | F2 constraint kind registry |
| [#309](https://github.com/AI-gateway-systems/attestor/pull/309) | `acaac7002bffcffcf0b117742490b087e03b33df` | F2 model/tool/config drift binding validation |
| [#310](https://github.com/AI-gateway-systems/attestor/pull/310) | `35b8b61c493b066bcf83c08d7ac6d385984c60a1` | F4 signed trust-class PKI proof validation |
| [#311](https://github.com/AI-gateway-systems/attestor/pull/311) | `31ecf2b1f5a0017ec1eb83476093e77e085e26eb` | F4 hosted LLM boundary conformance validation |
| [#312](https://github.com/AI-gateway-systems/attestor/pull/312) | `d32624c0e996e803bbda9b1a0190a862389eed86` | F4 data-minimization scanner readiness validation |
| [#313](https://github.com/AI-gateway-systems/attestor/pull/313) | `abbedf3231eec5350a2455aca1d7bb1816a03e10` | F4 presentation freshness nonce binding |
| [#314](https://github.com/AI-gateway-systems/attestor/pull/314) | `aabeca4c5f06ae61fc958e501cecb0e96fa73629` | F4 presentation replay shared-store contract |
| [#315](https://github.com/AI-gateway-systems/attestor/pull/315) | `c5b036e0e17ecd1e54c5b9bba4854e35ca3f7961` | F4 shared velocity and retry validation |
| [#316](https://github.com/AI-gateway-systems/attestor/pull/316) | `28948cc1a03feb9b659e4b4d51decc116d599d66` | F4 prompt leakage marker validation |
| [#317](https://github.com/AI-gateway-systems/attestor/pull/317) | `e1415827a770c23aaa1312966571c421f5ab6f7f` | F5 CA pin required validation |
| [#318](https://github.com/AI-gateway-systems/attestor/pull/318) | `32d8274a4298ca41841876a05e5d4d5859e2f3f5` | F5 legacy env downgrade removal |
| [#319](https://github.com/AI-gateway-systems/attestor/pull/319) | `0b96f2ae8b60ba94569dd915064964a1bd8b4f72` | F5 signing key fingerprint width |
| [#320](https://github.com/AI-gateway-systems/attestor/pull/320) | `cedb2ce4d53d247820ac5726e247afe82cc3d4e0` | F5 signing canonicalization |
| [#321](https://github.com/AI-gateway-systems/attestor/pull/321) | `4f1e4c933099db345af3f35e2ad7a8b5b6e9f9b9` | F5 file durability and key persistence atomicity |
| [#322](https://github.com/AI-gateway-systems/attestor/pull/322) | `18f98e72b1755391a58ad85bae3cdf077b048b12` | F5 keyless CA runtime configuration boundary |
| [#323](https://github.com/AI-gateway-systems/attestor/pull/323) | `994a1bbcf6263a77fe611dbe45cb25895bca3264` | F5 production-shared PKI path boundary |
| [#324](https://github.com/AI-gateway-systems/attestor/pull/324) | `c626224ec7ea17ba46e30a4dba8bac92d21506e8` | F5 legacy unbounded certificate warning |
| [#325](https://github.com/AI-gateway-systems/attestor/pull/325) | `3798a66e18aaff254a45275c349d9fc95948a1c9` | F5 transparency log claim boundary |
| [#326](https://github.com/AI-gateway-systems/attestor/pull/326) | `7029ea2afeec41a3afe29b9359dbdf2f844bfc99` | F5 crypto authorization trust-delegation boundary |
| [#327](https://github.com/AI-gateway-systems/attestor/pull/327) | `e4bca21903df7dd7ce144aefc5c7aebc559387e8` | F1 backlog closure evidence pass |

## F1 Threat-Model Foundation

Source report: project-owner supplied F1 cross-cutting threat model.

Validation record: `docs/audit/f1-threat-model-foundation-validation.md`.

| ID | Current status | Evidence / PR | Remaining action |
|---|---|---|---|
| F1-CC-1 agent-loop HA/shared-store bypass | `partial` | PR #220, PR #293 | Shared agent-loop guard path exists; broader replay/presentation/shared durability remains tracked elsewhere. |
| F1-CC-2 review-required auto-promote | `accepted-limitation` | PR #220; `customer-gate.ts`; downstream enforcement docs | Needs protected downstream wrapper/gateway adoption proof. Related to F2-AG-1. |
| F1-CC-3 cross-vector replay correlation | `backlog` | F1 Backlog Closure Validation (`docs/audit/f1-backlog-closure-validation.md`); replay layer placement; retry-attempt ledger; presentation replay ledger; tamper-evident history; `test:f1-backlog-closure-validation` | Point replay/idempotency controls exist. Universal cross-vector replay correlation remains a future digest-only correlation bus, not a current production claim. |
| F1-CC-4 data-minimization fan-out | `backlog` | F1 Backlog Closure Validation (`docs/audit/f1-backlog-closure-validation.md`); data-minimization scanner; prompt leakage markers; F4 scanner validation; `test:f1-backlog-closure-validation` | Central scanner and broad surface policy exist. Mandatory conformance over every declared and future output constructor remains future work. |
| F1-CC-5 tenant boundary fan-out concrete route bug | `fixed` | PR #220 | Body tenant mismatch on generic admission route was remediated in the scoped slice. |
| F1-CC-6 cross-log integrity anchor | `accepted-limitation` | F1 Backlog Closure Validation (`docs/audit/f1-backlog-closure-validation.md`); tamper-evident history; audit evidence export; `test:f1-backlog-closure-validation` | Evaluation-grade linear hash-chain history exists. It is not an external WORM store, SIEM, transparency log, or cross-store meta-anchor. |

## F2 Agentic Consequence Surface

Source report: project-owner supplied F2 redo, agentic consequence-surface audit.

| ID | Current status | Evidence / PR | Remaining action |
|---|---|---|---|
| F2-AG-1 customer-gate honor-system | `partial` | `docs/audit/f2-customer-gate-enforcement-validation.md`; signed bearer and release-enforcement customer-gate verifiers in `src/consequence-admission/customer-gate.ts`; generic protected release-token issuance in `src/consequence-admission/generic-protected-release-token.ts`; customer PEP runtime adoption proof in `src/consequence-admission/customer-pep-runtime-adoption.ts`; hosted route proof in `src/service/generic-admission-protected-route.ts`; hosted DPoP sender-confirmation bridge in `src/service/hosted-generic-admission-sender-confirmation.ts`; hosted durable introspection/replay wiring through `src/service/release-token-introspection-store.ts` | Customer-gate helper now has a signed bearer release-token compatibility verifier, a protected release-enforcement verifier-consumer path, a generic high-risk protected release-token issuance contract, a scoped customer PEP runtime adoption proof contract, and a hosted generic route guard that requires protected-token issuance, validates DPoP sender confirmation, consumes token-request DPoP proof jti values in a runtime-local replay store, registers issued protected tokens in the release-token introspection authority, and fails closed when proof, shared token replay/introspection storage, or shared DPoP sender-proof replay storage is absent. Live customer PEP deployment and external KMS/HSM issuer boundary with structured live provider proof remain future work. |
| F2-AG-2 agent-payment settlement post-condition | `partial` | `docs/audit/f2-agent-payment-settlement-validation.md`; `crypto-authorization-core/x402-agentic-payment-adapter.ts`; `crypto-execution-admission/x402-resource-server.ts`; downstream receipt | Original no-settlement-gate wording is stale. Settlement gates exist, but facilitator/settlement truth remains adapter/runtime observation. Needs verifier-bound settlement attestation or chain receipt verification before `fixed`. |
| F2-AG-3 account-delegation / EIP-7702 scope | `partial` | `docs/audit/f2-eip7702-scope-validation.md`; `crypto-authorization-core/eip7702-delegation-adapter.ts`; `crypto-execution-admission/delegated-eoa.ts` | Original no-scope-gate wording is stale. Chain, nonce, authorization-list, call-scope, delegate-code, recovery, and handoff gates exist. Remaining gap: no explicit cumulative delegated-scope contract for max transactions/value/window/scope digest. |
| F2-AG-4 multi-agent delegation confusion | `fixed` | PR #300; `multi-agent-delegation-guard.ts` | No further action for this scoped guard. Live inter-agent transport auth remains not proven. |
| F2-AG-5 hidden downstream side effects / receipt omission | `partial` | `docs/audit/f2-downstream-receipt-omission-validation.md`; downstream enforcement contract; downstream execution receipt; Policy Foundry outcome feedback loop | Execution receipt and missing-receipt feedback no-go exist. Remaining gap: no runtime receipt-deadline escalation that holds or blocks related future admissions when an expected receipt is missing. |
| F2-AG-6 unsupported confidence / hallucinated evidence | `partial` | `docs/audit/f2-evidence-confidence-validation.md`; `failure-mode-control-bindings.ts`; `failure-mode-guard-coverage.ts`; audit evidence export; external review packet | Original no-guard wording is stale. Repo has contract-level coverage and digest-first review artifacts, but no universal source-system re-fetch/re-hash verifier before admit. |
| F2-AG-7 agentic supply-chain and LLM provider dependency | `partial` | PR #297 adds `agentic-supply-chain-guard`; `docs/audit/f2-llm-provider-supply-chain-validation.md` | Adapter/tool supply-chain coverage exists and includes `model-provider-sdk`. Attestor-owned live-model provider resilience remains separate backlog, not closed by this guard. |
| F2-AG-8 multimodal vision input future risk | `backlog` | `docs/audit/f2-llm-provider-supply-chain-validation.md`; `src/api/openai.ts` | `callGptVision` exists but has no current repo caller outside the wrapper. Add multimodal input controls before wiring it to hosted/user-facing routes. |
| F2-AG-9 free-text narrow constraints | `fixed` | `docs/audit/f2-constraint-kind-registry-validation.md`; `CONSEQUENCE_ADMISSION_CONSTRAINT_KINDS`; `test:f2-constraint-kind-registry-validation` | Repository contract gap closed with machine-readable constraint kinds and digest-only downstream refs. Customer runtime enforcement remains outside this scoped finding. |
| F2-AG-10 model/tool/config drift | `partial` | `docs/audit/f2-model-tool-config-drift-validation.md`; `decision-context-drift-binding.ts`; `failure-mode-guard-coverage.ts`; `test:f2-model-tool-config-drift-validation` | Original no-guard wording is stale. Current repo has deterministic digest-first context binding. Remaining limitation: no independent live runtime scanner or model-quality evaluation. |

## F3 Cross-Cutting Guard Readiness

Source report: project-owner supplied F3 redo, cross-cutting agentic guard audit.

Status: closed for the scoped remediation series. These are repository-side guard
and readiness controls, not proof of live customer enforcement.

| ID | Current status | Evidence / PR |
|---|---|---|
| F3-CC-1 declared vs enforced gap | `fixed` | PR #294, PR #296 |
| F3-CC-2 agent-loop in-memory HA gap | `fixed` | PR #293 |
| F3-CC-3 tool-result trust label laundering | `fixed` | PR #292 |
| F3-CC-4 reviewer fatigue behavior telemetry | `fixed` | PR #295 |
| F3-CC-5 unknown reversibility closure | `fixed` | PR #292 |
| F3-CC-6 approval provenance trust labels | `fixed` | PR #292 |
| F3-CC-7 untrusted content trust evidence | `fixed` | PR #299 |
| F3-CC-8 build-time-only registry extensions | `fixed` | PR #298 |
| F3-CC-9 guard coverage missing/ambiguous | `fixed` | PR #296 |
| F3-CC-10 agentic supply-chain guard missing | `fixed` | PR #297 |

## F4 OWASP LLM / Input Surface Redo

Source report: project-owner supplied F4 redo using OWASP LLM Top 10 v2.0
2025 IDs.

Current state: remediated, narrowed, invalidated, or intentionally backlogged
for the repository-side F1-F5 queue. Prior worktree-F4 findings that fresh main
retired are listed separately to avoid duplicate work.

| ID | Current status | Overlap / evidence | Remaining action |
|---|---|---|---|
| F4-LLM01-A indirect prompt injection via operator-asserted trust class | `fixed` | `docs/audit/f4-trust-class-pki-proof-validation.md`; `tool-result-poisoning-guard.ts`; `approval-provenance-guard.ts`; `test:f4-trust-class-pki-proof-validation` | Signed trust classes now require PKI-bound `verifyPkiBoundCertificate` input; caller-supplied booleans are insufficient. Customer adapter proof material remains a runtime integration boundary. |
| F4-LLM01-B hosted LLM agent tool boundary descriptor-only | `invalid-as-stated` | `docs/audit/f4-hosted-llm-boundary-conformance-validation.md`; `test:hosted-llm-agent-tool-boundary-guard`; `test:f4-hosted-llm-boundary-conformance-validation` | Current master already has repo-side conformance checks that validate descriptor evidence, validation files, source anchors, material scanning, OpenAPI markers, and docs alignment. Live hosted deployment proof remains outside this scoped claim. |
| F4-LLM02-A data-minimization evaluation operator-driven | `fixed` | `docs/audit/f4-data-minimization-scanning-readiness-validation.md`; `evaluateConsequenceDataMinimizationArtifact`; `test:f4-data-minimization-scanning-readiness-validation` | Artifact evaluation now runs the central material scanner when material is supplied and returns stable non-secret reason codes. |
| F4-LLM02-B redaction policy not activated as an enforcement claim | `accepted-limitation` | `docs/audit/f4-data-minimization-scanning-readiness-validation.md`; `consequenceDataMinimizationRedactionPolicyDescriptor().productionReady === false` | The repo-side policy intentionally avoids production-ready enforcement claims. Live deployment, retention, access-control, and external audit readiness remain out of scope for this repository slice. |
| F4-LLM03-A agentic supply-chain coverage gap / single LLM provider | `partial` | PR #297 added `agentic-supply-chain-guard`; `docs/audit/f2-llm-provider-supply-chain-validation.md`; `src/api/openai.ts` remains separate | OWASP LLM03 risk is valid. Agentic supply-chain guard covers repo-side component evidence; Attestor-owned OpenAI wrapper remains single-provider optional live-model path. |
| F4-LLM05-A presentation freshness relies on operator clock | `fixed` | `docs/audit/f4-presentation-freshness-nonce-validation.md`; `createConsequenceAdmissionPresentationFreshnessNonce`; `expected.nonceDigest`; `test:f4-presentation-freshness-nonce-validation` | Presentation binding now has an Attestor-issued freshness nonce helper and digest-based expected nonce verification. Live shared nonce consumption remains tracked under replay/shared-ledger work. |
| F4-LLM05-B presentation replay ledger in-memory reference path | `partial` | `docs/audit/f4-presentation-replay-shared-ledger-validation.md`; shared replay store contract; `test:f4-presentation-replay-shared-ledger-validation`; consequence shared-store request guard | Shared-store contract and cross-instance replay test exist, and `production-shared` protected API routes now fail closed while the consequence shared-store profile is blocked. Production shared atomic backend remains required before this can be `fixed`. |
| F4-LLM06-A customer gate honor-system | `partial` | Same root as F2-AG-1 and F1-CC-2; `docs/audit/f2-customer-gate-enforcement-validation.md` | The LLM06 claim is narrowed: helper-only use remains honor-system; protected release-enforcement path exists separately, can now be consumed by the customer gate, generic high-risk admissions can now be bound to sender-constrained release tokens, hosted bootstrap requires the protected issuer route, validates token-request DPoP proof, blocks production-shared readiness without shared DPoP proof replay storage, and customer PEP runtime adoption can be proven for a scoped runtime. Live deployment remains unproven. |
| F4-LLM06-B agent-loop budget per process | `partial` | `docs/audit/f4-shared-velocity-retry-validation.md`; PR #293; `test:agent-loop-abuse-guard-shared`; `test:f4-shared-velocity-retry-validation` | Hosted service wrapper has Redis-backed shared counters and HA fail-closed behavior. Package-level reference guard remains in-memory, so this is not marked fully fixed for every import path. |
| F4-LLM07-A prompt leakage second-pass markers missing | `fixed` | F4 Prompt Leakage Marker Validation (`docs/audit/f4-prompt-leakage-marker-validation.md`); `CONSEQUENCE_DATA_MINIMIZATION_PROMPT_LEAKAGE_MARKERS`; `test:f4-prompt-leakage-marker-validation` | Central scanner now includes prompt-leakage markers and OWASP LLM07 governance reference. Stable reason codes avoid echoing marker text. |
| F4-LLM09-A hallucinated evidence / unsupported confidence | `partial` | Same root as F2-AG-6; `docs/audit/f2-evidence-confidence-validation.md` | OWASP LLM09 risk is valid. Attestor has digest-first audit/review contracts and required `source-system-verification`, but universal source-system verification remains future work. |
| F4-LLM10-A velocity limits depend on shared counter enforcement | `partial` | `docs/audit/f4-shared-velocity-retry-validation.md`; `requireSharedCounter`; `test:policy-limit-model`; `test:f4-shared-velocity-retry-validation` | Velocity limits can now require `shared-durable-counter` provenance and fail closed for caller-asserted or single-process counts. A real shared counter backend remains a deployment/storage requirement. |
| F4-LLM10-B retry-attempt ledger storage claim | `partial` | `docs/audit/f4-shared-velocity-retry-validation.md`; shared retry ledger store contract; `test:retry-attempt-ledger`; `test:f4-shared-velocity-retry-validation`; consequence shared-store request guard | Retry-attempt ledger now exposes an atomic shared-store contract and cross-instance tests, and `production-shared` protected API routes now fail closed while the consequence shared-store profile is blocked. Production shared durable backend remains required before this can be `fixed`. |
| F4-D Attestor-owned OpenAI usage / budget / prompt leakage scope | `partial` | `docs/audit/f2-llm-provider-supply-chain-validation.md`; `src/api/openai.ts`; `scripts/probe-openai-live-smoke.ts`; `src/api/llm-provider-registry.ts`; `src/financial/cli.ts`; evaluation packet docs | Current caller is optional financial CLI live-model proof path. No hosted consequence-admission route uses it. Provider registry, compatible failover route gating, route-readiness evidence gating, digest-only proof-context binding, OpenAI timeout enforcement, output-token budget enforcement, provider `store: false`, SDK hidden-retry disablement, and opt-in OpenAI reasoning live smoke proof now exist; live failover, OpenAI vision smoke proof, and non-OpenAI smoke proof remain incomplete before broader runtime-provider claims. |

### Retired Worktree-F4 Claims

These are not active findings unless a fresh source inspection re-opens them.

| Retired claim | Current status | Reason |
|---|---|---|
| No sensitive-information disclosure control exists | `superseded` | Fresh main has `data-minimization-redaction-policy`; active issue is enforcement/conformance, not absence. |
| No replay/binding control exists | `superseded` | Fresh main has presentation binding, replay ledger, downstream contract, and execution receipt. |
| No system-prompt leakage axis exists | `superseded` | Fresh main includes `raw-model-prompt` in forbidden raw classes. |

## F5 Signing Layer

Source report: project-owner supplied F5 redo for the fresh main state. The
earlier stale-worktree F5 is not authoritative.

| ID | Current status | Evidence / overlap | Remaining action |
|---|---|---|---|
| F-5.1 leaf validity rounding | `invalid-as-stated` | Fresh F5 redo: duration-based leaf validity exists | No action unless fresh source inspection contradicts the redo. |
| F-5.2 parent-directory fsync / orphan sweep | `partial` | F5 File Durability And Key Atomicity Validation (`docs/audit/f5-file-durability-key-atomicity-validation.md`); `writeTextFileAtomic`; `cleanupAtomicWriteTempFiles`; `test:f5-file-store-key-atomicity-validation` | Atomic writes now sweep matching target temp entries, fsync the temp file, and rename through target-local secure temp directories. Parent-directory fsync remains an explicit limitation because the portable Node directory-open path conflicts with the required CodeQL temporary-file gate on OS-temp-backed tests. |
| F-5.3 attestation validity window | `invalid-as-stated` | Fresh F5 redo: cert has `notBefore` / `notAfter` | No action unless fresh source inspection contradicts the redo. |
| F-5.4 revocation inputs | `invalid-as-stated` | Fresh F5 redo: cert and trust-chain verification accept revocation inputs | No action unless fresh source inspection contradicts the redo. |
| F-5.5 trust-chain clock skew | `invalid-as-stated` | Fresh F5 redo: cert and chain checks apply skew | No action unless fresh source inspection contradicts the redo. |
| F-5.6 anti-self-attest / PKI-bound verification | `fixed` | PR #291; `verification-trust-binding` | Keep as fixed; related third-party pin behavior tracked under F5-A1. |
| F-5.7 HA shared PKI / shared lock | `partial` | F5 HA Shared PKI Closure Validation (`docs/audit/f5-ha-shared-pki-closure-validation.md`); `test:f5-ha-shared-pki-closure-validation` | `production-shared` now implicitly requires an explicit shared PKI path and shared-path attestation. Preflight does not persist default local issuer material and reports `pkiReady=false`. The broader distributed lock / KMS-HSM production boundary remains unresolved. |
| F5-A1 out-of-band trust root optional | `fixed` | F5 CA Pin Required Validation (`docs/audit/f5-ca-pin-required-validation.md`); `verifyPkiBoundCertificate`; `verify-cli.ts`; `/api/v1/verify`; `test:f5-ca-pin-required-validation` | Foreign-kit verification now requires an out-of-band trusted CA fingerprint by default. CLI kit-contained-root checks require explicit `--developer-mode` and do not claim independent trust. |
| F5-A2 legacy flat verify escape via env | `fixed` | F5 Legacy Env Downgrade Validation (`docs/audit/f5-legacy-env-downgrade-validation.md`); `verify-cli.ts`; `/api/v1/verify`; `test:f5-legacy-env-downgrade-validation` | Env-var legacy downgrade is removed. CLI legacy flat verification remains only as the explicit `--allow-legacy-verify` flag for intentional legacy kit checks. |
| F5-A3 truncated fingerprint width | `fixed` | F5 Fingerprint Width Validation (`docs/audit/f5-fingerprint-width-validation.md`); `ATTESTOR_SIGNING_FINGERPRINT_HEX_LENGTH`; `test:f5-fingerprint-width-validation` | Signing key identity fingerprints now use 32 hex characters / 128-bit truncated SHA-256. Historical compact evidence IDs and previously-issued artifacts are not widened by this scoped fix. |
| F5-A4 homegrown canonicalization / RFC 8785 interop | `accepted-limitation` | F5 Canonicalization Validation (`docs/audit/f5-canonicalization-validation.md`); `ATTESTOR_SIGNING_CANONICALIZATION_SPEC_VERSION`; `test:f5-canonicalization-validation` | Attestor signing canonicalization is now explicitly versioned, strict, and tested, but it remains Attestor-specific canonical JSON. RFC 8785/JCS interoperability is not claimed. |
| F5-A5 non-atomic `saveKeyPair` | `fixed` | F5 File Durability And Key Atomicity Validation (`docs/audit/f5-file-durability-key-atomicity-validation.md`); `saveKeyPair`; `test:f5-file-store-key-atomicity-validation` | `saveKeyPair` now routes private and public key PEM persistence through `writeTextFileAtomic` with explicit file modes. |
| F5-A6 transparency log missing | `accepted-limitation` | F5 Transparency Log Claim Boundary Validation (`docs/audit/f5-transparency-log-claim-boundary-validation.md`); signing docs; `test:f5-transparency-log-claim-boundary-validation` | Attestor does not implement a public Rekor-equivalent transparency log. Internal release-enforcement transparency receipts are explicitly scoped as internal receipts, not public append-only witness semantics. |
| F5-A7 module-level CA singleton / injection point | `fixed` | F5 Keyless CA Injection Boundary Validation (`docs/audit/f5-keyless-ca-injection-boundary-validation.md`); `configureReleaseRuntimeKeylessCa`; `test:f5-keyless-ca-injection-boundary-validation` | Generic `setKeylessCa` is removed. Release-runtime CA configuration is explicit, validates CA/key consistency, is idempotent for the same fingerprint, and refuses silent replacement with a different CA fingerprint unless the release-runtime path explicitly allows and explains the replacement. |
| F5-A8 numeric canonicalization edge cases | `fixed` | F5 Canonicalization Validation (`docs/audit/f5-canonicalization-validation.md`); `canonicalize`; `test:f5-canonicalization-validation` | Signing canonicalization rejects `NaN`, `Infinity`, `undefined`, `bigint`, functions, symbols, and custom objects before signing. |
| F5-A9 verifier helper absent | `partial` | Fresh F5 redo says helper now exists | Close absence claim; keep consumer footgun risk under F5-A1. |
| F5-B1 crypto-authorization adapter trust delegation | `accepted-limitation` | F5 Crypto Trust Delegation Boundary Validation (`docs/audit/f5-crypto-trust-delegation-boundary-validation.md`); crypto first-integration docs; source comments in `eip712-authorization-envelope.ts` and `replay-freshness-rules.ts`; `test:f5-crypto-trust-delegation-boundary-validation` | Attestor can bind policy, evidence, replay/freshness posture, adapter readiness, and admission plans. It does not claim independent wallet-signature, chain-state, custody, Safe, x402 settlement, or solver verification without verifiable adapter evidence. |
| F5-NEW-1 exported `setKeylessCa` runtime injection | `fixed` | Same F5 Keyless CA Injection Boundary Validation as F5-A7 | The generic setter no longer exists; keyless signer internals remain outside package `exports`. |
| F5-NEW-2 strict PKI path enforcement opt-in | `fixed` | F5 HA Shared PKI Closure Validation (`docs/audit/f5-ha-shared-pki-closure-validation.md`); `release-runtime.ts`; `test:f5-ha-shared-pki-closure-validation` | `production-shared` is now an implicit shared-PKI-required profile. Explicit local-PKI fallback is no longer silently used for production-shared startup. |
| F5-NEW-3 `allowLegacyUnbounded` escape hatch | `fixed` | F5 Legacy Unbounded Certificate Validation (`docs/audit/f5-legacy-unbounded-certificate-validation.md`); `verifyCertificate`; `test:f5-legacy-unbounded-certificate-validation` | Compatibility acceptance remains explicit, but now emits a machine-readable `legacy-unbounded-certificate-accepted` warning with sunset metadata. Default verification still rejects unbounded certificates. |
| F5-NEW-4 duplicate verify helper calls in CLI | `backlog` | Low-risk maintainability issue | Refactor only when touching `verify-cli.ts` for F5-A1/A2. |

## Final Docs And Claim Alignment

These run only after the active audit remediation queue is closed or explicitly
backlogged.

| ID | Current status | Remaining action |
|---|---|---|
| FINAL-1 README / public docs claim alignment | `fixed` | Final Claim Alignment Validation (`docs/audit/final-claim-alignment-validation.md`); `test:final-claim-alignment-validation`; README current-status language; architecture docs wording cleanup. Public docs keep AI Action Control Plane framing, evaluation-release boundary, and no production/compliance overclaim. |
| FINAL-2 research provenance / remediation ledger sync | `fixed` | Final Claim Alignment Validation (`docs/audit/final-claim-alignment-validation.md`); research provenance ledger F1-F5 closure entry; `test:research-provenance-ledger`; tracker PR #327 merge record. |

## F6 Multi-Tenant Blast Radius

Source report: project-owner supplied F6 multi-tenant blast-radius and
cross-tenant key/state isolation audit.

Validation record: `docs/audit/f6-tenant-blast-radius-validation.md`.

Current F6 status: validation pass complete; tenant-bound release-token
semantics added for F6-T1/F6-T6; env tenant-key cache hardening added for
F6-T3/F6-T9; anonymous fallback now uses a reserved sentinel for F6-T10;
bypass routes now clear and refuse unverified tenant/account headers for F6-T5;
RLS wording is narrowed to sample/probe status for F6-T2; usage-meter wording
now separates the local file ledger from shared control-plane usage state for
F6-T4; recipient/tenant replay-only coverage now has a runtime decision bridge
for F6-T8. A tenant signer boundary contract now defines the expected external
KMS/HSM shape, fake adapter behavior, structured digest-only live provider
proof gate, and provider-native algorithm/input-mode capability checks, but
live per-tenant signer isolation and route-by-route enforcement
adoption remain separate work.

| ID | Current status | Evidence / overlap | Remaining action |
|---|---|---|---|
| F6-T1 shared PKI tenant binding | `partial` | Runtime-wide PKI and release-token issuer are real; generic admission tenant-spoofing subclaim is stale because `/api/v1/admissions` overwrites or rejects mismatched `tenantId`. F6 Tenant-Bound Release Token Validation adds `tenant_id` release-token claims, expected-tenant verification, introspection propagation, offline verifier binding, and token-exchange preservation. The tenant signer boundary contract now defines the future per-tenant external KMS/HSM shape, requires structured live-provider proof rather than a bare boolean, and pins provider-native algorithm/input-mode capability. | Wire a live per-tenant leaf signer or KMS/HSM tenant-scoped signer adapter before claiming cryptographic signer isolation. |
| F6-T2 RLS declared but not data-path wired | `accepted-limitation` | F6 RLS Claim Alignment; `tenant-rls.ts`; `runtime/rls-runtime.ts`; deployment docs; `test:f6-rls-claim-alignment`. The helper is now documented as sample/probe substrate and does not claim to protect main control-plane stores. | Future production data-path RLS wiring remains a separate storage-isolation project. |
| F6-T3 env tenant key registry per-pod cache | `partial` | F6 Tenant Key Cache Hardening hashes env tenant-key lookup material, avoids raw env config retention, exposes cache age/expiry metadata, and refuses env keys in `production-shared`. Shared file/PG-backed lookup exists separately. | Env keys remain per-pod local identity state outside `production-shared`; shared deployments must use shared control-plane tenant key state. |
| F6-T4 usage-meter single-node quota | `partial` | F6 Usage Meter Shared-Store Boundary; `usageMeterStorageDescriptor`; `control-plane-store.ts` shared PostgreSQL `usage_ledger`; `test:f6-usage-meter-shared-store-boundary`. The file ledger is local/single-node only; API-facing usage state can use shared control-plane PostgreSQL when configured. | External production PostgreSQL deployment, migration, backup/restore, and live quota behavior remain deployment proof, not repository proof. |
| F6-T5 bypass route tenant-header spoofing | `fixed` | F6 Bypass Route Tenant Context Invariant; `clearTenantContextHeaders`; `hasVerifiedTenantContext`; `test:f6-bypass-route-tenant-context-invariant`. Bypass routes strip client-supplied internal tenant/account headers, and request-context helpers refuse unverified headers. | No remaining repository action for this scoped finding. |
| F6-T6 runtime signer all-tenant blast radius | `partial` | F6 Tenant-Bound Release Token Validation binds release tokens and verification results to `tenant_id`, but runtime signer and verification key are still shared runtime material; revocation remains runtime-wide. The tenant signer boundary contract proves fake external KMS tenant mismatch refusal, no-raw-material descriptors, fail-closed structured live-provider proof evaluation, and unsupported provider/algorithm rejection. | Wire a live per-tenant leaf signer or KMS/HSM tenant-scoped signer adapter before claiming signer-compromise blast-radius isolation. |
| F6-T7 anonymous fallback env-gated | `invalid-as-stated` | Production-like tenant fallback guard and explicit runtime-profile guard already exist. | Sentinel naming is closed under F6-T10. |
| F6-T8 recipient/tenant boundary replay-only | `partial` | F6 Recipient/Tenant Runtime Boundary Bridge; `evaluateConsequenceRecipientTenantRuntimeBoundary`; `failure-mode-guard-coverage.ts`; `test:f6-recipient-tenant-runtime-boundary`. Replay-only coverage now has a central runtime decision bridge. | Surface-by-surface hosted route, dashboard, export, review-packet, downstream sender, and customer-gateway adoption remains future integration work before universal output enforcement can be claimed. |
| F6-T9 plaintext env API keys in memory | `fixed` | F6 Tenant Key Cache Hardening stores env tenant keys by `tenant.api-key` lookup hash and stores only a secret-derived env config digest for reload detection. | No remaining repository action for this scoped finding. |
| F6-T10 `default` tenant sentinel collision | `fixed` | F6 Anonymous Tenant Sentinel Validation; `ANONYMOUS_TENANT_ID`; `isAnonymousTenantContext`; `test:f6-anonymous-tenant-sentinel`. Anonymous `default` headers normalize to `__attestor_anonymous__`, while a real API-key tenant named `default` remains distinct. | No remaining repository action for this scoped finding. |

## F7 Shadow Infrastructure Red-Team

Source report: project-owner supplied F7 shadow infrastructure red-team report.

Validation record: `docs/audit/f7-shadow-infrastructure-validation.md`.

Current F7 status: validation pass complete for the report as supplied. The
shadow event origin/redaction witness slice, shadow simulation policy-floor
slice, break-glass hardening slice, high-risk two-person activation slice,
shadow bundle signing boundary slice, and shadow readiness claim-alignment slice
are implemented. Several claims were
narrowed against `origin/master`:
shadow routes do not accept arbitrary caller-supplied event arrays for
simulations; shadow event feature values are digested rather than raw-stored;
`customerControlsReady` uses strict required-control aggregation; and
selected-profile storage readiness blocks file-backed shadow stores for
`production-shared`. The F7 planned repository queue is now closed.

| ID | Current status | Evidence / overlap | Remaining action |
|---|---|---|---|
| F7-S1 shadow event injection without origin-binding | `fixed` | F7 Shadow Event Origin And Redaction Witness Validation; `originWitness`; `originWitnessDigest`; `test:shadow-admission-events`. Direct public route-injection wording was too strong because simulation routes read events through `deps.listShadowEvents({ tenant })`. | Repository-side origin witness is closed. A third-party signed production-path witness remains outside this scoped repository claim. |
| F7-S2 operator-supplied redaction self-attest | `fixed` | F7 Shadow Event Origin And Redaction Witness Validation; `redactionWitness`; `redactionWitnessDigest`; data-minimization policy version binding; `test:shadow-admission-events`. Raw feature values are not persisted as stated. | Repository-side redaction witness is closed. External redaction attestations remain outside this scoped repository claim. |
| F7-S3 simulation window / threshold manipulation | `fixed` | F7 Shadow Simulation Policy Floor Validation; simulation routes use persisted tenant events; `SHADOW_POLICY_SIMULATION_MINIMUM_PROMOTION_EVENTS_FLOOR`; `minimumPromotionEventsSource`; `test:shadow-policy-simulation`. | No remaining repository action for this scoped finding. |
| F7-S4 break-glass rollout has no extra gate | `fixed` | F7 Break-Glass Hardening Validation; `SHADOW_CUSTOMER_ACTIVATION_BREAK_GLASS_MAX_WINDOW_MS`; `secondaryApproverRef`; `breakGlassJustificationRef`; `breakGlassReconciliationRef`; `test:shadow-customer-activation-handoff`. | No remaining repository action for this scoped finding. |
| F7-S5 customer controls readiness aggregation | `invalid-as-stated` | `customerControlsReady = controlRefs.every((control) => control.present)`; shadow customer activation handoff tests. | No action for the supplied claim unless a fresh source inspection finds a bypass. |
| F7-S6 shadow persistence per-node single-host | `accepted-limitation` | F7 Shadow Infrastructure Validation; `production-storage-path.ts`; `test:production-storage-path`. File-backed evaluation storage exists, but `production-shared` readiness requires `shared-durable` shadow stores and blocks by default. | Shared shadow persistence remains future deployment/storage work, not a current production-shared claim. |
| F7-S7 red-team replay is not runtime enforcement | `accepted-limitation` | F7 Shadow Infrastructure Validation; Policy Foundry red-team replay tests. | Keep documented as evidence and design feedback, not runtime enforcement. |
| F7-S8 single-operator shadow activation | `fixed` | F7 High-Risk Two-Person Activation Validation; `SHADOW_CUSTOMER_ACTIVATION_HIGH_RISK_BOUNDARY_KINDS`; `activationBoundaryKind`; `twoPersonApprovalRequired`; `twoPersonApprovalReady`; `test:shadow-customer-activation-handoff`. | No remaining repository action for this scoped finding. |
| F7-S9 shadow bundle signing boundary | `fixed` | F7 Shadow Bundle Signing Boundary Validation; `SHADOW_POLICY_BUNDLE_PRODUCTION_SIGNING_BOUNDARIES`; `productionSigningBoundaryRequired`; `productionSigningBoundaryReady`; `production-signing-boundary-invalid`; `test:shadow-policy-bundle-publication`. | Repository-side production signing boundary split is closed. Tenant-specific signer isolation remains covered by F6-T1/F6-T6 limitations. |
| F7-S10 production-ready descriptor enforcement | `fixed` | F7 Shadow Readiness Claim Alignment Validation; `shadow-readiness-claim-alignment.ts`; `/api/v1/ready` `checks.shadowReadinessClaimAlignment`; `production-storage-path.ts`; `test:shadow-readiness-claim-alignment`. | No remaining repository action for this scoped finding. `productionReady: false` remains intentional; live production/customer activation evidence is not claimed. |

## F8 Operational Resilience / Chaos

Source report: project-owner supplied F8 operational resilience / chaos audit.

Validation record: `docs/audit/f8-operational-resilience-validation.md`.

Current F8 status: validation pass complete for the report as supplied. Startup,
health, readiness, degraded-mode TTL, worker readiness, webhook signature, and
production-shared startup-fail-fast findings are closed with repository tests.
Health diagnostics, async dead-letter HA proof, PKI bootstrap locking,
PostgreSQL circuit-breaker policy, degraded-mode clock skew, and full automated
fault injection are closed as explicit limitations, partial repository evidence,
or backlog without production overclaim.

| ID | Current status | Evidence / overlap | Remaining action |
|---|---|---|---|
| F8-R1 health PKI fingerprint / subject disclosure | `fixed` | F8 Operational Resilience Validation; `core-routes.ts`; `/api/v1/health` redacts `caFingerprint`, `signerSubject`, and `reviewerSubject`; `/api/v1/pki/ca` remains the public trust-root route; `test:f8-operational-resilience-validation`. | No remaining repository action for this scoped finding. |
| F8-R2 startup probe separation | `fixed` | F8 Operational Resilience Validation; `/api/v1/startup`; Kubernetes HA startup probe; `docker-compose.ha.yml` bootstrap grace; `test:f8-operational-resilience-validation`. | No remaining repository action for this scoped finding. |
| F8-R3 health body diagnostic richness | `accepted-limitation` | `/api/v1/health` remains process-liveness HTTP 200 and privacy-minimized, while `/api/v1/ready` is the traffic gate. | Operators must use readiness for routability. Rich safe diagnostics remain intentionally visible on health. |
| F8-R4 degraded-mode TTL ceiling | `fixed` | `createDegradedModeGrant` rejects grants exceeding `maxTtlSeconds`; `test:f8-operational-resilience-validation`. | No remaining repository action for this scoped finding. |
| F8-R5 async dead-letter HA visibility | `partial` | `control-plane-store.ts` has PostgreSQL async dead-letter persistence and file-backed fallback; `service-pipeline-dead-letter-service` tests; `test:f8-operational-resilience-validation`. | Live HA deployment with shared PostgreSQL, restart, and operator DLQ drill remains external proof. |
| F8-R6 worker shutdown readiness | `fixed` | `worker.ts` exposes health/ready and gates readiness while `shuttingDown`; health contract has `worker_shutdown_not_ready`; `test:f8-operational-resilience-validation`. | No remaining repository action for this scoped finding. |
| F8-R7 PKI bootstrap idempotency / shared lock | `partial` | Same root as F-5.7; F5 HA Shared PKI Closure Validation; production-shared requires explicit shared PKI path attestation. | Distributed lock and KMS/HSM signer remain outside this repository closure. |
| F8-R8 PostgreSQL pool retry / circuit-breaker policy | `backlog` | Shared PostgreSQL stores and rehearsal tests exist, but no dedicated circuit-breaker contract covers every pool. | Add explicit pool backoff/circuit-breaker contract before stronger production resilience claims. |
| F8-R9 degraded-mode clock skew | `accepted-limitation` | Degraded-mode grants use exact `startsAt` / `expiresAt` boundaries. | Exact expiry is retained to avoid silently extending break-glass authority. |
| F8-R10 automated chaos drill suite | `partial` | Production rehearsal tests cover target profiles, substrate probes, async recovery, backup/restore, observability, and promotion bundles. | Full automated fault-injection chaos suite remains future work. |
| F8-R11 production-shared startup fail-fast | `fixed` | `startHttpServer` rejects production-shared storage blockers before serving; `test:f8-operational-resilience-validation`. | No remaining repository action for this scoped finding. |
| F8-R12 webhook signature route proof | `fixed` | Stripe, SendGrid, and Mailgun service tests reject missing or invalid signatures before mutation; health contract requires signed webhook ingress. | No remaining repository action for this scoped finding. |

## F9 Compliance Gap Analysis

Source report: project-owner supplied F9 compliance gap analysis for SOC 2 TSC,
ISO/IEC 27001:2022, and ISO/IEC 42001:2023.

Validation record: `docs/audit/f9-compliance-gap-validation.md`.

Current F9 status: validation pass complete for the report as supplied. The
repository now has explicit compliance engineering-anchor mappings, a shared
responsibility matrix, SoD policy boundary, provider inventory, data-residency
posture, retention boundary, security-testing posture, cryptography policy,
privacy notice template, and AI accessibility/bias boundary. These documents are
procurement and auditor orientation material; they are not external assurance,
not a SOC 2 report, not an ISO audit, and not live production proof.

| ID | Current status | Evidence / overlap | Remaining action |
|---|---|---|---|
| F9-C1 SOC 2 / ISO 27001 / ISO 42001 mapping docs missing | `fixed` | F9 Compliance Gap Validation; `soc2-tsc-mapping.md`; `iso27001-2022-annex-a-mapping.md`; `iso42001-2023-annex-a-mapping.md`; `regulatory-alignment.md` links; `test:f9-compliance-gap-validation`. | No remaining repository action for this scoped finding. |
| F9-C2 SOC 2 Type II evidence-pack implication | `accepted-limitation` | `soc2-tsc-mapping.md` and `compliance-evidence-boundary.md` state that AI-decision evidence is not a SOC 2 Type II evidence pack. | Formal auditor evidence still needs access logs, change approvals, incident records, control-owner evidence, and audit-period samples. |
| F9-C3 data-residency / regional-pinning posture missing | `fixed` | `data-residency.md`; F9 validation. | Live regional pinning and transfer-mechanism proof remain deployment/legal work. |
| F9-C4 retention/disposal policy missing | `fixed` | `retention-policy.md`; release retention classes; replay ledger retention settings; F9 validation. | Customer legal retention schedule and WORM/SIEM retention remain external. |
| F9-C5 segregation-of-duties policy missing | `fixed` | `segregation-of-duties.md`; F7 high-risk two-person activation validation; break-glass hardening. | Named role assignments and access-review samples remain organizational evidence. |
| F9-C6 vendor / third-party provider risk doc missing | `fixed` | `third-party-providers.md`; agentic supply-chain guard; F2/F4 LLM provider supply-chain validation. | Vendor due diligence, DPA, and approval records remain organizational evidence. |
| F9-C7 BC/DR policy doc RTO/RPO posture unclear | `fixed` | `backup-restore-dr.md` already records RPO / RTO guidance and current DR boundary; F9 validation asserts it. | Live restore drills and managed failover remain deployment evidence. |
| F9-C8 accessibility / AI bias posture missing | `fixed` | `ai-accessibility-bias-boundary.md`; ISO/IEC 42001 mapping. | Upstream model fairness, dataset, UI accessibility, and legal assessment remain customer-owned. |
| F9-C9 security-testing / pentest posture undocumented | `fixed` | `security-testing.md`; package runner; audit remediation tracker. | Independent pentest reports and retest records remain external evidence. |
| F9-C10 cryptography / key-management policy doc missing | `fixed` | `cryptography-policy.md`; F5 signing validations; signing verification docs. | External KMS/HSM custody and customer key-management program remain external. |
| F9-C11 privacy notice / data-flow template missing | `fixed` | `privacy-notice-template.md`; data minimization policy. | Legal basis, DPA, data-subject process, and customer notice approval remain external. |
| F9-C12 shared-responsibility model implicit | `fixed` | `shared-responsibility-matrix.md`; compliance evidence boundary. | Contractual allocation and customer control owner assignments remain external. |

## F10 Customer Escape-Hatch Abuse

Source report: project-owner supplied F10 customer escape-hatch abuse audit.

Validation record: `docs/audit/f10-escape-hatch-validation.md`.

Current F10 status: validation pass complete for the report as supplied. The
repository now requires reason metadata for legacy verifier downgrade, records
customer-gate proof skips distinctly, rejects insecure hosted OIDC discovery in
production-like runtimes, exposes nonsecret account auth key-source labels,
adds digest-only no-go bypass scanning, removes the generic keyless CA reset
export, and adds a digest-only escape-hatch telemetry summary contract.

| ID | Current status | Evidence / overlap | Remaining action |
|---|---|---|---|
| F10-E1 legacy flat verify reason missing | `fixed` | `verify-cli.ts`; `signing-verification.md`; `test:f10-escape-hatch-validation`. | Legacy mode remains intentional for pre-PKI kits, but now requires a reason. |
| F10-E2 `requireProof: false` telemetry gap | `fixed` | `customer-gate.ts`; `customer-gate-proof-skipped-by-caller`; `test:consequence-admission-customer-gate`. | Downstream enforcement remains customer-owned unless using protected enforcement wrappers. |
| F10-E3 break-glass rollout lacks distinct gate | `fixed` | F7 Break-Glass Hardening Validation; secondary approver, expiry, justification, reconciliation. | Live operator evidence remains external. |
| F10-E4 natural-language bypass caller-asserted | `partial` | `detectConsequenceNoGoNaturalLanguageBypass`; digest-only signal count/digests; `test:no-go-condition-ledger`. | Upstream integrations must pass relevant text fields to the scanner. |
| F10-E5 OIDC insecure HTTP production gate | `fixed` | `hostedOidcAllowsInsecureRequests`; `account-oidc-linking-policy.test.ts`. | Live IdP configuration remains deployment evidence. |
| F10-E6 shared `accept-the-risk` string | `accepted-limitation` | F10 validation documents the shared string as operator friction, not a secret. | Per-override phrases can be added later if operator confusion appears. |
| F10-E7 fallback key-source health visibility | `fixed` | `/api/v1/health` `accountAuth.keySources`; `test:service-core-routes`. | Operators must monitor the health output. |
| F10-E8 local-dev profile production fallback | `invalid-as-stated` | Production runtime profile tests and docs already require explicit profile in production-like envs. | Hosts with no production-like signal remain outside repository detection. |
| F10-E9 exported `resetKeylessCa` | `fixed` | `resetKeylessCaForTesting(reason)` replaces generic reset export; package exports do not expose signing internals. | Internal test helper remains for isolated tests. |
| F10-E10 degraded-mode TTL escape | `fixed` | F8 Operational Resilience Validation; `createDegradedModeGrant` max TTL enforcement. | No remaining repository action for this scoped finding. |
| F10-E11 shared counter default | `partial` | Existing F4 shared velocity validation and production storage gates keep this as a claim boundary. | Pure policy default remains single-process compatible. |
| F10-E12 aggregate escape-hatch usage view | `partial` | `escape-hatch-telemetry.ts` catalog, event, and summary builder. | Persisted admin route / SIEM export remains future integration work. |

## F11 Supply Chain Depth

Source report: project-owner supplied F11 runtime / model / data supply-chain
depth audit, extending the earlier R13 build-chain work.

Validation record: `docs/audit/f11-supply-chain-depth-validation.md`.

Current F11 status: validation pass complete for the report as supplied. The
Dockerfile image-pin finding was stale for fresh `origin/master`; Dockerfile
base images were already digest-pinned. The repository now also digest-pins the
HA, DR, observability compose, and observability Kubernetes external images;
blocks `:latest` and missing digests in the supply-chain baseline; exact-pins
critical runtime dependencies; records OpenAI response-model drift telemetry;
and records SBOM / release-provenance / webhook evidence boundaries without
claiming SLSA level, multi-provider LLM resilience, or live production proof.

| ID | Current status | Evidence / overlap | Remaining action |
|---|---|---|---|
| F11-SC-1 container base images use floating tags | `fixed` | `Dockerfile` was already digest-pinned; HA/DR compose images are now digest-pinned; `scripts/check-supply-chain-baseline.mjs`; `test:f11-supply-chain-depth-validation`. | No remaining repository action for this scoped finding. Image refresh automation remains operational work. |
| F11-SC-2 observability stack uses `:latest` tags | `fixed` | `docker-compose.observability.yml`; Kubernetes observability deployment and Grafana Alloy patch; supply-chain baseline image checks. | No remaining repository action for this scoped finding. |
| F11-SC-3 high-trust npm dependency caret pinning | `fixed` | Critical runtime dependencies are exact-pinned in `package.json` and root `package-lock.json`; supply-chain baseline checks the critical list. | Dev/noncritical dependency ranges remain lockfile-governed. |
| F11-SC-4 single OpenAI provider / provider registry contract | `partial` | `src/api/openai.ts` still uses OpenAI directly, but now records provider-returned model observations and drift warnings, applies timeout/output-token runtime policy, disables provider-side response storage, and exposes an opt-in OpenAI reasoning live smoke probe; `src/api/llm-provider-registry.ts` records provider inventory and fail-closed route evaluation with compatible fallback gating. | Multi-provider live client selection, failover, OpenAI vision smoke proof, and non-OpenAI smoke proof remain future work before resilience claims. |
| F11-SC-5 generated-adapter verification path | `partial` | `agentic-supply-chain-guard.ts` has `generated-adapter` component kind and blocks unreviewed generated artifacts. | Signed generated-adapter provenance, diff-review activation, and rollback semantics remain future hardening. |
| F11-SC-6 model drift binding for Attestor-owned OpenAI usage | `partial` | `observeOpenAiModel(...)` records response-model drift telemetry for reasoning and vision calls. | Persisted model-context drift binding and admission-time enforcement are not claimed. |
| F11-SC-7 customer-supplied evidence re-fetch | `partial` | Same root as F2-AG-6 and F4-LLM09-A; evidence-confidence validation keeps source-system verification explicit. | Universal source-system re-fetch/re-hash remains future work. |
| F11-SC-8 webhook ingress signature spot-check | `fixed` | F8 webhook service tests reject missing/invalid Stripe, SendGrid, and Mailgun signatures before mutation. | No remaining repository action for this scoped finding. |
| F11-SC-9 MCP server registry missing | `backlog` | `mcp-server` is already a component kind in the agentic supply-chain guard. | Build an MCP server registry only when MCP becomes an active product integration. |
| F11-SC-10 connector/plugin component criticality | `fixed` | Critical connector/provider libraries are exact-pinned; agentic supply-chain guard covers connector/plugin kinds and criticality. | No remaining repository action for this scoped package-level finding. |
| F11-SC-11 SBOM packaging not located | `invalid-as-stated` | `sbom:cyclonedx` writes `.attestor/release-provenance/sbom.cyclonedx.json`; release provenance packages and attests it. | No action unless a future release workflow removes the artifact. |
| F11-SC-12 release-provenance token boundary | `fixed` | `release-provenance.yml` keeps `attestations: write` and `id-token: write` isolated to release provenance, with evaluation tag trigger plus explicit manual dispatch. | No remaining repository action for this scoped finding. |

## F12 Continuous Red-Team Automation

Source report: project-owner supplied F12 continuous red-team automation audit.

Validation record: `docs/audit/f12-continuous-red-team-validation.md`.

Current F12 status: validation pass complete for the report as supplied. The
repository now has a secretless F-series continuous validation runner, a read-only
nightly / PR workflow, deterministic canonicalizer/signature fuzz smoke, and a
public coordinated-disclosure entry point. External benchmark execution, paid
bug-bounty operations, production-traffic pattern intake, and full live runtime
red-team execution remain non-claims.

| ID | Current status | Evidence / overlap | Remaining action |
|---|---|---|---|
| F12-RT-1 external AI safety benchmarks cited but not integrated | `backlog` | External benchmarks remain registry research anchors, not executable jobs. | Add an AgentDojo or equivalent benchmark adapter before claiming benchmark execution. |
| F12-RT-2 no nightly drift / regression cron | `fixed` | `f-series-continuous-validation.yml`; `audit:f-series-continuous-validation`; `test:f12-continuous-red-team-validation`. | No remaining repository action for this scoped finding. |
| F12-RT-3 no fuzz harness for canonicalizer / verifier | `partial` | `test:f12-canonicalizer-fuzz-smoke` covers deterministic generated JSON, invalid inputs, stable signed bytes, and tamper rejection. | Property-based/random-byte fuzzing remains future hardening. |
| F12-RT-4 no cross-finding regression matrix | `partial` | The F-series runner executes all F validation scripts plus adjacent guard/replay/tracker invariants. | Formal finding-to-adjacent-finding matrix remains future work. |
| F12-RT-5 bug bounty / public VDP missing | `partial` | `/.well-known/security.txt`; `SECURITY.md` coordinated disclosure targets. | Paid public bug-bounty program is not claimed. |
| F12-RT-6 red-team fixtures are decision-only, not live runtime | `partial` | Continuous runner includes action-surface red-team fixtures, policy-foundry replay, adversarial replay executor, and downstream replay fixtures. | Full live runtime red-team execution remains future work. |
| F12-RT-7 no production-traffic shadow replay for emerging attack patterns | `backlog` | Existing shadow path remains customer-policy focused. | Production-traffic pattern intake must be separately designed with data minimization. |
| F12-RT-8 no public AI safety leaderboard participation | `backlog` | No repository evidence of public leaderboard participation. | Publish only after real benchmark execution. |
| F12-RT-9 no pre-merge red-team replay against changed surface | `partial` | F-series workflow runs on PRs touching source, tests, audit docs, scripts, workflows, package files, `SECURITY.md`, or `security.txt`. | Changed-surface fixture subset mapping remains future work. |
| F12-RT-10 tracker verification scope unverified | `partial` | Tracker and research-ledger self-tests now check F12 closure evidence and run in the F-series job. | Network proof of every historical PR URL / merge commit remains outside secretless local validation. |
| F12-RT-11 external pentest cadence undocumented | `invalid-as-stated` | `security-testing.md` already records annual or release-gated pentest recommendation and evidence-handling fields. | Independent pentest reports remain external evidence. |
| F12-RT-12 coordinated disclosure timeline / SLA not declared | `fixed` | `SECURITY.md` response targets; `/.well-known/security.txt`; `test:security-baseline-docs`; `test:f12-continuous-red-team-validation`. | Hosted service SLA remains explicitly out of scope. |

## Next Work Queue

The current F1-F5 project-owner supplied audit queue is closed for repository
evidence: every row is fixed, invalid-as-stated, superseded, accepted as a
limitation, partial with a stated live/customer boundary, or backlogged with
evidence.

F6 is closed for planned repository slices. F7 is closed for planned repository slices.
F8 is closed for planned repository slices. F9 is closed for planned repository
documentation and validation slices. F10 is closed for planned repository
validation slices. F11 is closed for planned repository validation slices. F12 is closed for planned repository validation slices.
Planned F7 order:

1. F7 validation and tracker sync. Done.
2. F7-S1/F7-S2 shadow event origin and redaction witness. Done in this slice.
3. F7-S3 server-owned simulation policy floor. Done in this slice.
4. F7-S4 break-glass hardening. Done in this slice.
5. F7-S8 two-person high-risk activation handoff. Done in this slice.
6. F7-S9 shadow bundle signing boundary validation. Done in this slice.
7. F7-S10 shadow readiness and claim alignment. Done in this slice.

Planned F8 order:

1. F8 operational resilience validation and tracker sync. Done in this slice.

Planned F9 order:

1. F9 compliance gap validation and tracker sync. Done in this slice.
2. F9 governance documentation mapping. Done in this slice.

Planned F10 order:

1. F10 escape-hatch validation and tracker sync. Done in this slice.

Planned F11 order:

1. F11 supply-chain depth validation and tracker sync. Done in this slice.

Planned F12 order:

1. F12 continuous red-team validation and tracker sync. Done in this slice.
