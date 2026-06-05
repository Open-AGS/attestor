# Data Movement Consequence Engine Proof

Status: M04 repository-side proof contract. This document defines the
repository-side and external-provider path for proving the Data Movement
consequence engine without claiming SaaS production readiness.

## Purpose

This proof track exists to show the Attestor consequence engine running as one
connected path for a controlled data export:

```text
POST /api/v1/admissions
-> protected release token
-> online introspection and replay consumption
-> release-enforcement PEP decision
-> sandbox export gate
-> proof packet
```

The goal is not a scripted feature demo. The goal is an expert-readable proof
that an Attestor admission decision can become a downstream gate input, that the
gate controls whether the action can proceed, that negative cases fail closed,
and that the final evidence packet explains what happened without storing raw
tokens, prompts, payloads, or customer data.

## Readiness Split

| Level | Target | Meaning | Non-claim |
| --- | --- | --- | --- |
| M02-M04 | repository-side engine proof | The real route, token issuer, introspection store, PEP, sandbox export gate, and proof packet are wired and tested locally. | Not production, not customer PEP no-bypass proof. |
| M05 | credible external engine run | The same engine path runs against a controlled external data provider surface where paid services may be used only when they serve decision-adjacent evidence. | Not full SaaS launch. |
| M06 | production-shaped rehearsal | The same path is rehearsed with production-shaped deployment, observability, secrets, and operator controls. | Still not enterprise readiness unless separately proven. |

## Repository Anchors

- `src/service/http/routes/generic-admission-routes.ts` hosts the real
  `POST /api/v1/admissions` route.
- `src/consequence-admission/generic-protected-release-token.ts` issues
  sender-constrained protected release tokens and registers introspection state.
- `src/release-enforcement-plane/online-verifier.ts` verifies
  sender-constrained release authorization with online introspection and
  token-use consumption.
- `src/consequence-admission/customer-gate.ts` consumes a proven
  release-enforcement result before allowing a downstream gate to proceed.
- `src/consequence-admission/controlled-data-export-gate.ts` evaluates a
  digest-bound export intent against the release-enforcement customer gate,
  downstream contract, tenant/action/target binding, and approved data scope.
- `src/release-kernel/release-introspection.ts` provides active-token
  introspection and token-use consumption.
- `docs/02-architecture/protected-admission-e2e-proof-plan.md` remains the
  broader proof-plan source for customer PEP and live-proof blockers.
- `tests/data-movement-full-consequence-engine-proof-m02a.test.ts` locks the
  route-to-PEP decision proof.
- `tests/data-movement-full-consequence-engine-proof-m02b.test.ts` locks the
  PEP-to-export-gate and proof-packet proof.

## M02 Scope

M02 is intentionally split so each PR is auditable.

### M02A - Admission To PEP Decision Proof

Prove the connected path:

```text
real admission route
-> route-resolved DPoP confirmation
-> protected release token issuance
-> introspection registration
-> release-enforcement verification
-> online introspection
-> token-use consumption
-> customer gate proceed/hold decision
```

This is a repository-side proof. It uses the real route and real release
enforcement code, but it does not claim a live customer enforcement boundary.

M02A binds the protected release token to the admission consequence and proves
that a PEP-side verifier/customer gate can consume that token safely. It does
not claim that the final export intent body is already bound to the token. That
exact export-intent binding is the M02B sandbox export gate scope.

### M02B - PEP To Export Gate And Proof Packet

Prove the downstream sandbox gate:

```text
PEP decision
-> export intent gate
-> execute, narrow, hold for review, or block
-> proof packet
```

The sandbox gate must be small but real. It must check the Attestor decision,
token/proof reference, tenant, scope, and action intent before emitting any
export result.

M02B binds the final export intent to the admission by requiring the digest of
the export intent to appear in `admission.request.nativeInputRefs`. The proof
packet records scope digests, field digests, release-enforcement metadata,
downstream-contract outcome, receipt metadata, and no-claim flags. It does not
store raw release tokens, sender proofs, field names, recipient refs, raw
payloads, provider bodies, or rows.

The M02B gate can emit:

```text
executed
narrowed
held-for-review
blocked
```

`narrowed` means only the approved record cap and approved field subset are
reflected in the executed scope digest. It does not mean the gate can widen a
scope, grant authority, or skip constraints.

## M02B Source Anchors

Reviewed on 2026-06-05:

- OAuth DPoP RFC 9449 anchors sender-constrained proof and proof replay
  handling: [RFC 9449](https://www.rfc-editor.org/rfc/rfc9449.html).
- OAuth Token Introspection RFC 7662 anchors online active-token liveness:
  [RFC 7662](https://www.rfc-editor.org/rfc/rfc7662.html).
- OWASP Logging Cheat Sheet anchors the redaction/no-sensitive-material posture
  for proof output: [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html).
- NIST Privacy Framework anchors privacy-risk and data-minimization vocabulary:
  [NIST Privacy Framework](https://www.nist.gov/privacy-framework).

These are engineering anchors only. They do not prove standards conformance,
OAuth certification, privacy compliance, live provider deployment, or
production readiness.

## Engine Proof Invariants

The M02-M04 tests should name and lock these invariants:

1. Observe or warn decision cannot execute a protected export.
2. Review or block decision cannot execute a protected export.
3. Missing proof cannot execute a protected export.
4. Wrong tenant cannot execute a protected export.
5. Wrong audience or wrong scope cannot execute a protected export.
6. Replayed authorization cannot execute twice.
7. Stale or revoked token cannot execute.
8. Narrow can execute only the narrowed export scope.
9. Admit can execute only when token, proof, tenant, scope, and gate checks pass.
10. Raw tokens, prompts, provider bodies, and customer payloads cannot enter
    public proof output.

## M03A - Proof Run Contract

M03A keeps the repository-side proof easy to rerun and review. It does not add
a new runtime path. It composes the M02A and M02B engine proof tests into one
local proof command:

```bash
npm run proof:data-movement-full-consequence-engine
```

### Claim To Evidence Matrix

| Claim | Repository evidence | Proof command | Non-claim |
| --- | --- | --- | --- |
| The proof uses the real generic admission route. | `src/service/http/routes/generic-admission-routes.ts`; `tests/data-movement-full-consequence-engine-proof-m02a.test.ts`; `tests/data-movement-full-consequence-engine-proof-m02b.test.ts` | `npm run test:data-movement-full-consequence-engine-proof-m02a`; `npm run test:data-movement-full-consequence-engine-proof-m02b` | Not a live hosted SaaS route proof. |
| The admission can issue a sender-constrained protected release token and register online introspection state. | `src/consequence-admission/generic-protected-release-token.ts`; `src/release-kernel/release-introspection.ts`; `tests/data-movement-full-consequence-engine-proof-m02a.test.ts` | `npm run test:data-movement-full-consequence-engine-proof-m02a` | Not external KMS/HSM signing readiness. |
| A release-enforcement PEP can consume the route-issued token and produce a customer-gate decision. | `src/release-enforcement-plane/online-verifier.ts`; `src/consequence-admission/customer-gate.ts`; `tests/data-movement-full-consequence-engine-proof-m02a.test.ts` | `npm run test:data-movement-full-consequence-engine-proof-m02a` | Not live customer PEP no-bypass proof. |
| The sandbox export gate consumes the PEP decision and controls execute, narrow, hold, or block outcomes. | `src/consequence-admission/controlled-data-export-gate.ts`; `tests/data-movement-full-consequence-engine-proof-m02b.test.ts` | `npm run test:data-movement-full-consequence-engine-proof-m02b` | Not a live Snowflake, Databricks, BigQuery, GCS, or warehouse integration. |
| The proof packet explains the outcome without raw sensitive material or production claims. | `src/consequence-admission/controlled-data-export-gate.ts`; `tests/data-movement-full-consequence-engine-proof-m02b.test.ts`; `scripts/check/check-public-artifacts-redaction.mjs` | `npm run test:data-movement-full-consequence-engine-proof-m02b`; `npm run check:public-artifacts-redaction` when publishing generated proof artifacts | Not a full disclosure review for arbitrary local, live, binary, or operator artifacts. |

## M03B - Fail-Closed Matrix

M03B keeps the repository-side proof readable in failure cases. It does not add
a new runtime path. It records which existing proof tests show that the export
does not proceed when proof, tenant, scope, token, or decision authority is
invalid.

| Condition | Expected proof-run behavior | Repository evidence | Non-claim |
| --- | --- | --- | --- |
| Missing sender proof or missing export-intent proof | Route or export gate fails closed; no protected export is executed. | `tests/data-movement-full-consequence-engine-proof-m02a.test.ts`; `tests/data-movement-full-consequence-engine-proof-m02b.test.ts` | Not a live outage or customer deployment proof. |
| Wrong tenant, target, audience, or scope | Release-enforcement or export gate rejects the request; no downstream receipt is emitted for a blocked export. | `tests/data-movement-full-consequence-engine-proof-m02a.test.ts`; `tests/data-movement-full-consequence-engine-proof-m02b.test.ts` | Not live shared-store/RLS tenant isolation proof. |
| Replayed proof or reused consumed token | Replay is rejected and cannot execute a second protected export. | `tests/data-movement-full-consequence-engine-proof-m02a.test.ts`; `tests/data-movement-full-consequence-engine-proof-m02b.test.ts`; `src/release-kernel/release-introspection.ts` | Not multi-instance Redis/Postgres replay-store proof. |
| Observe, warn, review, or block decision | Customer gate or export gate holds or blocks; exported record count remains zero. | `tests/data-movement-full-consequence-engine-proof-m02b.test.ts`; `src/consequence-admission/customer-gate.ts`; `src/consequence-admission/controlled-data-export-gate.ts` | Not live customer PEP no-bypass proof. |
| Narrow decision | Export can proceed only within the narrowed record cap and approved field subset. | `tests/data-movement-full-consequence-engine-proof-m02b.test.ts`; `src/consequence-admission/controlled-data-export-gate.ts` | Not authority to widen scope or skip constraints. |
| Proof output is inspected | Proof packet and receipt metadata exclude raw release tokens, sender proofs, raw payloads, provider bodies, rows, and raw field names. | `tests/data-movement-full-consequence-engine-proof-m02b.test.ts`; `scripts/check/check-public-artifacts-redaction.mjs` | Not a full review of arbitrary local, live, binary, or operator artifacts. |

## M04 - Public Artifact Readiness

M04 keeps the repository-side proof safe to package for public review. It does
not create a live external run and does not publish artifacts by itself. It
binds the proof command to the existing public-artifact redaction scanner for
the generated proof and showcase roots:

```bash
npm run proof:data-movement-public-artifact-readiness
```

| Artifact surface | Required root | Readiness gate | Non-claim |
| --- | --- | --- | --- |
| Proof-surface packet | `.attestor/proof-surface/latest` | `npm run check:public-artifacts-redaction -- --root .attestor/proof-surface/latest` | Does not prove the packet was generated in this run. |
| Showcase packet | `.attestor/showcase/latest` | `npm run check:public-artifacts-redaction -- --root .attestor/showcase/latest` | Does not prove the packet is suitable for every publication channel. |
| Combined public-readiness check | `.attestor/proof-surface/latest`; `.attestor/showcase/latest` | `npm run proof:data-movement-public-artifact-readiness` | Does not scan arbitrary local, live, binary, or operator artifacts. |

Generated public proof artifacts for this track must stay digest-first and must
not include raw release tokens, sender proofs, prompts, payloads, provider
bodies, rows, customer identifiers, tenant secrets, or raw field names.

## Paid Service Timing

Paid services are only required when they strengthen decision-adjacent proof for
M05 or M06. They are not required for M02-M04 repository-side engine integrity.

Decision-adjacent paid services for M05 may include:

- a controlled external data provider or warehouse surface;
- a managed secrets or signing surface if needed to show non-local authority;
- external audit storage if the proof requires provider-side persistence.

Production infrastructure services such as WAF, Cloud Armor, GKE hardening,
NetworkPolicy, production observability, budget alerting, live shared
Postgres/Redis, and operator diagnostics are M06 or production-readiness
concerns unless a specific service directly participates in the engine proof
being shown.

## Non-Claims

This proof track does not claim:

- production readiness;
- enterprise readiness;
- compliance certification;
- live customer PEP no-bypass enforcement;
- live Snowflake, Databricks, BigQuery, GCS, or similar provider readiness;
- external KMS/HSM readiness;
- live shared Postgres/Redis deployment readiness;
- live WAF, IAM, TLS, or observability maturity.

Those remain separate live-proof, deployment/operator-proof, and production
readiness gates.
