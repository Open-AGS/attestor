# Action Surface Onboarding Packet

The Action Surface Onboarding Packet is the first integration plan for a
customer workflow. It combines manifest intake, declaration ingestion, action
surface profiling, review-draft integration artifacts, and integration mode
readiness into one digest-first, review-required packet.

It is not an apply step. It does not deploy gateways, issue credentials,
activate provider connectors, turn on enforcement, or make a production
readiness claim.

## Why It Exists

Attestor should not ask customers to complete a blank policy editor before it
can help. The onboarding packet lets a customer provide shadow events, OpenAPI,
AsyncAPI, MCP tool metadata, workflow metadata, or direct declarations and get
back:

- discovered action surfaces
- recommended integration mode
- review-required SDK/gateway/MCP/sidecar/provider drafts
- credential isolation work
- Policy Twin and red-team replay work
- readiness blockers
- next safe onboarding steps

The packet gives companies a concrete first plan without letting generated
material become authority.

## Research Anchors

These are engineering anchors only. They do not certify Attestor.

- OpenAPI describes paths and operations as machine-readable API inventory.
- Backstage Software Templates show how developer onboarding can start from
  structured templates while still requiring review.
- Terraform `plan` / `apply` keeps execution separate from a generated plan.
  Attestor follows that boundary: the packet is plan material, not apply.
- in-toto style attestations motivate digest-linked subjects and evidence
  chains, but the packet is not an independent supply-chain attestation.

## Input Sources

The packet can consume:

- bounded manifest text through
  [Action Surface Manifest Intake](action-surface-manifest-intake.md)
- direct action surface declarations
- observed shadow admission events
- optional readiness overrides when a customer has already reviewed controls

It must not consume or emit raw prompts, raw payloads, provider bodies, payment
details, wallet material, DB URLs, API keys, private thresholds, or downstream
error bodies.

## Packet Flow

```text
manifest text
  -> declaration ingestors
  -> action surface profiler
  -> integration artifact drafts
  -> integration mode readiness
  -> review-required packet
```

## Local Renderer

The fastest local entry point uses the bundled refund OpenAPI example:

```bash
npm run example:action-surface-onboarding
```

That command renders from
`examples/action-surface-onboarding/refund.openapi.json` and writes the same
review-required packet as the generic renderer.

For customer-owned metadata, pass a manifest directly:

```bash
npm run render:action-surface-onboarding-packet -- --openapi=path/to/openapi.yaml
```

The renderer writes:

- `.attestor/action-surface-onboarding/latest/summary.json`
- `.attestor/action-surface-onboarding/latest/README.md`

It can also accept `--manifest`, `--asyncapi`, `--mcp-tools`, `--workflow`,
`--declarations`, `--shadow-events`, and `--readiness-overrides` inputs. These
inputs let a customer start from files they already have instead of filling a
blank policy editor.

The renderer follows the same plan/apply boundary as the packet itself. It
creates review material only. It does not deploy a gateway, issue credentials,
rotate provider access, record approval, or activate enforcement.

## Hosted API Renderer

Hosted deployments can render the same review packet through:

```http
POST /api/v1/shadow/action-surface/onboarding-packet
```

The route is tenant-scoped by the hosted tenant middleware and returns a
stateless review packet. It does not write `summary.json`, does not persist the
submitted manifest text, and does not activate enforcement. By default, it
combines bounded request manifests or declarations with the authenticated
tenant's stored shadow admission events. A caller can set
`includeShadowEvents: false` when it wants a declaration-only packet.

Minimal hosted request:

```json
{
  "manifests": [
    {
      "manifestKind": "openapi",
      "text": "{\"openapi\":\"3.1.0\",\"info\":{\"title\":\"Refund API\",\"version\":\"1.0.0\"},\"paths\":{\"/refunds\":{\"post\":{\"operationId\":\"issueRefund\",\"responses\":{\"200\":{\"description\":\"ok\"}}}}}}"
    }
  ],
  "defaultDomain": "money-movement",
  "downstreamSystem": "refund-service",
  "credentialPosture": "agent-held-static-secret"
}
```

The response carries:

```text
storageMode: stateless-review-packet
approvalRequired: true
autoEnforce: false
rawPayloadStored: false
productionReady: false
executionPlanOnly: true
deploysInfrastructure: false
issuesCredentials: false
activatesEnforcement: false
```

The hosted route replaces caller-provided manifest source paths with bounded
hosted request references before rendering, so local filenames or private paths
do not become packet evidence.

Every packet carries:

```text
approvalRequired: true
autoEnforce: false
rawPayloadStored: false
productionReady: false
executionPlanOnly: true
deploysInfrastructure: false
issuesCredentials: false
activatesEnforcement: false
nonBypassableClaimAllowed: false
```

## Action Surface Onboarding Review Handoff

`createActionSurfaceOnboardingReviewHandoff()` converts an onboarding packet
into a digest-bound review checklist for the customer-side implementation
conversation. It is still review material, not activation material.

The handoff summarizes:

- source packet digest and status
- per-surface review status
- shadow capture gaps
- generated artifact review status
- credential boundary work
- downstream verifier work
- Policy Twin and red-team replay work
- tenant boundary and customer approval blockers
- remaining no-go reasons and next review steps

The handoff exists so a company does not have to translate a packet into an
implementation checklist by hand. It keeps the same boundary as the packet:
`approvalRequired: true`, `autoEnforce: false`, `rawPayloadStored: false`,
`productionReady: false`, `executionPlanOnly: true`, `deploysInfrastructure:
false`, `issuesCredentials: false`, `activatesEnforcement: false`, and
`nonBypassableClaimAllowed: false`.

It must not be used as proof that a gateway, verifier, credential boundary, or
production route exists. Those remain downstream evidence requirements.

## Action Surface Onboarding Red-Team Fixtures

`createActionSurfaceOnboardingRedTeamFixtureBundle()` converts the same packet
into surface-specific synthetic red-team fixture plans. These fixtures are
generated from action-surface metadata and readiness digests; they do not replay
raw customer payloads, raw prompts, proof URIs, provider bodies, payment
records, wallet material, or private thresholds.

The fixture bundle covers:

- unknown actor
- missing evidence
- missing authority
- duplicate request
- actor burst
- foreign tenant record
- unsafe proof URI
- malicious summary
- high-risk auto-admit
- review-required auto-promote
- direct credential bypass
- missing verifier

The fixtures are synthetic review plans only. They do not execute against
customer infrastructure, do not deploy an enforcement point, do not issue or
rotate credentials, and do not prove production readiness. A passing result
requires a separate reviewed replay or downstream test result that is bound back
to the generated case digests.

## Surface Plan

Each surface plan includes:

- action surface and surface id
- event and declaration counts
- credential posture
- recommended integration mode
- generated artifact kinds and digests
- readiness status and bypass risk
- readiness digest
- missing controls
- no-go reasons
- next onboarding steps

Unknown credential posture is treated conservatively. If Attestor cannot prove
where the executable credential lives, the packet does not treat the surface as
safe.

## Boundary

Safe automation:

- parse bounded manifests
- build the action surface inventory
- generate review drafts
- compute readiness blockers
- produce a digest-first customer packet

Approval-gated:

- reviewing generated artifacts
- selecting production routes, workload selectors, or provider accounts
- rotating or issuing credentials
- recording customer approval
- moving toward scoped enforcement

Prohibited:

- auto-enforcement
- applying gateway/proxy/provider config
- issuing credentials
- treating LLM text as policy authority
- claiming production readiness or non-bypassability from the packet alone

## Relationship To Readiness

The packet includes readiness results, but it does not replace
[Integration Mode Readiness](integration-mode-readiness.md). Readiness can say a
workflow is `scoped-enforce-eligible`; the packet still remains a customer
review artifact. Scoped enforcement requires reviewed downstream controls,
deployment evidence, and customer-controlled activation.
