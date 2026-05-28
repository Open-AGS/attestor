# Reason Codes

Use this page when an Attestor decision says `review`, `narrow`, or `block`
and you need to answer one question fast:

```text
Why did this action not simply proceed?
```

This is a support reference, not a certification and not a production-readiness
claim. It explains public, stable-enough reason codes that appear in admission,
review, proof, and support surfaces.

## Five-second triage

| Code shape | Usually means | Safe next step |
|---|---|---|
| `*-missing` | Required policy, evidence, authority, approval, context, or scope was absent. | Add the missing bound reference. Do not retry with free text. |
| `*-untrusted-*` | The source exists but cannot act as authority or evidence. | Bind a trusted source, approval workflow, verifier, or operator record. |
| `*-mismatch` | The submitted value differs from the bound policy, tenant, recipient, tool, wallet, or verifier context. | Recreate the action against the current bound context. |
| `*-expired` or `stale-*` | Approval, policy, token, authority, or verifier context is too old. | Refresh from the source of truth and issue a new admission. |
| `*-out-of-scope` or `*-exceeds-*` | The action asks for more than the approved boundary allows. | Narrow the action or obtain a wider approval. |
| `*-block` | The guard failed closed. | Stop. Fix the named cause before creating a new action. |
| `*-review` | The action needs a human or operator decision. | Send the review packet with reason codes and evidence refs. |
| `retry-*` or `*-replay-*` | Replay, duplicate, or retry safety is not satisfied. | Use the original idempotency key or create a fresh bounded request. |
| `tenant-*` | Tenant boundary did not hold. | Treat as a boundary failure. Do not expose foreign tenant details. |

## Decisions

| Decision | Support meaning |
|---|---|
| `admit` | The proposed action can proceed under the returned constraints and proof. |
| `narrow` | Only the safer bounded version can proceed. Read the constraint fields. |
| `review` | The action must wait for a reviewer, operator, or policy owner. |
| `block` | The action is rejected fail-closed. Do not treat it as advisory success. |

Attestor never uses a reason code to grant authority. A code explains why a
decision was reached; it does not replace policy, approval, evidence, or a
customer enforcement point.

## Common admission codes

### Basic structure

| Code | Meaning | What to check |
|---|---|---|
| `policy-ref-missing` | The action did not name the policy it is asking to run under. | Add a policy reference from the customer policy source of truth. |
| `evidence-ref-missing` | No evidence reference was supplied. | Add evidence refs, not raw evidence bodies. |
| `authority-mode-missing` | Authority-change action is missing the authority mode. | Bind the grant, revoke, unlock, approval, or delegation mode. |
| `amount-scope-missing` | Money or programmable-money action lacks amount scope. | Bind amount and currency before review or execution. |
| `recipient-scope-missing` | Money, data, or communication action lacks recipient scope. | Bind recipient/customer/account target. |
| `data-scope-missing` | Data movement action lacks data scope. | Bind dataset, report, export, or data-class scope. |
| `adapter-readiness-origin-untrusted` | Readiness was asserted by an untrusted caller-controlled field. | Use operator, customer gateway, Attestor runtime, or trusted adapter evidence. |
| `custom-domain-review-required` | The domain is custom and needs explicit review. | Add a domain pack or policy contract before enforcement. |

### Authority and approval

| Code | Meaning | What to check |
|---|---|---|
| `untrusted-content-authority-source` | Email, prompt text, ticket text, tool output, or model summary tried to act as authority. | Bind a trusted authority source instead. |
| `authority-block` | The authority guard failed closed. | Remove content-as-authority and provide verified authority evidence. |
| `approval-source-untrusted` | The approval came from a source that cannot approve this action. | Use an approval workflow, reviewer queue, IdP, or policy owner source. |
| `approval-block` | Approval provenance failed closed. | Re-issue approval through a trusted approval path. |
| `approval-missing` | Approval-backed authority was expected but absent. | Add approval ref, reviewer ref, digest, scope, and validity window. |
| `approval-expired` | Approval validity window no longer covers this action. | Refresh the approval and re-run admission. |
| `approval-scope-mismatch` | Approval scope does not match the requested action. | Narrow the action or request a new scoped approval. |
| `trust-class-override-rejected` | Caller tried to promote an untrusted source into a trusted class. | Remove the override; source trust must come from the trusted system. |

### No-go conditions

| Code | Meaning | What to check |
|---|---|---|
| `active-no-go-condition-present` | A fraud, legal, compliance, security, privacy, or policy hold is active. | Resolve the hold in the source system first. |
| `natural-language-bypass-attempted` | The action text tried to explain around a no-go condition. | Treat the explanation as non-authority. The hold still wins. |
| `no-go-condition-block` | No-go ledger failed closed. | Do not retry until the hold owner clears or narrows the condition. |

### Scope

| Code | Meaning | What to check |
|---|---|---|
| `amount-exceeds-approved-scope` | Requested amount is above approved scope. | Lower the amount or obtain wider approval. |
| `recipient-out-of-scope` | Requested recipient is not approved. | Use an approved recipient or request a new approval. |
| `record-count-exceeds-approved-scope` | Requested batch size is too large. | Split or narrow the request. |
| `operation-out-of-scope` | Requested operation is not approved. | Use an approved operation type. |
| `data-class-out-of-scope` | Requested data class is not approved. | Narrow the data class or obtain explicit approval. |
| `tenant-out-of-scope` | Requested tenant does not match the approved tenant boundary. | Stop and investigate tenant context. |
| `irreversible-action-not-approved` | The action is too irreversible for the supplied approval. | Add explicit approval or use a reversible path. |

### Tool and supply-chain evidence

| Code | Meaning | What to check |
|---|---|---|
| `tool-result-untrusted-source` | A tool result came from an untrusted source. | Bind source class, timestamp, integrity digest, and evidence class. |
| `tool-result-authority-or-instruction` | A tool result attempted to become authority or instruction. | Use it as evidence only after validation, never as authority. |
| `tool-result-block` | Tool-result poisoning guard failed closed. | Re-fetch through a trusted tool path or remove the tool result. |
| `supply-chain-critical-component-block` | Critical agent/tool/adapter component is unsafe or unreviewed. | Pin, review, and prove the component before use. |
| `supply-chain-permission-overbroad` | Component asks for more permission than allowed. | Reduce declared permissions or widen policy after review. |
| `generated-artifact-unreviewed` | Generated adapter/artifact lacks review. | Review and bind the artifact before trusting it. |

### Human review

| Code | Meaning | What to check |
|---|---|---|
| `raw-payload-stored` | Review or proof material would retain raw payload. | Replace raw material with references, digests, counts, and redacted summaries. |
| `auto-enforce-requested` | A review-only or shadow path attempted to auto-enforce. | Keep the action in review/shadow until a trusted enforcement path exists. |
| `review-packet-no-go-summary-missing` | Review packet does not surface no-go state clearly. | Put no-go state first in the packet. |
| `review-packet-next-safe-step-missing` | Reviewer does not have a safe next step. | Add the next bounded action: approve, narrow, reject, or request evidence. |

### Delegation and context drift

| Code | Meaning | What to check |
|---|---|---|
| `delegation-scope-unapproved` | Delegated scope differs from approved delegated scope. | Bind the delegated scope digest or narrow the chain. |
| `delegation-actor-self-approved` | The same actor delegated and approved its own action. | Separate requester, executor, and approver authority. |
| `delegation-cycle-detected` | The agent chain loops back on itself. | Rebuild the principal chain. |
| `current-context-missing` | Current runtime/model/tool/policy context was required but absent. | Supply current context digests from the runtime owner. |
| `decision-context-block` | Decision-context guard failed closed. | Refresh context and re-run admission. |
| `model-version-drift` | Current model differs from the bound model. | Re-simulate or re-approve under the current model. |
| `tool-schema-drift` | Current tool schema differs from the bound schema. | Rebind tool schema and rerun checks. |
| `policy-version-mismatch` | Submitted policy version is not current. | Use the current policy bundle/version. |
| `policy-updated-after-approval` | Policy changed after approval was issued. | Re-approve under the current policy. |
| `stale-policy-block` | Stale authority/policy guard failed closed. | Refresh policy and approval from source of truth. |
| `simulation-refresh-required` | A new simulation is required before this decision can proceed. | Re-run simulation with current context. |

### Authority creep

| Code | Meaning | What to check |
|---|---|---|
| `authority-creep-finding:policy-activation-requested` | Runtime admission attempted to activate or mutate policy authority. | Move policy activation to the policy-control plane. |
| `authority-creep-finding:authority-action-requested` | Runtime admission attempted to grant or expand authority. | Use the explicit authority-change path and approval flow. |
| `authority-creep-outcome:authority-creep-rejected-boundary` | Authority creep guard rejected a boundary crossing. | Keep admission as an admission decision only. |

### Runtime boundary, retry, and tenant safety

| Code | Meaning | What to check |
|---|---|---|
| `agent-loop-attempt-budget-exhausted` | Retry/correction loop exceeded allowed attempts. | Stop the loop and route to review. |
| `agent-loop-abuse-guard-unavailable` | Loop guard could not evaluate safely. | Treat as fail-closed until guard storage/runtime recovers. |
| `tenant-scope-mismatch` | Body tenant and route tenant disagree. | Stop and investigate request origin. |
| `plan-mode-restricted` | Tenant plan does not allow the requested mode. | Use an allowed mode or change entitlement through billing/admin flow. |
| `protected-release-token-sender-confirmation-required` | High-risk protected release token needs sender confirmation. | Supply DPoP or configured sender confirmation proof. |
| `retry-attempt-bound` | Retry attempt was bound to a previous admission. | Keep the retry within its attempt budget and idempotency boundary. |

### Programmable money and crypto packs

These are package-boundary and customer-adapter codes. Attestor is not a
wallet, custodian, signer, broadcaster, bundler, or exchange.

| Code | Meaning | What to check |
|---|---|---|
| `admission-plan-denied` | Crypto admission plan already denied the handoff. | Fix the denied plan reason before wallet/custody/Safe work. |
| `x402-network-mismatch` | Payment network does not match the admitted plan. | Recreate x402 payment with the admitted network. |
| `x402-payer-mismatch` | Payer differs from the admitted payer. | Bind the intended payer. |
| `x402-payto-mismatch` | Payment recipient differs from the admitted recipient. | Bind the intended recipient. |
| `x402-amount-mismatch` | Payment amount differs from admission. | Recreate the payment with admitted amount. |
| `x402-facilitator-kind-unsupported` | Facilitator did not advertise support for the required payment kind. | Use a supported facilitator path. |
| `safe-chain-mismatch` | Safe transaction chain differs from admission. | Recreate or re-approve under the correct chain. |
| `safe-account-mismatch` | Safe account differs from admission. | Use the admitted Safe account. |
| `safe-guard-not-enabled-on-safe` | Safe guard is not installed/enabled. | Install and prove the guard before relying on it. |
| `safe-guard-post-execution-failed` | Post-execution guard reported failure. | Treat settlement/execution as not proven. |

## What this page does not prove

- It does not prove live customer PEP no-bypass.
- It does not prove external KMS/HSM signing.
- It does not prove shared replay/introspection stores.
- It does not prove wallet, custody, Safe, x402, settlement, or chain-state truth.
- It does not certify compliance.

## Sources for the support shape

- [RFC 9457: Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457) keeps API errors machine-readable and warns against exposing implementation internals.
- [Stripe API errors](https://docs.stripe.com/api/errors) and [Stripe error codes](https://docs.stripe.com/error-codes) use short error codes, human-readable messages, and documentation links for support triage.
- [Google AIP-193 Errors](https://cloud.google.com/apis/design/errors) recommends brief, actionable messages and stable machine-readable reasons.
