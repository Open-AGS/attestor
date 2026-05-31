# Customer PEP Adoption Package

Status: repository-side adoption package for Attestor unlock step 06. This is
not a live customer PEP deployment, not production readiness, and not a claim
that every customer route is non-bypassable.

## Decision

Step 05 defined the protected admission route:

```text
admission -> DPoP-bound release token -> introspection -> token-use replay -> customer PEP -> downstream receipt
```

Step 06 packages the customer-side adoption evidence for one named runtime.
`src/consequence-admission/customer-pep-adoption-package.ts` combines:

- `CustomerPepRuntimeAdoptionProof`
- `ProtectedAdmissionE2eProofPlanEvaluation`
- digest-only evidence refs for route coverage, fail-closed configuration,
  no-bypass review, verifier integration, sender constraint, online
  introspection, token-use replay, health, rollback, kill switch, monitoring,
  audit, customer approval, activation handoff, activation receipt, and
  downstream receipt

The package is pure. It does not deploy Envoy, Istio, OPA, middleware, stores,
or customer infrastructure. It only decides whether a scoped repository-side
customer PEP adoption claim can be reviewed.

## Claim Boundary

The package can allow only this claim:

```text
scoped-runtime-adoption
```

It always rejects:

- `live-customer-enforcement`
- `production-readiness`

Even a ready package reports:

- `productionReady: false`
- `activatesRuntime: false`
- `deploysInfrastructure: false`
- `liveCustomerEnforcementClaimAllowed: false`

This keeps repo-side customer adoption evidence separate from target-specific
deployment, real probes, traffic cutover, rollback rehearsal, incident
response, backup/restore, and customer-operated monitoring.

## Required Evidence

The package is held unless all required evidence kinds are present:

| Evidence kind | Purpose |
|---|---|
| `customer-pep-runtime-adoption-proof` | Proves the scoped runtime evaluator passed |
| `protected-admission-e2e-proof-plan` | Proves the route contract evaluated cleanly |
| `route-coverage-manifest` | Shows every protected route is covered |
| `fail-closed-config` | Shows missing or invalid authorization blocks execution |
| `no-bypass-review` | Shows bypass routes were reviewed and absent |
| `verifier-integration` | Shows the release-enforcement verifier is wired |
| `sender-constraint-policy` | Shows bearer-only operation is not accepted |
| `online-introspection-policy` | Shows active-token liveness is required |
| `token-use-replay-policy` | Shows release-token use is consumed once |
| `health-probe` | Shows the scoped PEP path has a verified health signal |
| `rollback-plan` | Shows safe rollback is defined |
| `kill-switch` | Shows enforcement can be stopped safely if needed |
| `monitoring-slo` | Shows monitoring and degradation signals exist |
| `audit-receipt` | Shows adoption evidence is auditable |
| `customer-approval` | Shows customer authority for the scoped runtime |
| `activation-handoff` | Shows activation handoff evidence was produced |
| `activation-receipt` | Shows activation receipt evidence was produced |
| `downstream-receipt` | Shows downstream execution receipt evidence exists |

All refs are digest-based. Raw release tokens, raw DPoP or sender proofs, raw
downstream payloads, and raw provider bodies are package blockers.

## Fail-Closed Blockers

The evaluator emits machine-readable blockers including:

- `runtime-adoption-not-ready`
- `protected-e2e-proof-plan-not-satisfied`
- `e2e-customer-pep-stage-blocked`
- `e2e-downstream-receipt-stage-blocked`
- `runtime-profile-id-mismatch`
- `live-enforcement-claim-requested`
- `production-readiness-claim-requested`
- `customer-approval-evidence-missing`
- `downstream-receipt-evidence-missing`
- `raw-sender-proof-storage-enabled`

These blockers prevent drift from "we have a helper" to "the customer runtime
is enforced." A customer PEP adoption package is ready only when the scoped
runtime proof and the protected route proof agree on runtime id, route id,
tenant, and environment.

## Primary Source Anchors

Reviewed on 2026-05-16:

- Envoy external authorization anchors the enforcement-edge PEP pattern:
  [Envoy ext_authz](https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_filters/ext_authz_filter.html).
- Istio custom authorization anchors mesh-level delegation to an external
  authorizer:
  [Istio custom authorization](https://istio.io/latest/docs/tasks/security/authorization/authz-custom/).
- OPA Envoy anchors policy-agent integration with Envoy external authorization:
  [OPA Envoy](https://www.openpolicyagent.org/docs/latest/envoy-introduction/).
- OAuth DPoP anchors sender-constrained proof validation and replay handling:
  [RFC 9449](https://www.rfc-editor.org/rfc/rfc9449.html).
- OAuth Token Introspection anchors online active-token liveness:
  [RFC 7662](https://www.rfc-editor.org/rfc/rfc7662.html).

These are engineering anchors only. They do not prove OAuth certification,
customer deployment, compliance certification, or production readiness.

## Non-Claims

Boundary: repository-side or evaluation evidence only: not production readiness,
customer deployment proof, customer no-bypass proof, native connector or live
integration coverage, compliance certification, or automatic policy activation.
Domain-specific authority still needs separate live proof.

It is the smallest machine-readable adoption package that can close step 06
without overclaiming runtime deployment.
