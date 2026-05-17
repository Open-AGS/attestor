# Target-System Compatibility Matrix

Status: repository-side Step 13 decision artifact for the unified
Shadow-to-Policy plan. This is not a native connector claim, not live
target-system integration proof, and not production readiness evidence.

## Decision

Attestor should integrate by consequence grammar, not by vendor shape.

```text
agent or workflow proposes action
  -> target-system normalizer
  -> Attestor admission / release / PEP decision
  -> customer-owned execution edge
  -> downstream receipt
```

The compatible insertion point is the last customer-controlled edge before a
real side effect: API operation, workflow action, custom connector, agent tool,
MCP tool, webhook/callback, transaction proposal, approval step, or service
task. The target system stays the system of record. Attestor decides whether an
AI-proposed consequence is admissible before that system mutates state, sends
data, changes authority, signs, broadcasts, files, or pays.

Crypto is a domain adapter, not a wallet/custody/exchange/broadcaster. Finance,
CRM/support, ITSM/workflow, data/IAM, procurement/spend, health/insurance, and
crypto all map into one engine.

## Compatibility Contract

Every target-family recipe must preserve these fields before it can claim
repository-side compatibility:

| Dimension | Required normalized evidence |
|---|---|
| Insertion point | Named pre-side-effect edge, route, tool, workflow step, callback, or transaction proposal boundary. |
| Consequence identity | `targetSystem`, `actionName`, `actionKind`, `consequenceClass`, and digest-safe resource reference. |
| Tenant and actor binding | Tenant reference digest, actor reference digest, downstream account/workspace/org reference digest, and auth mode. |
| Resource and payload boundary | Resource digest, data class, amount/asset/chain when relevant, authority delta when relevant, and raw payload prohibition. |
| Evidence refs | Proof references for the business fact, policy bundle, simulation, permission, approval, freshness, or source record used to justify the action. |
| Approval and review | Whether the target action can be admitted, narrowed, reviewed, blocked, held, or approved by a human queue. |
| Receipt | Downstream receipt, record id digest, transaction proposal id digest, tx hash digest, workflow run id digest, or target audit event digest. |
| Replay and idempotency | Idempotency key digest, replay key digest, run id digest, sequence id, or outbox record needed to avoid duplicate consequences. |
| No-go | Explicit boundary that this matrix does not prove a native connector, live target deployment, target certification, or production operation. |

## Target-System Matrix

### CRM, Support, And Customer Operations

| Target family | Primary source anchor | Best Attestor insertion point | Consequence examples | Required normalized fields | Evidence / approval / receipt | Current repo fit | No-go |
|---|---|---|---|---|---|---|---|
| Salesforce Agentforce | Agentforce actions expose Apex REST, AuraEnabled, named query, and Apex invocable methods as actions. | Custom action or API action calls Attestor before Apex/REST/Invocable mutation. | `case.refund`, `opportunity.update`, `customer.email.prepare`, `subscription.cancel`. | tenant, Salesforce org digest, actor digest, customer/case/opportunity resource digest, action kind, data class, evidence refs. | Case/order/payment proof refs, approval queue ref, Salesforce record/event receipt digest. | High. Existing consequence-admission facade and customer PEP package already match pre-action gating. | No native Salesforce package or org deployment is proven. |
| Microsoft Copilot Studio / Power Platform | Copilot Studio tools can be connectors, agent flows, REST APIs, MCP servers, and other tool mechanisms. | REST API/custom connector/agent flow calls Attestor before the tool executes the external side effect. | `dataverse.record.update`, `outlook.email.send`, `teams.message.post`, `approval.route`. | tenant, environment digest, tool/action name, user/maker auth mode, resource digest, data class. | Connector auth context, approval refs, tool response receipt digest, Power Automate run digest. | High. Sender-constrained presentation and customer gate can protect REST/custom connector edges. | Built-in "ask user before running" is not enough proof by itself. No Power Platform connector is shipped. |
| Zendesk / Intercom style support systems | Not researched as a vendor-specific source in this step; included only as a family shape. | Webhook, app action, or API write before ticket/message/customer mutation. | `ticket.reply`, `ticket.priority.update`, `customer.note.write`. | tenant, workspace digest, ticket/customer digest, message/action digest, data class. | Ticket state evidence, approval ref, target event/record receipt digest. | Medium-high as a recipe family. | No native Zendesk or Intercom connector claim. |

### ITSM, Workflow, And iPaaS

| Target family | Primary source anchor | Best Attestor insertion point | Consequence examples | Required normalized fields | Evidence / approval / receipt | Current repo fit | No-go |
|---|---|---|---|---|---|---|---|
| ServiceNow IntegrationHub | IntegrationHub exposes flows, actions, spokes, connection management, automation tracking, and third-party automation routing. | Flow action or spoke step calls Attestor before incident/change/request mutation. | `incident.remediate`, `change.execute`, `request.approve`, `cmdb.update`. | tenant, instance digest, flow/action digest, CI/resource digest, change risk, rollback evidence ref. | Change ticket evidence, CAB/customer approval ref, ServiceNow task/event receipt digest. | High. Fits customer-operated PEP and downstream receipt pattern. | No ServiceNow spoke/app is implemented. |
| Workato Agent Studio | Business approvals provide a human approval surface for agentic recipes. | Business approval or recipe step calls Attestor before the connector action continues. | `recipe.action.execute`, `customer.sync`, `vendor.payment.prepare`. | tenant, recipe/run digest, connector digest, action kind, resource digest, approval mode. | Workato approval ref, recipe job receipt digest, target connector receipt digest. | High. Maps directly to review-by-exception and approval packet plans. | No Workato connector or recipe package is shipped. |
| MuleSoft / Agentforce API Catalog | MuleSoft Topic Center can enable OAS 3.0 APIs for topics and agent actions and sync metadata into Salesforce API Catalog. | API gateway/custom API operation calls Attestor before downstream system API mutation. | `erp.order.update`, `crm.case.write`, `payment.workflow.prepare`. | tenant, business group digest, API spec digest, operation id, downstream resource digest. | API governance proof, action metadata, gateway/request receipt digest. | High. Strong fit for action-surface discovery from OpenAPI. | No Anypoint asset, governance rule, or gateway plugin is implemented. |
| n8n | n8n documents human-in-the-loop approval for AI tool calls. | HITL approval node or tool wrapper calls Attestor before the tool invocation. | `tool.email.send`, `tool.sheet.update`, `tool.api.request`. | tenant, workflow id digest, node/tool digest, resource digest, data class. | Human approval item, workflow execution receipt digest, target API receipt digest. | High for shadow and approval-loop recipes. | No n8n workflow export is shipped. |
| Zapier AI Actions / Zapier MCP direction | Zapier AI Actions documentation says natural-language products can call Zapier actions; current public hub also warns AI Actions are moving to MCP and being sunset. | If used, custom API action calls Attestor before Zapier performs the app action; new work should watch the MCP replacement. | `zapier.app.action`, `gmail.draft`, `hubspot.lead.create`, `calendar.event.create`. | tenant, Zapier account digest, app/action digest, resource digest, data class. | Action approval ref, Zap/task receipt digest, downstream app receipt digest. | Medium. Compatible but not a first recipe target until the supported surface is stable. | Do not build around a sunsetting AI Actions surface as a core Attestor model. |
| Camunda Agentic Orchestration | Camunda documents agentic orchestration as BPMN/workflow orchestration around AI capabilities. | BPMN service task, DMN decision, or human task gates Attestor before the real service task. | `workflow.dispatch`, `incident.remediate`, `approval.escalate`. | tenant, process instance digest, task id digest, decision id, resource digest, rollback ref. | BPMN/DMN evidence, human task approval, process event receipt digest. | High for enterprise workflow recipes. | No Camunda connector or BPMN template is shipped. |

### Data, Analytics, And AI Platforms

| Target family | Primary source anchor | Best Attestor insertion point | Consequence examples | Required normalized fields | Evidence / approval / receipt | Current repo fit | No-go |
|---|---|---|---|---|---|---|---|
| Snowflake Cortex Agents | Cortex Agents REST API supports agent objects with tools including Analyst, SQL execution, Search, web search, and generic tools. | Generic tool or SQL execution wrapper calls Attestor before SQL write/export/external function/action. | `sql.execute.write`, `customer.export`, `semantic.query.publish`, `external_function.call`. | tenant, Snowflake account digest, database/schema/agent digest, tool type, data class, query/output digest. | Semantic model proof, warehouse/role proof, approval ref, query/job/event receipt digest. | Medium-high. Repo has Snowflake surfaces, but target-bound gating is not wired. | No live Snowflake account, Cortex Agent deployment, or SQL execution PEP is proven. |
| Databricks Mosaic AI / Agent Framework | Databricks documents agent tools, MCP tools, Unity Catalog functions, REST/API tools, Python execution tools, and OpenAI-compatible function calling. | Tool wrapper, MCP server, Unity Catalog function, or serving endpoint calls Attestor before data write, export, or external API action. | `uc.function.execute`, `rest.tool.call`, `workspace.job.run`, `data.export`. | tenant, workspace digest, tool/function digest, UC object/resource digest, data class, authority delta. | Unity Catalog permission proof, tool schema digest, approval ref, job/model-serving receipt digest. | Medium-high. Strong fit for future target-system recipes. | No Databricks app, UC function, MCP server, or serving endpoint is shipped. |

### IAM And Authority Change

| Target family | Primary source anchor | Best Attestor insertion point | Consequence examples | Required normalized fields | Evidence / approval / receipt | Current repo fit | No-go |
|---|---|---|---|---|---|---|---|
| Okta Workflows | Okta Workflows connectors expose action cards; the Okta connector includes user, group, app assignment, session, and rule actions. | Workflow card/custom connector/API card calls Attestor before group/app/user/role changes. | `user.activate`, `group.add_user`, `app.assign_user`, `session.clear`, `rule.activate`. | tenant, org digest, actor digest, principal digest, resource digest, authority delta. | HR/source-of-truth proof, approval ref, Okta system log/event receipt digest. | High. Authority-change consequences fit the same release/admission chain. | No Okta connector or live SCIM/OIDC proof is implemented by this matrix. |
| Microsoft Entra Lifecycle Workflows / Extensions | Lifecycle workflow extensibility can call Azure Logic Apps via custom task extensions; Entra custom auth extensions call REST API endpoints on identity events. | Custom task extension, Logic App, or REST extension calls Attestor before lifecycle or auth side effects continue. | `access.assign`, `user.lifecycle.change`, `group.membership.update`, `auth.extension.decision`. | tenant, directory digest, principal digest, resource digest, lifecycle event/action, authority delta. | HR/manager approval proof, lifecycle workflow proof, Graph/Logic App receipt digest. | High as an IAM recipe target. | No Entra app registration, Graph integration, or Logic App deployment is proven. |

### Crypto, Wallet, And Transaction Systems

| Target family | Primary source anchor | Best Attestor insertion point | Consequence examples | Required normalized fields | Evidence / approval / receipt | Current repo fit | No-go |
|---|---|---|---|---|---|---|---|
| Fireblocks | Fireblocks policies can allow/block workspace actions and can be managed directly or through draft/publish APIs; rule order matters. | Pre-transaction proposal gate, policy draft review, or future API co-signer callback before signing/broadcast. | `native.transfer`, `erc20.transfer`, `contract.call`, `typed_message.sign`, `policy.draft.publish`. | tenant, workspace/vault digest, chain, asset, amount, destination digest, operation type, policy/simulation refs. | Simulation proof, policy rule/draft refs, approval quorum ref, transaction/receipt digest. | Very high. Existing crypto admission and execution-plan surfaces already normalize transaction risk. | Attestor is not a Fireblocks policy replacement, cosigner, wallet, custodian, or broadcaster. |
| BitGo | BitGo policy rules define scope, touchpoint, condition, and action; withdrawal policies can trigger approval/deny behavior and policy rules can be API-managed. | Pre-txrequest gate or policy webhook-style approval before withdrawal/signing flow proceeds. | `withdrawal.request`, `wallet.policy.update`, `approval.require`, `transfer.prepare`. | tenant, enterprise/wallet digest, coin/asset, amount, destination digest, touchpoint, condition/action refs. | Wallet/enterprise policy ref, approval ref, txrequest state/receipt digest. | Very high for transaction-request gating. | BitGo policies may not cover recovery/user-key flows; Attestor is not BitGo custody or recovery. |
| Coinbase CDP Policy Engine | Coinbase CDP policies accept/reject wallet operations; rules are ordered and requests are rejected if no rule matches. Supported operations include EVM/Solana sign/send, swaps, and user operations. | Backend pre-SDK call gate before CDP sign/send/swap/user-operation request; combine with CDP policy, do not replace it. | `signEvmTransaction`, `sendEvmTransaction`, `signEvmTypedData`, `createEndUserEvmSwap`, `sendUserOperation`. | tenant, project/account digest, chain/network, operation, asset/value, counterparty, policy refs, user/auth mode. | Policy id/ref, simulation ref, user approval ref, operation receipt digest. | Very high. Strong fit for general crypto transaction gate. | No CDP wallet, key, policy, or API execution is implemented here. |
| Safe Transaction Service | Safe Transaction Service is the API surface around Safe multisig transaction proposal, confirmation, and execution tracking. | Pre-propose gate before a Safe transaction is created, or pre-confirmation gate before signer approval. | `safe.tx.propose`, `safe.tx.confirm`, `safe.module.enable`, `safe.owner.change`. | tenant, safe address digest, chain, nonce, to/value/data digest, operation, signer/owner delta. | Safe simulation/ref, signer approval refs, safeTxHash/txHash receipt digest. | Very high. Fits transaction proposal plus human approval model. | Attestor is not a Safe signer, module, relayer, or custody layer. |
| OpenZeppelin Defender | Defender transaction proposals provide reviewable transaction execution workflows. | Pre-proposal gate or proposal approval gate before Defender executes the transaction. | `contract.upgrade`, `admin.pause`, `role.grant`, `treasury.transfer`. | tenant, network, contract digest, calldata digest, authority delta, proposal ref. | Proposal ref, multisig/admin approval ref, simulation/ref, tx receipt digest. | High. Fits high-risk smart-contract administration and review packets. | No Defender proposal integration is shipped. |

### Procurement, Spend, Health, And Insurance

| Target family | Primary source anchor | Best Attestor insertion point | Consequence examples | Required normalized fields | Evidence / approval / receipt | Current repo fit | No-go |
|---|---|---|---|---|---|---|---|
| Coupa | Coupa approvals API can query approvals and perform approve, hold, reject, and update actions. | Approval API or workflow action calls Attestor before approve/hold/reject/update. | `purchase_order.approve`, `invoice.hold`, `expense.reject`, `vendor.update`. | tenant, instance digest, approval/document digest, payee/vendor digest, amount/currency, cost center digest. | PO/invoice/expense evidence, budget/ref approval, Coupa approval receipt digest. | Medium-high. Needs domain recipe and fixtures before claiming coverage. | No Coupa connector, spend-compliance claim, or live approval integration is proven. |
| SAP S/4HANA procurement/workflow | SAP S/4HANA purchase orders can have approval statuses and workflow steps; OData APIs exist for purchase-order operations. | Approval workflow, My Inbox/custom app, or OData operation calls Attestor before PO/order state changes. | `purchase_order.approve`, `purchase_order.change`, `sales_order.release`. | tenant, SAP system digest, document/item digest, amount/currency, vendor/customer digest, workflow step. | Workflow approval proof, budget/procurement proof, SAP document/status receipt digest. | Medium. Compatible but domain-heavy. | No SAP certification, BTP package, or OData integration is implemented. |
| Health / FHIR / clinical workflow | HL7 FHIR Subscriptions describe event notification and subscription topics for FHIR servers. | Clinical/claims workflow calls Attestor before submit/update/notify; subscription events can provide receipt/audit evidence after the fact. | `prior_auth.submit`, `claim.adjust`, `patient.notify`, `care_gap.update`. | tenant, subject/patient digest, practitioner/actor digest, resource digest, data class, clinical/claims evidence refs. | FHIR resource/subscription event refs, clinical/claims approval refs, target receipt digest. | Medium. Works as one-engine domain adapter only with strict PHI minimization. | No clinical decision support, medical advice, HIPAA compliance, or insurer/EHR integration is proven. |

## Readiness Classification

| Class | Meaning | Families |
|---|---|---|
| High compatibility | Existing Attestor admission, release, customer PEP, proof, replay, and receipt contracts map cleanly to the target family. | Salesforce Agentforce, Copilot Studio REST/custom connector, ServiceNow, Workato, MuleSoft, n8n, Camunda, Okta, Entra, Fireblocks, BitGo, Coinbase CDP, Safe. |
| Medium-high compatibility | The insertion point is clear, but domain fixtures or target-specific receipt/proof mapping are needed first. | Snowflake, Databricks, Coupa. |
| Medium compatibility | The grammar fits, but domain semantics, regulated data handling, and customer-specific workflow evidence dominate the work. | SAP procurement/workflow, health/FHIR/insurance. |
| Watch / do not optimize first | Compatibility exists, but the public target surface is shifting or sunset-bound. | Zapier AI Actions until the supported MCP direction is stable. |

## Implementation Implications

Step 14 defines the [shadow event canonical schema](shadow-event-canonical-schema.md)
from this matrix, not from one vendor. At minimum, the schema needs:

```text
tenantRefDigest
actorRefDigest
targetSystem
targetAccountRefDigest
actionName
actionKind
consequenceClass
resourceRefDigest
dataClass
amountAssetChain when relevant
authorityDelta when relevant
evidenceRefs
simulationRefs
approvalRefs
idempotencyRefDigest
replayRefDigest
receiptRefDigest
rawMaterialPolicy
```

Step 15 defines the [action surface graph](action-surface-graph.md) that
clusters `targetSystem`, `actionName`, `resourceRefDigest`, `consequenceClass`,
route coverage, and missing proof links across these families. Step 16 defines
the [evidence state model](evidence-state-model.md) that labels those links as
observed, inferred, missing, conflicting, stale, untrusted, approved, or
enforceable before candidate generation. Step 23-25 should become recipes, not
one-off engines.

## Primary Research Anchors

Reviewed on 2026-05-17:

- Agent/action surfaces: [Salesforce Agentforce actions](https://developer.salesforce.com/docs/ai/agentforce/guide/get-started-actions.html), [Microsoft Copilot Studio tools](https://learn.microsoft.com/en-us/microsoft-copilot-studio/add-tools-custom-agent), [ServiceNow IntegrationHub](https://www.servicenow.com/docs/r//yokohama/integrate-applications/integration-hub/integrationhub.html), [Workato business approvals](https://docs.workato.com/agentic/agent-studio/business-approvals.html), [MuleSoft Agentforce API actions](https://docs.mulesoft.com/anypoint-code-builder/ai-enabling-api-project-topic-center), [n8n human-in-the-loop tools](https://docs.n8n.io/advanced-ai/human-in-the-loop-tools/), [Zapier AI Actions reference](https://docs.zapier.com/platform/reference/ai-actions), [Zapier AI Actions hub](https://actions.zapier.com/), and [Camunda agentic orchestration](https://docs.camunda.io/docs/components/agentic-orchestration/agentic-orchestration-overview/).
- Crypto target surfaces: [Fireblocks transaction authorization policy](https://developers.fireblocks.com/docs/set-transaction-authorization-policy), [BitGo policies overview](https://developers.bitgo.com/guides/policies/overview), [Coinbase CDP Policy Engine](https://docs.cdp.coinbase.com/wallets/security-and-policies/policy-engine/overview), [Safe Transaction Service](https://docs.safe.global/core-api/api-safe-transaction-service), and [OpenZeppelin Defender transaction proposals](https://docs.openzeppelin.com/defender/module/transaction-proposals).
- Data/IAM/spend/health anchors: [Snowflake Cortex Agents REST API](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents-rest-api), [Databricks AI agent tools](https://docs.databricks.com/en/generative-ai/agent-framework/agent-tool.html), [Okta Workflows connector building blocks](https://help.okta.com/wf/en-us/content/topics/workflows/connector-builder/about-building-blocks.htm), [Microsoft Entra Lifecycle Workflow extensibility](https://learn.microsoft.com/en-us/entra/id-governance/lifecycle-workflow-extensibility), [Coupa approvals API](https://docs.coupa.com/en/developer-documentation/the-coupa-core-api/resources/transactional-resources/approvals-api-approvals), [SAP S/4HANA manage purchase orders](https://help.sap.com/docs/SAP_S4HANA_CLOUD/0e602d466b99490187fcbb30d1dc897c/38cbf557c328be12e10000000a4450e5.html), and [HL7 FHIR Subscriptions](https://hl7.org/fhir/subscriptions.html).

These anchors prove only that the target families expose action, approval,
policy, workflow, tool, transaction, or receipt surfaces that can be normalized.
They do not prove native Attestor integrations.

## Non-Claims

This matrix does not claim:

- native connector coverage
- live Salesforce, Microsoft, ServiceNow, Workato, MuleSoft, n8n, Zapier,
  Camunda, Snowflake, Databricks, Okta, Entra, Coupa, SAP, FHIR, Fireblocks,
  BitGo, Coinbase CDP, Safe, or OpenZeppelin Defender integration
- target-system certification or marketplace listing
- customer deployment
- production readiness
- compliance certification
- crypto custody, wallet, exchange, signer, relayer, chain analytics, or
  broadcaster capability
- healthcare clinical decision support or medical advice
- automatic policy activation

It is the Step 13 compatibility map for deciding the next canonical shadow
event and action-surface contracts.
