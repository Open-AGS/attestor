# Release Review, Evidence, And Break-Glass Boundary Validation - 2026-05-31

## Recent Fixes Chain-Effect Check

- Source of truth: `origin/master`
- Source HEAD at validation start: `4ef563263a75a4304b642c8f36d35f4702248aa3`
- Recent relevant merge: middleware binding, finance filing readiness, and
  declared adapter evidence hardening.
- Stale carryovers: generic middleware caller-header binding and release-token
  lifecycle reset findings are contradicted by current OPS-194 and OPS-191
  repository evidence.
- Direct regression found from the recent merge: none in this scope.

## Validation Frame

Newest request in operational terms: validate the supplied release-review,
evidence-pack, and webhook break-glass findings against current repository
evidence and primary sources; fix repo-proven gaps; keep public wording free of
internal-process references.

Trust surfaces:

- release-review admin routes -> reviewer identity -> token issuance
- release-review override route -> emergency authority -> token/evidence output
- release evidence-pack issuer -> artifact references -> DSSE statement
- webhook receiver -> degraded break-glass admission -> receipt/audit output

Protected principles:

- customer authority
- proof integrity
- fail-closed boundary
- auditability
- replay and idempotency safety
- no overclaim

## Sources Checked

Repository evidence:

- `src/service/http/routes/release-review-routes.ts`
- `src/service/http/release-admin-authorization.ts`
- `src/release-kernel/reviewer-queue.ts`
- `src/release-kernel/release-token.ts`
- `src/release-kernel/release-evidence-pack.ts`
- `src/release-enforcement-plane/webhook-receiver.ts`
- `src/release-enforcement-plane/degraded-mode.ts`
- targeted release-review, evidence-pack, webhook, and restart-recovery tests

Official / primary sources:

- OWASP Authorization Cheat Sheet: authorization decisions should be
  server-side, explicit, and deny by default.
- NIST SP 800-63B / SP 800-63-4: authenticated subjects and authenticators
  must be bound to the account/session that is being relied on.
- in-toto Statement v1: a signed statement identifies subjects and digests; it
  does not by itself fetch or prove every referenced external artifact.
- DSSE protocol: the signature protects the envelope payload; artifact
  retrieval and digest matching are separate verifier responsibilities.

## Findings

### OPS-197 - Release-review approval identity was request-body supplied

Status: `repo-proven`, fixed repo-side.

The approve and reject routes were role-gated, but passed `reviewerId`,
`reviewerName`, and `reviewerRole` from the request body into the reviewer
queue transition. Two requests using the same admin credential could submit two
different reviewer IDs and satisfy dual approval.

Fix:

- Approval and rejection reviewer identity now comes from the authenticated
  role-scoped admin credential.
- Body reviewer fields remain request metadata only; they do not become
  reviewer authority.
- The route audit metadata records the credential-bound reviewer id/role.
- A route test proves one release-admin credential cannot satisfy both sides of
  dual review by changing body `reviewerId`.

Locking evidence:

- `tests/release-review-admin-routes.test.ts`

Limit: this proves repository-side route identity binding. It does not prove a
live enterprise IdP, independent human-review workflow, role-key deployment, or
production readiness.

### OPS-198 - Release-review override requester was request-body supplied

Status: `repo-proven`, fixed repo-side.

The override route was break-glass role-gated, but `requestedById`,
`requestedByName`, and `requestedByRole` came from the request body and became
part of the override summary, token path, and evidence output.

Fix:

- Override requester identity now comes from the authenticated break-glass
  credential.
- Body requester fields no longer supply emergency authority.
- Override token issuance recognizes the credential-derived
  `policy-break-glass` role.
- The queue stores the credential actor type instead of turning the service
  credential into a user actor.
- A route test proves spoofed body requester fields do not replace the
  credential-bound requester.

Locking evidence:

- `tests/release-review-admin-routes.test.ts`

Limit: this does not implement an external incident-management approval
workflow. Live/operator proof remains required before claiming independently
authenticated emergency approval.

### OPS-199 - Evidence packs signed unresolved artifact references too strongly

Status: `repo-proven`, fixed repo-side for declaration boundary and digest
syntax.

The evidence-pack issuer accepted caller-provided artifact references and
included them beside internally derived artifacts in the signed pack. The
issuer did not fetch the referenced artifact or prove the path matched the
digest, so a consumer could read the DSSE-valid pack as stronger proof than the
repository actually produced.

Fix:

- Internally generated artifacts are labelled `issuer-derived`.
- Caller-provided artifact references are labelled `declared-unverified`.
- Caller-provided artifact digests must use strict
  `sha256:<64 lowercase hex>` syntax.
- The pipeline evidence-pack path now emits a strict digest even when the
  older finance evidence-chain terminal value is a short local chain marker.
- Tests prove malformed declared artifact digests fail and the signed pack
  distinguishes declared references from issuer-derived artifacts.

Locking evidence:

- `tests/release-kernel-release-evidence-pack.test.ts`
- `tests/release-evidence-pack-store.test.ts`
- `tests/production-runtime-restart-recovery.test.ts`

Limit: this does not add an external artifact resolver or prove artifact byte
availability. Declared artifact references remain declaration-level evidence
until a customer/runtime artifact store verifies retrieval and digest match.

### OPS-200 - Webhook break-glass grant did not consume a use budget

Status: `repo-proven`, fixed repo-side for the receiver contract.

The webhook receiver could accept a resolver-supplied break-glass grant after
local signature verification when online introspection was unavailable. That
path checked only grant timestamps and TTL, not central degraded-mode
consumption or a use budget.

Fix:

- A raw `breakGlassGrant` is no longer enough to admit a webhook request.
- Break-glass admission requires `consumeBreakGlassGrant` to return an active
  consumed grant for the exact evaluated request.
- The consumer input includes the request, signature, verification result,
  original failure reasons, and receiver context so integrations can bind the
  consumption to degraded-mode store state and scope.
- Tests prove raw grants stay rejected, a consumed one-use grant admits once,
  and the second use is rejected.

Locking evidence:

- `tests/release-enforcement-plane-webhook-receiver.test.ts`
- `tests/release-enforcement-plane-degraded-mode.test.ts`

Limit: this is a repository-side contract and in-memory/file-store behavior
test. Live shared degraded-mode store proof, multi-instance replay behavior,
and customer PEP no-bypass proof remain separate.

## Positive Observations

- Release-admin route access was already role-scoped and credential-bound; this
  pass connected that credential-bound actor to reviewer and override authority.
- Evidence-pack verification already validates DSSE signature and internal
  statement consistency; this pass narrows artifact-reference interpretation.
- The webhook receiver already verifies the signed HTTP message and body digest
  before considering break-glass; this pass adds use-budget consumption to the
  emergency path.

## Chain Effects

- One admin credential can no longer close dual approval by changing body
  reviewer IDs.
- Break-glass override evidence no longer attributes requester identity to
  body-supplied fields.
- DSSE-valid evidence packs now distinguish issuer-derived material from
  declared, unresolved references.
- Webhook break-glass acceptance can be wired to the central degraded-mode
  grant store instead of accepting reusable raw grants.
- Customer PEP no-bypass, live shared stores, live role-key deployment, KMS,
  production deployment, and enterprise readiness remain separate proof
  surfaces.

## Verdict

- OPS-197: fixed repo-side.
- OPS-198: fixed repo-side.
- OPS-199: fixed repo-side for declaration boundary and digest syntax.
- OPS-200: fixed repo-side for receiver consumption contract and tests.

No production readiness, compliance readiness, live customer PEP no-bypass
proof, live shared-store proof, live role-key deployment proof, or enterprise
readiness is claimed by this validation.

## Final Checkpoint

Scoped remediation is repo-side complete after the listed checks and PR merge.
Live proof and operator/deployment proof remain separate.
