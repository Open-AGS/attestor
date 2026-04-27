# Production Rehearsal Buildout Tracker

This tracker covers the next Attestor production-readiness frontier after the completed runtime-hardening and shared-authority-plane tracks: proving the system against a real target environment instead of only proving repository-embedded behavior.

The goal is not to add a new product, a new crypto branch, or another architecture story. The goal is to turn the current repository truth into an operator-run rehearsal path that can say, with evidence, whether a specific environment is ready for production promotion.

## Guardrails For This Tracker

- The numbered step list below is frozen for this buildout track.
- Step ids and titles do not get rewritten or renumbered later.
- We may append clarifying notes, acceptance criteria, or sub-notes.
- We may only change the `Status`, `Evidence`, and `Notes` columns as work progresses.
- Keep Attestor as one product with one platform core and modular packs.
- Do not add a new hosted crypto route as part of production rehearsal work.
- Do not widen the public product story from rehearsal internals.
- Treat `v0.1.2-evaluation` as an attested evaluation baseline, not a production launch.
- Treat the completed shared-authority track as repo-proven embedded PostgreSQL behavior, not proof that an external customer-operated environment is ready.
- Every rehearsal step must preserve fail-closed behavior and must distinguish technical proof from market/customer validation.
- Prefer existing render, probe, benchmark, backup, restore, and readiness commands before adding new runtime surface area.

## Why This Track Exists

Attestor now has strong repo-side foundations:

- the release, policy, enforcement, crypto, consequence-admission, hosted-flow, proof-surface, runtime-hardening, shared-authority, and service-boundary tracks are complete in their stated scopes
- `v0.1.2-evaluation` is reviewer-runnable, CI-backed, and release-artifact attested
- the shared authority plane is proven under embedded PostgreSQL multi-instance, concurrency, restart, reconnect, and recovery pressure

The remaining production gap is not another internal primitive. It is a real environment proof:

```text
repo-proven shared authority -> environment-rendered deployment -> live probes -> rehearsal -> production-promotion evidence
```

The production-readiness guide already names the required external boundary: real PostgreSQL, Redis, secrets, TLS, DNS, observability, billing, rollout, and DR inputs must be present and rehearsed before claiming customer-operated production readiness.

## Fresh Research Anchors

Reviewed on 2026-04-27 before opening this track:

- NIST SSDF frames secure software development as reducing vulnerabilities, mitigating exploit impact, preventing recurrence, and giving software producers and purchasers a common vocabulary for trust decisions: [NIST SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final)
- SLSA requires artifact provenance to identify produced artifacts by cryptographic digest and describe how they were produced; higher levels require stronger authenticity, trusted build control planes, and secure secret handling: [SLSA producing artifacts](https://slsa.dev/spec/v1.0/requirements)
- GitHub artifact attestations let consumers verify artifact integrity and provenance, but verification should pin the expected repository and signer workflow: [GitHub artifact attestations](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations), [gh attestation verify](https://cli.github.com/manual/gh_attestation_verify)
- Kubernetes production guidance treats availability, scale, security/access management, worker-node resilience, certificates, load balancing, backups, and multi-zone planning as production concerns rather than application-code concerns alone: [Kubernetes production environment](https://kubernetes.io/docs/setup/production-environment/)
- PostgreSQL documents that read/write high availability has synchronization tradeoffs and no single universal solution, which means Attestor must prove the selected external PostgreSQL posture instead of assuming repo tests imply customer environment readiness: [PostgreSQL high availability](https://www.postgresql.org/docs/current/high-availability.html)
- BullMQ production guidance requires explicit Redis production posture, including `noeviction` and connection/retry discipline, which makes queue recovery a rehearsal requirement rather than an implied property of using Redis: [BullMQ going to production](https://docs.bullmq.io/guide/going-to-production)
- OWASP API Security Top 10 remains the baseline vocabulary for API authorization, object-level access, configuration, and unsafe upstream consumption checks around any hosted API surface: [OWASP API Security Top 10 2023](https://owasp.org/API-Security/editions/2023/en/0x03-introduction/)

## Rehearsal Definition

A production rehearsal is a bounded run against a named target environment. It must produce evidence for:

- selected runtime profile
- target environment identity
- PostgreSQL, Redis, secret, TLS, DNS, and observability readiness
- API and worker health/readiness
- fail-closed release/admission behavior
- shared-authority request-path behavior
- reviewer queue, token introspection, revocation, replay, and evidence-pack behavior
- queue/worker recovery behavior
- backup, restore, and DR drill behavior
- alert routing and operational signal behavior
- known limitations and stop conditions

## Progress Summary

| Metric | Value |
|---|---|
| Total frozen steps | 10 |
| Completed | 1 |
| In progress | 0 |
| Not started | 9 |
| Current posture | Step 01 is complete: the production rehearsal scope, non-claims, external-environment boundary, and frozen 10-step path are now documented. The next work is Step 02: define a machine-readable rehearsal manifest and evidence schema that composes the existing benchmark, render, probe, readiness, backup/restore, and provenance outputs without inventing new product scope. |

## Frozen Step List

| Step | Status | Deliverable | Evidence | Notes |
|---|---|---|---|---|
| 01 | complete | Define the production rehearsal scope, success rubric, and non-claims | `docs/02-architecture/production-rehearsal-buildout.md`, `README.md`, `docs/02-architecture/system-overview.md`, `docs/08-deployment/production-readiness.md`, `tests/production-rehearsal-buildout-docs.test.ts`, `package.json` | This step opens the real-environment proof track without reopening completed runtime/shared-authority trackers. It freezes the step list, preserves one-product framing, blocks hosted-crypto/API-story widening, and states that repo-proven embedded PostgreSQL behavior is not the same as external customer-operated production readiness. |
| 02 | pending | Define the rehearsal manifest and evidence schema |  | Create a versioned manifest that records environment identity, runtime profile, command plan, expected artifacts, redacted secret posture, source commit/tag, workflow run ids, and pass/fail evidence pointers. It should compose existing outputs before adding new machinery. |
| 03 | pending | Add the one-command rehearsal planner |  | Build a planner that reads the manifest and tells an operator which existing commands to run first: benchmarks, renderers, probes, readiness packet, backup/restore drill, and provenance checks. It should fail closed on missing target identity or unsafe defaults. |
| 04 | pending | Bind rehearsal to a concrete target environment profile |  | Add the first explicit target profile, likely `gke-production-rehearsal`, using existing GKE, External Secrets, Gateway, cert-manager, Grafana Alloy, shared PostgreSQL, and shared Redis render paths. Keep local/evaluation paths separate. |
| 05 | pending | Prove external substrate readiness |  | Run live probes for release-authority PostgreSQL, control-plane PostgreSQL, billing PostgreSQL, Redis, secrets, TLS/DNS, API readiness, worker readiness, and observability receivers. No silent fallback to local/process memory is allowed. |
| 06 | pending | Rehearse core fail-closed consequence behavior |  | Exercise admitted, blocked, review/hold, token issuance, token introspection, revocation, replay/use-count exhaustion, evidence-pack export, reviewer queue claim, and downstream gate behavior against the target environment. |
| 07 | pending | Rehearse queue, worker, and async recovery |  | Prove Redis/BullMQ production posture, worker drain/restart, stalled/retry behavior, DLQ visibility, and fail-quick submission behavior for unavailable coordination infrastructure. |
| 08 | pending | Rehearse backup, restore, and DR |  | Run control-plane snapshot, PostgreSQL backup/PITR drill, Redis durability check, restore validation, and post-restore readiness/admission checks against a replacement target. |
| 09 | pending | Rehearse observability, alerting, and operator runbooks |  | Prove traces/logs/metrics reach the selected backend, alert routing reaches intended receivers, operational dashboards expose runtime profile and shared-authority truth, and runbooks name stop conditions. |
| 10 | pending | Package the v0.2 production-promotion candidate evidence bundle |  | Produce a signed/attested evidence bundle for the rehearsal with commands, artifacts, workflow ids, environment packet status, limitations, and an explicit go/no-go verdict. This is still not market validation or a blanket production guarantee. |

## Completion Definition

This track is complete only when a named target environment can produce a rehearsal evidence bundle that:

- starts from a known commit or release tag
- uses an explicit runtime profile
- proves shared-authority request-path readiness against external PostgreSQL
- proves Redis/BullMQ production posture for the queue paths used
- proves API and worker readiness after restart/rollout
- proves fail-closed consequence behavior in the deployed environment
- proves backup/restore/DR recovery to a usable state
- proves observability and alert routing reach real destinations
- records non-claims and remaining gaps

## Immediate Next Step

Implement Step 02: define the versioned rehearsal manifest and evidence schema. Do not run ahead to GKE or production rollout until the manifest says exactly what evidence a rehearsal must collect.
