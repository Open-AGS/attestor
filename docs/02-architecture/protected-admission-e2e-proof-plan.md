# Protected Admission End-To-End Proof Plan

Status: repository-side route contract for Attestor unlock step 05. This is
not a live customer PEP deployment, not runtime production readiness, and not a
claim that every protected route is non-bypassable in a customer environment.

## Decision

The next protected consequence proof must be a full route chain, not a signed
bearer helper:

```text
admission -> DPoP-bound release token -> introspection -> token-use replay -> customer PEP -> downstream receipt
```

`src/consequence-admission/protected-admission-e2e-proof-plan.ts` now defines a
machine-readable proof-plan evaluator for that chain. The evaluator is pure: it
does not activate runtime issuance, deploy a PEP, call a provider, or execute a
downstream action. It records which proof stages are present, which blockers
remain, and whether the first narrow fixture is ready for the next PR.

## Required Stages

| Order | Stage | Evidence required |
|---|---|---|
| 1 | admission decision | Allowed high-risk admission, admission digest, R3 reviewer or R4 reviewer plus distinct signer |
| 2 | sender-confirmed token request | Valid DPoP proof, `cnf.jkt` binding, DPoP proof `jti` replay consumption |
| 3 | protected release-token issuance | Sender-constrained release token, admission proof-ref token digest, issuer boundary evidence |
| 4 | online introspection | Token registered with the introspection authority, active online introspection, shared store for `production-shared` |
| 5 | token-use replay consumption | Release-token use consumed, separated from DPoP proof replay, shared store for `production-shared` |
| 6 | customer PEP enforcement | Route coverage, fail-closed PEP, no bypass routes, verifier integration, customer approval |
| 7 | downstream receipt | Receipt digest bound to admission, release decision, and token-use consumption |

The signed bearer helper is not sufficient for this step. The signed bearer
compatibility helper cannot prove sender-constrained presentation, online
liveness, token-use replay consumption, customer PEP coverage, or downstream
receipt binding.

## Production-Shared Boundary

For `production-shared`, the evaluator additionally requires:

- external KMS/HSM issuer boundary proof
- shared DPoP proof replay store
- shared token introspection store
- shared token-use replay store

Local or file-backed stores can satisfy a narrow repository fixture, but they
do not clear `production-shared`. The evaluator still reports
`productionReady: false` even when all route-contract stages are present,
because real deployment probes, customer PEP rollout, monitoring, incident
response, backup/restore, and customer approval evidence remain separate.

## Fail-Closed Blockers

The plan emits machine-readable blockers including:

- `signed-bearer-helper-insufficient`
- `dpop-proof-replay-not-consumed`
- `protected-release-token-not-sender-constrained`
- `online-introspection-not-active`
- `token-use-replay-not-consumed`
- `pep-route-coverage-incomplete`
- `pep-fail-closed-not-configured`
- `pep-bypass-routes-present`
- `downstream-receipt-not-bound-to-token-use`
- `raw-release-token-storage-risk`

Raw DPoP proofs, raw release tokens, and raw downstream payloads remain
forbidden in proof artifacts.

## Next PR

If the route contract evaluates cleanly, the next unlock is step 06: customer
PEP adoption package. That PR should use this plan as the acceptance contract
for a scoped runtime, then prove route coverage, no bypasses, health, rollback,
kill switch, monitoring, audit, customer approval, and downstream receipt
evidence.

## Primary Source Anchors

Reviewed on 2026-05-16:

- OAuth DPoP RFC 9449 anchors proof validation, public-key confirmation, and
  proof replay protection: [RFC 9449](https://www.rfc-editor.org/rfc/rfc9449.html).
- OAuth Token Introspection RFC 7662 anchors online active-token liveness:
  [RFC 7662](https://www.rfc-editor.org/rfc/rfc7662.html).
- OAuth Token Exchange RFC 8693 anchors admission-to-release-token delegation
  patterns: [RFC 8693](https://www.rfc-editor.org/rfc/rfc8693.html).
- JWT BCP RFC 8725 anchors explicit token validation and downgrade avoidance:
  [RFC 8725](https://www.rfc-editor.org/rfc/rfc8725.html).
- Envoy external authorization and Istio custom authorization anchor PEP
  placement at the enforcement edge:
  [Envoy ext_authz](https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_filters/ext_authz_filter.html),
  [Istio custom authorization](https://istio.io/latest/docs/tasks/security/authorization/authz-custom/).

These sources are engineering anchors only. They do not prove OAuth
certification, customer deployment, or production readiness.

## Non-Claims

This proof plan does not claim:

- live customer PEP deployment
- production readiness
- universal route non-bypassability
- runtime external-KMS release-token issuance
- OAuth certification
- live authorization-server operation
- complete downstream receipt reconciliation

It only defines the smallest route contract needed before the customer PEP
adoption package can be reviewed coherently.
