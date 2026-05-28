# Failure Modes And Controls

Use this page when a reviewer, operator, or customer engineer asks:

```text
What went wrong, which control caught it, and what should I do next?
```

This is a public support reference. The source of truth is the shared failure
mode registry and control-binding contract in:

- `src/consequence-admission/failure-mode-registry.ts`
- `src/consequence-admission/failure-mode-control-bindings.ts`

It does not activate enforcement, grant authority, prove production readiness,
or certify a customer deployment.

## Fast map

| Failure mode | Usually shows up as | Control that should catch it | Default action |
|---|---|---|---|
| `direct-prompt-injection` | User text tries to override policy or admission behavior. | Prompt-injection signal review, structured action extraction, customer review boundary. | `review` |
| `indirect-prompt-injection` | Email, document, website, plugin, or tool content tries to instruct the agent. | Untrusted-content isolation, tool-boundary monitoring, trusted source classification. | `block` |
| `untrusted-content-authorizes-action` | A ticket, email, tool result, or model summary says "approved". | Untrusted content authority guard and approval provenance guard. | `block` |
| `tool-misuse-excessive-agency` | A valid tool is used with unsafe scope, credentials, or arguments. | Tool scope manifest, adapter readiness record, downstream side-effect inventory. | `block` |
| `tool-result-poisoning` | Tool output becomes evidence or authority without trust metadata. | Tool-result poisoning guard. | `review` |
| `sensitive-data-disclosure` | Raw prompts, payloads, customer identifiers, payment data, wallet material, or secrets would leak. | Data minimization and redaction policy. | `block` |
| `cross-tenant-leakage` | A proof, dashboard, review packet, or route touches another tenant's record. | Tenant-bound record checks and fail-closed foreign-record rejection. | `block` |
| `wrong-recipient-disclosure` | Message, export, payment, or review target is outside approved recipient scope. | Recipient scope binding and recipient-boundary checks. | `block` |
| `fake-approval-laundering` | Chat, email, ticket comment, model summary, or tool output is treated as approval. | Approval provenance guard. | `block` |
| `stale-authority-or-policy` | Old approval, old policy, stale token, or stale context is reused. | Stale authority/policy guard and decision-context binding. | `block` |
| `no-go-hold-bypass` | Fraud/legal/compliance/security hold is bypassed with natural language. | No-go condition ledger. | `block` |
| `scope-explosion` | Request grows from narrow to broad: amount, batch size, recipient, tenant, operation, or data class. | Scope-explosion guard and narrowing constraints. | `narrow` |
| `duplicate-execution-replay` | Same admitted action, token, presentation, refund, payment, or webhook is replayed. | Replay ledger and idempotency boundary. | `block` |
| `review-required-auto-promote` | Integration treats review/hold as success and proceeds anyway. | Customer gate contract: only `admit` or accepted `narrow` may proceed. | `block` |
| `human-review-fatigue` | Review packet is too noisy, long, misleading, or poorly prioritized. | Human review fatigue guard. | `review` |
| `model-tool-config-drift` | Decision proof no longer matches model, tool schema, policy, config, prompt, verifier, or simulation. | Decision-context drift binding. | `review` |
| `multi-agent-delegation-confusion` | One agent delegates through another without clear identity, authority, scope, or reviewer separation. | Multi-agent delegation guard. | `review` |
| `hidden-downstream-side-effect` | Local action hides irreversible, financial, legal, operational, or external effects. | Downstream side-effect declaration and execution receipt contracts. | `review` |
| `unsupported-confidence-or-hallucinated-evidence` | A model or packet claims proof/confidence without source-system evidence. | Evidence refs, proof digests, and source-system verification requirement. | `review` |
| `agentic-supply-chain-compromise` | Plugin, connector, package, MCP server, workflow, generated adapter, or pack has unsafe provenance or permissions. | Agentic supply-chain guard. | `block` |

## What to do by decision

| Decision | Operator posture | Customer next step |
|---|---|---|
| `block` | Stop the action. Do not retry blindly. | Fix the named cause, then create a fresh admission. |
| `narrow` | Only the returned bounded action can proceed. | Apply the narrowed amount, recipient, record count, operation, data class, tenant, or environment. |
| `review` | A human or operator must decide. | Send reason codes, evidence refs, no-go state, and next safe step to the reviewer. |
| `admit` | Action may proceed only through the configured customer PEP/gate. | Keep the proof reference and downstream receipt. |

## Guard-to-failure map

| Guard or contract | Main failure modes | Public reason-code families |
|---|---|---|
| Untrusted content authority guard | `indirect-prompt-injection`, `untrusted-content-authorizes-action` | `untrusted-content-*`, `authority-*`, `trust-class-*` |
| Approval provenance guard | `fake-approval-laundering`, `review-required-auto-promote` | `approval-*` |
| No-go condition ledger | `no-go-hold-bypass` | `active-no-go-*`, `natural-language-bypass-*`, `no-go-*` |
| Scope-explosion guard | `scope-explosion`, `wrong-recipient-disclosure` | `*-out-of-scope`, `*-exceeds-approved-scope` |
| Tool-result poisoning guard | `tool-result-poisoning`, `indirect-prompt-injection` | `tool-result-*` |
| Agentic supply-chain guard | `agentic-supply-chain-compromise`, `tool-misuse-excessive-agency` | `supply-chain-*`, `generated-artifact-*` |
| Human review fatigue guard | `human-review-fatigue`, `unsupported-confidence-or-hallucinated-evidence` | `review-packet-*`, `raw-payload-stored`, `auto-enforce-requested` |
| Multi-agent delegation guard | `multi-agent-delegation-confusion`, `fake-approval-laundering` | `delegation-*` |
| Stale authority/policy guard | `stale-authority-or-policy`, `model-tool-config-drift` | `stale-*`, `policy-*`, `approval-expired` |
| Decision-context drift binding | `model-tool-config-drift` | `current-context-*`, `decision-context-*`, `*-drift`, `simulation-refresh-*` |
| Authority-creep guard | `review-required-auto-promote`, `untrusted-content-authorizes-action` | `authority-creep-*` |
| Agent-loop abuse guard | `duplicate-execution-replay`, `tool-misuse-excessive-agency` | `agent-loop-*`, `retry-*` |
| Customer gate / PEP contract | `review-required-auto-promote`, `duplicate-execution-replay` | `protected-release-token-*`, `sender-confirmation-*`, `replay-*` |
| Data minimization policy | `sensitive-data-disclosure`, `cross-tenant-leakage` | `raw-*`, `redaction-*`, `forbidden-raw-*` |

## Control invariants

These invariant IDs are maintainer-facing names. Support should translate them
into the plain failure rows above, but the IDs are stable enough to search.

| Invariant ID | Plain meaning |
|---|---|
| `untrusted-content-cannot-authorize-action` | Content can inform review, but it cannot grant authority. |
| `trusted-evidence-required` | Evidence must identify source, timestamp, integrity, and allowed evidence class. |
| `verified-approval-provenance-required` | Approval must come from a verified reviewer, workflow, or policy authority. |
| `scope-cannot-exceed-approved-boundary` | Requested scope cannot exceed approved amount, recipient, tenant, data, operation, or environment. |
| `tenant-and-recipient-boundaries-must-hold` | Tenant and recipient boundaries must be explicit. |
| `review-or-block-cannot-auto-promote` | Review, hold, or block cannot be treated as success downstream. |
| `no-go-hold-overrides-natural-language` | Holds override explanations and model rationale. |
| `replay-and-idempotency-required-before-execution` | Consequential actions need replay and idempotency safety before execution. |
| `decision-context-version-must-be-bound` | Decision proof must bind model, tool, policy, config, prompt, verifier, and simulation context where supplied. |
| `downstream-side-effects-must-be-declared` | Irreversible or external side effects must be represented in the proposed action. |
| `least-privilege-tooling-and-supply-chain-review` | Tools, connectors, generated artifacts, and packs need least-privilege review. |
| `human-review-packet-must-highlight-risk` | Review packets must surface no-go state, missing evidence, and safe next steps. |
| `sensitive-data-minimization-required` | Proof, review, dashboard, telemetry, and export surfaces must minimize raw sensitive data. |

## Support questions

### "Why was this blocked?"

Look at the first `*-block` reason code and the highest-risk guard outcome.
Then check the matching row above. A block means the safest answer is to stop,
fix the input or authority source, and create a new admission.

### "Why review instead of block?"

Review usually means the action may be legitimate but the proof is incomplete:
missing evidence, stale context, unclear authority, reviewer packet risk, or
unsupported confidence. Review is not permission to execute.

### "Why narrow?"

Narrow means the broad request is not safe, but a smaller bounded action may be.
The customer PEP/gate must enforce the returned constraints before downstream
execution.

### "Can the model explain why it should proceed?"

No. Model rationale is not authority. It can be review material, but it cannot
reduce evidence, policy, approval, scope, replay, or enforcement requirements.

### "Can this page close live proof?"

No. These docs explain repo-side reason and failure contracts. Live customer
Live customer PEP no-bypass, KMS/HSM signing, shared replay stores,
wallet/custody/settlement truth, and production readiness still need deployment
evidence.

## Source-backed support pattern

The shape follows existing API-support practice:

- RFC 9457 problem details: machine-readable error detail with careful security boundaries.
- Stripe API errors: short programmatic error code plus human explanation and doc link.
- Google AIP-193: brief, actionable messages and stable machine-readable reason identifiers.
