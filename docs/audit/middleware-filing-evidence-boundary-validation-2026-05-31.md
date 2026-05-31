# Middleware, Filing, And Declared Evidence Boundary Validation - 2026-05-31

## Recent Fixes Chain-Effect Check

- Source of truth: `origin/master`
- Source HEAD at validation start: `54c58035ce245bb0023cc333c9163a16e8e6db26`
- Recent relevant merge: token lifecycle, required sender-constraint, and
  token-exchange actor-boundary hardening.
- Direct regression found from the recent merge: none in this scope.
- Cross-fix interaction: the generic middleware is now aligned with the
  required-sender boundary. High-risk bearer-only presentations fail closed
  instead of relying on online introspection to make bearer safe.

## Validation Frame

Newest request in operational terms: validate the submitted middleware binding,
finance filing readiness, and evidence-like adapter metadata findings against
current repository evidence and primary sources; fix repo-proven issues; keep
public wording free of internal process references.

Trust surfaces:

- generic HTTP middleware binding headers -> release-token verification ->
  downstream handler execution
- finance filing readiness -> R4 filing release decision -> token issuance
- action/communication adapter metadata -> canonical binding -> receipt
  interpretation

Protected principles:

- proof integrity
- fail-closed boundary
- customer authority
- replay and idempotency safety
- auditability
- no overclaim

## Sources Checked

Repository evidence:

- `src/release-enforcement-plane/middleware.ts`
- `src/release-kernel/finance-record-release.ts`
- `src/financial/filing-readiness.ts`
- `src/service/http/routes/pipeline-execution-routes.ts`
- `src/release-enforcement-plane/action-dispatch.ts`
- `src/release-enforcement-plane/communication-send.ts`
- targeted release-enforcement, finance-release, action-dispatch, and
  communication-send tests

Official / primary sources:

- RFC 9421 HTTP Message Signatures: message signatures only cover selected
  components, and content integrity requires validating `Content-Digest`
  against the received content.
- RFC 9530 Digest Fields: `Content-Digest` communicates a digest calculated
  over actual HTTP message content.
- RFC 6750 Bearer Token Usage: bearer possession does not prove possession of
  cryptographic key material.
- OWASP Authorization Cheat Sheet: authorization should deny by default and
  prefer explicit configuration.

## Findings

### OPS-194 - Generic HTTP middleware trusted caller-supplied binding headers by default

Status: `repo-proven`, fixed repo-side.

The submitted finding was correct. The default middleware accepted
`attestor-target-id`, `attestor-output-hash`, and
`attestor-consequence-hash` request headers as the binding for verification
when server-side resolver options were absent. It also copied `Content-Digest`
or `attestor-body-digest` into the enforcement request without deriving it from
a trusted resolver or validating it against the body.

Fix:

- Default middleware now requires `targetId`, `outputHash`, and
  `consequenceHash` from trusted server-side resolvers.
- Header-derived binding is available only through explicit
  `bindingHeaderMode: 'trusted-upstream'`.
- Body digest is taken from a trusted resolver by default; header body digest is
  recorded only in explicit trusted-upstream mode.
- Middleware tests now prove caller-supplied binding headers fail closed by
  default, while explicit trusted-upstream mode remains visible as a separate
  integration mode.
- High-risk generic middleware bearer paths now fail closed under required
  sender constraints.

Locking evidence:

- `tests/release-enforcement-plane-middleware.test.ts`

Limit: this is repository-side middleware behavior. It does not prove live
customer PEP no-bypass, upstream gateway signature coverage, live body-digest
calculation, live workload extraction, or production readiness.

### OPS-195 - Finance filing release accepted readiness states below `internal_report_ready`

Status: `repo-proven`, fixed repo-side.

The submitted finding was correct. The finance filing bridge accepted a filing
release when receipt and escrow signals were present and
`filingReadiness.status !== 'blocked'`. That allowed `filing_not_ready` and
`review_ready` to satisfy the R4 release bridge even though the readiness layer
had not reached the internal-report-ready state.

Fix:

- Accepted filing release now requires
  `filingReadiness.status === 'internal_report_ready'`.
- The bridge also requires `totalGaps === 0` and `blockingGaps === 0`.
- Deterministic finance filing observations use the same readiness predicate,
  so the policy bridge and token-issuance path stay aligned.
- Tests cover `filing_not_ready`, `review_ready`, and inconsistent nonzero gap
  metadata as non-releasable.

Locking evidence:

- `tests/release-kernel-finance-record-release.test.ts`

Limit: this is repository-side release gating. It does not prove live filing
connector evidence, live sender confirmation, customer PEP no-bypass,
compliance readiness, or production readiness.

### OPS-196 - Action preconditions and communication attachment digests were evidence-like declarations

Status: `repo-proven`, fixed repo-side for declaration boundary and digest
syntax.

The submitted finding was correct as a no-overclaim boundary. Action
preconditions and communication attachment digests were canonicalized and bound
into the release hash, but the adapters did not fetch external evidence,
approval records, time-window truth, idempotency state, or attachment bytes.
The tests also accepted placeholder digest strings.

Fix:

- Action canonical payload now labels these inputs as
  `declaredPreconditions`.
- Communication canonical payload now labels attachment inputs as
  `declaredAttachments`.
- Precondition and attachment digest inputs now require
  `sha256:<64 lowercase hex>` syntax when present.
- Tests prove placeholder digest strings fail, while allowed paths continue to
  bind the declaration metadata.
- Architecture docs now state that canonical binding is not semantic evidence
  verification unless the embedding adapter verifies source evidence first.

Locking evidence:

- `tests/release-enforcement-plane-action-dispatch.test.ts`
- `tests/release-enforcement-plane-communication-send.test.ts`

Limit: this does not implement external evidence-store, approval-workflow, or
attachment-byte resolver hooks. Those remain future runtime integration work if
a customer path needs semantic verification before calling the adapters.

## Positive Observations

- The stricter record-write, action-dispatch, and communication-send adapters
  already derive canonical target/output/consequence hashes from structured
  adapter input rather than trusting caller binding headers.
- The finance filing route already required sender confirmation before token
  issuance; this pass tightens the readiness condition that can reach that
  issuance branch.
- The required sender-constraint hardening from the previous pass remains
  intact and now affects generic middleware high-risk bearer paths.

## Chain Effects

- Caller-supplied binding headers can no longer make the default generic
  middleware verify one action while the handler receives another payload.
- `filing_not_ready` and `review_ready` finance reports no longer produce an
  accepted R4 filing release decision or filing release token.
- Receipts and canonical hashes now distinguish declaration binding from
  verified evidence truth for action preconditions and communication
  attachments.
- Customer PEP no-bypass, live shared stores, live body digest verification,
  live upstream signature coverage, and production readiness remain separate
  proof surfaces.

## Verdict

- OPS-194: fixed repo-side.
- OPS-195: fixed repo-side.
- OPS-196: fixed repo-side for declaration naming and digest syntax.

No production readiness, compliance readiness, live customer PEP no-bypass
proof, live upstream-gateway proof, live evidence-store proof, or enterprise
readiness is claimed by this validation.

## Final Checkpoint

Scoped remediation is repo-side complete after the listed checks and PR merge.
Live proof and operator/deployment proof remain separate.
