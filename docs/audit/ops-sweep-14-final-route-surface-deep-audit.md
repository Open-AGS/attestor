# Ops Sweep 14 - Final Route Surface Deep Audit

Status: read-only audit report. No remediation written. No live proof captured.
No production-readiness claim.

This sweep closes the `/api/v1/**` route-surface deep-audit chain started by
Sweeps 06, 08, 09, 10, 11, 12, and 13.

## 0. Recent Fixes Chain-Effect Check

Source of truth:
`origin/master @ a21eb1830db3cc7a70ba6a374e8bfdb7066bdb34`.

Two merges landed after Sweep 13 was drafted:

- PR #519 / commit `123adfa1` closed OPS-100 repo-side by adding
  credential-bound release-route role enforcement.
- PR #520 / commit `40231fac` added and indexed the Sweep 13
  onboarding/admission audit report.

Chain-effect verdict:

- Direct regression: none. Neither PR touches
  `src/service/http/routes/pipeline-verification-routes.ts`,
  `src/service/http/routes/pipeline-filing-routes.ts`,
  `src/service/http/routes/public-site-routes.ts`,
  `src/service/http/routes/core-routes.ts`, or `src/service/site-support.ts`.
- Defense-in-depth weakening: none. PR #519 strengthens a sibling
  release-decision surface; PR #520 is docs-only.
- Config / manifest drift: none in Sweep 14 scope.
- Docs / index drift: intentional. Sweep 12 and 13 rows now reflect merged
  state.
- Closed finding re-opened: none.

PR #519 and PR #520 have no chain-effect on Sweep 14 scope.

## 1. Validation Frame

| Field | Value |
|---|---|
| Source HEAD | `origin/master @ a21eb1830db3cc7a70ba6a374e8bfdb7066bdb34` |
| Phase | Phase 1 - Live Shadow Readiness |
| Baseline blockers in scope | Bad token, provider outage/degraded mode, dashboard/proof artifact privacy review |
| Protected principles | fail-closed boundary; data minimization and redaction; operational boundedness; release provenance; proof integrity; no overclaim |
| Audit driver | Current posture baseline Phase 1 route work and final route-surface closure |
| Scope | `src/service/http/routes/pipeline-verification-routes.ts`; `src/service/http/routes/pipeline-filing-routes.ts`; `src/service/http/routes/public-site-routes.ts`; `src/service/http/routes/core-routes.ts`; `src/service/site-support.ts#readCommittedEvidence` |

External anchors used for control vocabulary only:

- OWASP API Security Top 10 2023 API4, API8, and API9:
  <https://owasp.org/API-Security/editions/2023/en/0x11-t10/>.
- OWASP ASVS for logging, headers, and HTTP response-hardening vocabulary:
  <https://owasp.org/www-project-application-security-verification-standard/>.
- NIST SP 800-218 Secure Software Development Framework:
  <https://csrc.nist.gov/pubs/sp/800/218/final>.
- RFC 7231 status code vocabulary:
  <https://www.rfc-editor.org/rfc/rfc7231>.
- CWE-200, CWE-209, CWE-799, and CWE-22 weakness vocabulary:
  <https://cwe.mitre.org/>.

These anchors are not certification, compliance, production-readiness, or full
coverage claims.

## 2. Inspected Files

| Path | Depth | Why |
|---|---|---|
| `src/service/http/routes/pipeline-verification-routes.ts` | full route read | Public PKI verification entry |
| `src/service/http/routes/pipeline-filing-routes.ts` | full route read | Release-token-consuming filing export |
| `src/service/http/routes/public-site-routes.ts` | full route read | Public HTML and committed-evidence file surface |
| `src/service/http/routes/core-routes.ts` | final handler range | Startup, health, diagnostics, trust root, and readiness routes |
| `src/service/site-support.ts` | targeted | `readCommittedEvidence` path traversal defense |
| `src/service/hosted/hosted-api-authorization-matrix.ts` | targeted | Route classification coverage |

## 3. Skipped Files

| Path | Why skipped | Risk |
|---|---|---|
| `src/service/release-authorization.ts` | Release token primitive was previously audited; this sweep verifies the route binding to it. | Low |
| `src/service/runtime-profile-diagnostics.ts` | Diagnostic builder internals are downstream of the route exposure finding. | Low |
| `src/financial/reporting-acceptance-packet.ts` | Public page renderer has no caller-supplied input path in this sweep. | Low |
| `src/connectors/**` | Connector implementation is not the core route-surface question; `/connectors` response shape is. | Low |

No critical Sweep 14 route file was skipped.

## 4. Positive Observations

| ID | Observation | Evidence | Why it matters |
|---|---|---|---|
| OPS14-POS-01 | `/api/v1/verify` rejects flat Ed25519-only submissions with 422 and requires PKI chain material. | `pipeline-verification-routes.ts` | Weak verification mode is not accepted on the hosted route. |
| OPS14-POS-02 | `/api/v1/verify` requires an out-of-band `trustedCaFingerprint`. | `pipeline-verification-routes.ts` | Trust-root binding is explicit. |
| OPS14-POS-03 | `/api/v1/verify` returns granular chain/cert/trust-binding fields. | `pipeline-verification-routes.ts` | Verification results are auditable and machine-readable. |
| OPS14-POS-04 | `/api/v1/filing/export` verifies a release token with audience, output hash, consequence hash, introspection, and consume-on-success. | `pipeline-filing-routes.ts` | Filing export is content-bound and replay-sensitive. |
| OPS14-POS-05 | `/api/v1/filing/export` rejects registered but non-release-bound adapters with 403. | `pipeline-filing-routes.ts` | Adapter expansion cannot silently bypass release binding. |
| OPS14-POS-06 | Release token failures return a Bearer `WWW-Authenticate` challenge. | `pipeline-filing-routes.ts` | Auth failures use a standard challenge shape. |
| OPS14-POS-07 | `readCommittedEvidence` normalizes separators, strips leading slashes, filters `.` and `..`, resolves under the evidence root, and checks the resolved prefix. | `site-support.ts` | The public evidence asset parameter is path-traversal bounded. |
| OPS14-POS-08 | Core startup/health/ready/trust-root routes set `cache-control: no-store`. | `core-routes.ts` | Diagnostic and trust-root responses are not cached accidentally. |
| OPS14-POS-09 | `/api/v1/pki/ca` and `/api/v1/release-token/jwks` are intentional public trust-root/key routes with versioned schemas. | `core-routes.ts` | Verification clients have canonical public trust material. |
| OPS14-POS-10 | Public evidence content type comes from the resolved file extension, not caller-supplied metadata. | `site-support.ts` | The asset path parameter does not steer arbitrary content types. |
| OPS14-POS-11 | `/api/v1/ready` derives `ready` from explicit checks and returns 503 when checks fail. | `core-routes.ts` | Readiness is deterministic and load-balancer actionable. |
| OPS14-POS-12 | `/api/v1/filing/export` uses a singleton release-token verification key promise. | `pipeline-filing-routes.ts` | Verification key loading is predictable per process. |

## 5. Findings

| ID | Severity | State | Title | Evidence | Protected principle | Recommended action |
|---|---:|---|---|---|---|---|
| OPS-112 | P1 | `open` | Unauthenticated `/api/v1/health` and `/api/v1/ready` disclose rich runtime posture | `core-routes.ts` exposes PKI state, RLS policy counts, Redis mode, async backend, runtime profile, account auth key sources, shared store profile, production storage path, HA state, and related diagnostics without authentication. | data minimization and redaction; no overclaim | Split public minimal health/ready from authenticated admin diagnostics; add a live proof gate for deployed split. |
| OPS-113 | P1 | `open` | Public `/api/v1/verify` performs heavy PKI verification without a rate limit | `pipeline-verification-routes.ts` runs chain/certificate verification per unauthenticated request and has no 429/rate-limit path. | operational boundedness; availability | Put a path-scoped source rate limit before PKI verification work; reuse the webhook-rate-limit pattern. |
| OPS-114 | P2 | `open / partial-repo` | `/api/v1/verify` uses `console.log` for rejection reasons | Two PKI rejection branches log through `console.log`. | auditability; operational boundedness | Switch to a structured logger event. |
| OPS-115 | P2 | `open / partial-repo` | Public-site HTML responses lack CSP and related browser-hardening headers | Public HTML routes emit `text/html` with no CSP, `X-Content-Type-Options`, `X-Frame-Options`, or `Referrer-Policy`. | data minimization and redaction; fail-closed boundary | Reuse the shared HTML response helper proposed by OPS-103/OPS-107. |
| OPS-116 | P2 | `open / partial-repo` | Public-site routes lack cache-control contracts | Dynamic HTML return pages and committed evidence assets emit no cache-control. | operational boundedness; data minimization | Use `no-store` for dynamic return pages and explicit immutable caching only for content-addressed evidence. |
| OPS-117 | P3 | `open / partial-repo` | Filing export generic errors echo `err.message` to clients | `pipeline-filing-routes.ts` generic catch returns raw error messages. | data minimization and redaction | Pair with the central problem-detail redactor batch. |
| OPS-118 | P3 | `open / partial-repo` | Verify generic errors echo `err.message` to clients | `pipeline-verification-routes.ts` generic catch returns raw error messages. | data minimization and redaction | Pair with OPS-117 and earlier error-redaction findings. |
| OPS-119 | P3 | `open / partial-repo` | `/api/v1/startup` exposes `instanceId` and production profile flag unauthenticated | Startup response includes `instanceId` and `runtimeProfile.production`. | data minimization; no overclaim | Close with OPS-112 by moving details to authenticated diagnostics. |
| OPS-120 | P3 | `open / partial-repo` | `/api/v1/connectors` discloses connector configured/available booleans | Connector inventory exposes per-connector configuration and availability state unauthenticated. | data minimization; no overclaim | Move to authenticated diagnostics or reduce unauth response to public catalog metadata only. |

OPS-112 and OPS-113 are the only Sweep 14 P1 findings.

## 6. Route-by-route Final Surface Matrix

Twenty-one routes were mapped across the final four route files.

| # | Method | Path | Auth | Rate limit | Cache/header posture | Affected findings |
|---:|---|---|---|---|---|---|
| 1 | POST | `/api/v1/verify` | none | none | n/a | OPS-113, OPS-114, OPS-118 |
| 2 | POST | `/api/v1/filing/export` | release token | release-token single-use path | n/a | OPS-117 |
| 3 | GET | `/` | none | n/a | no HTML hardening/cache-control | OPS-115, OPS-116 |
| 4 | GET | `/financial-reporting-acceptance` | none | n/a | no HTML hardening/cache-control | OPS-115, OPS-116 |
| 5 | GET | `/proof/financial-reporting-acceptance` | none | n/a | no HTML hardening/cache-control | OPS-115, OPS-116 |
| 6 | GET | `/proof/financial-reporting-acceptance/packet.json` | none | n/a | no cache-control | OPS-116 |
| 7 | GET | `/proof/financial-reporting-acceptance/README.md` | none | n/a | no cache-control | OPS-116 |
| 8 | GET | `/proof/financial-reporting-acceptance/index.html` | none | n/a | no HTML hardening/cache-control | OPS-115, OPS-116 |
| 9 | GET | `/proof/financial-reporting-acceptance/evidence/:asset` | none | n/a | path bounded; no cache-control | OPS-116 |
| 10 | GET | `/billing/success` | none | n/a | no HTML hardening/cache-control | OPS-115, OPS-116 |
| 11 | GET | `/billing/cancel` | none | n/a | no HTML hardening/cache-control | OPS-115, OPS-116 |
| 12 | GET | `/settings/billing` | none | n/a | no HTML hardening/cache-control | OPS-115, OPS-116 |
| 13 | GET | `/app` | none | n/a | redirect | none new |
| 14 | GET | `/api/v1/startup` | none | n/a | no-store; minor runtime details exposed | OPS-119 |
| 15 | GET | `/api/v1/health` | none | n/a | no-store; rich diagnostic payload | OPS-112 |
| 16 | GET | `/api/v1/domains` | none | n/a | product catalog | none new |
| 17 | GET | `/api/v1/connectors` | none | n/a | connector configuration/availability exposed | OPS-120 |
| 18 | GET | `/api/v1/release-token/jwks` | none | n/a | no-store; intentional public key route | none new |
| 19 | GET | `/api/v1/pki/ca` | none | n/a | no-store; intentional public CA route | none new |
| 20 | GET | `/api/v1/ready` | none | n/a | no-store; rich readiness diagnostics | OPS-112 |
| 21 | GET | `/app` redirect target `/settings/billing` | none | n/a | covered by target | none new |

Coverage: 21 / 21 routes.

## 7. Final Surface Verification

| Question | Verdict | Evidence |
|---|---|---|
| Is `/api/v1/verify` PKI-chain mandatory? | repo-proven | 422 when chain material is absent. |
| Is `/api/v1/verify` trusted-root mandatory? | repo-proven | 422 when `trustedCaFingerprint` is absent. |
| Is `/api/v1/filing/export` release-token-bound? | repo-proven | `verifyReleaseAuthorization` checks audience, output hash, consequence hash, introspection, and consume-on-success. |
| Does filing export reject non-release-bound adapters? | repo-proven | 403 `filing_adapter_not_release_bound`. |
| Is public evidence path traversal bounded? | repo-proven | `readCommittedEvidence` normalization, segment filtering, resolve, and prefix check. |
| Do public trust-root routes expose versioned schemas? | repo-proven | `/api/v1/pki/ca` and JWKS routes. |
| Does `/api/v1/health` expose rich runtime posture unauthenticated? | gap | OPS-112. |
| Is `/api/v1/verify` rate-limited? | gap | OPS-113. |
| Do public-site HTML routes emit browser hardening headers? | gap | OPS-115. |
| Do public-site routes set cache-control? | gap | OPS-116. |

Verdict: route-level authentication, verification, release-token binding, and
path traversal defenses are repo-proven. Unauthenticated diagnostics and public
verification availability are the two structural P1 gaps.

## 8. Index Discrepancy Check

| Topic | Current state after this report | Required update |
|---|---|---|
| `Service/API boundary` next action | Final route slice is now mapped. | Mark route-layer deep audit complete and move next action to live probes plus non-route Phase 1 work. |
| OPS-SWEEP-14 report row | absent before this branch | Add report-index row. |
| OPS-112..OPS-120 | absent before this branch | Add finding-index rows. |
| Live proof register | new live gates will be needed when OPS-112/OPS-113 remediation adds repo gates | Do not add register rows in this report-only PR; add `LP-HEALTH-DIAGNOSTIC-SPLIT` and `LP-VERIFY-RATE-LIMIT` with the remediation flags. |
| Attestor remediation tracker | no F-series state change | No update. |

## 9. Chain Reactions

| Candidate | Downstream effect | Risk | Verification needed |
|---|---|---|---|
| OPS-112 split health/ready diagnostics | Public probes stay minimal; rich diagnostics move behind admin auth. | Medium; dashboards may consume current rich payload. | HTTP tests plus live proof. |
| OPS-113 verify route rate limit | Heavy public PKI verification is abuse-bounded. | Medium; verification clients may burst during rotations. | 429-before-crypto test plus live source-IP proof. |
| OPS-114 structured verify logging | Rejection telemetry becomes consistent. | Low | Structured event assertion or log unit test. |
| OPS-115 HTML helper | Public-site, release-review, and hosted onboarding HTML hardening can share one helper. | Low | Header tests. |
| OPS-116 cache-control | Dynamic pages stop caching; evidence assets get explicit policy. | Low | Header tests. |
| OPS-117/118 redactor | Verify/filing generic errors join the existing route redaction batch. | Low | Redactor fixtures and route negative tests. |
| OPS-119/120 diagnostic reductions | Runtime and connector fingerprinting reduce with OPS-112. | Low | Covered by diagnostics split tests. |

## 10. Coverage Delta

- Before Sweep 14: every major route family except final verification,
  filing, public-site, and core diagnostics had a deep-audit report.
- After Sweep 14: every route file under `src/service/http/routes/` has been
  mapped across Sweeps 06, 08, 09, 10, 11, 12, 13, and 14.
- The `/api/v1/**` route-layer deep audit is complete as an audit chain.
- This is not a claim that every finding is remediated, production-proven, or
  live-shadow ready.

Open route-side P1s after this sweep:

- OPS-112 `/health` and `/ready` diagnostic split.
- OPS-113 `/verify` rate limit.

Remaining Phase 1 non-route work:

- Branch protection / release provenance.
- Demo safety and redaction.
- Test adequacy map.
- Live proof capture for repo-gated controls.

## 11. Verdict

- Sweep 14 report completeness: complete for the scoped 21-route final
  surface.
- Repo-proven P0: none.
- Repo-proven P1: OPS-112 and OPS-113.
- Remediation requirement: yes. OPS-112 and OPS-113 should close before Phase
  1 exit.
- Next audit target: non-route Phase 1 work. Best candidate is branch
  protection because it directly addresses release provenance.

Recommended sequencing:

1. Index this Sweep 14 report.
2. Remediate OPS-113 first; the rate-limit primitive already exists.
3. Remediate OPS-112 second; it is wider because operator dashboard consumers
   may depend on the rich health payload.
4. Start Sweep 15 on branch protection, demo safety/redaction, or the test
   adequacy map.
