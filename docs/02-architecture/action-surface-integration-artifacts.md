# Action Surface Integration Artifacts

Action Surface Integration Artifacts turn profiler output into review-required
integration drafts for the customer path from discovery toward scoped
enforcement.

They do not deploy infrastructure, do not issue credentials, do not activate
enforcement, do not replace downstream verification, and do not make an action
surface non-bypassable by themselves. They are review drafts only.

## Why It Exists

The common `POST /api/v1/admissions` API is not enough to make Attestor easy to
adopt. Customers also need the next concrete integration artifact for the
surface they already have:

- SDK snippet for advisory or shadow capture
- verifier helper config for customer code gates
- gateway proxy config for HTTP write operations
- MCP tool gateway config for agent tool execution
- sidecar or external authorization config for mesh/workflow boundaries
- provider-native connector plan where provider delegation can own execution
- credential isolation plan
- Policy Twin backtest fixture
- red-team replay fixture

The artifact layer reduces onboarding friction without silently widening
authority. Every artifact carries `requiredReview: true` and every bundle
carries:

```text
approvalRequired: true
autoEnforce: false
rawPayloadStored: false
productionReady: false
nonBypassableClaimAllowed: false
```

## Research Anchors

These are engineering anchors only. They do not certify Attestor and do not
prove production readiness.

- Envoy `ext_authz` shows the pattern of delegating authorization decisions to
  an external authorization service while fail-closed behavior remains an
  explicit deployment concern.
- NGINX `auth_request` shows the HTTP subrequest authorization pattern for
  protecting upstream routes.
- Istio `CUSTOM` authorization and external authorization providers show how a
  mesh can delegate authorization to a separate control point.
- MCP tool gateway and authorization patterns show why agent tool execution
  needs a runtime gateway boundary instead of prompt-only governance.
- Provider-native connector and delegated credential patterns show why the
  executable credential should move away from the agent wherever possible.

## Inputs

The contract consumes `ActionSurfaceProfile` records from the
[Action Surface Profiler](action-surface-profiler.md). It uses only
data-minimized profile fields:

- action surface
- domain
- downstream system
- operation refs
- source kinds
- credential posture
- recommended integration mode

It must not consume raw prompts, raw payloads, provider bodies, customer records,
wallet material, payment details, private thresholds, DB URLs, or secrets.

## Artifact Selection

Artifacts are selected from the profiler's recommended integration mode:

| Mode | Draft artifacts |
| --- | --- |
| `advisory-api` | SDK snippet, Policy Twin backtest |
| `shadow-capture-sdk` | SDK snippet, Policy Twin backtest, red-team replay fixture |
| `sdk-gate` | SDK snippet, verifier helper config, protected adapter skeleton, Policy Twin backtest, red-team replay fixture |
| `gateway-proxy` | gateway proxy config, verifier helper config, credential isolation plan, Policy Twin backtest, red-team replay fixture |
| `mcp-tool-gateway` | MCP tool gateway config, verifier helper config, credential isolation plan, Policy Twin backtest, red-team replay fixture |
| `sidecar-ext-authz` | sidecar/ext-authz config, verifier helper config, credential isolation plan, Policy Twin backtest, red-team replay fixture |
| `provider-native-connector` | provider-native connector plan, verifier helper config, credential isolation plan, Policy Twin backtest, red-team replay fixture |

## Safety Boundary

Safe automation:

- generate a review draft
- bind the draft to a profile digest and artifact digest
- include fail-closed intent in gateway, sidecar, verifier, and MCP templates
- identify credential isolation work
- prepare Policy Twin and red-team replay fixtures

Approval-gated:

- selecting a production route, listener, workload selector, or provider account
- rotating or issuing downstream credentials
- wiring a provider connector
- changing workflow execution authority
- promoting a workflow to scoped enforcement

Prohibited:

- auto-enforce
- credential issuance
- production deployment
- replacing deterministic verifier checks with model judgment
- claiming production readiness
- claiming non-bypassability from generated artifacts alone

## Relationship To Readiness

The artifact bundle feeds [Integration Mode Readiness](integration-mode-readiness.md).
Readiness may only move toward scoped enforcement after the generated artifacts
are reviewed and the downstream verifier, replay, idempotency, tenant boundary,
credential isolation, policy simulation, customer approval, and red-team replay
signals are present.

```text
manifest intake
  -> declaration ingestors
  -> action surface profiler
  -> action surface integration artifacts
  -> action surface onboarding packet
  -> customer review
  -> integration mode readiness
  -> scoped enforcement only if downstream controls close
```

If those controls are missing, the correct result is `not proven` or `no-go`,
not `ready`.
