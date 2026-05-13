# Consequence Taxonomy

Attestor controls proposed consequences, not generic tool calls.

A tool call is an implementation detail. The consequence is the thing a company has to live with after the AI-assisted system acts: money moved, data released, access granted, a filing prepared, a customer told something, or infrastructure changed.

The consequence taxonomy gives Attestor shared control-plane language before individual packs add their domain-specific adapters.

The taxonomy comes before the pack. A pack can add native evidence, adapters, and verification formats, but it should not get a separate trust story.

```text
AI proposal
  -> consequence domain
  -> risk floor and required controls
  -> admit / narrow / review / block
  -> proof material
  -> downstream verification
```

This page is not a maturity claim. It describes the domains Attestor is built to classify. The current proof depth remains strongest in finance, with crypto as the active programmable-money extension.

## What The Taxonomy Does

The taxonomy separates three things that otherwise get blurred:

- **Consequence kind:** the shape of the result, such as `record`, `communication`, `action`, `decision-support`, `transfer`, `approval`, or `wallet-call`.
- **Consequence domain:** the business or security surface affected, such as financial record, money movement, programmable money, data disclosure, authority change, regulated filing, or system operation.
- **Control requirements:** the minimum gate material expected before a consequence can proceed, such as policy scope, actor authority, evidence binding, freshness, downstream verification, replay protection, human review, data minimization, and audit retention.

This lets Money Movement, Data Movement, Authority Change, External Communication, Operational Execution, Programmable Money, and future packs attach to the same consequence-admission core without inventing separate trust stories.

After classification, the customer-side allow/hold binding is defined in [Downstream enforcement contract](downstream-enforcement-contract.md). The taxonomy says what kind of consequence this is; the downstream contract says whether a specific enforcement point may act on this admission.

## Domains

### Financial Record

AI-assisted financial records are durable artifacts: reporting records, reconciliation outputs, filing-preparation packets, and review materials created from governed data.

Typical gate:

- minimum risk floor: `R3`
- required checks: policy, authority, evidence, freshness, enforcement
- key controls: evidence binding, data minimization, redaction, audit retention, downstream verification

Example: an AI workflow prepares a counterparty exposure report from live warehouse data. The report should not become a release artifact just because the model produced a plausible summary.

### Money Movement

Money movement covers proposed payments, payouts, refunds, credits, adjustments, and payment-adjacent dispatch before they reach financial infrastructure.

Typical gate:

- minimum risk floor: `R3`
- required checks: policy, authority, evidence, freshness, enforcement
- key controls: scoped token, replay protection, human review path, non-bypassable downstream integration

Example: an agent reads a changed supplier bank-account instruction and proposes payment. Attestor does not move the money. It decides whether the payment layer is allowed to receive an admissible release.

### Programmable Money

Programmable money covers wallet RPC, Safe guards, bundlers, smart-account paths, x402 payment middleware, custody policy callbacks, and solver handoffs.

Typical gate:

- minimum risk floor: `R3`
- required checks: policy, authority, evidence, freshness, enforcement, adapter readiness
- key controls: scope-bound authorization, replay protection, simulation evidence, downstream verification, admission receipt

Example: a crypto workflow prepares a Safe transaction or ERC-4337 UserOperation. The consequence is not "the AI called a tool"; the consequence is that an account, contract, or settlement path may execute.

### Data Disclosure

Data disclosure covers proposed exports, live-query reports, customer-data packages, and sensitive records before data leaves its boundary.

Typical gate:

- minimum risk floor: `R3`
- required checks: policy, authority, evidence, freshness, enforcement
- key controls: data minimization, redaction, evidence binding, downstream verification, audit retention

Example: an internal AI asks for a live database-backed customer export. The useful question is not whether the prompt was polite. The useful question is whether the export is scoped, evidenced, fresh, and allowed.

### Authority Change

Authority change covers account state, entitlements, roles, delegations, service accounts, approval authority, and administrative control.

Typical gate:

- minimum risk floor: `R4`
- required checks: policy, authority, evidence, freshness, enforcement
- key controls: named authority, review path, replay protection, non-bypassable integration, audit retention

Example: a support copilot proposes restoring an account, granting an entitlement, or changing an admin role. If the downstream admin plane accepts the action, the model has effectively changed authority.

### External Communication

External communication covers customer replies, legal notices, billing notices, public updates, and controlled messages.

Typical gate:

- minimum risk floor: `R2`
- required checks: policy, authority, evidence, enforcement
- key controls: evidence binding, data minimization, redaction, audit retention

Example: an AI drafts a customer-facing refund explanation. Sending it may create business, legal, or trust consequences even if no ledger changed.

### Regulated Filing

Regulated filing covers formal filings, disclosures, notices, and records that require stronger retention and release discipline.

Typical gate:

- minimum risk floor: `R4`
- required checks: policy, authority, evidence, freshness, enforcement
- key controls: scoped release token, review path, audit retention, replay protection, downstream verification

Example: a workflow assembles a filing package. The important boundary is the release into a filing path, not the text generation step.

### System Operation

System operation covers deploys, infrastructure mutations, incident-response actions, secret rotation, and live operational changes.

Typical gate:

- minimum risk floor: `R3`
- required checks: policy, authority, evidence, freshness, enforcement
- key controls: named authority, scoped release, replay protection, non-bypassable integration, audit retention

Example: an operations agent proposes a production deploy or secret rotation. A bad recommendation can be ignored; a bad operational consequence can take a system down.

### Decision Support

Decision support covers recommendations, analyst notes, triage outputs, and briefings that inform a later decision without directly executing a downstream consequence.

Typical gate:

- minimum risk floor: `R0`
- required checks: policy, evidence
- key controls: scope clarity, evidence binding, audit retention, data minimization

Example: an AI prepares a risk briefing for a reviewer. This can remain advisory if a separate release gate controls the actual consequence.

### Custom

Custom domains are customer-defined surfaces. They should not inherit automatic admission just because they fit an adapter.

Typical gate:

- minimum risk floor: `custom`
- required checks: policy, authority, evidence, freshness, enforcement
- key controls: explicit scope, downstream verification, review path, data minimization, audit retention

Custom is a holding posture until the customer defines the consequence, risk floor, enforcement point, and proof requirements.

## Security Framing

The taxonomy matches the current agentic AI risk shape:

- prompt and output controls matter, but they do not close the risk once AI systems can act through tools
- sensitive data disclosure has to be controlled at release boundaries, not only in prompts
- delegated credentials and tool misuse are consequence problems when a downstream system accepts the result
- risk management needs governance, mapping, measurement, and management of real system effects

Attestor's answer to that shape is deliberately narrow: classify the proposed consequence, require the correct controls, return a bounded decision, and leave proof that downstream systems can verify.
