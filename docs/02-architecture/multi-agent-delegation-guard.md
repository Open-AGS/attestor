# Multi-Agent Delegation Guard

Version: `attestor.consequence-multi-agent-delegation-guard.v1`

Source: `src/consequence-admission/multi-agent-delegation-guard.ts`

Test command:

```bash
npm run test:multi-agent-delegation-guard
```

## Purpose

The guard addresses `multi-agent-delegation-confusion`: one agent delegates a
high-impact action to another agent without a clear chain of authority, identity,
and delegated scope.

This is repository-side guard hardening. It is not a certification, not proof of
live customer enforcement, and not a claim that inter-agent transport
authentication is solved.

## Inputs

The guard evaluates:

- principal chain
- principal kind and role
- agent identity digest presence
- delegating authority digest presence
- requested and approved delegated scope digests
- tenant digest diversity
- transport binding digest presence

Raw principal references, tenant IDs, prompts, messages, and tool payloads are
not stored in the decision output. The guard emits digests and booleans.

## Decision Rules

The guard returns:

- `pass`: explicit chain, agent identity, authority, and matching delegated
  scope are present
- `review`: chain, identity, authority, or scope evidence is missing
- `block`: the chain contains a cycle, self-approval, or unapproved delegated
  scope

Only `pass` is `allowed=true`. `review` and `block` are fail-closed.

## Required Evidence

For delegated high-impact actions, the caller should provide:

- `delegation-chain`
- `agent-identity`
- `delegated-scope`
- `delegating-authority`
- optional transport binding digest

The guard does not trust natural-language delegation claims. A chat, email,
ticket, tool output, or model summary can describe a delegation request, but it
does not become authority by itself.

## Limitations

Not proven:

- every admission route supplies principal-chain metadata
- inter-agent transport authentication is deployed
- every downstream enforcement point consumes negative guard decisions
- live customer workflows have adopted the guard

## Related Controls

- [Failure Mode Registry](failure-mode-registry.md)
- [Failure Mode Control Bindings](failure-mode-control-bindings.md)
- [Failure Mode Guard Coverage](failure-mode-guard-coverage.md)
- [Guard Activation Readiness](guard-activation-readiness.md)
- [Downstream Enforcement Contract](downstream-enforcement-contract.md)
