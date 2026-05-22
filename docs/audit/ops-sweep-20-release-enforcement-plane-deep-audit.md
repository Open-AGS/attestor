# Ops Sweep 20 - Release-Enforcement-Plane Deep Audit

Status: read-only audit. No remediation written during the sweep. No runtime
source changed by this report. This is engine-substrate sweep 3/N and covers
the runtime enforcement layer that consumes release tokens produced by the
release-kernel decision engine.

Remediation follow-up: OPS-155 is repo-side closed by the frozen DPoP default
algorithm allowlist test. OPS-158 is repo-side closed by validated Envoy
`attestor.risk_class` route context binding, explicit server-option precedence,
invalid-value fail-closed behavior, and deployment docs that keep the module
fallback risk class out of production route policy.

## 0. Recent Fixes Chain-Effect Check

One merge into `origin/master` since Sweep 19 was drafted:

- PR #526 / commit `54e12e69` - "Add Sweep 19 release-kernel audit"
- Merge head `05a7cd050e842a183cfeb2747c62e9fe8f8e854a`

Files changed by PR #526 were docs-only: the Sweep 19 report and index updates.

Chain-effect verdict: PR #526 does not touch
`src/release-enforcement-plane/**` or enforcement-plane test files. No
regression, config drift, defense-in-depth weakening, or closed-finding
reopening was found in the Sweep 20 scope.

Open Sweep 19 findings remain independent: OPS-147/148/151 are still
documentation or parity-test work, and do not block this enforcement-plane
audit.

## 1. Validation Frame

| Field | Value |
|---|---|
| Source of truth HEAD | `origin/master @ 05a7cd050e842a183cfeb2747c62e9fe8f8e854a` |
| Phase | Phase 1 - Live Shadow Readiness; substrate for Phase 2 - Limited Live Enforcement |
| Baseline blocker in scope | Top Blocker P0 `Customer PEP no-bypass`; `Token / replay / idempotency` score 8; `Enforcement boundary` score 7 |
| Protected principles | enforcement boundary; customer authority; replay and idempotency safety; fail-closed boundary; proof integrity; auditability; tenant isolation; no overclaim |
| Audit driver | Sweep 19 verdict: release-enforcement-plane is the runtime counterpart to the release-kernel decision layer and is the natural Phase 2 substrate |
| External anchors | RFC 9449 (DPoP); RFC 9421 (HTTP Message Signatures); RFC 8693 (OAuth 2.0 Token Exchange); RFC 8705 (mTLS certificate-bound access tokens, `x5t#S256`); RFC 7515 (JWS); RFC 7517 (JWK); SPIFFE/SPIRE workload identity; Envoy ext_authz v3 |
| Scope | 22 files in `src/release-enforcement-plane/` totaling 16,972 lines; 20 dedicated `tests/release-enforcement-plane*.test.ts` files totaling 12,271 lines; 2 related freshness/replay tests |

## 2. Inspected Files

| File | Lines | Depth | Evidence source | Why selected |
|---|---:|---|---|---|
| `src/release-enforcement-plane/dpop.ts` | 555 | targeted-deep | local matches `origin/master` | RFC 9449 DPoP-bound presentation: `ath`, `jti`, `htm`, `htu`, `iat`, replay key, algorithm allowlist |
| `src/release-enforcement-plane/online-verifier.ts` | 607 | targeted | local matches `origin/master` | Composes offline verifier and introspection; `consumeOnSuccess` and inactive-reason mapping |
| `src/release-enforcement-plane/offline-verifier.ts` | 941 | export inventory | local matches `origin/master` | Local release verification context and expected bindings |
| `src/release-enforcement-plane/middleware.ts` | 781 | export inventory | local matches `origin/master` | Hono and Node middleware variants; allowed/denied/skipped status surface |
| `src/release-enforcement-plane/freshness.ts` | 820 | export inventory | local matches `origin/master` | Freshness, replay, nonce, and per-risk-class baseline rules |
| `src/release-enforcement-plane/http-message-signatures.ts` | 1,142 | export inventory | local matches `origin/master` | RFC 9421-style HTTP message signature presentation; Ed25519-only narrowing |
| `src/release-enforcement-plane/workload-binding.ts` | 457 | export inventory | local matches `origin/master` | RFC 8705 `x5t#S256` and SPIFFE binding helpers |
| `src/release-enforcement-plane/token-exchange.ts` | 697 | export inventory | local matches `origin/master` | RFC 8693 token-exchange grant type and Attestor release token type |
| `src/release-enforcement-plane/envoy-ext-authz.ts` | 1,571 | export inventory | local matches `origin/master` | Envoy ext_authz bridge, default verifier mode, dynamic metadata, per-route risk-class default |
| `src/release-enforcement-plane/degraded-mode.ts` | 1,128 | export inventory | local matches `origin/master` | Cache-only and break-glass bounds, max-uses default, audit action surface |
| `src/release-enforcement-plane/verification-profiles.ts` | 495 | export inventory | local matches `origin/master` | Verification profile matrix and sender-constraint requirements |
| `tests/release-enforcement-plane*.test.ts` | 20 files / 12,271 lines | inventory | `git ls-tree` + local counts | Regression-lock signal for the major enforcement-plane modules |
| `tests/crypto-authorization-core-replay-freshness.test.ts`; `tests/f4-presentation-freshness-nonce-validation.test.ts` | related tests | inventory | `git ls-tree` | Additional freshness/replay coverage that predates the release-enforcement-plane naming convention |

## 3. Skipped Files

| File / path | Why skipped | Risk of skipping | Queue priority |
|---|---|---|---|
| Full bodies of the 22 enforcement-plane files | The surface is 16,972 lines; one sweep cannot honestly do line-by-line behavioral review of every path | medium | Future sub-sweeps: DPoP, offline verifier, Envoy ext_authz, token exchange, degraded mode |
| `action-dispatch.ts`, `communication-send.ts`, `record-write.ts`, `webhook-receiver.ts`, `async-envelope.ts` | Downstream consequence dispatchers reached after verifier/middleware gates; dedicated tests exist | low to medium | Dedicated dispatch/consequence sub-sweep if a module-specific risk appears |
| `authorization-headers.ts`, `conformance.ts`, `object-model.ts`, `telemetry.ts`, `types.ts`, `index.ts` | Contracts, conformance helpers, telemetry hooks, types, and barrel exports | low | No immediate queue |

Honesty disclosure: this sweep is spec + entry-point + export-inventory + test
inventory deep, not full line-by-line behavioral coverage. That limit is
tracked as OPS-154.

## 4. Positive Observations

| ID | Observation | Evidence (`origin/master`) | Why it matters |
|---|---|---|---|
| OPS20-POS-01 | DPoP uses explicit asymmetric algorithm types and rejects `none` and `HS*` symmetric algorithms | `dpop.ts:37-43`, `dpop.ts:201-209` | Algorithm-confusion risk is bounded at verifier level |
| OPS20-POS-02 | DPoP validates `typ = dpop+jwt`, required claims, and rejects JWK headers containing private key material | `dpop.ts:373-391`, `dpop.ts:384` | Matches the RFC 9449 proof shape and prevents private-key leakage in the proof header |
| OPS20-POS-03 | DPoP proof time validation has bounded max age and clock skew | `dpop.ts:255-273` | Replay window is explicitly bounded |
| OPS20-POS-04 | DPoP replay integration exposes `dpopReplayKey(proofJti)` and accepts a replay-ledger entry | `dpop.ts:81-93`, `dpop.ts:250`, `dpop.ts:468` | Proof replay can be checked separately from token replay |
| OPS20-POS-05 | DPoP `ath` support binds the proof to the specific access token hash | `dpop.ts:425`; RFC 9449 Section 7 requires `ath` for protected resource access | Prevents substituting one access token under another proof |
| OPS20-POS-06 | Online verifier composes offline verification with introspection and supports `consumeOnSuccess` | `online-verifier.ts:47-53`, `online-verifier.ts:551-555` | One-shot token consumption is available at the runtime boundary |
| OPS20-POS-07 | Introspection inactive reasons map to typed enforcement failure reasons | `online-verifier.ts:91-111` | No ambiguous deny result for revoked, expired, replayed, unknown, or claim-mismatch tokens |
| OPS20-POS-08 | Middleware status is explicitly `allowed`, `denied`, or `skipped` | `middleware.ts:80-81` | The gate does not collapse skip into allow |
| OPS20-POS-09 | Middleware declares canonical Attestor transport and audit headers | `middleware.ts:69-72` | Token, idempotency, request-id, and enforcement-status headers are contracted |
| OPS20-POS-10 | Middleware provides Hono and Node variants over the same result shape | `middleware.ts:691`, `middleware.ts:752` | Platform-specific integration does not require a separate enforcement model |
| OPS20-POS-11 | HTTP Message Signatures are intentionally narrowed to Ed25519 and SHA-256 content digest | `http-message-signatures.ts:38-41`; RFC 9421 allows several algorithms | The repo chooses a smaller algorithm surface than the RFC permits |
| OPS20-POS-12 | HTTP signature presentation carries Attestor-specific decision and hash-binding headers | `http-message-signatures.ts:43-50` | Token, decision, target, output, consequence, policy hash, and policy version travel with the request |
| OPS20-POS-13 | Workload binding implements RFC 8705 `x5t#S256` and SPIFFE identifiers | `workload-binding.ts:26`, `workload-binding.ts:132-145`; RFC 8705 Section 3.1 | Sender-constrained presentation can bind to client certificate thumbprint or workload identity |
| OPS20-POS-14 | Token exchange declares the RFC 8693 grant type and Attestor release token type | `token-exchange.ts:39-46` | Exchange flow is anchored to the OAuth token-exchange vocabulary |
| OPS20-POS-15 | Envoy bridge uses canonical ext_authz filter name and v3 type URL | `envoy-ext-authz.ts:89-94`; Envoy docs show the same filter name/type URL | The bridge is aligned with Envoy's external authorization filter surface |
| OPS20-POS-16 | Envoy bridge defaults to online verification and action consequence type | `envoy-ext-authz.ts:86-88` | Default mode favors runtime introspection over local-only verification |
| OPS20-POS-17 | Degraded mode has bounded defaults: cache-only TTL, break-glass TTL, and max uses | `degraded-mode.ts:33-40` | Break-glass is not unlimited by default |
| OPS20-POS-18 | Freshness rules are typed and include per-risk-class/per-boundary baselines | `freshness.ts:19-65`, `freshness.ts:208-246` | Freshness is structured, not free-text |
| OPS20-POS-19 | Verification profiles are typed and spec-versioned | `verification-profiles.ts:20-89`, `verification-profiles.ts:433-486` | Sender-constraint and cache-budget requirements have one profile matrix |
| OPS20-POS-20 | Major modules publish independent spec-version constants | grep across `src/release-enforcement-plane/**` | Module contracts are independently versionable |
| OPS20-POS-21 | The surface has 20 dedicated enforcement-plane tests plus 2 related freshness/replay tests | `git ls-tree` inventory and local line counts | Regression-lock evidence is broad, even though line-by-line audit remains incomplete |

## 5. Findings

| ID | Severity | State | Title | Evidence (`origin/master`) | Protected principle | Recommended next action |
|---|---:|---|---|---|---|---|
| OPS-154 | P2 | `not proven` | Sweep 20 did not line-by-line audit all 22 files / 16,972 lines | This sweep targeted specs, entry points, exports, and test inventory; full behavioral read of the largest files was out of budget | auditability; no overclaim | Record the limit and spawn sub-sweeps only where module-specific risk justifies the budget |
| OPS-155 | P2 | `open / partial-repo` | DPoP default accepted-algorithm policy is per-call, not a module-level frozen policy constant | `verifyDpopProof` defaults `acceptedAlgorithms` with `input.acceptedAlgorithms ?? [DEFAULT_DPOP_SIGNING_ALGORITHM, 'EdDSA']` at `dpop.ts:350-351`; callers can pass a broader list | proof integrity; fail-closed boundary | Add `DEFAULT_ACCEPTED_DPOP_ALGORITHMS` as a frozen exported constant and document that widening the caller allowlist is an explicit operator/provider decision |
| OPS-156 | P2 | `accepted limitation` | HTTP Message Signatures are Ed25519-only even though RFC 9421 permits other algorithms | `http-message-signatures.ts:38` pins `HTTP_MESSAGE_SIGNATURE_ALGORITHM = 'ed25519'`; RFC 9421 includes RSA-PSS, ECDSA, HMAC-SHA256, and Ed25519 examples | proof integrity; no overclaim | Keep the deliberate narrowing; document that future provider adapters require explicit allowlist expansion and tests |
| OPS-157 | P3 | `open / partial-repo` | RFC 8693 token-exchange behavioral depth deferred | `token-exchange.ts` declares grant type and token type, but this sweep did not deep-read every optional field binding path | release provenance; auditability | Run a dedicated token-exchange sub-sweep covering `audience`, `resource`, `scope`, requested/subject/actor token types, and actor-token binding |
| OPS-158 | P3 | `closed` | Envoy bridge default risk class must not become a production route policy | `envoy-ext-authz.ts` accepts the validated `attestor.risk_class` route context extension, gives explicit server `options.riskClass` precedence, and fails closed on invalid route risk values; deployment docs state that the default is fallback-only. | release provenance; operational boundedness | Keep `tests/release-enforcement-plane-envoy-ext-authz.test.ts` green and prove live route-map deployment separately before production claims. |
| OPS-159 | P3 | `accepted limitation` | Degraded-mode `maxUses` body path was not deep-audited | `degraded-mode.ts:38` sets `DEFAULT_DEGRADED_MODE_MAX_USES = 1`; this sweep did not line-by-line verify custom `maxUses > 1` enforcement | replay and idempotency safety; auditability | Audit the `maxUses` increment/check path in a future degraded-mode sub-sweep if operators plan to allow `maxUses > 1` |

## 6. Release-Enforcement-Plane Surface Matrix

| # | File | Kind | Spec version / contract | Test evidence | Finding |
|---:|---|---|---|---|---|
| 1 | `dpop.ts` | primitive | `attestor.release-enforcement-dpop.v1` | `tests/release-enforcement-plane-dpop.test.ts` | OPS-155 |
| 2 | `online-verifier.ts` | verifier | `attestor.release-enforcement-online-verifier.v1` | `tests/release-enforcement-plane-online-verifier.test.ts` | OPS-154 |
| 3 | `offline-verifier.ts` | verifier | `attestor.release-enforcement-offline-verifier.v1` | `tests/release-enforcement-plane-offline-verifier.test.ts` | OPS-154 |
| 4 | `middleware.ts` | middleware | `attestor.release-enforcement-middleware.v1` | `tests/release-enforcement-plane-middleware.test.ts` | OPS-154 |
| 5 | `freshness.ts` | primitive | `attestor.release-freshness-rules.v1` | `tests/release-enforcement-plane-freshness.test.ts` plus related freshness/replay tests | none new |
| 6 | `http-message-signatures.ts` | primitive | `http-message-signature-presentation.v1` | `tests/release-enforcement-plane-http-message-signatures.test.ts` | OPS-156 |
| 7 | `workload-binding.ts` | binding | `workload-binding-presentation.v1` | `tests/release-enforcement-plane-workload-binding.test.ts` | none new |
| 8 | `token-exchange.ts` | exchange | `release-token-exchange.v1` | `tests/release-enforcement-plane-token-exchange.test.ts` | OPS-157 |
| 9 | `envoy-ext-authz.ts` | bridge | `attestor.release-enforcement-envoy-ext-authz.v1` | `tests/release-enforcement-plane-envoy-ext-authz.test.ts` | OPS-158 |
| 10 | `degraded-mode.ts` | primitive | `release-degraded-mode-control.v1` | `tests/release-enforcement-plane-degraded-mode.test.ts` | OPS-159 |
| 11 | `verification-profiles.ts` | profile | `verification-profile-matrix.v1` | `tests/release-enforcement-plane-verification-profiles.test.ts` | none new |
| 12 | `action-dispatch.ts` | dispatch | versioned module | `tests/release-enforcement-plane-action-dispatch.test.ts` | none new |
| 13 | `communication-send.ts` | dispatch | versioned module | `tests/release-enforcement-plane-communication-send.test.ts` | none new |
| 14 | `record-write.ts` | dispatch | versioned module | `tests/release-enforcement-plane-record-write.test.ts` | none new |
| 15 | `webhook-receiver.ts` | dispatch | versioned module | `tests/release-enforcement-plane-webhook-receiver.test.ts` | none new |
| 16 | `async-envelope.ts` | envelope | versioned module | `tests/release-enforcement-plane-async-envelope.test.ts` | none new |
| 17 | `authorization-headers.ts` | contract | strict credential parsing helpers | covered through platform and verifier tests | none new |
| 18 | `conformance.ts` | contract | conformance helpers | `tests/release-enforcement-plane-conformance.test.ts` | none new |
| 19 | `object-model.ts` | model | shared release presentation/enforcement model | `tests/release-enforcement-plane-object-model.test.ts` | none new |
| 20 | `telemetry.ts` | telemetry | hooks and descriptors | covered through platform-surface inventory | none new |
| 21 | `types.ts` | types | failure reasons and risk/consequence types | `tests/release-enforcement-plane-types.test.ts` | none new |
| 22 | `index.ts` | barrel | export surface | `tests/release-enforcement-plane-platform-surface.test.ts`; package-surface probe | none new |

Coverage: 22/22 source files inventoried; 10/22 targeted at spec and entry
point level; 20 dedicated release-enforcement-plane tests plus 2 related
freshness/replay tests confirmed.

## 7. Release-Enforcement-Plane Verification

| Question | Source | Verdict |
|---|---|---|
| Does DPoP check proof shape, algorithm policy, required claims, time window, `ath`, and replay key? | `dpop.ts:201-209`, `dpop.ts:255-273`, `dpop.ts:373-391`, `dpop.ts:425`, `dpop.ts:468`; RFC 9449 | repo-proven at targeted-read level |
| Does DPoP reject `none`, symmetric `HS*`, and private-key JWK headers? | `dpop.ts:205-207`, `dpop.ts:384` | repo-proven |
| Does online verification compose offline verification with introspection and optional consumption? | `online-verifier.ts:47-53`, `online-verifier.ts:551-555` | repo-proven |
| Does middleware expose typed allow/deny/skip and Hono/Node variants? | `middleware.ts:80-81`, `middleware.ts:691`, `middleware.ts:752` | repo-proven |
| Does HTTP Message Signatures pin Ed25519 and SHA-256 digest? | `http-message-signatures.ts:38-41`; RFC 9421 | repo-proven, intentional narrowing |
| Does workload binding implement certificate thumbprint and SPIFFE binding vocabulary? | `workload-binding.ts:26`, `workload-binding.ts:132-145`; RFC 8705; SPIFFE overview | repo-proven |
| Does token exchange use RFC 8693 grant vocabulary? | `token-exchange.ts:39-46`; RFC 8693 | repo-proven at constant/export level |
| Does Envoy bridge use canonical filter name and type URL? | `envoy-ext-authz.ts:89-94`; Envoy ext_authz docs | repo-proven |
| Does degraded mode have bounded defaults? | `degraded-mode.ts:33-40` | repo-proven for defaults |
| Are full 16,972 source lines line-by-line behaviorally audited? | Sweep budget and local line counts | not proven; OPS-154 |
| Is DPoP default accepted-algorithm policy centralized as a frozen module constant? | `dpop.ts:350-351` | gap; OPS-155 |

Verdict: the release-enforcement-plane is repo-proven at spec, entry-point,
export, and test-inventory level. The next level of assurance is module-specific
line-by-line behavioral audit, not another broad sweep.

## 8. Discrepancy Check Against Indexes

| Topic | Current index state | Sweep 20 result | Required update |
|---|---|---|---|
| `Enforcement boundary` baseline score 7 | Strong primitives listed, live PEP not proven | Confirmed and expanded with DPoP, HTTP signatures, workload binding, token exchange, verifiers, middleware, Envoy, degraded mode, freshness, profile matrix | Refine baseline text; no score increase until live PEP proof |
| `Token / replay / idempotency` score 8 | DPoP, TTL, freshness/replay primitives | Confirmed at release-enforcement-plane substrate level | Refine control-map text |
| `Customer PEP no-bypass` P0 | `needs live test` | unchanged; repo-side primitives are not a live non-bypass proof | no closure |
| `OPS-SWEEP-20` report-index row | not present | needed | add report row |
| OPS-154..159 findings | not present | needed | add finding-index rows |
| Live proof register | `LP-CUSTOMER-PEP-NO-BYPASS` already exists | no new live proof row needed | none |

## 9. Chain Reactions

| Change candidate | Downstream effect | Risk | Test / proof needed |
|---|---|---|---|
| OPS-155 DPoP default allowlist constant | Default policy becomes discoverable, exported, and testable | low | `tests/release-enforcement-plane-dpop.test.ts` should assert default accepted algorithms |
| OPS-156 documentation | Avoids implying generic RFC 9421 algorithm support | low | docs-only check |
| OPS-157 token-exchange sub-sweep | Deeper OAuth token exchange compliance evidence | medium | dedicated sub-sweep, not a quick PR |
| OPS-158 Envoy route risk-class mapping | Prevents module default from becoming production policy | low | `tests/release-enforcement-plane-envoy-ext-authz.test.ts` plus deployment doc check |
| OPS-159 degraded-mode sub-sweep | Confirms custom `maxUses` behavior if operators need it | medium | dedicated degraded-mode test/audit |

## 10. Coverage Delta

- Before this sweep: enforcement-plane primitives were referenced by route and
  release-kernel sweeps, but no consolidated enforcement-plane audit existed.
- After this sweep: 22/22 files inventoried; DPoP, online/offline verification,
  middleware, freshness, HTTP signatures, workload binding, token exchange,
  Envoy bridge, degraded mode, and verification profiles mapped with source and
  test evidence.
- Corrected count: the surface is 16,972 source lines, not approximately
  12,000; dedicated tests are 20 release-enforcement-plane files, not 21, plus
  2 related freshness/replay tests.
- No production proof claim: live customer PEP no-bypass, KMS runtime signing,
  and shared replay/introspection stores still require operator/runtime proof.

## 11. Index Updates

This PR integrates:

- `docs/audit/finding-index.md`: OPS-154 through OPS-159.
- `docs/audit/report-index.md`: `OPS-SWEEP-20`.
- `docs/audit/current-posture-baseline.md`: baseline HEAD and enforcement
  boundary text.
- `docs/audit/control-map.md`: token/replay safety evidence text.

No `live-proof-register.md` update is required because the existing customer
PEP live-proof row already covers the operator-action gate.

## 12. Verdict

- Is the Sweep 20 report complete? Yes, for spec + entry-point + export +
  test-inventory audit depth. No, not for full line-by-line behavioral review of
  all 16,972 source lines; that limit is explicitly OPS-154.
- Is there a repo-proven P0? No.
- Is there a repo-proven P1? No.
- Is remediation required? Small: OPS-155 is the main low-risk code cleanup;
  OPS-156/158 are documentation; OPS-157/159 are sub-sweep candidates.
- Can the next sweep proceed without Sweep 20 remediation? Yes.
- Recommended next target: Sweep 21 should cover
  `src/release-policy-control-plane/**`, completing the release-kernel,
  release-enforcement-plane, and release-policy-control-plane substrate triad.

## Final Checkpoint

- Done: Sweep 20 read-only audit integrated for
  `origin/master @ 05a7cd050e842a183cfeb2747c62e9fe8f8e854a`; 22 source
  files, 20 dedicated enforcement-plane test files, and 2 related
  freshness/replay tests mapped.
- Not done: no runtime remediation; no line-by-line behavioral audit of all
  16,972 source lines; no OPS-155 code fix.
- Files changed by integration: this report plus audit indexes and baseline
  docs.
- Remaining blockers: live customer PEP no-bypass, external KMS runtime
  signing, shared replay/introspection live proof, and existing open P1 backlog.
- Next action: operator decision on Sweep 20 remediation or Sweep 21
  release-policy-control-plane audit.
