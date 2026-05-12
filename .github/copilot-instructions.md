# GitHub Copilot Instructions - Attestor

Use the root `AGENTS.md` as the primary project guidance.

When reviewing or suggesting changes for Attestor:

- Treat Attestor as an acceptance, proof, and control layer for AI-driven consequences.
- Check whether the change preserves fail-closed behavior, tenant isolation, customer authority, data minimization, release provenance, auditability, replay/idempotency safety, and no-overclaim boundaries.
- Prefer line-specific, repository-grounded feedback over generic style advice.
- Do not assume production readiness, compliance, audit completion, or live deployment maturity unless the repository evidence proves it.
- For security, privacy, billing, provenance, AI-agent authority, or production-readiness changes, expect tests or explicit verification commands.
- Flag raw prompts, credentials, customer identifiers, tenant ids, webhook bodies, payment data, wallet material, IP addresses, user agents, provider bodies, downstream error bodies, and private thresholds if they appear in logs, evidence, dashboards, docs, model feedback, or audit output.
- Treat AI review output as a supplement to human review, not a merge authority.
