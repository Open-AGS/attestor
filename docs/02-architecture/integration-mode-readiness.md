# Integration Mode Readiness

Integration Mode Readiness classifies how a customer workflow is connected to
Attestor and whether that integration can safely move from shadow traffic toward
scoped enforcement.

It is a machine-readable contract for onboarding friction and bypass risk. It
does not activate enforcement, does not issue credentials, does not replace the
downstream enforcement contract, and does not claim production readiness.

## Why It Exists

`POST /api/v1/admissions` is the common entry point, but an admission response is
not automatically non-bypassable. A customer workflow becomes a gateway only when
the downstream system refuses to act without an admissible Attestor decision and
the agent no longer has a direct path to the same downstream credential.

Integration Mode Readiness answers:

- which integration mode this workflow is using
- whether that mode is enforcement-capable
- whether the agent can still bypass Attestor with a direct credential
- which verifier, proxy, adapter, replay, proof, and approval controls are
  missing
- which generated artifacts are safe to automate
- which actions remain approval-gated or prohibited

## Research Anchors

The contract follows established engineering patterns without claiming that
external systems certify Attestor:

- AWS IAM Access Analyzer and Google IAM Recommender use observed activity to
  recommend least-privilege changes while keeping application control outside the
  recommender.
- Cedar and AWS Verified Permissions use schemas to validate policy shape before
  policy can be trusted.
- OPA decision logs separate policy decisions from masked audit output.
- Envoy `ext_authz`, Istio `CUSTOM` authorization, NGINX `auth_request`, and
  Kubernetes admission controllers show how existing infrastructure delegates
  enforcement to a separate authorization point.
- Vault dynamic secrets, Google downscoped credentials, AWS STS session
  policies, and provider-native delegation show why agents should not hold broad
  long-lived downstream credentials.
- MCP authorization and agent runtime guardrail patterns show why tool execution
  needs a runtime control point rather than prompt-only governance.

## Modes

| Mode | Purpose | Enforcement-capable | Bypass posture |
| --- | --- | --- | --- |
| `advisory-api` | Existing app calls Attestor for advice. | No | Critical if the agent still holds the downstream credential. |
| `shadow-capture-sdk` | Minimal wrapper sends observed action traffic. | No | Useful for discovery, not enforcement. |
| `sdk-gate` | Customer code calls verifier before execution. | Yes | Medium unless the downstream credential is isolated. |
| `gateway-proxy` | A proxy owns the executable downstream path. | Yes | Low when credentials are gateway-held and checks pass. |
| `mcp-tool-gateway` | MCP tool calls pass through Attestor before tool execution. | Yes | Low only if the MCP tool credential is not directly available to the agent. |
| `sidecar-ext-authz` | Mesh/sidecar delegates authorization to Attestor-compatible verifier. | Yes | Low when fail-closed and credential isolation are proven. |
| `provider-native-connector` | Provider connector owns scoped execution. | Yes | Low when provider delegation and replay/idempotency are bound. |

## Required Signals

The readiness evaluator accepts observed signals instead of raw customer
payloads:

- admission call observed
- shadow capture observed
- downstream contract bound
- verifier implemented
- adapter, proxy, MCP gateway, sidecar, or provider connector configured
- presentation binding implemented
- replay protection implemented
- idempotency key required
- tenant boundary proven
- policy simulation available
- customer approval recorded
- red-team replay passed
- generated artifacts reviewed

The output is digest-first and data-minimized. It must not contain raw prompts,
provider bodies, customer identifiers, payment details, wallet material,
credentials, private thresholds, or downstream error bodies.

## Credential Isolation

Credential isolation is the difference between advisory guidance and a practical
gateway.

These postures are supported:

- `agent-held-static-secret`
- `agent-held-scoped-secret`
- `short-lived-downscoped-token`
- `gateway-held-secret`
- `provider-native-delegation`
- `not-required`

If the agent still holds a static or scoped downstream credential, the contract
must report `agent-direct-credential-exposed` and block any non-bypassable claim.

## Automation Boundary

Safe automation:

- discover action surfaces
- generate shadow capture snippets
- generate verifier, proxy, sidecar, MCP, or provider connector configs
- generate credential isolation plans
- run Policy Twin backtests
- run red-team replay fixtures
- open review packets

Approval-gated automation:

- publish a policy candidate
- activate a provider connector
- rotate or issue downstream credentials
- promote a workflow to scoped enforcement

Prohibited automation:

- auto-enforce without customer approval
- expand credential scope
- treat LLM output as policy authority
- store raw payloads or provider bodies
- claim production readiness

The contract exposes `automationSafe`, `approvalRequired`, `autoEnforce`,
`bypassRisk`, `credentialIsolation`, `generatedArtifacts`, and `noGoReasons` so
later onboarding flows can generate helpful artifacts without silently widening
authority.

## Relationship To Policy Foundry

Policy Foundry identifies policy candidates and missing controls from shadow
traffic. Integration Mode Readiness identifies whether the workflow has a safe
path to enforcement.

```text
shadow capture
  -> Policy Foundry candidate and readiness
  -> Integration Mode Readiness
  -> generated adapter/proxy/gateway artifacts
  -> customer review
  -> scoped enforcement only after downstream verification closes
```

This keeps onboarding easy without making Attestor a hallucinating policy writer
or an automatic production switch.

## Relationship To Downstream Enforcement

Integration Mode Readiness does not replace:

- [Downstream enforcement contract](downstream-enforcement-contract.md)
- [Verifier helper](verifier-helper.md)
- [Adapter framework](adapter-framework.md)
- [Downstream presentation binding](downstream-presentation-binding.md)
- [Presentation replay ledger](presentation-replay-ledger.md)
- [Downstream execution receipt](downstream-execution-receipt.md)

It sits above those contracts and decides whether the selected integration mode
has enough evidence to move forward.

If readiness is `scoped-enforce-eligible`, that means the workflow may enter
customer-controlled scoped enforcement review. It still does not mean Attestor is
production-ready, externally audited, or live-deployed.
