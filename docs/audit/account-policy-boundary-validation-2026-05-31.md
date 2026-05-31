# Account And Policy Boundary Validation - 2026-05-31

## Recent Fixes Chain-Effect Check

- Source of truth: `origin/master`
- Source HEAD at validation start: `9d467a597a95dbbc88d02dc14036489c6f850fb1`
- Recent relevant merge: PR `#767`, pipeline release token tenant/sender boundary.
- Direct regression found from PR `#767`: none in this scope.
- Cross-fix interaction: account action-token replay and policy-bundle provenance are adjacent high-authority surfaces, but not the same release-token path as PR `#767`.

## Validation Frame

Newest request in operational terms: validate the submitted account, DPoP, and policy-bundle boundary report against current repository evidence and primary sources; fix repo-proven issues; do not publish process-tool references.

Trust surfaces:

- account invite/password-reset/MFA/passkey action tokens
- DPoP proof request binding
- release-policy bundle publication and signed-bundle provenance

Protected principles:

- replay and idempotency safety
- customer authority
- proof integrity
- fail-closed boundary
- auditability
- no overclaim

## Sources Checked

Repository evidence:

- `src/service/application/account-user-management-service.ts`
- `src/service/http/routes/account-mfa-passkey-routes.ts`
- `src/service/account/account-user-token-store.ts`
- `src/service/control-plane-store/account-auth-state.ts`
- `src/release-enforcement-plane/dpop.ts`
- `tests/release-enforcement-plane-dpop.test.ts`
- `src/service/http/routes/release-policy-control-pack-routes.ts`
- `src/service/http/routes/release-policy-control-route-context.ts`
- `src/release-policy-control-plane/store-records.ts`
- `src/release-policy-control-plane/bundle-signing.ts`
- `tests/service-account-user-management-service.test.ts`
- `tests/service-account-routes-authorization.test.ts`
- `tests/release-policy-control-plane-admin-routes.test.ts`
- `tests/release-policy-control-plane-store.test.ts`

Official / primary sources:

- OWASP Forgot Password Cheat Sheet: reset tokens should be random, stored securely, single use, and expire.
- W3C WebAuthn Level 3: challenges are generated server-side and matched to prevent replay.
- RFC 9449: DPoP `htu` is the HTTP target URI without query and fragment; verification ignores query and fragment.
- SLSA verifying artifacts guidance: provenance verification includes signature verification on the provenance envelope.

## Findings

### OPS-182 - Account action tokens were consumed after account/session side effects

Status: `repo-proven`, fixed repo-side.

The submitted report was correct for the scoped account paths. Invite acceptance and password reset looked up a usable one-time token, then performed account/session side effects before checking a successful consume result. MFA and passkey routes also performed credential/session side effects after an initial challenge lookup and only consumed the challenge later.

Fix:

- Account invite acceptance now claims the invite token before creating the user or issuing a session.
- Password reset now claims the reset token before changing the password or revoking sessions.
- Passkey authentication, MFA verification, and passkey registration now claim the challenge before credential/session side effects.
- Shared PostgreSQL action-token consumption now uses a single conditional `UPDATE ... WHERE ... RETURNING` claim instead of list/read/modify/write.

Locking evidence:

- `tests/service-account-user-management-service.test.ts`
- `tests/service-account-routes-authorization.test.ts`

Limit: this is repository-side behavior. It does not prove deployed multi-replica database posture, production account security, or live operator configuration.

### OPS-183 - DPoP query stripping claim is contradicted by RFC 9449

Status: `contradicted`, no code change.

The submitted report claimed DPoP query stripping weakens `htu` binding. Current repository code does strip query and fragment from DPoP `htu`, and `tests/release-enforcement-plane-dpop.test.ts` explicitly locks that behavior. RFC 9449 defines `htu` as the HTTP target URI without query and fragment, and its verification step compares while ignoring query and fragment.

Verdict: this is not a DPoP implementation bug as stated.

Boundary: DPoP is a sender-constrained token proof, not full HTTP message integrity. If a route needs exact query/body/header binding for a consequence, that must be carried by stronger Attestor-specific consequence/output/token binding or by HTTP Message Signatures, not by changing RFC 9449 DPoP semantics.

### OPS-184 - Policy bundle publication could store a signed object without verifying the signature

Status: `repo-proven`, fixed repo-side.

The submitted report was correct for the policy bundle publish path. The route accepted a body-supplied `signedBundle` and `verificationKey`, while the store checked artifact coherence and key id matching but did not cryptographically verify the DSSE signature before storing or reporting `signed: true`.

Fix:

- Bundle publish pre-verifies `signedBundle` before writing pack/bundle state.
- Store normalization also verifies any signed bundle before persistence, so direct store callers get the same fail-closed boundary.
- Bundle summaries now expose `signatureStatus: verified | unsigned` alongside the existing `signed` boolean.
- Invalid DSSE signatures map to bounded `400` route errors.

Locking evidence:

- `tests/release-policy-control-plane-admin-routes.test.ts`
- `tests/release-policy-control-plane-store.test.ts`

Limit: this is repository-side DSSE verification. It does not prove external KMS/HSM signing, live signer custody, customer deployment, or compliance readiness.

## Positive Observations

- Account token records are hashed at rest and already carry expiry, revocation, attempt count, and purpose fields.
- WebAuthn challenge parsing and verification were present before this fix; the gap was claim ordering, not missing cryptographic challenge verification.
- DPoP behavior is aligned with RFC 9449 for `htu` query/fragment handling.
- A policy bundle verifier already existed and checked key id, signer fingerprint, payload digest, DSSE signature, and canonical payload; the missing part was routing/store enforcement.

## Verdict

- OPS-182: fixed repo-side.
- OPS-183: contradicted by primary source; no code change.
- OPS-184: fixed repo-side.

No production readiness, compliance readiness, external KMS/HSM proof, customer PEP no-bypass proof, live shared-store proof, or enterprise readiness is claimed by this validation.

## Final Checkpoint

Scoped remediation is repo-side complete after the listed checks and PR merge. Live proof remains separate.
