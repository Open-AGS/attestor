# F11 Supply Chain Depth Validation

Source report: project-owner supplied F11 runtime / model / data supply-chain
audit, extending the earlier build-chain R13 posture.

Validation date: 2026-05-15.

Scope: container image pinning, observability runtime references, critical
runtime dependency pinning, Attestor-owned OpenAI model observation, generated
adapter / MCP vocabulary, webhook ingress proof, release provenance, and SBOM
evidence. This is repository-side evidence only. It is not a SLSA level claim,
not an external supply-chain attestation review, and not production deployment
proof.

Protected principles: proof integrity, release provenance, runtime readiness,
auditability, no overclaim, data minimization and redaction.

External anchors:

- SLSA v1.0 for provenance and pinned build inputs:
  <https://slsa.dev/spec/v1.0/>
- NIST SP 800-161 Rev. 1 for cyber supply-chain risk management:
  <https://csrc.nist.gov/pubs/sp/800/161/r1/final>
- NIST SP 800-218 SSDF for secure software development practice:
  <https://csrc.nist.gov/pubs/sp/800/218/final>
- CycloneDX SBOM:
  <https://cyclonedx.org/>
- Sigstore / in-toto attestation concepts:
  <https://docs.sigstore.dev/cosign/verifying/attestation/>

## Repository Evidence

- `Dockerfile` already used digest-pinned Node base images on fresh
  `origin/master`; the supplied F11 Dockerfile finding was stale for that file.
- `docker-compose.ha.yml`, `docker-compose.dr.yml`,
  `docker-compose.observability.yml`, `ops/kubernetes/observability/deployment.yaml`,
  and `ops/kubernetes/observability/providers/grafana-alloy/patch-deployment.yaml`
  now use non-`latest`, digest-pinned external images.
- `scripts/check-supply-chain-baseline.mjs` now rejects floating `:latest`
  image references and requires digest pins for the shipped runtime image files
  it audits.
- Critical runtime dependencies in `package.json` are exact-pinned:
  `openai`, `jose`, `ioredis`, `hono`, `@hono/node-server`, `pg`,
  `snowflake-sdk`, `stripe`, `bullmq`, `openid-client`, and `node-forge`.
- `src/api/openai.ts` now records provider-returned model metadata through
  `observeOpenAiModel(...)` and emits a drift warning if the observed model name
  differs from the configured model.
- `.github/workflows/release-provenance.yml` generates and packages
  `.attestor/release-provenance/sbom.cyclonedx.json` and keeps attestation/OIDC
  write permissions isolated to the release provenance workflow.
- Existing webhook service tests reject missing or invalid Stripe, SendGrid, and
  Mailgun signatures before mutation; F8 already closed the scoped webhook
  signature proof.
- `agentic-supply-chain-guard.ts` already covers `model-provider-sdk`,
  `generated-adapter`, `mcp-server`, `connector`, and `plugin` component kinds.

## Finding Status

| ID | Status | Evidence / boundary |
|---|---|---|
| F11-SC-1 container base images use floating tags | `fixed` | Dockerfile digest pin was already present. HA/DR compose images are now digest-pinned and checked by `security:supply-chain-baseline`. |
| F11-SC-2 observability stack uses `:latest` tags | `fixed` | Compose and Kubernetes observability image refs now use version tags plus SHA-256 digests. |
| F11-SC-3 high-trust npm dependency caret pinning | `fixed` | Critical runtime dependencies are exact-pinned in `package.json` and root `package-lock.json`. Dev/noncritical transitive ranges remain governed by `npm ci` and lockfile integrity. |
| F11-SC-4 single OpenAI provider / provider registry contract | `partial` | Attestor-owned OpenAI calls now record response-model drift telemetry, apply timeout/output-token runtime policy, disable provider-side response storage, and `src/api/llm-provider-registry.ts` records provider inventory plus fail-closed route evaluation. Multi-provider live client selection, failover, and smoke proof remain backlog. |
| F11-SC-5 generated-adapter verification path | `partial` | The agentic supply-chain guard blocks unreviewed generated adapters. Signed generated-adapter provenance and activation rollback remain future hardening. |
| F11-SC-6 decision-context drift not wired to Attestor-owned OpenAI call | `partial` | OpenAI response model observation is now logged. Persisted drift binding and enforcement are not claimed. |
| F11-SC-7 customer-supplied evidence re-fetch | `partial` | Existing evidence-confidence validation keeps source-system verification as a required evidence kind, but universal re-fetch/re-hash is still future work. |
| F11-SC-8 webhook ingress signature spot-check | `fixed` | F8 webhook service tests already verify Stripe, SendGrid, and Mailgun signature rejection before mutation. |
| F11-SC-9 MCP server registry missing | `backlog` | `mcp-server` is a guard component kind, but MCP is not an active product integration in this repository slice. |
| F11-SC-10 connector/plugin component criticality | `fixed` | DB/payment/provider connector libraries are exact-pinned as critical runtime deps; the supply-chain guard covers connector/plugin component kinds and criticality. |
| F11-SC-11 SBOM packaging not located | `invalid-as-stated` | `sbom:cyclonedx` writes `.attestor/release-provenance/sbom.cyclonedx.json`; release provenance packages that artifact. |
| F11-SC-12 release-provenance token boundary | `fixed` | Attestation and OIDC write permissions remain isolated to `release-provenance.yml`, with tag-triggered evaluation releases plus explicit manual dispatch. |

## Remaining Boundary

F11 is closed for planned repository-side work in this slice. The remaining
supply-chain items are not claimed as solved: multi-provider LLM failover,
persisted model-context drift enforcement, universal source-system evidence
re-fetch, signed generated-adapter provenance, MCP registry implementation, and
external production image refresh operations.

Validation command:

```bash
npm run test:f11-supply-chain-depth-validation
```
