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

## Pick One Door

Do not start by opening every report in this directory.

Pick the question first, then use the narrowest current-state file.

| If you need to know... | Open first | Stop when... |
|---|---|---|
| What is true about the repository today? | `current-posture-baseline.md` | you can separate repository evidence from live proof and production proof. |
| Whether a report is still current | `report-index.md` | the report row tells you its state and remaining proof gap. |
| Whether a finding is open, closed, accepted, contradicted, or live-only | `finding-index.md` | the row points to current repo evidence, proof gap, or accepted limitation. |
| Whether a claim needs real deployment evidence | `live-proof-register.md` | the proof ID names the required live/customer/operator evidence. |
| Which control vocabulary supports a claim | `control-map.md` | the map names the external anchor and the no-overclaim boundary. |
| How to close or classify a finding | `finding-lifecycle-and-evidence-ledger.md` | the lifecycle state and closure evidence are explicit. |
| Whether an old remediation note still matters | `report-index.md` and `finding-index.md` | a current index row points back to the old note. |

If a historical note disagrees with the active indexes, the active indexes win
until the contradiction is revalidated against current `origin/master`.

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

## Active Current-State Files

These files are the top-level evidence control plane. Keep them easy to find.

| File | Role | Update when |
|---|---|---|
| `README.md` | Directory navigator and no-overclaim rule. | The evidence system shape changes. |
| `current-posture-baseline.md` | Current calibrated posture baseline. | Material P0/P1, readiness, or posture changes. |
| `report-index.md` | Report and sweep state index. | A new report lands or a report state changes. |
| `finding-index.md` | Current high-signal finding registry. | A high-signal finding changes state or evidence. |
| `live-proof-register.md` | Live/customer/operator proof register. | A claim cannot be closed repo-side or proof is captured. |
| `control-map.md` | Control vocabulary and evidence mapping. | A control claim or external anchor changes. |
| `audit-id-alias-registry.md` | Canonical audit IDs and aliases. | A new audit ID or alias is introduced. |
| `finding-lifecycle-and-evidence-ledger.md` | Finding lifecycle contract. | Closure vocabulary or evidence rules change. |
| `ledger-template.md` | Per-finding remediation record template. | The lifecycle contract changes. |
| `attestor-audit-remediation-tracker.md` | Historical F-series remediation tracker. | Historical F-series state needs reconciliation. |

## Historical Evidence Families

Historical reports are evidence leaves. They are not current truth by
themselves.

| File family | Example | Use it for | Current-state rule |
|---|---|---|---|
| `ops-sweep-*.md` | `ops-sweep-22-consequence-admission-engine-deep-audit.md` | Sweep narrative, inspected files, skipped files, findings, chain effects. | Current only through `report-index.md` and `finding-index.md`. |
| `ops-170-*`, `ops-171-*` | `ops-171-consequence-admission-family-sub-sweep-queue.md` | Focused follow-up evidence and accepted backlog scope. | Current only while indexed. |
| `f*.md` | `f7-shadow-infrastructure-validation.md` | Historical F-series validation reports. | Current only when promoted into current indexes. |
| `v0.2.0-*.md` | `v0.2.0-round15-account-session-csrf-boundary.md` | Older remediation notes and closure context. | Do not treat as active posture without index confirmation. |
| `AUD-*.md` | `AUD-2026-SVC-USERSTORE-001.md` | Canonical audit record for a named limitation/finding. | Use with alias registry and lifecycle file. |
| `REM-*.md` | `REM-2026-POL-SCOPING-001.md` | Remediation record for a named finding. | Use only with current state from indexes. |

## Fast Search

Use `rg` before manual browsing:

```bash
rg -n "OPS-170|OPS-171|LP-CUSTOMER-PEP-NO-BYPASS" docs/audit docs/research
rg -n "Locking test:|Test contract:" docs/audit/finding-index.md
rg -n "live-proof-only|accepted limitation|contradicted|not proven" docs/audit
```

These searches are navigation aids only. They do not replace current
`origin/master` validation.

## Current Claim Navigation

Use the narrowest current index for the claim being made:

| Claim or question | Start here | Then cross-check |
|---|---|---|
| Current repository, production, or enterprise posture | `docs/audit/current-posture-baseline.md` | `docs/audit/report-index.md`; `docs/audit/finding-index.md` |
| Whether a report or sweep is current | `docs/audit/report-index.md` | the linked report artifact and the current `origin/master` HEAD |
| Whether a finding is open, closed, accepted, stale, contradicted, or live-only | `docs/audit/finding-index.md` | the cited code, test, PR, CI, or live-proof row |
| Whether repository evidence can close a live/deployment claim | `docs/audit/live-proof-register.md` | `scripts/check/check-ops-live-shadow-readiness.mjs`; the relevant environment proof flag |
| Which external control family a repo claim maps to | `docs/audit/control-map.md` | `docs/research/attestor-research-provenance-ledger.md` |
| Whether historical remediation notes remain current | `docs/audit/report-index.md` and `docs/audit/finding-index.md` | historical notes only after an index points to them |
| Whether a new PR updated the right evidence files | `.github/pull_request_template.md` | `npm run check:security-evidence-system` |

If these files disagree, pause and reconcile the current `origin/master`
evidence before changing code, documentation, readiness language, or audit
state.

## Consistency Guard

Run these repository-side guards before claiming the evidence system is aligned:

- `npm run check:security-evidence-system`
- `npm run test:security-evidence-system`
- `npm run test:audit-finding-lifecycle`
- `npm run test:audit-finding-evidence`
- `npm run test:audit-finding-test-coverage`

These guards prove index discipline only. They do not prove live infrastructure,
customer PEP enforcement, external KMS/HSM signing, production traffic behavior,
or enterprise certification.

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

## Move Rule

Do not move or archive historical audit files just to make the directory look
clean.

Move files only in a dedicated path-migration PR that updates:

1. `report-index.md`,
2. `finding-index.md`,
3. scripts that read audit paths,
4. tests that assert audit evidence paths,
5. every relative link touched by the move.

Until then, prefer navigation over churn.

## No-Overclaim Rule

Repository evidence can close repository findings. It cannot prove:

- live infrastructure correctness,
- customer PEP non-bypassability,
- KMS/HSM runtime authority,
- production traffic behavior,
- enterprise compliance readiness,
- external penetration-test results.

Those belong in `live-proof-register.md` until live evidence is captured.
