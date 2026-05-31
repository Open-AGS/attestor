# Consequence Envelope Contract

Status: Step 01 repo-side contract. This is a types-only shape for the
Consequence Runtime Assurance sequence. It is not runtime behavior, not
fusion, not learning, not policy activation, and not production readiness.

## Decision

The Consequence Envelope is the first typed boundary before the Signal
Relationship Fabric. It turns a proposed action into a digest-only,
context-rich object that downstream assurance layers can inspect without
receiving raw prompts, provider bodies, customer identifiers, wallet material,
payment details, private thresholds, or downstream response bodies.

The exported version is:

```text
attestor.consequence-envelope-contract.v1
```

The package exports:

```text
ConsequenceEnvelopeContract
consequenceEnvelopeContractDescriptor()
```

## Runtime Contract

The envelope describes a proposed consequence. It does not decide whether the
consequence may run. Invariants:

```text
grantsAuthority = false
activatesEnforcement = false
autoEnforce = false
productionReady = false
```

Any future relationship, fusion, review, or enforcement layer must treat the
envelope as input evidence, not as approval.

## Required Shape

Every envelope has these required fields:

```text
sourceEventRef
canonicalActionType
consequenceClass
reversibilityClass
blastRadiusEstimate
tenantContext
actorContext
timingContext
priorChain
evidenceRefs
authorityRefs
policyScope
targetSystemRef
rawMaterialBoundary
```

The shape is intentionally explicit. STPA treats unsafe control actions as
context-dependent, so the action alone is not enough. The envelope carries the
context needed for later layers to reason about timing, authority, tenant
history, blast radius, reversibility, prior chain, and evidence coverage.

## Consequence Dimensions

The contract records the first-order dimensions needed before relationship
activation:

| Dimension | Value set |
|---|---|
| action type source | action-surface-graph, domain-consequence-recipe, integration-declaration, operator-registered |
| consequence class | financial, data-movement, authority-change, external-communication, operational-execution, programmable-money, health-claims, unknown |
| reversibility | reversible, bounded, irreversible |
| blast radius | single, tenant, cross-tenant, systemic |
| tenant maturity | new, shadow-observed, pilot, production-shared, mature |
| history depth | none, low, medium, high |
| actor authority | none, observed, delegated, reviewer-approved, system-owner, break-glass |
| freshness | fresh, expiring, stale, unknown |
| prior chain relationship | same-actor, same-resource, same-target-system, same-counterparty, authority-predecessor, replay-related, operator-linked |

These are contract values, not model judgments. Later layers may use them as
modulators, but they cannot override a hard deny or grant authority.

## Digest-Only Boundary

References are digest-bound:

```text
tenant
actor
target-system
action-type-registry
resource
counterparty
policy-bundle
policy-scope
evidence
authority
approval
receipt
shadow-event
trace
schema
runbook
```

The raw material policy is limited to:

```text
digest-only
redacted-summary
```

The descriptor keeps all raw-storage flags false:

```text
rawPayloadStored = false
rawPromptStored = false
rawToolPayloadStored = false
rawProviderBodyStored = false
rawCustomerIdentifierStored = false
rawTenantIdentifierStored = false
rawWalletMaterialStored = false
rawPaymentDetailStored = false
rawDownstreamBodyStored = false
rawPrivateThresholdStored = false
```

## How This Helps Foundry

The envelope gives shadow mode and Policy Foundry a stable intake shape:

```text
shadow event
  -> consequence envelope
  -> typed signal extraction
  -> relationship activation
  -> policy candidate evidence
  -> replay/backtest/review
```

This reduces false candidate generation because Foundry gets explicit context
instead of free text. It also keeps candidate generation review-only: the
envelope can explain what was proposed and where evidence exists, but it cannot
activate policy.

## Primary Source Anchors

- STPA / STAMP: unsafe control actions depend on context, timing, and feedback,
  not just the command label.
- NASA runtime assurance: safety boundaries separate trusted monitors from
  untrusted or higher-risk controllers.
- NIST AI RMF: AI risk management separates map, measure, manage, and govern
  activities; this contract supports mapping, not enforcement.
- Google SRE monitoring: useful measurements require explicit signals and
  visible degraded states; this contract provides named signal inputs.

## Non-Claims

Boundary: repository-side or evaluation evidence only: not production readiness,
customer deployment proof, customer no-bypass proof, native connector or live
integration coverage, compliance certification, or automatic policy activation.
Domain-specific authority still needs separate live proof.
