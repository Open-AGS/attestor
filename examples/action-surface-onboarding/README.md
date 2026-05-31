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

To render the fuller local review package from the same OpenAPI file, run:

```bash
npm run example:action-surface-integration-kit
```

That command writes:

- `.attestor/action-surface-integration-kit/latest/README.md`
- `.attestor/action-surface-integration-kit/latest/summary.json`
- `.attestor/action-surface-integration-kit/latest/artifact-manifest.json`
- `.attestor/action-surface-integration-kit/latest/no-bypass-probes.json`
- `.attestor/action-surface-integration-kit/latest/approval-record.template.json`
- `.attestor/action-surface-integration-kit/latest/artifacts/openapi-overlay.json`
- `.attestor/action-surface-integration-kit/latest/artifacts/envoy-ext-authz.json`
- `.attestor/action-surface-integration-kit/latest/artifacts/mcp-gateway-drafts.json`
- `.attestor/action-surface-integration-kit/latest/artifacts/no-bypass-probe-bundle.json`

The output is review material only. It does not deploy a gateway, issue
credentials, run probes, activate enforcement, prove customer PEP no-bypass,
or claim production readiness.

The bundled `refund.openapi.json` is the Golden Path: Refund G02 action surface.
It includes refund reason, refund method, digest-bound order/payment evidence,
human approval references, and a prior refund signal. These fields are manifest
shape only; the example does not contain raw order, payment, customer, or tenant
payloads.
