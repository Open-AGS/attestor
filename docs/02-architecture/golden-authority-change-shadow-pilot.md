# Golden Path: Authority Change

Status: A01-A02 complete once merged. This is the first repository-side
contract/projection slice for the Authority Change golden path. It is not a
live Okta, Microsoft Entra, or SailPoint connector, not an identity provider,
not an access-governance product, not customer PEP proof, not production
readiness, and not enterprise readiness.

## Decision

Authority Change is the next pack after the Money Movement refund path and the
Data Movement controlled-export path. It keeps the same Attestor consequence
grammar, but moves the example into grants, revocations, unlocks, approvals,
delegations, and access changes:

```text
identity or access-change action intent
  -> synthetic canonical shadow events
  -> digest-only subject, resource, permission, approval, policy, replay, and trace refs
  -> admit / narrow / review / block shadow decisions
  -> later Policy Foundry projection, runtime smoke, reviewer sandbox, and demo output
```

Non-split boundary:

```text
Not an identity provider.
Not an access-governance system.
Not an Okta, Entra, or SailPoint connector.
Not a policy owner.
Not a records system.
Not a workflow workspace.
Not a new Attestor mode.
```

The identity domain supplies the example surface; it does not get independent
authority. Every scenario remains shadow-only and review material until a
later customer-controlled PEP/gate consumes an Attestor decision.

## Repository Evidence

| Area | Evidence | State |
|---|---|---|
| Authority Change taxonomy | `README.md` lists Authority Change as grants, revocations, unlocks, approvals, delegations, and access changes, and says the pack list is taxonomy, not an equal-maturity claim. | repo-proven |
| IAM authority recipes | `src/consequence-admission/domain-consequence-recipes.ts` maps Okta Workflows, Microsoft Entra Lifecycle Workflows, and SailPoint Workflows into `identity-workflow-gate` recipe entries. | repo-proven |
| A01 fixture contract | `src/consequence-admission/golden-authority-change-shadow-fixtures.ts` emits eight synthetic digest-only canonical shadow events for authority-change scenarios. | repo-proven |
| A01 tests | `tests/golden-authority-change-shadow-fixtures.test.ts` locks the suite shape, digest-only canonical events, scenario semantics, no-target-system-call flags, no raw identity attributes, and no raw customer identifiers. | repo-proven |
| A02 Policy Foundry projection | `src/consequence-admission/golden-authority-change-policy-foundry-projection.ts` projects the A01 suite into review-only Policy Foundry material with named subject, resource, permission, tenant, approval, SoD, and least-privilege gaps. | repo-proven |
| A02 tests | `tests/golden-authority-change-policy-foundry-projection.test.ts` locks the review-only candidate, decision/gap counts, Policy Twin summary, no-raw-identity posture, docs, ledger, and package script alignment. | repo-proven |

## Research Anchors

NIST ABAC anchors the subject, object/resource, action, and environment
attribute model used by A01. NIST SP 800-53 Rev. 5 supplies control vocabulary
for access enforcement, account management, least privilege, audit events, and
audit records. These are engineering anchors only, not compliance
certification.

- [NIST SP 800-162: Attribute Based Access Control](https://csrc.nist.gov/pubs/sp/800/162/final)
- [NIST SP 800-53 Rev. 5](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final)

Microsoft Entra, Okta, and SailPoint anchor the current identity-governance
workflow shape: access packages, workflow/task extensions, workflow actions,
triggers, access requests, entitlement changes, and source account operations
can become authority-changing side effects. Attestor's placement is before
those operations continue in the customer-owned identity system.

- [Microsoft Entra entitlement management](https://learn.microsoft.com/en-us/entra/id-governance/entitlement-management-overview)
- [Microsoft Entra Lifecycle Workflow extensibility](https://learn.microsoft.com/en-us/entra/id-governance/lifecycle-workflow-extensibility)
- [Okta Workflows Okta connector](https://help.okta.com/wf/en-us/Content/Topics/Workflows/connector-reference/okta/okta.htm)
- [SailPoint Workflow Triggers](https://documentation.sailpoint.com/saas/help/workflows/workflow-triggers.html)

## A-Series Tracker

Progress after A02 lands: 2/4 complete. 2 steps remain.

| Step | Status | Slice | Evidence target |
|---|---|---|---|
| A01 | complete | Authority Change shadow fixture contract | Synthetic digest-only canonical shadow events for standard-group-grant-approved, privileged-role-narrowing, break-glass-unapproved, external-delegation-review, tenant-scope-mismatch, stale-approval, prompt-injection-in-ticket, and revocation-ready scenarios. |
| A02 | complete once merged | Policy Foundry authority projection | Review-only candidate, named gaps, decision counts, and Policy Twin summary over A01 fixtures. |
| A03 | pending | Runtime smoke and pilot readiness | Run the existing shadow runtime chain over A01/A02 material and emit only `ready-for-shadow-pilot` or `not-ready`. |
| A04 | pending | Demo CLI and reviewer sandbox | Markdown-first local demo plus strict local JSON reviewer input, with no identity-provider calls and no raw identity material. |

## A01 Scenario Contract

A01 covers eight fixture-only cases:

```text
standard-group-grant-approved
privileged-role-narrowing
break-glass-unapproved
external-delegation-review
tenant-scope-mismatch
stale-approval
prompt-injection-in-ticket
revocation-ready
```

Every fixture records:

```text
tenantRefDigest
actorRefDigest
targetAccountRefDigest
subject class
resource class
permission class
authority class
approval freshness
tenant scope
separation-of-duties posture
least-privilege posture
evidence refs
approval refs
policy refs
replay/idempotency/trace refs
```

Every fixture forbids:

```text
raw identity attributes
raw customer identifiers
raw provider payloads
target-system calls
identity-provider writes
auto enforcement
production readiness claims
```

## A02 Policy Foundry Projection

A02 projects the A01 fixtures into Policy Foundry review material. The
projection emits a review-only candidate for `authority_change.identity_workflow`,
a Policy Twin summary, decision counts, gap counts, fixture/event digests, and
named gaps.

The review-only candidate binds the same consequence boundary as A01:

```text
AI-prepared identity/access-change intent
  -> digest-only shadow fixture material
  -> review-only Policy Foundry projection
  -> subject, resource, permission, tenant, approval, SoD, and least-privilege gaps
  -> later runtime smoke and reviewer demo material
```

Named A02 gaps:

```text
overbroad-privilege
break-glass-approval-missing
external-delegation-unapproved
tenant-scope-mismatch
stale-approval
instruction-like-ticket-review
separation-of-duties-conflict
```

A02 remains review material only. It cannot activate enforcement, mutate
policy, execute an identity workflow, grant or revoke access, call Okta,
Microsoft Entra, or SailPoint, or prove a customer PEP/gate.

## A01 No-Claims

A01-A02 do not prove live identity-provider execution, native Okta/Entra/SailPoint
connector coverage, customer deployment, system-of-record ownership, customer
PEP no-bypass, live replay/idempotency storage, compliance certification,
production readiness, or enterprise readiness.

This path is repo-side evidence only: a deterministic shadow fixture contract
and review-only projection for later Authority Change runtime smoke and demo
material.
