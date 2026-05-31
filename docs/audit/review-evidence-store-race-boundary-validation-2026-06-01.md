# Review Evidence Store Race Boundary Validation - 2026-06-01

## Validation Frame

Source of truth: `origin/master` at
`ed095269b46d30bc463b920b0eae834139ab9b91`.

Scope:

- release-review terminal approval and override mutation ordering
- release evidence-pack store immutability by pack ID
- webhook break-glass current-state reconciliation
- Envoy ext_authz target binding from route metadata versus client headers

Protected principles:

- proof integrity
- fail-closed boundary
- customer authority
- auditability
- replay and idempotency safety
- no overclaim

Primary anchors:

- PostgreSQL `INSERT ... ON CONFLICT` and row/update concurrency behavior
- OWASP server-side authorization guidance
- Envoy and Istio external authorization header/context-extension behavior

## Recent Fixes Chain-Effect Check

The immediately preceding boundary slice closed:

- credential-bound release-review reviewer identity
- credential-bound release-review override requester identity
- declared evidence artifact reference wording and digest shape
- raw webhook break-glass acceptance without consumption

This pass does not reopen those closures. It found a separate release-review
terminal transition race and an evidence-pack store immutability issue.

## Findings

### OPS-201 - Release-review terminal transition was not committed before token/evidence side effects

State: closed repo-side / live-proof-only.

Current repository evidence before this fix:

- `src/service/http/routes/release-review-routes.ts` loaded a reviewer queue
  record, applied a local transition, issued release tokens and evidence packs,
  then wrote the final queue state.
- `src/service/release/release-reviewer-queue-store.ts` exposed a shared
  PostgreSQL `claimNextPending` worker path, but the admin approval route used
  read-modify-write plus unconditional `upsert`.

Fix:

- Added `commitPendingTransition(...)` to the release reviewer queue contract.
- The in-memory/file-backed store and shared PostgreSQL store now compare the
  current pending state, authority state, and reviewer-decision count before
  accepting a transition.
- The approve/reject/override routes now commit the pending transition before
  token/evidence side effects.
- A stale final approval now fails before token registration or evidence-pack
  write.

Locking evidence:

- `tests/release-review-admin-routes.test.ts`
- `tests/release-kernel-reviewer-queue.test.ts`
- `tests/release-reviewer-queue-store.test.ts`

Boundary:

This closes the duplicate/stale final approval path repo-side. It does not
prove a live multi-store distributed transaction, live role-key deployment, or
customer PEP no-bypass.

### OPS-202 - Evidence-pack stores could replace an existing pack ID

State: closed repo-side / live-proof-only.

Current repository evidence before this fix:

- `src/release-kernel/release-evidence-pack.ts` replaced an existing in-memory
  or file-backed pack when the same evidence-pack ID was written again.
- `src/service/release/release-evidence-pack-store.ts` used PostgreSQL
  `ON CONFLICT (pack_id) DO UPDATE`, replacing the persisted proof material.

Fix:

- Evidence-pack stores are now insert-only by pack ID.
- Same ID plus same bundle digest is treated as idempotent replay.
- Same ID plus different bundle digest is rejected.

Locking evidence:

- `tests/release-kernel-release-evidence-pack.test.ts`
- `tests/release-evidence-pack-store.test.ts`

Boundary:

This proves repository store immutability for the scoped stores. It does not
prove external artifact-store availability, external byte retrieval, WORM/SIEM
storage, or production audit retention.

### OPS-200 reconciliation - Webhook break-glass reusable raw grant

State: contradicted by current repository evidence.

Current repository evidence:

- `src/release-enforcement-plane/webhook-receiver.ts` requires
  `consumeBreakGlassGrant` before break-glass admission.
- `tests/release-enforcement-plane-webhook-receiver.test.ts` proves raw grants
  reject and one-use consumed grants admit once.

No new repo change was required in this pass.

### OPS-203 - Envoy target binding could prefer a client target header

State: closed repo-side / live-proof-only.

Current repository evidence before this fix:

- `src/release-enforcement-plane/envoy-ext-authz.ts` resolved target ID from
  server option, route context extension, then `attestor-target-id` header, then
  proxy-observed destination service / host-path fallback.
- `docs/08-deployment/release-enforcement-plane-envoy.md` included
  `attestor-target-id` in the reference forwarded-header list.

Fix:

- Client `attestor-target-id` is ignored by default.
- Using the client target header now requires explicit
  `allowClientTargetHeader: true`.
- Default Envoy/Istio rendered header lists no longer forward
  `attestor-target-id`.
- Deployment docs now state target IDs must come from server options, route
  context, or proxy-observed destination service unless an integration
  explicitly accepts client-header target labels.

Locking evidence:

- `tests/release-enforcement-plane-envoy-ext-authz.test.ts`

Boundary:

This closes the default client-header target-label trust path repo-side. It
does not prove live Envoy/Istio route-map deployment, live workload binding
extraction, customer PEP no-bypass, or production readiness.

## Positive Observations

- Credential-bound reviewer/requester authority remains intact.
- Webhook break-glass consumption remains enforced.
- Envoy binding still includes proxy-observed method, URI, body digest,
  destination service, source principal, and workload proof material.
- Evidence-pack DSSE/bundle verification still runs on read/write.

## Verdict

Repo-side remediation is complete for OPS-201, OPS-202, and OPS-203.
The webhook break-glass finding in this intake is stale/contradicted by
OPS-200 evidence.

Remaining proof is live/operator proof only:

- live role-key deployment
- live shared-store behavior
- live Envoy/Istio route-map proof
- external artifact-store retrieval
- customer PEP no-bypass
- production readiness
- enterprise readiness
