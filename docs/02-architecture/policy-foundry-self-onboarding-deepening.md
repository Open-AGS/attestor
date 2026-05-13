# Policy Foundry Self-Onboarding Deepening

This tracker covers the next Policy Foundry / self-onboarding deepening track.
The goal is to make Attestor easier to adopt without turning shadow traffic,
LLM text, generated artifacts, or customer self-attestation into production
authority.

The track is research-backed, evidence-driven, and review-gated. Every step must
preserve these boundaries:

- approval is required
- auto-enforcement is false
- raw customer payloads are not stored
- generated artifacts are review material
- non-bypassable claims require downstream verifier or gateway evidence
- production readiness is not claimed from repository-only evidence

## Research Anchors

- AWS IAM Access Analyzer generates policy material from observed CloudTrail
  activity, but the generated policy still needs review and customization.
- Google IAM Recommender uses observed permission usage for recommendations,
  while the customer controls lifecycle and application.
- Cedar and AWS Verified Permissions keep authorization policy schema-bound.
- OPA decision logs and policy tests keep decision evidence separate from
  policy promotion.
- Stripe Connect onboarding and Auth0 progressive profiling ask for currently
  needed information instead of front-loading every field.
- Envoy, Istio, and OPA ext_authz patterns show why downstream enforcement
  needs a verifier/gateway/sidecar control, not only an advisory API call.
- OpenFGA and Zanzibar show why authority relationships matter next to ABAC
  attributes.
- Stripe CLI, OpenAPI Generator, Terraform `plan`, and Kubernetes dry-run
  patterns show that one-command onboarding should render reviewable output,
  not silently apply infrastructure, credentials, or enforcement.
- OWASP session management and API authorization guidance show why hosted
  wizard state must live server-side with TTL expiry and tenant-bound object
  lookup rather than trusting client-held state.
- OPA decision logs, OpenTelemetry signals, NIST AI RMF monitor/manage, and
  IAM Recommender observed-usage recommendations show that outcome feedback
  should be structured scoring input, not automatic authority.
- Stripe entitlement-style feature boundaries, OpenFeature context-bound
  evaluation, and LaunchDarkly progressive rollouts show why commercial access
  should gate plan capabilities and rollout limits without paywalling the
  minimum safety floor.

These sources are engineering anchors only. They do not certify Attestor.

## Step List

| Step | Status | Goal | Output |
|---|---|---|---|
| Step 01 | complete | Add Onboarding Session Contract v1 | Digest-bound session state with requirements-aware blockers, current/eventual requirements, source digests, and explicit non-claims |
| Step 02 | complete | Add Coverage Score v1 | Per-surface coverage for shadow traffic, manifest, evidence, authority, verifier/gateway, credential isolation, and replay/idempotency |
| Step 03 | complete | Add Minimum Viable Gate Planner | Select the smallest reviewed integration path: SDK verifier, gateway proxy, MCP tool gateway, sidecar/ext_authz, or provider connector |
| Step 04 | complete | Add Schema-Bound Candidate Registry | Keep candidate policy generation tied to domain schemas/templates, not LLM threshold authority |
| Step 05 | complete | Add Counterexample Ledger | Track supporting evidence, counterexamples, missing proof, high-risk auto-admits, actor concentration, and replay pressure per candidate |
| Step 06 | complete | Add Policy Twin v2 Summary | Produce a clearer backtest packet for admit/review/block impact, review-load delta, no-go reasons, and rollout recommendation |
| Step 07 | complete | Add Authority Relationship Context | Capture approver, owner, tenant, delegation, and scope context without storing raw customer identity data |
| Step 08 | complete | Add Review-Only Integration Patch Pack | Render SDK/gateway/MCP/sidecar/provider draft patches as review material only |
| Step 09 | complete | Add One-Command Self-Onboarding CLI | Render session, coverage, blockers, patch pack, handoff, and red-team fixtures from customer-owned manifests and shadow data |
| Step 10 | complete | Add Outcome Feedback Loop | Feed reviewed decisions and downstream receipts back into scoring through digest-first, data-minimized signals |
| Step 11 | complete | Add Drift And Policy Debt Detector | Detect new surfaces, stale policies, verifier coverage drift, actor concentration, and policy/shadow mismatch |
| Step 12 | complete | Add Commercial Boundary Contract | Separate evaluation, Starter, Pro, Scale, and Enterprise Foundry capabilities without paywalling safety minimums |
| Step 13 | complete | Add Local Adversarial Replay Executor | Normalize local synthetic replay observations into pass/fail/no-go review material |
| Step 14 | complete | Add Hosted Onboarding Workflow Contract | Model currently due, eventually due, and blocked hosted workflow steps |
| Step 15 | complete | Add Hosted Review Surface | Compact task/no-go/evidence review surface for UI/API rendering |
| Step 16 | complete | Add Hosted UI Flow Renderer | HTML task-list/status/no-go/evidence rendering from the hosted review surface |
| Step 17 | complete | Add Persistent Hosted Wizard State | File-backed evaluation store and tenant-bound resume route for digest-only hosted wizard state |

## Step 01 Scope

Step 01 adds `attestor.policy-foundry-onboarding-session.v1`.

The session contract is the central state object for self-onboarding. It combines
the action-surface onboarding packet, Policy Foundry readiness, active question
packet, red-team replay result, and integration-mode readiness into one
data-minimized status:

```text
intake
-> surface-map
-> requirements
-> active-questions
-> review-packet
-> customer-review
-> scoped-rollout-ready
```

The contract exposes:

- current requirements
- eventual requirements
- satisfied requirements
- source digests
- next safe step
- approval and non-claim invariants

It does not deploy infrastructure, issue credentials, activate enforcement, or
allow a non-bypassable claim.

## Step 02 Scope

Step 02 adds `attestor.policy-foundry-coverage-score.v1`.

The coverage score is a digest-bound, per-surface status object. It translates
the onboarding session, action-surface packet, Policy Foundry readiness,
red-team replay, and integration-mode readiness into coverage dimensions:

```text
action-surface-inventory
shadow-traffic
policy-twin
policy-schema
evidence-binding
authority-binding
verifier-or-gateway
credential-isolation
tenant-boundary
replay-idempotency
red-team-replay
customer-approval
generated-artifact-review
```

The score is onboarding guidance only. A high score can make the next customer
review step clearer, but it does not activate enforcement, prove production
readiness, or allow a non-bypassable claim.

## Step 03 Scope

Step 03 adds `attestor.policy-foundry-gate-planner.v1`.

The gate planner selects the smallest safe next integration path per surface:

```text
shadow-capture-sdk
sdk-gate
gateway-proxy
mcp-tool-gateway
sidecar-ext-authz
provider-native-connector
```

The planner uses coverage status, action-surface onboarding plans, integration
readiness, and review artifact digests. It can name a non-bypassable candidate
path, but it cannot allow a non-bypassable claim. It does not deploy gateways,
issue credentials, activate enforcement, or prove production readiness.

## Step 04 Scope

Step 04 adds `attestor.policy-foundry-candidate-registry.v1`.

The registry binds discovered policy candidates to domain templates and required
schema attributes. It supports built-in platform templates for the core
consequence domains and marks custom domains as `needs-template` until a
customer template exists.

The registry is not a policy-authoring authority. It does not allow LLM text,
private thresholds, or candidate summaries to become threshold authority. Every
registered candidate remains approval-required and non-enforcing.

## Step 05 Scope

Step 05 adds `attestor.policy-foundry-counterexample-ledger.v1`.

The counterexample ledger binds each candidate to digest-only supporting
evidence and promotion blockers:

```text
supporting-evidence
simulation-counterexample
missing-proof
high-risk-auto-admit
actor-concentration
replay-duplicate-pressure
schema-template-gap
red-team-replay-failure
```

The ledger is review material only. It does not resolve the counterexamples,
activate enforcement, store raw shadow payloads, or prove production readiness.

## Step 06 Scope

Step 06 adds `attestor.policy-foundry-policy-twin-summary.v1`.

The Policy Twin v2 summary packages the existing shadow simulation report,
readiness evaluation, and counterexample ledger into a digest-bound backtest
packet:

```text
admit/narrow/review/block counts
admit/narrow/review/block rates
manual-review baseline
review-load delta
no-go reasons
promotion block status
rollout recommendation
```

The summary is decision support only. It does not replace the underlying
simulation report, resolve no-go reasons, activate enforcement, or prove
production readiness.

## Step 07 Scope

Step 07 adds `attestor.policy-foundry-authority-relationship-context.v1`.

The authority relationship context packages customer-controlled relationship
evidence into a digest-only review packet:

```text
owners
approvers
delegates
reviewers
tenant bindings
service-account bindings
scope bindings
evidence digests
missing relation blockers
```

The context is review material only. It does not store raw customer identity
data, replace the customer's identity provider, grant authority, activate
enforcement, or prove production readiness.

## Step 08 Scope

Step 08 adds `attestor.policy-foundry-review-only-patch-pack.v1`.

The review-only patch pack turns generated integration artifacts into a
digest-bound customer review packet:

```text
SDK snippet drafts
verifier helper drafts
gateway proxy config drafts
MCP tool gateway config drafts
sidecar/ext_authz config drafts
provider connector plan drafts
credential isolation drafts
validation fixture drafts
```

The patch pack is review material only. It does not apply patches, deploy
infrastructure, issue credentials, activate enforcement, or prove
non-bypassability.

## Step 09 Scope

Step 09 adds `attestor.policy-foundry-self-onboarding-cli.v1`.

The one-command self-onboarding CLI composes the existing review-gated pieces:

```text
action-surface onboarding packet
onboarding session
coverage score
gate planner
review handoff
synthetic red-team fixtures
review-only patch pack
```

The renderer is exposed as:

```text
npm run policy-foundry:self-onboard
```

It accepts customer-owned manifests, declarations, shadow events, and reviewed
readiness overrides. It writes digest-bound review files for the customer to
inspect. It does not apply patches, deploy infrastructure, issue credentials,
activate enforcement, or prove production readiness.

## Step 10 Scope

Step 10 adds `attestor.policy-foundry-outcome-feedback-loop.v1`.

The outcome feedback loop is the digest-first return path from reviewed
decisions and downstream receipts into Policy Foundry scoring review:

```text
reviewed decision digests
downstream execution receipt digests
-> aggregate outcome signals
-> scoring review input
```

It exposes:

- reviewer agreement rate
- downstream success, failure, and skipped receipt rates
- missing receipt count
- feedback completeness rate
- scoring adjustments for coverage dimensions
- no-go reasons for invalid digests, disagreement, failures, and missing
  receipts

The feedback loop is scoring input only. It does not train a model, mutate
scores automatically, approve a policy, activate enforcement, or prove
production readiness.

## Step 11 Scope

Step 11 adds `attestor.policy-foundry-drift-policy-debt-detector.v1`.

The detector turns existing Foundry evidence into a review-only drift and policy
debt packet:

```text
coverage + gate planner + candidate registry
+ counterexample ledger + Policy Twin summary + outcome feedback
-> drift/debt entries
-> no-go reasons
-> next safe review step
```

It detects:

- new or unregistered action surfaces
- stale Policy Twin windows
- verifier/gateway coverage drift
- actor concentration
- policy/shadow mismatch
- negative outcome feedback
- unbound schema/template candidates
- replay/idempotency debt

It is not an auto-remediation engine. It does not mutate policy, deploy
gateways, activate enforcement, or prove production readiness.

## Step 12 Scope

Step 12 adds `attestor.policy-foundry-commercial-boundary.v1`.

The commercial boundary contract separates plan capabilities from safety
minimums:

```text
Developer / Trial -> evaluation and shadow discovery only
Starter -> one production workflow commercial boundary
Pro -> multiple workflows and collaboration controls
Scale -> higher-volume discovery, custom templates, and drift detection
Enterprise -> customer-operated and regulated deployment boundaries
```

It explicitly keeps safety minimums out of the paywall:

```text
redaction
proof-verification
tenant-isolation
fail-closed-semantics
shadow-never-auto-enforces
approval-required-promotion
deterministic-controls
offline-verifier-access
replay-idempotency-safety
```

The contract is commercial context only. It does not read a billing provider,
enforce hosted entitlements, activate enforcement, or prove production
readiness.

## Step 13 Scope

Step 13 starts the post-list executor track with
`attestor.policy-foundry-adversarial-replay-executor.v1`.

The executor consumes the synthetic red-team fixture bundle plus local replay
observations and emits a digest-bound pass/fail/no-go report:

```text
synthetic fixture bundle
+ local replay observations
-> case results
-> no-go reasons
-> next safe step
```

It is deliberately local and synthetic. It does not call customer
infrastructure, use credentials, mutate downstream systems, execute production
traffic, activate enforcement, or prove production readiness. Production/live
downstream adversarial replay remains a separate unresolved rollout task.

## Step 14 Scope

Step 14 adds `attestor.policy-foundry-hosted-onboarding-workflow.v1`.

The hosted onboarding workflow contract turns the existing review packets into
hosted wizard/API state without implementing the hosted UI or route:

```text
self-onboarding packet
+ local adversarial replay report
+ commercial boundary context
-> currently due steps
-> eventually due steps
-> blocked steps
-> next safe step
```

It separates safe automation from approval-gated and prohibited automation. It
can render current work, prefill from digest-bound sources, and show next safe
steps. It must not apply patches, issue credentials, deploy infrastructure,
execute production traffic, activate enforcement, or make a non-bypassable
claim. The hosted workflow route wrapper exists as stateless review material,
but persistent hosted wizard state and billing-provider entitlement enforcement
remain separate unresolved tasks.

## Step 15 Scope

Step 15 adds `attestor.policy-foundry-hosted-review-surface.v1`.

The hosted review surface turns the hosted onboarding workflow into a compact
UI/API shape:

```text
hosted onboarding workflow
-> headline
-> task cards
-> no-go cards
-> evidence digest cards
-> next safe step
```

It is intentionally smaller than the full packet and avoids raw onboarding
inputs. It does not apply patches, issue credentials, deploy infrastructure,
execute production traffic, activate enforcement, implement the hosted UI, or
prove production readiness. The full digest-bound packet remains required for
implementation review.

## Step 16 Scope

Step 16 adds `attestor.policy-foundry-hosted-ui-flow.v1`.

The hosted UI flow renders the compact hosted review surface into a first HTML
onboarding screen:

```text
hosted review surface
-> status region
-> task list
-> no-go panel
-> evidence digest list
-> automation boundary
```

It renders from the review surface only and does not parse raw customer-owned
manifests, issue credentials, deploy infrastructure, apply patches, execute
production traffic, activate enforcement, persist a hosted wizard state, or
prove production readiness.

## Step 17 Scope

Step 17 adds `attestor.policy-foundry-hosted-wizard-state.v1`.

The persistent hosted wizard state slice stores compact digest-bound workflow
state so a customer can resume the hosted onboarding wizard without resubmitting
or exposing raw manifests:

```text
hosted review surface
+ tenant digest
-> file-backed wizard state
-> tenant-bound resume route
```

It stores session id, workflow digest, review-surface digest, task cards,
no-go cards, evidence digest cards, status, safe next step, created/updated
timestamps, expiry, and a created/updated event trail. It does not store raw
manifests, raw tenant ids, caller session refs, shadow payloads, full packets,
or raw review surfaces. It is local file-backed evaluation persistence only:
shared production wizard storage, deployment wiring, billing-provider
entitlement enforcement, live downstream replay, and production smoke tests
remain separate unresolved tasks.

## Protected Principles

- customer authority
- fail-closed boundary
- data minimization and redaction
- no overclaim
- runtime readiness
- auditability
- operational boundedness

## Verification Expectations

Each implementation step must include:

- a targeted unit test
- `npm run typecheck`
- `npm run typecheck:hygiene`
- relevant docs contract test updates when public claims change

Broader `npm run verify` is required when README, package exports, route
contracts, or shared product positioning are touched.

## Current Status

Step 01 through Step 12 are complete. Step 13 through Step 17 are also complete
repo-side: the repo-side self-onboarding deepening list now includes the local
adversarial replay executor, hosted workflow contract, stateless hosted workflow
route wrapper, compact hosted review surface, hosted UI flow renderer, and
local file-backed persistent hosted wizard state. Live adversarial replay
execution, shared production wizard storage, billing provider entitlement
enforcement, deployment wiring, and production smoke tests remain outside this
tracker.
