# Action Surface Profiler

The Action Surface Profiler is the discovery contract for low-friction Attestor
onboarding. It turns observed shadow events and declared integration surfaces
into a data-minimized inventory of AI action surfaces.

It does not call downstream systems, does not fetch raw customer data, does not
generate policy authority, and does not make execution non-bypassable by itself.
Its job is to tell the customer what must be captured, governed, proxied,
verified, or moved behind a connector before enforcement can be considered.

## Why It Exists

Companies should not need to manually list every AI tool, API route, queue
consumer, MCP tool, workflow, or provider action before Attestor can help.

The profiler answers:

- which action surfaces are already visible in shadow traffic
- which declared surfaces have not been observed yet
- which surfaces look like HTTP write operations, async operations, MCP tools,
  workflow executions, or provider-native actions
- which surfaces still expose direct agent-held credentials
- which surfaces are missing policy, evidence, authority, or adapter readiness
- which integration mode should be evaluated next

## Research Anchors

The profiler follows machine-readable API and workflow description patterns:

- OpenAPI defines API surface through `paths` and operations, with tags and
  operation metadata available for grouping.
- AsyncAPI defines event-driven API behavior through channels, operations, and
  messages.
- Model Context Protocol exposes tool surfaces that agents can discover and
  invoke, so those tool definitions become action surfaces.
- GitHub Actions workflows define jobs and steps that can mutate production
  systems and therefore become operational execution surfaces.
- Provider logs and provider-native connector metadata can reveal actual
  downstream actions, but they remain evidence hints until bound to Attestor
  admission and downstream verification.

External standards are engineering anchors only. They do not certify Attestor or
prove production readiness.

## Inputs

The contract accepts two bounded input classes:

1. Shadow admission events already produced by Attestor.
2. Operator-supplied or generated declarations from OpenAPI, AsyncAPI, MCP tool
   manifests, workflow manifests, provider logs, or manual inventory. The
   [Action Surface Manifest Intake](action-surface-manifest-intake.md) and
   [Action Surface Declaration Ingestors](action-surface-declaration-ingestors.md)
   provide the first repo-side conversion path from bounded JSON/YAML manifest
   text to parsed metadata to profiler-ready declarations.

Declarations may include:

- source kind
- action surface
- domain
- downstream system
- action
- operation reference
- method/path, channel, tool name, or workflow ref
- credential posture
- integration mode hint

They must not include raw prompts, provider response bodies, customer records,
secrets, wallet material, payment details, or private thresholds.

## Output

Each profile includes:

- action surface
- source kinds
- observed event count
- declaration count
- actor count
- first and last seen timestamps
- decision and reason-code counts
- operation refs
- credential posture
- recommended integration mode
- next safe step
- event digests
- declaration digest

The report also carries:

```text
approvalRequired: true
autoEnforce: false
rawPayloadStored: false
productionReady: false
```

## Recommended Modes

The profiler can recommend an integration mode for the next evaluation step:

- `shadow-capture-sdk` for observed-only or early shadow paths
- `gateway-proxy` for OpenAPI write operations
- `mcp-tool-gateway` for MCP tool surfaces
- `sidecar-ext-authz` for workflow or service-mesh style execution surfaces
- `provider-native-connector` for provider-owned delegated execution
- `advisory-api` when only an advisory path is visible

This recommendation is not an enforcement decision. It feeds
[Integration mode readiness](integration-mode-readiness.md), which performs the
bypass-risk, credential-isolation, verifier, replay, and artifact-review checks.

## Safety Boundary

Safe automation:

- parse or ingest declared surface metadata
- group observed shadow traffic by action surface
- identify missing shadow capture
- identify direct credential exposure
- recommend the next integration mode to evaluate
- generate follow-up work for Policy Foundry and Integration Mode Readiness

Approval-gated or prohibited:

- do not activate enforcement
- do not issue or widen credentials
- do not create policy authority from LLM text
- do not store raw payloads or provider bodies
- do not claim production readiness

## Relationship To Existing Surfaces

The profiler is earlier than:

- [Policy Foundry onboarding](policy-foundry-onboarding.md)
- [Integration mode readiness](integration-mode-readiness.md)
- [Downstream enforcement contract](downstream-enforcement-contract.md)
- [Adapter framework](adapter-framework.md)

```text
declared API/tool/workflow surfaces + shadow events
  -> Action Surface Manifest Intake
  -> Action Surface Declaration Ingestors
  -> Action Surface Profiler
  -> Policy Foundry
  -> Integration Mode Readiness
  -> generated verifier/proxy/adapter review
  -> scoped enforcement only after downstream checks close
```

This gives companies a simpler start without weakening Attestor's authority
boundary.
