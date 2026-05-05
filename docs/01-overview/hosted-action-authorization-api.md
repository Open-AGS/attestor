# Hosted Action Authorization API

This document points to the first machine-readable contract for Attestor's hosted action-authorization surface:

```text
docs/api/attestor-action-authorization.openapi.json
```

The contract covers the current evaluation API shape for the first integration path:

- `POST /api/v1/admissions`
- `GET /api/v1/shadow/summary`
- `GET /api/v1/shadow/recommendations`
- `GET /api/v1/shadow/action-risk-inventory`
- `GET /api/v1/shadow/policy-candidates`
- `GET /api/v1/shadow/audit-evidence`
- `GET /api/v1/shadow/business-risk-dashboard`

It is intentionally not a full hosted account, billing, finance-pipeline, or crypto-hosted-route catalog.

## Boundary

The OpenAPI contract is an integration truth source, not a maturity claim.

It keeps these constraints explicit:

- the published admission route is `POST /api/v1/admissions`
- shadow reads are read-only and served with `cache-control: no-store`
- failure responses use RFC 9457-style problem details with Attestor fail-closed fields
- shadow reads do not activate policy, approve candidates, infer business impact, or auto-enforce
- shadow reads do not return raw prompts, raw tool payloads, raw evidence ids, customer records, payment secrets, wallet material, or downstream response bodies
- no public hosted crypto HTTP route is claimed by this contract

## Research Posture

Reviewed before this contract step:

- OpenAPI remains the current machine-readable API description format for HTTP APIs, so Attestor's first hosted integration path should not rely only on prose.
- RFC 9457 keeps API error details machine-readable and stable, which matches Attestor's fail-closed problem response shape.
- NIST AI RMF emphasizes measurement, documentation, and monitoring over time, which matches the shadow read surfaces and audit evidence packet.
- OWASP LLM and API security guidance continue to treat excessive agency, authorization boundaries, resource limits, and logging/monitoring as first-order risks for tool-using AI systems.

## How To Use It

Use the OpenAPI file as the contract for client generation, API review, and route drift checks around the action-authorization path.

The implementation remains the source of behavior. If the OpenAPI file and route tests disagree, fix the mismatch before widening the public claim.
