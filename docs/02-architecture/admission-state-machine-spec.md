# Admission State Machine Spec

Status: W07 implementation contract for Runtime Assurance Wiring v1. This is a
manual TLA+ skeleton and TLC configuration for the admission state machine. It
is not a proof that the TypeScript runtime is formally verified, not a
production safety certificate, not live enforcement, and not production
readiness.

Version: `AdmissionStateMachine` TLA+ module

## Decision

W07 adds a design-first TLA+ state machine for the shadow-to-admission path:

```text
proposed
  -> enveloped
  -> traced
  -> review | admitted | blocked
  -> enforced
```

The model names the minimum control variables that W01-W06 made explicit:

```text
requestTenant
requestStage
authorityOk
traceValid
traceTenant
packetDigest
packetNonce
consumedNonces
reviewRequired
reviewed
hazard
priorHazard
enforcementActive
```

The state machine is intentionally small. It models the safety boundary, not
every production field in the TypeScript implementation.

## Files

```text
specs/admission-state-machine.tla
specs/MCAdmission.cfg
tests/admission-state-machine-spec.test.ts
docs/02-architecture/admission-state-machine-spec.md
```

## Initial Invariants

The TLC configuration names these invariants:

```text
TypeOK
NoAdmitWithoutAuthority
NoEnforcementWithoutPacket
NoCrossTenantLeak
NoReviewBypass
MonotoneFusion
ReplaySafety
```

These are safety invariants for the model:

- `NoAdmitWithoutAuthority`: an admitted or enforced request requires authority.
- `NoEnforcementWithoutPacket`: an active enforcement requires a packet digest
  and nonce.
- `NoCrossTenantLeak`: a valid trace remains bound to the same tenant as the
  request.
- `NoReviewBypass`: review-required requests cannot reach admitted or enforced
  states without review.
- `MonotoneFusion`: the modeled hazard score cannot decrease as the state
  advances.
- `ReplaySafety`: two enforced requests cannot share the same consumed packet
  nonce.

## Boundaries

W07 preserves these no-go conditions:

```text
not TypeScript implementation verification
not generated from TypeScript
not production enforcement
not production certification
not audit-plane write
not packet signing
not learned invariant promotion
not cross-tenant aggregation
not production readiness
```

The spec is manual by design. AWS formal-methods guidance repeatedly treats
the formal model as an artifact engineers write to clarify the design, not as a
mechanical dump of production code. W07 follows that pattern: the TLA+ model is
small enough to review and later run with TLC or Apalache, while the repository
test only checks that the skeleton and config stay aligned.

## Verification

The repository gate is static:

```bash
npm run test:admission-state-machine-spec
```

That test verifies the module, TLC config, invariant names, no-claim wording,
overview tracker row, and package script. It does not run TLC, Apalache, or any
other model checker.

Non-claim: the static repository gate does not run TLC, Apalache, or any other model checker.

Future verification can add a separate model-checker job once the toolchain is
pinned and reproducible for CI.

## Sources

- TLA+ Foundation, [TLA+ resources](https://lamport.azurewebsites.net/tla/tla.html)
- Microsoft Research, [Specifying Systems](https://lamport.azurewebsites.net/tla/book.html)
- AWS Builders' Library / CACM, [How Amazon Web Services uses formal methods](https://dl.acm.org/doi/10.1145/2699417)
- ACM Queue, [Systems Correctness Practices at AWS](https://queue.acm.org/detail.cfm?id=3712057)
- Apalache, [TLA+ model checker documentation](https://apalache-mc.org/docs/)
