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
  -> counterexample replay
  -> policy twin backtest
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
| Complete | 20 |
| Remaining | 6 |
| Current state | Steps 01-06 are complete on `origin/master`; Step 07 records the shared-store inventory; Step 08 adds the PostgreSQL-backed atomic retry/replay store slice; Step 09 adds the PostgreSQL-backed shared source-history and outbox primitive. Step 10 selects Anthropic Claude Messages API as the first non-OpenAI runtime adapter target. Step 11 implements the narrow Anthropic Messages API runtime slice with digest-only evidence, strict tool-schema tests, bounded runtime policy, and an opt-in external-live smoke probe while keeping live failover and production readiness unclaimed. Step 12 adds the production go/no-go packet, preserving the target-bound production boundary while closing the first unlock tracker. Step 13 records the [Target-System Compatibility Matrix](target-system-compatibility-matrix.md), keeping Salesforce, Microsoft, ServiceNow, workflow/iPaaS, data/IAM, spend/procurement, health/insurance, and crypto target families as adapters into one engine. Step 14 records the [Shadow Event Canonical Schema](shadow-event-canonical-schema.md), adding the versioned digest-only event envelope and the bridge from existing admission shadow events. Step 15 records the [Action Surface Graph](action-surface-graph.md), adding the tenant-bound graph of systems, actions, resources, route coverage, and missing proof links. Step 16 records the [Evidence State Model](evidence-state-model.md), making observed, inferred, missing, conflicting, stale, untrusted, approved, and enforceable evidence states explicit before policy candidate work. Step 17 records the [Policy Candidate PR Contract](policy-candidate-pr-contract.md), adding review-only candidate diffs with schema digest, source-event digest set, inferred fields, missing evidence, risk score, replay digest, questions, and approval state. Step 18 records the [Active Question Engine](active-question-engine.md), ranking the smallest high-impact human questions by risk reduction, event coverage, review-load delta, and uncertainty while keeping the output decision-support-only. Step 19 records the [Counterexample replay generator](counterexample-replay-generator.md), adding digest-bound negative fixtures for tenant mismatch, stale approval, missing evidence, bypass route, repeated action, prompt injection, tool poisoning, unsafe approval, and crypto transaction abuse while keeping replay local, synthetic, and non-mutating. Step 20 records the [Policy Twin backtest](policy-twin-backtest.md), adding digest-bound historical decision projection, counterexample outcome checks, false-admit risk counts, missed-evidence counts, review-load impact, no-go reasons, and no-traffic/no-mutation/no-auto-enforcement invariants. Steps 21-26 extend the plan into review, feedback, recipes, and pilot sequence. |

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
| 10 | complete | LLM provider runtime decision | Anthropic Claude Messages API selected as the first non-OpenAI runtime adapter target; route compatibility rule, strict tool-schema structured-output path, rate-limit signal mapping, timeout/budget behavior, no-raw-provider-body boundary, tests, registry doc, and research ledger entry recorded. | Do not treat a provider decision as a wired runtime, live failover, or production readiness. |
| 11 | complete | Anthropic runtime PR | Anthropic Messages API adapter, `claude-sonnet-4-6` model mapping, digest-only runtime evidence, fake-client conformance, timeout/output-budget/rate-limit policy, strict tool-schema route tests, and live smoke probe behind external-live gate. | Do not claim live failover, customer approval, or production LLM runtime readiness from repository-side adapter wiring. |
| 12 | complete | Production rehearsal go/no-go packet | `render:production-go-no-go-packet`, typed packet tests, deployment docs, tracker/master-plan updates, and research ledger entry. The packet consumes the signed production-promotion candidate plus target signer proof, shared-store boundary, scoped customer PEP proof, scoped provider-route proof, incident/runbook evidence, and digest-only human approval to emit `go` or `no-go`. | Do not call the repo or a rehearsal target production-ready without target proof and a passing target-bound packet. |
| 13 | complete | Target-system compatibility matrix | Matrix for CRM/support, ITSM/workflow, data/IAM, procurement/spend, health/insurance, and crypto integrations, with source-backed insertion points, normalized fields, evidence/receipt expectations, readiness classes, and native-connector non-claims in `docs/02-architecture/target-system-compatibility-matrix.md`. | Do not optimize for one vendor API as if it were the Attestor model. |
| 14 | complete | Shadow event canonical schema | Versioned event envelope for action, tenant, actor, resource, observed/inferred fields, evidence refs, raw-data prohibitions, and receipt refs in `src/consequence-admission/canonical-shadow-event-schema.ts`, `docs/02-architecture/shadow-event-canonical-schema.md`, `tests/shadow-event-canonical-schema.test.ts`, research ledger entry, tracker updates, and package script. | Do not store raw prompts, private payloads, secrets, wallet material, provider bodies, or customer identifiers beyond the minimum digest-safe contract. |
| 15 | complete | Action surface graph | Tenant-bound graph of observed action types, systems, tools, resources, consequence classes, route coverage, missing proof links, next safe onboarding step, code contract, docs, package script, research ledger entry, and tests. | Do not infer enforcement readiness from observation alone. |
| 16 | complete | Evidence state model | `attestor.evidence-state-model.v1`, `src/consequence-admission/evidence-state-model.ts`, `docs/02-architecture/evidence-state-model.md`, `tests/evidence-state-model.test.ts`, research ledger entry, package script, and tracker/doc links for `observed`, `inferred`, `missing`, `conflicting`, `stale`, `untrusted`, `approved`, and `enforceable` states. | Do not mix facts with model inference in the same field. |
| 17 | complete | Policy Candidate PR contract | `attestor.policy-candidate-pr-contract.v1`, `src/consequence-admission/policy-candidate-pr-contract.ts`, `docs/02-architecture/policy-candidate-pr-contract.md`, `tests/policy-candidate-pr-contract.test.ts`, research ledger entry, package script, and tracker/doc links for review-only candidate diffs with schema digest, source-event digest set, inferred fields, missing evidence, risk score, replay digest, questions, approval state, and no-auto-enforcement invariants. | Do not let generated candidates become enforceable policy without approval. |
| 18 | complete | Active Question Engine | `attestor.active-question-engine.v1`, `src/consequence-admission/active-question-engine.ts`, `docs/02-architecture/active-question-engine.md`, `tests/active-question-engine.test.ts`, research ledger entry, package script, and tracker/doc links for ranked, digest-bound human questions with risk reduction, event coverage, review-load delta, uncertainty reduction, omitted-question accounting, and no-auto-enforcement invariants. | Do not ask broad policy-writing questions when a narrow business decision can resolve the gap. |
| 19 | complete | Counterexample replay generator | `attestor.counterexample-replay-generator.v1`, `src/consequence-admission/counterexample-replay-generator.ts`, `docs/02-architecture/counterexample-replay-generator.md`, `tests/counterexample-replay-generator.test.ts`, research ledger entry, package script, and tracker/doc links for tenant-bound synthetic fixtures covering tenant mismatch, stale approval, missing evidence, bypass route, repeated action, prompt injection, tool poisoning, unsafe approval, and crypto transaction abuse with no production traffic execution, no downstream mutation, no credential use, and no-auto-enforcement invariants. | Do not learn only from historical normal traffic. |
| 20 | complete | Policy Twin backtest | `attestor.policy-twin-backtest.v1`, `src/consequence-admission/policy-twin-backtest.ts`, `docs/02-architecture/policy-twin-backtest.md`, `tests/policy-twin-backtest.test.ts`, research ledger entry, package script, and tracker/doc links for digest-bound historical admit/review/hold/block projection, counterexample false-admit and outcome-mismatch checks, missed-evidence and missing-replay accounting, review-load impact, no-go reasons, and no-traffic/no-mutation/no-auto-enforcement invariants. | Do not promote candidates that only pass happy-path replay. |
| 21 | planned | Review-by-exception inbox | Inbox for ready-to-approve, needs-answer, blocked-by-evidence, failed-replay, and monitoring-only items. | Do not create a noisy dashboard that requires humans to inspect every event. |
| 22 | planned | Approval/dismiss feedback loop | Treat approvals, dismissals, stricter-version requests, threshold edits, and rollback decisions as structured feedback. | Do not silently retrain or alter enforcement from feedback without a new approved candidate. |
| 23 | planned | Enterprise integration recipes | Recipes for Salesforce/Agentforce, Microsoft Copilot/Power Automate, ServiceNow, Workato/MuleSoft/n8n/Zapier, Zendesk/Intercom, Snowflake/Databricks, Okta/Entra/SailPoint. | Do not claim native integration coverage before recipe tests and connector-specific evidence exist. |
| 24 | planned | General Crypto Transaction Gate | EVM transaction decoder, ERC-20 transfer/approve/permit, native transfer, Safe transaction, simulation binding, allowance/delegation risk, bridge/swap classification, UserOperation, session-key policy, and x402 payment. | Do not make Attestor a wallet, custodian, exchange, chain analytics provider, or transaction broadcaster. |
| 25 | planned | Spend, procurement, data, IAM, health, and insurance recipes | Domain recipe docs and fixtures for high-friction enterprise consequence surfaces beyond support and crypto. | Do not widen into a general workflow workspace or records system. |
| 26 | planned | Pilot readiness packet | Customer pilot packet covering integration prerequisites, shadow duration, event quality, evidence coverage, active questions, approval path, rollout mode, rollback, and non-claims. | Do not call a pilot production-ready without live target probes, customer approval, and receipt evidence. |

## Implementation Order

Build the unified Shadow-to-Policy core next:

```text
21 -> 22
```

Then add domain recipes and pilot packaging:

```text
23 -> 24 -> 25 -> 26
```

The ordering matters. The Shadow-to-Policy engine depends on shared, tenant-
bound, replayable event and receipt history. Building policy candidates before
shared state would create a polished recommendation surface on weak evidence.

## Primary Source Anchors

Reviewed on 2026-05-16 and 2026-05-17:

- Usage-based policy recommendation and no-auto-apply posture: [AWS IAM Access Analyzer policy generation](https://docs.aws.amazon.com/IAM/latest/UserGuide/access-analyzer-policy-generation.html), [Google Cloud role recommendations](https://cloud.google.com/policy-intelligence/docs/role-recommendations-overview).
- Schema-bound and auditable policy execution: [Cedar policy validation](https://docs.cedarpolicy.com/policies/validation.html), [OPA decision logs](https://www.openpolicyagent.org/docs/management-decision-logs).
- Negative policy and agentic-action testing: [OPA policy testing](https://www.openpolicyagent.org/docs/policy-testing), [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/), [OWASP Agentic AI threats and mitigations](https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/), [OWASP MCP Tool Poisoning](https://owasp.org/www-community/attacks/MCP_Tool_Poisoning), and [NIST AI RMF Generative AI Profile](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence).
- No-side-effect backtest posture: [Terraform plan](https://developer.hashicorp.com/terraform/cli/commands/plan) and [Kubernetes dry-run](https://kubernetes.io/docs/reference/using-api/api-concepts/#dry-run).
- Human workload minimization patterns: [Microsoft Human-AI Experience Toolkit](https://www.microsoft.com/en-us/haxtoolkit/), [Google People + AI Guidebook](https://pair.withgoogle.com/guidebook/).
- Workflow/action integration surfaces: [Salesforce Agentforce actions](https://developer.salesforce.com/docs/ai/agentforce/guide/get-started-actions.html), [Microsoft Copilot Studio tools](https://learn.microsoft.com/en-us/microsoft-copilot-studio/add-tools-custom-agent), [ServiceNow IntegrationHub](https://www.servicenow.com/docs/r//yokohama/integrate-applications/integration-hub/integrationhub.html), [Workato business approvals](https://docs.workato.com/agentic/agent-studio/business-approvals.html), [MuleSoft Agentforce API actions](https://docs.mulesoft.com/anypoint-code-builder/ai-enabling-api-project-topic-center), [Zapier AI Actions reference](https://docs.zapier.com/platform/reference/ai-actions), and [Zapier AI Actions hub](https://actions.zapier.com/).
- Agentic orchestration and human-in-the-loop patterns: [Camunda agentic orchestration](https://docs.camunda.io/docs/components/agentic-orchestration/agentic-orchestration-overview/), [n8n human-in-the-loop tools](https://docs.n8n.io/advanced-ai/human-in-the-loop-tools/).
- Crypto policy, signing, and receipt surfaces: [Fireblocks transaction authorization policy](https://developers.fireblocks.com/docs/set-transaction-authorization-policy), [BitGo policies overview](https://developers.bitgo.com/guides/policies/overview), [Coinbase CDP Policy Engine](https://docs.cdp.coinbase.com/wallets/security-and-policies/policy-engine/overview), [Safe Transaction Service API](https://docs.safe.global/core-api/api-safe-transaction-service), [OpenZeppelin Defender transaction proposals](https://docs.openzeppelin.com/defender/module/transaction-proposals).
- Data/IAM/spend/health target-system surfaces: [Snowflake Cortex Agents REST API](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents-rest-api), [Databricks AI agent tools](https://docs.databricks.com/en/generative-ai/agent-framework/agent-tool.html), [Okta Workflows connector building blocks](https://help.okta.com/wf/en-us/content/topics/workflows/connector-builder/about-building-blocks.htm), [Microsoft Entra Lifecycle Workflow extensibility](https://learn.microsoft.com/en-us/entra/id-governance/lifecycle-workflow-extensibility), [Coupa approvals API](https://docs.coupa.com/en/developer-documentation/the-coupa-core-api/resources/transactional-resources/approvals-api-approvals), [SAP S/4HANA manage purchase orders](https://help.sap.com/docs/SAP_S4HANA_CLOUD/0e602d466b99490187fcbb30d1dc897c/38cbf557c328be12e10000000a4450e5.html), and [HL7 FHIR Subscriptions](https://hl7.org/fhir/subscriptions.html).
- Canonical event, provenance, action-graph, and evidence-state shape: [CloudEvents specification](https://github.com/cloudevents/spec), [OpenTelemetry Logs Data Model](https://opentelemetry.io/docs/specs/otel/logs/data-model/), [Open Cybersecurity Schema Framework](https://schema.ocsf.io/), [W3C PROV Data Model](https://www.w3.org/TR/prov-dm/), [OPA decision logs](https://www.openpolicyagent.org/docs/management-decision-logs), [Cedar policy validation](https://docs.cedarpolicy.com/policies/validation.html), [SLSA Provenance](https://slsa.dev/spec/v1.0/provenance), [OpenAPI Specification](https://spec.openapis.org/oas/v3.1.0.html), [AsyncAPI Specification](https://www.asyncapi.com/docs/reference/specification/v3.1.0), and [Model Context Protocol tools](https://modelcontextprotocol.io/specification/2025-06-18/server/tools).
- General crypto transaction standards and risks: [EIP-712 typed data](https://eips.ethereum.org/EIPS/eip-712), [EIP-2612 permit](https://eips.ethereum.org/EIPS/eip-2612), [ERC-4337 account abstraction](https://eips.ethereum.org/EIPS/eip-4337), [ERC-7715 wallet permissions](https://eips.ethereum.org/EIPS/eip-7715).
- Production go/no-go evidence and target-readiness discipline: [NIST SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final), [SLSA requirements](https://slsa.dev/spec/v1.0/requirements), [GitHub artifact attestations](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations), [Kubernetes production environment](https://kubernetes.io/docs/setup/production-environment/), [PostgreSQL high availability](https://www.postgresql.org/docs/current/high-availability.html), [BullMQ going to production](https://docs.bullmq.io/guide/going-to-production), and [GitHub deployment environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments).

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
- target-bound production promotion without a passing go/no-go packet
- crypto custody, wallet, exchange, or transaction broadcasting capability
- healthcare, insurance, procurement, or finance compliance certification
- automatic policy activation
- completion of steps 21-26

It is the saved master list for the next work sequence.
