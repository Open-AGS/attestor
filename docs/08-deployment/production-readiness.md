# Production Readiness Guide

Attestor is now at the point where the main remaining work is not another large engineering block in the repo. It is **environment promotion**: real secrets, real cloud material, real benchmark data, and a disciplined rollout sequence.

This guide uses the **recommended path today**:

- **GKE**
- **Workload Identity**
- **Google Secret Manager**
- **External Secrets**
- **Gateway API + cert-manager**
- **Grafana Alloy / Grafana Cloud**
- **shared PostgreSQL**
- **shared Redis**

AWS remains supported. This guide chooses GKE because it is currently the cleanest repo-guided path end to end.

The repo-side shared release/policy authority-plane buildout is tracked in [Production shared authority plane buildout](../02-architecture/production-shared-authority-plane-buildout.md). That track now proves the shared authority plane with embedded PostgreSQL; the next evidence track is [Production rehearsal buildout](../02-architecture/production-rehearsal-buildout.md), which turns this guide into a real target-environment proof path.

The final operator decision handoff is the
[Production go/no-go packet](production-go-no-go-packet.md). It consumes the
signed production-promotion candidate bundle plus target signer proof, scoped
customer PEP proof when in scope, provider-route proof when in scope,
observability/runbook evidence, and human approval. It returns `go` or `no-go`
without widening the claim beyond the named target.

## What "Ready" Means Here

Attestor is ready for production promotion when all four are true:

1. the **repo pipeline** is green
2. the **environment inputs** are present and reachable
3. the **benchmark + render + probe + packet** chain returns `ready-for-environment-promotion`
4. the selected **runtime profile** truthfully matches the deployment claim

That is the practical line between "good code" and "rollout-ready system".
The go/no-go packet is the final written form of that line; it is still
target-bound and does not create a blanket production guarantee.

## Verification Gates

Use `npm run verify` as the required repository gate. It is intentionally
deterministic, secretless, and suitable for pull requests, reviewers, and the
weekly `Full Verify` schedule.

Use `npm run verify:full` when you want the longer local evidence chain. It
runs `npm run verify`, then the local live/integration checks and the ops
render/probe checks. This proves the repo-side live and deployment-shaped
paths that can be exercised without customer secrets.

External live checks are opt-in. Snowflake, VSAC, ONC Cypress validation,
Policy Foundry production smoke probes, OpenAI live smoke probes, and Anthropic
live smoke probes must run through
`npm run verify:external-live` with `ATTESTOR_RUN_EXTERNAL_LIVE_TESTS=true` in
an explicit live environment. In GitHub Actions, use the `Full Verify`
workflow's `external-live` mode and a protected GitHub Environment that holds
those credentials. Do not treat a green `verify` or default `verify:full` run
as proof that external cloud, healthcare, hosted Policy Foundry, OpenAI,
Anthropic, or customer-operated substrates were reached.

## Runtime Profile Gate

Set `ATTESTOR_RUNTIME_PROFILE` deliberately before starting the API runtime. Do not let the profile default decide the production story.

If `NODE_ENV=production`, `ATTESTOR_HA_MODE=true`, `ATTESTOR_PUBLIC_HOSTNAME`, or `ATTESTOR_PUBLIC_BASE_URL` is present, startup fails closed unless `ATTESTOR_RUNTIME_PROFILE` is set explicitly. The implicit `local-dev` fallback is only for non-production-like local/test runs.

| Profile | Use today | Required proof | Do not claim |
|---|---|---|---|
| `local-dev` | Local development, demos, and repeatable tests. | `npm test` and local API checks may run quickly with memory-backed release state. | Production readiness |
| `single-node-durable` | Customer-operated or hosted evaluation where one runtime must survive restart. | `npm run test:production-runtime-profile`, `npm run test:production-runtime-restart-recovery`, `/api/v1/ready` returning ready, and runtime evidence recording `checks.releaseRuntime=true`. | Multi-node production |
| `production-shared` | Multi-node release/policy authority plane target. | `ATTESTOR_RELEASE_AUTHORITY_PG_URL` must point at reachable PostgreSQL, `npm run test:production-shared-request-path-cutover` and `npm run test:production-shared-multi-instance-recovery` must pass, and `/api/v1/ready` must report shared request-path readiness. | External customer-operated rollout until real environment render/probe packets and rehearsal pass |

The current repository proves `single-node-durable` restart recovery and proves `production-shared` shared authority behavior under embedded PostgreSQL multi-instance, concurrency, restart, reconnect, and recovery tests. It does not claim your external PostgreSQL, Redis, Kubernetes, secret, DNS, TLS, observability, or billing environment is production-ready until the render/probe packet chain and rehearsal pass against that environment.

The public probe endpoints are:

- `GET /api/v1/health`
- `GET /api/v1/ready`

`GET /api/v1/startup` is the process startup probe and is intentionally narrower than readiness. `GET /api/v1/health` is public process liveness and `GET /api/v1/ready` is the public traffic gate; both intentionally avoid internal runtime diagnostics. Runtime evidence, startup diagnostics, readiness packets, and rehearsal summaries must still record the selected profile and `releaseRuntime.durability.ready=true`. Treat `releaseRuntime.durability.ready=false` in that evidence or `/api/v1/ready` returning `503` as a stop condition.

The repo-side Production runtime health contract lives in:

```text
src/service/hosted-production-runtime-health-contract.ts
```

It is the machine-readable boundary for process liveness, dependency readiness, startup diagnostics, worker readiness, queue health, storage authority readiness, webhook ingress readiness, degraded-mode visibility, and secret-safe probe output. It does not replace endpoint probes against a real deployment target.

The repo-side Release provenance and SLSA alignment profile lives in:

```text
src/service/hosted-release-provenance-slsa-alignment.ts
```

It is the machine-readable boundary for the evaluation release archive, SBOM, package-surface probes, proof packets, DSSE evidence packs, tamper-evident history, GitHub attestation verification, and non-claims. It does not replace deployment provenance, live environment readiness, service restart, worker probes, Stripe/webhook smoke tests, or production rehearsal.

The repo-side observability privacy and incident evidence profile lives in:

```text
src/service/hosted-observability-privacy-incident-evidence.ts
```

It is the machine-readable boundary for privacy-safe request telemetry, low-cardinality metric labels, OTLP receiver probes, alert routing context, incident packet shape, dashboard runtime truth, and production rehearsal evidence. It does not replace live collector credentials, alert destination delivery, customer incident communications, backend retention policy, deployment restart, Stripe/webhook smoke tests, or target-specific production rehearsal.

## Production Storage Path Gate

`production-shared` also requires the consequence-admission storage path to be truthful. The shared release authority and control plane are not enough if the AI action authorization history still depends on local evaluation stores.

Internal startup diagnostics, readiness packets, and rehearsal evidence include:

```text
productionStoragePath
consequenceSharedStoreProfile
checks.productionStoragePath
checks.consequenceSharedStoreProfile
```

For `local-dev` and `single-node-durable`, file-backed evaluation stores can be accepted for evaluation. For `production-shared`, the process refuses startup when `productionStoragePath.readyForSelectedProfile=false`; if you are inspecting a preflight runtime, readiness evidence must also report `checks.productionStoragePath=true`. If it is false, inspect `productionStoragePath.blockers` before promoting the environment.

`consequenceSharedStoreProfile` is the narrower consequence-admission contract
behind that gate. It reports the backlog components, required shared-store
primitive, no-go conditions, and required proofs without exposing connection
strings or raw payloads. It does not migrate data or create stores.

For `production-shared`, `shared-durable` mode alone is not enough for this
profile. The profile also requires digest-only operational evidence for the
shared schema, tenant-scope/RLS boundary, idempotency constraints, append-only
outbox contract, worker-claim query, and advisory-lock keyspace where the
component's primitive needs them. Missing proof blocks the selected profile with
codes such as `shared-store-outbox-contract-digest-required`,
`shared-store-worker-claim-query-digest-required`, or
`shared-store-advisory-lock-keyspace-digest-required`. Evidence that reports raw
payload storage or connection-string exposure is a no-go.

For protected API requests in `production-shared`, readiness is not only a
diagnostic. The request guard keeps non-preflight `/api/v1/*` routes closed
until the release/policy request path reports shared authority stores and
`consequenceSharedStoreProfile.readyForSelectedProfile=true`. The preflight
paths remain `GET /api/v1/startup`, `GET /api/v1/health`, and
`GET /api/v1/ready` so operators can inspect blockers without opening action
routes.

Current `production-shared` blockers can include:

- shadow admission event history still file-backed
- shadow simulation reports still file-backed
- policy candidate lifecycle still file-backed
- activation receipt history still file-backed
- retry attempt ledger still an in-memory reference implementation
- presentation replay ledger still an in-memory reference implementation
- agent-loop abuse guard counters still in-memory or Redis configured but not yet proven reachable
- audit/dashboard source history still derived from evaluation stores
- shared-durable consequence stores missing operational proof digests for
  schema, tenant scope, idempotency, outbox, worker claim, or advisory-lock
  coordination

This gate prevents a green HA or observability packet from being read as proof that the consequence-admission storage path is production shared. See [Production storage path](../02-architecture/production-storage-path.md).

### Runtime Authority State Knobs

For `single-node-durable`, point the release-authority stores at durable disk paths that survive process restart:

```bash
ATTESTOR_RUNTIME_PROFILE=single-node-durable
ATTESTOR_RELEASE_DECISION_LOG_PATH=/var/lib/attestor/release-decision-log.jsonl
ATTESTOR_RELEASE_REVIEWER_QUEUE_STORE_PATH=/var/lib/attestor/release-reviewer-queue.json
ATTESTOR_RELEASE_TOKEN_INTROSPECTION_STORE_PATH=/var/lib/attestor/release-token-introspection.json
ATTESTOR_RELEASE_EVIDENCE_PACK_STORE_PATH=/var/lib/attestor/release-evidence-packs.json
ATTESTOR_RELEASE_ENFORCEMENT_DEGRADED_MODE_STORE_PATH=/var/lib/attestor/degraded-mode-grants.json
ATTESTOR_POLICY_CONTROL_PLANE_STORE_PATH=/var/lib/attestor/policy-control-plane.json
ATTESTOR_POLICY_ACTIVATION_APPROVAL_STORE_PATH=/var/lib/attestor/policy-activation-approvals.json
ATTESTOR_POLICY_MUTATION_AUDIT_LOG_PATH=/var/lib/attestor/policy-mutation-audit.json
ATTESTOR_RELEASE_RUNTIME_PKI_PATH=/var/lib/attestor/release-runtime-pki.json
ATTESTOR_RELEASE_RUNTIME_PKI_ROTATION_ID=initial-issuer
```

That PKI path carries the release-token issuer key material. Restart recovery is not complete if the release authority stores survive but the issuer key changes; previously issued release tokens must remain verifiable by the restarted runtime's exported verification key.

Changing `ATTESTOR_RELEASE_RUNTIME_PKI_ROTATION_ID` in a file-backed runtime explicitly rotates the active release-token signer. The runtime keeps the previous public verification key in `GET /api/v1/release-token/jwks` so already-issued tokens can still be verified by `kid`. This is controlled local/file-backed key lifecycle support; production KMS/HSM-backed rotation, compromise response, and key destruction remain a separate operator control.

Release signing provider truth is now explicit:

```bash
ATTESTOR_RELEASE_SIGNING_PROVIDER=file-pem
# or, for the production promotion gate:
ATTESTOR_REQUIRE_PRODUCTION_RELEASE_SIGNING_PROVIDER=true
```

`file-pem` is restart-recoverable and useful for evaluation rehearsal, but runtime diagnostics report it as `productionReady: false` because the private release signer remains exportable runtime material. `ATTESTOR_RELEASE_SIGNING_PROVIDER=external-kms` currently fails closed because the GCP KMS proof adapter is not yet wired into runtime release-token issuance; this prevents a deployment from claiming external key custody while the runtime still signs with local PEM material. `ATTESTOR_REQUIRE_PRODUCTION_RELEASE_SIGNING_PROVIDER=true` is the promotion guard: it refuses local signing material until a real external provider is wired into issuance.

The per-tenant signer boundary also has a structured live provider proof
contract. Future AWS KMS, Google Cloud KMS, Azure Key Vault / Managed HSM, or
confidential signing adapters must provide fresh digest-only sign/verify proof
that matches tenant digest, key reference digest, key id, algorithm, and the
standard Attestor challenge digest. A bare `liveProviderVerified=true` value is
not enough to clear the boundary.

That proof must also match Attestor's provider capability contract: the portable
release-token algorithm, provider-native signing algorithm, and provider input
mode are all pinned. Do not promote a KMS/HSM adapter that cannot prove whether
it signed raw data or a provider-required digest, or that maps an unsupported
provider/algorithm pair such as Azure Key Vault Ed25519.

The first provider-specific probe is Google Cloud KMS Ed25519. Its environment
contract requires `ATTESTOR_RELEASE_SIGNING_PROVIDER=external-kms`,
`ATTESTOR_EXTERNAL_KMS_PROVIDER=gcp-kms`, a full
`ATTESTOR_GCP_KMS_KEY_VERSION_NAME`, opaque `ATTESTOR_GCP_KMS_KEY_ID`,
non-secret `ATTESTOR_GCP_KMS_PUBLIC_KEY_REF`, and an expected protection level
of `hsm`, `external`, or `external-vpc`. The probe signs the standard challenge
through Cloud KMS `asymmetricSign`, verifies CRC32C integrity, verifies the
signature locally, and returns digest-only proof evidence. It still does not
make the runtime issuer external-KMS-backed.

For `production-shared`, do not paper over the gate with file paths. Use it only when the dedicated release-authority PostgreSQL substrate is configured, reachable, and reflected in `/api/v1/ready`.

```bash
ATTESTOR_RUNTIME_PROFILE=production-shared
ATTESTOR_RELEASE_AUTHORITY_PG_URL=postgres://attestor:...@postgres.example.internal:5432/attestor_release_authority
ATTESTOR_RELEASE_RUNTIME_PKI_PATH=/var/lib/attestor/release-runtime-pki.json
ATTESTOR_RELEASE_RUNTIME_PKI_SHARED_PATH=true
ATTESTOR_RELEASE_RUNTIME_PKI_ROTATION_ID=initial-issuer
```

In this profile, file-backed release-authority paths are no longer the authority-plane proof. The request path must use the async shared authority-store contract, and readiness must fail closed if the shared PostgreSQL substrate is missing or unreachable. The PKI path is still part of the runtime trust boundary until a customer KMS/HSM-backed issuer is wired; deploy it through the same secret-management posture as other signing material.

In HA mode, the release-runtime PKI path must be explicit and must be operator-attested with `ATTESTOR_RELEASE_RUNTIME_PKI_SHARED_PATH=true`. This is deliberately not inferred from the string path: the runtime cannot prove whether `/var/lib/...` is an EFS/NFS/shared volume or a per-pod local mount. Without that attestation, startup refuses to create local issuer material, because per-instance PKI would make tokens issued by one instance fail verification through another instance behind the load balancer.

The release-token JWKS endpoint publishes active and retired signer verification keys for token verification. The CA trust root used for evidence-pack trust chains is exposed separately at `GET /api/v1/pki/ca`, so third-party verifiers can fetch the public CA material needed to validate attached chains without receiving any private key material.

## Recommended Stack

```mermaid
flowchart LR
  GSM["Google Secret Manager"] --> ESO["External Secrets"]
  ESO --> K8S["GKE namespace"]
  Cert["cert-manager / Gateway API"] --> K8S
  K8S --> API["Attestor API"]
  K8S --> Worker["Attestor Worker"]
  API <--> PG["Shared PostgreSQL"]
  Worker <--> PG
  API <--> Redis["Shared Redis"]
  Worker <--> Redis
  API --> Alloy["Grafana Alloy"]
  Worker --> Alloy
  Alloy --> Cloud["Grafana Cloud / managed backend"]
```

## Step 1: Provision the Target Environment

Before rendering anything, the target environment should already exist:

- a GKE cluster
- a public hostname
- Gateway API available
- `cert-manager` installed, or a clear TLS strategy chosen
- External Secrets Operator installed
- shared PostgreSQL reachable from the cluster
- shared Redis reachable from the cluster
- a managed observability backend chosen

Recommended defaults:

- TLS: `cert-manager`
- secret delivery: `external-secret`
- observability provider: `grafana-alloy`
- HA provider: `gke`

The repo-guided GKE bootstrap path is no longer just theoretical: a reserved global IP + `<ip>.sslip.io` hostname + Gateway API + cert-manager Gateway HTTP-01 solver + `attestor-tls` Secret + HTTP-to-HTTPS redirect has now been live-validated end to end. Use your own delegated hostname for the final production domain, but the bootstrap route itself is already proven.

Once the bootstrap hostname is proven, render the final delegated-domain cutover bundle with:

```bash
npm run render:gke-domain-cutover -- --hostname=api.example.com --dns-target-ip=<gateway-ip>
```

That bundle closes the final delta between the already-proven bootstrap route and the final production hostname:

- Gateway HTTPS listener hostname
- HTTP to HTTPS redirect route
- cert-manager `ClusterIssuer`
- cert-manager `Certificate`
- DNS handoff summary

## Step 2: Bootstrap the Secret Contract

Render the exact secret contract for GKE:

```bash
npm run render:secret-manager-bootstrap -- --provider=gke
```

This emits:

- GKE `ClusterSecretStore` bootstrap material
- the remote secret catalog
- seed payload examples

Important detail:

- Attestor keeps **logical** secret names human-readable
- when the backend is GKE / Google Secret Manager, slash-separated logical names are normalized into **GSM-safe remote ids**

That avoids a real class of rollout bugs where AWS-style path naming leaks into GSM.

## Step 3: Populate Real Secrets

The repo can render the contract. It cannot invent the real values.

You still need to load:

### Observability secrets

- `GRAFANA_CLOUD_OTLP_ENDPOINT`
- `GRAFANA_CLOUD_OTLP_USERNAME`
- `GRAFANA_CLOUD_OTLP_TOKEN`
- `ALERTMANAGER_DEFAULT_WEBHOOK_URL`
- `ALERTMANAGER_WARNING_WEBHOOK_URL`
- `ALERTMANAGER_CRITICAL_PAGERDUTY_ROUTING_KEY`
- any security / billing / Slack / email routing secrets you actually use

For the recommended Grafana Alloy / Grafana Cloud path, the right mental model
is a **single OTLP gateway**, not a split metrics/logs/traces credential set:

- `GRAFANA_CLOUD_OTLP_ENDPOINT` should point at the stack `otlpHttpUrl`
  connection value, typically ending in `/otlp`
- `GRAFANA_CLOUD_OTLP_USERNAME` should be the stack's Grafana tenant id from
  the same connections payload
- do not reuse the separate Prometheus, Loki, or Tempo tenant ids here

### HA / runtime secrets

- `ATTESTOR_RUNTIME_PROFILE`
- `REDIS_URL`
- `ATTESTOR_CONTROL_PLANE_PG_URL`
- `ATTESTOR_BILLING_LEDGER_PG_URL`
- `ATTESTOR_RELEASE_AUTHORITY_PG_URL` when `ATTESTOR_RUNTIME_PROFILE=production-shared`
- `ATTESTOR_AGENT_LOOP_GUARD_REDIS_URL` when the agent-loop guard does not share `REDIS_URL`
- `ATTESTOR_AGENT_LOOP_GUARD_HASH_KEY`
- `ATTESTOR_RELEASE_RUNTIME_PKI_PATH` and `ATTESTOR_RELEASE_RUNTIME_PKI_SHARED_PATH=true` when `ATTESTOR_HA_MODE=true`
- optional `ATTESTOR_PG_URL`
- `ATTESTOR_ADMIN_API_KEY`
- TLS material if you are not delegating certificate issuance elsewhere

### Runtime identity / routing inputs

- `ATTESTOR_PUBLIC_HOSTNAME`
- `ATTESTOR_API_IMAGE`
- `ATTESTOR_WORKER_IMAGE`

### OpenAI live smoke proof inputs

Run the OpenAI probe only in an explicit live environment:

```bash
npm run probe:openai-live-smoke
```

It requires `OPENAI_API_KEY`, calls the OpenAI Responses API with `store: false`,
uses the wrapper timeout/output-token budget, and prints digest-only evidence.
For production-like OpenAI reasoning calls, set the printed:

- `ATTESTOR_OPENAI_LIVE_SMOKE_PROOF_DIGEST`
- `ATTESTOR_OPENAI_LIVE_SMOKE_PROOF_CHECKED_AT`
- `ATTESTOR_OPENAI_LIVE_SMOKE_PROOF_MODEL`
- `ATTESTOR_OPENAI_LIVE_SMOKE_PROOF_PURPOSE`

This clears the OpenAI reasoning smoke-proof gate only for fresh matching proof
evidence. It does not prove OpenAI vision readiness, live failover, hosted
consequence-admission dependence on LLMs, or production LLM readiness.

### Anthropic live smoke proof inputs

Run the Anthropic probe only in an explicit live environment:

```bash
npm run probe:anthropic-live-smoke
```

It requires `ANTHROPIC_API_KEY`, calls the Anthropic Messages API with the
`anthropic-version: 2023-06-01` header, uses the wrapper timeout/output-token
budget, and prints digest-only evidence. For production-like Anthropic
reasoning calls, set the printed:

- `ATTESTOR_ANTHROPIC_LIVE_SMOKE_PROOF_DIGEST`
- `ATTESTOR_ANTHROPIC_LIVE_SMOKE_PROOF_CHECKED_AT`
- `ATTESTOR_ANTHROPIC_LIVE_SMOKE_PROOF_MODEL`
- `ATTESTOR_ANTHROPIC_LIVE_SMOKE_PROOF_PURPOSE`

This clears the Anthropic reasoning smoke-proof gate only for fresh matching
proof evidence. It does not prove live failover, customer provider approval,
hosted consequence-admission dependence on LLMs, Vertex AI, Azure OpenAI, or
production LLM readiness.

### Trusted proxy headers

By default, Attestor treats `X-Forwarded-For`, `Forwarded`, `X-Real-IP`, and
`CF-Connecting-IP` as untrusted request input. Auth throttling and request
observability use the direct peer address unless the deployment explicitly
enables trusted proxy header processing.

Enable this only when Attestor is not directly reachable from the public
internet and the immediately connected proxy/CDN/Gateway overwrites or strips
inbound forwarded headers before sending traffic to Attestor:

```bash
ATTESTOR_TRUST_PROXY_HEADERS=true
ATTESTOR_TRUSTED_PROXY_PEER_IPS=10.0.0.12,10.0.0.13
```

The default trusted-proxy hop count is `1`, which selects the rightmost
`X-Forwarded-For` / RFC 7239 `Forwarded` address added by the immediately
connected trusted proxy. If the target has a fixed chain such as CDN -> WAF ->
nginx -> Attestor, set the explicit hop count instead of trusting the leftmost
client-supplied value:

```bash
ATTESTOR_TRUSTED_PROXY_HOPS=2
```

The reference nginx HA config overwrites `X-Forwarded-For` with `$remote_addr`.
Do not replace that with `$proxy_add_x_forwarded_for` unless an upstream trusted
edge already strips or overwrites inbound forwarded headers.

Use `ATTESTOR_TRUSTED_PROXY_PEER_IPS=*` only in non-production-like local/test
or fully isolated network paths. Production-like runtimes fail closed on
wildcard trusted proxy peers unless the operator also sets:

```bash
ATTESTOR_TRUSTED_PROXY_PEER_WILDCARD_OVERRIDE=accept-the-risk
```

That override is intentionally loud. It means every direct peer can choose the
client source address used by auth throttling and request observability.

When `ATTESTOR_PUBLIC_HOSTNAME`, `ATTESTOR_PUBLIC_BASE_URL`, or
`ATTESTOR_ALLOWED_HOSTS` is configured on a production-like runtime, the HTTP
edge contract rejects requests whose `Host` header is outside that allowlist.

## Step 4: Measure the Real Environment

Run fresh benchmarks against the actual target environment.

### Observability benchmark

```bash
npm run benchmark:observability -- --prometheus-url=https://<prometheus> --alertmanager-url=https://<alertmanager>
```

This captures:

- live request rate
- availability
- p95 latency
- active alerts

### HA benchmark

```bash
npm run benchmark:ha -- --url=https://<public-host>/api/v1/health
```

This captures:

- health/availability truth
- calibration data used by the HA renderer chain

## Step 5: Render the Promotion Assets

### Observability chain

```bash
npm run render:observability-profile -- --input=.attestor/observability/calibration/latest/benchmark.json --profile=ops/observability/profiles/regulated-production.json
npm run render:observability-credentials
npm run render:observability-release-bundle
npm run probe:observability-release-inputs
npm run render:observability-promotion-packet
```

### HA chain

```bash
npm run render:ha-profile -- --input=.attestor/ha-calibration/latest.json --profile=ops/kubernetes/ha/profiles/gke-production.json
npm run render:ha-credentials
npm run render:ha-release-bundle
npm run probe:ha-runtime-connectivity
npm run probe:ha-release-inputs
npm run render:ha-promotion-packet
```

## Step 6: Render the Final Combined Gate

Before rendering the final production packet, run the repo-side runtime gates:

```bash
npm run test:production-runtime-profile
npm run test:production-runtime-restart-recovery
npm run test:production-shared-request-path-cutover
npm run test:production-shared-multi-instance-recovery
```

Then render the final environment promotion packet:

```bash
npm run render:production-readiness-packet -- --observability-provider=grafana-alloy --observability-benchmark=.attestor/observability/calibration/latest/benchmark.json --ha-provider=gke --ha-benchmark=.attestor/ha-calibration/latest.json --prometheus-url=https://<prometheus> --alertmanager-url=https://<alertmanager>
```

This is the final repo-side handoff.

If the packet says:

- `ready-for-environment-promotion`: the repo pipeline and environment inputs line up
- `blocked-on-environment-inputs`: stop and fix the listed missing inputs or stale benchmarks first

## Step 7: Apply and Validate

Once the packet is green:

1. apply the observability bundle
2. apply the HA bundle
3. if you are moving from bootstrap `sslip.io` to a delegated domain, apply the final-domain cutover bundle
4. wait for rollout completion
5. verify `GET /api/v1/admin/telemetry` reports OTLP logs/traces/metrics enabled against the in-cluster receiver service
6. only then treat Grafana Cloud / managed-backend auth errors as a destination-side credential problem rather than an app-runtime wiring problem
7. confirm API `/api/v1/ready`
8. confirm worker `/ready`
9. confirm runtime/rehearsal evidence records the selected `runtimeProfile` and `releaseRuntime.durability.ready=true`
10. confirm traces/logs/metrics reach the backend
11. confirm alert routing reaches the real destinations
12. confirm Stripe / hosted auth / queue / billing critical paths still behave correctly

## Step 8: Run a Short Production Rehearsal

Do not stop at "the pods came up".

Run a short but real rehearsal:

- rolling restart
- restart recovery check for the selected runtime profile
- worker drain / recovery
- one alert-routing exercise
- one benchmark refresh
- one restore/DR exercise if this is a serious environment

That is what converts a technically correct deployment into an operationally credible one.

## Exit Criteria

You can call the deployment production-ready when all of these are true:

- production readiness packet is green
- `ATTESTOR_RUNTIME_PROFILE` is explicitly set
- `/api/v1/ready` returns ready
- runtime/rehearsal evidence reports `checks.releaseRuntime=true`, the expected `runtimeProfile`, and `releaseRuntime.durability.ready=true`
- `single-node-durable` restart recovery has passed if you are running one API runtime
- `production-shared` is only used if `ATTESTOR_RELEASE_AUTHORITY_PG_URL` is reachable and the shared request path reports the `async-shared-authority-stores` contract
- observability packet is green
- HA packet is green
- real secrets are loaded from the chosen secret backend
- live traces/logs/metrics are visible
- alerts reach the intended receivers
- shared PostgreSQL and Redis are reachable from the running workload
- the public hostname and TLS path work end to end
- at least one rehearsal rollout has succeeded cleanly

## What Still Remains Outside the Repo

This is the honest boundary.

The repository can now:

- render the bundles
- verify the inputs
- probe the endpoints
- produce rollout checkpoints
- prove `single-node-durable` release-authority restart recovery
- prove the `production-shared` shared authority plane under embedded PostgreSQL multi-instance, concurrency, restart, reconnect, and recovery tests

But it still cannot do these things without your real environment:

- create your cloud accounts
- choose your final production domains
- provide the final TLS material or let cert-manager mint certificates inside your own environment
- provide your real OTLP / PagerDuty / webhook credentials
- produce real production traffic on its own
- prove that your external PostgreSQL, Redis, Kubernetes, secret, DNS, TLS, observability, billing, and rollout environment behaves correctly without live promotion inputs and rehearsal

That is not a weakness in the repo. It is the natural boundary between shipped software and real operations.
