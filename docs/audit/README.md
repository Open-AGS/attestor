# Attestor Audit Evidence System

This directory is the repository-side evidence system for Attestor audit,
remediation, live-shadow readiness, and no-overclaim planning.

It is not a certification package and it is not proof of live production
readiness. It organizes current repository evidence so audit agents and
reviewers do not rely on chat memory, stale reports, or scattered remediation
notes.

## Required Reading Order

Before starting audit, remediation, posture scoring, or readiness claims, read:

1. `docs/audit/current-posture-baseline.md`
2. `docs/audit/report-index.md`
3. `docs/audit/finding-index.md`
4. `docs/audit/live-proof-register.md`
5. `docs/audit/control-map.md`
6. `docs/research/README.md`

If a task conflicts with these files, validate against current `origin/master`
before changing direction.

## Evidence Model

| File | Purpose |
|---|---|
| `current-posture-baseline.md` | Active operating baseline and calibrated posture. |
| `report-index.md` | Index of audit reports, sweeps, and posture assessments. |
| `finding-index.md` | Canonical current-state registry for important findings. |
| `live-proof-register.md` | Live-only proofs that cannot be closed by repository evidence alone. |
| `control-map.md` | NIST / OWASP / SAMM / ASVS mapping from controls to repo evidence. |
| `finding-lifecycle-and-evidence-ledger.md` | Lifecycle schema and closure evidence rules. |
| `ledger-template.md` | Per-finding remediation record template. |
| `attestor-audit-remediation-tracker.md` | Historical remediation tracker. |

## Update Rule

Do not treat individual remediation notes as the source of current truth.

When a report or remediation changes posture materially:

1. update the specific remediation doc,
2. update `report-index.md`,
3. update `finding-index.md`,
4. update `live-proof-register.md` if any remaining proof is live-only,
5. update `control-map.md` if a control claim changes,
6. update `current-posture-baseline.md` only when the calibrated posture or
   P0/P1 plan changes.

Historical files may keep old "Round" names. New work should prefer scoped names
such as `OPS-SWEEP-03`, `SVC-ADMIN-ROUTES-01`, or
`POSTURE-BASELINE-YYYY-MM-DD`.

## No-Overclaim Rule

Repository evidence can close repository findings. It cannot prove:

- live infrastructure correctness,
- customer PEP non-bypassability,
- KMS/HSM runtime authority,
- production traffic behavior,
- enterprise compliance readiness,
- external penetration-test results.

Those belong in `live-proof-register.md` until live evidence is captured.
