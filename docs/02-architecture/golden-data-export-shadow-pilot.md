# Golden Path: Controlled Data Export

Status: complete. D01-D04 are repository-side only. This is the first
repository-side contract/projection/smoke/demo slice for the Data Movement
golden path. It is not a live Snowflake or Databricks connector, not a data
warehouse, not a customer export service, not customer PEP proof, not production
readiness, and not enterprise readiness.

## Decision

Controlled Data Export is the next golden path after Golden Path: Refund. It
keeps the same Attestor consequence grammar, but moves the example from Money
Movement into Data Movement:

```text
data export or report-release action intent
  -> synthetic canonical shadow events
  -> digest-only evidence, approval, recipient, tenant, purpose, and replay refs
  -> admit / narrow / review / block shadow decisions
  -> later runtime smoke, demo CLI, and reviewer sandbox
```

Non-split boundary:

```text
Not a warehouse connector.
Not a report builder.
Not a customer data export service.
Not a records system.
Not a workflow workspace.
Not a new Attestor mode.
```

The data domain supplies the example surface; it does not get independent
authority. Every scenario remains shadow-only and review material until a later
customer-controlled PEP/gate consumes an Attestor decision.

## Repository Evidence

| Area | Evidence | State |
|---|---|---|
| Data Movement taxonomy | `README.md` lists Data Movement as warehouse queries, customer exports, report releases, and controlled data packages, and says the pack list is taxonomy, not equal-maturity claim. | repo-proven |
| Data tool recipes | `src/consequence-admission/domain-consequence-recipes.ts` maps Snowflake Cortex Agents and Databricks AI agent tools into `data-tool-gate` recipe entries with `customer.export`, `semantic.query.publish`, `workspace.job.run`, and `data.export` examples. | repo-proven |
| D01 fixture contract | `src/consequence-admission/golden-data-export-shadow-fixtures.ts` emits eight synthetic digest-only canonical shadow events for controlled data export and report-release scenarios. | repo-proven |
| D01 tests | `tests/golden-data-export-shadow-fixtures.test.ts` locks the suite shape, digest-only canonical events, scenario semantics, no-target-system-call flags, and no raw SQL/row/customer identifier posture. | repo-proven |
| D02 Policy Foundry projection | `src/consequence-admission/golden-data-export-policy-foundry-projection.ts` projects the D01 suite into review-only Policy Foundry material with named recipient, field, tenant, approval, and purpose gaps. | repo-proven |
| D02 tests | `tests/golden-data-export-policy-foundry-projection.test.ts` locks the review-only candidate, decision/gap counts, Policy Twin summary, no-raw-data posture, docs, ledger, and package script alignment. | repo-proven |
| D03 runtime smoke | `src/consequence-admission/golden-data-export-runtime-smoke.ts` runs the D01 fixture suite plus D02 projection through the R02-R07 shadow runtime smoke chain without target-system calls, audit writes, policy activation, or raw data reads. | repo-proven |
| D03 pilot readiness probe | `src/consequence-admission/golden-data-export-pilot-readiness-probe.ts` wraps the runtime smoke in a shadow-entry readiness packet that can emit only `ready-for-shadow-pilot` or `not-ready`. | repo-proven |
| D04 demo CLI | `scripts/demo/demo-golden-data-export.ts` renders Markdown-first and JSON-secondary demo output from the D01-D03 material, plus bounded `--scenario` reviewer input. | repo-proven |
| D04 reviewer sandbox | `src/consequence-admission/golden-data-export-reviewer-sandbox.ts` validates a strict allowlisted local JSON shape and runs in-scope reviewer inputs through the same shadow-only runtime path without target-system calls or raw data material. | repo-proven |

## Research Anchors

Snowflake Cortex Agents and Databricks AI agent tools anchor the modern data/AI
tool-call shape: an AI agent can invoke tools, functions, SQL-adjacent actions,
jobs, or data export paths. Attestor's placement is before those operations
cause a write, export, external call, or report release.

- [Snowflake Cortex Agents REST API](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents-rest-api)
- [Databricks AI agent tools](https://docs.databricks.com/aws/en/generative-ai/agent-framework/agent-tool)

OWASP API1 anchors object-level authorization pressure: route-level access is
not enough when the proposed object, report, dataset, recipient, or tenant can
change. OWASP LLM01 and LLM02 anchor the need to treat untrusted/instruction-like
evidence as evidence, not authority, while avoiding sensitive information
disclosure.

- [OWASP API1: Broken Object Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/)
- [OWASP LLM01: Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)
- [OWASP LLM02: Sensitive Information Disclosure](https://genai.owasp.org/llmrisk/llm02-sensitive-information-disclosure/)

NIST SP 800-53 Rev. 5 supplies control vocabulary for access enforcement, least
privilege, audit event generation, and audit records. The NIST Privacy
Framework supplies privacy-risk and data-minimization framing. These are
engineering anchors only, not compliance certification.

- [NIST SP 800-53 Rev. 5](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final)
- [NIST Privacy Framework](https://www.nist.gov/privacy-framework)

## D-Series Tracker

Progress after D04 lands: 4/4 complete. 0 steps remain.

| Step | Status | Slice | Evidence target |
|---|---|---|---|
| D01 | complete | Controlled data export shadow fixture contract | Synthetic digest-only canonical shadow events for aggregate-report-release, customer-export-approved, pii-column-narrowing, external-recipient-review, tenant-scope-mismatch, stale-approval, prompt-injection-in-evidence, and write-query-blocked scenarios. |
| D02 | complete | Policy Foundry data export projection | Review-only candidate, named gaps, decision counts, and Policy Twin summary over D01 fixtures. |
| D03 | complete | Runtime smoke and pilot readiness | Run the existing shadow runtime chain over D01/D02 material and emit only `ready-for-shadow-pilot` or `not-ready`. |
| D04 | complete | Demo CLI and reviewer sandbox | Markdown-first local demo plus strict local JSON reviewer input, with no target-system calls and no raw data material. |

## D01 Scenario Contract

D01 covers eight fixture-only cases:

```text
aggregate-report-release
customer-export-approved
pii-column-narrowing
external-recipient-review
tenant-scope-mismatch
stale-approval
prompt-injection-in-evidence
write-query-blocked
```

Every fixture records:

```text
tenantRefDigest
actorRefDigest
targetAccountRefDigest
resourceRefDigest
data class
query class
recipient class
field class
row-count bucket
approval freshness
purpose binding
evidence refs
approval refs
policy refs
replay/idempotency/trace refs
```

Every fixture forbids:

```text
raw SQL
raw rows
raw customer identifiers
raw provider body
target-system calls
auto enforcement
production readiness claims
```

## D02 Policy Foundry Projection

D02 projects the D01 fixtures into Policy Foundry review material. The projection
emits a review-only candidate for `data_movement.controlled_export`, a Policy
Twin summary, decision counts, gap counts, fixture/event digests, and named gaps.

The review-only candidate binds the same consequence boundary as D01:

```text
AI-prepared report/export intent
  -> digest-only shadow fixture material
  -> review-only Policy Foundry projection
  -> recipient, field, tenant, approval, and purpose gaps
  -> later runtime smoke and reviewer demo material
```

Named D02 gaps:

```text
overbroad-personal-data
external-recipient-unapproved
tenant-scope-mismatch
stale-approval
instruction-like-evidence-review
write-side-effect
purpose-binding-missing
```

D02 remains review material only. It cannot activate enforcement, mutate policy,
execute a warehouse query, export rows, call Snowflake or Databricks, or prove a
customer PEP/gate.

## D03 Runtime Smoke And Pilot Readiness

D03 runs D01 fixture material and the D02 projection through the existing
R02-R07 shadow runtime smoke chain. The output is deterministic replay evidence
only:

```text
D01 controlled export fixture
  -> D02 review-only projection
  -> R02-R07 shadow runtime smoke chain
  -> digest-only runtime artifacts
  -> shadow-entry readiness packet
```

The readiness probe may emit only:

```text
ready-for-shadow-pilot
not-ready
```

`ready-for-scoped-pilot` is outside D03 because scoped enforcement needs a
customer PEP/gate, live replay/idempotency storage, deployment probes, and
operator/customer proof.

D03 forbids target-system calls, audit writes, external event buses, external
trace/lineage export, policy activation, learning/training activation, raw
payload reads, raw payload storage, warehouse execution, and data export.

## D04 Demo CLI And Reviewer Sandbox

D04 adds a Markdown-first local demo and a strict reviewer sandbox:

```text
npm run demo:golden-data-export
npm run demo:golden-data-export -- --json
npm run demo:golden-data-export -- --scenario fixtures/golden-data-export-reviewer-sandbox.example.json
```

The default demo output is Markdown for screenshots, review, and copy/paste.
JSON as secondary machine output is available with `--json`.

The reviewer sandbox accepts only a bounded JSON Schema-style allowlist:

```text
version
actionSurface
queryClass
dataClass
recipientClass
requestedFieldsClass
rowCountBucket
approvalFreshness
tenantScope
purposeBound
instructionLikeEvidence
externalSideEffect
writeSideEffect
```

The sandbox rejects unknown fields, outside-scope action surfaces, control
characters, and non-enum values. The `--scenario` file path is constrained to
`fixtures/` by the same local demo path-boundary helper used by the refund demo.

D04 research anchors are inherited from D01-D03; the implementation pattern is
the repo-local refund demo/sandbox and OWASP Input Validation style allowlisting.

## No-Claims

D01-D02 do not prove:

- live Snowflake execution;
- live Databricks execution;
- native connector coverage;
- real customer export;
- report correctness;
- customer PEP no-bypass enforcement;
- live replay/idempotency store wiring;
- compliance certification;
- production readiness;
- enterprise readiness.

## Next Locked Target

D02 should project the D01 fixture suite into review-only Policy Foundry material
with named Data Movement gaps:

- field narrowing required;
- recipient approval gap;
- tenant scope mismatch;
- stale approval;
- instruction-like evidence text;
- write-side-effect block;
- missing purpose binding.

No D02 output may activate enforcement, mutate policy, execute a query, export
data, or write to a target warehouse.
