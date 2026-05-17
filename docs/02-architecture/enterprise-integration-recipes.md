# Enterprise Integration Recipes

Status: repository-side Step 23 recipe catalog for the unified
Shadow-to-Policy plan. This is not native connector coverage, not live
customer deployment, not marketplace certification, and not production
readiness evidence.

## Decision

Enterprise integration recipes sit after the
[Approval/Dismiss Feedback Loop](approval-dismiss-feedback-loop.md):

```text
canonical shadow event
  -> action surface graph
  -> evidence state model
  -> policy candidate PR contract
  -> active question engine
  -> counterexample replay generator
  -> policy twin backtest
  -> review-by-exception inbox
  -> approval/dismiss feedback loop
  -> enterprise integration recipes
  -> general crypto transaction gate
  -> spend / procurement / data / IAM / health / insurance recipes
```

The job is narrow: make the target-system placement concrete enough for a
customer engineer to wire the first reviewable gate. Each recipe names the
pre-side-effect edge, the normalized fields, the evidence and approval refs,
the receipt and replay refs, and the no-go boundary.

It does not ship a Salesforce package, ServiceNow spoke, Workato recipe,
MuleSoft policy, n8n workflow, Zapier MCP proxy, Zendesk app, Intercom app,
Snowflake deployment, Databricks app, Okta card, Entra Logic App, or SailPoint
workflow.

## Runtime Contract

The machine-readable contract lives in
`src/consequence-admission/enterprise-integration-recipes.ts`.

Version:

```text
attestor.enterprise-integration-recipes.v1
```

Every recipe records:

```text
targetSystem
targetFamily
primarySourceName
primarySourceUrl
pattern
readiness
insertionPoint
attestorPlacement
protectedConsequences
normalizedFields
evidenceRefs
approvalPath
receiptRefs
replayAndIdempotencyRefs
implementationSteps
noGoBoundary
```

Every recipe also carries the same non-claim flags:

```text
customerOwnsExecution = true
nativeConnectorImplemented = false
customerDeploymentRequired = true
approvalRequired = true
autoEnforce = false
rawPayloadStored = false
productionReady = false
```

The catalog itself records:

```text
sourceBacked = true
oneEngineAdapterModel = true
native connector coverage = false
customerDeploymentProven = false
```

## Required Normalized Fields

Every target recipe must preserve the same minimum consequence grammar:

```text
tenantRefDigest
actorRefDigest
targetSystem
targetAccountRefDigest
actionName
actionKind
consequenceClass
resourceRefDigest
evidenceRefs
approvalRefs
receiptRefDigest
idempotencyRefDigest
```

Target-specific fields can add org, workspace, workflow, ticket, conversation,
database, account, principal, access item, or tool digests. They must not add
raw prompts, raw provider bodies, credentials, customer identifiers, ticket
body text, conversation bodies, SQL text, private thresholds, wallet material,
or downstream error bodies.

## Recipe Catalog

| Target | Pattern | Insertion point | Protected examples | Receipt refs | Readiness |
|---|---|---|---|---|---|
| Salesforce Agentforce | custom-action-gate | Apex REST, AuraEnabled, Named Query, or Apex Invocable action before Salesforce mutation. | `case.refund`, `case.reply`, `opportunity.update`, `subscription.cancel` | Salesforce record event, case/comment id, platform event digest. | recipe-ready |
| Microsoft Copilot Studio / Power Automate | custom-connector-gate | REST API, custom connector, agent flow, MCP tool, or Power Automate action before external side effect. | `dataverse.record.update`, `outlook.email.send`, `teams.message.post`, `powerautomate.flow.run` | Power Automate run, Dataverse row version, connector response receipt. | recipe-ready |
| ServiceNow IntegrationHub | flow-action-gate | Flow, action, spoke, or Flow Designer component before incident/change/request/CMDB mutation. | `incident.remediate`, `change.execute`, `request.approve`, `cmdb.update` | ServiceNow task event, change state, flow execution digest. | recipe-ready |
| Workato Agent Studio | approval-step-gate | Business approval or connector action step before Workato executes a downstream app action. | `access.provision`, `vendor.payment.prepare`, `crm.record.sync`, `discount.approve` | Workato job, approval row, target connector receipt. | recipe-ready |
| MuleSoft Agentforce API | api-operation-gate | Topic Center-enabled API operation before it is exposed as an Agentforce action or topic operation. | `erp.order.update`, `crm.case.write`, `billing.adjust`, `payment.workflow.prepare` | Gateway request, downstream API response, API Catalog action digest. | recipe-ready |
| n8n AI tool human review | tool-wrapper-gate | AI Agent tool connector or human-review branch before selected tool invocation. | `tool.email.send`, `tool.sheet.update`, `tool.api.request`, `tool.record.delete` | n8n execution, tool output, target API receipt. | recipe-ready |
| Zapier MCP | mcp-tool-gateway | Customer-owned MCP proxy before Zapier performs an app action. | `zapier.email.send`, `zapier.task.create`, `zapier.crm.update`, `zapier.calendar.create` | MCP tool result, Zapier action receipt, downstream app receipt. | watch-surface |
| Zendesk AI Agents | api-operation-gate | AI Agents API, ticket workflow, escalation, data export, or user-data operation before support state changes. | `ticket.reply`, `ticket.escalate`, `conversation.export`, `user.data.update` | Zendesk ticket event, conversation workflow receipt, escalation event. | requires-target-design |
| Intercom Conversations | api-operation-gate | Conversation reply, assignment, tag, state, or ticket conversion operation before customer communication changes. | `conversation.reply`, `conversation.assign`, `conversation.close`, `conversation.ticket.convert` | Conversation part, state receipt, assignment receipt. | requires-target-design |
| Snowflake Cortex Agents | tool-wrapper-gate | Generic tool, SQL execution tool, external function, or export path before data write/export/external call. | `sql.execute.write`, `customer.export`, `external_function.call`, `semantic.query.publish` | Snowflake request id, query/job receipt, export receipt. | requires-target-design |
| Databricks Agent Framework | tool-wrapper-gate | UC function, custom code tool, external MCP tool, or REST/API tool before data write/export/job/API side effect. | `uc.function.execute`, `rest.tool.call`, `workspace.job.run`, `data.export` | Databricks trace, job run, tool result receipt. | requires-target-design |
| Okta Workflows | flow-action-gate | Connector action or custom API action before user, group, app, session, or rule authority changes. | `user.activate`, `group.add_user`, `app.assign_user`, `session.clear`, `rule.activate` | Okta workflow execution, system log event, connector action receipt. | recipe-ready |
| Microsoft Entra ID Governance | workflow-extension-gate | Lifecycle Workflow custom task extension, Logic App, or REST extension before lifecycle/access side effects continue. | `access.assign`, `user.lifecycle.change`, `group.membership.update`, `custom.task.continue` | Lifecycle workflow history, Logic App run, Graph operation receipt. | requires-target-design |
| SailPoint Identity Security Cloud | workflow-extension-gate | Workflow trigger/action or external trigger before access request, account, identity, or entitlement side effects proceed. | `access.request.route`, `account.update`, `entitlement.change`, `identity.lifecycle.process` | Workflow execution, access request decision, source account event. | requires-target-design |

## Adoption Shape

The practical placement is the same for every target:

```text
target action/tool/workflow proposes consequence
  -> target wrapper normalizes digest-only action material
  -> Attestor admission / review / feedback contract
  -> customer-owned gate decides proceed or hold
  -> target system executes only on proceed
  -> target receipt digest returns to the proof trail
```

The recipe catalog reduces human work by turning "where do we wire this?" into
a small checklist:

1. Pick the target recipe.
2. Bind the target's action/tool/workflow id to `actionName`.
3. Bind target account/org/workspace to `targetAccountRefDigest`.
4. Map the target's proof, approval, receipt, and replay refs.
5. Put the customer gate before the write/send/export/authority-change call.
6. Keep review, threshold edits, stricter-version requests, and rollback
   requests in the approval/dismiss feedback loop until a new candidate is
   generated and approved.

## Primary Research Anchors

Reviewed on 2026-05-17:

- [Salesforce Agentforce actions](https://developer.salesforce.com/docs/ai/agentforce/guide/get-started-actions.html)
  anchor custom actions through Apex REST, AuraEnabled, Named Query, and Apex
  Invocable Method action surfaces.
- [Microsoft Copilot Studio tools](https://learn.microsoft.com/en-us/microsoft-copilot-studio/add-tools-custom-agent)
  anchor connector, custom connector, agent flow, REST API, MCP, and tool
  authentication surfaces.
- [ServiceNow IntegrationHub](https://www.servicenow.com/docs/r/integrate-applications/integration-hub/integrationhub.html)
  anchors flows, actions, spokes, and custom integrations as workflow
  insertion points.
- [MuleSoft Topic Center for Agentforce](https://docs.mulesoft.com/anypoint-code-builder/ai-enabling-api-project-topic-center)
  anchors API operations becoming Agentforce actions and topics.
- [Workato business approvals](https://docs.workato.com/en/agentic/agent-studio/business-approvals.html)
  anchors approval requests, reviewer assignment, persistence, and audit trail.
- [n8n human-in-the-loop tools](https://docs.n8n.io/advanced-ai/human-in-the-loop-tools/)
  anchors approval before AI tool execution.
- [Zapier MCP](https://docs.zapier.com/mcp/home)
  anchors MCP access to app actions while remaining a watch-surface recipe.
- [Zendesk AI Agents API](https://developer.zendesk.com/api-reference/ai-agents/introduction/)
  anchors AI-powered conversations, ticket workflows, escalations, exports,
  and user data as support action surfaces.
- [Intercom Conversations API](https://developers.intercom.com/docs/references/2.10/rest-api/api.intercom.io/conversations/manageconversation)
  anchors conversation reply, assignment, tagging, state, and ticket conversion
  operations.
- [Snowflake Cortex Agents REST API](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents-rest-api)
  anchors agent tools and tool resources.
- [Databricks AI agent tools](https://docs.databricks.com/aws/en/generative-ai/agent-framework/agent-tool)
  anchors Unity Catalog, code, REST, and MCP tool approaches.
- [Okta Workflows Okta connector](https://help.okta.com/wf/en-us/Content/Topics/Workflows/connector-reference/okta/okta.htm)
  anchors identity and access action cards.
- [Microsoft Entra ID Governance](https://learn.microsoft.com/en-us/entra/id-governance/)
  anchors Lifecycle Workflows and custom task extensions.
- [SailPoint workflow triggers](https://documentation.sailpoint.com/saas/help/workflows/workflow-triggers.html)
  anchor access request, account, identity, and external workflow triggers.

These sources are engineering anchors only. They do not certify Attestor,
prove vendor-partner status, prove customer deployment, or prove production
readiness.

## Non-Claims

This recipe catalog does not claim:

- native connector coverage
- Salesforce, Microsoft, ServiceNow, Workato, MuleSoft, n8n, Zapier, Zendesk,
  Intercom, Snowflake, Databricks, Okta, Entra, or SailPoint deployment
- marketplace listing or partner certification
- OAuth app approval
- customer deployment
- production readiness
- non-bypassable enforcement
- downstream receipt correctness
- compliance certification
- automatic policy activation
- completion of Step 25 Spend, procurement, data, IAM, health, and insurance
  recipes

It is the source-backed placement catalog for enterprise target systems. The
next step is the domain recipe pack, which must stay inside the same
consequence grammar instead of becoming a workflow workspace or records system.
