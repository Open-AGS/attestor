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
| F5 signing layer redo | 21 | 5 | 3 | 13 |
| Final docs / claim alignment | 2 | 0 | 0 | 2 |

Estimated remaining work after this tracker lands: about 16 to 24 PR-sized or
validation-sized units. Several items overlap and may close together, but no
item is treated as closed until repository evidence proves it.

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

## F1 Threat-Model Foundation

Source report: project-owner supplied F1 cross-cutting threat model.

Validation record: `docs/audit/f1-threat-model-foundation-validation.md`.

| ID | Current status | Evidence / PR | Remaining action |
|---|---|---|---|
| F1-CC-1 agent-loop HA/shared-store bypass | `partial` | PR #220, PR #293 | Shared agent-loop guard path exists; broader replay/presentation/shared durability remains tracked elsewhere. |
| F1-CC-2 review-required auto-promote | `accepted-limitation` | PR #220; `customer-gate.ts`; downstream enforcement docs | Needs protected downstream wrapper/gateway adoption proof. Related to F2-AG-1. |
| F1-CC-3 cross-vector replay correlation | `backlog` | PR #220 validation | Needs common replay-event/correlation contract and selected shared durable consume paths. |
| F1-CC-4 data-minimization fan-out | `backlog` | PR #220 validation; data-minimization policy | Needs mandatory surface-level conformance across every declared output surface. |
| F1-CC-5 tenant boundary fan-out concrete route bug | `fixed` | PR #220 | Body tenant mismatch on generic admission route was remediated in the scoped slice. |
| F1-CC-6 cross-log integrity anchor | `backlog` | PR #220 validation | Needs cross-store/meta-anchor design if pursued. |

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

Current state: not remediated as a series. Each active item must be revalidated
against current `origin/master` before any fix. Prior worktree-F4 findings that
fresh main retired are listed separately to avoid duplicate work.

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
| F-5.2 parent-directory fsync / orphan sweep | `open` | `platform/file-store.ts` durability path | Add parent-directory fsync where supported and startup orphan-tmp sweep, or document platform-specific fallback with tests. |
| F-5.3 attestation validity window | `invalid-as-stated` | Fresh F5 redo: cert has `notBefore` / `notAfter` | No action unless fresh source inspection contradicts the redo. |
| F-5.4 revocation inputs | `invalid-as-stated` | Fresh F5 redo: cert and trust-chain verification accept revocation inputs | No action unless fresh source inspection contradicts the redo. |
| F-5.5 trust-chain clock skew | `invalid-as-stated` | Fresh F5 redo: cert and chain checks apply skew | No action unless fresh source inspection contradicts the redo. |
| F-5.6 anti-self-attest / PKI-bound verification | `fixed` | PR #291; `verification-trust-binding` | Keep as fixed; related third-party pin behavior tracked under F5-A1. |
| F-5.7 HA shared PKI / shared lock | `open` | Strict path opt-in exists; lock remains local/mkdir-style per report | Validate current lock path; implement durable shared lock or fail-closed production-shared local-PKI profile. |
| F5-A1 out-of-band trust root optional | `partial` | PR #291 gives trusted CA fingerprint path | Decide whether foreign-kit verification must require a CA pin, with explicit developer-mode bypass if kept. |
| F5-A2 legacy flat verify escape via env | `open` | `ATTESTOR_ALLOW_LEGACY=true` path in report | Remove env-only downgrade or add explicit telemetry/sunset gate. |
| F5-A3 truncated fingerprint width | `open` | 64-bit fingerprint report | Validate compatibility impact, then migrate to at least 128-bit or full SHA-256 fingerprint. |
| F5-A4 homegrown canonicalization / RFC 8785 interop | `open` | `sign.ts` canonicalizer report | Choose JCS adoption or explicitly document Attestor-specific canonicalization with tests. |
| F5-A5 non-atomic `saveKeyPair` | `open` | `keys.ts` direct writes report | Route key persistence through the atomic file-store helper or add equivalent fsync/temp-rename. |
| F5-A6 transparency log missing | `backlog` | No Rekor-equivalent claim | Keep out of current readiness claims; design internal witness/transparency log separately. |
| F5-A7 module-level CA singleton / injection point | `open` | `setKeylessCa` report | Move test injection out of production exports or add guard/logging/idempotence tests. |
| F5-A8 numeric canonicalization edge cases | `open` | Same root as F5-A4 | Reject non-finite numbers and pin signed payload numeric behavior. |
| F5-A9 verifier helper absent | `partial` | Fresh F5 redo says helper now exists | Close absence claim; keep consumer footgun risk under F5-A1. |
| F5-B1 crypto-authorization adapter trust delegation | `accepted-limitation` | Architecture states adapters supply observations | Document this as a trust boundary; do not claim chain-state verification without adapter proof. |
| F5-NEW-1 exported `setKeylessCa` runtime injection | `open` | Same root as F5-A7 | Include with F5-A7 implementation, not as a separate PR unless needed. |
| F5-NEW-2 strict PKI path enforcement opt-in | `open` | release-runtime strict path flag report | Make strict path implicit for production-shared profile or prove the current mode is safe. |
| F5-NEW-3 `allowLegacyUnbounded` escape hatch | `open` | certificate compatibility flag report | Add structured warning/telemetry and sunset documentation/tests. |
| F5-NEW-4 duplicate verify helper calls in CLI | `backlog` | Low-risk maintainability issue | Refactor only when touching `verify-cli.ts` for F5-A1/A2. |

## Final Docs And Claim Alignment

These run only after the active audit remediation queue is closed or explicitly
backlogged.

| ID | Current status | Remaining action |
|---|---|---|
| FINAL-1 README / public docs claim alignment | `needs-revalidation` | Ensure public language matches fixed/partial/backlog status. |
| FINAL-2 research provenance / remediation ledger sync | `needs-revalidation` | Link final fixed/backlog statuses into provenance docs without certification claims. |

## Next Work Queue

Do not start new reports until the existing queue is closed or intentionally
backlogged.

Recommended next order through F5:

1. F5-A1 require trusted CA pin or explicit developer-mode bypass.
2. F5-A2 remove or sunset legacy env downgrade.
3. F5-A3 fingerprint width migration.
4. F5-A4 / F5-A8 canonicalization and numeric payload behavior.
5. F-5.2 / F5-A5 file durability and key persistence atomicity.
6. F5-A7 / F5-NEW-1 keyless CA singleton and test-only injection.
7. F-5.7 / F5-NEW-2 HA shared PKI and production-shared local-PKI closure.
8. F5-NEW-3 legacy unbounded certificate telemetry and sunset.
9. F5-A6 transparency log design decision and claim boundary.
10. F5-B1 crypto-authorization trust-delegation documentation.
11. F1 backlog closure pass for replay correlation, fan-out, and cross-log integrity.
12. Final README/docs/provenance claim alignment.
