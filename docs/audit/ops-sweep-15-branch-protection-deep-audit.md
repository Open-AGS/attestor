# Ops Sweep 15 - Branch Protection / CI Governance Deep Audit

Status: read-only audit. No remediation written in this sweep. No workflow,
GitHub setting, live proof gate, or branch-protection setting was changed by
this report.

This is the first non-route sweep after OPS-SWEEP-14 closed the `/api/v1/**`
route-layer deep-audit chain.

## 0. Recent Fixes Chain-Effect Check

One merge into `origin/master` since Sweep 14 was drafted:

- PR #521 / commit `e793044d` - "Add Sweep 14 final route audit"
- merge head `585b85445a2a73f555cd05d469392ead9abe1f19`

Files changed by PR #521 are docs-only:

- `docs/audit/ops-sweep-14-final-route-surface-deep-audit.md`
- `docs/audit/report-index.md`
- `docs/audit/finding-index.md`
- `docs/audit/control-map.md`
- `docs/audit/current-posture-baseline.md`

Chain-effect verdict: PR #521 does not touch `.github/**`,
`scripts/validate-pr-contract.mjs`, `scripts/check-stale-branches.mjs`,
`scripts/check-baseline-alignment.mjs`, or any workflow file. No regression, no
config drift, no defense-in-depth weakening, and no closed-finding reopening
was found in Sweep 15 scope.

Sweep 14 OPS-112 and OPS-113 remain open on `origin/master`.

## 1. Validation Frame

| Field | Value |
|---|---|
| Source of truth HEAD | `origin/master @ 585b85445a2a73f555cd05d469392ead9abe1f19` |
| Phase | Phase 1 - Live Shadow Readiness |
| Baseline blocker in scope | `current-posture-baseline.md` Top Blockers P1: "Branch protection signatures and PR reviews" |
| Protected principles | release provenance; auditability; operational boundedness; fail-closed boundary; no overclaim |
| Audit driver | `current-posture-baseline.md` + `finding-index.md` rows `Required commit signatures` and `Required PR reviews` + control-map `Release provenance` next-action |
| External anchors | GitHub protected branches, required signed commits, required pull request reviews, CODEOWNERS, and GitHub Actions `GITHUB_TOKEN` permission scoping docs; NIST SP 800-218 PO.1 / PS.1 / PS.3 / PW.6 / PW.7; SLSA provenance vocabulary |
| Scope | `.github/BRANCH_POLICY.md`, `.github/CODEOWNERS`, `.github/dependabot.yml`, `.github/pull_request_template.md`, `.github/workflows/*.yml`, `scripts/validate-pr-contract.mjs`, `scripts/check-stale-branches.mjs`, `scripts/check-baseline-alignment.mjs`, and audit index rows |

## 2. Inspected Files

| File | Depth | Why selected |
|---|---|---|
| `.github/BRANCH_POLICY.md` | full | Declared branch source-of-truth and cleanup policy |
| `.github/CODEOWNERS` | full | Review-enforcement intent |
| `.github/dependabot.yml` | full | Dependency-update governance |
| `.github/pull_request_template.md` | targeted | PR contract content |
| `.github/workflows/branch-governance.yml` | full | Runtime repository-setting check with dedicated `ATTESTOR_BRANCH_GOVERNANCE_TOKEN` admin-read secret |
| `.github/workflows/pr-contract.yml` | full | PR contract and baseline enforcement |
| `.github/workflows/release-provenance.yml` | full | SBOM + attestation pipeline |
| `.github/workflows/full-verify.yml` | targeted | Scheduled/manual verification and external-live gating |
| `.github/workflows/security-scan.yml` | full | Supply-chain and dependency-review gates |
| `.github/workflows/codeql.yml` | full | Static analysis policy |
| `.github/workflows/evaluation-smoke.yml` | targeted | PR and push smoke gate |
| `.github/workflows/f-series-continuous-validation.yml` | targeted | Red-team replay continuous validation |
| `.github/workflows/production-rehearsal.yml` | targeted | Gated production rehearsal trigger shape |
| `scripts/validate-pr-contract.mjs` | full | Claim-vocabulary and PR-template validator |
| `scripts/check-stale-branches.mjs` | targeted | Stale branch governance |
| `scripts/check-baseline-alignment.mjs` | targeted | Baseline alignment gate |
| `docs/audit/{finding-index,report-index,current-posture-baseline,control-map,live-proof-register}.md` | targeted | Current release-provenance claim state |

## 3. Skipped Files

| File / path | Why skipped | Risk |
|---|---|---|
| `production-rehearsal.yml` full body | Sweep 15 only needs trigger, permission, environment, and concurrency posture | low |
| Full implementation of `check-baseline-alignment.mjs` | Baseline alignment behavior is adjacent, not the branch-protection setting gap | low |
| Live GitHub branch-protection settings | They are external runtime state, not repository evidence; this is the core gap | medium |

No critical Sweep 15 repository file was skipped.

## 4. Positive Observations

| ID | Observation | Why it matters |
|---|---|---|
| OPS15-POS-01 | `.github/BRANCH_POLICY.md` declares `master` as the only source of truth and `codex/*` as ephemeral work branches. | Prevents branch identity drift. |
| OPS15-POS-02 | `.github/CODEOWNERS` maps governance, provenance, security, service, tests, and audit docs to an owner. | Review intent exists in repo. |
| OPS15-POS-03 | Workflow `uses:` references are SHA-pinned with version comments. | Reduces action supply-chain drift. |
| OPS15-POS-04 | Workflows declare explicit `permissions:` blocks. | `GITHUB_TOKEN` authority is constrained per workflow. |
| OPS15-POS-05 | `pr-contract.yml` runs on PR open, edit, synchronize, and reopen. | PR-body claim changes are checked. |
| OPS15-POS-06 | `validate-pr-contract.mjs` enforces required sections, non-empty fields, claim vocabulary, merge classification, and a single final decision. | No-overclaim discipline is mechanical. |
| OPS15-POS-07 | Dependabot bypass is explicit and named, not hidden. | Automation exception is auditable. |
| OPS15-POS-08 | `branch-governance.yml` verifies `delete_branch_on_merge` through the GitHub API when `ATTESTOR_BRANCH_GOVERNANCE_TOKEN` is configured with GitHub Administration: read permission. | At least one live repo setting is runtime-checkable without overclaiming that the default `GITHUB_TOKEN` can read admin settings. |
| OPS15-POS-09 | `release-provenance.yml` builds CycloneDX SBOM output and uses GitHub artifact/SBOM attestation. | Release artifacts have provenance scaffolding. |
| OPS15-POS-10 | `security-scan.yml` layers supply-chain baseline, high-severity npm audit, and dependency review. | Dependency risk has multiple gates. |
| OPS15-POS-11 | `codeql.yml` runs `security-extended` queries on push, PR, schedule, and manual dispatch. | Static analysis is broader than default. |
| OPS15-POS-12 | `f-series-continuous-validation.yml` runs daily and on trust-sensitive paths. | Red-team replay has continuous coverage. |
| OPS15-POS-13 | `full-verify.yml` isolates `external-live` behind workflow dispatch and a protected GitHub Environment. | Live secrets are not exposed to PR/scheduled repo checks. |
| OPS15-POS-14 | `production-rehearsal.yml` is manual-only and uses concurrency controls. | Rehearsal cannot trigger from PR or push. |
| OPS15-POS-15 | Dependabot covers npm, GitHub Actions, and Docker weekly with a bounded open PR limit. | Dependency hygiene is active. |

## 5. Findings

| ID | Severity | State | Title | Evidence | Protected principle | Recommended next action |
|---|---:|---|---|---|---|---|
| OPS-121 | P1 | `open` | GitHub branch-protection `required_signatures` is not verified / not proven enabled. | `branch-governance.yml` verifies `delete_branch_on_merge`, but repo grep found no `required_signatures` check; `finding-index.md` still carries `Required commit signatures` as open. | release provenance | Extend `branch-governance.yml` to assert `.required_signatures.enabled == true`; operator must enable the setting; add live-proof gate during remediation. |
| OPS-122 | P1 | `open` | GitHub branch-protection required PR reviews are not verified / not proven enabled. | CODEOWNERS exists, but enforcement depends on branch protection; repo grep found no `required_pull_request_reviews` assertions. | release provenance; auditability | Assert `required_approving_review_count >= 1`, `require_code_owner_reviews == true`, `dismiss_stale_reviews == true`, and last-push approval policy as selected by operator. |
| OPS-123 | P2 | `open / partial-repo` | No branch-protection live-proof flags exist. | `scripts/check-ops-live-shadow-readiness.mjs` has no `ATTESTOR_BRANCH_PROTECTION_*_PROOF`; `live-proof-register.md` has no branch-protection LP rows. | runtime readiness; no overclaim | Add LP rows and gate flags when OPS-121/122 remediation lands. |
| OPS-124 | P2 | `open / partial-repo` | `branch-governance.yml` detects drift only weekly or manually. | Workflow triggers are schedule and `workflow_dispatch` only. | operational boundedness; auditability | Add PR/push triggers for `.github/**` and `SECURITY.md` changes. |
| OPS-125 | P2 | `blocked / operator-decision` | CODEOWNERS uses a single org-wide owner for all trust-sensitive surfaces. | `.github/CODEOWNERS` maps all protected surfaces to `@AI-gateway-systems`; later governance guidance forbids placeholder team slugs until visible write-enabled GitHub teams and membership policy exist. | release provenance; auditability | Operator must create the teams and membership policy before a real per-surface split can be repo-proven. |
| OPS-126 | P2 | `accepted limitation` | Dependabot PRs bypass the PR contract entirely. | `validate-pr-contract.mjs` explicitly returns a dependency automation bypass for `dependabot[bot]`. | release provenance; auditability | Keep for routine updates; require human merge approval for Dependabot PRs touching runtime/security/build/action surfaces. |
| OPS-127 | P3 | `accepted limitation` | `release-provenance.yml` triggers only on `v*-evaluation` tags. | Workflow tag pattern is evaluation-only. | release provenance; no overclaim | Keep for Phase 1; revisit before Phase 2 production-tag claims. |
| OPS-128 | P3 | `open / partial-repo` | No CONTRIBUTING note defines workflow permission-scope rules. | Write-scoped workflow permissions exist where needed, but no contributor rule documents the threshold for future additions. | release provenance; auditability | Add a CONTRIBUTING section for workflow permission scope discipline. |

## 6. Workflow + Governance Surface Matrix

| # | Artifact | Type | Trigger / role | Runtime setting verified | Affected findings |
|---:|---|---|---|---|---|
| 1 | `.github/BRANCH_POLICY.md` | policy | source-of-truth and stale branch policy | declared only | OPS-121, OPS-122 |
| 2 | `.github/CODEOWNERS` | policy | trust-sensitive owner map | enforcement depends on branch protection | OPS-122, OPS-125 |
| 3 | `.github/dependabot.yml` | policy | weekly dependency updates | n/a | OPS-126 |
| 4 | `.github/pull_request_template.md` | template | PR contract input | validator enforces | none |
| 5 | `.github/workflows/branch-governance.yml` | workflow | weekly + manual + master governance-file pushes | `delete_branch_on_merge`, `required_signatures`, `required_pull_request_reviews`, dedicated admin-read token presence | OPS-121, OPS-122, OPS-124 |
| 6 | `.github/workflows/pr-contract.yml` | workflow | PR body changes | PR contract shape | none |
| 7 | `.github/workflows/codeql.yml` | workflow | push, PR, schedule, manual | CodeQL upload permission | OPS-128 |
| 8 | `.github/workflows/security-scan.yml` | workflow | push, PR, schedule, manual | supply-chain gates | none |
| 9 | `.github/workflows/evaluation-smoke.yml` | workflow | push, PR | smoke gate | none |
| 10 | `.github/workflows/f-series-continuous-validation.yml` | workflow | daily, push, PR | red-team replay | none |
| 11 | `.github/workflows/full-verify.yml` | workflow | schedule + manual | protected external-live env | none |
| 12 | `.github/workflows/release-provenance.yml` | workflow | evaluation tag + manual | artifact/SBOM attestation | OPS-127, OPS-128 |
| 13 | `.github/workflows/production-rehearsal.yml` | workflow | manual only | protected env + concurrency | none |

Coverage: 13/13 governance artifacts audited.

## 7. Branch Protection Verification

| Question | Verdict |
|---|---|
| Is `master` declared the source of truth? | repo-proven |
| Are trust-sensitive paths enumerated? | repo-proven |
| Are CODEOWNERS rules in place? | repo-proven as declared owner map |
| Is `delete_branch_on_merge` verified at runtime? | repo-proven |
| Is `required_signatures` verified at runtime? | gap - OPS-121 |
| Is `required_pull_request_reviews` verified at runtime? | gap - OPS-122 |
| Are workflow actions SHA-pinned? | repo-proven |
| Are workflow permissions minimized? | repo-proven |
| Does PR contract enforce typed claims? | repo-proven |
| Is stale branch policy enforced? | repo-proven weekly/manual |
| Is Dependabot bypass auditable? | repo-proven |
| Is release artifact provenance attested? | repo-proven for evaluation artifacts |
| Are security gates layered? | repo-proven |
| Does CodeQL use security-extended queries? | repo-proven |
| Are external-live secrets isolated? | repo-proven through protected environment shape |
| Is production rehearsal gated? | repo-proven |

Verdict: repository-side governance is strong, but the two live GitHub settings
needed for the Phase 1 release-provenance blocker are not proven from repository
evidence: signed commits and required PR reviews.

## 8. Discrepancy Check Against Indexes

| Topic | Current index state | Sweep 15 result | Required update |
|---|---|---|---|
| Release provenance control area | "Enable and verify branch-protection controls." | Gap localized to OPS-121/122. | Add Sweep 15 evidence and keep next action on settings proof. |
| Required commit signatures | `open`, P0/P1 | Confirmed. | Keep legacy row and point to OPS-121. |
| Required PR reviews | `open`, P0/P1 | Confirmed. | Keep legacy row and point to OPS-122. |
| OPS-SWEEP-15 | absent | New report. | Add report-index row. |
| Branch-protection live proof | absent | Needed with remediation, not report-only. | Add LP rows and gate flags when OPS-121/122 remediation lands. |

## 9. Chain Reactions

| Candidate | Downstream effect | Risk | Proof needed |
|---|---|---|---|
| OPS-121 branch-governance signature assertion | Future unsigned commits cannot merge after operator enables the setting. | low, but contributor signing setup is required | GitHub API setting proof + unsigned negative merge proof |
| OPS-122 required review assertion | PRs require approval and CODEOWNER review after operator enables settings. | medium for solo-maintainer flow | GitHub API setting proof + self-merge negative proof |
| OPS-123 live-proof flags | Live-shadow gate becomes stricter. | low | gate/register alignment test |
| OPS-124 PR/push triggers | Drift caught earlier than weekly. | low | workflow trigger check |
| OPS-125 CODEOWNERS split | More granular review accountability. | medium until teams exist | team membership policy |
| OPS-126 Dependabot bypass narrowing | Security-critical dependency PRs get a human claim. | medium operational friction | validator test |
| OPS-127 production tag pattern | Future Phase 2 tightening. | low now | revisit at Phase 2 |
| OPS-128 permission docs | Future workflow permission additions have a review threshold. | low | CONTRIBUTING update |

## 10. Coverage Delta

Before Sweep 15: the repository had a branch policy, CODEOWNERS, SHA-pinned
workflows, PR-contract validation, supply-chain gates, CodeQL, and release
attestation, but the known `Required commit signatures` and `Required PR
reviews` findings had not been localized to a concrete runtime setting proof.

After Sweep 15: 13 governance artifacts are mapped end-to-end; the exact
GitHub branch-protection settings gap is localized to OPS-121 and OPS-122; and
the remediation path is one small workflow extension plus an operator GitHub
settings action.

No security proof claim: this report does not prove the live GitHub settings
are enabled today.

## 11. Draft Index Updates

This report is integrated by adding OPS-121..OPS-128 to the finding index,
adding the OPS-SWEEP-15 report row, and tightening the release-provenance
baseline/control-map language. The live-proof register is intentionally not
updated by this report-only PR; branch-protection live-proof rows should land
with the remediation that adds the corresponding gate flags.

## 12. Verdict

- Sweep 15 is complete as a read-only audit.
- Repo-proven P0: no.
- Repo-proven P1: yes, OPS-121 and OPS-122.
- Remediation required: yes. Phase 1 release provenance still requires signed
  commit and required-review branch-protection proof.
- Next locked target: Sweep 15 remediation PR for OPS-121/122, or Sweep 16
  demo safety + redaction in parallel.

## Final Checkpoint

- Done: branch protection / CI governance deep audit on
  `origin/master @ 585b85445a2a73f555cd05d469392ead9abe1f19`; 13 governance
  artifacts audited; 15 positive observations; 8 findings drafted.
- Not done: no workflow remediation, no GitHub settings change, no live proof
  rows, no branch-protection negative merge test.
- Files changed by this integration PR: this report plus audit indexes only.
- Current blocker: operator must decide whether to enable GitHub required signed
  commits and required PR reviews, and whether to land the workflow assertions.
