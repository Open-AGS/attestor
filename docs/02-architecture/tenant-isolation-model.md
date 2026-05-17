# Tenant Isolation Model

Status: W08 implementation contract for Runtime Assurance Wiring v1. This is a
manual Alloy relation model for tenant non-interference. It is not a proof that
the TypeScript runtime is formally verified, not a production isolation
certificate, not a replacement for PostgreSQL RLS or runtime PEP checks, and
not production readiness.

Version: `tenantIsolation` Alloy module

## Decision

W08 adds a small Alloy model for the tenant-scoped relationships created by
Runtime Assurance Wiring v1:

```text
Tenant
  -> Actor
  -> Resource
  -> Envelope
  -> Trace
  -> Signal
  -> Packet
  -> ReviewAssignment
  -> Decision
```

The model checks the structural question that W07 intentionally does not own:

```text
Can any decision, packet, trace, signal, review assignment, or access relation
depend on an object owned by another tenant?
```

This is a relational non-interference model. It does not model time, state
transitions, replay consumption, review sequencing, hazard monotonicity, or
enforcement behavior. Those belong to the W07 TLA+ state-machine track.

## Files

```text
specs/tenant-isolation.als
tests/tenant-isolation-model.test.ts
docs/02-architecture/tenant-isolation-model.md
```

## Modeled Relations

The Alloy module names these tenant-owned relations:

```text
Actor.owner
Resource.owner
Reviewer.owner
Envelope.owner
Envelope.actor
Envelope.resource
Trace.owner
Trace.sourceEnvelope
Signal.owner
Signal.sourceTrace
Signal.dependsOn
Packet.owner
Packet.envelope
Packet.trace
Packet.signals
Access.owner
Access.accessor
Access.target
Access.context
ReviewAssignment.owner
ReviewAssignment.reviewer
ReviewAssignment.packet
Decision.owner
Decision.packet
Decision.trace
Decision.reviewer
```

The `TenantScopedReferences` fact binds each relation to one owner. The
`NoSignalCycles` fact prevents signal dependency loops inside the structural
model.

## Assertions

The model defines these assertions:

```text
EnvelopeTenantBinding
TraceTenantBinding
SignalTenantBinding
PacketTenantBinding
AccessNonInterference
ReviewAssignmentTenantBinding
DecisionNonInterference
```

The checks are small-scope Alloy commands:

```text
check EnvelopeTenantBinding for 6 but exactly 3 Tenant
check TraceTenantBinding for 6 but exactly 3 Tenant
check SignalTenantBinding for 6 but exactly 3 Tenant
check PacketTenantBinding for 6 but exactly 3 Tenant
check AccessNonInterference for 6 but exactly 3 Tenant
check ReviewAssignmentTenantBinding for 6 but exactly 3 Tenant
check DecisionNonInterference for 6 but exactly 3 Tenant
```

The repository test confirms that the model, assertions, commands, overview,
and package script stay aligned. It does not run the Alloy Analyzer.

## Boundaries

W08 preserves these no-go conditions:

```text
not TypeScript implementation verification
not generated from TypeScript
not behavior or temporal proof
not TLA+ replacement
not Alloy Analyzer execution in CI
not production isolation certificate
not PostgreSQL RLS replacement
not runtime PEP replacement
not cross-tenant aggregation
not production readiness
```

The model is manual by design. Alloy's own language reference frames Alloy as a
first-order relational logic with bounded analysis; it is well matched to
structural relations like tenant ownership and dependency. W08 uses that
strength and deliberately avoids duplicating W07's state machine.

## Verification

The repository gate is static:

```bash
npm run test:tenant-isolation-model
```

That test verifies the Alloy module, assertion names, check commands,
non-claim wording, overview tracker row, and package script. It does not run
the Alloy Analyzer.

Non-claim: the static repository gate does not run the Alloy Analyzer.

Future verification can add a separate Alloy Analyzer job once the analyzer
version, command-line invocation, and CI runtime are pinned.

## Sources

- Alloy Tools, [Alloy language reference](https://alloytools.org/download/alloy-language-reference.pdf)
- CACM, [Alloy: A Language and Tool for Exploring Software Designs](https://cacm.acm.org/research/alloy/)
- AWS, [Core isolation concepts for SaaS tenant isolation](https://docs.aws.amazon.com/whitepapers/latest/saas-tenant-isolation-strategies/core-isolation-concepts.html)
- AWS Lambda, [Tenant isolation](https://docs.aws.amazon.com/lambda/latest/dg/tenant-isolation.html)
- NIST, [SP 800-207A Zero Trust Architecture model](https://csrc.nist.gov/pubs/sp/800/207/a/final)
