# F7 Shadow Simulation Policy Floor Validation

Status: repository slice for F7-S3.

This slice makes the promotion threshold a server-owned floor in the simulation
core. The HTTP route already reads persisted tenant events instead of accepting
arbitrary caller-supplied event arrays. The remaining gap was that callers could
request a tiny `minimumPromotionEvents` value. The core now raises any smaller
caller value to the repository-owned floor.

## Changes

- `SHADOW_POLICY_SIMULATION_MINIMUM_PROMOTION_EVENTS_FLOOR` defines the minimum
  promotion candidate event count.
- `SHADOW_POLICY_SIMULATION_DEFAULT_MINIMUM_PROMOTION_EVENTS` uses that floor.
- `ShadowPolicySimulationReport` records:
  - `requestedMinimumPromotionEvents`
  - `minimumPromotionEvents`
  - `minimumPromotionEventsFloor`
  - `minimumPromotionEventsSource`
- A caller-requested threshold below the floor is recorded, but the effective
  threshold is raised to the floor before promotion recommendations are emitted.
- Invalid thresholds still fail closed.

## Validation Result

| Finding | Prior status | New status | Reason |
|---|---|---|---|
| F7-S3 simulation window / threshold manipulation | `partial` | `fixed` | Simulation routes use persisted tenant events, and the core now enforces a server-owned promotion floor even when callers request a smaller threshold. |

## Remaining Boundary

This does not claim that shadow data is production-shared or externally
attested. It only closes the repository-side threshold manipulation path.

The active F7 queue shrinks from five planned repository units to four planned
repository units:

1. F7-S4 break-glass hardening.
2. F7-S8 two-person high-risk activation handoff.
3. F7-S9 shadow bundle signing boundary validation.
4. F7-S10 shadow readiness and claim alignment.
