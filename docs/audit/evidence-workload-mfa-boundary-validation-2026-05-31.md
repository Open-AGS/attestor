# Evidence, Workload, And MFA Boundary Validation - 2026-05-31

## Recent Fixes Chain-Effect Check

- Source of truth: `origin/master`
- Source HEAD at validation start: `0c9e2592a838cec4203c1107339224aa696ba5a0`
- Recent relevant merge: account and policy boundary hardening on `origin/master`.
- Direct regression found from the recent merge: none in this scope.
- Cross-fix interaction: financial evidence quality, release-token workload binding,
  and account MFA enrollment freshness all feed higher-authority paths, but they
  do not change the Customer PEP no-bypass boundary.

## Validation Frame

Newest request in operational terms: validate the submitted evidence,
workload-binding, and TOTP enrollment boundary findings against current
repository evidence and primary sources; fix repo-proven issues; keep public
wording free of internal process references.

Trust surfaces:

- financial execution evidence -> data contract -> score/release evidence
- release-token workload confirmation -> downstream PEP verification
- TOTP pending enrollment -> confirmation -> account security state

Protected principles:

- proof integrity
- fail-closed boundary
- customer authority
- replay and idempotency safety
- auditability
- no overclaim

## Sources Checked

Repository evidence:

- `src/financial/data-contracts.ts`
- `src/financial/types/base.ts`
- `src/financial/scoring.ts`
- `src/release-enforcement-plane/offline-verifier.ts`
- `src/release-enforcement-plane/workload-binding.ts`
- `src/release-enforcement-plane/envoy-ext-authz.ts`
- `src/release-enforcement-plane/action-dispatch.ts`
- `src/release-enforcement-plane/record-write.ts`
- `src/crypto-authorization-core/enforcement-plane-verification.ts`
- `src/service/account/account-mfa.ts`
- `src/service/http/routes/account-mfa-passkey-routes.ts`
- relevant financial, release-enforcement-plane, crypto-authorization, and
  account-route tests

Official / primary sources:

- JSON Schema numeric reference: numeric validation rejects numbers represented
  as strings and range constraints apply to numeric values.
- RFC 8705: certificate-bound access tokens require the protected resource to
  ensure the presented token belongs to the client presenting the certificate;
  TLS-termination metadata forwarding is an integration trust boundary.
- SPIFFE concepts: SPIFFE IDs identify workloads inside trust domains, and SVIDs
  are the cryptographically verifiable documents used to prove workload identity.
- OWASP MFA Cheat Sheet: OTP flows should use short TTLs, single-use handling,
  and strict attempt limits; sensitive account actions may require MFA.
- NIST SP 800-63B: authentication events and authenticator lifecycle management
  are scoped by verifier control, authenticator possession, and session
  reauthentication requirements.

## Findings

### OPS-185 - Financial data contracts allowed typed numeric evidence to pass without numeric values

Status: `repo-proven`, fixed repo-side.

The submitted finding was correct for the scoped financial contract path.
`DataContractColumn.type` declared scalar column types and `ExecutionEvidence`
could carry `columnTypes`, but schema matching only checked column presence.
Numeric constraints such as `non_negative`, `range`, `min`, `max`, `sum_equals`,
and control totals could ignore all non-numeric row values and still pass if no
numeric failure was observed.

Fix:

- Data contracts now compare declared column type metadata where evidence
  provides it.
- Row values are checked against the declared contract type, while nullable
  fields can still be absent/null when allowed.
- Numeric constraints fail hard when the target column is missing, has
  non-numeric constrained values, or has zero numeric values.
- Control totals now fail hard on missing, non-numeric, or empty numeric input.

Locking evidence:

- `tests/financial-data-contracts.test.ts`
- `tests/financial.test.ts`

Limit: this is repository-side validation. It does not prove live connector
schema quality, live financial provider output, production filing readiness, or
compliance readiness.

### OPS-186 - Workload-bound release verification accepted metadata-only proof

Status: `repo-proven`, fixed repo-side.

The submitted finding was correct for the scoped offline verifier path. The
workload-binding helper supported trusted expected certificate and SPIFFE
values, but the offline verifier did not require such trusted values when a
release presentation claimed `mtls-bound-token` or `spiffe-bound-token`.
That let a caller-presented presentation object satisfy local binding by
repeating the token's confirmation metadata.

Fix:

- Offline release verification now requires a trusted workload binding for
  mTLS/SPIFFE-bound presentations.
- Missing trusted workload proof fails closed with `missing-workload-proof`.
- Envoy ext_authz derives the trusted binding from the proxy-observed canonical
  workload binding and trusted headers.
- Action dispatch, record write, and crypto authorization wrappers can pass the
  trusted binding through to the verifier.
- Tests now distinguish metadata-only presentation from trusted PEP-observed
  workload identity.

Locking evidence:

- `tests/release-enforcement-plane-workload-binding.test.ts`
- `tests/release-enforcement-plane-offline-verifier.test.ts`
- `tests/release-enforcement-plane-action-dispatch.test.ts`
- `tests/release-enforcement-plane-record-write.test.ts`
- `tests/release-enforcement-plane-online-verifier.test.ts`
- `tests/release-enforcement-plane-token-exchange.test.ts`
- `tests/crypto-authorization-core-enforcement-verification.test.ts`

Limit: this is repository-side fail-closed behavior and integration plumbing. It
does not prove a live Envoy/Istio route map, live SPIFFE bundle validation, live
mTLS extraction, customer PEP no-bypass, or production readiness.

### OPS-187 - Pending TOTP enrollment could be confirmed without freshness or password recheck

Status: `repo-proven`, fixed repo-side.

The submitted finding was correct for the scoped account route path. TOTP enroll
stored a pending encrypted secret and `pendingIssuedAt`, but confirmation only
required a session and TOTP code. It did not reject stale or missing
`pendingIssuedAt`, and it did not re-check the current password before turning
the pending secret into an active MFA factor.

Fix:

- Pending TOTP enrollment now has a repository-defined freshness check.
- Confirmation requires the current password and records failed password
  attempts through the existing account password path.
- Missing, invalid, future, or expired pending enrollment state fails closed and
  clears the pending secret before returning a bounded error.
- Expired pending enrollment is audit-recorded without exposing the secret.

Locking evidence:

- `tests/account-mfa-replay.test.ts`
- `tests/service-account-routes-authorization.test.ts`

Limit: this is repository-side route behavior. It does not prove deployed
account-route probes, shared abuse-store behavior under live traffic, or
production account-security posture.

## Positive Observations

- Financial contracts already separated hard and soft checks; the fix tightens
  the hard evidence semantics without changing that contract shape.
- Workload-binding primitives already had hooks for expected certificate and
  SPIFFE data; the fix moves the verifier boundary to require those hooks for
  workload-bound presentations.
- TOTP secret material remains encrypted at rest, replay-protected by accepted
  time-step tracking, and redacted from audit output.

## Chain Effects

- Financial scoring now receives stricter contract results when typed numeric
  evidence is malformed.
- Workload-bound offline verification can no longer be made locally successful
  by metadata echoed from the request body alone.
- TOTP pending enrollment state is no longer treated as reusable indefinitely.
- The Customer PEP boundary is unchanged: repository checks and route wrappers
  still do not prove non-bypassable customer-side enforcement.

## Verdict

- OPS-185: fixed repo-side.
- OPS-186: fixed repo-side.
- OPS-187: fixed repo-side.

No production readiness, compliance readiness, live connector proof, live
mTLS/SPIFFE extraction proof, live shared-store proof, customer PEP no-bypass
proof, or enterprise readiness is claimed by this validation.

## Final Checkpoint

Scoped remediation is repo-side complete after the listed checks and PR merge.
Live proof remains separate.
