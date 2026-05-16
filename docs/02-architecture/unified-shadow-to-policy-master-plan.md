# Unified Shadow-To-Policy Master Plan

Status: saved repository-side master list after Attestor unlock step 07. This
is a planning and sequencing artifact, not a production readiness claim and not
a new product split.

## Decision

Attestor stays one control engine:

```text
proposed consequence
  -> action surface
  -> evidence requirements
  -> policy candidate
  -> replay and counterexample testing
  -> review packet
  -> human approval
  -> scoped enforcement
  -> receipt
```

Finance, crypto, CRM/support, ITSM/workflow, data/IAM, procurement/spend, and
health/insurance are domain adapters into the same engine. They must not become
separate Attestor products.

The new north star is:

```text
Unified Shadow-to-Policy Engine
```

The engine observes AI-proposed actions in shadow mode, builds evidence-backed
policy candidates, tests them against replay and counterexamples, asks the
smallest useful human questions, then packages the result for approval. It does
not silently activate enforcement.

## What We Are Building

Attestor should become a universal AI-action proof gate plus a review-by-
exception onboarding engine:

```text
shadow capture
  -> action surface graph
  -> evidence state model
  -> policy candidate PR
  -> active question engine
  -> policy twin backtest
  -> counterexample replay
  -> approval packet
  -> scoped rollout
```

The customer experience should be:

```text
Attestor found 41 action types, 14 policy candidates, 7 evidence gaps,
3 bypass risks, and 5 questions that close most of the policy work.
```

The human should approve, reject, choose an option, or answer a business
question. The human should not have to write raw policy DSL, inspect raw model
payloads, or build replay fixtures by hand.

## One Engine, Multiple Adapters

| Adapter family | Example consequences | Same core fields |
|---|---|---|
| Finance | `record.release`, `refund.create`, `invoice.adjust` | tenant, action, resource, evidence refs, policy candidate, replay result, approval, receipt |
| General crypto | `native.transfer`, `erc20.approve`, `permit.sign`, `swap.execute`, `bridge.transfer`, `safe.tx.propose`, `userop.submit`, `session_key.grant`, `x402.pay` | tenant, wallet/account, chain, asset, counterparty, authority change, simulation refs, risk refs, approval, receipt |
| CRM/support | `case.refund`, `email.send.customer`, `subscription.cancel` | tenant, customer, downstream system, evidence refs, action kind, approval, receipt |
| ITSM/workflow | `change.execute`, `incident.remediate`, `workflow.dispatch` | tenant, system, action, rollback evidence, approval, receipt |
| Data/IAM | `customer.export`, `permission.grant`, `role.assign` | tenant, principal, resource, data class or authority delta, approval, receipt |
| Procurement/spend | `vendor.payment.prepare`, `purchase_order.approve`, `expense.reimburse` | tenant, payee, amount, evidence refs, approval, receipt |
| Health/insurance | `claim.adjust`, `prior_auth.submit`, `care_gap.notify` | tenant, subject, data class, clinical/claims evidence refs, approval, receipt |

Crypto is not a separate engine. The crypto adapter normalizes transaction and
signature consequences into the same grammar. The treasury use case is only a
high-value subset. The general crypto gate must also cover ordinary transaction
risks such as unlimited approval, malicious spender, permit/domain mismatch,
unsafe delegation, session-key overbreadth, wrong chain, bridge risk,
simulation asset deltas, contract upgrade, and account-abstraction user
operations.

## Current Progress

| Metric | Value |
|---|---|
| Total master-plan rounds | 26 |
| Complete | 9 |
| Remaining | 17 |
| Current state | Steps 01-06 are complete on `origin/master`; Step 07 records the shared-store inventory; Step 08 adds the PostgreSQL-backed atomic retry/replay store slice; Step 09 adds the PostgreSQL-backed shared source-history and outbox primitive. Steps 10-12 preserve the remaining unlock sequence. Steps 13-26 extend the plan into a unified Shadow-to-Policy engine and domain adapter recipes. |

## Master List

| Step | Status | Work item | Required evidence | No-go boundary |
|---|---|---|---|---|
| 01 | complete | Source-of-truth tracker | Existing unlock tracker, tests, README/system links, research ledger entry. | Does not implement production controls. |
| 02 | complete | External KMS/HSM provider decision | Provider decision doc, tests, crypto policy link, research ledger entry. | Do not select a provider without algorithm/input-mode proof. |
| 03 | complete | External signer contract closure | Signer proof envelope, diagnostics contract, tests, docs. | Do not let booleans or local PEM paths satisfy external custody. |
| 04 | complete | First GCP KMS adapter | GCP KMS Ed25519 adapter/probe, tests, deployment docs. | Do not claim live GCP deployment or runtime external-KMS issuance. |
| 05 | complete | Protected admission E2E proof plan | Seven-stage route contract from admission to downstream receipt. | Do not treat signed bearer helper as sufficient for R3/R4. |
| 06 | complete | Customer PEP adoption package | Scoped customer PEP adoption package, tests, docs, ledger. | Do not claim live customer enforcement or production readiness. |
| 07 | complete | Consequence shared-store inventory | Inventory contract, architecture doc, tests, and research ledger entry covering file/in-memory/derived/contract-only/local-ephemeral state across shadow events, simulations, candidates, activation receipts, wizard state, retry, presentation replay, agent-loop guard, audit/dashboard sources, dashboard summary, downstream receipts, tamper-evident history, and crypto execution-admission telemetry as one-engine domain projection. | Do not clear `production-shared` while consequence state is evaluation-backed. |
| 08 | complete | Consequence shared-store PR slice 1 | PostgreSQL-backed atomic retry/replay stores with tenant scope, schema digest, conflict arbitration, raw-idempotency-key-free/raw-replay-key-free storage, embedded PostgreSQL tests, and runtime-cutover non-claim. | Do not use a shared database as proof without constraints and tenant boundary evidence. |
| 09 | complete | Consequence shared-store PR slice 2 | PostgreSQL-backed shared source-history and outbox primitive with tenant-scope digest, digest-only source/payload refs, append-only sequence, outbox contract digest, `FOR UPDATE SKIP LOCKED` worker claim digest, advisory-lock keyspace digest, embedded PostgreSQL tests, and runtime-delivery non-claim. | Do not claim event-bus or Debezium delivery unless a connector is actually wired. |
| 10 | planned | LLM provider runtime decision | Second-provider choice, route compatibility rule, structured-output adapter shape, rate-limit signal mapping, timeout/budget behavior. | Do not prioritize provider diversity ahead of consequence enforcement. |
| 11 | planned | LLM provider runtime PR | Anthropic, Vertex AI, or Azure OpenAI adapter; digest-only runtime evidence; live smoke probe behind external-live gate. | Do not claim live failover until both providers execute compatible routes. |
| 12 | planned | Production rehearsal go/no-go packet | Readiness packet for signer, shared stores, PEP, provider route, probes, backup/restore, observability, incident/runbook evidence. | Do not call the repo or a rehearsal target production-ready without target proof. |
| 13 | planned | Target-system compatibility matrix | Matrix for CRM/support, ITSM/workflow, data/IAM, procurement/spend, health/insurance, and crypto integrations. | Do not optimize for one vendor API as if it were the Attestor model. |
| 14 | planned | Shadow event canonical schema | Versioned event envelope for action, tenant, actor, resource, observed/inferred fields, evidence refs, raw-data prohibitions, and receipt refs. | Do not store raw prompts, private payloads, secrets, wallet material, provider bodies, or customer identifiers beyond the minimum digest-safe contract. |
| 15 | planned | Action surface graph | Tenant-bound graph of observed action types, systems, tools, resources, consequence classes, and route coverage. | Do not infer enforcement readiness from observation alone. |
| 16 | planned | Evidence state model | `observed`, `inferred`, `missing`, `conflicting`, `stale`, `untrusted`, `approved`, and `enforceable` states. | Do not mix facts with model inference in the same field. |
| 17 | planned | Policy Candidate PR contract | Candidate policy diff with schema digest, source-event digest set, inferred fields, missing evidence, risk score, replay digest, questions, and approval state. | Do not let generated candidates become enforceable policy without approval. |
| 18 | planned | Active Question Engine | Rank the smallest high-impact human questions by risk reduction, event coverage, review-load delta, and uncertainty. | Do not ask broad policy-writing questions when a narrow business decision can resolve the gap. |
| 19 | planned | Counterexample replay generator | Tenant mismatch, stale approval, missing evidence, bypass route, repeated action, prompt/tool poisoning, unsafe approval, and crypto transaction abuse fixtures. | Do not learn only from historical normal traffic. |
| 20 | planned | Policy Twin backtest | Replay prior shadow events against candidate policies and report admit/review/block deltas, missed evidence, false-admit risks, and review-load impact. | Do not promote candidates that only pass happy-path replay. |
| 21 | planned | Review-by-exception inbox | Inbox for ready-to-approve, needs-answer, blocked-by-evidence, failed-replay, and monitoring-only items. | Do not create a noisy dashboard that requires humans to inspect every event. |
| 22 | planned | Approval/dismiss feedback loop | Treat approvals, dismissals, stricter-version requests, threshold edits, and rollback decisions as structured feedback. | Do not silently retrain or alter enforcement from feedback without a new approved candidate. |
| 23 | planned | Enterprise integration recipes | Recipes for Salesforce/Agentforce, Microsoft Copilot/Power Automate, ServiceNow, Workato/MuleSoft/n8n/Zapier, Zendesk/Intercom, Snowflake/Databricks, Okta/Entra/SailPoint. | Do not claim native integration coverage before recipe tests and connector-specific evidence exist. |
| 24 | planned | General Crypto Transaction Gate | EVM transaction decoder, ERC-20 transfer/approve/permit, native transfer, Safe transaction, simulation binding, allowance/delegation risk, bridge/swap classification, UserOperation, session-key policy, and x402 payment. | Do not make Attestor a wallet, custodian, exchange, chain analytics provider, or transaction broadcaster. |
| 25 | planned | Spend, procurement, data, IAM, health, and insurance recipes | Domain recipe docs and fixtures for high-friction enterprise consequence surfaces beyond support and crypto. | Do not widen into a general workflow workspace or records system. |
| 26 | planned | Pilot readiness packet | Customer pilot packet covering integration prerequisites, shadow duration, event quality, evidence coverage, active questions, approval path, rollout mode, rollback, and non-claims. | Do not call a pilot production-ready without live target probes, customer approval, and receipt evidence. |

## Implementation Order

Keep the next near-term sequence:

```text
10 -> 11 -> 12
```

Then build the unified Shadow-to-Policy core:

```text
13 -> 14 -> 15 -> 16 -> 17 -> 18 -> 19 -> 20 -> 21 -> 22
```

Then add domain recipes and pilot packaging:

```text
23 -> 24 -> 25 -> 26
```

The ordering matters. The Shadow-to-Policy engine depends on shared, tenant-
bound, replayable event and receipt history. Building policy candidates before
shared state would create a polished recommendation surface on weak evidence.

## Primary Source Anchors

Reviewed on 2026-05-16:

- Usage-based policy recommendation and no-auto-apply posture: [AWS IAM Access Analyzer policy generation](https://docs.aws.amazon.com/IAM/latest/UserGuide/access-analyzer-policy-generation.html), [Google Cloud role recommendations](https://cloud.google.com/policy-intelligence/docs/role-recommendations-overview).
- Schema-bound and auditable policy execution: [Cedar policy validation](https://docs.cedarpolicy.com/policies/validation.html), [OPA decision logs](https://www.openpolicyagent.org/docs/management-decision-logs).
- Human workload minimization patterns: [Microsoft Human-AI Experience Toolkit](https://www.microsoft.com/en-us/haxtoolkit/), [Google People + AI Guidebook](https://pair.withgoogle.com/guidebook/).
- Workflow/action integration surfaces: [Salesforce Agentforce actions](https://developer.salesforce.com/docs/ai/agentforce/guide/get-started-actions.html), [Microsoft Copilot Studio actions](https://learn.microsoft.com/en-us/microsoft-copilot-studio/advanced-plugin-actions), [ServiceNow IntegrationHub](https://www.servicenow.com/docs/bundle/yokohama-integrate-applications/page/administer/integrationhub/concept/integrationhub.html), [Workato business approvals](https://docs.workato.com/agentic/agent-studio/business-approvals.html).
- Agentic orchestration and human-in-the-loop patterns: [Camunda agentic orchestration](https://docs.camunda.io/docs/components/agentic-orchestration/agentic-orchestration-overview/), [n8n human-in-the-loop tools](https://docs.n8n.io/advanced-ai/human-in-the-loop-tools/).
- Crypto policy, signing, and receipt surfaces: [Fireblocks transaction authorization policy](https://developers.fireblocks.com/docs/set-transaction-authorization-policy), [Coinbase CDP Policy Engine](https://docs.cdp.coinbase.com/wallets/security-and-policies/policy-engine/overview), [Safe Transaction Service API](https://docs.safe.global/core-api/api-safe-transaction-service), [OpenZeppelin Defender transaction proposals](https://docs.openzeppelin.com/defender/module/transaction-proposals).
- General crypto transaction standards and risks: [EIP-712 typed data](https://eips.ethereum.org/EIPS/eip-712), [EIP-2612 permit](https://eips.ethereum.org/EIPS/eip-2612), [ERC-4337 account abstraction](https://eips.ethereum.org/EIPS/eip-4337), [ERC-7715 wallet permissions](https://eips.ethereum.org/EIPS/eip-7715).

These sources are engineering anchors only. They do not prove integration
coverage, OAuth certification, crypto custody readiness, compliance
certification, customer deployment, or production readiness.

## Non-Claims

This plan does not claim:

- production readiness
- live customer PEP deployment
- live target-system integrations
- live multi-provider LLM resilience
- runtime external-KMS release-token issuance
- crypto custody, wallet, exchange, or transaction broadcasting capability
- healthcare, insurance, procurement, or finance compliance certification
- automatic policy activation
- completion of steps 10-26

It is the saved master list for the next work sequence.
