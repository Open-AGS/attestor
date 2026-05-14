# F7 High-Risk Two-Person Activation Validation

Status: repository slice for F7-S8.

This slice closes the repository-side finding that shadow activation handoff had
a single operator reference for high-impact activation. Break-glass already has
a separate secondary approver gate; this slice extends two-person approval to
high-risk downstream activation boundaries.

## Changes

- `SHADOW_CUSTOMER_ACTIVATION_HIGH_RISK_BOUNDARY_KINDS` defines high-risk
  activation boundaries:
  - `record-writer`
  - `communication-sender`
  - `action-dispatcher`
  - `wallet-adapter`
  - `payment-adapter`
  - `artifact-exporter`
  - `custom`
- `ShadowCustomerActivationHandoff` now records:
  - `activationBoundaryKind`
  - `twoPersonApprovalRequired`
  - `twoPersonApprovalReady`
- High-risk non-break-glass activation now blocks when:
  - no `secondaryApproverRef` is supplied
  - `secondaryApproverRef` equals the activating `operatorRef`
- The shadow customer activation handoff route passes the downstream
  integration proof boundary kind into the handoff artifact.

## Validation Result

| Finding | Prior status | New status | Reason |
|---|---|---|---|
| F7-S8 single-operator shadow activation | `open` | `fixed` | High-risk shadow activation handoff now requires an independent secondary approver before it can become ready. |

## Remaining Boundary

This is repository-side handoff gating. It does not claim that customer systems
have deployed two-person enforcement in production, and it does not change the
artifact's `productionReady: false` / `autoEnforce: false` boundary.

The active F7 queue shrinks from three planned repository units to two planned
repository units:

1. F7-S9 shadow bundle signing boundary validation.
2. F7-S10 shadow readiness and claim alignment.
