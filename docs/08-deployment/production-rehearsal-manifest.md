# Production Rehearsal Manifest

The production rehearsal manifest is the Step 02 contract for the production rehearsal track.

It does not deploy Attestor and it does not claim production readiness. It defines the evidence a named target environment must produce before a later planner, operator run, or promotion packet can say anything stronger.

## Files

| File | Purpose |
|---|---|
| [production-rehearsal-manifest.schema.json](production-rehearsal-manifest.schema.json) | Machine-readable JSON Schema for a rehearsal manifest. |
| [production-rehearsal-manifest.example.json](production-rehearsal-manifest.example.json) | Fill-in template for a future target environment run. |
| [production-rehearsal-targets/gke-production-rehearsal.json](production-rehearsal-targets/gke-production-rehearsal.json) | First explicit target profile binding the manifest to a production-like GKE rehearsal shape. |
| [Production rehearsal buildout](../02-architecture/production-rehearsal-buildout.md) | Tracker that owns the 10-step production rehearsal path. |

## What The Manifest Records

- target environment identity: name, provider, region, cluster, namespace, hostname, and owner
- source identity: repository, commit, release/tag, and workflow run ids
- runtime posture: explicit profile, shared-authority requirement, and no-local-fallback flag
- secret posture: redacted or external-secret references, never plaintext secrets
- command plan: ordered existing commands to run and whether each command is a stop-on-failure gate
- evidence items: producer, artifact path, required status, verification text, workflow ids, and digest slots
- stop conditions: the cases that block production promotion
- non-claims: what this rehearsal still does not prove
- go/no-go verdict: pending until every required item passes for the named target

## Evidence Discipline

The manifest follows three rules:

1. A rehearsal is bound to a specific source commit or tag.
2. A rehearsal is bound to a specific target environment.
3. Required evidence is explicit, inspectable, and digest-ready before packaging a promotion bundle.

This matches the current production-rehearsal research posture:

- SLSA provenance expects artifacts to be identified by cryptographic digest and described by the process that produced them.
- GitHub artifact attestation verification should pin the repository and signer workflow when validating release artifacts.
- NIST SSDF frames evidence and common vocabulary as part of trustworthy software producer and purchaser communication.
- Kubernetes, PostgreSQL, and Redis production guidance all require environment-specific proof rather than assuming repository tests prove a customer's runtime.

## Current Template Boundary

The example manifest intentionally uses placeholder target values and `pending` evidence statuses. That is the point: Step 02 defines the contract, while later steps bind it to a real target environment and run the evidence collection.

The template composes existing commands before adding new machinery:

- `npm run verify`
- `npm run render:production-readiness-packet`
- `npm run probe:ha-runtime-connectivity`
- `npm run probe:ha-release-inputs`
- `npm run probe:observability-receivers`
- `npm run probe:production-rehearsal-substrates`
- `npm run rehearse:production-consequence`
- `npm run rehearse:production-async-recovery`
- `npm run rehearse:production-backup-restore-dr`
- `npm run rehearse:production-observability-alerting`
- `npm run package:production-promotion-candidate`
- `npm run render:production-go-no-go-packet`
- `gh attestation verify evaluation-artifacts.tar.gz -R AI-gateway-systems/attestor --signer-workflow AI-gateway-systems/attestor/.github/workflows/release-provenance.yml`

The manifest now covers the full production rehearsal chain through Step 10. A filled manifest must still be bound to a real target environment before its evidence can be packaged as a production-promotion candidate.

## Planner

Step 03 adds the read-only planner:

```bash
npm run plan:production-rehearsal -- --manifest path/to/filled-production-rehearsal-manifest.json
```

The planner:

- reads the manifest
- rejects placeholder target identity, placeholder source commit, placeholder workflow runs, unsafe runtime fallback, plaintext secret posture, missing npm scripts, and premature `go` verdicts
- prints the ordered command plan and required evidence ids
- exits non-zero when the manifest is unsafe to hand to an operator

The planner does not run the rehearsal commands. It does not produce proof. It only turns a filled manifest into a fail-closed operator plan.

## GitHub Actions Target-Run Workflow

The manual workflow [`production-rehearsal.yml`](../../.github/workflows/production-rehearsal.yml) is the repository entry point for running this chain against a named target environment.

It has two modes:

- `plan-only` installs the repo, runs the production rehearsal documentation guards, and runs `npm run plan:production-rehearsal -- --manifest <path>`. It does not access target secrets and it does not run any rehearsal command.
- `execute` first requires a filled manifest, a `release_provenance_run_id`, and a protected GitHub Environment. The execute job downloads the release provenance artifact, verifies its GitHub artifact attestation, runs the target-bound rehearsal command chain, packages the promotion candidate, renders the final production go/no-go packet, and uploads `.attestor/rehearsal/` as the workflow artifact.

The execute job references the selected GitHub Environment so environment protection rules and environment-scoped secrets gate the run. The job uses read-only repository permissions plus `actions: read` for artifact download. It does not request `contents: write`, `id-token: write`, or `attestations: write`.

The workflow intentionally uses `deployment: false` for the environment because it is a rehearsal, not a deployment. If an operator later adds a custom deployment protection rule that requires GitHub deployment objects, that operator must intentionally change this workflow and document the new promotion semantics.

This workflow is still not proof that production readiness has happened. A real claim requires a filled manifest, a protected environment with real target secrets, passing execute-mode evidence, and human review of the generated production-promotion candidate bundle.
Step 12 also requires the protected environment to supply the external signer
proof digest and any scoped customer PEP or provider-route proof digest before
the go/no-go packet can return `go`.

## Target Profile Binding

Step 04 adds the first explicit target profile: [`gke-production-rehearsal`](production-rehearsal-targets/gke-production-rehearsal.json).

The profile binds the generic manifest to:

- `production-shared` runtime with no local fallback
- GKE as the production-like provider
- External Secrets and Workload Identity as the secret posture
- Gateway API and cert-manager for DNS/TLS cutover rendering
- Grafana Alloy as the observability posture
- shared PostgreSQL and Redis as required external substrates
- the existing HA, domain cutover, observability, readiness packet, and probe commands

This is still not a live deployment or a production-readiness claim. Step 05 owns the live external substrate probes.

## External Substrate Probe

Step 05 adds the fail-closed substrate probe:

```bash
npm run probe:production-rehearsal-substrates
```

The probe reads the `gke-production-rehearsal` profile, checks required environment inputs, reuses the existing HA and observability probes, checks API and worker readiness URLs, verifies DNS target resolution, and validates Kubernetes readiness conditions for External Secrets, Gateway, HTTPRoute, and cert-manager Certificate resources.

The command exits non-zero unless every required substrate check passes. It writes:

- `.attestor/rehearsal/gke-production-rehearsal/substrate-readiness/summary.json`
- `.attestor/rehearsal/gke-production-rehearsal/substrate-readiness/README.md`

This probe still does not claim customer-operated production readiness by itself. It creates the Step 05 evidence item that later rehearsal steps can consume.

## Core Consequence Behavior Rehearsal

Step 06 adds the fail-closed consequence behavior rehearsal:

```bash
npm run rehearse:production-consequence
```

The command consumes the Step 05 substrate readiness summary, requires the `gke-production-rehearsal` target to stay on the `production-shared` / `async-shared-authority-stores` contract, and fails before core behavior if the shared release authority PostgreSQL input is missing.

When prerequisites pass, the rehearsal exercises the existing Attestor primitives:

- admitted consequence -> downstream gate proceeds with proof references
- blocked consequence -> downstream gate holds fail-closed without inventing proof references
- review/hold consequence -> downstream gate holds before execution
- release token issuance, active introspection, revocation, and single-use replay exhaustion
- release evidence pack export and verification
- reviewer queue listing, claim, release, and dual-approval closure

It writes:

- `.attestor/rehearsal/gke-production-rehearsal/consequence-behavior/summary.json`
- `.attestor/rehearsal/gke-production-rehearsal/consequence-behavior/README.md`

This is target-bound technical evidence, not customer adoption proof or a blanket production guarantee.

## Async Recovery Rehearsal

Step 07 adds the queue, worker, and async recovery rehearsal:

```bash
npm run rehearse:production-async-recovery
```

The command consumes the Step 05 substrate readiness summary and the Step 06 consequence behavior summary. It refuses to exercise async recovery unless the target remains `production-shared`, `REDIS_URL` is present, the target profile requires the `queue-redis` substrate, and previous rehearsal evidence has passed.

When prerequisites pass, the rehearsal exercises the existing BullMQ-backed async path:

- Redis reachability and `maxmemory-policy=noeviction` posture
- BullMQ retry/backoff and stalled-job guardrail configuration
- worker drain on close and restart processing of the next job
- transient worker failure retry to completion
- terminal worker failure visibility through BullMQ failed jobs and the persistent async DLQ store
- fail-quick submission behavior when Redis coordination is unavailable
- queue summary visibility for Redis-backed tenant active-execution and weighted-dispatch coordination

It writes:

- `.attestor/rehearsal/gke-production-rehearsal/async-recovery/summary.json`
- `.attestor/rehearsal/gke-production-rehearsal/async-recovery/README.md`
- `.attestor/rehearsal/gke-production-rehearsal/async-recovery/async-dead-letter.json`

This is target-bound queue and worker recovery evidence. It does not prove backup, restore, or DR; Step 08 owns that scope.

## Backup / Restore / DR Rehearsal

Step 08 adds the backup, restore, and disaster-recovery rehearsal:

```bash
npm run rehearse:production-backup-restore-dr
```

The command consumes the Step 05 substrate readiness summary, the Step 06 consequence behavior summary, the Step 07 async recovery summary, and an operator-produced PostgreSQL PITR evidence file referenced by `ATTESTOR_DR_PITR_EVIDENCE_PATH`. It refuses to proceed unless the target remains `production-shared`, the source PostgreSQL/Redis inputs are present, and separate replacement inputs are configured:

- `ATTESTOR_DR_REPLACEMENT_CONTROL_PLANE_PG_URL`
- `ATTESTOR_DR_REPLACEMENT_BILLING_LEDGER_PG_URL`
- `ATTESTOR_DR_REPLACEMENT_RELEASE_AUTHORITY_PG_URL`
- `ATTESTOR_DR_REPLACEMENT_REDIS_URL`
- `ATTESTOR_DR_REPLACEMENT_API_READY_URL`
- `ATTESTOR_DR_REPLACEMENT_WORKER_READY_URL`

The source and replacement URLs must differ. This prevents a restore rehearsal from silently writing back into the source target.

When prerequisites pass, the rehearsal:

- runs the existing control-plane backup command against the source target
- restores the snapshot into the replacement control-plane and billing PostgreSQL targets
- validates replacement release-authority, control-plane, and billing PostgreSQL state
- checks source and replacement Redis durability posture, including `noeviction` plus AOF or RDB persistence
- checks replacement API and worker readiness endpoints
- runs a post-restore consequence-admission allow/block probe to verify fail-closed semantics remain intact

It writes:

- `.attestor/rehearsal/gke-production-rehearsal/backup-restore-dr/summary.json`
- `.attestor/rehearsal/gke-production-rehearsal/backup-restore-dr/README.md`
- `.attestor/rehearsal/gke-production-rehearsal/backup-restore-dr/control-plane-backup/manifest.json`

This is target-bound backup/restore/DR evidence. It is not automated cross-region failover, not a managed PostgreSQL retention policy, and not exactly-once queue processing after disaster recovery.

## Observability / Alerting / Runbook Rehearsal

Step 09 adds the observability, alerting, and operator runbook rehearsal:

```bash
npm run rehearse:production-observability-alerting
```

The command consumes the Step 05 substrate readiness summary, the Step 06 consequence behavior summary, the Step 07 async recovery summary, and the Step 08 backup/restore/DR summary. It refuses to proceed unless the same target remains `production-shared`, observability endpoints are explicit, API health/readiness URLs are explicit, the dashboard URL is explicit, and the operator runbook exists.

When prerequisites pass, the rehearsal:

- emits OTLP logs, traces, and metrics and verifies the flush
- checks Prometheus and Alertmanager API reachability
- runs the existing Alertmanager routing probe for warning, critical, default, security, billing, and watchdog scenarios
- verifies API health/readiness expose `runtimeProfile=production-shared`, `releaseRuntime.durability.ready=true`, `async-shared-authority-stores`, and `usesSharedAuthorityStores=true`
- verifies the operational dashboard exposes the `attestor_runtime_profile_info` metric
- verifies the operator runbook names stop conditions for runtime, shared authority, observability, alerting, and DR prerequisites

It writes:

- `.attestor/rehearsal/gke-production-rehearsal/observability-alerting/summary.json`
- `.attestor/rehearsal/gke-production-rehearsal/observability-alerting/README.md`
- `.attestor/rehearsal/gke-production-rehearsal/observability-alerting/observability-receivers/summary.json`
- `.attestor/rehearsal/gke-production-rehearsal/observability-alerting/alert-routing/summary.json`

This is target-bound observability and runbook evidence. It is not a managed observability service, not a guarantee for every customer paging policy, and not the final promotion verdict; Step 10 owns the signed/attested go/no-go evidence bundle.

## Production-Promotion Candidate Evidence Bundle

Step 10 adds the final packaging command:

```bash
npm run package:production-promotion-candidate -- --manifest path/to/filled-production-rehearsal-manifest.json
```

The command consumes the filled manifest and the evidence artifacts produced by the earlier command plan. It refuses to turn placeholders, pending evidence, missing workflow run ids, missing artifacts, a blocked production-readiness packet, or a missing signing key into a `go` verdict.

When prerequisites pass, the packager:

- copies the required evidence artifacts into a bundle directory
- computes SHA-256 digests for every included artifact
- records the command plan, workflow run ids, environment packet state, limitations, and explicit go/no-go verdict
- writes a local Ed25519 attestation over the final archive digest
- writes reviewer verification instructions for the archive digest, local signature, and optional GitHub artifact attestation

It writes:

- `.attestor/rehearsal/gke-production-rehearsal/production-promotion-candidate/summary.json`
- `.attestor/rehearsal/gke-production-rehearsal/production-promotion-candidate/README.md`
- `.attestor/rehearsal/gke-production-rehearsal/production-promotion-candidate/production-promotion-candidate.tar.gz`
- `.attestor/rehearsal/gke-production-rehearsal/production-promotion-candidate/production-promotion-candidate.tar.gz.sha256`
- `.attestor/rehearsal/gke-production-rehearsal/production-promotion-candidate/production-promotion-attestation.json`
- `.attestor/rehearsal/gke-production-rehearsal/production-promotion-candidate/production-promotion-public-key.pem`

This is a target-bound production-promotion candidate evidence bundle. It is not market validation, not a hosted public SaaS launch, not a blanket production guarantee, and not a substitute for independent security/compliance approval.

## Final Go/No-Go Packet

Step 12 adds the final operator decision packet:

```bash
npm run render:production-go-no-go-packet -- \
  --promotion-summary=.attestor/rehearsal/gke-production-rehearsal/production-promotion-candidate/summary.json
```

The command consumes the Step 10 production-promotion candidate summary and
adds the remaining decision gates: target runtime external signer proof,
shared-store boundary, scoped customer PEP cutover proof when customer
enforcement is in scope, live LLM provider-route proof when a production route
depends on a live provider, incident/runbook evidence, and digest-only human
approval. It writes a final `go` or `no-go` packet; a `go` verdict remains
target-bound and is not a blanket production-readiness claim.
