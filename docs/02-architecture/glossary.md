# Glossary

Use this when Attestor terms start to blur together.

This is a navigation reference, not a production-readiness claim. It defines how
terms are used inside this repository. It does not prove that every customer
workflow is already mediated by a non-bypassable enforcement point.

## Reading Rule

If two terms seem close, keep the authority boundary first:

```text
decision is not enforcement
evidence is not approval
proof is not certification
shadow is not production
pack is not product
```

## Core Terms

| Term | Means | Does Not Mean |
|---|---|---|
| AI action | A proposed structured action prepared by an AI system, agent, workflow, tool, or human-assisted automation. | A model response by itself. |
| Consequence | The real-world effect that would happen if the action reaches a downstream system. | A natural-language intent or plan. |
| Consequence admission | The Attestor decision step before a proposed consequence proceeds. | Downstream execution. |
| AI Action Control Plane | The product category: policy, evidence, authority, scope, replay, proof, review, and package boundaries for high-risk AI actions. | A production-readiness or compliance claim. |
| Structured action context | The typed facts Attestor can evaluate: actor, tenant, action, target, amount/scope, policy refs, evidence refs, approvals, replay, and downstream binding. | Raw prompt text. |
| Reason code | A short machine-readable reason for `review`, `narrow`, or `block`. | A legal finding or final incident root cause. |

## Decision Words

| Term | Means | Does Not Mean |
|---|---|---|
| `admit` | The proposed action may proceed as bounded by the decision and downstream contract. | "Looks good" or "safe forever." |
| `narrow` | Only a safer bounded version may proceed. | Silent mutation of the customer request. |
| `review` | The action must wait for human or operator review. | Automatic approval after a delay. |
| `block` | The action is rejected fail-closed. | A permanent ban on the actor or customer. |
| Hold | A non-final waiting state used by some flows before review, proof, or downstream evidence is complete. | Permission to execute. |

## Authority And Enforcement

| Term | Means | Does Not Mean |
|---|---|---|
| PDP | The decision surface that evaluates structured action context and returns an admission or release decision. | A model, a reviewer, or a downstream executor. |
| PEP | The enforcement point that carries out or refuses the decision before downstream execution. | The whole Attestor product. |
| Gateway | A customer or hosted integration point that can stop an action before it reaches a target system. | Proof that every bypass route is closed. |
| Verifier | Code that checks decision, proof, binding, replay, and target context before execution. | A policy author or signer by itself. |
| Adapter | The system-specific wrapper around a downstream action surface. | A separate product line. |
| Customer PEP / gate | The customer-side point where non-bypassability must be proven for a real workflow. | A repo-side fact or local test by itself. |
| Authority | A trusted permission source, approval, role, delegation, policy binding, or operator decision that can justify an action. | Untrusted content, model rationale, or a user-provided flag. |
| Approval provenance | Evidence of who approved, what they approved, when, under which scope, and whether it is still valid. | A free-text "approved" note. |

## Evidence, Proof, And Audit

| Term | Means | Does Not Mean |
|---|---|---|
| Evidence | Facts or references used to evaluate a proposed action. | Authority by default. |
| Evidence ref | A pointer or digest-safe reference to evidence. | Raw customer data. |
| Digest | A hash used to bind content without storing raw content. | Human-readable proof by itself. |
| Proof | Decision and evidence material that can be checked later. | External audit certification. |
| Audit proof | The bounded proof trail explaining why Attestor admitted, narrowed, reviewed, or blocked. | SOC 2, ISO, DORA, EU AI Act, or security certification. |
| Receipt | Evidence returned after presentation or downstream execution. | A guarantee that the downstream side effect was correct. |
| Tamper-evident history | A digest chain that detects modified, deleted, or reordered evidence entries. | A public transparency log or immutable external ledger. |

## Shadow, Policy, And Review

| Term | Means | Does Not Mean |
|---|---|---|
| Shadow mode | Observe what would have happened without blocking the downstream system. | Production enforcement. |
| Warn mode | Return warnings or review pressure while the customer still owns execution. | Non-bypassable control. |
| Review mode | Hold selected actions for human or operator review. | Automatic policy activation. |
| Enforce mode | A workflow where an actual PEP, gateway, verifier, or adapter refuses disallowed actions before execution. | A claim earned by the repository alone. |
| Policy | An active or candidate rule set with scope, evidence, authority, and rollout semantics. | Any business preference written in prose. |
| Policy candidate | A review-only suggestion derived from shadow evidence, simulation, or replay. | Active policy. |
| Policy Foundry | The review and discovery layer that turns observed action patterns into candidates, questions, and replay material. | A system that trains models or auto-enforces policy. |
| Reviewer queue | A bounded list of human-actionable items. | A raw event log. |

## Runtime And Readiness

| Term | Means | Does Not Mean |
|---|---|---|
| Repo-side evidence | Source, tests, docs, fixtures, CI, or merged code in this repository. | Live deployment proof. |
| Live proof | Captured evidence from a real deployment, customer PEP, operator workflow, provider, or infrastructure path. | Local green tests. |
| Deployment proof | Evidence that the runtime, secrets, storage, probes, observability, and rollback path exist in a real environment. | A Kubernetes manifest or script by itself. |
| Production-ready | Live environment, customer enforcement, probes, smoke tests, observability, rollback, and operator readiness are verified. | Evaluation release readiness. |
| Enterprise-ready | Production readiness plus customer/operator controls such as SSO/RBAC, contractual posture, support, retention, audits, and deployment model. | A large architecture surface. |
| Evaluation release | A repo-side release intended for technical evaluation with bounded claims. | Public production SaaS. |

## Packs And Surfaces

| Term | Means | Does Not Mean |
|---|---|---|
| Domain | The internal consequence category, such as `money-movement`, `data-disclosure`, or `programmable-money`. | A separate product. |
| Domain pack | Domain defaults, evidence shapes, policy templates, adapters, readiness signals, and replay examples over the shared core. | A separate decision engine. |
| Money Movement | Refunds, payouts, supplier payments, and other money-moving consequences. | Finance as a separate Attestor product. |
| Data Movement | Data exports, report releases, warehouse queries, and disclosure paths. | A data lake. |
| Authority Change | Grants, revocations, delegations, approvals, and access changes. | Identity provider ownership. |
| External Communication | Customer-facing, legal, billing, support, or outbound messages. | A messaging platform. |
| Operational Execution | Deploys, secret rotations, infrastructure changes, and other system actions. | A general workflow orchestrator. |
| Programmable Money | Wallet, Safe, account-abstraction, x402, custody callback, or solver-facing action plans. | A wallet, custodian, signer, broadcaster, or exchange. |

## Failure And Safety Words

| Term | Means | Does Not Mean |
|---|---|---|
| Guard | A runtime check that can add reason codes, review pressure, narrowing, or blocking. | A complete enforcement story by itself. |
| No-go condition | A condition that should stop or hold an action regardless of ordinary positive signals. | A soft warning. |
| Failure mode | A known way an AI-prepared action can go wrong. | A customer incident by itself. |
| Replay | Reuse of an action, presentation, token, proof, or idempotency path. | A harmless retry by default. |
| Data minimization | Keeping proof and telemetry on references, counts, statuses, digests, and reason codes. | Storing raw prompts or payloads for later analysis. |
| Redaction | Removing or replacing sensitive material before docs, proofs, logs, dashboards, or exports. | Permission to collect sensitive data first. |

## Do Not Collapse These

| Do Not Say | Say Instead |
|---|---|
| "The API enforces the action." | "The API returns an admission decision; enforcement needs a PEP/gate." |
| "The proof certifies compliance." | "The proof records repo-side or workflow evidence within a bounded claim." |
| "The crypto pack executes transactions." | "The crypto pack evaluates programmable-money action plans before customer-owned execution." |
| "Policy Foundry writes policy." | "Policy Foundry produces review-only candidates and questions." |
| "Shadow mode is production control." | "Shadow mode observes and simulates before enforcement is proven." |
| "A pack is a product." | "A pack is a domain extension over one engine." |

## Research Anchors

These sources shaped the boundaries above. They are anchors for terminology, not
claims that Attestor implements or complies with each framework.

- [NIST CSRC policy enforcement point glossary](https://csrc.nist.gov/glossary/term/policy_enforcement_point) keeps PEP language tied to enforcement of authorization decisions.
- [NIST SP 800-207 Zero Trust Architecture](https://www.nist.gov/publications/zero-trust-architecture) separates policy decision and enforcement concerns around enterprise resources.
- [OWASP Agentic AI threats and mitigations](https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/) frames agentic AI as autonomous systems with expanded capabilities and risks.
- [Diataxis reference guidance](https://diataxis.fr/reference/) supports this file staying concise, structured, and reference-oriented.

