# Repository Navigator

Use this when the repository feels large and you want the shortest path to the
right place.

This is a map, not a new authority surface. It does not replace the README,
the audit baseline, or the live proof register.

## What This Opens

Use this page as the single navigation hub from the repository front page.

- [Docs front door](../README.md) - docs grouped by job: integrate, verify, understand, maintain.
- [Repository map](repository-map.md) - codebase layout, package boundaries, and nearby test surfaces.
- [Test system map](../02-architecture/test-system-map.md) - which test gate to run for a change.

## Pick One Door

Do not read everything.

Pick the first line that matches what you are trying to do. Follow that link,
do the next action there, and come back only if you still need more context.

| If you are thinking... | Go here | Stop when... |
|---|---|---|
| "Show me what this does." | [Try Attestor first](try-attestor-first.md) | the refund demo runs and you can explain why it held or blocked. |
| "Show me all demos in order." | [Run the demos in order](demo-guide.md) | you have run the refund path, the all-pack path, and the closest integration-shape example. |
| "Where do I put this in my app?" | [How to integrate Attestor](how-to-integrate-attestor.md) | you can point to the line before the real service is called. |
| "Can Attestor infer my tools or APIs first?" | [Action surface auto-context](../02-architecture/action-surface-auto-context.md) | you know which metadata is safe to infer and which proof still needs review. |
| "What code do I copy?" | [Customer middleware examples](../../examples/customer-middleware/README.md) | you have the closest framework example open. |
| "What JSON do I send?" | [Run Attestor in shadow pilot mode](shadow-event-payload-examples.md) | you have copied the closest payload shape for your action class. |
| "Why did it review or block?" | [Reason codes](../05-proof/reason-codes.md) | you understand the reason code and the next safe step. |
| "Is this production-ready?" | [Current state](../../README.md#current-state) | you can separate repo-side evidence from live proof. |
| "What still needs real deployment evidence?" | [Live proof register](../audit/live-proof-register.md) | you know which proof is live/customer/operator-only. |
| "How is this engine actually built?" | [Internal machine map](../02-architecture/attestor-internal-machine-map.md) | you can name the route, decision plane, package surface, and proof loop. |
| "I need to change code safely." | [Repository map](repository-map.md) | you know the owning directory and the nearest test surface. |
| "I need to reorganize hosted runtime files." | [Service organization plan](../02-architecture/service-organization-plan.md) | you know the slice order, move rules, and no-claims. |
| "I need to split a large file." | [Large file budget](../02-architecture/large-file-budget.md) | you know the 800-line target, 1200-line exception rule, and next split order. |
| "What is the active large-file refactor wave?" | [Final Large File Refactor Plan](../02-architecture/final-large-file-refactor-plan.md) | you know the 16 rounds, targets, exceptions, and no-claims. |
| "Which test proves this?" | [Test system map](../02-architecture/test-system-map.md) | you know the nearest hermetic gate, snapshot/golden gate, or live-proof-only boundary. |

## Start By Intent

| I want to... | Start here | Then go to |
|---|---|---|
| Understand Attestor in one minute | [README](../../README.md) | [Try Attestor first](try-attestor-first.md) |
| Run the demo path | [Run the demos in order](demo-guide.md) | [Golden Path: Refund](../02-architecture/golden-refund-shadow-pilot.md) |
| Send shadow events | [Run Attestor in shadow pilot mode](shadow-event-payload-examples.md) | [Customer middleware examples](../../examples/customer-middleware/README.md) |
| Wire a customer app | [How to integrate Attestor](how-to-integrate-attestor.md) | [Customer middleware examples](../../examples/customer-middleware/README.md) |
| Start from MCP, OpenAPI, AsyncAPI, workflow, or telemetry metadata | [Action surface auto-context](../02-architecture/action-surface-auto-context.md) | [Action surface onboarding packet](../02-architecture/action-surface-onboarding-packet.md) |
| Make the first hosted API call | [First hosted API call](hosted-first-api-call.md) | [Hosted action authorization API](hosted-action-authorization-api.md) |
| Understand `admit`, `narrow`, `review`, and `block` | [Consequence admission quickstart](consequence-admission-quickstart.md) | [Reason codes](../05-proof/reason-codes.md) |
| Decode Attestor terms | [Glossary](../02-architecture/glossary.md) | [Attestor language contract](../02-architecture/attestor-language-contract.md) |
| Explain a review or block reason | [Reason codes](../05-proof/reason-codes.md) | [Failure modes and controls](../05-proof/failure-modes-and-controls.md) |
| Check what is real today | [Current state](../../README.md#current-state) | [Current posture baseline](../audit/current-posture-baseline.md) |
| Check what still needs live proof | [Live proof register](../audit/live-proof-register.md) | [Production readiness](../08-deployment/production-readiness.md) |
| Understand the whole machine | [AI Action Control Plane architecture](../02-architecture/ai-action-control-plane-architecture.md) | [Internal machine map](../02-architecture/attestor-internal-machine-map.md) |
| Understand one-engine domain packs | [Domain pack boundary](../02-architecture/domain-pack-boundary.md) | [Finance and crypto first integrations](finance-and-crypto-first-integrations.md) |
| Review audit state | [Audit evidence system](../audit/README.md) | [Finding index](../audit/finding-index.md) |
| Review public package boundaries | [Repository map](repository-map.md#package-surface-map) | [Consequence admission public surface](../02-architecture/consequence-admission-public-surface.md) |
| Find the right maintainer script | [Scripts inventory](../02-architecture/scripts-inventory.md) | `npm run test:package-script-runner` |
| Find the right test gate | [Test system map](../02-architecture/test-system-map.md) | `npm run test:test-system-map` |
| Plan a hosted runtime refactor | [Service organization plan](../02-architecture/service-organization-plan.md) | `npm run test:service-organization-plan-docs` |
| Reduce oversized files | [Large file budget](../02-architecture/large-file-budget.md) | [Final Large File Refactor Plan](../02-architecture/final-large-file-refactor-plan.md); `npm run test:large-file-budget` |

## Start By Role

| Role | Read first | Why |
|---|---|---|
| First-time evaluator | [README](../../README.md) | Product shape, concrete refund story, current repository truth. |
| Customer engineer | [How to integrate Attestor](how-to-integrate-attestor.md) | The shortest path from AI action to customer-owned gate. |
| API integrator | [First hosted API call](hosted-first-api-call.md) | Tenant key, first request, and decision handling. |
| Reviewer or auditor | [Audit evidence system](../audit/README.md) | Current baseline, finding state, live-proof separation. |
| Maintainer | [Internal machine map](../02-architecture/attestor-internal-machine-map.md) | Where the decision planes, routes, stores, packs, and proof loops live. |
| Product or docs editor | [Attestor language contract](../02-architecture/attestor-language-contract.md) | Public wording, no-claims, and one-engine terminology. |
| Term lookup | [Glossary](../02-architecture/glossary.md) | Short definitions for terms that otherwise sound too similar. |

## Maintainer Maps

This navigator is the front desk. Use the maps when you are ready to change
code or review public package boundaries.

| I need... | Go here |
|---|---|
| Code ownership, directories, and nearby tests | [Repository map](repository-map.md#code-map) |
| Public import paths and package boundaries | [Repository map](repository-map.md#package-surface-map) |
| Hosted runtime reorganization rules | [Service organization plan](../02-architecture/service-organization-plan.md) |
| Large-file split rules | [Large file budget](../02-architecture/large-file-budget.md) |
| Script families and package commands | [Scripts inventory](../02-architecture/scripts-inventory.md) |
| Test families and gate selection | [Test system map](../02-architecture/test-system-map.md) |

## If You Are Lost

1. Want to see value fast? Run [Try Attestor first](try-attestor-first.md), then [Run the demos in order](demo-guide.md).
2. Want to wire something? Open [How to integrate Attestor](how-to-integrate-attestor.md).
3. Want to explain a decision? Open [Reason codes](../05-proof/reason-codes.md).
4. Want to verify a claim? Open [Audit evidence system](../audit/README.md).
5. Want to change internals? Open [Internal machine map](../02-architecture/attestor-internal-machine-map.md).

Keep the distinction clean:

```text
repo-side evidence is not live production proof
package boundary is not hosted enforcement
admission decision is not downstream execution
customer PEP / gate is where non-bypassability must be proven
```
