# Runtime Signal Handling

Runtime signals are controlled metadata, telemetry, proposed-action records, or
enforcement evidence from systems a customer already runs. They help Attestor
locate action surfaces, understand where consequences can form, and identify
missing controls.

They help Attestor see. They do not authorize.

This page defines the boundary for future signal adapter work. It does not
change admission behavior, activate enforcement, deploy a customer gate, or
expand public readiness claims.

## Core Rule

```text
runtime signal -> context
admission + customer-owned gate + proof -> execution path
```

A runtime signal can support review, mapping, and proof packaging. It cannot
grant authority, replace admission, or make a downstream action executable by
itself.

## Signal Kinds

| Kind | Comes from | Can feed | Cannot do |
|---|---|---|---|
| `declaration` | OpenAPI, AsyncAPI, MCP tool schema, workflow metadata, gateway route metadata | action-surface inventory, Auto-Context, Integration Kit review files | prove a live request, approval, or gate |
| `observation` | OpenTelemetry spans, CloudEvents, gateway logs, shadow events | review pressure, missing-control detection, replay analysis | admit, narrow, block, or prove authority |
| `proposed-action` | SDK gate input, tool wrapper input, workflow worker pre-execution intent | admission candidate when tenant, actor, action, scope, evidence, and digest bindings are present | execute without admission and a customer-owned gate |
| `enforcement-proof` | customer PEP, Envoy/Istio/Gateway API authorizer, verifier receipt, replay ledger, downstream receipt, no-bypass probe | proof packet material when bound to the decision, target, body digest, freshness, and replay state | prove production readiness or enterprise readiness |

The four kinds deliberately stay separate. A route declaration, an observed
span, a proposed export, and a PEP receipt are different evidence classes. If
they are merged into one generic "signal", Attestor can create false confidence.

## Source Trust Levels

Signal trust is a ladder, not a permission grant:

- `declared`: a schema, manifest, route, tool, or workflow definition exists.
- `observed`: telemetry, logs, events, or shadow records show activity.
- `authenticated-source`: the producing system or transport identity was
  checked.
- `signed-or-bound`: the signal carries a digest, signature, trace, run, target,
  or body binding.
- `customer-attested`: a customer or operator reviewed the signal source and
  scope.
- `enforcement-proof`: the customer-owned gate, replay, receipt, or no-bypass
  evidence is bound to the action path.

No trust level grants execution authority by itself. Stronger trust only makes
the signal more useful as input to admission, gate verification, or proof
packaging.

## No Raw Data Rule

Runtime signals must use references, digests, and bounded metadata. Public
artifacts, packets, logs, dashboards, and tests must not store or expose raw
prompts, raw tool arguments, raw provider bodies, credentials, private
thresholds, customer identifiers, downstream error bodies, wallet material,
payment details, or raw idempotency keys.

## Existing Attestor Path

Runtime signals stay inside the existing consequence admission engine:

```text
runtime signal
  -> runtime signal handling boundary
  -> Action Surface Auto-Context
  -> Action Surface Onboarding Packet
  -> Integration Kit review files
  -> Integration Mode Readiness
  -> admission, customer gate, and proof work
```

Current repository evidence already keeps this path non-authoritative:

- Action Surface Auto-Context emits observe-mode drafts with
  `canGrantAuthority: false`, `autoEnforce: false`, `activatesEnforcement:
  false`, `rawPayloadStored: false`, and `productionReady: false`.
- Signal extractor contracts are `shadow-only` or `offline-replay`,
  `signals-only`, `readsRawPayload: false`, `grantsAuthority: false`,
  `canAdmit: false`, `autoEnforce: false`, and `productionReady: false`.
- Integration Mode Readiness can identify missing controls and review states,
  but non-bypassable enforcement remains behind customer-owned gate proof.
- The Integration Kit produces review files and probe plans. It does not deploy
  gateways, issue credentials, run probes, activate enforcement, or close
  `LP-CUSTOMER-PEP-NO-BYPASS`.

## Admission Conversion Rule

A signal may become admission material only when it is transformed into a
structured proposed consequence with tenant, actor, action, target, scope,
freshness, evidence, approval, replay, and digest bindings appropriate for the
domain lane.

Even then, the signal does not decide. The admission path decides. The
customer-owned gate enforces. The proof packet records what happened.

## RS02 Minimal Envelope

The repo-side contract lives in
`src/consequence-admission/runtime-signal-envelope.ts` as
`attestor.runtime-signal-envelope.v1`. It stays small and represents a signal
safely before adding business logic:

```text
signalKind
sourceSystem
tenantRefDigest
actorRefDigest
runtimeRef
traceId/runId
eventTime
actionSurface
downstreamSystem
operationRef
inputSchemaDigest
argumentOrBodyDigest
policyRefs
evidenceRefs
approvalRefs
signalDigest
```

The envelope must stay digest-first and review-oriented. It must not grant
authority, reduce admission requirements, activate enforcement, or claim
production readiness. The focused local check is
`npm run test:runtime-signal-envelope`.

## RS03 Source Binding

The repo-side source binding contract lives in
`src/consequence-admission/runtime-signal-source-binding.ts` as
`attestor.runtime-signal-source-binding.v1`. It classifies a signal source as
`unverified`, `authenticated`, `signed`, `customer-attested`, or `pep-proof`
from digest-only binding evidence.

The binding class must match the envelope `sourceTrustLevel`. Signed evidence
must cover the envelope `signalDigest`, and `pep-proof` can only bind an
`enforcement-proof` signal. This contract records source confidence for review
and proof packaging; it still cannot grant authority, admit a consequence,
activate enforcement, or prove production readiness. The focused local check is
`npm run test:runtime-signal-source-binding`.

## Boundaries

- `runtime signal != authority`
- `metadata != proof`
- `telemetry != admission`
- `generated gate plan != deployed gate`
- `PEP receipt != production readiness`

These are separate proof obligations.

## Research Anchors

These sources are engineering anchors only. They do not certify Attestor.

- [OpenAPI 3.1.1](https://spec.openapis.org/oas/v3.1.1.html) describes HTTP
  APIs and operations.
- [AsyncAPI 3.0.0](https://www.asyncapi.com/docs/reference/specification/v3.0.0)
  describes event-driven APIs, channels, messages, and operations.
- [MCP tools](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)
  describe model-invokable tool schemas and tool calls.
- [CloudEvents](https://github.com/cloudevents/spec/blob/main/cloudevents/spec.md)
  describes event metadata such as type, source, subject, and time.
- [OpenTelemetry Logs Data Model](https://opentelemetry.io/docs/specs/otel/logs/data-model/)
  and [W3C Trace Context](https://www.w3.org/TR/trace-context/) anchor logs,
  spans, traces, and cross-system correlation.
- [Envoy ext_authz](https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_filters/ext_authz_filter.html),
  [Istio external authorization](https://istio.io/latest/docs/tasks/security/authorization/authz-custom/),
  and [Gateway API ExternalAuth](https://gateway-api.sigs.k8s.io/geps/gep-1494/)
  are placement anchors for enforcement points.
- [RFC 8785 JSON Canonicalization](https://datatracker.ietf.org/doc/html/rfc8785),
  [RFC 9421 HTTP Message Signatures](https://datatracker.ietf.org/doc/html/rfc9421),
  and [RFC 9449 DPoP](https://datatracker.ietf.org/doc/html/rfc9449) anchor
  canonicalization, message signing, and sender-constrained proof patterns.
- [OWASP GenAI LLM06 Excessive Agency](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/)
  anchors the risk of giving autonomous systems excessive execution ability.
- [NIST SP 800-207 Zero Trust](https://csrc.nist.gov/pubs/sp/800/207/final)
  anchors policy decision and enforcement separation.
- [NIST AI RMF 1.0](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf)
  anchors AI risk management as governed, mapped, measured, and managed work.
