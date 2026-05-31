# Domain Consequence Recipes

Status: repository-side Step 25 recipe catalog for the unified
Shadow-to-Policy plan. This is not native connector coverage, not live
customer deployment, not a records system, not a workflow workspace, and not
production readiness evidence.

## Decision

Domain consequence recipes sit after the
[Enterprise integration recipes](enterprise-integration-recipes.md) and the
[General Crypto Transaction Gate](general-crypto-transaction-gate.md):

```text
enterprise integration recipes
  -> general crypto transaction gate
  -> domain consequence recipes
  -> pilot readiness packet
```

The job is narrow: map high-friction spend, procurement, data/AI, IAM, health,
and insurance surfaces into the same digest-only Attestor consequence grammar.
Each recipe names the pre-side-effect edge, the normalized fields, the evidence
and approval refs, the receipt and replay refs, the risk signals, and the
no-go boundary.

It does not ship a Ramp app, Brex app, Coupa connector, SAP extension,
Snowflake deployment, Databricks app, Okta card, Entra Logic App, SailPoint
workflow, FHIR server, CDS service, Guidewire integration, procurement
workspace, data lake/export service, identity store, EHR, clinical authority,
insurance core system, claims system, policy administration system, or
customer deployment.

## Runtime Contract

The machine-readable contract lives in
`src/consequence-admission/domain-consequence-recipes.ts`.

Version:

```text
attestor.domain-consequence-recipes.v1
```

Every recipe records:

```text
recipeId
targetSystem
targetFamily
displayName
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
riskSignals
implementationSteps
noGoBoundary
```

Every recipe also carries the same non-claim flags:

```text
customerOwnsSystemOfRecord = true
nativeConnectorImplemented = false
customerDeploymentRequired = true
approvalRequired = true
autoEnforce = false
rawPayloadStored = false
recordsSystem = false
workflowWorkspace = false
productionReady = false
```

The catalog itself records:

```text
sourceBacked = true
oneEngineAdapterModel = true
native connector coverage = false
customerDeploymentProven = false
recordsSystem = false
workflowWorkspace = false
productionReady = false
```

## Required Normalized Fields

Every target recipe must preserve the same minimum consequence grammar:

```text
tenantRefDigest
actorRefDigest
targetSystem
targetAccountRefDigest
domainFamily
actionName
actionKind
consequenceClass
resourceRefDigest
subjectRefDigest
evidenceRefs
approvalRefs
receiptRefDigest
idempotencyRefDigest
```

Target-specific fields can add amount, payee, data class, authority delta,
clinical/claim context, or policy candidate digests. They must not add raw
prompts, raw provider bodies, credentials, customer identifiers, tenant ids,
patient identifiers, claim bodies, policyholder data, SQL text, clinical notes,
payment details, wallet material, private thresholds, or downstream error
bodies.

## Recipe Catalog

| Target | Pattern | Insertion point | Protected examples | Receipt refs | Readiness |
|---|---|---|---|---|---|
| Ramp spend and accounting API | spend-request-gate | Before a bill, reimbursement, transaction sync, vendor, GL account, or custom field write is marked ready or synchronized. | `bill.payment.prepare`, `reimbursement.approve`, `vendor.update`, `transaction.ready_to_sync`, `gl_account.update` | Ramp object id, sync result, accounting reference digests. | requires-target-design |
| Brex Expenses API | spend-request-gate | Before a customer-owned Brex integration updates expense data, uploads receipt material, or exports expense state. | `expense.update`, `receipt.upload`, `receipt.match`, `expense.export` | Brex expense id, receipt upload, expense export digests. | requires-target-design |
| Coupa approvals | procurement-approval-gate | Before a Coupa API client creates, updates, or queries approval state for a procurement document. | `purchase_order.approve`, `invoice.approve`, `supplier.change.approve`, `approval.update` | Coupa approval id, document state, approver receipt digests. | recipe-ready |
| SAP S/4HANA purchase order | procurement-approval-gate | Before a SAP integration sends, updates, cancels, or publishes a purchase order to a supplier network. | `purchase_order.send`, `purchase_order.update`, `purchase_order.cancel`, `supplier_network.publish` | SAP purchase order id, supplier network message, change document digests. | recipe-ready |
| Snowflake Cortex Agents | data-tool-gate | Before a Cortex Agent tool, tool resource, function, SQL, external function, or export path causes a write/export/external call. | `sql.execute.write`, `customer.export`, `external_function.call`, `semantic.query.publish` | Snowflake request id, query/job, export receipt digests. | recipe-ready |
| Databricks AI agent tools | data-tool-gate | Before a Unity Catalog function, custom code tool, REST/API tool, external MCP tool, job run, or data export. | `uc.function.execute`, `rest.tool.call`, `workspace.job.run`, `data.export` | Databricks trace, job run, tool result digests. | recipe-ready |
| Okta Workflows authority changes | identity-workflow-gate | Before Workflows user, group, application, policy, OAuth consent, or privilege action cards create an authority change. | `group.add_user`, `app.assign_user`, `policy.rule.activate`, `user.privilege.grant`, `oauth.consent.grant` | Okta workflow execution, system log event, connector action receipt digests. | recipe-ready |
| Microsoft Entra Lifecycle Workflows | identity-workflow-gate | Before a custom task extension or Logic App continues an access, lifecycle, or group-membership side effect. | `lifecycle.continue`, `access.assign`, `group.membership.update`, `user.lifecycle.change` | Lifecycle Workflow history, Logic App run, Graph operation receipt digests. | recipe-ready |
| SailPoint Workflows | identity-workflow-gate | Before a SailPoint workflow routes or executes access-request, account, entitlement, identity lifecycle, CIEM scope, or external-trigger consequences. | `access.request.route`, `account.update`, `entitlement.change`, `identity.lifecycle.process`, `ciem.scope.change` | SailPoint workflow execution, access decision, source account event digests. | recipe-ready |
| HL7 FHIR Subscriptions | clinical-event-gate | Before a FHIR Subscription notification, clinical event dispatch, care-gap notification, or sensitive-data release reaches a downstream subscriber. | `patient.event.notify`, `care_gap.notify`, `clinical.data.release`, `consent.sensitive_event` | FHIR notification, subscriber delivery, audit event digests. | requires-target-design |
| CDS Hooks clinical decision support | clinical-event-gate | Before a CDS Hooks service response, card, suggestion, or clinical recommendation is shown or routed as actionable decision support. | `cds.card.present`, `order.suggest`, `prior_auth.prompt`, `care_recommendation.notify` | CDS response, card presentation, clinician action receipt digests. | requires-target-design |
| Guidewire ClaimCenter Cloud API | insurance-api-gate | Before a ClaimCenter API caller creates or changes claims, reserves, assignments, payments, notes, or claim lifecycle state. | `claim.adjust`, `reserve.change`, `payment.prepare`, `claim.assignment.update`, `fnol.create` | ClaimCenter API response, claim history event, payment/reserve receipt digests. | requires-target-design |
| Guidewire PolicyCenter Cloud API | insurance-api-gate | Before a PolicyCenter API caller changes quote, submission, policy, endorsement, account, or underwriting state. | `policy.issue.prepare`, `endorsement.change`, `quote.update`, `underwriting.referral.route`, `coverage.change` | PolicyCenter API response, policy transaction, underwriting decision receipt digests. | requires-target-design |

## Adoption Shape

The practical placement is the same for every target:

```text
domain system action/tool/workflow proposes consequence
  -> customer wrapper normalizes digest-only action material
  -> Attestor admission / review / feedback contract
  -> customer-owned gate decides proceed or hold
  -> target system executes only on proceed
  -> target receipt digest returns to the proof trail
```

The recipe catalog reduces human work by turning each domain onboarding into a
small checklist:

1. Pick the target recipe.
2. Bind the target action/tool/workflow id to `actionName`.
3. Bind target account/org/workspace to `targetAccountRefDigest`.
4. Map the target's evidence, approval, receipt, replay, and idempotency refs.
5. Put the customer gate before the write/send/export/authority-change or
   clinical/claim/policy side effect.
6. Keep review, threshold edits, stricter-version requests, and rollback
   requests in the approval/dismiss feedback loop until a new candidate is
   generated and approved.

## Primary Research Anchors

Reviewed on 2026-05-17:

- [Ramp API documentation](https://docs.ramp.com/llms-api.txt) anchors
  accounting connections, GL accounts, accounting fields, ready-to-sync, and
  sync result surfaces.
- [Brex Expenses API](https://developer.brex.com/openapi/expenses_api/)
  anchors expense, receipt match, receipt upload, and expense management
  surfaces.
- [Coupa Approvals API](https://docs.coupa.com/en/developer-documentation/the-coupa-core-api/resources/transactional-resources/approvals-api-approvals)
  anchors procurement approval resources.
- [SAP S/4HANA purchase order API](https://help.sap.com/docs/SAP_S4HANA_CLOUD/bb9f1469daf04bd894ab2167f8132a1a/fd5b4bdc2e7147429cb2de044ccbd890.html)
  anchors purchase-order send, update, cancel, and supplier-network
  operations.
- [Snowflake Cortex Agents REST API](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents-rest-api)
  anchors agent tools and tool resources.
- [Databricks AI agent tools](https://docs.databricks.com/aws/en/generative-ai/agent-framework/agent-tool)
  anchors Unity Catalog, code, REST, and MCP tool approaches.
- [Okta Workflows Okta connector](https://help.okta.com/wf/en-us/Content/Topics/Workflows/connector-reference/okta/okta.htm)
  anchors user, group, application, policy, privilege, OAuth consent, and
  custom API action cards.
- [Microsoft Entra Lifecycle Workflows extensibility](https://learn.microsoft.com/en-us/entra/id-governance/lifecycle-workflow-extensibility)
  anchors custom task extensions, Logic Apps, launch-and-wait behavior, and
  response authorization.
- [SailPoint workflow triggers](https://documentation.sailpoint.com/saas/help/workflows/workflow-triggers.html)
  anchors access request, account, identity, CIEM, external, and scheduled
  workflow triggers.
- [HL7 FHIR Subscriptions](https://hl7.org/fhir/subscriptions.html) anchors
  topic-based subscriptions, notification bundles, delivery limitations, and
  audit-event tracking.
- [CDS Hooks specification](https://cds-hooks.org/specification/current/)
  anchors CDS service calls, hook context, cards, suggestions, feedback, and
  FHIR resource access.
- [Guidewire ClaimCenter Cloud API](https://docs.guidewire.com/cloud/cc/202603/apiref/)
  anchors RESTful Cloud API action surfaces for InsuranceSuite ClaimCenter.
- [Guidewire PolicyCenter Cloud API](https://docs.guidewire.com/cloud/pc/202603/apiref/)
  anchors RESTful Cloud API action surfaces for InsuranceSuite PolicyCenter.

These sources are engineering anchors only. They do not certify Attestor,
prove vendor-partner status, prove customer deployment, prove HIPAA or
insurance compliance, prove clinical validation, or prove production readiness.

## Non-Claims

Boundary: repository-side or evaluation evidence only: not production readiness,
customer deployment proof, customer no-bypass proof, native connector or live
integration coverage, compliance certification, or automatic policy activation.
Domain-specific authority still needs separate live proof.

It is the source-backed domain placement catalog for high-friction enterprise
consequence surfaces. The pilot readiness packet now records what is
repository-proven, what remains customer-deployment work, and what is still a
production no-go.
