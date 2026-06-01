# Release Review Authority Closure Validation - 2026-06-01

## Validation Frame

Source of truth: `origin/master` at
`dbcaae34fdbb9fa29cb441b6ea17a5d47b21a14b`.

Scope:

- release-review final approval side-effect closure after a committed terminal
  transition
- break-glass override side-effect closure after a committed terminal
  transition
- shadow Policy Foundry approval actor fallback chain-effect check

Protected principles:

- customer authority
- replay and idempotency safety
- proof integrity
- auditability
- fail-closed boundary
- no overclaim

Primary anchors:

- IETF HTTPAPI `Idempotency-Key` draft: non-idempotent `POST` and `PATCH`
  operations need retry behavior that avoids accidental duplicate execution.
- Stripe idempotent-request guidance: retries should not create a second
  object or perform an update twice when the same operation is retried.

The external anchors are engineering patterns only. They do not certify
Attestor or prove production readiness.

## Recent Fixes Chain-Effect Check

Current repository evidence keeps the earlier authority-spoof fixes closed:

- reviewer identity comes from the authenticated release-admin actor;
- break-glass requester identity comes from the authenticated break-glass
  actor;
- degraded-mode body-supplied authority fields are rejected;
- production go/no-go approval cannot rely on workflow actor metadata alone;
- Policy Foundry readiness rejects caller-supplied approval query flags and
  uses stored candidate status plus matching digest.

This pass did not reopen those closures. It found a narrower residual issue:
after `commitPendingTransition(...)` succeeds, release token registration,
evidence-pack storage, and the final reviewer queue update were still separate
steps without a recovery-safe closure path.

## Findings

### OPS-219 - Release-review terminal authority closure was not recoverably idempotent

State: closed repo-side / live-proof-only.

Current repository evidence before this fix:

- `src/service/http/routes/release-review-routes.ts` committed the terminal
  review or override transition through `commitPendingTransition(...)`.
- After that commit, token issuance, introspection registration, evidence-pack
  issuance/storage, and final queue record upsert ran as separate side effects.
- A failure after the terminal commit could leave an approved or overridden
  queue record without the token/evidence fields needed for a complete closure.
- A retry of the same route would see the record as already terminal and would
  not repair the missing closure.

Fix:

- Added a shared release-review authority closure helper for final approval and
  break-glass override paths.
- The helper derives deterministic token and evidence-pack IDs from the review
  ID, decision ID, and terminal authority state.
- Terminal decision-log phases are appended idempotently by request ID and
  phase before evidence-pack issuance.
- If a terminal review record is missing token or evidence fields, the approve
  or override route can repair the closure with the same deterministic
  token/evidence identity instead of creating a new authority pair.
- Token registration remains insert/idempotent by token ID, and evidence-pack
  storage remains insert/idempotent by pack ID and bundle digest.

Locking evidence:

- `tests/release-review-admin-routes.test.ts`

New regression coverage:

- final approval token issuance fails after terminal commit, then retry repairs
  the terminal closure;
- evidence-pack storage fails after token registration, then retry reuses the
  same closure identifiers and completes the queue record;
- stale duplicate final approval still cannot issue a second token/evidence
  pair.

Boundary:

This closes the repository-side partial authority closure issue for the
release-review route. It does not prove a live multi-store distributed
transaction, live shared-store deployment behavior, live role-key deployment,
customer PEP no-bypass, production readiness, or enterprise readiness.

### Shadow Policy Foundry fallback actor granularity

State: accepted live/customer workflow boundary for this pass.

Current repository evidence:

- OPS-207 derives hosted shadow policy-candidate status actors from
  authenticated account/session context when available.
- When no account/session actor resolver is configured, the fallback is a
  tenant-auth actor such as `tenant-auth:<source>:<tenantId>`.
- OPS-209 derives readiness customer approval from stored current candidate
  status and matching digest, not from caller-supplied query flags.

Decision:

No additional code change is made here. The fallback is acceptable for internal
shadow decision-support labeling, but customer-facing verified approval still
requires live customer approval workflow proof or a configured named actor
source.

Boundary:

Do not call tenant-level fallback status a verified named customer approval.
Live account/session/key deployment, live shared shadow candidate store,
customer approval workflow proof, customer PEP no-bypass, production readiness,
and enterprise readiness remain unproven/live-proof-only.

## Positive Observations

- Credential-bound reviewer and break-glass identity remains repo-proven.
- Sender-constrained token confirmation is still required before token issuance.
- Evidence-pack stores remain immutable/idempotent by pack ID and bundle
  digest.
- Policy Foundry readiness continues to reject caller-shaped positive proof
  flags.

## Verdict

Repo-side remediation is complete for OPS-219.

Remaining proof is live/operator proof only:

- live role-key deployment;
- live shared release authority store behavior;
- live customer approval workflow proof for customer-facing Policy Foundry;
- customer PEP no-bypass;
- production readiness;
- enterprise readiness.
