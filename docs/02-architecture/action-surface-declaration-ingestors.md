# Action Surface Declaration Ingestors

Action Surface Declaration Ingestors convert existing machine-readable customer
metadata into `ActionSurfaceDeclaration` records for the
[Action Surface Profiler](action-surface-profiler.md).

They exist to reduce onboarding friction. A customer should be able to point
Attestor at already-maintained API, event, tool, or workflow metadata and get a
safe starting inventory without manually writing every surface.

The ingestors do not call provider APIs, fetch customer records, issue
credentials, activate policies, or make execution non-bypassable. Their output
is declaration metadata only.

## Supported Inputs

Initial repo-side ingestors support parsed object forms of:

- OpenAPI documents, using `paths`, HTTP operations, `operationId`, tags, and
  method/path metadata.
- AsyncAPI documents, using v3 operations/channels and v2 channel
  publish/subscribe operations.
- MCP tool manifests, using tool names as model-invokable action surfaces.
- GitHub Actions-style workflow manifests, using jobs as operational execution
  surfaces.

The [Action Surface Manifest Intake](action-surface-manifest-intake.md) layer
provides the JSON/YAML text parsing step before these ingestors. Live provider
discovery remains outside this contract.

## Normalized Output

Each ingestor returns:

```text
version
sourceKind
sourceRef
declarationCount
skippedCount
warnings
declarations
approvalRequired: true
autoEnforce: false
rawPayloadStored: false
productionReady: false
digest
```

Each declaration may include:

- source kind
- action surface
- inferred or supplied domain
- downstream system
- normalized action
- method/path, channel, tool name, or workflow ref
- credential posture
- integration mode hint

The ingestors do not serialize operation descriptions, workflow step bodies,
provider payloads, MCP tool schemas, secret names, raw prompts, private
thresholds, or customer records.

## Domain Inference

The domain inference is deterministic and conservative. It uses operation names,
paths, channels, tool names, job ids, and tags to map obvious surfaces such as:

- refunds, payments, payouts, charges -> `money-movement`
- exports, reports, customer data, warehouse queries -> `data-disclosure`
- wallets, tokens, transactions, custody -> `programmable-money`
- deploys, releases, secret rotation, incidents -> `system-operation`
- roles, permissions, entitlements, account access -> `authority-change`
- notifications, messages, tickets -> `external-communication`
- filings, tax, legal, regulatory disclosures -> `regulated-filing`

Unknown surfaces fall back to an explicit caller default or `custom`. That is a
safe starting point, not policy authority.

## Research Anchors

The implementation follows established metadata shapes:

- OpenAPI documents describe API paths and operations.
- AsyncAPI v3 separates channels, operations, and messages; v2 channel
  operations are still handled for migration compatibility.
- MCP exposes named tools that models can discover and invoke.
- GitHub Actions workflows are made of jobs and steps, and job permissions shape
  the operational credential boundary.

External standards are engineering anchors only. They do not certify Attestor,
prove customer readiness, or replace downstream enforcement.

## Safety Boundary

Safe automation:

- parse already-provided metadata
- normalize action surface names
- infer obvious consequence domains
- mark direct workflow secret references as credential-risk signals
- produce profiler-ready declarations

Still required:

- customer review of generated declarations
- shadow capture on real traffic
- Policy Foundry simulation
- Integration Mode Readiness checks
- verifier/proxy/adapter review before any enforcement claim

## Relationship To The Onboarding Flow

```text
OpenAPI / AsyncAPI / MCP / workflow JSON/YAML text
  -> Action Surface Manifest Intake
  -> parsed metadata
  -> Action Surface Declaration Ingestors
  -> Action Surface Profiler
  -> Policy Foundry
  -> Integration Mode Readiness
  -> reviewed verifier/proxy/adapter work
```

This keeps the first customer step small while preserving Attestor's rule:
metadata may suggest a surface, but only evidence, simulation, approval, and
downstream controls can move it toward enforcement.
