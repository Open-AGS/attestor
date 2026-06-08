# Attestor Docs

Use this docs index after the repository README. It is secondary navigation, not
the first explanation.

Start near the top. Deeper pages are grouped behind the job that needs them:

```text
understand -> try -> observe -> integrate -> explain -> verify -> maintain
```

## Start Here

| If you want to... | Read this |
|---|---|
| Understand the product in one minute | [Repository README](../README.md) |
| Run the concrete refund workflow | [Try Attestor first](01-overview/try-attestor-first.md) |
| Observe one real action path | [Run Attestor in shadow pilot mode](01-overview/shadow-event-payload-examples.md) |
| See how existing systems connect | [How Attestor connects to existing systems](01-overview/how-attestor-connects-to-existing-systems.md) |
| Put Attestor in front of a real service call | [How to integrate Attestor](01-overview/how-to-integrate-attestor.md) |
| Find deeper docs | [Repository navigator](01-overview/repository-navigator.md) |

## Canonical Docs

When the same idea appears in more than one page, use the owner page below
instead of restating the whole system. This table is navigation; readiness
claims stay with the linked evidence records.

| Concept | Canonical doc |
|---|---|
| AI Action Control Plane | [AI Action Control Plane architecture](02-architecture/ai-action-control-plane-architecture.md) |
| Customer gate / PEP | [Downstream enforcement contract](02-architecture/downstream-enforcement-contract.md) |
| First integration | [How to integrate Attestor](01-overview/how-to-integrate-attestor.md) |
| Existing system connection | [How Attestor connects to existing systems](01-overview/how-attestor-connects-to-existing-systems.md) |
| Observe / shadow pilot | [Run Attestor in shadow pilot mode](01-overview/shadow-event-payload-examples.md) |
| Admission decisions | [Consequence admission quickstart](01-overview/consequence-admission-quickstart.md) |
| Reason codes | [Reason codes](05-proof/reason-codes.md) |
| Policy Foundry | [Policy Foundry onboarding](02-architecture/policy-foundry-onboarding.md) |
| Review workspace | [Attestor Review Surface contract](02-architecture/attestor-review-surface-contract.md) |
| Current state and live proof | [README current state](../README.md#current-state) and [Live proof register](audit/live-proof-register.md) |

## Integrate

Start with [How to integrate Attestor](01-overview/how-to-integrate-attestor.md).
It is the integration hub. Then follow only the page that matches your next step:

| If you are... | Read next |
|---|---|
| still observing real workflows | [Run Attestor in shadow pilot mode](01-overview/shadow-event-payload-examples.md) |
| sending the first shared admission request | [Consequence admission quickstart](01-overview/consequence-admission-quickstart.md) |
| wiring the customer-side stop point | [Customer admission gate](01-overview/customer-admission-gate.md) |
| choosing where it fits in an app | [Customer integration recipes](01-overview/customer-integration-recipes.md) |
| connecting existing APIs, telemetry, rules, gates, and proof | [How Attestor connects to existing systems](01-overview/how-attestor-connects-to-existing-systems.md) |
| copying framework-shaped examples | [Customer middleware examples](../examples/customer-middleware/README.md) |

Hosted account, pricing, and support pages stay behind the
[Repository navigator](01-overview/repository-navigator.md). They are not the
first-reader path.

## Explain Decisions

- [Reason codes](05-proof/reason-codes.md)
- [Failure modes and controls](05-proof/failure-modes-and-controls.md)
- [Proof model](05-proof/proof-model.md)

## Evaluate Trust

- [README current state](../README.md#current-state)
- [v0.3.0 evaluation release notes](00-evaluation/v0.3.0-evaluation-release-notes.md)
- [Attestor Evaluation Packet v0.1](00-evaluation/v0.1-evaluation-packet.md)
- [Evaluation Smoke workflow](../.github/workflows/evaluation-smoke.yml)
- [Artifact attestation plan](08-deployment/artifact-attestation-plan.md)
- [Security Policy](../SECURITY.md)
- [License and use](01-overview/license-and-use.md)
- [Audit evidence system](audit/README.md)
- [Current posture baseline](audit/current-posture-baseline.md)
- [Audit remediation tracker](audit/attestor-audit-remediation-tracker.md)
- [Live proof register](audit/live-proof-register.md)
- [Proof model](05-proof/proof-model.md)
- [Failure modes and controls](05-proof/failure-modes-and-controls.md)

## Understand The System

- [Operating model](01-overview/operating-model.md)
- [AI Action Control Plane architecture](02-architecture/ai-action-control-plane-architecture.md)
- [Internal machine map](02-architecture/attestor-internal-machine-map.md)
- [Domain pack boundary](02-architecture/domain-pack-boundary.md)
- [Consequence admission public surface](02-architecture/consequence-admission-public-surface.md)
- [Downstream enforcement contract](02-architecture/downstream-enforcement-contract.md)
- [Policy Foundry onboarding](02-architecture/policy-foundry-onboarding.md)
- [Attestor Review Surface contract](02-architecture/attestor-review-surface-contract.md)
- [Action surface onboarding packet](02-architecture/action-surface-onboarding-packet.md)
- [Glossary](02-architecture/glossary.md)

## Maintain The Repo

- [Repository navigator](01-overview/repository-navigator.md)
- [Developer entry path](01-overview/developer-entry-path.md)
- [Repository map](01-overview/repository-map.md)
- [Test system map](02-architecture/test-system-map.md)
- [Service organization plan](02-architecture/service-organization-plan.md)
- [Large file budget](02-architecture/large-file-budget.md)
- [Scripts inventory](02-architecture/scripts-inventory.md)
- [Attestor language contract](02-architecture/attestor-language-contract.md)

Keep the boundary clean:

```text
repo-side evidence is not live production proof
package boundary is not hosted enforcement
admission decision is not downstream execution
customer PEP / gate is where non-bypassability must be proven
```
