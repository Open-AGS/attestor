# Relationship Detector Contract

Status: Runtime Assurance Wiring v1 Step W04. This is a rule-based contract
for turning typed signals into typed relationships and monotone interaction
rules. It is not learned inference, not correlation learning, not fusion, not
packet signing, not live enforcement, and not production readiness.

## Decision

W04 is the first place where the signal fabric becomes explicit:

```text
SignalRelationshipSignal[]
  -> RelationshipDetectorRule[]
  -> SignalRelationship[]
  -> SignalInteractionRule[]
  -> later fusion
```

Version:

```text
attestor.relationship-detector-contract.v1
```

Package exports:

```text
createRelationshipDetectorRule()
detectSignalRelationships()
relationshipDetectorDescriptor()
```

The detector is a pure deterministic function over typed signals. It only
builds relationships and interaction rules for later processing.

## Built-In Rule Modes

W04 registers eight rule modes:

| Rule mode | Relationship | Shape | Effect |
|---|---|---|---|
| `duplicate-evidence` | `duplicates` | symmetric | `discount-duplicate-evidence` |
| `same-kind-independent-confirmation` | `confirms` | symmetric | `raise-review-pressure` |
| `confirmation-contradiction-conflict` | `contradicts` | symmetric | `mark-conflict` |
| `hard-floor-overrides-advisory` | `overrides` | directed | `preserve-hard-floor` |
| `context-modulates-advisory` | `modulates` | directed | `raise-review-pressure` |
| `boundary-escalates-gap` | `escalates` | directed | `raise-block-pressure` |
| `gap-requires-review` | `requires_review` | unary | `raise-review-pressure` |
| `measurement-degraded-requires-review` | `requires_review` | unary | `raise-review-pressure` |

These rules are deliberately simple. They are not a learned dependency graph
and do not infer correlation weights. They only make explicit relationships
that later W05 fusion can consume.

## Same-Envelope Boundary

All input signals must share the same `envelopeRefDigest`. Cross-envelope and
cross-tenant relationship detection is rejected in W04:

```text
sameEnvelopeOnly = true
```

This protects tenant isolation and prevents evidence from one consequence from
modulating another consequence by accident.

## Authority Boundary

Every detector result preserves:

```text
grantsAuthority = false
canAdmit = false
activatesEnforcement = false
autoEnforce = false
productionReady = false
```

The detector cannot decide, admit, block, enforce, sign packets, or activate
policy. It only emits relationship structure for later no-loosening stages.

## Raw Material Boundary

Signals must already be digest-bound. The detector rejects raw-material
carrying signals and stores no raw payload, prompt, provider body, tenant id,
customer id, private threshold, wallet material, or downstream body.

## Runtime Wiring Position

Runtime Assurance Wiring v1:

```text
W01 Shadow Envelope Projector                  complete
W02 Signal Extractor Contract                  complete
W03 Existing Checks To Signal Adapter Registry complete
W04 Relationship Detector Contract             complete
W05 Shadow Runtime Pipeline Dry Run            planned
```

W04 is the last contract slice before the shadow dry-run pipeline. W05 will be
allowed to call W01-W04 and then run existing relationship-aware fusion, but
W04 itself does not run fusion.

## Primary Source Anchors

Reviewed on 2026-05-17:

- [NVIDIA Safety Force Field](https://www.nvidia.com/content/dam/en-zz/Solutions/self-driving-cars/safety-force-field/an-introduction-to-the-safety-force-field-v2.pdf) - a monitor layer can reject unacceptable actions by checking claimed-space intersections before action execution. Attestor maps this to relationship detection before fusion, without claiming vehicle-safety properties.
- [NVIDIA DRIVE Labs Safety Force Field](https://developer.nvidia.com/blog/drive-labs-eliminating-collisions-with-safety-force-field/) - NVIDIA describes SFF as an independent supervisor that double-checks primary control choices. W04 adopts the supervisor/monitor pattern, but does not veto or correct anything.
- [Accellera UVM 1.2 User Guide](https://www.accellera.org/images/downloads/standards/uvm/uvm_users_guide_1.2.pdf) - hardware verification separates monitors, scoreboards, checks, and coverage. W04 follows the monitor/scoreboard split: it observes typed signals and emits relationship evidence, leaving fusion and enforcement elsewhere.
- [NASA Runtime Assurance formal framework](https://ntrs.nasa.gov/citations/20230017350) - RTA separates untrusted advanced behavior from a trusted safety monitor/controller. W04 is not the trusted controller; it prepares typed relationship evidence for later bounded runtime assurance checks.

These anchors justify deterministic relationship detection before fusion. They
do not prove formal correctness, live safety, or production readiness.

## Non-Claims

Boundary: repository-side or evaluation evidence only: not production readiness,
customer deployment proof, customer no-bypass proof, native connector or live
integration coverage, compliance certification, or automatic policy activation.
Domain-specific authority still needs separate live proof.

It never grants authority and never makes a signal or action safer.
