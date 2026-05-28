# F4-LLM01-B Hosted LLM Boundary Conformance Validation

Status: `invalid-as-stated` for the scoped report claim.

Source report:

- F4-LLM01-B claimed the hosted LLM/agent tool boundary was descriptor-only
  and needed runtime conformance proof for the declared controls.

Repository finding:

- The descriptor exists in `src/service/hosted/hosted-llm-agent-tool-boundary-guard.ts`,
  but it is not unsupported prose.
- The package exposes `test:hosted-llm-agent-tool-boundary-guard`.
- That test validates descriptor uniqueness, declared routes, risk/control
  coverage, implementation evidence files, validation files, source-level
  control anchors, OpenAPI model-safe feedback markers, docs references, and
  the data-minimization material scanner.

Decision:

- The original "descriptor-only" wording is invalid as stated for current
  `origin/master`.
- The remaining boundary is narrower: these are repository conformance checks,
  not proof of a live hosted deployment, service restart, production env,
  readiness probe, or external smoke test.

Validation:

- `npm run test:f4-hosted-llm-boundary-conformance-validation`
- `npm run test:hosted-llm-agent-tool-boundary-guard`
- `npm run test:audit-remediation-tracker`
- `npm run test:package-script-runner`

Claim boundary:

- Attestor can claim repo-side hosted LLM/agent boundary conformance evidence.
- Attestor must not claim production hosted enforcement readiness from this
  alone.
