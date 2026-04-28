# Production Rehearsal Manifest

The production rehearsal manifest is the Step 02 contract for the production rehearsal track.

It does not deploy Attestor and it does not claim production readiness. It defines the evidence a named target environment must produce before a later planner, operator run, or promotion packet can say anything stronger.

## Files

| File | Purpose |
|---|---|
| [production-rehearsal-manifest.schema.json](production-rehearsal-manifest.schema.json) | Machine-readable JSON Schema for a rehearsal manifest. |
| [production-rehearsal-manifest.example.json](production-rehearsal-manifest.example.json) | Fill-in template for a future target environment run. |
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
- `npm run backup:control-plane`
- `npm run restore:control-plane`
- `gh attestation verify evaluation-artifacts.tar.gz -R 0xlamarr-labs/attestor --signer-workflow 0xlamarr-labs/attestor/.github/workflows/release-provenance.yml`

The manifest is ready for Step 03 when a planner can read it, reject unsafe placeholders, and produce the exact operator command order without silently treating placeholder evidence as production proof.
