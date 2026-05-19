# Action Surface Onboarding Example

This example gives the local onboarding renderer a safe OpenAPI input without
requiring a customer file.

Run:

```bash
npm run example:action-surface-onboarding
```

The renderer writes:

- `.attestor/action-surface-onboarding/latest/summary.json`
- `.attestor/action-surface-onboarding/latest/README.md`

The output is review material only. It does not deploy a gateway, issue
credentials, activate enforcement, or claim production readiness.

The bundled `refund.openapi.json` is the Golden Path: Refund G02 action surface.
It includes refund reason, refund method, digest-bound order/payment evidence,
human approval references, and a prior refund signal. These fields are manifest
shape only; the example does not contain raw order, payment, customer, or tenant
payloads.
