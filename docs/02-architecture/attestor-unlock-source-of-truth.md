# Attestor Unlock Source Of Truth

Status: repository-side decision tracker for the next Attestor engineering
unlock sequence. This is not a production readiness claim and not a replacement
for the existing buildout trackers.

## Purpose

This tracker keeps the next unlock sequence small, explicit, and reviewable.
It exists because the repo now has many completed platform surfaces, but the
highest-value remaining work is not "more features" by default. The next work
should close the trust chain from proposed consequence to downstream
enforcement:

```text
proposed consequence
  -> Attestor admission decision
  -> protected release authorization
  -> sender-constrained presentation
  -> online introspection and replay consumption
  -> customer PEP or gateway
  -> downstream receipt
```

The target form remains one Attestor platform core with modular consequence
packs. Finance and crypto are packs, not separate products. Attestor should not
be widened into a wallet, custody platform, file workspace, or general
orchestration layer.

The extended post-step-06 master list now lives in
[Unified Shadow-To-Policy Master Plan](unified-shadow-to-policy-master-plan.md).
That document preserves steps 07-12 from this tracker and adds the unified
Shadow-to-Policy engine and domain-adapter sequence. It is the planning source
for future work after this tracker's immediate sequence, but it does not change
the no-overclaim boundary here.

## Current Repository Truth

| Area | Current truth | What remains blocked |
|---|---|---|
| Product shape | One AI Action Control Plane with a shared consequence-admission core and modular packs. | Do not widen into a generic AI gateway, dashboard-only governance tool, wallet, custody layer, or orchestration workspace. |
| Release and policy authority | Shared PostgreSQL release/policy authority is implemented and tested under embedded multi-instance recovery. | External customer-operated production still needs real environment inputs, probes, and rehearsal. |
| Enforcement plane | `attestor/release-enforcement-plane` exposes Node, Hono, webhook, record-write, communication-send, action-dispatch, Envoy, and Istio enforcement surfaces; the customer PEP adoption package now combines scoped runtime proof, protected E2E proof, route coverage, no-bypass review, operations controls, customer approval, and downstream receipt evidence. | A real customer runtime still has to deploy the PEP, operate it, prove target-specific probes, and rehearse rollback outside the repository. |
| Hosted generic admission | Protected high-risk generic admissions now require sender-confirmed release authorization; DPoP proof replay has local and shared PostgreSQL store paths; the protected admission E2E proof plan defines the route chain from admission to downstream receipt; scoped customer PEP adoption can be packaged for review. | `production-shared` still needs live deployment evidence, target-specific PEP operation, and a runtime proving no bypasses under real traffic. |
| Tenant signer boundary | The contract defines tenant-scoped external KMS/HSM proof requirements, fake-adapter conformance, and the first Google Cloud KMS Ed25519 sign/verify proof adapter. | Runtime release-token issuance is still not wired to external KMS/HSM signing; live Google Cloud credentials, IAM, workload identity, deployment probes, rotation, and compromise response remain unproven. |
| Consequence storage | The production storage path names the shared-store primitives and blocks `production-shared` when consequence stores remain evaluation-backed. Step 08 adds PostgreSQL-backed atomic retry/replay stores with tenant-scope, schema, and idempotency proof digests. Step 09 adds PostgreSQL-backed shared source-history and outbox primitives with append-only sequence, tenant-scope, schema, outbox, worker-claim, and advisory-lock proof digests. | Runtime cutover, shadow producer migration, read-model workers, downstream receipt reconciliation, tamper-evident external immutability, crypto domain projections, hosted wizard shared session state, agent-loop proof, deployment probes, and backup/restore rehearsal still need shared operational implementations. |
| LLM provider registry | OpenAI and Anthropic runtime wrappers are wired repository-side; provider inventory and route-readiness evidence gates exist for OpenAI, Anthropic, Vertex AI, and Azure OpenAI. Step 10 selects Anthropic Claude Messages API as the first non-OpenAI runtime adapter target, and Step 11 implements the narrow Anthropic Messages API runtime slice with digest-only evidence and external-live smoke proof. | No live provider failover, no hosted production LLM runtime readiness, no Vertex AI or Azure OpenAI runtime, no OpenAI vision smoke proof, and no hosted consequence route depends on a live LLM provider. |
| Production rehearsal | Repo-side readiness packets, HA probes, production rehearsal planning, signed production-promotion candidate packaging, and the Step 12 production go/no-go packet exist. | A real target environment must still run the packet with target signer proof, scoped PEP proof when in scope, provider-route proof when in scope, human approval, and real evidence before any production promotion decision. |

## Primary Source Anchors

Reviewed on 2026-05-16 for this planning pass:

- OAuth sender constraint and token liveness: [DPoP RFC 9449](https://www.rfc-editor.org/rfc/rfc9449.html), [mTLS-bound tokens RFC 8705](https://www.rfc-editor.org/rfc/rfc8705), [Token Introspection RFC 7662](https://www.rfc-editor.org/rfc/rfc7662), [Token Exchange RFC 8693](https://www.rfc-editor.org/rfc/rfc8693), [RAR RFC 9396](https://www.rfc-editor.org/rfc/rfc9396), and [JWT BCP RFC 8725](https://www.rfc-editor.org/rfc/rfc8725).
- Enforcement placement: [Envoy ext_authz](https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_filters/ext_authz_filter.html), [OPA Envoy](https://www.openpolicyagent.org/docs/latest/envoy-introduction/), [Istio custom authorization](https://istio.io/latest/docs/tasks/security/authorization/authz-custom/), and [SPIFFE/SPIRE](https://spiffe.io/docs/latest/spire-about/).
- Key custody and signer boundaries: [AWS KMS Sign](https://docs.aws.amazon.com/kms/latest/APIReference/API_Sign.html), [Google Cloud KMS algorithms](https://cloud.google.com/kms/docs/algorithms), [Google Cloud KMS asymmetricSign](https://cloud.google.com/kms/docs/reference/rest/v1/projects.locations.keyRings.cryptoKeys.cryptoKeyVersions/asymmetricSign), [Google Cloud KMS protection levels](https://cloud.google.com/kms/docs/protection-levels), [Azure Key Vault Sign](https://learn.microsoft.com/en-us/rest/api/keyvault/keys/sign/sign), and [Azure Managed HSM](https://learn.microsoft.com/en-us/azure/key-vault/managed-hsm/overview).
- Shared store primitives: [PostgreSQL INSERT / ON CONFLICT](https://www.postgresql.org/docs/current/sql-insert.html), [PostgreSQL row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html), [PostgreSQL advisory locks](https://www.postgresql.org/docs/current/explicit-locking.html), [PostgreSQL SELECT locking clauses](https://www.postgresql.org/docs/current/sql-select.html), and [Debezium Outbox Event Router](https://debezium.io/documentation/reference/stable/transformations/outbox-event-router.html).
- Provider routing and structured output: [OpenAI Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs), [OpenAI rate limits](https://platform.openai.com/docs/guides/rate-limits), [Anthropic tool use](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/overview), [Anthropic rate limits](https://docs.anthropic.com/en/api/rate-limits), [Vertex AI structured output](https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/control-generated-output), [Azure OpenAI structured outputs](https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/structured-outputs), and [Azure OpenAI quotas](https://learn.microsoft.com/en-us/azure/ai-foundry/openai/quotas-limits).
- AI risk framing: [NIST AI RMF](https://www.nist.gov/itl/ai-risk-management-framework) and [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/).
- Production go/no-go discipline: [NIST SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final), [SLSA requirements](https://slsa.dev/spec/v1.0/requirements), [GitHub artifact attestations](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations), [Kubernetes production environment](https://kubernetes.io/docs/setup/production-environment/), [PostgreSQL high availability](https://www.postgresql.org/docs/current/high-availability.html), [BullMQ going to production](https://docs.bullmq.io/guide/going-to-production), and [GitHub deployment environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments).

These sources anchor engineering choices only. They do not prove OAuth
certification, cloud-provider certification, compliance certification, or
production readiness.

## Progress Summary

| Metric | Value |
|---|---|
| Total unlock rounds | 12 |
| Complete in this tracker | 12 |
| Remaining after this tracker | 0 |
| Current posture | Step 01 established the source-of-truth tracker and no-overclaim decision map. Step 02 selects Google Cloud KMS as the first external signer adapter target. Step 03 closes the external signer proof envelope and diagnostics contract. Step 04 adds the first Google Cloud KMS Ed25519 adapter/probe contract while keeping runtime bootstrap fail-closed. Step 05 defines the protected admission E2E route contract and narrow fixture evaluator. Step 06 packages scoped customer PEP adoption evidence without claiming live deployment. Step 07 records the consequence shared-store inventory. Step 08 adds PostgreSQL-backed atomic retry/replay stores with digest-only operational evidence while keeping runtime cutover unclaimed. Step 09 adds PostgreSQL-backed shared source-history and outbox primitives with digest-only operational evidence while keeping runtime migration, workers, Debezium/event-bus delivery, and production readiness unclaimed. Step 10 selects Anthropic Claude Messages API as the first non-OpenAI runtime adapter target. Step 11 wires the narrow Anthropic Messages API runtime slice with digest-only evidence, strict tool-schema tests, bounded runtime policy, and an opt-in external-live smoke probe while keeping live failover and production readiness unclaimed. Step 12 adds the production go/no-go packet that consumes a signed production-promotion candidate plus target signer proof, scoped PEP/provider-route proof when in scope, runbook/observability evidence, and digest-only human approval; it still does not claim production readiness until a real target runs and passes it. |

## Unlock Sequence

| Step | Status | Unlock | Required contract/test/doc evidence | No-go boundary |
|---|---|---|---|---|
| 01 | complete | Source-of-truth tracker | `docs/02-architecture/attestor-unlock-source-of-truth.md`, `tests/attestor-unlock-source-of-truth.test.ts`, README/system-overview links, research ledger entry, package script. | This does not implement any production control by itself. |
| 02 | complete | External KMS/HSM provider decision | `docs/02-architecture/external-kms-hsm-provider-decision.md`, `tests/external-kms-hsm-provider-decision.test.ts`, cryptography policy link, research ledger entry, package script. First adapter target: Google Cloud KMS with `EC_SIGN_ED25519` and raw signing input. | Do not pick a provider that cannot prove algorithm and input-mode semantics. |
| 03 | complete | External signer contract closure | `src/service/bootstrap/release-tenant-signer-boundary.ts`, `docs/02-architecture/external-signer-contract-closure.md`, `tests/production-tenant-signer-boundary.test.ts`, `tests/external-signer-contract-closure.test.ts`, cryptography policy link, research ledger entry, package script. | Do not let a boolean or local PEM path satisfy external custody. |
| 04 | complete | First KMS/HSM adapter PR | `src/service/bootstrap/gcp-kms-release-signer.ts`, `docs/02-architecture/gcp-kms-release-signer-adapter.md`, `tests/gcp-kms-release-signer-adapter.test.ts`, deployment docs, cryptography policy link, research ledger entry, package script. First adapter: Google Cloud KMS `EC_SIGN_ED25519` over raw challenge data with CRC32C checks, local verification, digest-only proof output, and fail-closed bootstrap. | Do not claim multi-cloud, customer custody, live GCP deployment, runtime external-KMS issuance, or customer production readiness from one adapter/probe. |
| 05 | complete | Protected admission end-to-end proof plan | `src/consequence-admission/protected-admission-e2e-proof-plan.ts`, `docs/02-architecture/protected-admission-e2e-proof-plan.md`, `tests/protected-admission-e2e-proof-plan.test.ts`, research ledger entry, tracker update, and package script. Route contract: admission -> DPoP-bound release token -> introspection -> token-use replay -> customer PEP -> downstream receipt. | Do not treat a signed bearer helper as sufficient for R3/R4 enforcement. |
| 06 | complete | Customer PEP adoption package | `src/consequence-admission/customer-pep-adoption-package.ts`, `docs/02-architecture/customer-pep-adoption-package.md`, `tests/customer-pep-adoption-package.test.ts`, research ledger entry, tracker update, and package script. The package combines runtime adoption proof, protected E2E proof, route coverage, no-bypass review, fail-closed config, verifier integration, health, rollback, kill switch, monitoring, audit, customer approval, activation evidence, and downstream receipt. | Do not claim live customer enforcement, production readiness, or universal non-bypassability from repo-side adoption packaging. |
| 07 | complete | Consequence shared-store inventory | `src/service/bootstrap/consequence-shared-store-inventory.ts`, `docs/02-architecture/consequence-shared-store-inventory.md`, `tests/consequence-shared-store-inventory.test.ts`, research ledger entry, tracker update, and package script. Inventory covers shadow events, simulations, candidates, activation receipts, wizard state, retry, presentation replay, agent-loop guard, audit/dashboard sources, dashboard summary, downstream receipts, tamper-evident history, and crypto execution-admission telemetry as one-engine domain projection. | Do not clear `production-shared` while consequence state is evaluation-backed. |
| 08 | complete | Consequence shared-store PR slice 1 | `src/service/consequence-shared-atomic-stores.ts`, `tests/consequence-shared-atomic-stores.test.ts`, `docs/02-architecture/consequence-shared-atomic-stores.md`, retry/replay descriptor/doc updates, research ledger entry, tracker update, and package script. Atomic retry/replay stores use tenant-scope digest, PostgreSQL `ON CONFLICT`, unique idempotency/replay indexes, raw-idempotency-key-free and raw-replay-key-free storage, and digest-only diagnostics. Runtime cutover remains unclaimed. | Do not use a shared database as proof without constraints and tenant boundary evidence. |
| 09 | complete | Consequence shared-store PR slice 2 | `src/service/consequence-shared-history-outbox-store.ts`, `tests/consequence-shared-history-outbox-store.test.ts`, `docs/02-architecture/consequence-shared-history-outbox-store.md`, inventory/tracker/master-plan updates, research ledger entry, and package script. Append-only source history and outbox rows use tenant-scope digest, digest-only source/payload refs, per-tenant sequence allocation under advisory lock, RLS policy shape, `FOR UPDATE SKIP LOCKED` worker claim, claim-token publish marker, and digest-only diagnostics. Runtime migration and worker delivery remain unclaimed. | Do not claim event-bus or Debezium delivery unless a connector is actually wired. |
| 10 | complete | LLM provider runtime decision | `docs/02-architecture/llm-provider-runtime-decision.md`, `tests/llm-provider-runtime-decision.test.ts`, `docs/02-architecture/llm-provider-registry.md`, research ledger entry, tracker update, master-plan update, and package script. First non-OpenAI adapter target: Anthropic Claude Messages API for the reasoning route, with strict tool-schema structured output as a route-specific follow-up. | Do not treat a provider decision as a wired runtime, live failover, or production readiness. |
| 11 | complete | Anthropic runtime PR | `src/api/anthropic.ts`, `scripts/probe-anthropic-live-smoke.ts`, `tests/anthropic-runtime-policy.test.ts`, `tests/anthropic-live-smoke-proof.test.ts`, `tests/llm-provider-registry.test.ts`, deployment/provider docs, research ledger entry, tracker update, master-plan update, and package scripts. The adapter uses Anthropic Messages API, `claude-sonnet-4-6`, digest-only proof context, bounded timeout/output-token/retry policy, rate-limit signal digests, strict tool-schema route tests, and opt-in external-live smoke proof. | Do not claim live failover, production LLM runtime readiness, customer approval, or hosted consequence-route dependence on live LLMs from this adapter. |
| 12 | complete | Production rehearsal go/no-go packet | `scripts/render-production-go-no-go-packet.ts`, `tests/production-go-no-go-packet.test.ts`, `docs/08-deployment/production-go-no-go-packet.md`, production readiness/manifest docs, research ledger entry, tracker update, master-plan update, and package scripts. The packet combines the signed production-promotion candidate, target rehearsal evidence, external signer runtime proof, shared-store boundary, scoped customer PEP proof, scoped LLM provider-route proof, incident/runbook evidence, and digest-only human approval into one `go` or `no-go` verdict. | Do not call the repo, a branch, or a rehearsal target production-ready without real target proof and a passing target-bound packet. |

## Next PR Decision

The 12-step unlock tracker is complete at the repository side. The next
implementation source is the [Unified Shadow-To-Policy Master Plan](unified-shadow-to-policy-master-plan.md),
where Step 13 records the target-system compatibility matrix, Step 14 records
the canonical shadow event schema, Step 15 records the action surface graph,
Step 16 records the evidence state model, Step 17 records the Policy Candidate
PR contract, Step 18 records the Active Question Engine, Step 19 records the
Counterexample replay generator, Step 20 records the Policy Twin backtest, Step
21 records the Review-by-exception inbox, Step 22 records the Approval/dismiss
feedback loop, Step 23 records the Enterprise integration recipes, Step 24
records the General Crypto Transaction Gate, Step 25 records the Domain consequence recipes,
and Step 26 records the Pilot readiness packet. The 26-step master plan is
complete repository-side; future customer-specific pilot, native connector,
live deployment, or production-promotion work should start from a new scoped
tracker.

The 26-step master plan is complete repository-side.

Step 12 does not remove the live-production boundary. It only gives operators
one packet that refuses to issue `go` unless the named target supplies the
signed production-promotion candidate, target external signer runtime proof,
shared-store proof through the environment packet, scoped PEP proof when
customer enforcement is in scope, scoped provider-route proof when live LLM
provider dependence is in scope, incident/runbook evidence, and human approval.

## Work Rules For Future Steps

- Every step must record protected principle, primary source anchor, repository
  evidence, smallest safe change, verification command, limitation, and no-go.
- Every implementation step must add or update a focused test before broader
  checks.
- Every production-sensitive step must keep raw prompts, raw payloads, raw
  provider bodies, credentials, customer identifiers, database URLs, and private
  thresholds out of docs, tests, telemetry, packets, and final output.
- Completed frozen tracks stay frozen. New work starts from this tracker or a
  new scoped tracker when the evidence proves a gap.
- `origin/master` remains the source of truth. A branch can be review-ready,
  but a step is not verified on `origin/master` until the merge commit is
  checked there.

## Non-Claims

This tracker does not claim:

- production readiness
- external KMS/HSM custody
- live customer PEP deployment
- OAuth, cloud-provider, SOC 2, ISO, or security audit certification
- multi-provider LLM resilience
- multi-region or customer-operated deployment readiness
- runtime external-KMS release-token issuance
- target-bound production promotion without a passing go/no-go packet

It is only the decision map for the next unlock sequence.
