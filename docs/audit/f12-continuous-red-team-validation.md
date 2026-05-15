# F12 Continuous Red-Team Validation

Status: repository-side F12 validation complete.

Source report: project-owner supplied F12 continuous red-team automation audit.

Current `origin/master` basis when this slice started: F11 closure had already
merged. The supplied F12 report still referenced an older `origin/master`
snapshot, so this validation treats stale claims as repository evidence problems,
not as live exploit proof.

## What Changed

- Added `scripts/run-f-series-continuous-validation.mjs`, a secretless runner
  that resolves all `test:f*` and `test:final-*` validation scripts plus the
  red-team replay, guard-coverage, supply-chain, drift-binding, tracker, and
  provenance self-tests.
- Added `.github/workflows/f-series-continuous-validation.yml`, a read-only
  nightly / PR / master-push workflow that runs the runner with SHA-pinned
  GitHub Actions.
- Added `tests/f12-canonicalizer-fuzz-smoke.test.ts`, a deterministic fuzz
  smoke over Attestor canonical JSON plus Ed25519 sign/verify bytes.
- Added `/.well-known/security.txt` and disclosure response targets in
  `SECURITY.md`.

## Finding Status

| ID | Current status | Evidence / overlap | Remaining action |
|---|---|---|---|
| F12-RT-1 external AI safety benchmarks cited but not integrated | `backlog` | AgentDojo / The Agent Company / EchoLeak remain research anchors in the registry, not executable benchmark jobs. | Build a real external benchmark adapter before claiming standardized benchmark execution. |
| F12-RT-2 no nightly drift / regression cron | `fixed` | `f-series-continuous-validation.yml`; `audit:f-series-continuous-validation`; `test:f12-continuous-red-team-validation`. | No remaining repository action for this scoped finding. |
| F12-RT-3 no fuzz harness for canonicalizer / verifier | `partial` | `test:f12-canonicalizer-fuzz-smoke` exercises deterministic generated JSON, invalid values, canonicalization stability, and signature-byte rejection. | Full random-byte/property-based fuzzing remains future hardening. |
| F12-RT-4 no cross-finding regression matrix | `partial` | The F-series runner executes all F-series validation scripts plus adjacent guard/replay/tracker invariants in one secretless job. | A formal finding-to-adjacent-finding matrix remains future work. |
| F12-RT-5 bug bounty / public VDP missing | `partial` | `/.well-known/security.txt`; `SECURITY.md` coordinated disclosure path. | No paid public bug-bounty program is claimed. |
| F12-RT-6 red-team fixtures are decision-only, not live runtime | `partial` | F-series runner includes action-surface red-team fixtures, policy-foundry red-team replay, adversarial replay executor, and downstream replay fixtures. | Full live runtime execution against customer-style downstream systems remains future work. |
| F12-RT-7 no production-traffic shadow replay for emerging attack patterns | `backlog` | Existing shadow infrastructure is customer-policy focused. | Production-traffic pattern intake remains future work and must preserve data minimization. |
| F12-RT-8 no public AI safety leaderboard participation | `backlog` | No repository evidence of public leaderboard participation. | Pick one benchmark and publish results only after real execution. |
| F12-RT-9 no pre-merge red-team replay against changed surface | `partial` | F-series workflow runs on PRs touching source, tests, audit docs, scripts, workflows, package files, `SECURITY.md`, or `security.txt`. | Changed-file-to-fixture subset labeling remains future work. |
| F12-RT-10 tracker verification scope unverified | `partial` | `test:audit-remediation-tracker` and `test:research-provenance-ledger` are included in the F-series runner and now check F12 closure evidence. | Network validation of every historical PR URL / merge commit remains outside the secretless local test. |
| F12-RT-11 external pentest cadence undocumented | `invalid-as-stated` | `docs/03-governance/security-testing.md` already recommends annual or release-gated penetration testing and records evidence-handling expectations. | Independent pentest reports and retest artifacts remain external evidence. |
| F12-RT-12 coordinated disclosure timeline / SLA not declared | `fixed` | `SECURITY.md` now declares acknowledgement, triage, and repository-side fix targets; `/.well-known/security.txt` points to the policy. | Hosted service SLA remains explicitly out of scope. |

## Verification

Run locally:

```bash
npm run test:f12-continuous-red-team-validation
npm run test:f12-canonicalizer-fuzz-smoke
npm run audit:f-series-continuous-validation
```

The F-series continuous job is intentionally secretless. It does not run external
live tests, cloud probes, customer downstream systems, or paid-provider
benchmarks.

## No-Claim Boundary

This closes the repository-side F12 validation queue only. It does not prove
AgentDojo benchmark execution, public leaderboard participation, paid bug-bounty
operation, full production-traffic pattern intake, random-byte fuzzing at scale,
or live customer-runtime red-team execution.
