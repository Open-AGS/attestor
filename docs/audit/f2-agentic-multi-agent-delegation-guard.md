# F2-R1 Multi-Agent Delegation Guard

Status: implemented as repository-side guard hardening.

This audit hardening step addresses the F2 agentic consequence-surface finding
that `multi-agent-delegation-confusion` was registered and replay-backed, but did
not have a dedicated guard module.

## Research Anchors

- OWASP LLM06:2025 Excessive Agency as an engineering anchor for agent/tool
  authority exceeding intended scope.
- NIST AI RMF and NIST AI 600-1 as engineering anchors for governance,
  lifecycle risk management, and evidence-bound AI system controls.

These sources are engineering anchors only. They do not certify Attestor, and
they do not prove live customer enforcement.

## Repository Evidence

- Code: `src/consequence-admission/multi-agent-delegation-guard.ts`
- Test: `tests/multi-agent-delegation-guard.test.ts`
- Docs: `docs/02-architecture/multi-agent-delegation-guard.md`
- Coverage: `src/consequence-admission/failure-mode-guard-coverage.ts`
- Readiness: `src/consequence-admission/guard-activation-readiness.ts`

## Control

The guard now renders digest-only decisions for multi-agent delegation:

- missing chain, identity, authority, or scope evidence returns `review`
- scope mismatch returns `block`
- cycles return `block`
- actor self-approval returns `block`
- complete authority and matching delegated scope can return `pass`

The decision output stores digests and booleans, not raw principal references or
tenant IDs.

## Status Change

Before:

- `multi-agent-delegation-confusion` had registry, binding, replay, and Policy
  Foundry context evidence
- no dedicated guard module rendered a pass/review/block decision for a concrete
  principal chain

After:

- `multi-agent-delegation-confusion` is marked as dedicated-guard coverage
- activation readiness includes `multi-agent-delegation-guard`
- package surface exposes the descriptor and evaluator

## Limitations

Not proven:

- every admission route supplies principal-chain metadata
- inter-agent transport authentication is deployed
- every downstream verifier rejects review/block outcomes
- live customer workflow coverage

This remains a repository-side guard contract until integrated into concrete
customer enforcement points.
