# Shadow Persistence Stores

Attestor shadow mode needs a durable evaluation trail before it can become useful policy discovery.

This first slice adds three local file-backed stores:

- shadow admission events, scoped by tenant
- shadow simulation reports, scoped by tenant
- shadow policy candidates, scoped by tenant and held behind an approval lifecycle

The goal is not automatic learning. The goal is:

```text
observe -> recommend -> approve -> enforce
```

Shadow events show what AI actions would have done. Policy candidates summarize possible controls, but they remain non-enforcing until a customer-controlled approval path promotes them.

Simulation reports replay the observed event set against a proposed mode, such as `review` or `enforce`, without changing downstream behavior. This gives teams an impact report before they tighten controls.

## Storage Boundary

These stores are evaluation/self-hosted first slices.

They are:

- file-backed
- atomically written
- guarded by process/file locks
- tenant-scoped at the record level
- data-minimized
- explicit about `productionReady: false`

They are not:

- a production shared database
- an immutable audit ledger
- a SIEM
- a policy authoring UI
- a replacement for customer-side enforcement

Production deployments should move this state into the shared authority/control plane with stronger durability, backup, retention, and operator controls.

## Shadow Admission Events

The admission event store persists records produced from the generic admission route.

The event stores:

- admission id and digest
- mode and shadow decision
- effective decision
- actor, action, domain, and downstream system
- action surface
- policy reference presence
- reason codes
- downstream and human outcome markers
- observed feature keys and digest
- evidence/native input counts

The event does not store raw recipient values, raw evidence ids, raw prompts, raw payloads, or raw observed feature values.

## Shadow Simulation Reports

Simulation reports are dry-run impact reports over already-recorded shadow admission events.

They store:

- report id and digest
- proposed mode
- event count
- event digests
- decision counts
- gap counts
- review/block impact
- surface-level simulations
- recommendations

They do not store raw event payloads, raw recipients, raw evidence ids, raw prompts, or raw observed feature values.

The hosted route exposes the simulation history surface:

```text
POST /api/v1/shadow/simulations
GET  /api/v1/shadow/simulations
GET  /api/v1/shadow/simulations/:reportId
```

The `POST` route creates a new impact report from current tenant-scoped shadow events and persists it. Listing and lookup return persisted reports without exposing the local backing file path.

Simulation creation requires an explicit `proposedMode`. The route does not silently choose an adoption mode for persisted reports. The summary surface may still generate an ephemeral review-mode view when no persisted simulation exists, but a stored impact report must say which mode it is replaying.

Simulation reports are analysis artifacts, not approval artifacts. They replay recorded shadow admission events under a proposed mode to estimate review/block impact. They do not prove that the underlying policy is correct, and they do not authorize a mode change. If shadow events were recorded during a bad configuration, the simulation can replay that bad configuration. Operators should verify the event capture boundary before treating recommendations as useful.

Recommendations can include `nextMode`, but that field is a suggested next adoption rung, not an instruction. A recommendation to promote toward `review` or `enforce` still requires customer-controlled approval and a separate promotion path.

The file-backed evaluation store has no automatic retention or pruning. Long-running deployments should move reports to the shared authority/control plane or add retention limits before treating this as production operational history.

## Policy Candidate Lifecycle

Policy candidates are derived from shadow-mode simulation reports.

Candidates are persisted with:

- `approvalRequired: true`
- `autoEnforce: false`
- `rawPayloadStored: false`
- source report id and digest
- candidate digest
- status history

The first lifecycle is intentionally conservative:

```text
draft -> proposed -> approved -> activated
draft/proposed/approved -> rejected or superseded
activated/rejected -> superseded
```

An `activated` candidate is still not automatic enforcement. It means the candidate has passed a customer-controlled approval path and can be used by a later policy/enforcement promotion workflow.

## Approval API Surface

The hosted shadow route exposes a small approval surface over this lifecycle:

```text
POST  /api/v1/shadow/policy-candidates/materialize
GET   /api/v1/shadow/policy-candidate-records
PATCH /api/v1/shadow/policy-candidates/:candidateId/status
```

Materialization turns the current shadow simulation output into persisted candidate records. Listing returns the persisted records for the current tenant. Status transition requires an explicit `status`, `actorRef`, and `reason`.

The API does not expose the local file path of the backing store, and status transitions keep `approvalRequired: true`, `autoEnforce: false`, and `rawPayloadStored: false`.

Invalid lifecycle jumps fail closed. For example, a `draft` candidate cannot move directly to `activated`; it must move through `proposed` and `approved` first.

## Policy Promotion Draft

The next hosted surface turns approved or activated candidates into a non-enforcing promotion review artifact:

```text
GET /api/v1/shadow/policy-promotion-draft
GET /api/v1/shadow/policy-promotion-draft?status=activated
```

The draft contains:

- approved candidate ids and digests
- source simulation report ids and digests
- action surface, domain, proposed mode, required controls, and reason codes
- approval actor refs and a digest of the approval trail
- `enforcementState: draft-only`

It deliberately keeps:

```text
approvalRequired: true
autoEnforce: false
rawPayloadStored: false
productionReady: false
```

The draft is not a policy bundle, not a deployment, and not a mode switch. It is the review packet that a later customer-controlled policy promotion workflow can consume.

## Policy Promotion Packet

The next surface turns the promotion draft into a policy promotion packet:

```text
GET /api/v1/shadow/policy-promotion-packet
GET /api/v1/shadow/policy-promotion-packet?status=activated
```

The packet carries a policy bundle draft with digest-bound rules:

- source promotion draft digest
- source simulation report digests
- candidate digests
- target mode and suggested validation actions
- required controls, reason codes, and approval-trail digest

The packet is still deliberately non-enforcing:

```text
reviewReady: true | false
activationReady: false
autoEnforce: false
productionReady: false
```

Activation remains blocked until later gates close:

- policy bundle simulation
- production signing boundary
- downstream verification binding

This mirrors policy-bundle and admission-control systems that separate recommendation, dry-run, signed bundle distribution, and live enforcement. The packet is a review artifact, not a deployable policy.

## Policy Promotion Simulation

The next surface replays the policy promotion packet against tenant-scoped shadow events:

```text
GET /api/v1/shadow/policy-promotion-simulation
GET /api/v1/shadow/policy-promotion-simulation?status=activated
```

This simulation answers:

```text
If this policy bundle draft had evaluated the recorded shadow events, what would it have done?
```

It reports:

- source packet and bundle draft digests
- matched and unmatched event counts
- per-rule matched event digests
- aggregate impact counts: admit, audit, warn, hold-for-review, block
- remaining activation blockers

Running this simulation closes only the `policy-simulation-required` blocker for the returned artifact. It does not close production signing or downstream verification. The response still keeps:

```text
activationReady: false
autoEnforce: false
rawPayloadStored: false
productionReady: false
```

The simulation uses shadow event metadata and digests. It does not store or return raw prompts, recipients, evidence ids, SQL, customer records, wallet material, payment secrets, or downstream response bodies.

## Policy Bundle Publication

The next surface prepares the simulated policy bundle for signed publication:

```text
GET /api/v1/shadow/policy-bundle-publication
GET /api/v1/shadow/policy-bundle-publication?status=activated
```

The publication artifact creates a canonical signing payload over:

- tenant id
- source packet digest
- source bundle draft digest
- source simulation digest
- target modes
- rule ids, candidate digests, source report digests, and rule digests

If no signing provider is configured, the artifact remains explicitly `unsigned` and the `bundle-signature-required` blocker stays open. If an evaluation signer is configured, the artifact can carry a detached Ed25519 signature over the canonical signing payload and close the local signature gate for that returned artifact.

Evaluation signatures do not claim production readiness. A runtime-memory or file-PEM signer still leaves `production-signing-provider-required` open. Production promotion needs a managed signing boundary, such as external KMS/HSM-style custody, before the bundle can be treated as a production trust anchor.

The response still keeps:

```text
activationReady: false
autoEnforce: false
rawPayloadStored: false
productionReady: false
```

This mirrors signed-policy systems where a digest alone is not enough. Downstream verifiers must validate the signature, signer identity, signed payload digest, source artifact chain, freshness, and scope before trusting a policy bundle.

## Downstream Verification Binding

The next surface turns the simulated promotion packet into a downstream verification binding draft:

```text
GET /api/v1/shadow/downstream-verification-binding
GET /api/v1/shadow/downstream-verification-binding?status=activated
```

The binding is the contract a customer enforcement point must verify before it treats an Attestor promotion artifact as executable. It carries:

- source simulation, packet, and bundle draft digests
- tenant scope
- rule ids, candidate digests, target modes, and matched event-set digests
- required downstream claims such as `tenantId`, `sourceSimulationDigest`, `admissionDigest`, `downstreamSystem`, `expiresAt`, and `replayNonce`
- required fail-closed checks for artifact signature, source digests, tenant scope, rule binding, admission digest, downstream scope, replay protection, and freshness

Generating this binding can close the `downstream-verification-required` draft blocker for the returned artifact, but it deliberately replaces it with `downstream-integration-proof-required`. A binding draft is not proof that a payment processor, queue consumer, gateway, wallet adapter, or record writer has actually enforced the contract.

The response still keeps:

```text
activationReady: false
autoEnforce: false
rawPayloadStored: false
productionReady: false
```

This follows the same discipline used by external authorization and signed-policy systems: the downstream side must verify the signed artifact chain, the intended audience/scope, freshness, replay resistance, and the exact rule/admission digest before a consequence can execute.

## Downstream Integration Proof

The next surface binds the signed publication, downstream verification binding, and customer-supplied integration evidence:

```text
POST /api/v1/shadow/downstream-integration-proof
POST /api/v1/shadow/downstream-integration-proof?status=activated
```

The request identifies the downstream enforcement point and supplies data-minimized evidence refs:

```json
{
  "enforcementPointId": "refund-service/ext-authz",
  "boundaryKind": "http-handler",
  "verifierRef": "verifier:refund-service-ci",
  "evidenceRefs": [
    {
      "id": "ci:run:123",
      "kind": "adapter-test",
      "digest": "sha256:...",
      "uri": "https://example.invalid/evidence/ci-run-123"
    }
  ],
  "observedVerificationChecks": [
    "verify-artifact-signature",
    "verify-source-digests",
    "verify-tenant-scope",
    "verify-rule-binding",
    "verify-admission-digest",
    "verify-downstream-scope",
    "verify-replay-protection",
    "verify-freshness",
    "hold-on-mismatch"
  ]
}
```

The proof does not store raw adapter config, request bodies, customer records, payment secrets, wallet material, or downstream response bodies. It records only refs, digests, the verifier reference, the enforcement point id, and the observed verification check names.

If every required binding check is represented, at least one evidence ref is present, the signed publication is ready, and the publication/binding source chain matches, the returned artifact can close `downstream-integration-proof-required` for that proof. It still keeps:

```text
activationReady: false
autoEnforce: false
rawPayloadStored: false
productionReady: false
```

This is integration evidence, not a production deployment guarantee. Evaluation signatures still leave `production-signing-provider-required` open, and customer systems must keep enforcing the verification contract at the actual execution point.

## Activation Readiness Gate

The final shadow promotion surface summarizes the whole chain:

```text
POST /api/v1/shadow/activation-readiness
POST /api/v1/shadow/activation-readiness?status=activated
```

It uses the same data-minimized downstream integration proof request body, then evaluates:

- promotion source status
- policy simulation presence
- signed policy bundle publication
- downstream verification binding
- downstream integration proof
- production signing boundary
- operator activation source status

The result is a single canonical readiness artifact with component statuses and remaining blockers. In an evaluation signer path, it remains blocked even when downstream integration evidence is complete:

```text
production-signing-provider-required
operator-activation-required
```

If the source candidates are already `activated`, the publication is signed with a production signing boundary, the downstream binding is ready, and the integration proof closes every required verifier check, the readiness state can become:

```text
customer-controlled-activation-eligible
```

This still does not auto-enforce. The route returns:

```text
autoEnforce: false
rawPayloadStored: false
productionReady: false
```

The gate is an activation readiness artifact, not a customer deployment switch. Customer systems must still perform the actual activation, keep the downstream verifier on the execution path, and retain their own rollback/kill-switch controls.

## Customer Activation Handoff

Activation readiness answers whether the Attestor-side promotion chain is eligible. The customer activation handoff adds the next boundary:

```text
POST /api/v1/shadow/customer-activation-handoff
POST /api/v1/shadow/customer-activation-handoff?status=activated
```

The request uses the same downstream integration proof body and adds customer-side activation controls:

```json
{
  "activationRef": "change:shadow-enforcement-activation-789",
  "operatorRef": "operator:security-reviewer",
  "rolloutStrategy": "canary",
  "rollbackRef": {
    "id": "runbook:rollback-shadow-enforcement",
    "kind": "deployment-rollback",
    "digest": "sha256:..."
  },
  "killSwitchRef": {
    "id": "flag:disable-shadow-enforcement",
    "kind": "feature-flag-disable",
    "digest": "sha256:..."
  },
  "monitoringRef": {
    "id": "slo:shadow-enforcement-error-budget",
    "kind": "slo-alarm",
    "digest": "sha256:..."
  }
}
```

The handoff records whether the customer has supplied:

- an operator activation reference
- a rollback plan reference
- a kill-switch reference
- a monitoring/alarm reference

These controls do not make Attestor a deployment orchestrator. They make the handoff explicit: customer systems can begin their controlled activation process only after the activation readiness gate is closed and customer rollback/kill-switch evidence is present.

The handoff still returns:

```text
approvalRequired: true
autoEnforce: false
rawPayloadStored: false
productionReady: false
```

It is a signed/canonical review artifact for the customer's activation process, not an instruction for Attestor to flip enforcement on by itself.

## Customer Activation Receipt

The handoff is pre-activation. The receipt is post-activation:

```text
POST /api/v1/shadow/customer-activation-receipt
```

The route accepts a previously generated customer activation handoff plus a data-minimized activation observation:

```json
{
  "handoff": {
    "version": "attestor.shadow-customer-activation-handoff.v1",
    "digest": "sha256:..."
  },
  "activationStatus": "activated",
  "attemptedAt": "2026-05-02T18:05:10.000Z",
  "observedAt": "2026-05-02T18:06:10.000Z",
  "activationDigest": "sha256:...",
  "externalReceiptDigest": "sha256:...",
  "rollbackStatus": "not-triggered",
  "killSwitchStatus": "verified",
  "monitoringStatus": "healthy"
}
```

The receipt can record:

- `activated`
- `rolled-back`
- `failed`
- `aborted`

It verifies that the handoff digest still matches the canonical handoff payload, that the handoff was actually ready, that timestamps are ordered, and that the status-specific evidence is present.

For an `activated` receipt, the customer must supply activation result evidence, verify the kill switch, and report healthy monitoring. A monitoring alarm or unverified kill switch keeps the receipt held. For a `rolled-back` receipt, rollback completion and rollback evidence are required. For `failed` or `aborted`, the receipt requires error evidence or an explicit abort reason.

The receipt does not store raw deployment output, alert payloads, operator identifiers, feature-flag values, payment responses, wallet data, or customer records. Operator refs are digested.

The response still returns:

```text
approvalRequired: true
autoEnforce: false
rawPayloadStored: false
productionReady: false
```

This closes the activation observation trail without making Attestor the deployer, rollback engine, feature-flag provider, or monitoring system.

## Why This Shape

This follows the same pattern used by mature control systems:

- observe real activity before tightening controls
- generate recommendations from observed activity
- keep recommendation state explicit
- require a human/operator transition before applying changes
- avoid storing sensitive raw input in decision logs

For Attestor, that maps to:

```text
AI action observed
shadow decision recorded
candidate policy/control inferred
customer approves or rejects
promotion draft generated for review
policy promotion packet generated
policy promotion packet simulated
policy bundle publication signed or held unsigned
downstream verification binding drafted
downstream integration proof supplied
activation readiness gate evaluated
customer activation handoff generated
customer activation receipt recorded or held
only then can enforcement promotion happen
```

That makes shadow mode useful for adoption without making unsafe claims about autonomous policy learning.
