# F7 Break-Glass Hardening Validation

Status: repository slice for F7-S4.

This slice closes the repository-side finding that `break-glass` was an equal
customer activation rollout strategy with no extra gate. Break-glass activation
now carries separate controls from normal manual, canary, and phased activation.

## Changes

- `SHADOW_CUSTOMER_ACTIVATION_BREAK_GLASS_MAX_WINDOW_MS` caps break-glass
  activation at four hours.
- `ShadowCustomerActivationHandoff` now records:
  - `secondaryApproverRef`
  - `breakGlassWindowSeconds`
  - `breakGlassJustificationRef`
  - `breakGlassReconciliationRef`
  - `breakGlassControlsReady`
- `createShadowCustomerActivationHandoff` fails break-glass handoff readiness
  when:
  - no secondary approver is supplied
  - the secondary approver matches the activation operator
  - no expiry is supplied
  - the break-glass window exceeds four hours
  - no incident justification reference is supplied
  - no post-incident reconciliation reference is supplied
- The shadow customer activation handoff HTTP route accepts and validates the
  same break-glass fields.

## Validation Result

| Finding | Prior status | New status | Reason |
|---|---|---|---|
| F7-S4 break-glass rollout has no extra gate | `open` | `fixed` | Break-glass activation now requires an independent approver, bounded expiry, incident justification, and reconciliation reference before the handoff can become ready. |

## Remaining Boundary

This does not turn shadow activation into a live production control by itself.
The artifact still declares `productionReady: false` and `autoEnforce: false`.
It closes only the repository-side break-glass gate for customer activation
handoff artifacts.

The active F7 queue shrinks from four planned repository units to three planned
repository units:

1. F7-S8 two-person high-risk activation handoff.
2. F7-S9 shadow bundle signing boundary validation.
3. F7-S10 shadow readiness and claim alignment.
