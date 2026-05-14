# F2-AG-10 Model / Tool / Config Drift Validation

Status: repository-side `partial`.

Source report:

- F2-AG-10: `model-tool-config-drift` was registered, but the report could not
  find a dedicated guard.

Repository finding:

- The finding is stale as written. Current `origin/master` has
  `src/consequence-admission/decision-context-drift-binding.ts`,
  `tests/decision-context-drift-binding.test.ts`,
  `docs/02-architecture/decision-context-drift-binding.md`, and failure-mode
  coverage entries for `model-tool-config-drift`.
- The implementation is intentionally a deterministic context-binding contract,
  not a model evaluation and not an independent runtime scanner.

What the current control does:

- Requires a supplied model version, tool schema digest, policy version, and
  config digest.
- Optionally binds tool manifest, policy digest, prompt digest, verifier digest,
  simulation digest, evaluation time, and expiry time.
- Returns `block` when required bound/current context evidence is missing.
- Returns `review` when model, tool schema, tool manifest, policy, config,
  prompt, verifier, simulation, expiry, or age drift is detected.
- Stores only context digests, dimensions, counts, and reason codes.

Why the status is not `fixed`:

- Attestor does not independently discover every customer runtime, scan every
  active tool schema, or evaluate model quality.
- Production use still needs runtime inventory, CI/CD change hooks, trace/eval
  execution, and customer-owned policy for when drift triggers review, new
  simulation, or block.

Research basis:

- NIST AI RMF treats AI risk management as lifecycle work, including monitoring,
  risk tracking, and change management.
- NIST AI 600-1 frames generative AI risk by lifecycle stage, system context,
  and integration behavior.
- OWASP LLM Top 10 2025 supply-chain guidance supports version-bound controls
  for models, tools, and dependencies.

Validation:

- `npm run test:decision-context-drift-binding`
- `npm run test:policy-foundry-drift-policy-debt-detector`
- `npm run test:f2-model-tool-config-drift-validation`

Claim boundary:

- Allowed claim: Attestor has a deterministic, digest-first decision-context
  drift binding for supplied model/tool/policy/config evidence.
- Not allowed claim: Attestor automatically scans every live customer runtime or
  proves model quality has not changed.
