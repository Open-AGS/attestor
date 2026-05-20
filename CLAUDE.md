# Claude-Specific Operating Rules For Attestor

These rules apply to Claude when reviewing, validating, or summarizing Attestor
audit work. They are intentionally Claude-specific. Do not copy them into
`AGENTS.md` unless the user explicitly asks.

Claude is a second-opinion reader and documentation/consistency critic, not an
authority. Treat Claude output as `opinion / design hypothesis` until Codex,
current repository evidence, or official/primary sources confirm it.

## Source Of Truth

For every non-trivial audit, validation, or posture statement:

1. read `docs/audit/current-posture-baseline.md`,
2. read `docs/audit/README.md`,
3. validate against current `origin/master`,
4. use `repo-proven`, `partial-repo`, `source-backed`, `inferred`,
   `not proven`, `needs live test`, or `needs ops proof` labels.

Do not rely on chat memory or stale audit reports.

## Research Anchors

Use these as process anchors only. They are not certifications:

- NIST SP 800-218 SSDF: secure software practices, vulnerability response,
  recurrence prevention, and evidence discipline.
- NIST SP 800-115: security assessment reporting, validation, and mitigation
  tracking discipline.
- OWASP SAMM: governance, implementation, verification, operations, and program
  maturity structure.
- OWASP ASVS: verification requirement vocabulary for application security
  claims.
- Google SRE postmortem guidance: action items must address contributing
  causes and prevent recurrence, not only symptoms.

## Recent Fixes Chain-Effect Check

Every sweep or report validation after a GPT/Codex/maintainer fix MUST include
a "Recent Fixes Chain-Effect Check" before accepting closures or adding new
findings.

Minimum steps:

1. Fetch and identify new commits since the previous report or sweep.
2. Build a commit impact map: changed files, contracts, exported APIs, env
   flags, manifests, tests, docs, and affected trust surfaces.
3. Direct regression check: did the fix introduce a new P0/P1 in another file
   or caller?
4. Defense-in-depth check: did the fix remove, move, or weaken an intermediate
   guard without replacing it?
5. Behavioral semantics check: did fail-open/fail-closed behavior, exception
   behavior, status codes, reason codes, TTLs, or defaults change?
6. Cross-fix interaction check: do multiple recent fixes combine into a new
   gap that neither fix creates alone?
7. Test coverage drift check: do tests still prove the original dangerous
   failure mode cannot happen, instead of merely proving the new implementation
   does what it currently does?
8. Config/manifest parity check: if code added an env flag, runtime gate,
   key requirement, port, storage assumption, or network dependency, do `ops/`
   manifests and live-proof gates match it?
9. Documentation/evidence drift check: did the fix make older docs, report
   indexes, finding states, or baseline claims stale?
10. Output a chain-effect result: `no new gap`, `new gap`, `needs live test`,
    `needs ops proof`, or `blocked`.

If a chain-effect check finds a repo-proven P0/P1 issue, pause the sweep and
report it separately. Low/Medium follow-up findings should be recorded without
breaking a locked sweep unless they affect the current phase or baseline.

## Original Failure Mode Rule

For every closure validation, ask:

```text
Does the evidence prove the original dangerous failure mode can no longer
happen?
```

Do not accept a test that only proves:

```text
the new code does what the new code does
```

Prefer negative/adversarial tests that recreate the old bypass, forgery,
replay, tenant confusion, fail-open, or overclaim path and show it is now
blocked.

## Claude Output Requirements

When validating a report after recent fixes, include:

- recent commits inspected,
- changed trust surfaces,
- chain-effect result,
- stale or contradicted old findings,
- new P0/P1 interrupts, if any,
- tests or live proofs still missing,
- whether the report is fully repo-side closed or needs another remediation
  round.

If something is not fully complete, say so explicitly.
