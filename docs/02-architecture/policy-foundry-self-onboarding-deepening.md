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

These sources are engineering anchors only. They do not certify Attestor.

## Step List

| Step | Status | Goal | Output |
|---|---|---|---|
| Step 01 | complete | Add Onboarding Session Contract v1 | Digest-bound session state with requirements-aware blockers, current/eventual requirements, source digests, and explicit non-claims |
| Step 02 | complete | Add Coverage Score v1 | Per-surface coverage for shadow traffic, manifest, evidence, authority, verifier/gateway, credential isolation, and replay/idempotency |
| Step 03 | complete | Add Minimum Viable Gate Planner | Select the smallest reviewed integration path: SDK verifier, gateway proxy, MCP tool gateway, sidecar/ext_authz, or provider connector |
| Step 04 | not started | Add Schema-Bound Candidate Registry | Keep candidate policy generation tied to domain schemas/templates, not LLM threshold authority |
| Step 05 | not started | Add Counterexample Ledger | Track supporting evidence, counterexamples, missing proof, high-risk auto-admits, actor concentration, and replay pressure per candidate |
| Step 06 | not started | Add Policy Twin v2 Summary | Produce a clearer backtest packet for admit/review/block impact, review-load delta, no-go reasons, and rollout recommendation |
| Step 07 | not started | Add Authority Relationship Context | Capture approver, owner, tenant, delegation, and scope context without storing raw customer identity data |
| Step 08 | not started | Add Review-Only Integration Patch Pack | Render SDK/gateway/MCP/sidecar/provider draft patches as review material only |
| Step 09 | not started | Add One-Command Self-Onboarding CLI | Render session, coverage, blockers, patch pack, handoff, and red-team fixtures from customer-owned manifests and shadow data |
| Step 10 | not started | Add Outcome Feedback Loop | Feed reviewed decisions and downstream receipts back into scoring through digest-first, data-minimized signals |
| Step 11 | not started | Add Drift And Policy Debt Detector | Detect new surfaces, stale policies, verifier coverage drift, actor concentration, and policy/shadow mismatch |
| Step 12 | not started | Add Commercial Boundary Contract | Separate evaluation, Starter, Pro, Scale, and Enterprise Foundry capabilities without paywalling safety minimums |

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

Step 01, Step 02, and Step 03 are complete. Step 04 is the next implementation step. The
rest of the list remains open.
