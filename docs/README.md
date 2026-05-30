# Attestor Docs

Use this page when you know what you want next, but not where it lives.

Attestor docs are split by job:

```text
understand -> try -> integrate -> explain decisions -> verify claims -> maintain
```

## Start Here

| If you want to... | Read this |
|---|---|
| Understand the product in one minute | [README](../README.md) |
| Run the concrete refund workflow | [Try Attestor first](01-overview/try-attestor-first.md) |
| Put Attestor in front of a real service call | [How to integrate Attestor](01-overview/how-to-integrate-attestor.md) |
| Copy framework-shaped examples | [Customer middleware examples](../examples/customer-middleware/README.md) |
| Send shadow events without an SDK | [Shadow event payload examples](01-overview/shadow-event-payload-examples.md) |
| Explain a review or block outcome | [Reason codes](05-proof/reason-codes.md) |
| Understand allowed use | [License and use](01-overview/license-and-use.md) |
| Navigate the repository | [Repository navigator](01-overview/repository-navigator.md) |

## Integrate

- [How to integrate Attestor](01-overview/how-to-integrate-attestor.md)
- [Customer middleware examples](../examples/customer-middleware/README.md)
- [First hosted API call](01-overview/hosted-first-api-call.md)
- [Customer admission gate](01-overview/customer-admission-gate.md)
- [Customer integration recipes](01-overview/customer-integration-recipes.md)
- [Shadow event payload examples](01-overview/shadow-event-payload-examples.md)

## Evaluate Trust

- [Current state](../README.md#current-state)
- [Attestor Evaluation Packet v0.1](00-evaluation/v0.1-evaluation-packet.md)
- [v0.2.0 evaluation release notes](00-evaluation/v0.2.0-evaluation-release-notes.md)
- [Security Policy](../SECURITY.md)
- [License and use](01-overview/license-and-use.md)
- [Audit evidence system](audit/README.md)
- [Current posture baseline](audit/current-posture-baseline.md)
- [Audit remediation tracker](audit/attestor-audit-remediation-tracker.md)
- [Live proof register](audit/live-proof-register.md)
- [Proof model](05-proof/proof-model.md)
- [Failure modes and controls](05-proof/failure-modes-and-controls.md)
- [Evaluation Smoke workflow](../.github/workflows/evaluation-smoke.yml)
- [Artifact attestation plan](08-deployment/artifact-attestation-plan.md)

## Understand The System

- [AI Action Control Plane architecture](02-architecture/ai-action-control-plane-architecture.md)
- [Internal machine map](02-architecture/attestor-internal-machine-map.md)
- [Domain pack boundary](02-architecture/domain-pack-boundary.md)
- [Consequence admission public surface](02-architecture/consequence-admission-public-surface.md)
- [Downstream enforcement contract](02-architecture/downstream-enforcement-contract.md)
- [Policy Foundry onboarding](02-architecture/policy-foundry-onboarding.md)
- [Action surface onboarding packet](02-architecture/action-surface-onboarding-packet.md)
- [Glossary](02-architecture/glossary.md)

## Maintain The Repo

- [Repository navigator](01-overview/repository-navigator.md)
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
customer gate is where non-bypassability must be proven
```
