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
- `npm run backup:control-plane`
- `npm run restore:control-plane`
- `gh attestation verify evaluation-artifacts.tar.gz -R 0xlamarr-labs/attestor --signer-workflow 0xlamarr-labs/attestor/.github/workflows/release-provenance.yml`

The manifest is ready for Step 03 when a planner can read it, reject unsafe placeholders, and produce the exact operator command order without silently treating placeholder evidence as production proof.

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
