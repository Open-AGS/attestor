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

## RS04 Normalizer Layer

The repo-side normalizer contract lives in
`src/consequence-admission/runtime-signal-normalizer.ts` as
`attestor.runtime-signal-normalizer.v1`. It maps controlled metadata from MCP
tools, OpenAPI operations, AsyncAPI operations, CloudEvents events, and
OpenTelemetry logs into the RS02 envelope.

Declaration sources become `declaration` signals with `declared` trust.
CloudEvents and OpenTelemetry sources become `observation` signals with
`observed` trust. The normalizer records a digest of the source input it used,
but it does not store raw payloads, tool arguments, prompts, provider bodies, or
customer identifiers.

The normalizer cannot grant authority, admit a consequence, activate
enforcement, or prove production readiness. The focused local check is
`npm run test:runtime-signal-normalizer`.

## RS05 Consequence Mapping

The repo-side consequence mapping contract lives in
`src/consequence-admission/runtime-signal-consequence-mapping.ts` as
`attestor.runtime-signal-consequence-mapping.v1`. It turns an RS02 envelope
into a review-only consequence candidate using existing Attestor consequence
classes and action-risk vocabulary.

The mapper records the apparent action surface, consequence class, missing
controls, risk signals, and next review step. It does not admit the action,
create a gate plan, consume proof, activate enforcement, or mark anything safe.
`enforcement-proof` signals stay out of this mapper and belong to proof intake.
The focused local check is `npm run test:runtime-signal-consequence-mapping`.

## RS06 Auto-Context Bridge

The repo-side Auto-Context bridge lives in
`src/consequence-admission/action-surface-auto-context.ts` as
`attestor.action-surface-runtime-signal-bridge.v1`. It accepts RS02 runtime
signal envelopes and feeds them into the existing Action Surface Auto-Context
path.

The bridge preserves digest references from the envelope and returns the
existing `attestor.action-surface-auto-context.v1` result. It does not create a
parallel mapper, grant authority, admit a consequence, deploy a gate, or prove
source-system authenticity. The focused local check is
`npm run test:action-surface-auto-context`.

## RS07 Signal Authority Guard

The repo-side signal authority guard lives in
`src/consequence-admission/runtime-signal-authority-guard.ts` as
`attestor.runtime-signal-authority-guard.v1`. It is a fail-closed invariant
check for runtime-signal-derived outputs.

The guard enforces that observation cannot admit, telemetry cannot grant
authority, metadata cannot mark an action safe, and measurement output cannot
activate enforcement. It is used by the consequence mapper and the Auto-Context
bridge. It still does not decide, deploy a gate, consume proof, or prove
production readiness. The focused local check is
`npm run test:runtime-signal-authority-guard`.

## RS08 Integration Readiness Bridge

The repo-side integration readiness bridge lives in
`src/consequence-admission/runtime-signal-integration-readiness-bridge.ts` as
`attestor.runtime-signal-integration-readiness-bridge.v1`. It feeds RS02
envelopes and RS05 candidates into the existing Integration Mode Readiness
evaluator.

The bridge can infer review placement such as advisory, shadow capture, SDK
gate, HTTP gateway proxy, MCP tool gateway, sidecar external authorization, or
provider-native connector. It cannot infer credential isolation from a signal,
claim no-bypass from metadata, deploy a gate, consume proof, or activate
enforcement. Runtime signals can suggest where a gate belongs; explicit
customer-controlled evidence still has to prove the gate, credential posture,
presentation binding, replay protection, approval, and reviewed artifacts. The
focused local check is
`npm run test:runtime-signal-integration-readiness-bridge`.

## RS09 Review Packet

The repo-side review packet lives in
`src/consequence-admission/runtime-signal-review-packet.ts` as
`attestor.runtime-signal-review-packet.v1`. It turns an RS02 envelope, RS05
candidate, and RS08 readiness bridge into a short human review packet.

The packet shows four things: what action is forming, what consequence class it
maps to, what controls or evidence are still missing, and where the customer
gate belongs. It remains digest-first review material. It cannot admit,
authorize, deploy a gate, consume proof, activate enforcement, or prove
production readiness. The focused local check is
`npm run test:runtime-signal-review-packet`.

## RS10 Proof Intake

The repo-side proof intake contract lives in
`src/consequence-admission/runtime-signal-proof-intake.ts` as
`attestor.runtime-signal-proof-intake.v1`. It accepts only RS02
`enforcement-proof` signals with `enforcement-proof` trust.

The intake classifies PEP, customer-gate, no-bypass probe, replay-ledger,
release-enforcement, and downstream receipt signals as digest-only proof packet
material when tenant, actor, runtime correlation, action surface, downstream
system, operation, schema, body digest, and proof evidence refs are present.
It cannot admit, grant authority, deploy a gate, externally verify receipt
bytes, activate enforcement, or prove production readiness. The focused local
check is `npm run test:runtime-signal-proof-intake`.

## RS11 Public Package Surface

The runtime signal contracts are exposed through the stable
`attestor/consequence-admission` package subpath and the curated
`src/consequence-admission/public-surface.ts` catalogue. Individual runtime
signal deep module paths remain private package internals.

The public surface includes only stable contract pieces: versions, descriptors,
type contracts, and pure builders or mappers. It does not expose a separate
runtime-signal product surface, promise public npm availability, freeze the
internal file layout, wire a live route, activate enforcement, or prove
production readiness. The focused local check is
`npm run test:runtime-signal-public-surface`; the package-level check is
`npm run test:consequence-admission-package-surface` after build.

## RS12 Example Path

The local example lives in
`examples/runtime-signal-path/metadata-to-gate-plan.ts` as
`attestor.runtime-signal-example-path.v1`. It shows OpenAPI/MCP/OpenTelemetry
metadata moving through the existing RS04 normalizer, RS05 consequence mapper,
and RS08 integration readiness bridge.

The example produces digest-only review material: signal digest, consequence
candidate digest, apparent consequence class, recommended next step, and
gate/readiness placement. It does not create an admission request, deploy a
gate, consume proof, activate enforcement, wire a live route, or prove
production readiness. The focused local check is
`npm run test:runtime-signal-example-path`.

## Boundaries

- `runtime signal != authority`
- `metadata != proof`
- `telemetry != admission`
- `generated gate plan != deployed gate`
- `PEP receipt != production readiness`
- `proof intake material != external verification`
- `public contract surface != deep internal module path`
- `example path != live run`

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
- [OPA decision logs](https://www.openpolicyagent.org/docs/management-decision-logs)
  anchor decisions as logged evidence, including masking sensitive fields.
- [Kubernetes admission control](https://kubernetes.io/docs/reference/access-authn-authz/admission-controllers/)
  anchors the pattern that admission happens before mutation, not inside
  passive telemetry.
- [NIST AI RMF 1.0](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf)
  anchors AI risk management as governed, mapped, measured, and managed work.
- [Google SRE alerting guidance](https://sre.google/sre-book/monitoring-distributed-systems/)
  anchors review packets and alerts as actionable human work, not passive noise.
- [GitHub branch protection documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
  anchors required checks and reviews as explicit gates before merge.
- [Terraform plan and apply](https://developer.hashicorp.com/terraform/cli/commands/plan)
  anchors the review-before-change pattern: show intended changes before
  applying them.
- [Node.js package exports](https://nodejs.org/api/packages.html#exports),
  [TypeScript module resolution](https://www.typescriptlang.org/tsconfig/#moduleResolution),
  and [npm package.json exports](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#exports)
  anchor package entrypoint encapsulation and public import boundaries.
