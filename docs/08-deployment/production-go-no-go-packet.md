# Production Go/No-Go Packet

The production go/no-go packet is the Step 12 handoff after the production
rehearsal buildout. It does not deploy Attestor, activate a customer PEP, or
claim blanket production readiness. It turns a signed production-promotion
candidate bundle into a final, scope-explicit operator decision.

Use it after a named target has already produced a Step 10 production-promotion
candidate summary:

```bash
npm run render:production-go-no-go-packet -- \
  --promotion-summary=.attestor/rehearsal/gke-production-rehearsal/production-promotion-candidate/summary.json \
  --external-signer-proof-digest=sha256:<target-runtime-signer-proof> \
  --approved-by=<operator-or-approver-id> \
  --approved-at=<iso-timestamp>
```

The command writes:

- `.attestor/production-go-no-go/latest/summary.json`
- `.attestor/production-go-no-go/latest/README.md`

The CLI exits non-zero when the verdict is `no-go`.

## Decision Shape

The packet has one decision vocabulary:

```text
go | no-go
```

The packet can produce `go` only when every required gate passes. A scoped
`not-applicable` gate is allowed only when the selected target scope says that
surface is not part of the promotion. The packet records that non-claim in the
summary instead of silently treating it as proof.

## Required Gates

| Gate id | Required when | What it proves | No-go if missing |
|---|---|---|---|
| `production-promotion-candidate` | Always | The Step 10 promotion candidate is signed, target-bound, environment-ready, and already carries a `go` verdict. | Missing summary, schema mismatch, no-go candidate, blocked environment packet, or missing local attestation. |
| `target-rehearsal-evidence` | Always | The candidate includes repo verify, readiness packet, substrate, consequence, async, backup/restore/DR, observability, and provenance evidence. | Missing required evidence, missing artifact, digest mismatch, or non-passing required evidence. |
| `external-signer-runtime-proof` | Always | The selected target has a runtime external signer/KMS/HSM proof digest. | Repository-side signer adapter contracts without target runtime proof. |
| `shared-store-runtime-boundary` | Always | The candidate is bound to `production-shared`, shared authority, no local fallback, and a passing environment packet. | Runtime profile drift, local fallback, no shared authority, or blocked shared-store readiness. |
| `customer-pep-cutover-proof` | `--target-scope=customer-enforcement` | Customer PEP cutover proof for live enforcement scope. | Customer-enforcement scope without a PEP proof digest. |
| `llm-provider-route-proof` | `--provider-route-mode=required` | Fresh live provider-route proof for any production route that depends on live LLM output. | A provider-dependent route without a provider proof digest. |
| `incident-runbook-and-observability` | Always | The operator runbook has stop conditions and the target has observability/alerting rehearsal evidence. | Missing runbook, missing stop conditions, missing observability step, or missing observability evidence. |
| `human-approval` | Always | A digest-only human approval actor reference and timestamp exist. | Missing approval actor or approval timestamp. |

## Scope Controls

Use `--target-scope=environment-promotion` for a target environment promotion
that does not claim live customer PEP traffic cutover. In this mode the
`customer-pep-cutover-proof` gate is `not-applicable`, and the packet states
that live customer enforcement is not claimed.

Use `--target-scope=customer-enforcement` only when the customer PEP cutover is
in scope. Then provide:

```bash
--customer-pep-proof-digest=sha256:<target-customer-pep-proof>
```

Use `--provider-route-mode=not-used` when no production consequence route
depends on live LLM output. Use `--provider-route-mode=required` only when a
route does depend on a live provider, and provide:

```bash
--provider-route-proof-digest=sha256:<provider-route-smoke-proof>
```

This keeps OpenAI and Anthropic smoke-proof readiness route-specific. A provider
adapter being wired in the repository is not the same thing as production route
dependence or live provider resilience.

## Environment Inputs

The CLI accepts arguments or equivalent environment variables:

| Input | Environment variable |
|---|---|
| `--promotion-summary` | `ATTESTOR_PRODUCTION_PROMOTION_CANDIDATE_SUMMARY_PATH` |
| `--target-scope` | `ATTESTOR_PRODUCTION_GO_NO_GO_TARGET_SCOPE` |
| `--provider-route-mode` | `ATTESTOR_PRODUCTION_GO_NO_GO_PROVIDER_ROUTE_MODE` |
| `--external-signer-proof-digest` | `ATTESTOR_PRODUCTION_GO_NO_GO_EXTERNAL_SIGNER_PROOF_DIGEST` |
| `--customer-pep-proof-digest` | `ATTESTOR_PRODUCTION_GO_NO_GO_CUSTOMER_PEP_PROOF_DIGEST` |
| `--provider-route-proof-digest` | `ATTESTOR_PRODUCTION_GO_NO_GO_PROVIDER_ROUTE_PROOF_DIGEST` |
| `--approved-by` | `ATTESTOR_PRODUCTION_GO_NO_GO_APPROVED_BY` |
| `--approved-at` | `ATTESTOR_PRODUCTION_GO_NO_GO_APPROVED_AT` |
| `--operator-runbook` | none |

The approval actor is stored as a digest-only reference. Do not put raw
customer identifiers, credentials, database URLs, provider bodies, payment
details, wallet material, or private thresholds into the packet.

## Research Anchors

Reviewed on 2026-05-16:

- NIST SSDF frames trustworthy software producer and purchaser communication
  around explicit evidence, mitigation, and common vocabulary:
  [NIST SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final).
- SLSA provenance requires artifact identity, digests, and build/run
  provenance before consumers rely on artifacts:
  [SLSA requirements](https://slsa.dev/spec/v1.0/requirements).
- GitHub artifact attestations should be verified against the expected
  repository and signer workflow:
  [GitHub artifact attestations](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations),
  [gh attestation verify](https://cli.github.com/manual/gh_attestation_verify).
- Kubernetes production guidance treats availability, certificates, load
  balancing, backups, access management, and resilience as production concerns
  that must be proven for the target:
  [Kubernetes production environment](https://kubernetes.io/docs/setup/production-environment/).
- PostgreSQL high availability has topology and synchronization tradeoffs, so
  the selected target database posture must be proven instead of inferred from
  repo tests:
  [PostgreSQL high availability](https://www.postgresql.org/docs/current/high-availability.html).
- BullMQ production guidance requires Redis production posture, including
  eviction policy and retry discipline:
  [BullMQ going to production](https://docs.bullmq.io/guide/going-to-production).
- GitHub Environment protection rules can require reviewer approval before
  target-scoped workflow execution:
  [GitHub deployment environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments).

These sources anchor the go/no-go discipline. They do not prove Attestor
production readiness, cloud-provider certification, compliance certification,
or customer deployment.

## Non-Claims

This packet does not claim:

- readiness for any environment other than the named target
- live customer PEP traffic cutover unless `customer-enforcement` scope passes
- live LLM provider route readiness unless provider-route mode is `required`
  and the provider proof digest gate passes
- external compliance certification
- independent security approval
- market validation
- a blanket production guarantee
