# Golden Path: Authority Change

Status: complete. A01-A04 are repository-side only. This is the first
repository-side Authority Change golden path. It is not a live Okta, Microsoft
Entra, or SailPoint connector, not an identity provider, not an
access-governance product, not customer PEP proof, not production readiness,
and not enterprise readiness.

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
  -> Policy Foundry projection, runtime smoke, and pilot readiness packet
  -> local reviewer sandbox and demo output
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
| A03 runtime smoke | `src/consequence-admission/golden-authority-change-runtime-smoke.ts` runs the A01 fixture suite plus A02 projection through the R02-R07 shadow runtime smoke chain without identity-provider calls, access changes, audit writes, policy activation, or raw identity reads. | repo-proven |
| A03 pilot readiness probe | `src/consequence-admission/golden-authority-change-pilot-readiness-probe.ts` wraps the runtime smoke in a shadow-entry readiness packet that can emit only `ready-for-shadow-pilot` or `not-ready`. | repo-proven |
| A04 demo CLI | `scripts/demo/demo-golden-authority-change.ts` renders a Markdown-first local Authority Change demo with JSON as secondary machine output and a bounded `--scenario` input path under `fixtures/`. | repo-proven |
| A04 reviewer sandbox | `src/consequence-admission/golden-authority-change-reviewer-sandbox.ts` validates a strict allowlisted local JSON shape and runs in-scope reviewer inputs through the same shadow-only runtime path without identity-provider calls, access changes, or raw identity material. | repo-proven |

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

Progress after A04 lands: 4/4 complete. 0 steps remain.

| Step | Status | Slice | Evidence target |
|---|---|---|---|
| A01 | complete | Authority Change shadow fixture contract | Synthetic digest-only canonical shadow events for standard-group-grant-approved, privileged-role-narrowing, break-glass-unapproved, external-delegation-review, tenant-scope-mismatch, stale-approval, prompt-injection-in-ticket, and revocation-ready scenarios. |
| A02 | complete | Policy Foundry authority projection | Review-only candidate, named gaps, decision counts, and Policy Twin summary over A01 fixtures. |
| A03 | complete | Runtime smoke and pilot readiness | Run the existing shadow runtime chain over A01/A02 material and emit only `ready-for-shadow-pilot` or `not-ready`. |
| A04 | complete once merged | Demo CLI and reviewer sandbox | Markdown-first local demo plus strict local JSON reviewer input, with no identity-provider calls and no raw identity material. |

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

## A03 Runtime Smoke And Pilot Readiness

A03 runs the A01 fixture events plus A02 projection material through the
existing R02-R07 shadow runtime smoke chain. The output is deterministic replay
evidence only:

```text
A01 canonical shadow fixture
  -> A02 review-only projection
  -> R02-R07 shadow runtime smoke chain
  -> envelope, assurance packet, feedback, and lineage digests
  -> shadow-entry pilot readiness packet
```

The readiness probe allows only:

```text
ready-for-shadow-pilot
not-ready
```

`ready-for-scoped-pilot` is outside A03. Scoped enforcement remains blocked
until there is live customer PEP/gate proof, live identity-provider integration
proof, and customer-operated replay/idempotency evidence.

A03 cannot call an identity provider, change access, write audit state,
activate policy, train or learn, grant authority, admit a live action, or claim
production readiness. The runtime smoke exists to prove the repository-side
shadow chain over Authority Change material before A04 makes it locally
reviewable.

## A04 Demo CLI And Reviewer Sandbox

A04 makes the Authority Change path locally inspectable without turning it into
an identity-provider connector:

```bash
npm run demo:golden-authority-change
npm run demo:golden-authority-change -- --json
npm run demo:golden-authority-change -- --scenario fixtures/golden-authority-change-reviewer-sandbox.example.json
```

The demo is Markdown-first so it can be read, copied, and screenshotted without
requiring a dashboard. JSON is secondary machine output. The `--scenario` path
is constrained to `fixtures/` by default.

The reviewer sandbox accepts only an allowlisted JSON shape:

```text
version
actionSurface
targetSystem
authorityClass
subjectClass
resourceClass
permissionClass
approvalFreshness
tenantScope
separationOfDuties
leastPrivilege
instructionLikeEvidence
externalSideEffect
breakGlass
```

Unknown fields fail strict input validation, including raw-like identity fields.
The sandbox rejects outside-scope action surfaces, maps in-scope class-only
input to digest-only canonical shadow events, then runs the same R02-R07 shadow
runtime smoke chain. This follows strict JSON allowlist and OWASP Input
Validation discipline without claiming live identity-provider control.

## A01 No-Claims

A01-A04 do not prove live identity-provider execution, native Okta/Entra/SailPoint
connector coverage, customer deployment, system-of-record ownership, customer
PEP no-bypass, live replay/idempotency storage, compliance certification,
production readiness, or enterprise readiness.

This path is repo-side evidence only: a deterministic shadow fixture contract
review-only projection, runtime smoke, shadow-pilot readiness probe, local demo,
and local reviewer sandbox.
