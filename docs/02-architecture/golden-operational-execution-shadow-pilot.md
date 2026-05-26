# Golden Path: Operational Execution

Status: complete. O01-O04 are repository-side only. This is not a live
Kubernetes, Terraform, GitHub deployment environment, incident automation,
secret manager, CI/CD, cloud, or runbook connector, not customer PEP proof,
not production readiness, and not enterprise readiness.

## Decision

Operational Execution is the next pack after External Communication. It keeps
the same Attestor consequence grammar, but moves the example into deploys,
secret rotations, infrastructure changes, incident actions, rollbacks, and
live operations:

```text
AI-prepared operational action intent
  -> synthetic canonical shadow events
  -> digest-only deployment, plan, approval, rollback, incident, replay, and trace refs
  -> admit / narrow / review / block shadow decisions
  -> Policy Foundry projection, runtime smoke, reviewer sandbox, and demo output
```

Non-split boundary:

```text
Not a deployment system.
Not a CI/CD platform.
Not a Kubernetes controller.
Not a Terraform runner.
Not a secret manager.
Not an incident automation tool.
Not a runbook executor.
Not a new Attestor mode.
```

The operational domain supplies the example surface; it does not get
independent authority. Every scenario remains shadow-only and review material
until a later customer-controlled PEP/gate consumes an Attestor decision.

## Repository Evidence

| Area | Evidence | State |
|---|---|---|
| Operational Execution taxonomy | `README.md` lists Operational Execution as deploys, secret rotations, infrastructure changes, incident actions, and live operations, and says the pack list is taxonomy, not an equal-maturity claim. | repo-proven |
| Canonical consequence class | `src/consequence-admission/canonical-shadow-event-schema.ts` includes `operational-execution` as a canonical shadow-event consequence class. | repo-proven |
| Action-surface inference | `src/consequence-admission/action-surface-declaration-ingestors.ts` maps deploy, release, rollout, infra, cloud, secret, rotate, restart, incident, and workflow language into system-operation / operational-execution. | repo-proven |
| O01 fixture contract | `src/consequence-admission/golden-operational-execution-shadow-fixtures.ts` emits eight synthetic digest-only canonical shadow events for operational execution scenarios. | repo-proven once merged |
| O01 tests | `tests/golden-operational-execution-shadow-fixtures.test.ts` locks the suite shape, digest-only canonical events, scenario semantics, no-deployment flags, no secret material, no raw runbook text, and no raw customer identifiers. | repo-proven once merged |
| O02 Policy Foundry projection | `src/consequence-admission/golden-operational-execution-policy-foundry-projection.ts` projects the O01 suite into review-only Policy Foundry material with named rollback, dry-run, approval, drift, break-glass, secret, runbook, and replay gaps. | repo-proven once merged |
| O02 tests | `tests/golden-operational-execution-policy-foundry-projection.test.ts` locks the review-only candidate, decision/gap counts, Policy Twin summary, no-raw-ops posture, docs, ledger, and package script alignment. | repo-proven once merged |
| O03 runtime smoke | `src/consequence-admission/golden-operational-execution-runtime-smoke.ts` runs all O01 fixtures through the existing R02-R07 shadow runtime smoke chain without deployment, infrastructure, secret-manager, incident-automation, runbook, provider, audit, or policy-activation side effects. | repo-proven once merged |
| O03 pilot readiness probe | `src/consequence-admission/golden-operational-execution-pilot-readiness-probe.ts` wraps the runtime smoke in a shadow-entry Pilot Readiness Packet and allows only `ready-for-shadow-pilot` or `not-ready`. | repo-proven once merged |
| O03 tests | `tests/golden-operational-execution-runtime-smoke.test.ts` and `tests/golden-operational-execution-pilot-readiness-probe.test.ts` lock deterministic replay, no-raw-operational-material posture, tamper fail-closed behavior, docs, ledger, and package script alignment. | repo-proven once merged |
| O04 demo CLI | `scripts/demo-golden-operational-execution.ts` renders the Markdown-first Operational Execution demo and supports `--json` plus bounded `--scenario fixtures/golden-operational-execution-reviewer-sandbox.example.json`. | repo-proven once merged |
| O04 reviewer sandbox | `src/consequence-admission/golden-operational-execution-reviewer-sandbox.ts` accepts only strict allowlisted structured operation facts and rejects raw manifest, Terraform, secret, runbook, or credential-shaped fields as unknown schema material. | repo-proven once merged |
| O04 tests | `tests/golden-operational-execution-demo.test.ts` and `tests/golden-operational-execution-reviewer-sandbox.test.ts` lock the demo summary, CLI path boundary, reviewer sandbox, no-deployment/no-secret/no-runbook posture, docs, ledger, and package script alignment. | repo-proven once merged |

## Research Anchors

Kubernetes server-side dry-run anchors the no-side-effect validation pattern:
validate the requested operation shape before mutating the cluster. Terraform
plan anchors the plan-before-apply control pattern for infrastructure changes.
GitHub deployment environments anchor protected workflow execution and human
approval gates. NIST SP 800-61 Rev. 3 anchors incident-response lifecycle
vocabulary; Rev. 2 is no longer the current NIST publication.

These are engineering anchors only. They do not prove live Kubernetes,
Terraform, GitHub environment, cloud, secret manager, incident automation,
customer PEP, or production readiness.

- [Kubernetes server-side dry-run](https://kubernetes.io/docs/reference/using-api/api-concepts/#dry-run)
- [Terraform plan command](https://developer.hashicorp.com/terraform/cli/commands/plan)
- [GitHub deployment environments](https://docs.github.com/actions/deployment/targeting-different-environments/using-environments-for-deployment)
- [NIST SP 800-61 Rev. 3 Incident Response Recommendations and Considerations](https://csrc.nist.gov/pubs/sp/800/61/r3/final)

## O-Series Tracker

Progress after O04 lands: 4/4 complete. 0 steps remain.

| Step | Status | Slice | Evidence target |
|---|---|---|---|
| O01 | complete | Operational Execution shadow fixture contract | Synthetic digest-only canonical shadow events for canary deploy, production deploy without rollback, stale secret-rotation approval, infrastructure drift, incident restart, rollback, runbook prompt injection, and duplicate operation replay scenarios. |
| O02 | complete | Policy Foundry operational projection | Review-only candidate, named gaps, decision counts, and Policy Twin summary over O01 fixtures. |
| O03 | complete | Runtime smoke and pilot readiness | Run the existing shadow runtime chain over O01/O02 material and emit only `ready-for-shadow-pilot` or `not-ready`. |
| O04 | complete once merged | Demo CLI and reviewer sandbox | Markdown-first local demo plus strict local JSON reviewer input, with no deployment, no provider calls, and no secret material. |

## O01 Scenario Contract

O01 covers eight fixture-only cases:

```text
canary-deploy-approved
production-deploy-missing-rollback
secret-rotation-stale-approval
infrastructure-change-drift-review
incident-restart-break-glass
rollback-ready-approved
prompt-injection-in-runbook
duplicate-operation-replay-blocked
```

Every fixture records:

```text
tenantRefDigest
actorRefDigest
targetAccountRefDigest
target system class
operation class
environment class
change risk
approval freshness
rollback plan status
dry-run / plan status
incident state
tenant scope
operator authority
evidence refs
approval refs
simulation refs
receipt refs
policy refs
replay / idempotency / trace refs
```

Every fixture forbids:

```text
raw deployment manifests
raw Terraform plans
raw secret material
raw runbook text
raw customer identifiers
target-system calls
live deployments
infrastructure changes
secret-manager writes
incident automation execution
auto enforcement
production readiness claims
```

## O02 Policy Foundry Projection

O02 projects the O01 fixtures into Policy Foundry review material. The
projection emits a review-only candidate for `operational_execution.change_request`,
a Policy Twin summary, decision counts, gap counts, fixture/event digests, and
named gaps.

The review-only candidate binds the same consequence boundary as O01:

```text
O01 digest-only fixture
  -> review-only Policy Foundry projection
  -> rollback, dry-run, approval, drift, break-glass, secret, runbook, and replay gaps
  -> later runtime smoke and reviewer demo material
```

Named O02 gaps:

```text
rollback-plan-missing
secret-rotation-stale-approval
infrastructure-drift-review
break-glass-secondary-approval
runbook-instruction-review
duplicate-operation-replay
```

O02 remains review material only. It cannot activate enforcement, mutate
policy, deploy infrastructure, apply Terraform, call Kubernetes, write a
secret, execute a runbook, or prove a customer PEP/gate.

## O03 Runtime Smoke And Pilot Readiness

O03 replays every O01 fixture through the existing R02-R07 shadow runtime smoke
chain:

```text
O01 digest-only fixture
  -> O02 review-only projection
  -> R02-R07 shadow runtime smoke chain
  -> digest-bound envelope / assurance / lineage refs
  -> Pilot Readiness Packet
  -> ready-for-shadow-pilot | not-ready
```

This is the operational equivalent of a dry-run / plan / protected-review
rehearsal. It proves that the demo material can move through Attestor's
shadow-only runtime contracts without executing the proposed operation. The
probe explicitly checks for no deployment, no infrastructure change, no
secret-manager write, no incident automation execution, and no runbook
execution. It also preserves the existing no-audit-write, no-policy-activation,
no-learning/training, no-raw-payload, and no-production-readiness boundary.

O03 does not emit `ready-for-scoped-pilot`. Scoped or enforced operational
execution still needs customer PEP/gate integration, live replay/idempotency
proof, operator approval paths, provider credentials, rollback runbooks, and
deployment-specific proof.

## O04 Demo CLI And Reviewer Sandbox

O04 makes the Operational Execution path runnable for a reviewer:

```bash
npm run demo:golden-operational-execution
npm run demo:golden-operational-execution -- --json
npm run demo:golden-operational-execution -- --scenario fixtures/golden-operational-execution-reviewer-sandbox.example.json
```

The default output is Markdown-first for screenshots, walkthroughs, and human
review. JSON as secondary machine output remains available for deterministic
inspection. The reviewer sandbox accepts
only a strict JSON allowlist of structured operation facts:

```text
actionSurface
targetSystem
operationClass
environmentClass
changeRisk
approvalFreshness
rollbackPlanStatus
dryRunStatus
incidentState
tenantScope
operatorAuthority
instructionLikeEvidence
externalSideEffect
duplicateOperationAttempt
```

The sandbox rejects unknown fields rather than accepting raw operational
material. That means a reviewer can test a drifted Terraform plan posture, stale
secret-rotation approval posture, break-glass incident posture, runbook
instruction-like evidence posture, or duplicate operation replay posture
without sending raw manifests, raw Terraform plans, raw secrets, raw runbook
text, kubeconfigs, provider tokens, customer identifiers, or target-system
payloads into the demo.

O04 is deliberately serious but bounded:

```text
local structured operation facts
  -> strict JSON allowlist
  -> digest-only canonical shadow event
  -> R02-R07 shadow runtime smoke chain
  -> decision summary + no-claims
  -> Markdown or JSON demo output
```

It remains a reviewer sandbox. It cannot deploy, apply Terraform, rotate a
secret, execute a runbook, restart an incident service, write an audit record,
activate policy, grant authority, admit an operation, or prove production
readiness.

## No-Claims

O01-O04 do not prove:

- live Kubernetes deployment;
- live Terraform apply;
- live GitHub deployment environment enforcement;
- live secret-manager write or rotation;
- incident automation correctness;
- native CI/CD, cloud, runbook, or ticketing connector coverage;
- raw deployment manifest, Terraform plan, secret, runbook, kubeconfig, or
  provider credential handling;
- customer PEP no-bypass enforcement;
- live replay/idempotency store wiring;
- automatic policy activation;
- production readiness;
- enterprise readiness.
