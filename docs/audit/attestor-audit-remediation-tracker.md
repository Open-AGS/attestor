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

| Group | Total tracked | Fixed | Partial / limitation / backlog | Needs revalidation / open |
|---|---:|---:|---:|---:|
| F1 threat-model foundation | 6 | 1 | 5 | 0 |
| F2 agentic consequence surface | 10 | 1 | 1 | 8 |
| F3 cross-cutting guard readiness | 10 | 10 | 0 | 0 |
| F4 OWASP LLM / input surface | 4 | 0 | 0 | 4 |
| F5 signing layer | 12 | 5 | 7 | 0 |
| Final docs / claim alignment | 2 | 0 | 0 | 2 |

Estimated remaining work after this tracker lands: about 26 PR-sized or
validation-sized units. Some will close as `invalid-as-stated`, `superseded`, or
`accepted-limitation` after fresh inspection.

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
| F2-AG-1 customer-gate honor-system | `needs-revalidation` | release-enforcement plane and downstream contract exist; generic consequence path still needs review | Validate current generic path and decide whether admission-token / verifier-helper hardening is still needed. |
| F2-AG-2 agent-payment settlement post-condition | `needs-revalidation` | `crypto-authorization-core/x402-agentic-payment-adapter.ts`; downstream receipt | Validate whether settlement evidence is operator-asserted or verifier-bound; likely needs facilitator-attestation contract. |
| F2-AG-3 account-delegation / EIP-7702 scope | `needs-revalidation` | crypto authorization adapters and replay freshness rules | Validate scope/window/nonce binding before creating a delegation-scope guard. |
| F2-AG-4 multi-agent delegation confusion | `fixed` | PR #300; `multi-agent-delegation-guard.ts` | No further action for this scoped guard. Live inter-agent transport auth remains not proven. |
| F2-AG-5 hidden downstream side effects / receipt omission | `needs-revalidation` | downstream enforcement contract and execution receipt exist | Validate whether receipt-deadline escalation exists; likely follow-up. |
| F2-AG-6 unsupported confidence / hallucinated evidence | `needs-revalidation` | audit evidence export and external review packet exist | Validate whether source-system rehash/refetch exists before adding a dedicated guard. |
| F2-AG-7 agentic supply-chain and LLM provider dependency | `partial` | PR #297 adds `agentic-supply-chain-guard` | Revalidate separate single-provider/OpenAI dependency claim; do not conflate with adapter supply-chain guard. |
| F2-AG-8 multimodal vision input future risk | `needs-revalidation` | `src/api/openai.ts` and callers | Confirm exposure path; likely backlog if still CLI-only. |
| F2-AG-9 free-text narrow constraints | `needs-revalidation` | downstream constraint acknowledgement exists | Validate whether constraint kind registry exists; likely contract hardening. |
| F2-AG-10 model/tool/config drift | `needs-revalidation` | `decision-context-drift-binding.ts`; coverage matrix says deterministic contract | Decide whether dedicated guard is still needed or current binding is sufficient. |

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

Source report: project-owner supplied F4 redo.

Current state: not remediated as a series. Each item must be revalidated against
current `origin/master` before any fix.

| ID | Current status | Remaining action |
|---|---|---|
| F4-A prompt/free-text input hygiene | `needs-revalidation` | Re-check generic admission schema, prompt marker handling, and review-packet exposure. |
| F4-B / F4-C error-message disclosure and admission-problem redaction | `needs-revalidation` | Re-check route error handling and data-minimization surface enforcement. |
| F4-D Attestor-owned OpenAI usage / budget / prompt leakage scope | `needs-revalidation` | Audit `src/api/openai.ts` callers, provider usage, budget gates, and logging. |
| F4 taxonomy correction | `needs-revalidation` | Ensure docs/ledger use verified OWASP LLM 2025 names and do not overclaim compliance evidence. |

## F5 Signing Layer

Source report: project-owner supplied F5 signing-layer audit plus fresh validation
in `docs/audit/f5-signing-layer-validation.md`.

| ID | Current status | Evidence / PR | Remaining action |
|---|---|---|---|
| F-5.1 leaf validity rounding | `invalid-as-stated` | F5 validation doc | Current code uses duration-based leaf validity. |
| F-5.3 attestation validity window | `invalid-as-stated` | F5 validation doc | Current cert includes and verifies `notBefore` / `notAfter`. |
| F-5.4 revocation inputs | `invalid-as-stated` | F5 validation doc | Current verification accepts revoked certificate IDs/fingerprints. |
| F-5.5 trust-chain clock skew | `invalid-as-stated` | F5 validation doc | Current trust-chain verification has clock skew. |
| F-5.6 PKI-bound overall verification | `fixed` | PR #291 | Helper/CLI/API use PKI-bound verification semantics. |
| F-5.2 parent-directory fsync / orphan sweep | `accepted-limitation` | F5 validation doc | Backlog durability hardening. |
| F-5.7 HA shared PKI / KMS | `accepted-limitation` | F5 validation doc | External KMS/HSM remains not implemented and must fail closed. |
| F5-A1 out-of-band trust root | `partial` | PR #291 | Pinned CA fingerprint path exists; independent trust-root distribution is still customer/operator responsibility. |
| F5-A2 legacy flat verify escape | `accepted-limitation` | F5 validation doc | Backlog: removal/sunset or stronger warning gate. |
| F5-A3 fingerprint width | `accepted-limitation` | F5 validation doc | Backlog compatibility-affecting identity migration. |
| F5-A4 canonicalization / RFC 8785 interop | `accepted-limitation` | F5 validation doc | Backlog or document Attestor-specific canonicalization more explicitly. |
| F5-A6 transparency log missing | `accepted-limitation` | F5 validation doc | No Rekor-equivalent claim; future witness/transparency work only. |

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

Recommended next order:

1. F2-AG-1 customer-gate honor-system revalidation.
2. F2-AG-2 agent-payment settlement post-condition revalidation.
3. F2-AG-3 account-delegation / EIP-7702 scope revalidation.
4. F2-AG-5 hidden downstream side-effect receipt-deadline revalidation.
5. F2-AG-6 hallucinated evidence / unsupported confidence revalidation.
6. F2-AG-9 constraint registry revalidation.
7. F2-AG-10 model/tool/config drift dedicated-guard decision.
8. F1 backlog closure pass.
9. F4 redo remediation pass.
10. F5 accepted-limitation/backlog pass.
11. Final docs/README/claim alignment.
