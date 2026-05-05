# Audit Evidence Export

Audit evidence export is the reviewer packet for Attestor's shadow-to-enforcement path.

It is a reviewer packet, not a compliance certificate.

The export answers a narrow question:

```text
What evidence can a reviewer inspect to understand how Attestor controlled AI actions during this window?
```

It does not claim SOC 2 compliance, EU AI Act compliance, production readiness, or external audit completion. It packages control evidence that can support those reviews.

## Why It Exists

Shadow mode, policy discovery, simulations, promotion packets, downstream bindings, and protected adapters create useful proof, but a reviewer should not need to reconstruct the story from separate internal objects.

The audit evidence export creates one canonical, digest-first packet for a tenant-scoped time window:

```text
shadow events
  -> summary and simulation evidence
  -> policy discovery and promotion artifacts
  -> downstream integration proof references
  -> audit findings and control posture
  -> canonical export digest
```

The packet keeps the product posture honest: it shows what exists, what is missing, and what still requires approval.

The export can also reference a [tamper-evident history](tamper-evident-history.md) artifact. That history gives reviewers a digest-chain root for the source evidence sequence without turning the audit packet into a compliance certificate or immutable storage claim.

## Data Posture

The export is redacted by default.

It includes:

- event-set digest
- sampled event digests
- window start and end
- domain counts
- surface digests
- policy gap, review load, blocked, and non-enforcing counts
- artifact references by id and digest
- tamper-evident history digest and entry count when supplied
- audit findings
- alignment references for review planning

It does not include:

- raw model prompts or outputs
- raw customer identifiers
- raw bank, wallet, payment, or recipient details
- raw evidence references
- raw tool inputs
- raw downstream results or error bodies
- credentials or secrets

Surface names can be included only when the caller explicitly asks for them. The default export keeps surfaces as digests.

## Package Surface

The package surface is exported through `attestor/consequence-admission`.

Core functions:

- `createConsequenceAuditEvidenceExport(...)`
- `consequenceAuditEvidenceExportDescriptor()`

## Hosted Read Surface

The hosted shadow route exposes the same canonical packet for the current tenant:

```text
GET /api/v1/shadow/audit-evidence
```

The route is read-only, served with `cache-control: no-store`, and returns the audit evidence export plus explicit boundaries:

- `approvalRequired: true`
- `autoEnforce: false`
- `complianceClaimed: false`
- `productionReady: false`
- `rawPayloadStored: false`

It does not approve policy candidates, activate enforcement, or expose raw shadow payloads.

The export can reference these artifact kinds:

- `shadow-event-set`
- `shadow-summary`
- `shadow-simulation`
- `policy-discovery-candidates`
- `policy-promotion-packet`
- `downstream-integration-proof`
- `tamper-evident-history`

## Findings

The export produces structured findings instead of hiding gaps in prose.

Current finding kinds:

- `no-shadow-events`
- `raw-payload-present`
- `policy-gaps-present`
- `review-load-present`
- `blocked-actions-present`
- `policy-candidates-require-approval`
- `promotion-not-activation-ready`
- `downstream-proof-missing`
- `downstream-integration-incomplete`
- `redacted-export-ready`

`raw-payload-present` and `no-shadow-events` block review readiness. Policy gaps, promotion gaps, and downstream proof gaps remain visible as findings, but they do not become automatic enforcement instructions.

## Alignment References

The export carries alignment references for reviewer planning:

- `nist-ai-rmf-documentation-traceability`
- `eu-ai-act-logging-traceability-support`
- `soc2-system-generated-control-evidence`
- `owasp-security-logging-monitoring`

These are not certification claims. They describe the kinds of review questions the packet helps answer: documentation, traceability, system-generated control evidence, and security logging without raw sensitive payloads.

## Boundary

Audit evidence export does not activate policy, approve policy candidates, sign bundles, verify release tokens, or prove downstream enforcement by itself.

It is a control-evidence package. The enforcement chain still depends on:

- [Policy discovery candidates](policy-discovery-candidates.md)
- [Shadow policy simulation](shadow-policy-simulation.md)
- [Downstream enforcement contract](downstream-enforcement-contract.md)
- [Verifier helper](verifier-helper.md)
- [Adapter framework](adapter-framework.md)
- [Downstream integration proof](shadow-persistence-stores.md)
- [Tamper-evident history](tamper-evident-history.md)

The export should make audits easier. It should not make claims that belong to auditors, lawyers, regulators, or production operators.
