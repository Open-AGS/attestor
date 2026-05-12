# AGENTS.md - Attestor Agent Guidance

## Project Identity

Attestor is an acceptance, proof, and control layer for AI-driven actions before they become real-world consequences.

Do not treat Attestor as a generic AI app, chatbot wrapper, policy dashboard, prompt filter, or feature demo. Changes should strengthen the system's ability to decide, evidence, narrow, review, block, or admit proposed consequences.

## Working Mode

For non-trivial changes:

1. Inspect repository evidence first.
2. Identify the affected trust surface and protected principle.
3. Use primary or official external anchors when the change touches security, privacy, billing, infrastructure, provenance, AI-agent authority, or production readiness.
4. Produce a short plan before implementation.
5. Prefer small, targeted changes over broad rewrites.
6. Add or update regression tests when behavior changes.
7. Update the closest contract, readiness guide, tracker, or README section when a system claim changes.
8. State limitations and no-go conditions explicitly.

If evidence is missing, say `not proven`, not `broken`.

## Protected Principles

Trust-sensitive changes must map to at least one protected principle:

- proof integrity
- fail-closed boundary
- tenant isolation
- customer authority
- data minimization and redaction
- no overclaim
- runtime readiness
- release provenance
- auditability
- replay and idempotency safety
- operational boundedness

## Evidence Expectations

For trust-sensitive changes, document:

- protected principle
- external or research anchor
- repository evidence
- risk being closed
- smallest safe fix
- regression test or verification command
- limitation or no-go if evidence remains incomplete

Green tests alone are not enough for trust-sensitive work. Prefer code, contracts, tests, docs, CI, and probe evidence that agree with each other.

## Audit Finding Handling

For audit findings, validate before fixing. Keep a finding `open` until repository evidence confirms it. Mark unsupported findings as `disputed`, `duplicate`, `out-of-scope`, `blocked`, or `accepted limitation` instead of turning them into code changes.

Before remediation, record the audit scope, threat model or source, affected trust surface, protected principle, repository evidence, research anchor for the fix, smallest safe fix, verification plan, and remaining limitation using `docs/audit/ledger-template.md` or the closest active tracker.

## Do Not

- Do not overclaim production readiness, compliance, audit completion, security posture, SLSA level, live billing readiness, or deployment maturity.
- Do not weaken fail-closed behavior.
- Do not replace deterministic controls with model judgment.
- Do not add production dependencies without justification and package-surface review.
- Do not introduce broad rewrites unless explicitly requested and supported by repository evidence.
- Do not expose raw prompts, credentials, customer identifiers, tenant ids, webhook bodies, payment data, wallet material, IP addresses, user agents, provider bodies, downstream error bodies, or private thresholds in logs, evidence, dashboards, model feedback, public docs, or audit output.
- Do not put private financial, billing, or operator-specific blockers into public repository docs.

## Verification

Use targeted checks first, then broader checks when risk warrants it. Prefer existing package scripts.

Typical gates:

- TypeScript/source changes: `npm run typecheck`
- Hygiene-sensitive changes: `npm run typecheck:hygiene`
- Broad trust changes: targeted test plus `npm run verify`
- Supply-chain/provenance changes: `npm run security:supply-chain-baseline`
- Live/ops changes: keep `verify:live-local`, `verify:ops`, and `verify:external-live` separate from secretless reviewer gates

If a check cannot run, state exactly why and what evidence is still missing.

## Playbooks

Use the detailed playbooks when the task needs more than this root guidance:

- `docs/ai/attestor-assurance-engineering.md`
- `docs/ai/playbooks/cold-audit.md`
- `docs/ai/playbooks/research-backed-change.md`
- `docs/ai/playbooks/implementation-hardening.md`
- `docs/ai/playbooks/pr-merge-review.md`
- `docs/ai/playbooks/no-go-decision.md`
- `docs/audit/ledger-template.md`
