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
- Baseline HEAD: `2292828d0195e6bdb1113ebdce7a16d914fe89aa`
- Package: `attestor@0.2.0-evaluation`
- Date: 2026-05-22
- Repository-side posture: credible
- Production-side posture: not proven
- Enterprise-side posture: not ready
- Calibrated security score: about 6.8 / 10
- Finding catalog estimate: about 155 high-signal indexed rows
- Closed, effectively closed, or intentionally bounded finding estimate: about 122
- Evidence state: partial-repo, calibrated from audit reports plus spot repo validation
- Evidence system: index layer active; see `docs/audit/README.md`

Short verdict: Attestor has a credible repository-side core for evaluation and
shadow-readiness work. It is not production-ready or enterprise-ready without
live PEP, KMS, replay-store, ops/IAM, route authorization, and adversarial
runtime proof.

Scope note: completed remediation-batch counts refer to the scoped Ops Sweep
P0/P1 repository-side cycle. They do not mean every lower-severity follow-up in
`finding-index.md` has behavioral closure; lower-severity rows may be closed,
accepted as limitations, contradicted, blocked, or live-proof-gated only when
current repository evidence says so.

Baseline HEAD note: `Baseline HEAD` records the last stable reconciliation
input used by this baseline. A baseline-only PR can therefore advance
`origin/master` by one merge commit after this file is written; current
`origin/master` remains the source of truth for new work.

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
| Data minimization | 8 | partial-repo | Strong no-raw-data design in audited core; digest/redaction patterns present; OPS-SWEEP-16 remediation extends operator-output redaction to AWS, GCP, GitHub, JWT, private-key blocks, Slack, Anthropic, OpenAI, runtime markers, and anchored Bearer tokens; committed public docs/evidence roots and selected generated proof/showcase/release-provenance roots now have a public-artifact redaction scanner. OPS-224 adds explicit-root scanning and gates production rehearsal artifact upload on `.attestor/rehearsal` scan success. | Local/live artifacts outside configured public/generated roots, binary disclosure semantics, and dashboard summaries still need context-specific review. Production rehearsal scanning is text-root disclosure hygiene, not generated-run or binary review. | Keep `check:public-artifacts-redaction` green before public demo/release/rehearsal artifacts and continue route/output redaction follow-ups from later sweeps. |
| Proof / signature / key authority | 8 | repo-proven for core, needs ops proof for KMS | Ed25519 verification, trusted fingerprint matching, strict Attestor-specific signing canonical JSON, SPKI-DER fingerprints, PKI trust-chain verification, PKI-bound certificate verification, production-like keyless CA fail-closed behavior for missing release-runtime CA configuration, release/signing canonicalization parity coverage, OPS-SWEEP-19/21 repo-proven DSSE + in-toto-shaped release-kernel evidence packs and release-policy-control-plane policy bundles using payload type `application/vnd.in-toto+json`, in-toto Statement v1, DSSE envelopes, SHA-256 bundle/evidence digests, and key fingerprint binding, and OPS-149 repo-side shared release decision log bootstrap through the PostgreSQL-backed release-authority store. OPS-141/146 are repo-side closed by `tests/f5-keyless-ca-injection-boundary-validation.test.ts`; OPS-145 is repo-side closed by `tests/signing-primitives.test.ts`; OPS-148 is repo-side closed by `tests/release-kernel-canonicalization-parity.test.ts`; OPS-149 is repo-side closed by `tests/release-decision-log-store.test.ts`, `tests/production-shared-request-path-cutover.test.ts`, and `tests/production-shared-multi-instance-recovery.test.ts`; OPS-160/161 are repo-side closed by `tests/release-policy-control-plane-proof-discipline.test.ts`. | Runtime production signing still needs external KMS/HSM proof; live keyless CA configuration proof, release decision log shared-store proof in a customer-operated environment, policy mutation audit shared-store proof, and policy activation approval shared-store proof remain live-proof-only before stronger runtime signing or limited-enforcement claims. | Capture `LP-KMS-RUNTIME-SIGNING`, `LP-RELEASE-DECISION-LOG-SHARED-STORE`, `LP-POLICY-MUTATION-AUDIT-CHAIN-SHARED-STORE`, and `LP-POLICY-ACTIVATION-APPROVAL-SHARED-STORE` before stronger limited-enforcement claims. |
| Enforcement boundary | 7 | partial-repo | Enforcement primitives are strong and OPS-SWEEP-20 maps the release-enforcement-plane substrate: DPoP (RFC 9449), frozen default DPoP algorithm allowlist `[ES256, EdDSA]`, HTTP message signatures (RFC 9421, Ed25519-only), mTLS/workload binding (`x5t#S256` + SPIFFE), token exchange (RFC 8693), online/offline verifier composition, Hono/Node middleware, Envoy ext_authz bridge with validated route risk-class context binding, degraded-mode defaults, freshness rules, and verification profiles are repo-proven at spec, entry-point, export, and test-inventory depth. OPS-155 is repo-side closed by `tests/release-enforcement-plane-dpop-default-policy.test.ts`; OPS-157 is repo-side closed by `tests/release-enforcement-plane-token-exchange.test.ts` with explicit requested/subject token-type denial, actor-chain evidence, and raw actor-token fail-closed no-support; OPS-158 is repo-side closed by `tests/release-enforcement-plane-envoy-ext-authz.test.ts` plus `docs/08-deployment/release-enforcement-plane-envoy.md`; OPS-217/218 now require proof references for generic middleware method opt-outs and `trusted-upstream` binding mode. | Customer PEP no-bypass is not live-proven; raw external actor-token validation is not supported; live Envoy/Istio route-map deployment is not proven; full line-by-line behavioral audit of all 16,972 enforcement-plane source lines is not claimed. | Build one reference PEP integration and prove direct bypass fails before stronger enforcement-plane/no-bypass claims. |
| Token / replay / idempotency | 8 | partial-repo | Explicit token TTL policy, DPoP binding, replay/freshness primitives, online verifier `consumeOnSuccess`, degraded-mode bounded defaults, OPS-SWEEP-10 pipeline `Idempotency-Key` replay protection for `/pipeline/run` and required `Idempotency-Key` queue admission for `/pipeline/run-async`, deterministic BullMQ job claims for idempotent async retries after queue-success / usage-consume failure, OPS-108 repo-side replay/conflict handling for persisted Policy Foundry hosted wizard-state POSTs, OPS-95 header-bound replay/conflict handling for shadow POST/PATCH mutations when `Idempotency-Key` is supplied, OPS-219 repo-side release-review terminal closure repair with deterministic token/evidence identities after post-commit side-effect failures, and local embedded-PostgreSQL rehearsal for consequence retry/replay shared atomic stores. | Multi-instance replay/introspection stores and pipeline/shared/header-bound shadow idempotency still need live shared-store proof; release-review closure repair does not prove live distributed transaction behavior; keyless shadow retries are route-rate-limited but do not have service-level replay/conflict records; local embedded-PostgreSQL rehearsal is not deployed routing, customer-operated database, or outage proof; custom degraded-mode `maxUses > 1` behavior remains a follow-up concern. | Run Redis/Postgres-backed live replay, pipeline/shared/header-bound shadow idempotency, release-review shared-store behavior, and outage tests; keep `test:local-consequence-shared-store-rehearsal` green as a repo-side rehearsal contract only. |
| Tenant isolation | 6 | partial-repo | Tenant middleware and scoped checks exist; B-033 is repo-side closed by route/token/proof/dashboard tenant mismatch tests. | Live shared-store/RLS tenant isolation, customer PEP no-bypass, and production deployment tenant isolation are not proven. | Capture live shared-store/RLS and route/proof/dashboard tenant-boundary probes before stronger live claims. |
| Service/API security | 6 | partial-repo | Edge contract, rate limit, auth/MFA/session/federated auth sampled and generally strong; OPS-SWEEP-06 maps and hardens the 32-route admin surface repo-side; OPS-SWEEP-08 maps and hardens the Stripe/SendGrid/Mailgun webhook signature surfaces repo-side; OPS-SWEEP-09 maps and hardens the 49-route account surface P1s repo-side; account route follow-up remediation adds account-admin mutation idempotency, strict JSON 415/400 handling, shared local password-policy validation, and typed auth-attempt bucket vocabulary; OPS-SWEEP-10 maps and hardens the pipeline execution/async P1 idempotency gap repo-side and adds deterministic BullMQ queue claims for idempotent async retries; OPS-SWEEP-11 maps the 27-route shadow surface, adds shadow mutation audit, adds direct HTTP route coverage, and closes header-bound shadow mutation replay/conflict handling when `Idempotency-Key` is supplied; keyless shadow mutations remain route-rate-limited; OPS-SWEEP-12 maps the 31-route release-decision surface and extends credential-bound role enforcement to release-review and release-policy-control; OPS-SWEEP-13 maps the 5-route onboarding/admission surface, verifies consequence-admission tenant binding, plan-mode gating, agent-loop throttling, protected release token issuance, and sender confirmation, and now closes Policy Foundry persisted wizard-state replay/conflict handling repo-side; OPS-SWEEP-14 maps the final 21-route verification, filing, public-site, and core surface and completes the `/api/v1/**` route-layer deep-audit chain; OPS-112/113 are repo-side remediated by minimal public health/ready responses and a source-scoped `/api/v1/verify` rate limit; OPS-114/117/118/119/120 are repo-side remediated by redacted structured verify logging, bounded verify/filing problem details, minimal startup diagnostics, and public connector catalog redaction; OPS-115/116 are repo-side remediated by shared public-site HTML security headers and no-store cache handling for dynamic pages and committed evidence assets. | `src/service/**` remains only partially audited outside route-layer scope; admin role-key deployment, release-route role enforcement, webhook provider binding, account callback/audit-chain behavior, account mutation idempotency live proof, shared idempotency live proof, shadow mutation audit-chain and header-bound idempotency behavior, health diagnostic split, and verify-route rate-limit behavior still need live proof. | Capture `LP-HEALTH-DIAGNOSTIC-SPLIT`, `LP-VERIFY-RATE-LIMIT`, and shadow/account idempotency live proofs, then continue non-route Phase 1 work. |
| AI-specific attack resistance | 7 | partial-repo | LayerOpinion runtime invariants, reason-code allowlists, belief mass conservation, producer-trust hardening, the untrusted content authority guard, and a local synthetic adversarial evidence fixture bundle for direct prompt injection, indirect web content, tool-output poisoning, model-rationale self-approval, evidence-not-authority, mixed trusted/injected approval, and trust-class promotion attempts. | Local fixtures do not prove live prompt-injection resistance, model jailbreak completeness, deployed tool-boundary behavior, or customer PEP no-bypass. | Keep adversarial evidence fixture tests green and capture live/customer PEP proof before stronger runtime claims. |
| Supply chain / release provenance | 8 | repo-proven / live-proof-only | Workflows SHA-pinned, stale branches removed, PR contract hardened, audit evidence gate exists; OPS-SWEEP-15 audits 13 governance artifacts and confirms branch policy, CODEOWNERS, minimized workflow permissions, supply-chain gates, CodeQL, and evaluation attestation repo-side. OPS-121/122 are repo-side remediated by branch-governance API assertions for required signed commits and required PR reviews. OPS-128 is repo-side closed by CONTRIBUTING guidance that defaults workflow tokens to `contents: read`, limits write-scoped permissions to documented cases, and requires justification plus CODEOWNER review. OPS-213 now runs public-artifact redaction over generated proof/showcase/release-provenance roots before release artifact upload. OPS-223 keeps evidence-pack DSSE validity separate from external artifact verification summary state. OPS-125 is blocked/operator-decision rather than open repo-code work: placeholder per-surface teams are forbidden until visible write-enabled teams plus membership policy exist. | Required commit signatures and required PR reviews still need live GitHub setting proof and unsigned/self-merge negative merge evidence. Release attestation proves provenance/integrity, not safe disclosure or external artifact availability by itself. Per-surface CODEOWNER splitting needs operator-owned team creation and membership policy before repo can name real teams. | Capture `LP-BRANCH-PROTECTION-SIGNATURES` and `LP-BRANCH-PROTECTION-REVIEWS`; keep branch-governance scheduled/manual/master-push checks green, keep release-provenance and production-rehearsal artifact scans green, keep workflow permission guidance aligned with new write scopes, and split CODEOWNERS only after team evidence exists. |
| Cloud / ops readiness | 5 | not proven / needs ops proof | Docs are honest about non-claims; repo has production-readiness scaffolding, HA ops gates, PKI/TLS gates, observability remediation indexes, PITR/Redis recovery hardening, OPS-SWEEP-07 provider/profile hardening, OPS-SWEEP-08 webhook proof gates, OPS-SWEEP-09 account proof gates, OPS-SWEEP-10 pipeline idempotency proof gate, OPS-SWEEP-11 shadow audit/rate-limit/idempotency proof gates, OPS-SWEEP-12 release-route role enforcement proof gate, and stage-aware live proof gates. | Live cloud/IAM/KMS/network/storage observability proof, live PITR/Redis recovery proof, KEDA scaler proof, webhook provider binding proof, account callback/audit-chain proof, pipeline idempotency proof, shadow audit-chain/idempotency proof, release-route role enforcement proof, logging redaction, and billing controls are not fully assessed. | Continue ops audit with remaining provider/live proof surfaces and capture live proof artifacts. |
| Fail-closed / availability | 7 | partial-repo | Empty-input conflict fail-closed, degraded-mode hardening, break-glass TTL, verifier indeterminate states. | Provider outage, Redis/Vault failures, and load behavior need live tests. | Run degraded-mode and provider-outage tests. |
| Test adequacy | 7 | repo-proven for indexed P0/P1 closure guard | Many targeted negative tests exist, audit evidence checks run, OPS-SWEEP-17 maps P0/P1 finding-index rows to locking test evidence, and `scripts/check/check-finding-test-coverage.mjs` now machine-checks closed P0/P1 rows for structured `Locking test:` markers plus existing `tests/*.test.ts` paths. | This guard covers the current high-signal `finding-index.md`, not every historical low-severity report; live/ops blockers still need real environment proof. | Keep `test:audit-finding-test-coverage` green before closing future P0/P1 findings. |
| Docs / no-overclaim truth | 8 | partial-repo | Strong no-overclaim discipline in audit lifecycle and public readiness language. | Older docs may drift from current posture. | Use this baseline as required PR contract input and refresh on material changes. |

## Finding State Reconciliation

| Finding / Risk | Previous state | Current state | Evidence | Action |
|---|---|---|---|---|
| B-081 scope tiebreak `localeCompare` | open / partial-repo | closed | `scoping.ts` uses binary `compareCanonicalLabels`. | No further action unless new locale-sensitive canonical sort appears. |
| B-059 trusted-proxy wildcard | open | disputed/closed | Wildcard requires explicit `ATTESTOR_TRUSTED_PROXY_PEER_WILDCARD_OVERRIDE=accept-the-risk`. | Keep documented; no P0 action. |
| B-069 Vault timeout | open | closed | Vault Transit path has timeout default and env override. | Keep covered by service checks. |
| B-033 tenant payload optionality | open | closed | Route, token/introspection, proof-chain, and dashboard tenant mismatch behavior is now repo-side tested. | Keep locking tests green; live shared-store/RLS tenant isolation remains outside this closure. |
| B-025 demo CLI path traversal | closed | repo-proven | `scripts/demo/demo-path-boundary.ts` constrains demo scenario/showcase source paths by default and `tests/golden-refund-reviewer-sandbox.test.ts` locks negative CLI paths. | Operator-local override remains available with explicit warning; do not use it for public artifacts without scanner/review. |
| B-028 secret redaction coverage | closed | repo-proven | `scripts/lib/secret-safe-output.ts`, `tests/production-readiness-secret-safe-output.test.ts`, `scripts/check/check-public-artifacts-redaction.mjs`, Security Scan, and release-provenance pre-upload scanning close the provider-pattern, committed public-artifact, and selected generated proof/showcase/release-provenance scan gaps. | Scanner coverage is limited to configured public/generated text roots; live/operator artifacts and binary disclosure semantics need separate proof/review. |
| Admin API key blast radius | not fully elevated | partial / live-proof-only | OPS-SWEEP-06 adds role-scoped admin credentials, admin-route role allowlists, actor-role audit fields, admin auth rate limiting, and HTTP tests; OPS-SWEEP-12 extends credential-bound role enforcement to release-review and release-policy-control routes; legacy `ATTESTOR_ADMIN_API_KEY` remains a superuser compatibility fallback. | Prove live role-scoped operator key deployment, release-route role enforcement, and rotate or tightly hold the legacy superuser key. |
| Customer PEP no-bypass | not proven | needs live test | Repo primitives exist, but downstream non-bypassable integration is not live-proven. | Build reference integration and bypass test. |
| External KMS runtime signing | accepted limitation | needs ops proof | In-process/private-key boundary is acceptable for evaluation, not production; OPS-SWEEP-18 confirms the GCP KMS adapter is contract-ready but `activatesRuntimeSigning` remains false. | Track OPS-142; wire external KMS/HSM signer path and capture `LP-KMS-RUNTIME-SIGNING` before live enforcement. |
| Release-kernel decision engine | implicit substrate | partial-repo | OPS-SWEEP-19 maps 22 release-kernel source files plus 2 release-layer barrels, deep-audits the decision engine/log/evidence-pack/introspection/checks/canonicalization/wedge core, confirms DSSE + in-toto-shaped evidence-pack support, and now has parity locks for signing/release canonicalization, first hard gateway wedge/policy/default-engine alignment, and deterministic-check observation-array resource budgets. The production-shared authority-plane track adds the shared PostgreSQL release decision log store and runtime request-path cutover. | OPS-148, OPS-149, OPS-151, and OPS-152 are repo-side closed; OPS-149 remains live-proof-only for external customer-operated PostgreSQL/rehearsal evidence, OPS-153 remains accepted production-bootstrap discipline, and route/API parser budgets must stay aligned if deterministic-check observations become newly external. |
| Release-enforcement-plane runtime substrate | implicit substrate | partial-repo | OPS-SWEEP-20 maps 22 release-enforcement-plane files (16,972 source lines) and confirms DPoP, a frozen default DPoP accepted-algorithm policy constant, HTTP message signatures, workload binding, token exchange, online/offline verifiers, middleware, Envoy ext_authz, validated Envoy route risk-class context binding, degraded mode, freshness rules, and verification profiles at spec/entry-point/export/test-inventory depth. Token exchange now has dedicated repo-side coverage for audience/resource/scope narrowing, requested/subject token-type denial, actor-chain nesting, parent/source audience linkage, and raw actor-token fail-closed no-support. Generic middleware now requires `methodCoverageProof` for default-method opt-outs and `trustedUpstreamProof` for `trusted-upstream` header-derived binding mode. | Line-by-line behavioral audit of the full surface is not claimed; customer PEP no-bypass, raw external actor-token support, live upstream gateway proof, and live Envoy/Istio route-map deployment remain live-proof or unsupported boundaries. | Continue focused follow-ups only where module-specific risk warrants it. |
| Release-policy-control-plane authoring substrate | implicit substrate | partial-repo / live-proof-only | OPS-SWEEP-21 maps 18 release-policy-control-plane source files (6,656 source lines) and confirms DSSE + in-toto-shaped policy bundles, EdDSA-only policy bundle signing, hash-chained policy mutation audit logs, binary scope tie-break (B-081 closure), typed activation approval gates, risk-class TTL defaults, and 19 dedicated tests at spec/entry-point/targeted-deep/test-inventory depth. OPS-160/161 are repo-side closed by proof-discipline docs and gate coverage; OPS-163 is repo-side closed by approval/scoping behavioral locks for late-decision denial, deterministic approval ordering, R4 dual approval, scope hierarchy, precedence, ambiguity, and descriptor alignment. OPS-162 remains accepted limitation / live-proof-only. Production remains not proven. | Full line-by-line behavioral audit of all 6,656 source lines is not claimed; policy mutation audit shared-store proof and activation approval shared-store proof remain live-proof-only. | Capture `ATTESTOR_POLICY_MUTATION_AUDIT_CHAIN_PROOF` and `ATTESTOR_POLICY_ACTIVATION_APPROVAL_STORE_PROOF` before multi-instance policy-control durability claims, or continue remaining focused sub-sweeps only where module-specific risk warrants it. |
| Consequence-admission engine | implicit substrate | partial-repo | OPS-SWEEP-22 maps 155 consequence-admission source files and confirms the action-side admission substrate at spec, entry-point, exported-constant, critical-path, route/bootstrap, and inventory depth: explicit two-surface facade, four-decision admission model, required `narrow` constraints, retry-attempt binding, no-go-condition ledger with natural-language bypass reason codes, tamper-evident history with `rawPayloadStored: false`, presentation replay ledger atomic `setIfAbsent`, downstream contract typed `failClosed: true`, customer-PEP runtime adoption with `productionReady: false` and `activatesEnforcement: false`, and shared atomic store schemas with explicit production no-claims. OPS-167 is repo-side closed by runtime trust-origin checks: caller-supplied `observedFeatures.adapterReady` no longer satisfies `adapter-readiness` without `operator-attested`, `customer-gateway`, `attestor-runtime`, or `trusted-adapter` origin evidence; generic admissions now run the untrusted-content authority guard over structured `authoritySources` so untrusted content, tool output, retrieved content, and model summaries cannot authorize a consequence or self-promote into trusted authority; approval-backed authority now runs the approval-provenance guard over structured `approvals` so missing, untrusted, model-generated, or tool-output approval claims hold or fail closed; and generic admissions now run the no-go condition ledger over structured `noGoConditions` / no-go bypass signals so active holds and natural-language bypass attempts block while returning only counts, reason codes, and digests. OPS-168 is repo-side closed / live-proof-only through `ATTESTOR_CONSEQUENCE_RETRY_ATTEMPT_LEDGER_PROOF`; OPS-170 is repo-side closed by a focused `index.ts` sub-sweep and locking test over response, generic envelope, and retry-budget evidence surfaces; OPS-171 is accepted as a sub-sweep backlog with explicit family triggers and no-claim boundaries; OPS-214 closes the repo-side customer middleware example gate so copy-paste examples hold observe/warn, missing-proof, receipt-only, failed-check, fail-closed, and missing bounded-intent paths; OPS-215 closes the downstream enforcement contract receipt-only execution-proof gap; OPS-216 forces table-owner RLS in the consequence shared atomic and history/outbox schemas while keeping superuser/BYPASSRLS and deployment proof live-only; production remains not proven. | Full line-by-line behavioral audit of all 155 source files and 53 admission/consequence tests is not claimed; generic policy/evidence refs are still reference-level contracts rather than semantic policy-store/evidence-store validation; trusted `authoritySources`, `approvals`, and `noGoConditions` still depend on customer/operator provenance and digest evidence; signed-approval PKI verification is not exposed as a generic route input in this slice; multi-instance retry-attempt ledger shared-store proof and deployed non-BYPASSRLS database role posture remain live-proof-only; Customer PEP no-bypass remains live-proof-only; OPS-171 does not prove family-level assertion-depth closure; middleware examples do not prove live customer enforcement. | Capture `ATTESTOR_CONSEQUENCE_RETRY_ATTEMPT_LEDGER_PROOF` and `LP-CUSTOMER-PEP-NO-BYPASS`; run queued family sub-sweeps only when module-specific risk warrants it. |
| Shared replay/introspection store | partial | needs live test | Replay/freshness primitives exist, and `tests/local-consequence-shared-store-rehearsal.test.ts` rehearses consequence retry/replay shared atomic stores locally with embedded PostgreSQL and reconnect behavior. HA/shared backend proof is still missing. | Test Redis/Postgres-backed replay/introspection behavior across deployed instances; do not treat local embedded-PostgreSQL rehearsal as captured live proof. |
| `ops/**` audit gap | partial | not proven / live-proof-only for remediated slices | OPS-SWEEP-01 through OPS-SWEEP-22 are report-indexed; Sweep 01/02 high-signal live-shadow and PKI/TLS findings are now explicitly reconciled in `finding-index.md` as repo-side closed, disputed/closed, accepted limitations, or live-proof-only. Profile/provider/webhook/account/pipeline/shadow/release-route/live-proof capture and branch-governance audit have repo-side hardening, with branch-protection API assertions now repo-side locked. Live cloud, provider, and GitHub negative-proof evidence remains incomplete. | Continue ops audit and capture live proof before live shadow. |
| `src/service` admin routes gap | open | closed repo-side / live-proof-only | OPS-SWEEP-06 maps all 32 admin routes and closes repo-side P1/P2 route findings; admin reads and one-time response key material remain accepted limitations. | Capture admin role-key deployment and rate-limit abuse proof before stronger live claims. |
| Webhook signature verification | partial | closed repo-side / live-proof-only | OPS-SWEEP-08 maps Stripe, SendGrid, and Mailgun provider webhook surfaces; direct verifier tests lock fake-signature behavior; email webhooks require shared control-plane storage by default; webhook proof flags are in the live-shadow gate. | Capture live provider endpoint binding, fake-signature probes, webhook rate-limit behavior, and email webhook replay-store proof before stronger live claims. |
| Account route authorization | partial | P1 closed repo-side / live-proof-only; P2/P3 cleanup partly closed | OPS-SWEEP-09 maps all 49 account routes, adds SAML/OIDC callback rate limiting before callback verification, and writes account-session mutation records into the hash-linked audit ledger; account follow-up remediation closes OPS-81/82/83/85 with account-admin mutation idempotency, shared password-policy validation, strict account JSON parsing, and typed auth-attempt bucket vocabulary. | Capture federated callback rate-limit, account mutation audit-chain, account mutation idempotency, and shared auth-abuse-store proof; B-033 tenant proof-chain is repo-side closed but live shared-store/RLS proof remains. |
| Pipeline execution / async routes | partial | P1 closed repo-side / live-proof-only; route cleanup follow-ups closed for indexed repo-side items | OPS-SWEEP-10 maps `/api/v1/pipeline/run`, `/api/v1/pipeline/run-async`, and `/api/v1/pipeline/status/:jobId`; `Idempotency-Key` now replays sync/async responses without double-consuming quota and conflicts on mismatched payloads, and `/api/v1/pipeline/run-async` now rejects keyless submissions before queue admission. PR9 route cleanup closes pipeline strict JSON media-type handling, connector/client error-detail redaction, and UUID-backed run IDs repo-side; OPS-89 adds deterministic BullMQ queue claims for idempotent async retries after queue-success / usage-consume failure; OPS-87 decomposes the sync `/run` route body by finance filing, communication, action release, and auto-filing stages while preserving route behavior. | Capture `ATTESTOR_PIPELINE_IDEMPOTENCY_PROOF`; do not claim live Redis/Postgres transaction proof, external connector cost-limit proof, or production pipeline readiness from repo-side helper decomposition and queue-claim tests. |
| Shadow routes authorization | partial | P1 closed repo-side / live-proof-only; route cleanup partly closed | OPS-SWEEP-11 maps all 27 shadow routes, writes successful shadow POST/PATCH mutations into the hash-linked audit ledger under `tenant_context`, and adds direct HTTP-layer coverage for every registered shadow route. PR9 route cleanup closes the shadow non-JSON content-type 415 status mismatch repo-side; shadow follow-up remediation adds tenant+route scoped 429 handling for mutation routes, bounded `limit`/`cursor` pagination for shadow lists, bounded problem-detail redaction for caught store/constructor failures, and optional `Idempotency-Key` replay/conflict handling for shadow POST/PATCH mutations through the encrypted idempotency service. | Capture `ATTESTOR_SHADOW_MUTATION_AUDIT_CHAIN_PROOF`, `ATTESTOR_SHADOW_MUTATION_RATE_LIMIT_PROOF`, and `ATTESTOR_SHADOW_MUTATION_IDEMPOTENCY_PROOF`; live multi-replica/shared-store behavior remains unproven. |
| Release-review / release-policy-control authorization | partial | P1 closed repo-side / live-proof-only; release-review and release-policy route cleanup closed | OPS-SWEEP-12 maps all 31 release-decision routes and enforces credential-bound read, mutation, and break-glass role allowlists across release-review and release-policy-control. PR9 route cleanup adds shared HTML security headers to release-review inbox/detail views; release-policy-control route cleanup adds bounded typed error mappings plus default/max `limit` and cursor pagination for the pack, bundle/version, activation, and approval list routes; OPS-105 separates `x-attestor-admin-actor-role` authorization input from `x-attestor-policy-actor-role` approval/audit metadata; OPS-219 makes release-review terminal token/evidence closure recoverable after post-commit side-effect failures; OPS-220 fails closed when atomic-required policy lifecycle routes would otherwise use fallback stores; OPS-221 derives no-explicit emergency-freeze bundle provenance inside the lifecycle snapshot. | Capture `ATTESTOR_RELEASE_ROUTE_ROLE_ENFORCEMENT_PROOF`; do not treat policy-domain actor labels as authorization roles, release-review recovery as live distributed transaction proof, release-policy lifecycle guards as live shared-store proof, or live role-key deployment proof. |
| Onboarding / admission authorization | partial | no P0/P1 surfaced; route cleanup follow-ups closed for indexed repo-side items except accepted limitations | OPS-SWEEP-13 maps all 5 onboarding/admission routes and verifies admission envelope tenant binding, plan-mode gate, agent-loop abuse guard, protected release token issuance, sender confirmation, and fail-closed shadow recording. PR9 route cleanup closes hosted onboarding shadow-event tenant assertions, Policy Foundry HTML security headers, generic/onboarding 415 content-type handling, generic admission problem-detail redaction, and Policy Foundry persisted wizard-state replay/conflict handling repo-side. | Do not claim production enforcement from hosted onboarding routes; shared idempotency behavior still needs live shared-store proof before HA/runtime claims. |
| Final route surface authorization | partial | P1 repo-side closed; live-proof-only remains | OPS-SWEEP-14 maps pipeline verification, filing export, public-site, and core routes; PKI mandatory verification, release-token consume-on-success, public evidence path traversal defense, and public trust-root contract are repo-proven. OPS-112 and OPS-113 are repo-side remediated by `src/service/http/routes/core-routes.ts`, `src/service/http/routes/pipeline-verification-routes.ts`, `src/service/public-route-rate-limit.ts`, `tests/service-core-routes.test.ts`, and `tests/pipeline-verification-routes.test.ts`; OPS-114/117/118/119/120 are repo-side closed by `src/service/http/route-response-helpers.ts`, `src/service/http/routes/pipeline-verification-routes.ts`, `src/service/http/routes/pipeline-filing-routes.ts`, `src/service/http/routes/core-routes.ts`, `tests/pipeline-verification-routes.test.ts`, `tests/pipeline-filing-default-secure.test.ts`, `tests/service-core-routes.test.ts`, and `tests/f8-operational-resilience-validation.test.ts`. | Capture `LP-HEALTH-DIAGNOSTIC-SPLIT` and `LP-VERIFY-RATE-LIMIT` before stronger live-shadow route claims. |
| Required commit signatures | open | closed repo-side / live-proof-only | Branch-governance now asserts `required_signatures.enabled == true` and the live-shadow gate carries `ATTESTOR_BRANCH_PROTECTION_SIGNATURES_PROOF`; live GitHub setting proof and unsigned-commit negative merge proof are still required. | Capture `LP-BRANCH-PROTECTION-SIGNATURES`. |
| Required PR reviews | open | closed repo-side / live-proof-only | Branch-governance now asserts required PR reviews, CODEOWNER review, stale-review dismissal, and last-push approval; the live-shadow gate carries `ATTESTOR_BRANCH_PROTECTION_REVIEWS_PROOF`; live GitHub setting proof and self-merge negative proof are still required. | Capture `LP-BRANCH-PROTECTION-REVIEWS`. |
| Test adequacy gap | closed | repo-proven | OPS-SWEEP-17 created the P0/P1 finding-to-test map; OPS-136/139 remediation adds `scripts/check/check-finding-test-coverage.mjs`, `tests/finding-test-coverage.test.ts`, Evaluation Smoke wiring, structured `Locking test:` markers for closed P0/P1 rows, and future `Test contract:` markers for P0 live/ops blockers. | Keep the guard current as findings move state; do not treat live/ops blockers as repo-closed. |

## Top Blockers

| Priority | Blocker | Why it matters | Blocks | Required proof |
|---|---|---|---|---|
| P0 | Customer PEP no-bypass proof | Without a non-bypassable downstream enforcement point, Attestor can be advisory only. | Limited enforcement, enterprise pilot | Live request bypassing Attestor must fail downstream. |
| P0 | External KMS/HSM runtime signing | Production authority should not depend on raw private keys in process memory; OPS-SWEEP-18 localizes the repo-side Phase 2 path to OPS-142. | Limited enforcement, enterprise pilot | KMS-backed signing/verification test with key identity evidence and downstream verifier acceptance. |
| P0 | Shared replay/introspection store proof | Single-node memory state is insufficient for HA replay safety. | Limited enforcement, enterprise pilot | Multi-instance replay test with shared Redis/Postgres state. |
| P0 | Ops/IAM/K8s/secrets review | Deployment misconfiguration can invalidate strong repo-side controls. | Live shadow, limited enforcement, enterprise pilot | Static ops review plus live secret/IAM/KMS probes. |
| P1 | Admin and release-route live role-key proof | Admin and release-decision routes are high-authority hosted attack surfaces even after repo-side route hardening. | Limited enforcement, enterprise pilot; recommended before live shadow | Live role-scoped key deployment, release-route role escalation denial, legacy superuser-key rotation/holding proof, and admin rate-limit abuse probe. |
| P1 | Branch protection signatures and PR reviews | CI gates are stronger when author identity and review are enforced by platform policy; OPS-SWEEP-15 localizes this to OPS-121/122 and repo-side branch-governance assertions now exist. | Enterprise pilot; recommended before live shadow | GitHub protection API proof and unsigned/self-merge negative merge tests. |
| P1 | Demo path traversal and redaction hygiene | Public demo must not leak local paths, secrets, or misleading raw data; OPS-SWEEP-16 remediation closes the repo-side provider redaction, public artifact scan, and demo path basedir gaps. | Public demo / marketing | Keep scanner/test gates green and review any new generated public artifacts before publication. |
| P1 | Test adequacy map | Closed findings must be regression-locked, not merely adapted to new code; the repo now has a machine-checked `Locking test:` guard for current high-signal P0/P1 rows. | Limited enforcement, enterprise pilot | Keep `test:audit-finding-test-coverage` green and require markers before future P0/P1 closure. |
| P1 | Tenant live shared-store/RLS proof | Tenant confusion is high-impact for a control plane; repo-side route/token/proof/dashboard tests now cover B-033, but deployed storage and route probes are not live-proven. | Limited enforcement, enterprise pilot | Live cross-tenant route, proof, dashboard, and shared-store/RLS tenant-boundary probes. |
| P2 | CORS/CSRF deployment contract | Repo-side account-session browser mutation guard is runtime-wired: cookie-authenticated unsafe account mutations require `x-attestor-csrf`, reject `Sec-Fetch-Site: cross-site`, and require exact same-origin or configured browser origins. | Public dashboard, enterprise pilot | Capture `LP-CORS-CSRF-DEPLOYMENT-CONTRACT` with staging CORS allowlist and browser negative tests before live dashboard claims. |

## Execution Phases

### Phase 1 - Live Shadow Readiness

Goal: real infrastructure, real integration, no downstream enforcement, no raw customer data.

Required repo tasks:

- Start `ops/**` audit and record deployment no-go conditions.
- Deep audit `src/service/http/routes/admin-routes.ts`.
- Create current posture baseline PR contract enforcement.
- Fix demo path traversal and expand secret redaction tests.
- Keep the P0/P1 finding-to-test adequacy map guarded by `test:audit-finding-test-coverage`; OPS-SWEEP-17 produced the matrix and OPS-136/139 added the closure guard.

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
- Add shared replay/introspection store configuration and tests; repository-side local consequence retry/replay shared-store rehearsal exists, but live replay/introspection proof remains required.
- Keep tenant proof-chain tests green for admission, token, evidence, and dashboard scope; capture live shared-store/RLS tenant-boundary proof before stronger claims.
- Keep CORS/CSRF deployment contract tests green and capture staging CORS/browser negative proof before dashboard/live claims.

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
| Day 2 | Branch protection proof | Complete the live-proof side of OPS-121/122 after repo-side workflow remediation. | Branch-governance API checks and manual negative probes | `LP-BRANCH-PROTECTION-SIGNATURES`; `LP-BRANCH-PROTECTION-REVIEWS` | Unsigned/self-merge negative proof. |
| Day 3-4 | `ops/**` audit start | Ops is production-side unknown. | Static review, secret/IAM/K8s checklist | Ops no-go list | No unresolved live-shadow P0. |
| Day 5-6 | Admin routes deep audit | High-authority hosted surface. | Route tests and authZ review | Admin route finding map | No unresolved P0/P1 for shadow. |
| Day 7 | Demo CLI path traversal fix | Public demo hygiene. | Adversarial scenario path tests | Closed B-025 / OPS-133 repo-side | Negative test proves out-of-basedir path blocked or explicitly override-gated. |
| Day 8 | Secret redaction expansion | Prevent public artifact leaks. | Redaction unit tests for AWS/GCP/JWT/private-key/GitHub/provider tokens + public artifact scan | Closed B-028 / OPS-129 / OPS-132 repo-side | Redaction tests and public artifact scan pass. |
| Day 9 | Test adequacy sample | Ensure closed findings are regression-locked. | P0/P1 finding-to-test map plus OPS-136/139 guard | OPS-SWEEP-17 adequacy matrix plus `test:audit-finding-test-coverage` | Each current high-signal P0/P1 has a locking test, explicit live test contract, or an open/accepted/non-repo state; closed rows are machine-checked. |
| Day 10 | Tenant proof-chain tests | Reduce tenant confusion risk. | Tenant mismatch, cross-tenant proof artifact tests | Tenant isolation evidence | Repo-side cross-tenant attempts fail; live shared-store/RLS proof remains. |
| Day 11 | Shared replay store plan | Prepare live shadow/limited enforcement. | Redis/Postgres config review | Replay-store test plan | Multi-instance test ready. |
| Day 12 | CORS/CSRF deployment contract | Browser boundary clarity. | CORS/CSRF negative checks | Deployment contract update plus live proof capture | Browser mutation without CSRF, cross-site Fetch Metadata, and untrusted Origin fail. |
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
