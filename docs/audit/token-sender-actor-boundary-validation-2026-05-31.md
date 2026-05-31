# Token, Sender, And Actor Boundary Validation - 2026-05-31

## Recent Fixes Chain-Effect Check

- Source of truth: `origin/master`
- Source HEAD at validation start: `eed0beba6a85aef2eac04809b56a0ce12f0b40c6`
- Recent relevant merge: exchange, break-glass, and recovery boundary hardening.
- Direct regression found from the recent merge: none in this scope.
- Cross-fix interaction: this pass tightens token lifecycle finality,
  sender-constrained verification, and token-exchange actor provenance without
  changing the Customer PEP no-bypass boundary.

## Validation Frame

Newest request in operational terms: validate the submitted token lifecycle,
sender-constraint, and actor-provenance boundary findings against current
repository evidence and primary sources; fix repo-proven issues; keep public
wording free of internal process references.

Trust surfaces:

- release-token issuance -> registry/introspection store -> revocation and
  consumption lifecycle
- sender-constrained profile -> verifier -> default middleware path
- token exchange -> actor provenance -> child-token authority and audit chain

Protected principles:

- proof integrity
- fail-closed boundary
- customer authority
- replay and idempotency safety
- auditability
- no overclaim

## Sources Checked

Repository evidence:

- `src/release-kernel/release-introspection.ts`
- `src/service/release/release-token-introspection-store.ts`
- `src/release-enforcement-plane/offline-verifier.ts`
- `src/release-enforcement-plane/online-verifier.ts`
- `src/release-enforcement-plane/token-exchange.ts`
- release-token introspection, shared-store, verifier, workload-binding, and
  token-exchange tests

Official / primary sources:

- RFC 7662 token introspection: active state covers issued, unexpired, and
  unrevoked token state.
- RFC 8705 mutual-TLS certificate-bound tokens: sender-constrained tokens are
  not bearer tokens.
- RFC 9449 DPoP: proof-of-possession requires a matching per-request proof.
- RFC 8693 token exchange: delegated actor material is a token-exchange input,
  not an arbitrary downstream audit label.
- PostgreSQL `INSERT ... ON CONFLICT`: `DO UPDATE` mutates the existing row;
  `DO NOTHING RETURNING` supports insert-only conflict detection.

## Findings

### OPS-191 - Duplicate release-token registration could restore inactive token IDs

Status: `repo-proven`, fixed repo-side.

The submitted finding was correct. The in-memory/file-backed release-token
registry replaced existing rows during registration. The shared PostgreSQL
store used `ON CONFLICT (token_id) DO UPDATE`, which could reset a revoked,
expired, or consumed token ID back to `issued` if a later issuance reused the
same token ID.

Fix:

- Registration is now insert-only.
- Re-registering an already issued, bit-for-bit identical token is treated as
  idempotent replay.
- Re-registering a revoked, consumed, expired, or different existing token ID
  fails closed.
- Shared PostgreSQL registration now uses `ON CONFLICT DO NOTHING RETURNING`
  plus a locked reload of the conflicting row.
- Token exchange denies duplicate child token IDs before returning a child
  authority artifact, and also converts registry-conflict errors into a
  bounded exchange denial.

Locking evidence:

- `tests/release-kernel-release-introspection.test.ts`
- `tests/release-token-introspection-store.test.ts`
- `tests/release-enforcement-plane-token-exchange.test.ts`

Limit: this is repository-side lifecycle finality. It does not prove live
shared introspection behavior, multi-instance routing, or Customer PEP
no-bypass.

### OPS-192 - Required sender constraint was not enforced by the core verifier

Status: `repo-proven`, fixed repo-side.

The submitted finding was correct. R3/R4 profiles could mark sender constraint
as required while still listing bearer in parser-supported presentation modes.
The core offline verifier only checked whether the presentation mode was listed
as allowed, so a bearer presentation could reach later validation under a
required-sender profile. The online verifier inherited that behavior.

Fix:

- The offline verifier now rejects any presentation mode outside
  `senderConstrainedPresentationModes` when the resolved profile requires a
  sender constraint.
- Online verification now stops before active-state introspection if the
  required sender proof is missing.
- Existing workload-bound mTLS/SPIFFE paths remain valid when trusted binding
  evidence is supplied.

Locking evidence:

- `tests/release-enforcement-plane-offline-verifier.test.ts`
- `tests/release-enforcement-plane-online-verifier.test.ts`
- `tests/release-enforcement-plane-workload-binding.test.ts`
- `tests/release-enforcement-plane-verification-profiles.test.ts`

Limit: this does not prove live TLS/SPIFFE extraction, deployed Envoy/Istio
route-map behavior, or downstream Customer PEP no-bypass.

### OPS-193 - Token-exchange request-body actor satisfied actor-required policy

Status: `repo-proven`, fixed repo-side for the exchange API contract.

The submitted finding was correct. `ReleaseTokenExchangeRequest.actor` was
accepted from request data and could satisfy `requireActor`. The resulting
child token could carry that actor claim even though the exchange path did not
verify an independent actor source.

Fix:

- Token exchange now separates request-body actor metadata from
  `trustedActor`.
- If `requireActor` is true and a request-body actor is supplied without a
  trusted actor source, exchange fails closed with `actor-proof-required`.
- If request actor metadata conflicts with the trusted actor authority tuple,
  exchange fails with `actor-proof-mismatch`.
- Issued child tokens and derived exchange decisions use the trusted actor
  source, or a signed parent actor claim if present.

Locking evidence:

- `tests/release-enforcement-plane-token-exchange.test.ts`

Limit: this adds a repository contract for trusted actor binding; it does not
implement live account-session, mTLS/SPIFFE, or actor-token extraction. Raw
external actor-token validation remains unsupported.

## Positive Observations

- Parent-token active-state introspection and child-store requirements from the
  previous exchange hardening remain intact.
- Workload-bound mTLS/SPIFFE verification already had trusted expected binding
  inputs; this pass reuses that pattern instead of trusting caller-presented
  metadata.
- Token lifecycle operations still keep revoke/use paths under file locks or
  PostgreSQL row locks.

## Chain Effects

- Revoked, consumed, or expired release-token IDs cannot be reset by duplicate
  registration.
- Required sender-constrained profiles no longer accept bearer-only
  presentations through the core verifier or online verifier composition.
- Token exchange no longer treats body-supplied actor labels as proof of actor
  authority.
- Customer PEP no-bypass, live shared-store proof, live workload extraction,
  and production readiness remain separate proof surfaces.

## Verdict

- OPS-191: fixed repo-side.
- OPS-192: fixed repo-side.
- OPS-193: fixed repo-side for the repository exchange contract.

No production readiness, compliance readiness, live shared-store proof, live
workload extraction proof, customer PEP no-bypass proof, or enterprise
readiness is claimed by this validation.

## Final Checkpoint

Scoped remediation is repo-side complete after the listed checks and PR merge.
Live proof and operator/deployment proof remain separate.
