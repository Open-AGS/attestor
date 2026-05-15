# Attestor Language Contract

This document defines the canonical language for describing Attestor as an
infrastructure system. It is a naming and claim-boundary contract, not a
production-readiness claim, not a compliance claim, and not a statement that
every customer workflow is already non-bypassable.

Use this document when updating the README, product pages, architecture docs,
API docs, onboarding docs, pack docs, PR descriptions, or public copy.

## Canonical Category

Attestor is an **AI Action Control Plane**.

Use this as the primary category. It is broad enough to cover policy,
authority, evidence, admission, replay, audit proof, onboarding, hosted review,
and pack-specific extensions without reducing Attestor to a gateway or generic
authorization library.

Canonical sentence:

```text
Attestor controls the boundary between AI intent and real-world consequence.
```

## Canonical Technical Terms

| Term | Use For | Do Not Use As |
| --- | --- | --- |
| AI Action Control Plane | The product category and infrastructure surface | A production-readiness claim |
| Consequence Admission Core | The shared decision core that returns `admit`, `narrow`, `review`, or `block` | A claim that every downstream path is already mediated |
| reference-monitor-style admission | The security target: small, testable, always-on where a real PEP exists | A pure classical reference-monitor claim |
| PEP / enforcement adapter / verifier / gateway | The customer or hosted enforcement point before downstream execution | The whole product category |
| PDP | The policy decision point that evaluates action intent, policy, evidence, authority, scope, freshness, no-go state, and failure-mode controls | A model-quality claim |
| PIP | Evidence, authority, tenant, recipient, freshness, policy-version, no-go, and runtime context providers | An approval source by itself |
| PAP | Policy Foundry, policy lifecycle, simulation, rollout, activation, and policy administration | Auto-enforcement |
| Audit Proof | The bounded proof trail explaining why a consequence was admitted, narrowed, reviewed, or blocked | External certification evidence by itself |
| Failure Mode Registry | The machine-readable list of known AI-action failure modes and their default controls | A generic risk blog or unchecked research note |
| Replay / Conformance Fixtures | Machine-checkable cases proving a control catches dangerous action patterns | Proof that customer production integration is complete |
| Domain Packs | Bounded domain defaults, evidence shapes, adapters, readiness signals, policy templates, and replay examples on the shared core | Separate products or separate decision engines |

## Preferred Public Framing

Use:

```text
AI Action Control Plane for high-risk AI actions.

Attestor controls the boundary between AI intent and real-world consequence.
```

Acceptable supporting language:

- proof before consequence
- admit / narrow / review / block
- policy, authority, evidence, scope, replay, and audit proof before action
- gateway, verifier, or adapter as an enforcement point
- observed-action policy mining for Policy Foundry
- evaluation readiness when describing the repository state

Avoid as the primary label:

- AI governance platform
- prompt checker
- chatbot guardrail
- generic gateway
- agent runtime
- agent workspace
- orchestration layer
- wallet or custody platform
- policy dashboard
- authorization layer as the product category

`authorization` remains valid for specific checks, authority decisions, and
integration details. It should not be the top-level product category because
Attestor also covers evidence, scope, freshness, no-go state, replay,
idempotency, audit proof, Policy Foundry, and pack boundaries.

## Boundary Rules

1. A gateway is a PEP, not the product category.
2. A policy decision is not downstream enforcement.
3. A model answer is not business authority.
4. Untrusted content cannot authorize action.
5. Policy Foundry may suggest and simulate policy candidates, but it must not
   auto-enforce without verified approval, evidence, simulation, and rollout
   gates.
6. Domain packs may add defaults, evidence shapes, policy templates, adapters,
   readiness signals, and replay examples; they must not fork the shared
   decision vocabulary, failure-mode registry, control-binding contract, or
   replay layer.
7. `reference-monitor-style` must be paired with a non-claim: Attestor only
   earns a non-bypassable posture for a workflow when a real enforcement point,
   verifier, gateway, or adapter catches the action before downstream execution
   and the path is tested.
8. Do not describe evaluation, preview, or repository evidence as production
   readiness.

## Infrastructure Analogies

These analogies may guide architecture and copy, but they must stay bounded:

- Istio separates a control plane from data-plane proxies; Attestor should
  describe gateways/verifiers/adapters as enforcement points, not as the whole
  product.
- OPA separates policy decisions from policy enforcement and evaluates
  structured input; Attestor should preserve structured admission requests and
  deterministic decision outputs.
- Kubernetes admission controllers intercept API requests before persistence;
  Attestor intercepts proposed AI actions before business consequence.
- NIST reference-monitor language supports the target of complete mediation,
  tamper resistance, and verifiability, but Attestor should say
  `reference-monitor-style` unless the deployed path proves that property.
- OpenAPI-style contracts, stability labels, and idempotency/replay language
  should be used where Attestor exposes API, schema, proof, or execution
  boundaries.

## Claim Boundaries

Allowed:

- "Attestor is an AI Action Control Plane."
- "Attestor controls the boundary between AI intent and real-world consequence."
- "The current repository provides evaluation-ready contracts, tests, replay
  fixtures, proof surfaces, and package boundaries."
- "A workflow needs a real PEP, gateway, verifier, or adapter before claiming
  non-bypassable enforcement."

Not allowed:

- "Attestor is production-ready" unless deployment, runtime, customer
  enforcement, probes, smoke tests, and operational readiness are verified.
- "Attestor is a certified compliance system."
- "Attestor is a pure reference monitor" without complete mediation proof.
- "Calling the admission API alone makes downstream execution non-bypassable."
- "Policy Foundry learns customer policy and auto-enforces it."
- "Finance, crypto, healthcare, or future packs are separate product lines by
  default."

## Current Migration Notes

Some older docs still use `authorization layer`, `gateway`, or
`consequence gateway` as broad labels. Treat those as migration targets. New
public-facing wording should use **AI Action Control Plane** as the primary
category and reserve gateway/verifier/adapter for enforcement points.

## Research Anchors

- [Istio architecture](https://istio.io/latest/docs/ops/deployment/architecture/)
- [Open Policy Agent documentation](https://www.openpolicyagent.org/docs/latest)
- [Kubernetes admission controllers](https://kubernetes.io/docs/reference/access-authn-authz/admission-controllers/)
- [NIST reference monitor glossary](https://csrc.nist.gov/glossary/term/reference_monitor)
- [NIST SP 800-162 ABAC](https://csrc.nist.gov/pubs/sp/800/162/upd2/final)
- [OpenAPI Specification](https://spec.openapis.org/oas/v3.0.0.html)
- [OpenTelemetry telemetry stability](https://opentelemetry.io/docs/specs/otel/telemetry-stability/)
- [Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests)
