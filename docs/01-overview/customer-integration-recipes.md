# Customer Integration Recipes

Use this when you understand the Attestor model but still ask: where do I put it in my own system?

Part of: [How to integrate Attestor](how-to-integrate-attestor.md)

Use this page after the integration hub when you need concrete placement
examples. It is still one Attestor engine; the examples change the downstream
system, not the product identity.

The answer is simple: put Attestor at the last customer-owned gate before a real side effect.
For source-backed target-system placement across Salesforce, Microsoft,
ServiceNow, Workato, MuleSoft, n8n, Camunda, data/IAM, spend, health, and
crypto systems, use the
[target-system compatibility matrix](../02-architecture/target-system-compatibility-matrix.md).
For the current enterprise target placement catalog across Salesforce,
Microsoft Copilot/Power Automate, ServiceNow, Workato, MuleSoft, n8n, Zapier,
Zendesk, Intercom, Snowflake, Databricks, Okta, Entra, and SailPoint, use
[Enterprise integration recipes](../02-architecture/enterprise-integration-recipes.md).

```text
prepare proposed consequence
  -> call the relevant Attestor path
  -> project the result into admission
  -> enforce the customer gate
  -> only then run the downstream side effect
```

The downstream side effect is the thing that would make the decision real: write, send, file, execute, broadcast, sign, settle, or route into an irreversible workflow.

## The Rule

Do not put Attestor after the consequence.

Good placement:

```text
AI or workflow output -> Attestor -> customer gate -> database write / message send / payment call
```

Bad placement:

```text
AI or workflow output -> database write / message send / payment call -> Attestor
```

If the downstream action already happened, Attestor can still help with audit, but it is no longer acting as the control gate.

## Common Application Shape

This is the application code shape. The exact Attestor call depends on the consequence surface.

```ts
const attestorResult = await callTheRelevantAttestorPath(proposedConsequence);

const admission = createConsequenceAdmissionFacadeResponse({
  surface: 'finance-pipeline-run',
  run: attestorResult,
  decidedAt: new Date().toISOString(),
  requestInput: {
    actorRef: 'actor:customer-workflow',
    authorityMode: 'tenant-api-key',
    summary: proposedConsequence.summary,
  },
});

const gate = evaluateConsequenceAdmissionGate({
  admission,
  downstreamAction: 'customer_system.side_effect',
  requireProof: true,
});

if (gate.outcome !== 'proceed') {
  return routeToReviewOrStop(gate);
}

return runDownstreamSideEffect();
```

For the shipped hosted finance route, the first Attestor path is `POST /api/v1/pipeline/run`.

For customer-side enforcement, use `attestor/consequence-admission`.

## Recipe 1: AI-Assisted Finance Report

Use this when an AI or analytics workflow proposes a report, financial record, filing export, or reporting-store write.

| Question | Answer |
|---|---|
| Put Attestor before | reporting-store write, filing export, review queue release |
| First Attestor path | `POST /api/v1/pipeline/run` |
| Gate action label | `customer_reporting_store.write` |
| Proceed only when | the admission allows it and required proof is present |
| Hold when | policy, evidence, authority, quota, or proof posture is weak |

Implementation shape:

```text
report candidate
  -> POST /api/v1/pipeline/run
  -> createConsequenceAdmissionFacadeResponse({ surface: 'finance-pipeline-run', run })
  -> evaluateConsequenceAdmissionGate({ downstreamAction: 'customer_reporting_store.write' })
  -> write report only on PROCEED
```

## Recipe 2: Customer-Facing Message

Use this when a system is about to send an email, notification, controlled customer message, or regulated communication.

| Question | Answer |
|---|---|
| Put Attestor before | message sender, notification worker, outbound communication queue |
| First Attestor path | the relevant release/admission path for the message consequence |
| Gate action label | `customer_message_sender.send` |
| Proceed only when | the message has enough policy, authority, and evidence |
| Hold when | the sender would rely on informal trust or missing proof |

Implementation shape:

```text
message draft
  -> Attestor decision and proof
  -> customer gate with downstreamAction: customer_message_sender.send
  -> send only on PROCEED
```

The customer still owns the email provider, message queue, templates, and delivery logic. Attestor decides whether the proposed send is allowed before it reaches that system.

## Recipe 3: Refund, Payout, Or Operational Action

Use this when an internal tool, agent, or workflow is about to trigger a refund, payout, adjustment, vendor action, or operational command.

| Question | Answer |
|---|---|
| Put Attestor before | payment SDK call, refund command, action dispatcher |
| First Attestor path | the relevant finance or release/admission path for the action |
| Gate action label | `customer_action_dispatch.execute` |
| Proceed only when | the actor, policy scope, evidence, and proof requirements pass |
| Hold when | the action is unsupported, stale, over-scoped, or missing proof |

Implementation shape:

```text
proposed action
  -> Attestor decision and proof
  -> customer gate with downstreamAction: customer_action_dispatch.execute
  -> dispatch only on PROCEED
```

This is the easiest mental model for buyers: Attestor sits immediately before the command that would cost money, change a record, notify a customer, or create liability.

## Recipe 4: Programmable-Money Execution

Use this when a wallet, Safe guard, account-abstraction bundler, delegated EOA runtime, x402 resource server, custody policy callback, or solver needs a fail-closed admission step before execution.

| Question | Answer |
|---|---|
| Put Attestor before | sign, broadcast, fulfill, settle, or solver handoff |
| First Attestor path today | `attestor/crypto-authorization-core` and `attestor/crypto-execution-admission` package boundaries |
| Gate action label | name the actual integration point, such as `customer_bundler.submit` |
| Proceed only when | package admission is `admit` and the customer-operated integration agrees |
| Hold when | admission needs evidence or denies execution |

Implementation shape:

```text
programmable-money intent or operation
  -> crypto authorization/admission package path
  -> canonical admission projection
  -> customer gate at wallet / guard / bundler / payment server / custody callback / solver
  -> execute only on PROCEED
```

This is not a public hosted crypto route. It is a packaged integration boundary for customer-operated runtimes.

## Where Not To Put It

- Do not call Attestor only after the side effect has already happened.
- Do not put tenant API keys in browser or mobile client code.
- Do not treat `admit` as proof that the AI output is true in the abstract.
- Do not treat `review` as a soft allow. It is a hold until a customer-owned review path resolves it.
- Do not assume Attestor auto-detects packs from payload shape.

## Where To Go Next

Back: [How to integrate Attestor](how-to-integrate-attestor.md).

Next, choose the page that matches the work:

| If you need... | Open |
|---|---|
| a runnable first admission | [Try Attestor first](try-attestor-first.md) |
| the shared request and response shape | [Consequence admission quickstart](consequence-admission-quickstart.md) |
| the final customer-side guard | [Customer admission gate](customer-admission-gate.md) |
| framework-shaped examples | [Customer middleware examples](../../examples/customer-middleware/README.md) |
| the hosted finance path | [First hosted API call](hosted-first-api-call.md) |
| current pack/example boundaries | [Finance and crypto first integrations](finance-and-crypto-first-integrations.md) |
