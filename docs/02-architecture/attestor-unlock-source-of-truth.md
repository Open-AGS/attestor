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

## Current Repository Truth

| Area | Current truth | What remains blocked |
|---|---|---|
| Product shape | One AI Action Control Plane with a shared consequence-admission core and modular packs. | Do not widen into a generic AI gateway, dashboard-only governance tool, wallet, custody layer, or orchestration workspace. |
| Release and policy authority | Shared PostgreSQL release/policy authority is implemented and tested under embedded multi-instance recovery. | External customer-operated production still needs real environment inputs, probes, and rehearsal. |
| Enforcement plane | `attestor/release-enforcement-plane` exposes Node, Hono, webhook, record-write, communication-send, action-dispatch, Envoy, and Istio enforcement surfaces. | A scoped customer runtime still has to prove route coverage, no bypasses, online checks, replay consumption, monitoring, kill switch, and customer approval. |
| Hosted generic admission | Protected high-risk generic admissions now require sender-confirmed release authorization; DPoP proof replay has local and shared PostgreSQL store paths. | `production-shared` still needs structured external issuer proof, customer PEP proof, and live deployment evidence. |
| Tenant signer boundary | The contract defines tenant-scoped external KMS/HSM proof requirements and fake-adapter conformance. | No live AWS, Google Cloud, Azure, HSM, or confidential-compute signer adapter is wired into issuance. |
| Consequence storage | The production storage path names the shared-store primitives and blocks `production-shared` when consequence stores remain evaluation-backed. | Shadow history, simulations, candidates, activation receipts, retry/replay ledgers, audit/dashboard source history, and wizard state still need shared operational implementations. |
| LLM provider registry | OpenAI is wired; provider inventory and route-readiness evidence gates exist for OpenAI, Anthropic, Vertex AI, and Azure OpenAI. | No live multi-provider runtime, no compatible fallback execution, no non-OpenAI smoke proof, and no hosted consequence route depends on a live LLM provider. |
| Production rehearsal | Repo-side readiness packets, HA probes, and production rehearsal planning exist. | A real target environment must still prove deployment, restart, probes, backup/restore, observability, and external control boundaries. |

## Primary Source Anchors

Reviewed on 2026-05-16 for this planning pass:

- OAuth sender constraint and token liveness: [DPoP RFC 9449](https://www.rfc-editor.org/rfc/rfc9449.html), [mTLS-bound tokens RFC 8705](https://www.rfc-editor.org/rfc/rfc8705), [Token Introspection RFC 7662](https://www.rfc-editor.org/rfc/rfc7662), [Token Exchange RFC 8693](https://www.rfc-editor.org/rfc/rfc8693), [RAR RFC 9396](https://www.rfc-editor.org/rfc/rfc9396), and [JWT BCP RFC 8725](https://www.rfc-editor.org/rfc/rfc8725).
- Enforcement placement: [Envoy ext_authz](https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_filters/ext_authz_filter.html), [OPA Envoy](https://www.openpolicyagent.org/docs/latest/envoy-introduction/), [Istio custom authorization](https://istio.io/latest/docs/tasks/security/authorization/authz-custom/), and [SPIFFE/SPIRE](https://spiffe.io/docs/latest/spire-about/).
- Key custody and signer boundaries: [AWS KMS Sign](https://docs.aws.amazon.com/kms/latest/APIReference/API_Sign.html), [Google Cloud KMS algorithms](https://cloud.google.com/kms/docs/algorithms), [Google Cloud KMS asymmetricSign](https://cloud.google.com/kms/docs/reference/rest/v1/projects.locations.keyRings.cryptoKeys.cryptoKeyVersions/asymmetricSign), [Google Cloud KMS protection levels](https://cloud.google.com/kms/docs/protection-levels), [Azure Key Vault Sign](https://learn.microsoft.com/en-us/rest/api/keyvault/keys/sign/sign), and [Azure Managed HSM](https://learn.microsoft.com/en-us/azure/key-vault/managed-hsm/overview).
- Shared store primitives: [PostgreSQL INSERT / ON CONFLICT](https://www.postgresql.org/docs/current/sql-insert.html), [PostgreSQL row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html), [PostgreSQL advisory locks](https://www.postgresql.org/docs/current/explicit-locking.html), [PostgreSQL SELECT locking clauses](https://www.postgresql.org/docs/current/sql-select.html), and [Debezium Outbox Event Router](https://debezium.io/documentation/reference/stable/transformations/outbox-event-router.html).
- Provider routing and structured output: [OpenAI Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs), [OpenAI rate limits](https://platform.openai.com/docs/guides/rate-limits), [Anthropic tool use](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/overview), [Anthropic rate limits](https://docs.anthropic.com/en/api/rate-limits), [Vertex AI structured output](https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/control-generated-output), [Azure OpenAI structured outputs](https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/structured-outputs), and [Azure OpenAI quotas](https://learn.microsoft.com/en-us/azure/ai-foundry/openai/quotas-limits).
- AI risk framing: [NIST AI RMF](https://www.nist.gov/itl/ai-risk-management-framework) and [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/).

These sources anchor engineering choices only. They do not prove OAuth
certification, cloud-provider certification, compliance certification, or
production readiness.

## Progress Summary

| Metric | Value |
|---|---|
| Total unlock rounds | 12 |
| Complete in this tracker | 3 |
| Remaining after this tracker | 9 |
| Current posture | Step 01 established the source-of-truth tracker and no-overclaim decision map. Step 02 selects Google Cloud KMS as the first external signer adapter target. Step 03 closes the external signer proof envelope and diagnostics contract. Steps 04-12 remain implementation or research backlog until each has repo evidence, tests, docs, and merge verification on `origin/master`. |

## Unlock Sequence

| Step | Status | Unlock | Required contract/test/doc evidence | No-go boundary |
|---|---|---|---|---|
| 01 | complete | Source-of-truth tracker | `docs/02-architecture/attestor-unlock-source-of-truth.md`, `tests/attestor-unlock-source-of-truth.test.ts`, README/system-overview links, research ledger entry, package script. | This does not implement any production control by itself. |
| 02 | complete | External KMS/HSM provider decision | `docs/02-architecture/external-kms-hsm-provider-decision.md`, `tests/external-kms-hsm-provider-decision.test.ts`, cryptography policy link, research ledger entry, package script. First adapter target: Google Cloud KMS with `EC_SIGN_ED25519` and raw signing input. | Do not pick a provider that cannot prove algorithm and input-mode semantics. |
| 03 | complete | External signer contract closure | `src/service/bootstrap/release-tenant-signer-boundary.ts`, `docs/02-architecture/external-signer-contract-closure.md`, `tests/production-tenant-signer-boundary.test.ts`, `tests/external-signer-contract-closure.test.ts`, cryptography policy link, research ledger entry, package script. | Do not let a boolean or local PEM path satisfy external custody. |
| 04 | planned | First KMS/HSM adapter PR | One real provider adapter, environment contract, sign/verify probe, fail-closed bootstrap, rotation/compromise notes, focused tests. | Do not claim multi-cloud or customer production readiness from one adapter. |
| 05 | planned | Protected admission end-to-end proof plan | Route contract for admission -> DPoP-bound release token -> introspection -> replay -> PEP -> downstream receipt, with narrow fixture. | Do not treat a signed bearer helper as sufficient for R3/R4 enforcement. |
| 06 | planned | Customer PEP adoption package | Customer-runtime adoption proof using release-enforcement-plane, route coverage, no-bypass checks, health, rollback, kill switch, monitoring, audit, customer approval. | Do not claim customer enforcement until a scoped runtime proves it. |
| 07 | planned | Consequence shared-store inventory | File/in-memory/shared inventory across shadow events, simulations, candidates, activation receipts, wizard state, retry, presentation replay, audit, and dashboard sources. | Do not clear `production-shared` while consequence state is evaluation-backed. |
| 08 | planned | Consequence shared-store PR slice 1 | Atomic replay/idempotency stores with tenant scope, schema digest, `ON CONFLICT` or equivalent arbitration, and raw-payload-free diagnostics. | Do not use a shared database as proof without constraints and tenant boundary evidence. |
| 09 | planned | Consequence shared-store PR slice 2 | Append-only shadow/audit history, outbox contract, worker claim query, advisory-lock keyspace, migration and recovery tests. | Do not claim event-bus or Debezium delivery unless a connector is actually wired. |
| 10 | planned | LLM provider runtime decision | Second-provider choice, route compatibility rule, structured-output adapter shape, rate-limit signal mapping, timeout/budget behavior. | Do not prioritize provider diversity ahead of the consequence enforcement chain. |
| 11 | planned | LLM provider runtime PR | Anthropic, Vertex AI, or Azure OpenAI adapter; digest-only runtime evidence; live smoke probe behind external-live gate; no raw prompt/provider-body storage. | Do not claim live failover or resilience until both providers execute compatible routes. |
| 12 | planned | Production rehearsal go/no-go packet | Combined readiness packet for signer, shared stores, PEP, provider route, probes, backup/restore, observability, and incident/runbook evidence. | Do not call the repo, a branch, or a rehearsal target production-ready without real target proof. |

## First PR Decision

The first implementation unlock after this tracker should be Step 02, not a
large adapter PR. The provider decision has to settle the signing algorithm,
provider-native input mode, non-exportability, live sign/verify proof shape,
tenant isolation, rotation/compromise behavior, and proof redaction before code
selects an external signer path.

The strongest likely first adapter candidates are AWS KMS or Google Cloud KMS
because the current repo policy centers Ed25519 release signing and both have
documented asymmetric signing support that can be mapped into the existing
tenant signer boundary. Azure Key Vault or Managed HSM should remain in the
matrix, but it needs explicit algorithm-fit evidence before it can be treated
as equivalent for the current Ed25519 path.

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
- completion of steps 04-12

It is only the decision map for the next unlock sequence.
