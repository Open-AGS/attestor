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
