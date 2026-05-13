# Guard Activation Readiness

Guard Activation Readiness is the machine-readable checklist that separates guard decision rendering from production enforcement activation.

It does not activate enforcement, does not issue customer approval, does not prove live deployment, and does not claim production readiness.

## Why It Exists

Attestor now has multiple failure-mode guards that can render `pass`, `review`, `hold`, `throttle`, or `block` style decisions. That is necessary, but it is not enough to claim that a customer workflow is protected in production.

The missing distinction is:

```text
guard can render a decision
  !=
guard is production-enforcement activated
```

In short, decision rendering is not enforcement activation.

A guard becomes activation-ready only when the negative decision is consumed by a real PEP, gateway, verifier, route, adapter, or sidecar before downstream execution.

## Research Anchors

This contract follows established engineering patterns without claiming that any external framework certifies Attestor:

- NIST AI RMF treats AI risk management as governed, measured, managed, and documented operational practice rather than a prose-only claim.
- Kubernetes readiness probes keep a workload out of service until its required readiness condition actually passes.
- OPA separates policy decision-making from enforcement; an application or enforcement point must consume the decision.

Attestor maps those patterns to guard activation: a guard decision is not enough until the enforcement path, shared state, replay, audit, and customer approval evidence are present.

## Covered Guards

The readiness contract covers:

- `agent-loop-abuse-guard`
- `untrusted-content-authority-guard`
- `tool-result-poisoning-guard`
- `approval-provenance-guard`
- `stale-authority-policy-guard`
- `scope-explosion-guard`
- `human-review-fatigue-guard`

## Required Criteria

Every covered guard must satisfy all criteria before a production enforcement activation claim is allowed:

- `guard-descriptor-exported`
- `fail-closed-decision-output`
- `raw-payload-storage-disabled`
- `production-shared-state-proven`
- `signed-decision-binding`
- `route-or-pep-enforcement-integrated`
- `downstream-verifier-integrated`
- `replay-fixture-covered`
- `audit-record-emitted`
- `operator-runbook-documented`
- `customer-activation-approved`

The first three criteria can be proven by repository code and tests for most guards. The remaining criteria require runtime, integration, replay, audit, documentation, and customer approval evidence.

## Output States

The evaluator returns:

- `decision-only`
- `production-enforcement-blocked`
- `production-enforcement-ready`

`production-enforcement-ready` means the scoped guard activation checklist has been satisfied. It still does not mean the deployment is production-ready, externally audited, compliant, or live.

The output always keeps:

```text
approvalRequired: true
autoEnforce: false
activatesEnforcement: false
productionReady: false
rawPayloadStored: false
```

## Relationship To Other Contracts

Guard Activation Readiness does not replace:

- [Integration Mode Readiness](integration-mode-readiness.md)
- [Downstream enforcement contract](downstream-enforcement-contract.md)
- [Verifier helper](verifier-helper.md)
- [Adapter framework](adapter-framework.md)
- [Presentation replay ledger](presentation-replay-ledger.md)
- [Downstream execution receipt](downstream-execution-receipt.md)

It sits between guard-level decision logic and integration-level readiness. Integration Mode Readiness answers whether a workflow has a safe enforcement mode. Guard Activation Readiness answers whether each guard has enough evidence to be treated as an enforcement-active control in that workflow.

## Non-Claims

This contract does not claim:

- production readiness
- external certification
- customer approval
- non-bypassability
- live deployment
- automatic enforcement
- complete guard coverage for every customer workflow

If evidence is missing, the result is blocked with explicit blocker codes such as:

```text
tool-result-poisoning-guard:signed-decision-binding
agent-loop-abuse-guard:production-shared-state-proven
approval-provenance-guard:downstream-verifier-integrated
```
