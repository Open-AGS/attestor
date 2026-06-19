# Policy Foundry Onboarding

Policy Foundry is a platform-core onboarding layer for observed-action policy
mining: it turns customer shadow action traffic into evidence-backed policy
candidates and missing-control findings.

It is not an automatic policy writer, not a model-training promise, not a
production-readiness claim, and not a compliance certification. It exists to
reduce customer setup friction while preserving Attestor's fail-closed,
approval-required consequence boundary.

## Goal

Companies should not need to write a complete policy model before they can see
Attestor's value.

The first useful customer path is:

```text
send shadow traffic
-> profile action surfaces
-> detect policy, evidence, authority, and adapter gaps
-> propose approval-required policy candidates
-> simulate candidates with Policy Twin backtests
-> ask only blocking customer questions
-> require human approval
-> roll out from observe to warn to review to scoped enforce
```

The customer gets useful feedback from real action traffic without letting
shadow mode change production behavior.

The [Action Surface Manifest Intake](action-surface-manifest-intake.md),
[Action Surface Declaration Ingestors](action-surface-declaration-ingestors.md),
[Action Surface Profiler](action-surface-profiler.md),
[Action Surface Integration Artifacts](action-surface-integration-artifacts.md),
and [Action Surface Onboarding Packet](action-surface-onboarding-packet.md)
are the discovery and draft-generation layer before Policy Foundry. Manifest
intake parses bounded JSON/YAML text, the ingestors convert parsed OpenAPI,
AsyncAPI, MCP, and workflow metadata into declarations, the profiler combines
those declarations with observed shadow traffic, and integration artifacts
prepare review-required SDK/gateway/MCP/sidecar/provider drafts. The onboarding
packet binds those outputs and readiness blockers into one customer review plan.
Policy Foundry therefore starts from known action surfaces and reviewed draft
controls instead of a blank policy editor.

## Research Anchors

Detailed source notes live in
[Policy Foundry Onboarding Appendix](policy-foundry-onboarding-appendix.md).
The anchor set includes AWS IAM Access Analyzer, Google IAM Recommender, Cedar
and AWS Verified Permissions, OPA decision logs and policy tests, NIST SP
800-162, ABAC policy-mining research, Stripe onboarding is requirements-aware,
Auth0 progressive profiling, LaunchDarkly and OpenFeature, Zanzibar and
OpenFGA, Terraform, Kubernetes dry-run, OpenTelemetry-style correlated signals,
NIST AI RMF monitor/manage discipline, Terraform plan, Stripe
entitlement-style feature boundaries, OpenFeature context-bound evaluation,
LaunchDarkly progressive rollouts, OWASP session management, and Kubernetes
readiness.

## Core Versus Packs

Policy Foundry belongs in the Attestor platform core, not inside one pack.
Finance and crypto remain packs on the same core, not separate product identities.
The detailed core-versus-pack map lives in
[Policy Foundry Onboarding Appendix](policy-foundry-onboarding-appendix.md).

## Onboarding Loop

### 1. Connect Or Send Shadow Events

The lowest-friction path should accept real shadow events first. The customer
should not need to finish a full policy editor before Attestor can produce the
first action inventory.

### 2. Profile The Action Surface

Attestor groups observed events by tenant, domain, downstream system, action,
actor, mode, decision, reason codes, evidence references, and outcome digests.
Raw prompts, payloads, customer records, wallet material, payment details, and
downstream response bodies must not become onboarding data.

### 3. Match Domain Templates

Policy Foundry should suggest a template class such as refund, data export,
production deploy, permission change, external customer communication,
programmable-money action, or custom domain. Template matching is a hint, not
authority.

### 4. Mine Policy Candidates

Candidates may be suggested from observed traffic and simulation
recommendations. Every candidate must carry:

```text
approvalRequired: true
autoEnforce: false
llmAuthorityAllowed: false
evidenceRequired: true
simulationRequired: true
```

LLM-generated summaries can explain a candidate, but they cannot become policy
authority, evidence verification, threshold authority, or an activation trigger.

External-facing language should avoid saying that Attestor "trains on" or
"learns the company." The safer product claim is:

```text
Attestor identifies policy candidates and missing controls from shadow action
traffic.
```

### 5. Run Policy Twin

Policy Twin replays shadow history against a proposed posture and reports:

- event window and sample size
- admit, narrow, review, and block counts
- review-load impact
- missing policy, evidence, authority, and adapter gaps
- high-risk auto-admit count
- counterexample count
- replay or duplicate pressure
- single-actor concentration
- downstream and human outcome signals

No candidate should move toward enforcement without a simulation result.

### 6. Score Readiness

Policy Foundry confidence is not LLM confidence. It should be computed from
observable control signals:

- sample size
- actor distribution health
- single-actor concentration
- evidence completeness
- authority completeness
- reviewer agreement when human outcomes exist
- counterexample count
- missing-proof rate
- replay or duplicate rate
- policy simplicity
- simulation quality
- red-team replay result

High sample count with low distribution health is not safe. The correct output
is a no-go reason, not a higher confidence score.

### 7. Ask Only Blocking Questions

The active-question engine should use progressive profiling. It should not ask
for every configuration field up front.

Good questions are specific and unblock the next safe step:

```text
Most refund actions are below USD 60, but actions above USD 60 have no stable
review outcome. Choose a review threshold: USD 50, USD 75, or USD 100.
```

Bad questions are broad setup friction:

```text
Define your complete refund policy.
```

The first runtime slice is the active-question packet contract in
`src/consequence-admission/policy-foundry-active-questions.ts`, covered by
`tests/policy-foundry-active-questions.test.ts` and exposed through
`GET /api/v1/shadow/policy-foundry/active-questions`. It consumes the computed
readiness/no-go result, returns only the highest-priority blocking questions,
binds the readiness digest, and stays data-minimized. It does not collect raw
policy thresholds, raw customer identifiers, or private business context.

### 8. Replay Adversarial Cases

Before a candidate can become review-ready or enforce-eligible, run a small
candidate-specific red-team replay set:

- unknown actor
- missing evidence
- foreign tenant record
- duplicate/replayed request
- high amount or high-risk scope
- actor burst
- malicious summary
- unsafe proof URI
- downstream adapter not ready

Failures produce no-go reasons or review-only recommendations.

The first runtime slice is an evidence-replay contract, not a live adversarial
execution engine. It evaluates candidate-specific shadow evidence for policy,
evidence, authority, adapter, tenant, replay, actor-burst, unsafe URI, and
prompt-injection signals without storing or replaying raw prompts, payloads, or
proof URIs.

### 9. Roll Out Gradually

The rollout ladder is:

```text
observe only
warn only
review required
scoped enforce for low-risk only
full enforce
rollback
```

Before any candidate can claim a practical enforcement path, pair the Policy
Foundry readiness result with [Integration Mode Readiness](integration-mode-readiness.md).
That contract checks whether the workflow is only advisory, ready for shadow
capture, or eligible for a reviewed scoped-enforcement path with verifier,
adapter/proxy, credential isolation, replay, idempotency, and generated artifact
review evidence.

Paid production customers should get soft overage behavior, but security gates
must not silently downgrade. If enforcement evidence is incomplete, hold the
consequence rather than converting the failure into advisory text.

## No-Go Conditions

Policy Foundry must refuse enforce recommendations when any of these remain:

- no simulation report
- no customer approval
- missing policy schema
- missing evidence connector or evidence reference coverage
- missing authority binding
- sample size below the configured minimum
- single actor dominates the candidate sample
- high-risk auto-admits appear in backtest
- counterexamples are unresolved
- replay or duplicate pressure is unresolved
- tenant boundary is not proven
- adapter readiness is missing
- red-team replay fails
- LLM text is the only source for a threshold, rule, or explanation

The correct wording is `not enough evidence` or `no-go for enforce`, not
`ready`.

## Commercial Boundary

Policy Foundry should create the free evaluation aha moment, but it should not
be unlimited free production value.

- Trial account entitlement: shadow discovery, action risk inventory, Policy
  Twin preview, readiness/no-go scoring preview, and no production enforcement.
- Pilot Workflow: one selected pack in observe, warn, review-simulation, and
  scoped-rollout-review modes with hosted review surface and audit export.
- Starter Workflow: one customer-gated production workflow with Policy Foundry,
  Policy Twin, active questions, review/enforce ladder, and handoff artifacts.
- Pro Workflow: one advanced workflow with all current hosted packs, candidate
  red-team replay, drift/policy-debt detection, RBAC, SSO, dual-control
  activation, and longer retention.
- Negotiated deployment: customer-operated, dedicated, air-gapped, regulated,
  or custom pack deployment boundaries.

Security minimums stay available across plans: redaction, proof verification,
tenant isolation, fail-closed semantics, and no auto-enforcement from shadow
reads must not become paid-only safety features.

The first repo-side commercial boundary contract lives in
`src/consequence-admission/policy-foundry-commercial-boundary.ts`, is covered by
`tests/policy-foundry-commercial-boundary.test.ts`, and is exposed through
`test:policy-foundry-commercial-boundary`. It maps Trial, Starter, Pro, Scale,
and Enterprise Foundry compatibility capabilities while the billing model maps
self-service paid access to Pilot, Starter Workflow, and Pro Workflow
entitlements. These safety minimums stay out of the paywall:

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

The contract is commercial context only. It does not read Stripe or another
billing provider, enforce hosted entitlements, activate enforcement, or prove
production readiness.

## Readiness Contract

The first runtime slice is the Policy Foundry readiness contract, not a UI
rewrite. It lives in `src/consequence-admission/policy-foundry-readiness.ts`
and is covered by `tests/policy-foundry-readiness.test.ts`.
The hosted read-only route is
`GET /api/v1/shadow/policy-foundry/readiness` and is covered by
`tests/shadow-policy-foundry-readiness-routes.test.ts`.
The candidate-specific red-team replay contract lives in
`src/consequence-admission/policy-foundry-red-team-replay.ts`, is covered by
`tests/policy-foundry-red-team-replay.test.ts`, and is exposed through
`GET /api/v1/shadow/policy-foundry/red-team-replay`.
The readiness route computes the candidate-specific replay result itself and
feeds that computed status into the readiness contract. Clients cannot
self-attest `redTeamReplayStatus`, `customerApproved`, or
`tenantBoundaryProven` through the readiness query because those would turn
no-go controls into caller-supplied evidence. Customer approval must come from
a stored current candidate status, and tenant-boundary proof must come from the
route-owned tenant assertions.

The Onboarding Session Contract is the first central self-onboarding state
object for this path. It lives in
`src/consequence-admission/policy-foundry-onboarding-session.ts`, is covered by
`tests/policy-foundry-onboarding-session.test.ts`, and is exposed through
`test:policy-foundry-onboarding-session`. It combines the action-surface
onboarding packet, Policy Foundry readiness, active question packet, red-team
replay result, and integration-mode readiness into one digest-bound session
with requirements-aware blockers, current requirements, eventual requirements,
source digests, and the next safe step. It does not deploy infrastructure, issue
credentials, activate enforcement, or allow a non-bypassable claim.

The Coverage Score Contract is the first per-surface coverage layer for this
path. It lives in
`src/consequence-admission/policy-foundry-coverage-score.ts`, is covered by
`tests/policy-foundry-coverage-score.test.ts`, and is exposed through
`test:policy-foundry-coverage-score`. It translates the onboarding session,
action-surface packet, Policy Foundry readiness, red-team replay, and
integration-mode readiness into digest-bound coverage dimensions for shadow
traffic, manifest/declaration coverage, Policy Twin, policy schema, evidence,
authority, verifier/gateway, credential isolation, tenant boundary,
replay/idempotency, red-team replay, customer approval, and generated artifact
review. It is onboarding guidance only: it does not activate enforcement, prove
production readiness, or allow a non-bypassable claim.

The Minimum Viable Gate Planner is the first per-surface gate-selection layer
for this path. It lives in
`src/consequence-admission/policy-foundry-gate-planner.ts`, is covered by
`tests/policy-foundry-gate-planner.test.ts`, and is exposed through
`test:policy-foundry-gate-planner`. It consumes the coverage score,
action-surface onboarding packet, and integration-mode readiness to choose the
smallest reviewed next path: shadow capture, SDK gate, gateway proxy, MCP tool
gateway, sidecar/ext_authz, or provider-native connector. It may identify a
non-bypassable candidate path, but it never allows a non-bypassable claim and
does not deploy infrastructure, issue credentials, or activate enforcement.

The Schema-Bound Candidate Registry is the first template binding layer for
candidate policies. It lives in
`src/consequence-admission/policy-foundry-candidate-registry.ts`, is covered by
`tests/policy-foundry-candidate-registry.test.ts`, and is exposed through
`test:policy-foundry-candidate-registry`. It maps discovered candidates to
domain templates and required schema attributes for money movement,
programmable money, data disclosure, authority change, external communication,
regulated filing, system operation, decision support, and custom domains.
Custom domains remain `needs-template` until a customer template exists. LLM
text, summaries, and private thresholds cannot become threshold authority.

The Counterexample Ledger is the first candidate-level promotion blocker ledger
for this path. It lives in
`src/consequence-admission/policy-foundry-counterexample-ledger.ts`, is covered
by `tests/policy-foundry-counterexample-ledger.test.ts`, and is exposed through
`test:policy-foundry-counterexample-ledger`. It records digest-only supporting
evidence, simulation counterexamples, missing proof, high-risk auto-admits,
single-actor concentration, replay pressure, schema/template gaps, and red-team
replay failures per candidate. It is review material only: it does not resolve
the evidence gap, activate enforcement, store raw shadow payloads, or prove
production readiness.

The Policy Twin v2 Summary is the first customer-facing backtest packet for
this path. It lives in
`src/consequence-admission/policy-foundry-policy-twin-summary.ts`, is covered
by `tests/policy-foundry-policy-twin-summary.test.ts`, and is exposed through
`test:policy-foundry-policy-twin-summary`. It packages the shadow simulation,
readiness evaluation, and counterexample ledger into admit/narrow/review/block
rates, manual-review baseline impact, review-load delta, no-go reasons,
promotion block status, and rollout recommendation. It is decision support only:
it does not replace the underlying simulation, resolve blockers, activate
enforcement, or prove production readiness.

The Authority Relationship Context is the first digest-only authority graph
packet for this path. It lives in
`src/consequence-admission/policy-foundry-authority-relationship-context.ts`,
is covered by `tests/policy-foundry-authority-relationship-context.test.ts`,
and is exposed through
`test:policy-foundry-authority-relationship-context`. It records owner,
approver, delegate, reviewer, tenant, service-account, and scope relationships
as digests with evidence digests and no-go reasons. It does not store raw
customer identity data, grant authority, activate enforcement, or prove that a
customer's identity provider is configured correctly.

The Review-Only Integration Patch Pack is the first customer-facing draft patch
packet for this path. It lives in
`src/consequence-admission/policy-foundry-review-only-patch-pack.ts`, is covered
by `tests/policy-foundry-review-only-patch-pack.test.ts`, and is exposed through
`test:policy-foundry-review-only-patch-pack`. It turns generated integration
artifacts into SDK, verifier, gateway, MCP, sidecar/ext_authz, provider
connector, credential-boundary, Policy Twin, and red-team replay review drafts.
It does not apply patches, deploy infrastructure, issue credentials, activate
enforcement, or prove non-bypassability.

The One-Command Self-Onboarding CLI is the first end-to-end local renderer for
this path. Its contract lives in
`src/consequence-admission/policy-foundry-self-onboarding-cli.ts`, the renderer
lives in `scripts/render/render-policy-foundry-self-onboarding.ts`, is covered by
`tests/policy-foundry-self-onboarding-cli.test.ts`, and is exposed through
`npm run policy-foundry:self-onboard` plus
`test:policy-foundry-self-onboarding-cli`. It turns customer-owned manifests,
declarations, shadow events, and reviewed readiness overrides into one
digest-bound packet containing the onboarding packet, onboarding session,
coverage score, gate planner, review handoff, synthetic red-team fixtures, and
review-only patch pack. It writes review material only; it does not apply
patches, deploy infrastructure, issue credentials, activate enforcement, or
prove production readiness.

The Outcome Feedback Loop is the first reviewed-outcome return path for this
track. It lives in
`src/consequence-admission/policy-foundry-outcome-feedback-loop.ts`, is covered
by `tests/policy-foundry-outcome-feedback-loop.test.ts`, and is exposed through
`test:policy-foundry-outcome-feedback-loop`. It accepts reviewed decision
digests and downstream execution receipt digests, then emits aggregate scoring
signals for reviewer agreement, downstream success/failure, skipped receipts,
and missing receipt coverage. It is scoring input only: it does not train a
model, mutate scores automatically, approve policies, activate enforcement, or
prove production readiness.

The Drift And Policy Debt Detector is the first review-only detector for stale
Foundry assumptions. It lives in
`src/consequence-admission/policy-foundry-drift-policy-debt-detector.ts`, is
covered by `tests/policy-foundry-drift-policy-debt-detector.test.ts`, and is
exposed through `test:policy-foundry-drift-policy-debt-detector`. It combines
coverage, gate-planner, candidate-registry, counterexample-ledger, Policy Twin,
and outcome-feedback evidence to detect new surfaces, stale policy windows,
verifier/gateway coverage drift, actor concentration, policy/shadow mismatch,
negative outcome feedback, schema/template debt, and replay/idempotency debt.
It is review material only: it does not mutate policy, deploy infrastructure,
activate enforcement, or prove production readiness.

The Commercial Boundary Contract is the first repo-side plan/capability
boundary for Policy Foundry. It lives in
`src/consequence-admission/policy-foundry-commercial-boundary.ts`, is covered by
`tests/policy-foundry-commercial-boundary.test.ts`, and is exposed through
`test:policy-foundry-commercial-boundary`. It separates evaluation, Starter,
Pro, Scale, and Enterprise Foundry capabilities from non-paywalled safety
minimums. It is not billing-provider state, hosted entitlement enforcement, or
production readiness evidence.

The Policy Foundry Adversarial Replay Executor is the first local/synthetic
adversarial replay executor for this path. It lives in
`src/consequence-admission/policy-foundry-adversarial-replay-executor.ts`, is
covered by `tests/policy-foundry-adversarial-replay-executor.test.ts`, and is
exposed through `test:policy-foundry-adversarial-replay-executor`. It
normalizes synthetic red-team fixture execution observations into a
pass/fail/no-go report. It does not call customer infrastructure, use
credentials, mutate downstream systems, execute production traffic, activate
enforcement, or prove production readiness.

The Policy Foundry Live Downstream Replay contract is the first non-mutating
sandbox/staging replay evidence layer for this path. It lives in
`src/consequence-admission/policy-foundry-live-downstream-replay.ts`, is covered
by `tests/policy-foundry-live-downstream-replay.test.ts`, and is exposed through
`test:policy-foundry-live-downstream-replay`. It normalizes downstream
verifier/gateway replay observations from sandbox, staging, or ephemeral
preview harnesses. It requires dry-run proof digests and verified sandbox
boundaries, fails closed on raw payload storage, credential material, downstream
mutation, production traffic attempts, invalid digests, missing cases, or
unexpected allows, and remains review evidence only. It does not call customer
infrastructure by itself, issue credentials, activate enforcement, deploy
infrastructure, execute production traffic, or prove production readiness.

The Policy Foundry Hosted Onboarding Workflow is the first hosted workflow
contract for this path. It lives in
`src/consequence-admission/policy-foundry-hosted-onboarding-workflow.ts`, is
covered by `tests/policy-foundry-hosted-onboarding-workflow.test.ts`, and is
exposed through `test:policy-foundry-hosted-onboarding-workflow`. It turns the
self-onboarding packet, local adversarial replay report, optional live
downstream replay report, and commercial boundary context into digest-bound
hosted workflow steps: source intake, surface map, active questions, coverage
review, gate plan, adversarial replay, patch review, customer approval, and
scoped rollout review. Failed live downstream replay blocks scoped rollout
review. This is not a hosted UI implementation or hosted route; it is a hosted
workflow contract. It does not deploy infrastructure, issue credentials, apply
patches, execute production traffic, activate enforcement, enforce
billing-provider entitlements, or prove production readiness.

The first hosted route wrapper for that contract is:

```http
POST /api/v1/shadow/policy-foundry/hosted-onboarding-workflow
```

It lives in
`src/service/http/routes/policy-foundry-hosted-onboarding-routes.ts`, is covered
by `tests/policy-foundry-hosted-onboarding-workflow-route.test.ts`, and is
exposed through `test:policy-foundry-hosted-onboarding-workflow-route`. The
route composes bounded manifests, declarations, tenant-scoped shadow events,
optional local replay observations, optional live downstream replay
observations, billing-provider entitlement context, and commercial boundary
context into one stateless review workflow. It returns tenant digests, not raw
tenant ids. When the hosted runtime wires a billing entitlement resolver, the
route uses the billing-provider effective plan rather than any request-body
`commercialPlan` to evaluate commercial capabilities. Live downstream replay
observations remain digest-bound review evidence only; failed sandbox/staging
replay blocks scoped rollout review. The route does not store raw payloads,
issue credentials, apply patches, deploy infrastructure, execute production
traffic, activate enforcement, or prove production readiness.

The compact hosted review surface lives in
`src/consequence-admission/policy-foundry-hosted-review-surface.ts`, is covered
by `tests/policy-foundry-hosted-review-surface.test.ts`, and is exposed through
`test:policy-foundry-hosted-review-surface`. It summarizes the hosted workflow
into UI/API-friendly task cards, no-go cards, evidence digest cards, safe
automations, approval-gated automations, prohibited automations, and one next
safe step. It is intentionally smaller than the full self-onboarding packet: it
does not expose raw source material or raw tenant ids, and it is not enough to
apply implementation changes without the underlying digest-bound packet.

The hosted UI flow renderer lives in `src/service/policy-foundry/policy-foundry-hosted-ui.ts`,
is covered by `tests/policy-foundry-hosted-ui-flow.test.ts`, and is exposed
through `test:policy-foundry-hosted-ui-flow`. The route:

```http
POST /api/v1/shadow/policy-foundry/hosted-onboarding-workflow/view
```

renders the same hosted review surface as HTML. The UI follows a task-list
pattern: current work, no-go conditions, evidence digests, and automation
boundaries are visible without parsing the full packet. Research anchors for
this shape are the NIST AI RMF monitor/manage discipline, OWASP API tenant and
data minimization boundaries, W3C WCAG status-message guidance, and GOV.UK
task-list pages. The renderer does not store raw payloads, issue credentials,
apply patches, deploy infrastructure, execute production traffic, activate
enforcement, or prove production readiness.

The local browser QA preview harness lives in
`scripts/preview/preview-policy-foundry-hosted-ui.ts` and is exposed through
`preview:policy-foundry-hosted-ui`. It renders the same hosted review surface
through a local-only GET route so a reviewer can inspect blocked and ready
states in a real browser before a hosted deployment exists. The renderer now
includes stable `data-testid` anchors, a keyboard skip link, responsive mobile
layout rules, status/alert live regions, and long-text wrapping for evidence
digests. This harness is browser QA only; it does not call customer
infrastructure, issue credentials, deploy infrastructure, execute production
traffic, activate enforcement, or prove production readiness.

The persistent hosted wizard state store lives in
`src/service/policy-foundry/policy-foundry-hosted-wizard-state.ts`, is covered by
`tests/policy-foundry-hosted-wizard-state.test.ts`, and is exposed through
`test:policy-foundry-hosted-wizard-state`. When the hosted workflow route
receives `persistWizardState: true`, it stores only compact digest-bound wizard
state in a local file-backed evaluation store. The resume route is:

```http
GET /api/v1/shadow/policy-foundry/hosted-onboarding-workflow/sessions/:sessionId
```

The session state is tenant-bound by tenant digest, has TTL expiry, keeps an
append-only created/updated event trail, and stores task cards, no-go cards,
evidence digest cards, status, timestamps, and safe instructions. It does not
store raw manifests, raw tenant ids, caller session refs, shadow payloads, or
the full review packet. It is not shared production workflow storage and does
not apply patches, issue credentials, deploy infrastructure, execute production
traffic, activate enforcement, or prove production readiness.
The `production-shared` readiness gate now inventories this wizard state as a
separate storage surface. It remains blocked until the resume state is backed by
shared TTL/session storage rather than the local file-backed evaluation store.

The Policy Foundry production smoke probe lives in
`scripts/probe/probe-policy-foundry-production-smoke.ts`, is covered by
`tests/policy-foundry-production-smoke-probe.test.ts`, and is exposed through
`probe:policy-foundry-production-smoke` and
`test:policy-foundry-production-smoke-probe`. It is an opt-in deployed-runtime
smoke probe for an existing hosted environment with `ATTESTOR_BASE_URL` and
`ATTESTOR_API_KEY`. It checks `/api/v1/health`, `/api/v1/ready`, the hosted
workflow route, the hosted HTML view route, passing live downstream replay
evidence, and failed live downstream replay blocking. It emits digest references
and secret-safe output only. It does not deploy infrastructure, issue
credentials, activate enforcement, execute production traffic, or prove
production readiness.

The hosted billing-provider entitlement enforcement helper lives in
`src/service/policy-foundry/policy-foundry-billing-entitlement-enforcement.ts`, is covered by
`tests/policy-foundry-billing-entitlement-enforcement.test.ts`, and is exposed
through `test:policy-foundry-billing-entitlement-enforcement`. The hosted
workflow route includes its output as `billingEntitlementEnforcement`. That
output gates commercial Foundry plan/capability and production workflow
requests against the hosted billing entitlement read model when the runtime
provides one. It prevents request-body plan elevation, fails closed for
commercial/production requests when billing-provider state is missing or access
is disabled, and keeps safety minimums available. It is not policy authority,
does not activate enforcement, and does not prove deployment readiness.

```text
coverageScore
coverageDimensions
missingDimensions
partialDimensions
nextCoverageStep
gatePlanner
selectedGateMode
requiredGateArtifacts
requiredCustomerWork
candidateRegistry
schemaStatus
templateId
requiredAttributes
counterexampleLedger
promotionBlocked
supportingEvidenceCount
counterexampleCount
missingProofCount
replayDuplicateRate
policyTwinSummary
decisionImpact
reviewLoadImpact
reviewLoadDeltaCount
reviewLoadReductionRate
authorityRelationshipContext
relationshipCount
ownerCount
approverCount
delegateCount
tenantScopeDigest
missingRelations
reviewOnlyPatchPack
patchCount
targetKinds
artifactKinds
reviewMaterialOnly
appliesPatches: false
selfOnboardingCli
selfOnboardingStatus
selfOnboardingBlockers
selfOnboardingOutputFiles
selfOnboardingNextSafeStep
outcomeFeedbackLoop
reviewedDecisionCount
downstreamReceiptCount
reviewerAgreementRate
downstreamSuccessRate
feedbackCompletenessRate
automaticScoreMutationAllowed: false
driftPolicyDebtDetector
driftStatus
driftEntries
driftNoGoReasons
automaticRemediationAllowed: false
commercialBoundary
commercialPlan
allowedCapabilities
unavailableCapabilities
safetyMinimumsPaidOnlyAllowed: false
adversarialReplayExecutor
adversarialReplayStatus
downstreamMutationAllowed: false
credentialUseAllowed: false
executesProductionTraffic: false
localExecutionOnly: true
liveDownstreamReplay
dryRunRequired: true
sandboxOrStagingOnly: true
dryRunProofDigest
downstreamReceiptDigest
hostedOnboardingWorkflow
currentStepIds
eventuallyDueStepIds
blockedStepIds
hostedUiImplemented: false
hostedRouteImplemented: false
deploymentEntitlementEnforcementImplemented: false
hostedReviewSurface
headline
taskCards
noGoCards
evidenceCards
fullPacketRequiredForImplementation: true
hostedUiFlow
viewRoute
taskList
statusRegion
noGoPanel
automationBoundary
rendersFromReviewSurfaceOnly: true
hostedWizardState
sessionId
expiresAt
tenantBoundLookup: true
rawReviewSurfaceStored: false
billingEntitlementEnforcement
enforcementMode
commercialPlanForBoundary
effectiveBillingPlanId
commercialCapabilitiesAllowed
safetyMinimumsRemainAvailable: true
readinessScore
sampleSize
actorDistributionHealth
singleActorConcentration
evidenceCompleteness
authorityCompleteness
counterexampleCount
replayDuplicateRate
simulationQuality
redTeamReplayStatus
activeQuestions
activeQuestionPacket
recommendedRolloutStep
noGoReasons
approvalRequired: true
autoEnforce: false
llmAuthorityAllowed: false
```

That contract can consume the existing shadow simulation, policy discovery
candidate, action risk inventory, and activation readiness surfaces.

Integration Mode Readiness is the companion contract for onboarding automation.
It lives in `src/consequence-admission/integration-mode-readiness.ts` and is
covered by `tests/integration-mode-readiness.test.ts`. It does not activate
enforcement; it classifies bypass risk, credential isolation, generated
artifact review, and the missing verifier/proxy/adapter controls that block a
workflow from moving beyond advisory or shadow mode.

Action Surface Integration Artifacts is the review-draft generator for that
automation path. It lives in
`src/consequence-admission/action-surface-integration-artifacts.ts`, is covered
by `tests/action-surface-integration-artifacts.test.ts`, and generates only
review-required drafts. It does not deploy gateways, issue credentials, activate
provider connectors, or claim production readiness.

Action Surface Onboarding Packet is the first combined customer plan for the
automation path. It lives in
`src/consequence-admission/action-surface-onboarding-packet.ts`, is covered by
`tests/action-surface-onboarding-packet.test.ts`, and composes manifest intake,
profiler, integration artifact, and readiness outputs into a digest-first
review-required packet. It is not an apply step and does not activate
enforcement.

The action-surface review handoff lives in
`src/consequence-admission/action-surface-onboarding-review-handoff.ts`, is
covered by `tests/action-surface-onboarding-review-handoff.test.ts`, and turns
that packet into a digest-bound checklist for shadow capture, generated
artifacts, credential boundary, verifier, Policy Twin, red-team replay, tenant
boundary, and customer approval work. It is review material only.

The action-surface red-team fixture bundle lives in
`src/consequence-admission/action-surface-onboarding-red-team-fixtures.ts`, is
covered by `tests/action-surface-onboarding-red-team-fixtures.test.ts`, and
generates synthetic per-surface cases for unknown actor, missing evidence,
duplicate request, actor burst, foreign tenant, unsafe proof URI, malicious
summary, high-risk auto-admit, review-required auto-promote, direct credential
bypass, and missing verifier paths. It does not execute against customer
infrastructure or prove production readiness.

The local adversarial replay executor consumes that fixture bundle plus
customer-owned local observations and turns the result into review material. It
fails closed on missing case results, unexpected allows, raw payload capture,
credential material use, invalid evidence digests, or downstream mutation
attempts. It is not a production attack runner and does not prove
non-bypassability.

The hosted onboarding workflow contract composes the self-onboarding packet,
local replay report, and commercial boundary into a step model that a hosted UI
or API can render later. It makes currently due versus eventually due work
explicit and keeps safe automations separate from approval-gated or prohibited
automation. The contract does not implement a hosted UI or route by itself; the
stateless route above renders it as review material.

The hosted review surface is the compact API shape that a future hosted UI can
render without parsing every nested packet. It keeps the same review-only
boundary: no patch application, no credential issuance, no infrastructure
deployment, no production traffic, and no enforcement activation.

The hosted UI flow renderer is the first actual HTML rendering of that compact
surface. It is still stateless review material. It renders from the review
surface only, keeps no customer-owned raw payload, and uses status/no-go panels
so a customer can see what blocks onboarding before any implementation step.

## Current Status

Foundations include `src/consequence-admission/action-risk-inventory.ts`,
`src/consequence-admission/policy-discovery-candidates.ts`,
`src/consequence-admission/shadow-simulation.ts`, and
`src/consequence-admission/shadow-activation-readiness-gate.ts`. Policy Foundry production smoke probe for already deployed hosted environments remains opt-in;
`productionStoragePath` still tracks shared hosted wizard storage readiness, and
a smoke probe pass is not a production-readiness claim. The detailed current
status is in
[Policy Foundry Onboarding Appendix](policy-foundry-onboarding-appendix.md),
with the deeper self-onboarding track in
[Policy Foundry Self-Onboarding Deepening](policy-foundry-self-onboarding-deepening.md).
