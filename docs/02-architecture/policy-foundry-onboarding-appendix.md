# Policy Foundry Onboarding Appendix

This appendix keeps the detailed source anchors, core-versus-pack framing, and
status narrative for [Policy Foundry Onboarding](policy-foundry-onboarding.md).

## Research Anchors

The design follows established patterns, but does not claim that any external
standard certifies Attestor:

- AWS IAM Access Analyzer generates policy material from observed CloudTrail
  activity, then expects review and customization before use:
  https://docs.aws.amazon.com/IAM/latest/UserGuide/access-analyzer-policy-generation.html
- Google IAM Recommender uses observed permission usage to recommend changes,
  while keeping lifecycle and application control outside the recommender:
  https://docs.cloud.google.com/policy-intelligence/docs/role-recommendations-overview
- Cedar and AWS Verified Permissions keep authorization policy schema-bound:
  https://docs.cedarpolicy.com/policies/validation.html and
  https://docs.aws.amazon.com/verifiedpermissions/latest/userguide/schema.html
- OPA decision logs and policy tests separate decision evidence from policy
  promotion:
  https://www.openpolicyagent.org/docs/management-decision-logs and
  https://www.openpolicyagent.org/docs/latest/policy-testing/
- NIST SP 800-162 describes ABAC in terms of subject, object, operation, and
  environmental attributes:
  https://csrc.nist.gov/pubs/sp/800/162/upd2/final
- ABAC policy-mining research supports extracting candidate policies from logs,
  but only as reviewed policy material:
  https://arxiv.org/abs/1403.5715
- Stripe onboarding is requirements-aware and can collect only currently due
  information before expanding the flow:
  https://docs.stripe.com/connect/onboarding
- Auth0 progressive profiling collects extra information only when relevant:
  https://auth0.com/docs/manage-users/user-accounts/user-profiles/progressive-profiling
- LaunchDarkly and OpenFeature model progressive rollout through context-bound
  evaluation rather than one-shot activation:
  https://launchdarkly.com/docs/home/releases/progressive-rollouts and
  https://openfeature.dev/docs/reference/concepts/evaluation-context
- Zanzibar and OpenFGA show why relationship context matters next to ABAC:
  https://research.google/pubs/zanzibar-googles-consistent-global-authorization-system/
  and https://openfga.dev/docs/concepts
- One-command onboarding should preserve a preview/review boundary rather than
  applying changes directly. The CLI design follows the same separation used by
  Stripe CLI local tooling, OpenAPI Generator output generation, Terraform
  `plan`, and Kubernetes dry-run/server-side apply:
  https://docs.stripe.com/stripe-cli,
  https://openapi-generator.tech/docs/usage,
  https://developer.hashicorp.com/terraform/cli/commands/plan, and
  https://kubernetes.io/docs/reference/kubectl/generated/kubectl_apply/
- Outcome feedback should remain structured telemetry and recommendation input,
  not policy authority. The feedback loop follows OPA decision-log separation,
  OpenTelemetry-style correlated signals, NIST AI RMF monitor/manage discipline,
  and IAM Recommender-style observed-usage recommendations:
  https://www.openpolicyagent.org/docs/management-decision-logs,
  https://opentelemetry.io/docs/concepts/signals/,
  https://www.nist.gov/itl/ai-risk-management-framework, and
  https://docs.cloud.google.com/policy-intelligence/docs/role-recommendations-overview
- Drift detection follows preview-before-change discipline. Terraform plan
  drift detection and policy-access analyzers are engineering anchors for
  comparing declared/reviewed posture to observed usage before any customer
  action:
  https://developer.hashicorp.com/terraform/cli/commands/plan and
  https://docs.aws.amazon.com/IAM/latest/UserGuide/access-analyzer-policy-generation.html
- Commercial entitlements should govern product capabilities and limits, not
  the safety floor itself. Stripe entitlement-style feature boundaries,
  OpenFeature context-bound evaluation, and LaunchDarkly progressive rollouts
  are engineering anchors for separating plan access from runtime safety
  invariants:
  https://docs.stripe.com/billing/entitlements,
  https://openfeature.dev/docs/reference/concepts/evaluation-context, and
  https://launchdarkly.com/docs/home/releases/progressive-rollouts
- Hosted wizard resume state should be server-side, tenant-bound, TTL-limited,
  and visible to readiness. OWASP session management and Kubernetes readiness
  guidance are engineering anchors for keeping that state out of client-held
  authority and exposing missing shared storage as a runtime blocker:
  https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
  and https://kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/

## Core Versus Packs

Policy Foundry belongs in the Attestor platform core, not inside one pack.

```text
Attestor platform core:
  action surface profiler
  policy candidate discovery
  Policy Twin backtest
  readiness and no-go scoring
  active-question engine
  red-team replay suite
  rollout ladder
  audit and proof export

Consequence packs:
  finance templates
  crypto templates
  healthcare templates
  custom domain templates
  pack-specific evidence and authority hints
```

The core identifies controlled-consequence patterns from observed action
traffic. Packs provide domain schemas and templates. Finance and crypto remain
packs on the same core, not separate product identities.

## Current Status

Repository foundations already exist in:

- `src/consequence-admission/action-risk-inventory.ts`
- `src/consequence-admission/policy-discovery-candidates.ts`
- `src/consequence-admission/shadow-simulation.ts`
- `src/consequence-admission/shadow-activation-readiness-gate.ts`

Policy Foundry as described here is not fully implemented as a hosted product
workflow. The current repo-side system has shadow events, action risk
inventory, policy discovery candidates, simulation reports, promotion drafts,
activation readiness gates, readiness/no-go routes, candidate-specific evidence
replay, active questions, action-surface review handoff, synthetic onboarding
red-team fixture generation, onboarding session, coverage score, gate planner,
candidate registry, counterexample ledger, Policy Twin v2 summary, authority
relationship context, review-only patch pack, one-command self-onboarding CLI,
outcome feedback loop, drift/policy-debt detector, and the commercial boundary
contract. It now has the first local/synthetic adversarial replay executor. It
now also has the first hosted onboarding workflow contract, the first stateless
hosted workflow route wrapper for review material, the first compact hosted
review surface for UI/API rendering, and the first hosted UI flow renderer for
that surface with a local browser QA preview harness. It also has a local
file-backed evaluation store for persistent
hosted wizard state and tenant-bound resume, plus route-level
billing-provider entitlement enforcement for hosted Foundry commercial
capability and production workflow requests and non-mutating live downstream
replay evidence for sandbox/staging harnesses. It also has an opt-in
Policy Foundry production smoke probe for already deployed hosted environments.
Shared production wizard storage is now explicitly tracked as a
`productionStoragePath` blocker, but the shared implementation is still not
present. Production traffic execution and production rollout automation also
remain outside this track, and a smoke probe pass is not a production-readiness
claim.
The deeper self-onboarding track is tracked in
[Policy Foundry Self-Onboarding Deepening](policy-foundry-self-onboarding-deepening.md).
