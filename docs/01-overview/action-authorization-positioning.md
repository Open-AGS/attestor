# AI Action Control Plane Positioning

Use this page as the short positioning source for Attestor's current product
category. The filename remains for compatibility with older links, but the
canonical category is now **AI Action Control Plane**.

For the full naming and non-claim boundary, use
[Attestor language contract](../02-architecture/attestor-language-contract.md).

## Category

AI Action Control Plane is the product category.

Attestor should be described externally as:

```text
AI Action Control Plane
```

Canonical sentence:

```text
Attestor decides whether a proposed AI action can become a real business consequence.
```

This is stronger than using `gateway` or `authorization layer` as the primary
category. A gateway, verifier, or adapter is the enforcement point. Authorization
is one of the checks. The product category needs to cover policy, authority,
evidence, scope, freshness, no-go state, replay, idempotency, audit proof,
Policy Foundry, hosted review, and consequence packs.

The buyer-level explanation is:

```text
AI wants to act.
The action needs policy, authority, evidence, scope, replay safety, and audit proof.
Attestor is the control plane before the action reaches the real system.
```

## Operating Model

The operating model is consequence admission:

```text
AI proposes -> Attestor admits / narrows / reviews / blocks -> allowed consequences proceed -> proof remains
```

The word `consequence` matters because not every tool call deserves the same
treatment. Reading a harmless local document is not the same as issuing a
refund, exporting customer data, changing an entitlement, sending a regulated
notice, deploying infrastructure, or preparing a wallet transaction.

Attestor should focus on high-risk actions by consequence class:

- Money Movement
- Data Movement
- Authority Change
- External Communication
- Operational Execution
- Programmable Money

This is the pack language. A pack does not say which industry the customer is
in; it says what real consequence the AI action is trying to create. Finance and
crypto remain proof wedges and adapter families underneath that map, not the
top-level product categories.

## What Authorization Means Here

Authorization remains valid inside Attestor, but it is not the whole product category.

Use authorization language for:

- customer authority checks
- reviewer approval provenance
- downstream verifier allow/hold logic
- policy-bound action permission
- enforcement adapter decisions

Do not use authorization language to erase:

- evidence requirements
- approved scope
- tenant and recipient boundaries
- freshness and policy-version checks
- no-go conditions such as legal, fraud, compliance, or security holds
- replay and idempotency safety
- audit proof

## Adoption Wedge

The strongest adoption path is shadow mode.

Do not describe this as automatic learning or autonomous policy creation. In
enterprise and security settings, that suggests Attestor silently learns what is
correct and starts making decisions on its own.

Use this path instead:

```text
observe -> recommend -> simulate -> approve -> enforce -> prove
```

The intended product motion is:

```text
Attestor observes proposed AI actions, identifies policy gaps, simulates candidate impact, and lets humans approve before enforcement.
```

Shadow mode should make the work easier for customers by showing policy gaps,
not just logs:

- which high-risk AI action surfaces exist
- which actions have no policy
- which downstream tools carry too much authority
- where permissions are broader than the observed task needs
- where human approval happened but no enforceable rule exists
- where Attestor would disagree with the human outcome
- where a proposed policy would create too many false positives

The first useful shadow output should be an action risk inventory:

```text
Detected high-risk AI action surfaces:
- refund-service.issueRefund
- snowflake.runQuery
- crm.exportCustomerData
- admin.grantRole
- github.deployProduction
- wallet.submitTransaction
```

The README should expose this adoption path near the top. The first impression
should not make teams think they must start by blocking production workflows.
The stronger message is:

```text
Start in shadow mode. See what your AI agents would have done before you let them act.
```

Current implementation note: `POST /api/v1/admissions` already has the first mode ladder: `observe`, `warn`, `review`, and `enforce`. Recommendation, simulation, summary, and dashboard surfaces should build on that ladder without claiming autonomous policy learning.

## Safe Retry Loop

The control plane should be strict without becoming a dead end. When an AI
action is incomplete, Attestor should return enough structured feedback for a
safe retry, without leaking customer data, raw policy material, wallet details,
bank details, credentials, or internal thresholds.

The product shape is:

```text
AI proposes -> Attestor evaluates -> Attestor returns safe feedback -> AI may retry within bounds -> proof remains
```

The first implemented layer is the admission feedback contract. It adds
model-safe `feedback` and `retry` fields to admission responses:

- `feedback.reasonCodes`
- `feedback.missingFields`
- `feedback.requiredEvidenceKinds`
- `feedback.operatorOnlyReasonCodes`
- `feedback.safeInstruction`
- `retry.retryAllowed`
- `retry.retryCategory`
- `retry.maxAttempts`
- `retry.requiresChangedRequest`
- `retry.sameRequestReplayAllowed`
- `retry.retryBindingRequired`
- `retry.retryBindingFields`

The retry attempt ledger records a bounded continuation of the held admission,
not a new probe. Duplicate retry attempts return the existing record.
Conflicting idempotency keys, mismatched budget material, and exhausted ledger
capacity hold fail-closed.

The fourth layer is retry attempt ledger: it records bounded retry attempts as
idempotent continuation evidence after admission feedback, retry budget, and
retry binding have already constrained the correction path.

This does not mean the model can keep probing until it gets an admit. Unsafe
signals, policy blocks, adapter readiness gaps, custom-domain review, replay
failures, and human rejection must route to customer review or operator control.

Use this language:

```text
Attestor returns bounded correction feedback so agents can retry safely without learning sensitive data or bypassing policy.
```

Avoid:

```text
Attestor teaches the model how to get approved.
```

## Wording Rules

Use as primary:

- AI Action Control Plane
- consequence admission
- proof before consequence
- admit, narrow, review, block

Use as component language:

- authorization check
- authority check
- enforcement gateway
- verifier
- adapter
- PEP / PDP / PIP / PAP

Avoid leading with:

- AI governance platform
- prompt guardrail
- generic gateway
- authorization layer as the product category
- proof engine
- agent workspace
- wallet, custody, or payment processor

Attestor is not claiming to know the customer's business rules better than the
customer. The stronger claim is:

```text
Attestor checks that high-risk AI actions meet the customer's policy, authority, evidence, scope, replay, and downstream verification requirements before they execute.
```

For shadow-first language, say:

```text
Start in shadow mode. See what your AI agents would have done before you let them act.
```

Avoid:

```text
Attestor learns your company rules and automatically enforces them.
```

## Research Basis

- [OWASP LLM06:2025 Excessive Agency](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/) describes the risk of LLM systems calling functions or interfaces that can perform damaging actions, and recommends complete mediation through downstream authorization.
- [OpenAI Agents SDK tools](https://openai.github.io/openai-agents-js/guides/tools/) expose capabilities that let agents take actions, including API calls, code execution, shell-like execution paths, and computer use.
- [Model Context Protocol tools](https://modelcontextprotocol.io/specification/draft/server/tools) are model-controlled and can be discovered and invoked by language models.
- [NIST AI RMF](https://www.nist.gov/itl/ai-risk-management-framework) frames AI risk management across the design, development, use, and evaluation of AI systems.
- [Kubernetes admission controllers](https://kubernetes.io/docs/reference/access-authn-authz/admission-controllers/) provide the closest infrastructure analogy: interception before persistent state or downstream mutation.
- [Open Policy Agent](https://www.openpolicyagent.org/docs/latest) supports the separation between structured policy decision and application enforcement.
