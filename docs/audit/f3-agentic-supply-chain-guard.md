# F3-R6 Agentic Supply Chain Guard

Status: implemented as repository-side guard evidence.

This audit hardening step addresses the F3 gap where
`agentic-supply-chain-compromise` was registered and covered as
`integration-required`, but had no dedicated guard module.

## Research Anchors

- OWASP LLM03:2025 Supply Chain
- SLSA provenance and artifact verification model
- NIST SSDF / SP 800-218 secure software development and supplier-risk framing
- OpenSSF Scorecard supply-chain risk checks

These sources are engineering anchors only. They do not certify Attestor, and
they do not prove third-party adapter or pack behavior.

## Repository Evidence

- Code: `src/consequence-admission/agentic-supply-chain-guard.ts`
- Test: `tests/agentic-supply-chain-guard.test.ts`
- Docs: `docs/02-architecture/agentic-supply-chain-guard.md`
- Registry: `src/consequence-admission/failure-mode-registry.ts`
- Coverage: `src/consequence-admission/failure-mode-guard-coverage.ts`
- Activation checklist: `src/consequence-admission/guard-activation-readiness.ts`

## Control

The guard evaluates component manifests for:

- pinned source
- version
- integrity digest
- verified provenance
- signature state
- SBOM reference for third-party components
- owner authority
- review digest
- least-privilege permission scope
- generated-artifact review
- domain pack boundary verification
- adapter readiness
- runtime replay evidence for high-impact components

## Status Change

Before:

- `agentic-supply-chain-compromise` was `integration-required`
- no dedicated guard was present

After:

- `agentic-supply-chain-compromise` has `dedicated-guard` coverage
- the guard is included in guard activation readiness
- the package surface exposes the guard version and reason-code vocabulary

## Limitations

Not proven:

- live customer workflow coverage
- third-party package behavior
- registry authenticity outside supplied evidence
- downstream verifier integration
- production enforcement activation
- external audit or certification

Default posture remains conservative: missing or unsafe supply-chain evidence
leads to `review` or `block`, and the guard does not activate enforcement by
itself.
