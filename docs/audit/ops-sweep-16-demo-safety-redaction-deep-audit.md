# Ops Sweep 16 - Demo Safety + Redaction Deep Audit

Status: read-only audit. No remediation written in this sweep. No redaction
patterns, demo CLI path constraints, public artifact scans, live proof gates, or
GitHub workflow files were changed by this report.

## 0. Recent Fixes Chain-Effect Check

One merge into `origin/master` since Sweep 15 was drafted:

- PR #522 / commit `815361bc` - "Add Sweep 15 branch governance audit"
- merge head `065814d1a8c1b46f9fa36ed36bb0086f5847fd28`

Files changed by PR #522 are docs-only:

- `docs/audit/ops-sweep-15-branch-protection-deep-audit.md`
- `docs/audit/report-index.md`
- `docs/audit/finding-index.md`
- `docs/audit/control-map.md`
- `docs/audit/current-posture-baseline.md`

Chain-effect verdict: PR #522 does not touch `scripts/lib/secret-safe-output.ts`,
`scripts/demo/demo-golden-refund.ts`, `examples/**`,
`src/consequence-admission/data-minimization-redaction-policy.ts`,
`src/consequence-admission/golden-refund-demo.ts`, redaction tests, demo tests,
or committed evidence files. No regression, no config drift, no
defense-in-depth weakening, and no closed-finding reopening was found in Sweep
16 scope.

Sweep 15 OPS-121 and OPS-122 remain open on `origin/master`.

## 1. Validation Frame

| Field | Value |
|---|---|
| Source of truth HEAD | `origin/master @ 065814d1a8c1b46f9fa36ed36bb0086f5847fd28` |
| Phase | Phase 1 - Live Shadow Readiness + Phase 3 - Public Demo / Marketing |
| Baseline blocker in scope | `current-posture-baseline.md` Top Blockers P1: "Demo path traversal and redaction hygiene"; `finding-index.md` rows `B-025` and `B-028` |
| Protected principles | data minimization and redaction; demo safety; no overclaim; auditability |
| Audit driver | `current-posture-baseline.md` Phase 3 preparation + `finding-index.md` B-025/B-028 + control-map `Public demo safety` next action |
| External anchors | NIST SP 800-122 for PII confidentiality; GDPR Article 5 data minimisation; OWASP LLM02 sensitive information disclosure; OWASP LLM07 system prompt leakage; CWE-200 / CWE-22 / CWE-532 / CWE-209 vocabulary |
| Scope | `scripts/lib/secret-safe-output.ts`, `scripts/demo/demo-golden-refund.ts`, `scripts/render/render-proof-{surface,showcase}.ts`, `examples/*demo.ts`, `src/consequence-admission/{data-minimization-redaction-policy,golden-refund-demo}.ts`, `fixtures/golden-refund-reviewer-sandbox.example.json`, redaction/demo tests, and committed public evidence inventory |

## 2. Inspected Files

| File | Depth | Why selected |
|---|---|---|
| `scripts/lib/secret-safe-output.ts` | full | Runtime redaction primitive |
| `src/consequence-admission/data-minimization-redaction-policy.ts` | targeted | Architectural redaction policy and marker vocabulary |
| `scripts/demo/demo-golden-refund.ts` | targeted | Demo CLI `--scenario` path entry |
| `scripts/render/render-proof-showcase.ts` | targeted | Public artifact renderer `--from` path entry |
| `examples/first-useful-admission-demo.ts` | targeted | Pure-code demo pattern check |
| `fixtures/golden-refund-reviewer-sandbox.example.json` | targeted | Shipped demo fixture shape |
| `tests/production-readiness-secret-safe-output.test.ts` | targeted | Runtime redaction regression coverage |
| `docs/evidence/financial-reporting-acceptance-live-hybrid/**` | inventory | Committed public evidence content |
| Redaction and demo tests | inventory | Coverage signal |

## 3. Skipped Files

| File / path | Why skipped | Risk |
|---|---|---|
| `examples/agent-retry-wrapper-demo.ts`, `examples/non-bypassable-gateway-demo.ts` | Pure-code demos following the same fixture-only pattern; no user-supplied file path read | low |
| `src/consequence-admission/golden-refund-demo.ts` | Demo engine internals reached only through the audited CLI and tests | low |
| Provider probe scripts | They consume the shared redactor; the primitive is the audit target | low |
| Full proof-surface scenario constructors | Pure constructors; renderer input path surface was sampled | low |

No critical Sweep 16 file was skipped.

## 4. Positive Observations

| ID | Observation | Why it matters |
|---|---|---|
| OPS16-POS-01 | `demo-golden-refund.ts --help` explicitly says the command is fixture-only and shadow-only and does not call Stripe, Shopify, Google Cloud, workers, an audit database, or target systems. | No-overclaim discipline exists at the demo entry point. |
| OPS16-POS-02 | `fixtures/golden-refund-reviewer-sandbox.example.json` is schema-versioned synthetic data with bucketed amounts and no real identifiers. | Demo fixture is not PII. |
| OPS16-POS-03 | `secret-safe-output.ts` is imported across probe/render/demo scripts. | Operator-output redaction is centralized. |
| OPS16-POS-04 | `data-minimization-redaction-policy.ts` declares forbidden raw classes including credentials, raw downstream responses, idempotency keys, and replay keys. | Architectural policy names sensitive classes. |
| OPS16-POS-05 | Prompt-leakage markers include system/developer prompt shapes and hidden-instruction vocabulary. | LLM07-class leakage is represented. |
| OPS16-POS-06 | Governance refs include NIST SP 800-122, GDPR Article 5, OWASP LLM02, OWASP LLM07, PCI-DSS, and RFC 9457 vocabulary. | Redaction claims have external control anchors. |
| OPS16-POS-07 | Runtime redactor covers Stripe live/test/restricted keys, Stripe webhook secrets, Bearer tokens, Postgres/Redis connection-string passwords, and common Stripe IDs. | Current Stripe/billing demo path is well covered. |
| OPS16-POS-08 | `production-readiness-secret-safe-output.test.ts` proves Stripe, Bearer, Postgres, Redis, and Stripe ID redaction. | Current runtime coverage is regression-locked. |
| OPS16-POS-09 | Committed `docs/evidence/financial-reporting-acceptance-live-hybrid/**` inventory contains public-key and bundle material only. | No private key material was found in that evidence inventory. |
| OPS16-POS-10 | `--scenario` is operator-local; it does not create a remote path traversal surface. | B-025 severity remains bounded. |
| OPS16-POS-11 | Demo CLI defaults to Markdown for curated screenshots/copy-paste; JSON output is opt-in. | Demo output is operator-curated. |
| OPS16-POS-12 | Dedicated tests cover secret-safe output, data minimization policy, golden refund demo, first-useful admission demo, agent retry wrapper demo, non-bypassable gateway demo, shadow-origin redaction witness, and tenant admin secret output. | Regression coverage exists for the documented surface. |

## 5. Findings

| ID | Severity | State | Title | Evidence | Protected principle | Recommended next action |
|---|---:|---|---|---|---|---|
| OPS-129 | P1 | `open` | Redaction patterns are Stripe-focused and miss broad provider tokens. | `scripts/lib/secret-safe-output.ts` covers Stripe keys, `whsec_`, Bearer, Postgres/Redis credentials, and Stripe IDs, but no AWS `AKIA`/`ASIA`, GCP `AIza`/`ya29.`, GitHub PAT, JWT, private-key block, Slack, Anthropic, or OpenAI-specific patterns were found. | data minimization and redaction; demo safety; no overclaim | Extend `SENSITIVE_OUTPUT_PATTERNS` with conservative provider patterns and positive tests per provider. |
| OPS-130 | P2 | `open / partial-repo` | Architectural redaction markers and runtime redaction patterns are drift-prone. | `CONSEQUENCE_DATA_MINIMIZATION_RUNTIME_SECRET_MARKERS` is a small substring list; `SENSITIVE_OUTPUT_PATTERNS` is a separate regex list with no shared registry. | data minimization and redaction; auditability | Create a typed shared `SecretPattern` registry or add a test proving policy markers are covered by implementation. |
| OPS-131 | P2 | `open / partial-repo` | Provider redaction test matrix is incomplete. | `production-readiness-secret-safe-output.test.ts` covers Stripe/Bearer/DB shapes, not AWS/GCP/GitHub/JWT/private-key/Slack/Anthropic/OpenAI tokens. | auditability; no overclaim | Add one positive test per provider, one mixed-provider completeness test, and false-positive guards. |
| OPS-132 | P2 | `open` | No automated public-artifact redaction crawl exists. | No `check-public-artifacts-redaction` script or package script was found; B-028 explicitly asks for public/demo artifact scanning. | data minimization and redaction; demo safety | Add a scanner for public-facing paths and wire it to security/evaluation checks. |
| OPS-133 | P3 | `open` | Demo/render scripts accept operator-supplied paths without basedir constraint. | `demo-golden-refund.ts --scenario` reads a supplied file path; `render-proof-showcase.ts --from` resolves a supplied directory. This is operator-local but can cause accidental public artifact leakage. | demo safety; no overclaim | Add a fixtures-based allowlist or explicit override with no-overclaim warning. |
| OPS-134 | P3 | `open / partial-repo` | Generic Bearer-token regex can false-positive on benign strings. | `Bearer\s+...` is broad and not tied to an `Authorization:` header. | data minimization | Anchor or narrow the Bearer pattern while preserving intended coverage. |
| OPS-135 | P3 | `accepted limitation` | Policy markers rely on substring/case handling rather than a typed regex registry. | Runtime policy markers are lowercase strings; mixed-case coverage depends on evaluator normalization. | data minimization | Resolve through OPS-130 registry unification if that refactor lands. |

## 6. Demo + Redaction Surface Matrix

| # | File / path | Kind | Output medium | Consumes user path | Applies redactor | Affected findings |
|---:|---|---|---|---|---|---|
| 1 | `scripts/demo/demo-golden-refund.ts` | demo CLI | stdout markdown/json | yes, `--scenario` | error path uses `safeErrorMessage` | OPS-133 |
| 2 | `examples/first-useful-admission-demo.ts` | pure demo | stdout | no | n/a | none |
| 3 | `examples/agent-retry-wrapper-demo.ts` | pure demo | stdout | no | n/a | none |
| 4 | `examples/non-bypassable-gateway-demo.ts` | pure demo | stdout | no | n/a | none |
| 5 | `scripts/render/render-proof-surface.ts` | renderer | file | `--out` write path | indirect | none |
| 6 | `scripts/render/render-proof-showcase.ts` | renderer | file | yes, `--from` | indirect | OPS-133 |
| 7 | `scripts/lib/secret-safe-output.ts` | runtime redactor | library | n/a | n/a | OPS-129, OPS-130, OPS-131, OPS-134 |
| 8 | `src/consequence-admission/data-minimization-redaction-policy.ts` | policy | library | n/a | n/a | OPS-130, OPS-135 |
| 9 | `docs/evidence/financial-reporting-acceptance-live-hybrid/**` | committed evidence | static public artifact | n/a | n/a | OPS-132 |
| 10 | `fixtures/golden-refund-reviewer-sandbox.example.json` | demo fixture | input | n/a | n/a | none |

Coverage: 10/10 in-scope artifacts mapped.

## 7. Demo Safety + Redaction Verification

| Question | Verdict |
|---|---|
| Is the demo CLI shadow-only? | repo-proven |
| Is the shipped fixture synthetic? | repo-proven |
| Does the runtime redactor cover Stripe secrets? | repo-proven |
| Does the runtime redactor cover AWS access keys? | gap - OPS-129 |
| Does the runtime redactor cover GCP API keys / OAuth tokens? | gap - OPS-129 |
| Does the runtime redactor cover GitHub PATs? | gap - OPS-129 |
| Does the runtime redactor cover JWTs? | gap - OPS-129 |
| Does the runtime redactor cover SSH/PGP/private-key headers? | gap - OPS-129 |
| Does the runtime redactor cover Slack / Anthropic / OpenAI provider tokens? | gap - OPS-129 |
| Are policy markers aligned with runtime patterns? | gap - OPS-130 |
| Are committed financial-reporting evidence files private-key-free by inventory? | repo-proven |
| Is there a public-artifact redaction scan? | gap - OPS-132 |
| Are demo CLI `--scenario` and showcase `--from` basedir-constrained? | operator-local gap - OPS-133 |

Verdict: demo no-overclaim, synthetic fixture posture, Stripe redaction, and
committed public-key-only evidence inventory are repo-proven. Broader provider
secret coverage and public artifact scanning remain open.

## 8. Discrepancy Check Against Indexes

| Topic | Current index state | Sweep 16 result | Required update |
|---|---|---|---|
| Public demo safety | Baseline flags demo path traversal and redaction gaps. | Gaps localized to OPS-129, OPS-132, OPS-133. | Update control-map and baseline. |
| B-025 | `open`, Low | Confirmed and bounded as operator-local. | Keep legacy row and point to OPS-133. |
| B-028 | `open`, Low/Medium | Confirmed and localized to provider-pattern and artifact-scan gaps. | Keep legacy row and point to OPS-129/132. |
| OPS-SWEEP-16 | absent | New report. | Add report-index row. |
| Public artifact redaction live proof | absent | Needed with remediation, not report-only. | Add LP row and gate flag when OPS-132 remediation lands. |

## 9. Chain Reactions

| Candidate | Downstream effect | Risk | Proof needed |
|---|---|---|---|
| OPS-129 provider patterns | Broader redaction across probe/render/demo output. | medium false-positive risk | provider matrix tests and false-positive guards |
| OPS-130 shared registry | Policy and runtime redaction stop drifting. | low-medium refactor risk | policy/implementation alignment test |
| OPS-132 artifact scanner | Public-facing paths cannot land known provider secrets unnoticed. | medium initial false positives | baseline scan + CI wiring |
| OPS-133 basedir allowlist | Demo scripts cannot accidentally read arbitrary operator-local files into public artifacts. | low operator workflow change | CLI negative tests |

## 10. Coverage Delta

Before Sweep 16: B-025 and B-028 were broad historical findings. Stripe-focused
redaction and synthetic demo data were present, but the missing provider classes
and artifact-scan automation were not localized.

After Sweep 16: the concrete provider redaction gap is named, the public
artifact scan absence is named, and the demo path risk is bounded as
operator-local with a simple fixtures-allowlist closure pattern.

No security proof claim: this report does not add redaction patterns, scan
public artifacts in CI, or constrain demo paths.

## 11. Draft Index Updates

This report is integrated by adding OPS-129..OPS-135, keeping B-025 and B-028 as
legacy baseline aliases, adding the OPS-SWEEP-16 report row, and tightening the
public demo safety baseline/control-map language.

The live-proof register is intentionally not updated by this report-only PR.
`LP-PUBLIC-ARTIFACT-REDACTION` should land with remediation that adds the
matching scanner and gate.

## 12. Verdict

- Sweep 16 is complete as a read-only audit.
- Repo-proven P0: no.
- Repo-proven P1: yes, OPS-129.
- Remediation required: yes before public demo / marketing readiness claims.
- Next locked target: Sweep 16 remediation PR for OPS-129, OPS-132, and
  OPS-133, or Sweep 17 test adequacy map in parallel.

## Final Checkpoint

- Done: demo safety + redaction audit on
  `origin/master @ 065814d1a8c1b46f9fa36ed36bb0086f5847fd28`; 10 artifacts
  mapped; 12 positive observations; 7 findings drafted.
- Not done: no redaction pattern expansion, no public-artifact scan, no demo
  basedir allowlist, no live proof rows.
- Files changed by this integration PR: this report plus audit indexes only.
- Current blocker: operator must decide whether to remediate OPS-129/132/133
  before public demo work continues.
