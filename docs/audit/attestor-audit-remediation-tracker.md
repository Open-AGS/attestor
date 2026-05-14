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
| F6 multi-tenant blast radius | 10 | 2 | 5 | 3 |

Remaining work after the final claim-alignment slice: 0 planned
PR-sized or validation-sized units in the current F1-F5 audit queue.

Remaining F6 queue after tenant-bound release-token slice: 6 planned PR-sized
or validation-sized units.

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
| F2-AG-1 customer-gate honor-system | `partial` | `docs/audit/f2-customer-gate-enforcement-validation.md` | Customer-gate helper alone is non-cryptographic; downstream contract helper and release-enforcement plane exist. Generic consequence-to-token binding remains future work. |
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
| F4-LLM05-B presentation replay ledger in-memory reference path | `partial` | `docs/audit/f4-presentation-replay-shared-ledger-validation.md`; shared replay store contract; `test:f4-presentation-replay-shared-ledger-validation` | Shared-store contract and cross-instance replay test exist. Production shared atomic backend remains required before this can be `fixed`. |
| F4-LLM06-A customer gate honor-system | `partial` | Same root as F2-AG-1 and F1-CC-2; `docs/audit/f2-customer-gate-enforcement-validation.md` | The LLM06 claim is narrowed: helper-only use remains honor-system; protected release-enforcement path exists separately. |
| F4-LLM06-B agent-loop budget per process | `partial` | `docs/audit/f4-shared-velocity-retry-validation.md`; PR #293; `test:agent-loop-abuse-guard-shared`; `test:f4-shared-velocity-retry-validation` | Hosted service wrapper has Redis-backed shared counters and HA fail-closed behavior. Package-level reference guard remains in-memory, so this is not marked fully fixed for every import path. |
| F4-LLM07-A prompt leakage second-pass markers missing | `fixed` | F4 Prompt Leakage Marker Validation (`docs/audit/f4-prompt-leakage-marker-validation.md`); `CONSEQUENCE_DATA_MINIMIZATION_PROMPT_LEAKAGE_MARKERS`; `test:f4-prompt-leakage-marker-validation` | Central scanner now includes prompt-leakage markers and OWASP LLM07 governance reference. Stable reason codes avoid echoing marker text. |
| F4-LLM09-A hallucinated evidence / unsupported confidence | `partial` | Same root as F2-AG-6; `docs/audit/f2-evidence-confidence-validation.md` | OWASP LLM09 risk is valid. Attestor has digest-first audit/review contracts and required `source-system-verification`, but universal source-system verification remains future work. |
| F4-LLM10-A velocity limits depend on shared counter enforcement | `partial` | `docs/audit/f4-shared-velocity-retry-validation.md`; `requireSharedCounter`; `test:policy-limit-model`; `test:f4-shared-velocity-retry-validation` | Velocity limits can now require `shared-durable-counter` provenance and fail closed for caller-asserted or single-process counts. A real shared counter backend remains a deployment/storage requirement. |
| F4-LLM10-B retry-attempt ledger storage claim | `partial` | `docs/audit/f4-shared-velocity-retry-validation.md`; shared retry ledger store contract; `test:retry-attempt-ledger`; `test:f4-shared-velocity-retry-validation` | Retry-attempt ledger now exposes an atomic shared-store contract and cross-instance tests. Production shared durable backend remains required before this can be `fixed`. |
| F4-D Attestor-owned OpenAI usage / budget / prompt leakage scope | `backlog` | `docs/audit/f2-llm-provider-supply-chain-validation.md`; `src/api/openai.ts`; `src/financial/cli.ts`; evaluation packet docs | Current caller is optional financial CLI live-model proof path. No hosted consequence-admission route uses it. Add provider registry, timeout/budget policy, and proof-context binding before broader runtime-provider claims. |

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
semantics added for F6-T1/F6-T6, while per-tenant signer isolation remains a
separate boundary.

| ID | Current status | Evidence / overlap | Remaining action |
|---|---|---|---|
| F6-T1 shared PKI tenant binding | `partial` | Runtime-wide PKI and release-token issuer are real; generic admission tenant-spoofing subclaim is stale because `/api/v1/admissions` overwrites or rejects mismatched `tenantId`. F6 Tenant-Bound Release Token Validation adds `tenant_id` release-token claims, expected-tenant verification, introspection propagation, offline verifier binding, and token-exchange preservation. | Add per-tenant leaf signer or KMS/HSM tenant-scoped signer strategy before claiming cryptographic signer isolation. |
| F6-T2 RLS declared but not data-path wired | `partial` | `tenant-rls.ts` provides RLS SQL/helper and runtime activation probe; main control-plane stores do not use `withTenantTransaction`. | Wire RLS into real stores or narrow RLS docs/comments to sample/probe status. |
| F6-T3 env tenant key registry per-pod cache | `open` | `tenant-isolation.ts` stores env tenant keys in module-level memory; shared file/PG-backed lookup exists separately. | Hash and age env cache entries, or remove env-key path from shared profiles. |
| F6-T4 usage-meter single-node quota | `partial` | `usage-meter.ts` is single-node, but API-facing `control-plane-store.ts` uses PostgreSQL when `ATTESTOR_CONTROL_PLANE_PG_URL` is configured. | Keep file ledger scoped to local/single-node and add claim/profile tests around shared quota posture. |
| F6-T5 bypass route tenant-header spoofing | `invalid-as-stated` | Admin routes use `currentAdminAuthorized`; no current admin route evidence shows `currentTenant` use on bypassed routes. | Add invariant test preventing bypass routes from reading tenant context from unverified headers. |
| F6-T6 runtime signer all-tenant blast radius | `partial` | F6 Tenant-Bound Release Token Validation binds release tokens and verification results to `tenant_id`, but runtime signer and verification key are still shared runtime material; revocation remains runtime-wide. | Add per-tenant leaf signer or KMS/HSM tenant-scoped signer strategy before claiming signer-compromise blast-radius isolation. |
| F6-T7 anonymous fallback env-gated | `invalid-as-stated` | Production-like tenant fallback guard and explicit runtime-profile guard already exist. | Remaining issue is sentinel naming, tracked as F6-T10. |
| F6-T8 recipient/tenant boundary replay-only | `partial` | Replay contract exists; some runtime routes have concrete tenant checks. | Promote replay cases into runtime guard/conformance for declared output surfaces. |
| F6-T9 plaintext env API keys in memory | `open` | Env API keys are raw `Map` keys; file/PG-backed keys are hashed. | Hash env lookup keys or retire env keys for shared profiles. |
| F6-T10 `default` tenant sentinel collision | `open` | Anonymous fallback uses literal `default` and request context treats it specially. | Add reserved anonymous sentinel plus compatibility tests. |

## Next Work Queue

The current F1-F5 project-owner supplied audit queue is closed for repository
evidence: every row is fixed, invalid-as-stated, superseded, accepted as a
limitation, partial with a stated live/customer boundary, or backlogged with
evidence.

F6 is now the active queue. Planned order:

1. F6 validation and tracker sync. Done.
2. F6-T1/F6-T6 tenant-bound token/signing semantics. Done for token semantics; per-tenant signer isolation remains partial.
3. F6-T3/F6-T9 tenant API key cache hardening.
4. F6-T7/F6-T10 anonymous sentinel and fallback hardening.
5. F6-T5 bypass route tenant-context invariant.
6. F6-T2 RLS/data-path claim alignment or integration.
7. F6-T4 usage-meter shared-store claim boundary.
8. F6-T8 recipient/tenant runtime boundary bridge.
