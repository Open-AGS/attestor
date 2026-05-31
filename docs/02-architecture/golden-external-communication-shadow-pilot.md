# Golden Path: External Communication

Status: complete. E01-E04 are repository-side only. This is not a live
email, SMS, ticketing, social, CRM, SendGrid, or Mailgun connector, not
customer PEP proof, not compliance certification, not production readiness,
and not enterprise readiness.

## Decision

External Communication is the next pack after Money Movement, Data Movement,
and Authority Change. It keeps the same Attestor consequence grammar, but moves
the example into customer-facing, legal, billing, support, regulated, and
public messages:

```text
AI-prepared outbound message intent
  -> synthetic canonical shadow events
  -> digest-only recipient, message-class, claim-class, approval, policy, replay, and trace refs
  -> admit / narrow / review / block shadow decisions
  -> later Policy Foundry projection, runtime smoke, reviewer sandbox, and demo output
```

Non-split boundary:

```text
Not an email service.
Not a CRM or ticketing system.
Not a support inbox.
Not a marketing automation platform.
Not a legal approval system.
Not a sender, mailbox owner, or delivery provider.
Not a new Attestor mode.
```

The communication domain supplies the example surface; it does not get
independent authority. Every scenario remains shadow-only and review material
until a later customer-controlled PEP/gate consumes an Attestor decision.

## Repository Evidence

| Area | Evidence | State |
|---|---|---|
| External Communication taxonomy | `README.md` lists External Communication as customer-facing, legal, regulated, billing, support, or public messages, and says the pack list is taxonomy, not an equal-maturity claim. | repo-proven |
| Canonical consequence class | `src/consequence-admission/canonical-shadow-event-schema.ts` includes `external-communication` as a canonical shadow-event consequence class. | repo-proven |
| Action-surface inference | `src/consequence-admission/action-surface-declaration-ingestors.ts` maps message, email, ticket, notification, SMS, Slack, and reply language into `external-communication`. | repo-proven |
| E01 fixture contract | `src/consequence-admission/golden-external-communication-shadow-fixtures.ts` emits eight synthetic digest-only canonical shadow events for external communication scenarios. | repo-proven |
| E01 tests | `tests/golden-external-communication-shadow-fixtures.test.ts` locks the suite shape, digest-only canonical events, scenario semantics, no-target-system-call flags, no raw message bodies, no raw recipient identifiers, and no raw customer identifiers. | repo-proven |
| E02 Policy Foundry projection | `src/consequence-admission/golden-external-communication-policy-foundry-projection.ts` projects the E01 suite into review-only Policy Foundry material with named message, recipient, claim, evidence, public-claim, commercial-email, and replay gaps. | repo-proven |
| E02 tests | `tests/golden-external-communication-policy-foundry-projection.test.ts` locks the review-only candidate, decision/gap counts, Policy Twin summary, no-raw-message posture, docs, ledger, and package script alignment. | repo-proven |
| E03 runtime smoke | `src/consequence-admission/golden-external-communication-runtime-smoke.ts` runs all E01/E02 material through the existing R02-R07 shadow runtime smoke chain without provider, delivery, CRM, ticketing, audit-write, policy-activation, or raw-message access. | repo-proven |
| E03 pilot readiness probe | `src/consequence-admission/golden-external-communication-pilot-readiness-probe.ts` wraps the runtime smoke in a shadow-entry readiness packet that can emit only `ready-for-shadow-pilot` or `not-ready`. | repo-proven |
| E03 tests | `tests/golden-external-communication-runtime-smoke.test.ts` and `tests/golden-external-communication-pilot-readiness-probe.test.ts` lock deterministic digests, no-claim flags, data minimization, fail-closed tamper behavior, docs, ledger, and package script alignment. | repo-proven |
| E04 demo CLI | `scripts/demo/demo-golden-external-communication.ts` renders a Markdown-first local External Communication demo with JSON as secondary machine output and a bounded `--scenario` input path under `fixtures/`. | repo-proven once merged |
| E04 reviewer sandbox | `src/consequence-admission/golden-external-communication-reviewer-sandbox.ts` validates a strict JSON allowlist and runs in-scope reviewer inputs through the same shadow-only runtime path without message delivery, provider calls, CRM/ticketing calls, or raw communication material. | repo-proven once merged |

## Research Anchors

FTC commercial-email guidance anchors the idea that outbound commercial email
has sender, content, opt-out, and recipient-control obligations. FTC
endorsement guidance anchors public-facing claim discipline. These are
engineering anchors only, not compliance certification.

- [FTC CAN-SPAM Act: A Compliance Guide for Business](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business)
- [FTC Endorsement Guides](https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides)

SendGrid Sandbox Mode and Mailgun test mode anchor the provider-side pattern
of validating message shape without actually delivering a message. Attestor
uses the same safety idea at the action-control boundary: structure and check
the outbound message intent before any customer-owned delivery provider sends
it.

- [Twilio SendGrid Sandbox Mode](https://www.twilio.com/docs/sendgrid/for-developers/sending-email/sandbox-mode)
- [Mailgun Test Mode](https://documentation.mailgun.com/docs/mailgun/user-manual/sending-messages/test-mode)

NIST AI RMF anchors the broader risk-management vocabulary: map context,
measure risk, manage controls, and govern accountability for AI-enabled system
actions. This is an engineering anchor only, not a NIST conformance claim.

- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)

## E-Series Tracker

Progress after E04 lands: 4/4 complete. 0 steps remain.

| Step | Status | Slice | Evidence target |
|---|---|---|---|
| E01 | complete | External Communication shadow fixture contract | Synthetic digest-only canonical shadow events for support-reply-approved, refund-promise-review, legal-claim-blocked, wrong-recipient-blocked, public-overclaim-narrowing, commercial-email-control-gap, prompt-injection-in-ticket, and duplicate-send-replay-blocked scenarios. |
| E02 | complete | Policy Foundry communication projection | Review-only candidate, named gaps, decision counts, and Policy Twin summary over E01 fixtures. |
| E03 | complete | Runtime smoke and pilot readiness | Run the existing shadow runtime chain over E01/E02 material and emit only `ready-for-shadow-pilot` or `not-ready`. |
| E04 | complete once merged | Demo CLI and reviewer sandbox | Markdown-first local demo plus strict local JSON reviewer input, with no provider calls and no raw message material. |

## E01 Scenario Contract

E01 covers eight fixture-only cases:

```text
support-reply-approved
refund-promise-review
legal-claim-blocked
wrong-recipient-blocked
public-overclaim-narrowing
commercial-email-control-gap
prompt-injection-in-ticket
duplicate-send-replay-blocked
```

Every fixture records:

```text
tenantRefDigest
actorRefDigest
targetAccountRefDigest
channel class
message class
recipient class
claim class
approval freshness
tenant scope
commercial email posture
evidence authority
evidence refs
approval refs
policy refs
replay/idempotency/trace refs
```

Every fixture forbids:

```text
raw message bodies
raw recipient identifiers
raw customer identifiers
raw provider payloads
target-system calls
provider sends
auto enforcement
production readiness claims
```

## E02 Policy Foundry Projection

E02 projects the E01 fixtures into Policy Foundry review material. The
projection emits a review-only candidate for `external_communication.customer_message`,
a Policy Twin summary, decision counts, gap counts, fixture/event digests, and
named gaps.

The review-only candidate binds the same consequence boundary as E01:

```text
AI-prepared outbound message intent
  -> digest-only shadow fixture material
  -> review-only Policy Foundry projection
  -> recipient, tenant, claim, evidence, approval, commercial-email, public-claim, and replay gaps
  -> later runtime smoke and reviewer demo material
```

Named E02 gaps:

```text
outbound-promise-needs-authority
legal-claim-without-authority
recipient-tenant-mismatch
public-claim-overclaim
commercial-email-control-gap
instruction-like-ticket-review
duplicate-send-replay
```

E02 remains review material only. It cannot activate enforcement, mutate
policy, send a message, call SendGrid, Mailgun, a CRM, or a ticketing system,
or prove a customer PEP/gate.

## E03 Runtime Smoke And Pilot Readiness

E03 replays E01/E02 through the existing R02-R07 shadow runtime smoke chain.
It produces digest-only phase references, envelope references, assurance
packet references, final assurance-case references, and lineage-graph
references for every External Communication scenario.

The E03 runtime smoke is deliberately narrow:

```text
E01 digest-only fixture
  -> E02 review-only Policy Foundry projection
  -> R02-R07 shadow runtime smoke chain
  -> E03 runtime digest bundle
  -> E03 shadow-entry readiness packet
```

The readiness probe can emit only:

```text
ready-for-shadow-pilot
not-ready
```

`ready-for-scoped-pilot` is outside E03. That stronger state would require a
customer-controlled PEP/gate, live replay/idempotency proof, provider routing
proof, and operator approval evidence that this repository-side demo does not
claim.

E03 explicitly keeps:

```text
no provider call, no CRM/ticketing call, and no message delivery
no audit write
no policy activation
no learning or training activation
no raw message body read or storage
no raw recipient identifier read or storage
no raw customer identifier read or storage
productionReady=false
activatesEnforcement=false
autoEnforce=false
```

## E04 Demo CLI And Reviewer Sandbox

E04 makes the full External Communication path locally inspectable. The default
output is Markdown for humans and screenshots; JSON is available as secondary
machine-readable material.

Run the demo:

```bash
npm run demo:golden-external-communication
npm run demo:golden-external-communication -- --json
npm run demo:golden-external-communication -- --scenario fixtures/golden-external-communication-reviewer-sandbox.example.json
```

The reviewer sandbox uses Validation discipline from OWASP Input Validation:
only a strict allowlisted local JSON shape is accepted. Unknown fields,
raw-looking fields, non-enum values, and out-of-scope action surfaces are
rejected before the shadow runtime path runs.

The accepted sandbox input is class-based rather than raw-content based:

```text
channel class
message class
recipient class
claim class
approval freshness
tenant scope
commercial email posture
evidence authority
instruction-like evidence flag
public-claim flag
duplicate-send flag
```

The sandbox then emits digest-only canonical shadow events and runs the same
R02-R07 shadow runtime smoke chain as E03. It never sends a message, never calls
SendGrid, Mailgun, a CRM, a ticketing system, a social platform, or an audit
database, and never stores raw message, recipient, or customer identifiers.

## No-Claims

E01-E04 are synthetic shadow evidence only: not production readiness, live
message/ticket/CRM delivery, native communication connector coverage, legal or
support correctness, customer PEP no-bypass proof, automatic policy activation,
or enterprise readiness.
