# F4 Prompt Leakage Marker Validation

Status: `fixed` for the scoped repository finding.

This note validates the F4-LLM07-A finding from the project-owner supplied OWASP LLM Top 10 redo:

```text
F4-LLM07-A prompt leakage second-pass markers missing
```

## Result

The finding is valid as a narrow repo-side gap and is now closed for the central data-minimization scanner.

Attestor already treated `raw-model-prompt` as a forbidden raw class. The missing piece was a distinct marker set for prompt leakage strings that may appear inside model-visible or externally visible material without being labeled as a forbidden raw class.

## Repository Evidence

- `CONSEQUENCE_DATA_MINIMIZATION_PROMPT_LEAKAGE_MARKERS` defines central prompt-leakage markers.
- `consequenceDataMinimizationRedactionPolicyDescriptor()` exposes `promptLeakageMarkers`.
- `CONSEQUENCE_DATA_MINIMIZATION_GOVERNANCE_REFS` includes `owasp-llm07-system-prompt-leakage`.
- `consequenceDataMinimizationMaterialSafetyFindings(...)` scans runtime secret markers, prompt-leakage markers, forbidden raw classes, and caller-provided extra markers.
- `evaluateConsequenceDataMinimizationArtifact(...)` turns scanner hits into stable reason codes such as `unsafe-material-detected` without echoing raw prompt-marker text.
- `tests/data-minimization-redaction-policy.test.ts` covers descriptor exposure, material scanning, artifact evaluation, and non-echoing reason codes.

## Control Boundary

This is a marker-based second-pass hygiene control. It is not a complete prompt-injection classifier, does not inspect every possible prompt wording, and does not prove production data handling or external audit readiness.

It closes the repo-side F4-LLM07-A gap by ensuring that the central scanner covers common system/developer/tool instruction leakage markers instead of relying only on the broader `raw-model-prompt` forbidden class.

## Sources

- OWASP Top 10 for LLM Applications 2025, LLM07 System Prompt Leakage: https://genai.owasp.org/llm-top-10/
- Attestor data minimization architecture: `docs/02-architecture/data-minimization-redaction-policy.md`
