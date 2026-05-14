# F3-R8 Untrusted Content Trust Evidence

Status: implemented as repository-side guard hardening.

This audit hardening step addresses the residual F3 gap where the
`untrusted-content-authority-guard` detected mixed trusted/untrusted authority
claims, but still accepted caller-supplied `trustClass` labels too directly.

## Research Anchors

- NCSC prompt-injection guidance: untrusted content should not be treated as
  instructions or authority.
- Microsoft indirect prompt-injection guidance: external content and retrieved
  content must be isolated from privileged instruction/authorization channels.
- OWASP LLM01:2025 Prompt Injection and LLM05:2025 Improper Output Handling as
  engineering anchors for untrusted content crossing an action boundary.

These sources are engineering anchors only. They do not certify Attestor, and
they do not prove every customer integration has wired the guard.

## Repository Evidence

- Code: `src/consequence-admission/untrusted-content-authority-guard.ts`
- Test: `tests/untrusted-content-authority-guard.test.ts`
- Docs: `docs/02-architecture/untrusted-content-authority-guard.md`

## Control

The guard now:

- rejects promotion of untrusted/model-generated source kinds through a supplied
  `trustClass`
- records `trust-class-override-rejected`
- requires digest-bound evidence for trusted authority sources
- records `trusted-authority-evidence-missing`
- keeps raw email, ticket, prompt, document, tool, and model-summary content out
  of the decision output

## Status Change

Before:

- an adapter could label a `customer-email`, `ticket-comment`, or `llm-summary`
  as `trusted-authority`

After:

- untrusted/model-generated source kinds keep their default trust class
- rejected trust-class overrides produce review/block evidence
- trusted authority cannot pass without evidence digest

## Limitations

Not proven:

- every admission route has supplied source metadata
- every review surface displays this reason code
- every downstream verifier rejects review/block outcomes
- live customer workflow coverage

This remains a repository-side guard contract until integrated into concrete
customer enforcement points.
