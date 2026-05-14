# Agentic Supply Chain Guard

Version: `attestor.consequence-agentic-supply-chain-guard.v1`

Source file: `src/consequence-admission/agentic-supply-chain-guard.ts`

Test command: `npm run test:agentic-supply-chain-guard`

## Purpose

The Agentic Supply Chain Guard renders a deterministic decision for packages,
connectors, plugins, MCP servers, workflows, generated adapters, domain packs,
model-provider SDKs, and custom tools that may influence AI action execution.

It is scoped to the registered failure mode:

- `agentic-supply-chain-compromise`

Research anchors:

- OWASP LLM03:2025 Supply Chain
- SLSA provenance and verification guidance
- NIST SSDF / SP 800-218 secure development and supplier-risk vocabulary
- OpenSSF Scorecard supply-chain checks for pinning, signed releases, token
  permissions, maintenance, and risky project practices

## Required Evidence

Each component should provide:

- component kind and trust class
- pinned source reference
- version
- integrity digest
- provenance reference and verified provenance flag
- signature verification where relevant
- SBOM reference for third-party components
- owner authority digest
- review digest
- permission scope digest
- declared versus allowed permission scope
- adapter readiness digest for adapters, plugins, connectors, MCP servers, and
  custom tools
- runtime replay digest for high-impact components

The guard stores digest-only observations for component refs, source refs,
versions, SBOM refs, and permissions. It does not store raw package names, raw
source URLs, raw prompts, raw tool payloads, credentials, or provider bodies.

## Decision Rules

The guard returns:

- `pass` when the component manifest is pinned, integrity-bound,
  provenance-verified, reviewed, least-privilege scoped, and replay-tested
  where high impact.
- `review` when evidence is missing but the component is not yet a direct
  fail-closed blocker.
- `block` when the component has overbroad permissions, an unverified domain
  pack boundary, a high-impact untrusted publisher, or a critical/high-impact
  component missing integrity, provenance, or generated-artifact review.

It remains conservative: `autoEnforce: false`, `productionReady: false`, and
`activatesEnforcement: false`.

## Non-Claims

This guard does not certify third-party code behavior, audit a live package
registry, verify a vendor outside supplied evidence, deploy infrastructure, or
activate enforcement. It renders repository-side guard evidence that downstream
integration, runtime tests, customer approval, and activation readiness must
still consume before any production enforcement claim.
