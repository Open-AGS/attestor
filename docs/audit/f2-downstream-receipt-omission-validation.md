# F2-AG-5 Hidden Downstream Side-Effect / Receipt Omission Validation

Status: `partial`.

This note validates the project-owner supplied finding that an admitted
downstream action can become a hidden side effect if execution happens but no
receipt is returned to Attestor.

## Scope

Files inspected:

- `src/consequence-admission/downstream-enforcement-contract.ts`
- `src/consequence-admission/downstream-execution-receipt.ts`
- `src/consequence-admission/failure-mode-guard-coverage.ts`
- `src/consequence-admission/failure-mode-control-bindings.ts`
- `src/consequence-admission/policy-foundry-outcome-feedback-loop.ts`
- `src/consequence-admission/policy-foundry-live-downstream-replay.ts`
- `tests/downstream-execution-receipt.test.ts`
- `tests/downstream-enforcement-contract.test.ts`
- `tests/policy-foundry-outcome-feedback-loop.test.ts`
- `tests/policy-foundry-live-downstream-replay.test.ts`

Research anchor:

- CloudEvents provides a common event envelope shape for recording event source,
  subject, time, and data digest metadata. Attestor's downstream execution
  receipt uses this shape for recorded consequence outcomes.
- Source: `https://cloudevents.io`.

## Validation Result

The original finding is stale if it says Attestor has no downstream execution
receipt model.

The repo has multiple controls:

- `downstream-execution-receipt.ts` records `succeeded`, `failed`, or `skipped`
  execution status after admission, presentation binding, and replay consumption.
- The receipt path holds when replay was not consumed, target digest mismatches,
  downstream system mismatches, execution predates replay consumption,
  completion predates execution, raw result/error/receipt material is supplied,
  or required status-specific evidence is missing.
- Recorded receipts are digest-only and CloudEvents-compatible.
- `failure-mode-guard-coverage.ts` maps `hidden-downstream-side-effect` to a
  deterministic contract with `runtimeClaim: 'detects-gap'`.
- `failure-mode-control-bindings.ts` requires side-effect inventory,
  reversibility class, and execution receipt evidence.
- `policy-foundry-outcome-feedback-loop.ts` treats `no-downstream-receipts` and
  `missing-receipts-after-review` as no-go reasons.
- Existing tests prove successful receipts record, unconsumed replay holds,
  missing success/failure/skip evidence holds, raw downstream material is
  rejected, and incomplete/negative feedback remains collecting.

The finding remains valid in a narrower form.

There is no repo-proven runtime `receiptDeadline` or automatic escalation path
that says:

```text
admission was presented/consumed
expected execution receipt did not arrive before deadline
therefore future admissions for the actor/workflow/downstream system are held
or blocked until reconciled
```

Policy Foundry detects missing receipts as feedback no-go input, but that output
is explicitly `scoringInputOnly`, `productionReady: false`, and
`activatesEnforcement: false`.

## Corrected Finding

F2-AG-5 should not say "Attestor cannot model downstream execution receipts."
That is stale.

It should say:

```text
Attestor has downstream enforcement and execution receipt contracts, and Policy
Foundry can detect missing receipts as a no-go feedback signal. The remaining
gap is runtime receipt-deadline enforcement: if a consumed/admitted action never
returns a receipt, Attestor does not yet escalate that omission into a hold or
block on the next related admission.
```

## Remaining Work

Before this can be marked `fixed`, the downstream execution path needs a
repo-proven receipt-deadline contract with at least:

- expected receipt deadline derived from presentation consumption or admitted
  action class
- correlation key for admission, actor, workflow, downstream system, and
  idempotency/replay key
- durable pending-execution state
- reconciliation outcome for received, missing, late, failed, and mismatched
  receipts
- fail-closed policy for related future admissions while unreconciled missing
  receipts remain
- audit record that does not store raw downstream payloads

Current repo evidence supports `partial`, not `fixed`.

## Tests

Focused test:

```bash
npm run test:f2-downstream-receipt-omission-validation
```

Related tests:

```bash
npm run test:downstream-execution-receipt
npm run test:downstream-enforcement-contract
npm run test:policy-foundry-outcome-feedback-loop
npm run test:policy-foundry-live-downstream-replay
```
