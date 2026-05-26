# Golden Path: Operational Execution

Status: in progress. O01-O02 are repository-side only. This is not a live
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
  -> later Policy Foundry projection, runtime smoke, reviewer sandbox, and demo output
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

## Research Anchors

Kubernetes server-side dry-run anchors the no-side-effect validation pattern:
validate the requested operation shape before mutating the cluster. Terraform
plan anchors the plan-before-apply control pattern for infrastructure changes.
GitHub deployment environments anchor protected workflow execution and human
approval gates. NIST SP 800-61 anchors incident-response lifecycle vocabulary.

These are engineering anchors only. They do not prove live Kubernetes,
Terraform, GitHub environment, cloud, secret manager, incident automation,
customer PEP, or production readiness.

- [Kubernetes server-side dry-run](https://kubernetes.io/docs/reference/using-api/api-concepts/#dry-run)
- [Terraform plan command](https://developer.hashicorp.com/terraform/cli/commands/plan)
- [GitHub deployment environments](https://docs.github.com/actions/deployment/targeting-different-environments/using-environments-for-deployment)
- [NIST SP 800-61 Computer Security Incident Handling Guide](https://csrc.nist.gov/publications/detail/sp/800-61/rev-2/final)

## O-Series Tracker

Progress after O02 lands: 2/4 complete. 2 steps remain.

| Step | Status | Slice | Evidence target |
|---|---|---|---|
| O01 | complete | Operational Execution shadow fixture contract | Synthetic digest-only canonical shadow events for canary deploy, production deploy without rollback, stale secret-rotation approval, infrastructure drift, incident restart, rollback, runbook prompt injection, and duplicate operation replay scenarios. |
| O02 | complete once merged | Policy Foundry operational projection | Review-only candidate, named gaps, decision counts, and Policy Twin summary over O01 fixtures. |
| O03 | pending | Runtime smoke and pilot readiness | Run the existing shadow runtime chain over O01/O02 material and emit only `ready-for-shadow-pilot` or `not-ready`. |
| O04 | pending | Demo CLI and reviewer sandbox | Markdown-first local demo plus strict local JSON reviewer input, with no deployment, no provider calls, and no secret material. |

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

## No-Claims

O01 does not prove:

- live Kubernetes deployment;
- live Terraform apply;
- live GitHub deployment environment enforcement;
- live secret-manager write or rotation;
- incident automation correctness;
- native CI/CD, cloud, runbook, or ticketing connector coverage;
- customer PEP no-bypass enforcement;
- live replay/idempotency store wiring;
- automatic policy activation;
- production readiness;
- enterprise readiness.
