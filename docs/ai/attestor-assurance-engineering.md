# Attestor Assurance Engineering

This guide defines how AI-assisted engineering work should be shaped for Attestor.

It is not a generic coding guide. It exists to keep future changes aligned with Attestor's core claim: proposed AI actions should only become real-world consequences after bounded admission, proof, review, narrowing, or blocking.

## External Anchors

These sources inform the operating model, but they are not copied literally:

- OpenAI Codex recommends repository guidance through `AGENTS.md`: https://developers.openai.com/codex/guides/agents-md
- Claude Code recommends persistent project instructions, concise memory, verification, and explore-plan-implement-commit workflows: https://code.claude.com/docs/en/best-practices
- Claude Code can bridge `AGENTS.md` through `CLAUDE.md`: https://code.claude.com/docs/en/memory
- GitHub Copilot supports repository-wide, path-specific, and agent instructions: https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/add-custom-instructions/add-repository-instructions
- GitHub Copilot code review must be reviewed and verified by humans: https://docs.github.com/en/copilot/responsible-use/code-review
- NIST SSDF frames secure software development as requirements, implementation, verification, and response: https://csrc.nist.gov/pubs/sp/800/218/final
- SLSA emphasizes provenance, artifact subjects, trusted builders, and verifier policy: https://slsa.dev/spec/v1.2/
- OWASP LLM guidance treats prompt injection, sensitive information disclosure, and excessive agency as AI-system risks: https://genai.owasp.org/resource/owasp-top-10-for-llm-applications-2025/

## Attestor Translation

The external pattern is:

```text
persistent guidance -> repository evidence -> small implementation -> verification -> reviewable proof
```

The Attestor-specific translation is:

```text
claim -> protected principle -> trust surface -> contract/code/test evidence -> limitation or proof
```

Every non-trivial trust-control change should improve at least one of these protected principles:

- proof integrity
- fail-closed boundary
- tenant isolation
- customer authority
- data minimization and redaction
- no overclaim
- runtime readiness
- release provenance
- auditability
- replay and idempotency safety
- operational boundedness

## Evidence Ladder

Use the strongest evidence available:

| Evidence level | Meaning |
|---|---|
| Source code | The behavior is implemented. |
| Machine-readable contract | The intended control is explicitly represented. |
| Regression test | The behavior is protected against drift. |
| Package script or CI gate | The verification is easy to rerun. |
| Runtime probe | The behavior is checked against a real or configured environment. |
| Documentation | The claim, limitation, or no-go is stated for reviewers. |

Documentation alone is not enough for behavior claims. It is acceptable for process rules, limitations, and reviewer guidance.

## Repository Patterns To Preserve

Attestor already has strong local patterns:

- evaluation-release and no-overclaim language in `README.md`
- fail-closed admission decisions: `admit`, `narrow`, `review`, `block`
- hosted journey contracts in `docs/01-overview/hosted-journey-contract.md`
- data minimization boundaries in `docs/02-architecture/data-minimization-redaction-policy.md`
- production readiness boundaries in `docs/08-deployment/production-readiness.md`
- targeted package scripts in `package.json`
- release provenance and supply-chain gates in `.github/workflows/` and `scripts/check-supply-chain-baseline.mjs`

New guidance should reinforce these patterns instead of inventing a parallel process.

## Machine-Checkable Versus Documentation-Only

Machine-checkable:

- package scripts
- TypeScript types
- route and package-surface probes
- machine-readable trust profiles
- OpenAPI contracts
- CI workflow permissions
- secret-safe output tests
- live/ops gates when the required environment exists

Documentation-only:

- audit workflow instructions
- finding status definitions
- no-go wording
- protected-principle taxonomy
- human merge ownership
- limitations that depend on external operator action

When possible, convert repeated documentation-only rules into tests or probes later. Do not force every process rule into code if it would create brittle or performative checks.

## Public Boundary

Public repository docs may describe process, architecture, constraints, and generic blockers. They must not expose private financial constraints, live secrets, customer data, tenant data, provider payloads, operator-only deployment details, or personal workflow notes.

## Update Rule

Keep `AGENTS.md` concise. Put long workflows in playbooks. Review this guidance when agent behavior drifts, when the project adds a new trust surface, or when a repeated manual rule becomes worth making machine-checkable.
