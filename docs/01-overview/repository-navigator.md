# Repository Navigator

Use this when the repository feels large and you want the shortest path to the
right place.

This is secondary navigation. The README remains the first page; audit and live
proof records remain the source for readiness claims.

Use this as secondary navigation after the repository README. Start with
Primary Paths. Use the intent or role tables only when the first path is not
obvious.

## Primary Paths

Use these when you need the main Attestor route, not every supporting page.

| Path | Use it for |
|---|---|
| [Try Attestor first](try-attestor-first.md) | Run the smallest local example and read the decision trail. |
| [Run Attestor in shadow pilot mode](shadow-event-payload-examples.md) | Send observe-mode examples before enforcement. |
| [How to integrate Attestor](how-to-integrate-attestor.md) | Find the real side effect, then choose the right technical path. |
| [How Attestor connects to existing systems](how-attestor-connects-to-existing-systems.md) | See discovery, observe mode, rule drafts, admission, gates, and proof in one path. |
| [Consequence admission quickstart](consequence-admission-quickstart.md) | Send a concrete admission request and read `admit`, `narrow`, `review`, or `block`. |
| [Customer admission gate](customer-admission-gate.md) | Hold the real service call in the customer app, gateway, or middleware. |
| [Developer entry path](developer-entry-path.md) | Follow the main request, route, guard, decision, proof, and gate path before changing code. |

## Start By Intent

| I want to... | Start here | Then go to |
|---|---|---|
| Understand Attestor in one minute | [Repository README](../../README.md) | [Try Attestor first](try-attestor-first.md) |
| Run the local evaluation path | [Run the local evaluation path](demo-guide.md) | [Golden Path: Refund](../02-architecture/golden-refund-shadow-pilot.md) |
| Start in observe mode | [Run Attestor in shadow pilot mode](shadow-event-payload-examples.md) | [Customer middleware examples](../../examples/customer-middleware/README.md) |
| Wire a customer app | [How to integrate Attestor](how-to-integrate-attestor.md) | [Customer middleware examples](../../examples/customer-middleware/README.md) |
| Connect existing APIs, tools, workflows, telemetry, and gates | [How Attestor connects to existing systems](how-attestor-connects-to-existing-systems.md) | [Action surface onboarding packet](../02-architecture/action-surface-onboarding-packet.md) when metadata is the next step. |
| Make the first hosted API call | [First hosted API call](hosted-first-api-call.md) | [Hosted action authorization API](hosted-action-authorization-api.md) |
| Understand `admit`, `narrow`, `review`, and `block` | [Consequence admission quickstart](consequence-admission-quickstart.md) | [Reason codes](../05-proof/reason-codes.md) |
| Review shadow, admission, evidence, and boundary material | [Review surface dashboard summary](../02-architecture/dashboard-api-summary.md) | [Attestor Review Surface contract](../02-architecture/attestor-review-surface-contract.md) |
| Explain a review or block reason | [Reason codes](../05-proof/reason-codes.md) | [Failure modes and controls](../05-proof/failure-modes-and-controls.md) |
| Check what is real today | [README current state](../../README.md#current-state) | [Current posture baseline](../audit/current-posture-baseline.md) |
| Check what still needs live proof | [Live proof register](../audit/live-proof-register.md) | [Production readiness](../08-deployment/production-readiness.md) |
| Understand the whole machine | [AI Action Control Plane architecture](../02-architecture/ai-action-control-plane-architecture.md) | [Internal machine map](../02-architecture/attestor-internal-machine-map.md) |
| Review audit state | [Audit evidence system](../audit/README.md) | [Finding index](../audit/finding-index.md) |
| Change code safely | [Developer entry path](developer-entry-path.md) | [Repository map](repository-map.md) and [Test system map](../02-architecture/test-system-map.md) |

## Start By Role

| Role | Read first | Why |
|---|---|---|
| First-time evaluator | [Repository README](../../README.md) | Product shape, concrete refund story, current repository truth. |
| Customer engineer | [How to integrate Attestor](how-to-integrate-attestor.md) | The shortest path from AI action to customer-owned gate. |
| API integrator | [First hosted API call](hosted-first-api-call.md) | Tenant key, first request, and decision handling. |
| Reviewer or auditor | [Audit evidence system](../audit/README.md) | Current baseline, finding state, live-proof separation. |
| Maintainer | [Developer entry path](developer-entry-path.md) | The shortest code-reading path before deeper architecture maps. |
| Product or docs editor | [Attestor language contract](../02-architecture/attestor-language-contract.md) | Public wording, boundary language, and one-engine terminology. |
| Term lookup | [Glossary](../02-architecture/glossary.md) | Short definitions for terms that otherwise sound too similar. |

## Maintainer Maps

This navigator is the front desk. Use the maps when you are ready to change
code or review public package boundaries.

| I need... | Go here |
|---|---|
| First code-reading path for the main admission flow | [Developer entry path](developer-entry-path.md) |
| Code ownership, directories, and nearby tests | [Repository map](repository-map.md#code-map) |
| Public import paths and package boundaries | [Repository map](repository-map.md#package-surface-map) |
| Hosted runtime reorganization rules | [Service organization plan](../02-architecture/service-organization-plan.md) |
| Large-file split rules | [Large file budget](../02-architecture/large-file-budget.md); run `npm run test:large-file-budget`. |
| Large-file refactor plan | [Final Large File Refactor Plan](../02-architecture/final-large-file-refactor-plan.md) |
| Script families and package commands | [Scripts inventory](../02-architecture/scripts-inventory.md) |
| Test families and gate selection | [Test system map](../02-architecture/test-system-map.md) |

## If You Are Lost

1. Want to see value fast? Run [Try Attestor first](try-attestor-first.md), then [Run the local evaluation path](demo-guide.md).
2. Want to observe before enforcement? Open [Run Attestor in shadow pilot mode](shadow-event-payload-examples.md).
3. Want to wire something? Open [How to integrate Attestor](how-to-integrate-attestor.md).
4. Want to see how existing systems fit? Open [How Attestor connects to existing systems](how-attestor-connects-to-existing-systems.md).
5. Want to explain a decision? Open [Reason codes](../05-proof/reason-codes.md).
6. Want to verify a claim? Open [Audit evidence system](../audit/README.md).
7. Want to change internals? Open [Developer entry path](developer-entry-path.md), then [Internal machine map](../02-architecture/attestor-internal-machine-map.md).

Keep the boundary clean:

```text
repo-side evidence is not live production proof
package boundary is not hosted enforcement
admission decision is not downstream execution
customer gate is where non-bypassability must be proven
```
