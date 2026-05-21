# Current Attestor Execution Baseline

This document is the active operating baseline for audit, remediation,
live-shadow readiness, and no-overclaim planning.

All audit/remediation agents MUST read this document before proposing new work.

If a suggested task conflicts with this baseline, the agent must:

1. state the conflict,
2. validate against current `origin/master`,
3. ask whether to update the baseline or stay on plan.

This document is not a final security certification.
It is the current calibrated execution baseline.

## Baseline Status

- Source of truth: `origin/master`
- Baseline HEAD: `585b85445a2a73f555cd05d469392ead9abe1f19`
- Package: `attestor@0.2.0-evaluation`
- Date: 2026-05-21
- Repository-side posture: credible
- Production-side posture: not proven
- Enterprise-side posture: not ready
- Calibrated security score: about 6.8 / 10
- Finding catalog estimate: about 106
- Closed or effectively closed finding estimate: about 62
- Evidence state: partial-repo, calibrated from audit reports plus spot repo validation
- Evidence system: index layer active; see `docs/audit/README.md`

Short verdict: Attestor has a credible repository-side core for evaluation and
shadow-readiness work. It is not production-ready or enterprise-ready without
live PEP, KMS, replay-store, ops/IAM, route authorization, and adversarial
runtime proof.

## Active Evidence Indexes

The baseline is the operating verdict, not the only evidence file. Current
audit and remediation work must also update the applicable index files:

- `docs/audit/report-index.md`
- `docs/audit/finding-index.md`
- `docs/audit/live-proof-register.md`
- `docs/audit/control-map.md`
- `docs/research/README.md`

Historical remediation notes remain valid evidence leaves, but current finding
state is reconciled through these indexes.

## Control Mapping Anchors

These anchors are used for control mapping only. They are not certifications.

- NIST SP 800-218, Secure Software Development Framework:
  <https://csrc.nist.gov/pubs/sp/800/218/final>
- NIST Cybersecurity Framework 2.0:
  <https://www.nist.gov/cyberframework>
- OWASP SAMM:
  <https://owasp.org/www-project-samm/>
- GitHub protected branches:
  <https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches>

## Evidence Labels

- `repo-proven`: verified from current repository evidence.
- `partial-repo`: some repository evidence exists, but coverage is incomplete.
- `source-backed`: supported by a primary or official external source.
- `inferred`: reasonable inference from evidence, not directly proven.
- `not proven`: no current evidence sufficient to claim.
- `needs live test`: cannot be proven from repository evidence alone.
- `needs ops proof`: requires deployment/IAM/KMS/secret/runtime evidence.
- `accepted limitation`: documented limitation that is acceptable for current scope.
- `closed`: current repository evidence shows the finding is fixed.
- `disputed/closed`: original risk is no longer supported or is effectively bounded.

## Consolidated Posture Scorecard

| Area | Score | Confidence | Current state | Main remaining risk | Next action |
|---|---:|---|---|---|---|
| Data minimization | 8 | partial-repo | Strong no-raw-data design in audited core; digest/redaction patterns present. | Local artifacts, proof output, dashboard summaries, and secret redaction coverage still need broader verification. | Expand redaction checks and audit demo/artifact output before public demo. |
| Proof / signature / key authority | 8 | repo-proven for core, needs ops proof for KMS | Ed25519 verification, trusted fingerprint matching, DSSE/in-toto policy bundle signing. | Runtime production signing still needs external KMS/HSM proof. | Add KMS-backed signing path and live proof. |
| Enforcement boundary | 7 | partial-repo | Enforcement primitives are strong: DPoP, mTLS/workload binding, token exchange, verifier composition. | Customer PEP no-bypass is not live-proven. | Build one reference PEP integration and prove direct bypass fails. |
| Token / replay / idempotency | 8 | partial-repo | Explicit token TTL policy, DPoP binding, replay/freshness primitives, and OPS-SWEEP-10 pipeline `Idempotency-Key` replay protection for `/pipeline/run` and `/pipeline/run-async`. | Multi-instance replay/introspection stores and pipeline idempotency need live shared-store proof; async submit/consume atomicity remains a follow-up. | Run Redis/Postgres-backed replay, pipeline idempotency, and outage tests. |
| Tenant isolation | 6 | partial-repo | Tenant middleware and scoped checks exist. | Optional tenant payload binding and cross-tenant proof chain are not fully proven. | Add tenant mismatch tests across route, token, proof, and dashboard outputs. |
| Service/API security | 6 | partial-repo | Edge contract, rate limit, auth/MFA/session/federated auth sampled and generally strong; OPS-SWEEP-06 maps and hardens the 32-route admin surface repo-side; OPS-SWEEP-08 maps and hardens the Stripe/SendGrid/Mailgun webhook signature surfaces repo-side; OPS-SWEEP-09 maps and hardens the 49-route account surface P1s repo-side; OPS-SWEEP-10 maps and hardens the pipeline execution/async P1 idempotency gap repo-side; OPS-SWEEP-11 maps the 27-route shadow surface, adds shadow mutation audit, and adds direct HTTP route coverage; OPS-SWEEP-12 maps the 31-route release-decision surface and extends credential-bound role enforcement to release-review and release-policy-control; OPS-SWEEP-13 maps the 5-route onboarding/admission surface and verifies consequence-admission tenant binding, plan-mode gating, agent-loop throttling, protected release token issuance, and sender confirmation; OPS-SWEEP-14 maps the final 21-route verification, filing, public-site, and core surface and completes the `/api/v1/**` route-layer deep-audit chain. | `src/service/**` remains only partially audited outside route-layer scope; admin role-key deployment, release-route role enforcement, webhook provider binding, account callback/audit-chain behavior, pipeline idempotency, shadow mutation audit-chain behavior, health diagnostic split, and verify-route rate-limit behavior still need live proof. | Remediate OPS-112/113, then move route work to live probes and continue non-route Phase 1 work. |
| AI-specific attack resistance | 7 | partial-repo | LayerOpinion runtime invariants, reason-code allowlists, belief mass conservation, and producer-trust hardening. | Untrusted text and downstream evidence surfaces need broader prompt-injection review. | Add adversarial evidence fixtures and verify no model rationale becomes authority. |
| Supply chain / release provenance | 8 | repo-proven | Workflows SHA-pinned, stale branches removed, PR contract hardened, audit evidence gate exists; OPS-SWEEP-15 audits 13 governance artifacts and confirms branch policy, CODEOWNERS, minimized workflow permissions, supply-chain gates, CodeQL, and evaluation attestation repo-side. | Required commit signatures and required PR reviews still need branch-protection proof localized as OPS-121/122. | Extend `branch-governance.yml`, enable GitHub branch-protection settings, and verify unsigned/self-merge negative paths. |
| Cloud / ops readiness | 5 | not proven / needs ops proof | Docs are honest about non-claims; repo has production-readiness scaffolding, HA ops gates, PKI/TLS gates, observability remediation indexes, PITR/Redis recovery hardening, OPS-SWEEP-07 provider/profile hardening, OPS-SWEEP-08 webhook proof gates, OPS-SWEEP-09 account proof gates, OPS-SWEEP-10 pipeline idempotency proof gate, OPS-SWEEP-11 shadow audit proof gate, OPS-SWEEP-12 release-route role enforcement proof gate, and stage-aware live proof gates. | Live cloud/IAM/KMS/network/storage observability proof, live PITR/Redis recovery proof, KEDA scaler proof, webhook provider binding proof, account callback/audit-chain proof, pipeline idempotency proof, shadow audit-chain proof, release-route role enforcement proof, logging redaction, and billing controls are not fully assessed. | Continue ops audit with remaining provider/live proof surfaces and capture live proof artifacts. |
| Fail-closed / availability | 7 | partial-repo | Empty-input conflict fail-closed, degraded-mode hardening, break-glass TTL, verifier indeterminate states. | Provider outage, Redis/Vault failures, and load behavior need live tests. | Run degraded-mode and provider-outage tests. |
| Test adequacy | 5 | partial-repo | Many targeted negative tests exist and audit evidence checks run. | Full invariant-to-test mapping is incomplete. | Build test adequacy map for P0/P1 closed findings. |
| Docs / no-overclaim truth | 8 | partial-repo | Strong no-overclaim discipline in audit lifecycle and public readiness language. | Older docs may drift from current posture. | Use this baseline as required PR contract input and refresh on material changes. |

## Finding State Reconciliation

| Finding / Risk | Previous state | Current state | Evidence | Action |
|---|---|---|---|---|
| B-081 scope tiebreak `localeCompare` | open / partial-repo | closed | `scoping.ts` uses binary `compareCanonicalLabels`. | No further action unless new locale-sensitive canonical sort appears. |
| B-059 trusted-proxy wildcard | open | disputed/closed | Wildcard requires explicit `ATTESTOR_TRUSTED_PROXY_PEER_WILDCARD_OVERRIDE=accept-the-risk`. | Keep documented; no P0 action. |
| B-069 Vault timeout | open | closed | Vault Transit path has timeout default and env override. | Keep covered by service checks. |
| B-033 tenant payload optionality | open | partial-repo | Tenant binding exists, but payload omission and signature timing remain not fully proven end-to-end. | Add cross-tenant route/token/proof tests. |
| B-025 demo CLI path traversal | open | open | Demo scenario path allowlist was not proven fixed. | Fix before public demo. |
| B-028 secret redaction coverage | open | open | Redaction was sampled as Stripe-focused; broader AWS/GCP/JWT/SSH/GitHub token coverage needs proof. | Expand redaction patterns and tests before public demo. |
| Admin API key blast radius | not fully elevated | partial / live-proof-only | OPS-SWEEP-06 adds role-scoped admin credentials, admin-route role allowlists, actor-role audit fields, admin auth rate limiting, and HTTP tests; OPS-SWEEP-12 extends credential-bound role enforcement to release-review and release-policy-control routes; legacy `ATTESTOR_ADMIN_API_KEY` remains a superuser compatibility fallback. | Prove live role-scoped operator key deployment, release-route role enforcement, and rotate or tightly hold the legacy superuser key. |
| Customer PEP no-bypass | not proven | needs live test | Repo primitives exist, but downstream non-bypassable integration is not live-proven. | Build reference integration and bypass test. |
| External KMS runtime signing | accepted limitation | needs ops proof | In-process/private-key boundary is acceptable for evaluation, not production. | Wire external KMS/HSM signer path for live enforcement. |
| Shared replay/introspection store | partial | needs live test | Replay/freshness primitives exist; HA/shared backend proof is missing. | Test Redis/Postgres-backed replay/introspection behavior across instances. |
| `ops/**` audit gap | partial | not proven / live-proof-only for remediated slices | OPS-SWEEP-01 through OPS-SWEEP-15 are indexed; profile/provider/webhook/account/pipeline/shadow/release-route/live-proof capture and branch-governance audit have repo-side hardening or localized remediation paths, while live cloud, provider, and GitHub settings proof remains incomplete. | Continue ops audit and capture live proof before live shadow. |
| `src/service` admin routes gap | open | closed repo-side / live-proof-only | OPS-SWEEP-06 maps all 32 admin routes and closes repo-side P1/P2 route findings; admin reads and one-time response key material remain accepted limitations. | Capture admin role-key deployment and rate-limit abuse proof before stronger live claims. |
| Webhook signature verification | partial | closed repo-side / live-proof-only | OPS-SWEEP-08 maps Stripe, SendGrid, and Mailgun provider webhook surfaces; direct verifier tests lock fake-signature behavior; email webhooks require shared control-plane storage by default; webhook proof flags are in the live-shadow gate. | Capture live provider endpoint binding, fake-signature probes, webhook rate-limit behavior, and email webhook replay-store proof before stronger live claims. |
| Account route authorization | partial | P1 closed repo-side / live-proof-only; P2 follow-ups open | OPS-SWEEP-09 maps all 49 account routes, adds SAML/OIDC callback rate limiting before callback verification, and writes account-session mutation records into the hash-linked audit ledger. | Capture federated callback rate-limit, account mutation audit-chain, and shared auth-abuse-store proof; keep account idempotency, JSON parsing, password policy, and bucket-key hygiene follow-ups visible. |
| Pipeline execution / async routes | partial | P1 closed repo-side / live-proof-only; P2/P3 follow-ups open | OPS-SWEEP-10 maps `/api/v1/pipeline/run`, `/api/v1/pipeline/run-async`, and `/api/v1/pipeline/status/:jobId`; `Idempotency-Key` now replays sync/async responses without double-consuming quota and conflicts on mismatched payloads. | Capture `ATTESTOR_PIPELINE_IDEMPOTENCY_PROOF`; keep pipeline JSON parsing, error redaction, async submit/consume atomicity, handler decomposition, and runId nonce follow-ups visible. |
| Shadow routes authorization | partial | P1 closed repo-side / live-proof-only; P2/P3 follow-ups open | OPS-SWEEP-11 maps all 27 shadow routes, writes successful shadow POST/PATCH mutations into the hash-linked audit ledger under `tenant_context`, and adds direct HTTP-layer coverage for every registered shadow route. | Capture `ATTESTOR_SHADOW_MUTATION_AUDIT_CHAIN_PROOF`; keep shadow idempotency, rate-limit, pagination, content-type status, and error-redaction follow-ups visible. |
| Release-review / release-policy-control authorization | partial | P1 closed repo-side / live-proof-only; P2/P3 follow-ups open | OPS-SWEEP-12 maps all 31 release-decision routes and enforces credential-bound read, mutation, and break-glass role allowlists across release-review and release-policy-control. | Capture `ATTESTOR_RELEASE_ROUTE_ROLE_ENFORCEMENT_PROOF`; keep release-policy typed-error/pagination and release-review HTML-header follow-ups visible. |
| Onboarding / admission authorization | partial | no P0/P1 surfaced; P2/P3 follow-ups open | OPS-SWEEP-13 maps all 5 onboarding/admission routes and verifies admission envelope tenant binding, plan-mode gate, agent-loop abuse guard, protected release token issuance, sender confirmation, and fail-closed shadow recording. | Keep onboarding shadow-event tenant assertion, hosted-onboarding HTML security headers, wizard idempotency, content-type status, and problem-detail redaction follow-ups visible. |
| Final route surface authorization | partial | P1 open; route-layer deep audit complete | OPS-SWEEP-14 maps pipeline verification, filing export, public-site, and core routes; PKI mandatory verification, release-token consume-on-success, public evidence path traversal defense, and public trust-root contract are repo-proven. OPS-112 and OPS-113 remain route-side P1 findings. | Remediate `/health`/`/ready` diagnostic split and `/verify` rate limit; capture live proof for both. |
| Required commit signatures | open | open | Branch protection proof of signatures is not established; OPS-SWEEP-15 localizes this as OPS-121 because `required_signatures.enabled` is not runtime-verified. | Enable required signatures, extend `branch-governance.yml`, and verify unsigned commit cannot merge. |
| Required PR reviews | open | open | Branch protection proof of required reviews is not established; OPS-SWEEP-15 localizes this as OPS-122 because required review/CODEOWNER settings are not runtime-verified. | Enable required approving review count/CODEOWNER review, extend `branch-governance.yml`, and verify self-merge is blocked. |
| Test adequacy gap | open | partial-repo | Targeted tests exist; full closed-finding mapping is incomplete. | Create P0/P1 finding-to-test map. |

## Top Blockers

| Priority | Blocker | Why it matters | Blocks | Required proof |
|---|---|---|---|---|
| P0 | Customer PEP no-bypass proof | Without a non-bypassable downstream enforcement point, Attestor can be advisory only. | Limited enforcement, enterprise pilot | Live request bypassing Attestor must fail downstream. |
| P0 | External KMS/HSM runtime signing | Production authority should not depend on raw private keys in process memory. | Limited enforcement, enterprise pilot | KMS-backed signing/verification test with key identity evidence. |
| P0 | Shared replay/introspection store proof | Single-node memory state is insufficient for HA replay safety. | Limited enforcement, enterprise pilot | Multi-instance replay test with shared Redis/Postgres state. |
| P0 | Ops/IAM/K8s/secrets review | Deployment misconfiguration can invalidate strong repo-side controls. | Live shadow, limited enforcement, enterprise pilot | Static ops review plus live secret/IAM/KMS probes. |
| P1 | Admin and release-route live role-key proof | Admin and release-decision routes are high-authority hosted attack surfaces even after repo-side route hardening. | Limited enforcement, enterprise pilot; recommended before live shadow | Live role-scoped key deployment, release-route role escalation denial, legacy superuser-key rotation/holding proof, and admin rate-limit abuse probe. |
| P1 | Branch protection signatures and PR reviews | CI gates are stronger when author identity and review are enforced by platform policy; OPS-SWEEP-15 localizes this to OPS-121/122. | Enterprise pilot; recommended before live shadow | GitHub protection API proof and unsigned/self-merge negative merge tests. |
| P1 | Demo path traversal and redaction hygiene | Public demo must not leak local paths, secrets, or misleading raw data. | Public demo / marketing | Adversarial demo CLI and redaction tests. |
| P1 | Test adequacy map | Closed findings must be regression-locked, not merely adapted to new code. | Limited enforcement, enterprise pilot | P0/P1 finding-to-negative-test matrix. |
| P1 | Tenant proof-chain tests | Tenant confusion is high-impact for a control plane. | Limited enforcement, enterprise pilot | Tenant mismatch, cross-tenant proof, dashboard artifact tests. |
| P2 | CORS/CSRF deployment contract | Browser-facing deployment assumptions must be explicit and tested. | Public dashboard, enterprise pilot | CORS allowlist and CSRF negative tests in staging. |

## Execution Phases

### Phase 1 - Live Shadow Readiness

Goal: real infrastructure, real integration, no downstream enforcement, no raw customer data.

Required repo tasks:

- Start `ops/**` audit and record deployment no-go conditions.
- Deep audit `src/service/http/routes/admin-routes.ts`.
- Create current posture baseline PR contract enforcement.
- Fix demo path traversal and expand secret redaction tests.
- Create P0/P1 finding-to-test adequacy map.

Required ops tasks:

- Provision fake tenant only.
- Configure budget alerts and kill switch.
- Configure KMS/Secret Manager/Redis/Postgres assumptions without raw customer data.
- Verify logs and artifacts are redacted/digest-only.

Required tests:

- Tenant mismatch.
- Fake signature.
- Bad token.
- Replay.
- Provider outage/degraded mode.
- Dashboard/proof artifact privacy review.

Exit criteria:

- No raw customer payloads in logs, artifacts, dashboards, or evidence packets.
- Admin route audit has no unresolved P0/P1.
- Ops no-go list is explicit.
- Shadow traffic cannot trigger real downstream action.

Expected duration: 1-2 focused weeks if scope stays narrow.

### Phase 2 - Limited Live Enforcement

Goal: small blast radius, kill switch, reference PEP no-bypass proof.

Required repo tasks:

- Wire or document external KMS/HSM signing path for production authority.
- Add shared replay/introspection store configuration and tests.
- Close tenant proof-chain tests for admission, token, evidence, and dashboard scope.
- Harden or document CORS/CSRF deployment contract.

Required live tests:

- Direct downstream bypass attempt fails.
- Attestor allow path succeeds only for scoped valid token.
- Review/block path prevents downstream action.
- Replay attempt fails across instances.
- Provider outage fails closed or enters bounded break-glass with TTL/audit trail.
- Kill switch stops enforcement safely.

Exit criteria:

- Reference PEP integration is non-bypassable in test environment.
- KMS signing and key identity are proven.
- Shared replay store holds under multi-instance test.
- Rollback and kill switch are exercised.

Expected duration: 6-10 weeks depending on infra maturity and customer PEP scope.

### Phase 3 - Public Demo / Marketing

Goal: no-overclaim live flow and evidence video.

Allowed claims:

- Attestor is an AI action control and consequence admission layer.
- The demo shows repo-backed controls for admitting, narrowing, reviewing, or blocking proposed actions.
- The demo uses fake tenant data and digest/redacted evidence.

Forbidden claims:

- Do not claim production-ready.
- Do not claim enterprise-ready.
- Do not claim fully secure.
- Do not claim external certification or complete audit.

Demo flow:

1. AI proposes an action for a fake tenant.
2. Attestor evaluates policy, evidence, authority, scope, and replay controls.
3. One valid action is admitted.
4. One tenant mismatch is blocked.
5. One fake signature is rejected.
6. One replay attempt is rejected.
7. Dashboard/proof artifact shows redacted/digest-only evidence.

Required pre-demo checks:

- Demo CLI path allowlist.
- Secret redaction expansion.
- Screenshot/video privacy review.
- README claim check against this baseline.

### Phase 4 - Enterprise Pilot

Goal: external confidence with bounded customer scope.

Required work:

- External AppSec review.
- Live adversarial bench.
- Ops/IAM/K8s/secrets review.
- SOC 2 readiness package.
- Customer onboarding docs and no-bypass PEP guide.
- KMS/HSM signing evidence.
- Incident response, key rotation, and break-glass runbooks.

Pilot constraints:

- Small tenant set.
- Explicit kill switch.
- Scoped action families only.
- No raw customer data retention.
- Monitoring and audit trail reviewed weekly.

Exit criteria:

- External review has no unresolved P0/P1.
- Live PEP and replay tests pass.
- Customer-facing claims match repo and live evidence.

## Next 14 Days Plan

| Day / Batch | Target | Why | Commands / checks | Output | Merge criteria |
|---|---|---|---|---|---|
| Day 1 | Baseline contract | Prevent drift and random fix-follow work. | `npm run check:baseline-alignment`, PR contract checks | Baseline doc, PR template, CI check | Baseline PR green. |
| Day 2 | Branch protection proof | Close OPS-121/122 signature/review governance gap. | GitHub protection API checks | Protection evidence doc | Unsigned/self-merge negative proof. |
| Day 3-4 | `ops/**` audit start | Ops is production-side unknown. | Static review, secret/IAM/K8s checklist | Ops no-go list | No unresolved live-shadow P0. |
| Day 5-6 | Admin routes deep audit | High-authority hosted surface. | Route tests and authZ review | Admin route finding map | No unresolved P0/P1 for shadow. |
| Day 7 | Demo CLI path traversal fix | Public demo hygiene. | Adversarial scenario path tests | Closed B-025 | Negative test proves traversal blocked. |
| Day 8 | Secret redaction expansion | Prevent public artifact leaks. | Redaction unit tests for AWS/GCP/JWT/SSH/GitHub tokens | Closed B-028 | Redaction tests pass. |
| Day 9 | Test adequacy sample | Ensure closed findings are regression-locked. | P0/P1 finding-to-test map | Adequacy matrix | Each P0/P1 has negative/adversarial test or explicit gap. |
| Day 10 | Tenant proof-chain tests | Reduce tenant confusion risk. | Tenant mismatch, cross-tenant proof artifact tests | Tenant isolation evidence | Cross-tenant attempts fail. |
| Day 11 | Shared replay store plan | Prepare live shadow/limited enforcement. | Redis/Postgres config review | Replay-store test plan | Multi-instance test ready. |
| Day 12 | CORS/CSRF deployment contract | Browser boundary clarity. | CORS/CSRF negative checks | Deployment contract update | Browser mutation without header fails. |
| Day 13 | Live shadow rehearsal plan | Turn repo proof into live test plan. | Dry-run checklist | Shadow runbook | All no-go conditions explicit. |
| Day 14 | Baseline refresh | Keep source of truth current. | `git fetch`, checks, status reconciliation | Baseline update PR if needed | Only material changes update baseline. |

## Live Test Matrix

| Scenario | Expected Attestor verdict | Expected downstream result | Evidence required |
|---|---|---|---|
| Valid scoped fake-tenant action | admit or narrow | Allowed only through PEP | Signed proof, token scope, PEP log. |
| Tenant mismatch | block | No downstream call | Tenant mismatch reason and no target-system call. |
| Fake signature | reject | No downstream call | Signature verifier error and audit entry. |
| Bad token | deny / indeterminate | No downstream call | Token failure reason. |
| Replay token/proof | deny | No downstream call | Replay ledger hit across instances. |
| Direct adapter bypass | not applicable to Attestor path | Downstream rejects | PEP denial log. |
| Provider outage | fail closed or bounded break-glass | No action unless scoped break-glass | Outage simulation, TTL, audit trail. |
| Redis outage | fail closed or documented degraded behavior | No replay bypass | Store outage evidence. |
| Vault/KMS outage | fail closed for signing/secrets | No forged authority | KMS/Vault error and denial. |
| Dashboard/proof review | redacted/digest-only | No raw customer data shown | Screenshot/artifact redaction review. |

## Baseline Update Rule

This baseline may be updated only when:

- a P0/P1 blocker closes,
- a new P0/P1 appears,
- `origin/master` changes posture materially,
- live shadow readiness state changes,
- external/live evidence invalidates a previous assumption.

Every update must include:

- previous state,
- new state,
- evidence,
- reason,
- `origin/master` HEAD.

## Baseline Boot Prompt

Use this prompt at the start of new audit/remediation sessions:

```text
Before doing anything, read and treat this file as the active operating baseline:

docs/audit/current-posture-baseline.md

Rules:
1. Do not start new broad audit work unless it maps to the baseline.
2. Do not fix random LOW/MEDIUM findings unless they are part of the current phase.
3. Prioritize the Next 5 Actions and the 14-day plan.
4. If you think the baseline is stale, prove it against current origin/master before changing direction.
5. Every proposed task must say which baseline blocker or phase it advances.
6. Do not overclaim production/enterprise readiness.
7. If a new P0/P1 repo-proven issue appears, pause and report it separately.
```
