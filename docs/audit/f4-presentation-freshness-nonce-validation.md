# F4-LLM05-A Presentation Freshness Nonce Validation

Status: repository-side `fixed` for the scoped finding.

Source report:

- F4-LLM05-A said presentation freshness relied on operator-supplied clocks and
  lacked an Attestor-issued nonce / server-rendered freshness binding.

Repository finding:

- Presentation binding already supported nonces, expiry windows, replay keys,
  body digests, and fail-closed freshness checks.
- The missing repository slice was a first-class Attestor-issued freshness nonce
  helper and digest-based expected nonce comparison.

Remediation:

- Added `createConsequenceAdmissionPresentationFreshnessNonce(...)`.
- Added `expected.nonceDigest` verification so evaluators can check a
  server-issued nonce by digest without serializing the raw nonce in decisions.
- Added descriptor metadata showing Attestor-issued freshness nonce support.

Validation:

- `npm run test:f4-presentation-freshness-nonce-validation`
- `npm run test:downstream-presentation-binding`
- `npm run test:audit-remediation-tracker`
- `npm run test:package-script-runner`

Claim boundary:

- This closes the repository presentation-freshness helper gap.
- It does not prove a live customer enforcement point consumes nonces from a
  shared atomic store; that is tracked separately under replay/shared-ledger
  work.
