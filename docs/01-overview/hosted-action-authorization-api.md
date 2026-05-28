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
- `GET /api/v1/shadow/dashboard-summary`

It is intentionally not a full hosted account, billing, finance-pipeline, or crypto-hosted-route catalog.

## Boundary

The OpenAPI contract is an integration truth source, not a maturity claim.

It keeps these constraints explicit:

- the published admission route is `POST /api/v1/admissions`
- admission feedback is model-safe feedback only: reason codes, missing field names, evidence kind names, operator-only reason codes, and safe instruction
- admission responses do not grant tool execution authority or unsafe retry authority
- `observedFeatures` are upstream/operator-derived evidence, not authority; they cannot reduce policy, evidence, token, tenant, replay, or downstream PEP requirements
- positive readiness observations such as `observedFeatures.adapterReady` reduce review pressure only when the matching `observedFeatureOrigins.adapterReady` marker is trusted (`operator-attested`, `customer-gateway`, `attestor-runtime`, or `trusted-adapter`)
- authority must arrive as structured `authoritySources` references; untrusted content, tool output, retrieved content, and model summaries cannot authorize a consequence or self-promote into trusted authority
- trusted authority source entries must carry digest evidence, and missing or untrusted authority provenance holds or blocks the generic admission before downstream execution
- when an authority source claims `approval`, approval must also arrive as structured `approvals` provenance with digest-bound reviewer, scope, state, and issued-at evidence; raw approval text and model summaries are not accepted as approval
- tool results that support evidence, policy, authority, instruction, context, or review summaries must arrive as structured `toolResults` metadata; untrusted external tool results used as authority or instruction fail closed, model-generated tool evidence holds for review, and trusted tool evidence requires source, timestamp, integrity digest, evidence digest, and allowed evidence-class metadata
- agentic tool, connector, plugin, workflow, generated adapter, domain-pack, and provider-SDK supply-chain state must arrive as structured `agenticSupplyChain` metadata; unpinned, unsigned, missing-provenance, overbroad-permission, unreviewed generated artifact, or unverified domain-pack evidence can hold or block before downstream execution
- human review packet state must arrive as structured `humanReviewFatigue` metadata; missing risk summaries, unprioritized blockers, excessive review load, raw payload storage, or auto-enforce requests can hold or block before downstream execution
- multi-agent delegation state must arrive as structured `multiAgentDelegation` metadata; missing agent identity, missing authority, missing scope, scope mismatch, delegation cycles, self-approval, or cross-tenant unscoped delegation can hold or block before downstream execution
- policy version, approval window, authority freshness, drift, and no-go state must arrive as structured `staleAuthorityPolicy` metadata; policy mismatch, policy update after approval, expired approval, expired authority, or no-go drift blocks before downstream execution
- model, tool-schema, policy, config, prompt, verifier, and simulation context must arrive as structured `decisionContextDrift` metadata; missing required bound/current model, tool-schema, policy, or config context blocks, while context drift, expiry, age excess, or required simulation refresh holds before downstream execution
- assurance measurement and decision-lineage state must arrive as structured `authorityCreep` metadata; measurement-as-authority, blocked metric uses, lineage binding gaps, raw-payload/evidence requests, audit writes, policy activation, live enforcement activation, or authority-action requests can hold or block before downstream execution
- no-go condition state must arrive as structured `noGoConditions` metadata with digest-bound owner, authority, scope, and validity evidence; active holds and natural-language bypass attempts block before downstream execution
- admission responses can expose tool-result guard outcomes, counts, reason codes, and digests, but must not return raw tool-result refs, source URLs, provider bodies, raw payloads, or model-generated summaries
- admission responses can expose agentic supply-chain outcomes, counts, reason codes, and digests, but must not return raw component refs, package names, permissions, source URLs, generated code, provider bodies, or raw SBOM/provenance documents
- admission responses can expose human-review fatigue outcomes, counts, booleans, reason codes, and digests, but must not return raw review packets, reviewer notes, customer payloads, or private case text
- admission responses can expose multi-agent delegation outcomes, counts, reason codes, and digests, but must not return raw principal refs, raw delegation traces, private tenant identifiers, customer prompts, or tool payloads
- admission responses can expose stale authority/policy outcomes, counts, reason codes, and digests, but must not return raw policy text, raw approval records, private IdP records, or raw no-go case text
- admission responses can expose decision-context drift outcomes, counts, age, reason codes, and digests, but must not return raw model versions, policy versions, prompt text, config values, tool definitions, verifier identifiers, or simulation bodies
- admission responses can expose authority-creep outcomes, finding counts, blocked metric-use counts, undercutting-defeater flags, rejected-boundary flags, reason codes, and digests, but must not return raw lineage graphs, raw measurement windows, raw assurance packets, customer payloads, or private reviewer material
- admission responses can expose no-go outcomes, counts, reason codes, and digests, but must not return raw hold references, private case identifiers, customer messages, or bypass text
- shadow reads are read-only and served with `cache-control: no-store`
- failure responses use RFC 9457-style problem details with Attestor fail-closed fields
- shadow reads do not activate policy, approve candidates, infer business impact, or auto-enforce
- shadow reads do not return raw prompts, raw tool payloads, raw evidence ids, customer records, provider bodies, payment secrets, wallet material, or downstream response bodies
- protected adapters verify Attestor admission before execution and record digest-only tool invocation evidence rather than raw tool payloads or raw results
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
