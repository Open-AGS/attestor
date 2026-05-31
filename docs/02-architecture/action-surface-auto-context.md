# Action Surface Auto-Context

Action Surface Auto-Context is the repo-side contract for turning already
available customer metadata into the first Attestor-ready action surface map.

It keeps Attestor as one consequence admission engine. It does not create
finance, crypto, support, or operations products. Those remain domains and
adapters under the same boundary.

## Why It Exists

A customer should not have to hand-write every admission field before Attestor
can help. Auto-context lets Attestor start from metadata a team usually already
has:

- MCP tool definitions or tool calls
- OpenAPI operations
- AsyncAPI operations
- workflow jobs
- OpenTelemetry spans
- CloudEvents metadata
- gateway access logs

The output is a review-required starting point:

- action surface declaration
- digest-only input shape and argument references
- observe-mode generic admission draft
- missing policy, evidence, approval, receipt, credential, and enforcement
  fields
- an onboarding packet handoff through the existing Action Surface Onboarding
  Packet path

## Research Anchors

These are engineering anchors only. They do not certify Attestor or prove a
customer deployment.

- MCP tools expose a `name`, JSON Schema `inputSchema`, optional
  `outputSchema`, and call arguments. That makes MCP the lowest-friction first
  auto-context path.
- OpenAPI describes paths and operations, and specification extensions allow
  `x-` fields. Attestor uses optional `x-attestor` hints only as metadata.
- AsyncAPI v3 separates operations, channels, and messages, which gives event
  workflows a machine-readable starting point.
- OpenTelemetry semantic conventions give consistent HTTP, messaging, GenAI,
  and MCP telemetry labels for discovery.
- CloudEvents uses stable event metadata such as `type`, `source`, and
  `subject`, which can point to an event surface without exposing the event
  payload.
- Envoy `ext_authz` is an enforcement-edge pattern, but a generated config is
  only a draft until deployed and proven fail-closed.

## Flow

```text
MCP / OpenAPI / AsyncAPI / workflow / OTel / CloudEvents / gateway log
  -> Action Surface Auto-Context
  -> action surface declarations
  -> observe-mode generic admission drafts
  -> Action Surface Onboarding Packet
     (surface plan, integration drafts, readiness blockers)
  -> customer review and downstream proof
```

## Optional OpenAPI Hints

The OpenAPI ingestor can read operation-level, path-level, or root-level
`x-attestor` metadata:

```yaml
x-attestor:
  domain: data-disclosure
  downstreamSystem: customer-export-service
  action: export_customer_data
  credentialPosture: gateway-held-secret
  integrationModeHint: gateway-proxy
```

Hints reduce manual cleanup. They do not grant authority, activate policy,
prove a credential boundary, or make a route non-bypassable.

## Safe Automation

Safe automation:

- infer an action surface name from metadata
- hash input schemas and arguments instead of storing raw values
- produce declaration metadata for the profiler
- produce observe-mode generic admission drafts
- list missing policy, evidence, approval, receipt, credential, and enforcement
  fields
- render the existing review-required onboarding packet

Approval-gated:

- accepting a generated declaration as correct
- binding policy, evidence, approval, receipt, and idempotency sources
- selecting a gateway, MCP proxy, SDK gate, sidecar, or provider connector
- reviewing generated integration artifacts
- moving from observe to review or enforce

Prohibited:

- auto-enforce
- grant authority from tool descriptions, telemetry, or model text
- reduce review because a field was inferred
- store raw prompts, raw payloads, tool arguments, provider bodies, secrets, or
  customer records
- claim production readiness or customer PEP no-bypass

## Where This Fits

Start from [How to integrate Attestor](../01-overview/how-to-integrate-attestor.md)
when you need the placement rule. Use this page when the customer already has
metadata and you want Attestor to build the first reviewed surface map.

The primary next document is
[Action Surface Onboarding Packet](action-surface-onboarding-packet.md). It
turns the reviewed map into the customer-facing plan.

Supporting pieces stay inside that path:

- [Action surface declaration ingestors](action-surface-declaration-ingestors.md)
  normalize reviewed metadata.
- [Action surface profiler](action-surface-profiler.md) groups observed and
  declared surfaces.
- [Action surface integration artifacts](action-surface-integration-artifacts.md)
  draft review-only integration material.
- [Integration Mode Readiness](integration-mode-readiness.md) records what is
  still missing before scoped enforcement can be considered.

The boundary stays the same:

```text
auto-context can suggest and digest
review can approve generated material
readiness can show blockers
only customer-controlled downstream proof can move toward scoped enforcement
```
