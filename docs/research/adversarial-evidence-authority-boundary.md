# Adversarial Evidence Authority Boundary Research

Status: source-backed repository design note, not a certification.

## Question

How should Attestor test the boundary where prompt-injection-like content,
tool output, model rationale, or evidence material tries to become authority for
a high-risk action?

## Sources

- [OWASP LLM01 Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)
- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
- [OpenAI safety best practices](https://platform.openai.com/docs/guides/safety-best-practices)

## Attestor-Specific Interpretation

The source-backed pattern is not to make prompts perfect. For Attestor, the
control belongs at the proposed-action boundary:

```text
AI or tool material may propose or explain an action
-> Attestor classifies the source and claim kind
-> untrusted/model-generated authority claims block or review
-> only trusted authority plus evidence can support admission
```

This keeps the work inside the single consequence-admission engine. It does not
turn Attestor into a chatbot, prompt filter, content classifier, SIEM, or
workflow engine.

## Repository Mapping

- `src/consequence-admission/untrusted-content-authority-guard.ts` evaluates
  whether content is authority, evidence, context, or instruction.
- `src/consequence-admission/adversarial-evidence-fixtures.ts` adds synthetic
  local fixtures for direct prompt injection, indirect web content, tool-output
  poisoning, model-rationale self-approval, evidence-not-authority, mixed
  injected/trusted authority, and trust-class promotion attempts.
- `tests/adversarial-evidence-fixtures.test.ts` verifies those fixtures against
  the authority guard and keeps every case digest-bound and non-executing.

## Protected Principles

- customer authority
- fail-closed boundary
- proof integrity
- data minimization and redaction
- no overclaim

## Claim Boundary

This note and the implemented fixtures are `source-backed` and `repo-proven`
for local synthetic fixture coverage after tests pass. They are not live proof,
not model jailbreak coverage, not prompt-injection completeness, not production
readiness, and not customer PEP no-bypass evidence.
