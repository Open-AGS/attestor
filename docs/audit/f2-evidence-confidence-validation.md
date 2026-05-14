# F2-AG-6 / F4-LLM09-A Evidence Confidence Validation

Status: `partial`.

Scope:

- F2-AG-6: unsupported confidence / hallucinated evidence.
- F4-LLM09-A: OWASP LLM09:2025 Misinformation, specifically unsupported claims and hallucinated evidence references.

This validation uses `origin/master` as the source of truth. It does not rely on the stale worktree-era claim that Attestor had no coverage for this failure mode.

## External Source Check

OWASP defines `LLM09:2025 Misinformation` as false or misleading LLM output that appears credible. OWASP calls out hallucination, unsupported claims, overreliance, and the need for cross-verification, trusted external sources, human oversight, automatic validation, and clear risk communication.

This matches Attestor's `unsupported-confidence-or-hallucinated-evidence` failure mode: an AI or adapter can present a credible-looking evidence reference, confidence claim, or proof digest without proving the underlying source artifact actually exists and matches that digest.

Source:

- https://genai.owasp.org/llmrisk/llm092025-misinformation/

## Current Repo Evidence

Attestor now has repository-side coverage for this risk:

- `src/consequence-admission/failure-mode-control-bindings.ts` binds `unsupported-confidence-or-hallucinated-evidence` to:
  - `trusted-evidence-required`
  - `human-review-packet-must-highlight-risk`
  - `decision-context-version-must-be-bound`
  - required evidence: `evidence-ref`, `proof-digest`, `source-system-verification`
  - required audit records: `unsupported-claim-record`, `proof-digest-record`
- `src/consequence-admission/failure-mode-guard-coverage.ts` classifies it as deterministic contract coverage, not a dedicated guard.
- `src/consequence-admission/audit-evidence-export.ts` emits digest-first audit evidence exports and explicitly keeps `rawPayloadStored: false`, `complianceClaimed: false`, and `productionReady: false`.
- `src/consequence-admission/external-review-packet.ts` normalizes SHA-256 evidence digests, binds review packets to audit evidence digests, and states non-claims such as `not-customer-enforcement-proof-by-itself`.

Existing tests already verify those contract pieces:

- `npm run test:failure-mode-control-bindings`
- `npm run test:failure-mode-guard-coverage`
- `npm run test:consequence-audit-evidence-export`
- `npm run test:consequence-external-review-packet`

## What Is Not Proven

The original "no guard exists" wording is stale, but the finding is not fixed.

Current code does not provide a universal source-system verifier that independently re-fetches or re-hashes every external evidence artifact behind an arbitrary `evidence-ref`.

The repo can currently prove:

- the failure mode is registered and bound to required controls;
- audit and review packets carry canonical digests;
- review artifacts are digest-first and do not claim raw payload storage;
- the limitation is explicit and non-production.

The repo cannot yet prove, for every domain and customer workflow:

- that the referenced source artifact exists at the source system;
- that Attestor independently re-fetched the artifact;
- that Attestor independently re-hashed the artifact;
- that the source system is authoritative for that evidence class;
- that an `admit` decision always includes at least one source-system verified proof.

## Status Decision

`partial`.

Reason:

- Not `open`: the control binding, guard coverage matrix, audit evidence export, external review packet, docs, and tests are real repository evidence.
- Not `fixed`: source-system verification is still domain/customer specific, and there is no universal re-fetch/re-hash verifier contract enforced before admit.

## Required Follow-Up

To close this as `fixed`, Attestor needs a source-system evidence verifier contract.

Minimum closure criteria:

1. Define a `source-system-verification` evidence contract with verifier identity, source authority, timestamp, artifact digest, and verification status.
2. Require at least one source-system verified proof for `admit` on high-impact actions that rely on external evidence.
3. Fail closed to `review` or `block` when evidence is only a URI, summary, model statement, operator assertion, or unverified digest.
4. Add replay cases for hallucinated evidence URI, digest-only fake proof, missing source artifact, mismatched re-hash, and non-authoritative source.
5. Keep public docs explicit that digest-first review packets are not themselves source-system truth.

## Tracker Effect

- F2-AG-6 moves from `needs-revalidation` to `partial`.
- F4-LLM09-A moves from `needs-revalidation` to `partial`.
- No production, compliance, or complete hallucination-prevention claim is made.
