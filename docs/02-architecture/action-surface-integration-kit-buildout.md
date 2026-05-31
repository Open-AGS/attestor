# Action Surface Integration Kit Buildout

This buildout makes Attestor easier to connect to customer systems without
creating a second product identity. It packages the existing action-surface
path into reviewable files that humans can approve and machines can verify.

It stays inside the same consequence admission engine:

```text
metadata and shadow events
  -> action surface auto-context
  -> action surface onboarding packet
  -> integration kit review files
  -> integration mode readiness
  -> customer-owned gate proof
```

The primary reader path is still
[How to integrate Attestor](../01-overview/how-to-integrate-attestor.md) and
[Action Surface Onboarding Packet](action-surface-onboarding-packet.md). This
page is the buildout contract for the extra files that make that packet easier
for a team to review, wire, and test.

It is not an apply step. It does not deploy gateways, issue credentials,
activate enforcement, or prove customer PEP no-bypass.

## Why It Exists

Teams should not have to design the Attestor gate from scratch. They should be
able to provide metadata they already maintain and get a small, reviewable
integration package:

- what Attestor thinks the action surface is
- where the downstream stop point should sit
- which artifact drafts were generated
- which credential boundary must change
- which no-bypass probes must pass before stronger claims are allowed
- what a human reviewer must approve before anything moves past shadow

The output must be useful to people first, then strict enough for automation.
That means the human page is short and task-oriented, while the machine packet
keeps digests, artifact references, no-claim flags, and probe definitions.

## Current Repo Evidence

Current `origin/master` already has the starting pieces:

- [Action Surface Auto-Context](action-surface-auto-context.md) can turn MCP,
  OpenAPI, AsyncAPI, workflow, OpenTelemetry, CloudEvents, or gateway-log
  metadata into review-required declarations and observe-mode drafts.
- [Action Surface Onboarding Packet](action-surface-onboarding-packet.md)
  combines manifests, profiler output, generated integration artifacts, and
  readiness blockers into one review packet.
- [Action Surface Integration Artifacts](action-surface-integration-artifacts.md)
  generates review-only SDK, verifier, gateway, MCP, sidecar, provider,
  credential isolation, Policy Twin, and red-team replay drafts.
- [Integration Mode Readiness](integration-mode-readiness.md) classifies
  advisory, shadow, SDK, gateway, MCP, sidecar, and provider-native modes
  without allowing production or non-bypassable claims.
- [Human Comprehension Gate](human-comprehension-gate.md) keeps reviewer output
  bounded, ranked, and non-authoritative.

Evidence state: `partial-repo`. These contracts reduce onboarding friction, but
they do not prove live customer enforcement.

## Research Anchors

These are engineering anchors only. They do not certify Attestor.

- [OpenAPI](https://spec.openapis.org/oas/v3.1.1.html) gives humans and tools a
  shared HTTP API description.
- [OpenAPI Overlay](https://spec.openapis.org/overlay/latest.html) can add
  review metadata beside a customer OpenAPI file without rewriting the source
  API document.
- [Arazzo](https://spec.openapis.org/arazzo/latest.html) can later describe
  multi-step API workflows after single-action gates are stable.
- [MCP tools](https://modelcontextprotocol.io/specification/draft/server/tools)
  expose named model-invokable tools and schemas, but the spec also expects a
  human to be able to deny tool invocations.
- [MCP authorization](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization)
  covers HTTP transport authorization; this does not prove a customer tool
  credential is isolated.
- [Gateway API ExternalAuth](https://gateway-api.sigs.k8s.io/geps/gep-1494/),
  [Envoy ext_authz](https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_filters/ext_authz_filter.html),
  and [Istio external authorization](https://istio.io/latest/docs/tasks/security/authorization/authz-custom/)
  are placement anchors for gateway or mesh authorization.
- [Terraform plan](https://developer.hashicorp.com/terraform/cli/commands/plan)
  separates proposed changes from apply. The integration kit follows that
  boundary.
- [GitHub protected reviews and checks](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
  show why approval, stale review, and required-check states need explicit
  status before merge-like promotion.
- [NIST AI RMF human-AI interaction](https://airc.nist.gov/airmf-resources/airmf/appendices/app-c-ai-risk-management-and-human-ai-interaction/)
  anchors explicit human roles and responsibilities.
- [Google SRE practical alerting](https://sre.google/sre-book/practical-alerting/)
  anchors actionable, deduplicated reviewer signals instead of noisy dashboards.

## Output Shape

Each kit should produce one directory per reviewed packet:

```text
.attestor/action-surface-integration-kit/latest/
  README.md
  summary.json
  artifact-manifest.json
  no-bypass-probes.json
  approval-record.template.json
  artifacts/
```

`README.md` is the human entry point. It should fit on one screen for the first
surface and use short decision sections:

- surface and downstream system
- selected integration mode
- credential boundary
- blockers
- generated artifacts
- probes that must pass
- reviewer decision
- next safe step

`summary.json` is the machine entry point. It should carry:

```text
version
generatedAt
sourcePacketDigest
surfaceCount
artifactManifestDigest
noBypassProbePlanDigest
approvalRequired: true
autoEnforce: false
rawPayloadStored: false
productionReady: false
nonBypassableClaimAllowed: false
```

`artifact-manifest.json` lists generated drafts and their digests. It does not
embed raw customer payloads, raw prompts, provider bodies, downstream errors,
credentials, private thresholds, wallet material, or payment details.

`no-bypass-probes.json` lists the proof plan. The plan is not a pass result
until the probes run against a reviewed customer or sandbox stop point.

`approval-record.template.json` shows what a customer reviewer must fill in.
It records review scope and decision; it does not grant authority by itself.

## Machine-Readable Contract

The repo-side packet contract lives in
`src/consequence-admission/action-surface-integration-kit-packet.ts` and is
covered by `npm run test:action-surface-integration-kit-packet`.

The contract composes an existing
`attestor.action-surface-onboarding-packet.v1` packet into:

- `summary` for the machine entry point
- `artifactManifest` for generated artifact ids, kinds, and digests
- `noBypassProbePlan` for customer stop-point probe cases
- `approvalRecordTemplate` for reviewer decision capture
- `reviewFiles` for the planned file names and digests

This is still a contract object, not a renderer. It does not write files,
deploy gateways, issue credentials, run probes, activate enforcement, or prove
customer PEP no-bypass.

## OpenAPI And Gateway Drafts

The first artifact generator lives in
`src/consequence-admission/action-surface-integration-kit-artifact-drafts.ts`
and is covered by
`npm run test:action-surface-integration-kit-artifact-drafts`.

It turns the machine-readable kit packet into:

- an OpenAPI Overlay `1.1.0` draft that adds `x-attestor` review metadata to
  matched HTTP operations
- an Envoy `ext_authz` HTTP filter draft with fail-closed route hints

These drafts are still review material. They do not apply the overlay, deploy
Envoy, configure a gateway, issue credentials, activate enforcement, or prove
that the customer route is non-bypassable.

## MCP Gateway Drafts

The MCP gateway draft contract lives in
`src/consequence-admission/action-surface-integration-kit-mcp-gateway-drafts.ts`
and is covered by
`npm run test:action-surface-integration-kit-mcp-gateway-drafts`.

It turns MCP tool surfaces from the kit packet into review-only tool entries
and credential-isolation checks:

- tool names and input schemas for review
- source artifact digests for each tool
- gateway-held credential target posture
- explicit `agentDirectCredentialAllowed: false`
- `credentialIssued: false` and `credentialRotated: false`

The draft does not run an MCP server, expose tools to an agent, issue or rotate
credentials, trust tool annotations as authority, activate enforcement, or
prove customer PEP no-bypass.

## Human Review Contract

Human review output must be compact, ranked, and role-aware:

| Review item | Human wording | Machine key |
|---|---|---|
| Surface | What action is being gated? | `actionSurface` |
| Mode | Where will the stop point sit? | `integrationMode` |
| Credential | Can the agent bypass Attestor? | `credentialPosture` |
| Blocker | What prevents scoped enforcement? | `noGoReasons` |
| Artifact | What generated file needs review? | `artifactDigests` |
| Probe | What must fail or pass? | `probeCases` |
| Decision | Approve, reject, or hold? | `approvalDecision` |

Rules:

- show the smallest set of decisions the reviewer can act on now
- keep raw customer data out of the review page
- show omitted or lower-priority items as counts, not long lists
- separate `blocked`, `ready-for-review`, and `scoped-rollout-review-ready`
- never convert a reviewer note, LLM summary, or telemetry label into authority
- require a new review when the packet digest, artifact digest, or route scope
  changes

The reviewer page should prefer "what to decide next" over "how Attestor works".
Detailed explanations stay in linked architecture docs.

## Safe Automation

Safe automation:

- read bounded metadata and shadow-event summaries
- generate review-only files
- render OpenAPI Overlay, gateway, MCP, SDK, sidecar, provider, and credential
  isolation drafts
- render no-bypass probe definitions
- compute digests and no-go reasons
- show the next safe review step

Approval-gated:

- accepting generated action-surface declarations
- selecting customer route, workload selector, provider account, or MCP server
- approving a credential isolation change
- approving generated artifacts
- running customer-owned probes against a sandbox or live-like stop point
- preparing scoped rollout review

Prohibited:

- applying infrastructure
- issuing or rotating credentials
- activating enforcement
- widening policy or credential scope
- treating LLM output, telemetry, or generated docs as authority
- claiming production readiness or non-bypassability from generated files

## No-Bypass Probe Plan

Every generated gate candidate must have a probe plan. The initial required
cases are:

| Probe | Expected result |
|---|---|
| direct downstream call without Attestor presentation | fail |
| stale or replayed presentation | fail |
| `narrow` decision executed with the original wider request | fail |
| `review` or `block` decision reaches downstream execution | fail |
| Attestor/verifier unavailable in enforcement mode | fail closed or bounded degraded |
| observe-mode traffic that would have blocked | recorded as would-block only |

The probe plan is `partial-repo` until generated. A probe result becomes useful
only when it is bound back to the packet and artifact digests.

Live customer no-bypass remains `not proven` until `LP-CUSTOMER-PEP-NO-BYPASS`
is captured.

The no-bypass probe bundle contract lives in
`src/consequence-admission/action-surface-integration-kit-no-bypass-probe-bundle.ts`
and is covered by
`npm run test:action-surface-integration-kit-no-bypass-probe-bundle`.

It expands the packet probe plan into review-only probe definitions for SDK,
gateway, sidecar, provider-native, and MCP gateway modes:

- target boundary for the customer stop point
- route or tool references, where the source metadata provides them
- artifact digests that the probe result must bind back to
- required evidence fields for the operator or reviewer
- explicit `safeToAutoRun: false`, `executesProbe: false`, and
  `proofResultRecorded: false`

The bundle does not run probes, deploy a stop point, issue credentials, activate
enforcement, or prove customer PEP no-bypass. It is useful only after a customer
or operator runs the approved probes and records digest-bound evidence.

## Implementation Order

1. Document this buildout path and lock the no-overclaim wording.
2. Add a machine-readable Integration Kit packet contract.
3. Generate OpenAPI Overlay plus gateway or `ext_authz` artifact drafts.
4. Generate MCP tool gateway artifact drafts with credential isolation checks.
5. Generate no-bypass probe bundles for gateway, SDK, and MCP modes.
6. Add a CLI/render entry point that composes scan, generate, and verify-review
   outputs without applying anything.
7. Link the path from the integration docs and examples after the contract is
   covered by tests.

Each step must keep the files review-only until a customer-controlled downstream
gate is deployed and probed.

## Boundaries

This buildout strengthens the single Attestor consequence boundary by making
customer integration review easier and more testable.

It feeds:

- Action Surface Auto-Context
- Action Surface Onboarding Packet
- Action Surface Integration Artifacts
- Integration Mode Readiness
- Customer admission gate proof

It does not have authority to:

- admit, narrow, review, or block by itself
- grant customer authority
- reduce required evidence, review, credential, replay, or tenant controls
- write policy
- activate enforcement
- prove production readiness

If a future slice cannot keep those boundaries, that slice is `blocked` until
redesigned.

## Next Documents

Use [Action Surface Integration Artifacts](action-surface-integration-artifacts.md)
for generated draft types, [Integration Mode Readiness](integration-mode-readiness.md)
for bypass posture, and [Customer admission gate](../01-overview/customer-admission-gate.md)
for the downstream stop point.
