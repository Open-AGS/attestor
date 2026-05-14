# F1 Threat Model Foundation Validation

This document validates the project-owner supplied F1 cross-cutting audit findings against repository evidence and records the remediation status. It is not a certification, not an independent external audit, and not a claim of full production readiness.

## Audit Run Header

```text
Audit ID: F1-threat-model-foundation-validation
Audit title: F1 cross-cutting threat-model validation and first remediation slice
Mode: remediation
Target ref: origin/master @ 4e4d7a7
Date: 2026-05-12
Reviewer: Codex
Threat model / framework: STRIDE cross-cutting chain review; OWASP Agentic AI and MITRE ATLAS used only as engineering anchors where recorded
Research anchors: repository evidence first; current MITRE ATLAS YAML checked for technique-name normalization; no certification mapping claimed
Scope: F1 CC-1 through CC-6 excerpts supplied by the project owner
Files/modules inspected: generic admission route, agent-loop abuse guard, runtime backend wiring, production storage path gate, shadow tenant boundary, data-minimization policy, replay and audit history surfaces
Out of scope: live cloud rollout, private financial constraints, live customer data, production environment proof
Known limitations: static validation plus targeted local tests; not a runtime red-team exercise against deployed infrastructure
```

## Summary

| ID | Status | Severity | Result |
|---|---|---|---|
| CC-1 | refined | high | Shared agent-loop guard gap confirmed for HA/production-like runtime. This PR adds Redis-backed shared guard wiring and fail-closed route behavior when shared guard is required but unavailable. |
| CC-2 | accepted limitation | high | Customer-gate auto-promotion risk is real as an integration misuse pattern, but not proven as a direct route bypass in the repository helper. Track as non-bypassable downstream gateway/customer SDK hardening. |
| CC-3 | refined | medium | Cross-vector replay correlation is a valid observability/investigation gap. Existing controls are not all in-memory. Durable presentation replay and cross-vector replay correlation remain backlog. |
| CC-4 | refined | medium | Data minimization policy exists and raw leaks were not proven on the reviewed surfaces. Mandatory surface-level enforcement and docs sync remain backlog. |
| CC-5 | confirmed | medium | `/api/v1/admissions` accepted body `tenantId` over authenticated tenant context. This PR fails closed on tenant mismatch before shadow recording. |
| CC-6 | refined | medium | Cross-log anchoring is a real integrity-hardening gap, but several logs already have hash-chain or shared-store behavior. Shared consequence history and meta-anchor work remain backlog. |

## CC-1 - Agent Loop Abuse Guard Shared Runtime

```text
ID: CC-1
Title: Agent-loop abuse guard must coordinate across runtime instances
Audit run: F1-threat-model-foundation-validation
Status: refined
Severity: high
Protected principle: fail-closed boundary; operational boundedness; replay and idempotency safety
Trust surface: /api/v1/admissions retry and admission edge
Source: project-owner supplied F1 audit excerpt
Exact file/path: src/consequence-admission/agent-loop-abuse-guard.ts; src/service/bootstrap/routes.ts; src/service/agent-loop-abuse-guard.ts
Exact function/route/test/contract: POST /api/v1/admissions; createServiceAgentLoopAbuseGuard
Affected modules or chain: generic admission route -> agent-loop guard -> shadow admission recording
Observed behavior: the package-level reference guard used in-memory Maps; production docs already warned that shared storage is required for multi-instance exposure.
Expected behavior: production-like runtime must use shared counters/signatures or fail closed before accepting the admission.
Risk: an agent can probe or flood independently per instance if the guard is local memory only.
Validation evidence: docs/02-architecture/agent-loop-abuse-guard.md and docs/08-deployment/production-readiness.md already recorded the production boundary; src/service/bootstrap/production-storage-path.ts inventoried the guard as in-memory before this change.
Dispute rationale: the original finding overstated some details as if all retry/admission controls were unbounded or raw-leaking. The confirmed issue is shared coordination, not raw payload storage.
Research anchors for fix: repository pattern in src/service/auth-abuse-guard.ts and src/service/rate-limit.ts; MITRE ATLAS YAML checked only for taxonomy normalization, not as proof of exploitability.
Smallest safe fix: add Redis-backed shared service guard, require a dedicated hash key for production-like shared buckets, and fail closed when HA or production-shared runtime lacks shared guard storage.
Regression test or probe: npm run test:agent-loop-abuse-guard-shared; npm run test:generic-admission-routes; npm run test:production-storage-path
PR:
Commit:
Verification:
Remaining limitation: this does not move retry-attempt ledger, presentation replay ledger, or shadow stores to shared durable storage.
Owner: engineering
Date opened: 2026-05-12
Date closed:
```

## CC-2 - Review-Required Auto-Promotion

```text
ID: CC-2
Title: Customer-side auto-promotion of review-required decisions
Audit run: F1-threat-model-foundation-validation
Status: accepted limitation
Severity: high
Protected principle: customer authority; fail-closed boundary; no overclaim
Trust surface: customer integration and downstream enforcement
Source: project-owner supplied F1 audit excerpt
Exact file/path: src/consequence-admission/customer-gate.ts; examples/customer-admission-gate.ts; tests/consequence-admission-customer-gate.test.ts
Exact function/route/test/contract: customer gate helper
Affected modules or chain: admission response -> customer code -> downstream execution
Observed behavior: the repository helper is fail-closed, but customer-written integrations can misuse any advisory response if they ignore allowed/failClosed semantics.
Expected behavior: protected downstream execution should use a non-bypassable gateway or secure SDK wrapper, not ad hoc customer-side checks.
Risk: integration-side logic can accidentally treat non-block outcomes as executable.
Validation evidence: repository helper tests cover fail-closed behavior; a direct repository route bypass was not proven.
Dispute rationale: this is not a proven source-code vulnerability in the helper. It is a product/integration hardening limitation.
Research anchors for fix: repository downstream enforcement contract and non-bypassable gateway demo patterns.
Smallest safe fix: backlog a protected adapter/verifier path where only explicitly admitted decisions can reach high-consequence downstream execution.
Regression test or probe: future non-bypassable gateway/customer SDK conformance tests
PR:
Commit:
Verification:
Remaining limitation: customer-operated integrations can still be misimplemented unless they adopt the protected wrapper/gateway.
Owner: engineering
Date opened: 2026-05-12
Date closed:
```

## CC-3 - Cross-Vector Replay Correlation

```text
ID: CC-3
Title: Replay ledgers need cross-vector observability and selected shared durability
Audit run: F1-threat-model-foundation-validation
Status: refined
Severity: medium
Protected principle: replay and idempotency safety; auditability
Trust surface: webhooks, presentation binding, release tokens, DPoP/freshness, shadow/replay ledgers
Source: project-owner supplied F1 audit excerpt
Exact file/path: src/consequence-admission/presentation-replay-ledger.ts; src/service/stripe-webhook-store.ts; src/release-enforcement-plane/freshness.ts
Exact function/route/test/contract: presentation replay ledger; webhook dedupe; release token introspection
Affected modules or chain: multiple replay controls with separate stores and telemetry
Observed behavior: not every replay/idempotency control is in-memory, but some evaluation surfaces still lack shared durable production storage and there is no single cross-vector replay correlation channel.
Expected behavior: production-like replay controls should have shared atomic consume paths and a common replay-event observability shape.
Risk: a chained replay attempt may be investigated late or only inside one vector's ledger.
Validation evidence: production storage path gate already marks presentation replay ledger as in-memory reference; webhook and release-token paths have stronger shared-store options.
Dispute rationale: the finding was too broad when it implied all replay controls are equivalent or local-only.
Research anchors for fix: repository production-storage-path gate and replay/idempotency safety principle.
Smallest safe fix: backlog shared durable presentation replay consume plus common replay-event emission.
Regression test or probe: future presentation replay shared-store test and cross-vector replay telemetry contract
PR:
Commit:
Verification:
Remaining limitation: not fixed in this PR.
Owner: engineering
Date opened: 2026-05-12
Date closed:
```

## CC-4 - Data-Minimization Fan-Out Enforcement

```text
ID: CC-4
Title: Data-minimization policy needs mandatory surface enforcement
Audit run: F1-threat-model-foundation-validation
Status: refined
Severity: medium
Protected principle: data minimization and redaction; auditability
Trust surface: admission feedback, review packets, audit exports, dashboard summaries, model feedback
Source: project-owner supplied F1 audit excerpt
Exact file/path: src/consequence-admission/data-minimization-redaction-policy.ts
Exact function/route/test/contract: evaluateConsequenceDataMinimizationArtifact
Affected modules or chain: generated evidence/review/dashboard surfaces
Observed behavior: a policy evaluator exists and reviewed surfaces did not prove raw prompt/payload leakage, but mandatory invocation is not uniformly machine-checked across every surface constructor.
Expected behavior: every trust-sensitive output surface should prove data minimization by contract or test.
Risk: future surfaces can drift and bypass the policy by omission.
Validation evidence: existing data-minimization tests and reviewed surface tests; no direct leak proven for the audited surfaces.
Dispute rationale: the finding is valid as conformance hardening, not proven as current raw-data exposure across all surfaces.
Research anchors for fix: repository privacy/minimization principle and existing evaluator contract.
Smallest safe fix: backlog an assertDataMinimizedSurface helper and coverage test over declared surface kinds.
Regression test or probe: future data-minimization fan-out conformance test
PR:
Commit:
Verification:
Remaining limitation: not fixed in this PR.
Owner: engineering
Date opened: 2026-05-12
Date closed:
```

## CC-5 - Tenant Boundary Fan-Out

```text
ID: CC-5
Title: Generic admission route must not accept body tenantId over authenticated tenant context
Audit run: F1-threat-model-foundation-validation
Status: confirmed
Severity: medium
Protected principle: tenant isolation; customer authority; fail-closed boundary
Trust surface: POST /api/v1/admissions
Source: project-owner supplied F1 audit excerpt
Exact file/path: src/service/http/routes/generic-admission-routes.ts
Exact function/route/test/contract: admissionPayloadWithTenant
Affected modules or chain: authenticated tenant context -> admission envelope -> shadow admission recording
Observed behavior: a request body `tenantId` string could override the authenticated tenant context in the generated admission envelope.
Expected behavior: authenticated tenant context is authoritative; a mismatched body tenantId must fail closed before shadow recording.
Risk: tenant-confused admission records and downstream audit evidence can be generated under a caller-supplied tenant identifier.
Validation evidence: route inspection and targeted test added in tests/generic-admission-routes.test.ts.
Dispute rationale: the broader F1 claim about every new surface being unprotected was not proven; this route bug is the confirmed concrete slice.
Research anchors for fix: repository tenant isolation principle and existing shadow route tenant-boundary pattern.
Smallest safe fix: throw on body/auth tenant mismatch, return fail-closed 403 problem, and do not call recordShadowAdmission.
Regression test or probe: npm run test:generic-admission-routes
PR:
Commit:
Verification:
Remaining limitation: separate null-tenant/evaluation-store hardening remains backlog for production-like paths.
Owner: engineering
Date opened: 2026-05-12
Date closed:
```

## CC-6 - Cross-Log Integrity

```text
ID: CC-6
Title: Audit and evidence stores need cross-store anchoring for stronger tamper evidence
Audit run: F1-threat-model-foundation-validation
Status: refined
Severity: medium
Protected principle: proof integrity; auditability; release provenance
Trust surface: release decision logs, policy mutation audit logs, consequence tamper-evident history, external review packets, audit exports
Source: project-owner supplied F1 audit excerpt
Exact file/path: src/consequence-admission/tamper-evident-history.ts; src/release-kernel/release-decision-log.ts; src/release-policy-control-plane/audit-log.ts
Exact function/route/test/contract: tamper-evident history; release decision log; policy mutation audit log
Affected modules or chain: multiple self-contained audit/evidence histories
Observed behavior: several stores already use digest chains or shared-store options, but there is no common meta-anchor spanning all relevant histories.
Expected behavior: stronger evidence packets should be able to cross-check source histories against an anchored digest set.
Risk: a self-consistent rewrite of one history may be harder to detect without an external or cross-store anchor.
Validation evidence: existing release/policy audit tests and consequence tamper-evident history tests; production storage path still records some consequence histories as evaluation-grade.
Dispute rationale: the finding overstated the absence of tamper evidence; the refined issue is absence of cross-store anchoring.
Research anchors for fix: repository proof integrity and release provenance principles.
Smallest safe fix: backlog meta-audit-anchor records that include latest digest roots for the relevant histories.
Regression test or probe: future cross-store anchor verification test
PR:
Commit:
Verification:
Remaining limitation: not fixed in this PR.
Owner: engineering
Date opened: 2026-05-12
Date closed:
```

## Current Closure Status

This remediation slice fixes the confirmed CC-5 tenant mismatch issue and the refined CC-1 shared guard runtime path. CC-2, CC-3, CC-4, and CC-6 are not closed by this document. They remain tracked as accepted limitation or backlog hardening items until implemented, tested, merged, and verified.
