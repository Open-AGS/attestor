export const HOSTED_LLM_AGENT_TOOL_BOUNDARY_GUARD_VERSION =
  'attestor.hosted-llm-agent-tool-boundary-guard.v1';

export type HostedLlmAgentToolBoundarySurface =
  | 'admission_model_feedback'
  | 'agent_retry_loop'
  | 'shadow_recommendation_read'
  | 'protected_adapter_execution'
  | 'proof_dashboard_problem_surface';

export type HostedLlmAgentToolBoundaryRisk =
  | 'prompt_injection_data_flow'
  | 'sensitive_information_disclosure'
  | 'system_prompt_leakage'
  | 'excessive_agency'
  | 'tool_misuse'
  | 'unsafe_retry_authority'
  | 'shadow_auto_enforce'
  | 'raw_tool_payload_leak'
  | 'provider_body_leak';

export type HostedLlmAgentToolBoundaryControl =
  | 'model_safe_feedback_only'
  | 'structured_output_schema'
  | 'safe_instruction_only'
  | 'operator_only_reasons_not_model_retryable'
  | 'retry_binding_required'
  | 'same_request_replay_rejected'
  | 'agent_loop_abuse_budget'
  | 'policy_probing_hold'
  | 'shadow_read_only'
  | 'shadow_no_auto_enforce'
  | 'customer_approval_required'
  | 'digest_only_shadow_evidence'
  | 'protected_adapter_verifies_before_execute'
  | 'raw_execute_not_exposed'
  | 'digest_only_tool_invocation'
  | 'credential_free_tool_record'
  | 'downstream_receipt_digest'
  | 'digest_first_proof_surface'
  | 'decision_support_only_dashboard'
  | 'fail_closed_problem_details'
  | 'data_minimization_policy'
  | 'no_raw_prompt_or_provider_body'
  | 'no_raw_provider_body_or_customer_record'
  | 'no_store_response';

export interface HostedLlmAgentToolBoundaryGuard {
  readonly id: string;
  readonly title: string;
  readonly surface: HostedLlmAgentToolBoundarySurface;
  readonly routes: readonly string[];
  readonly agentRisks: readonly HostedLlmAgentToolBoundaryRisk[];
  readonly requiredControls: readonly HostedLlmAgentToolBoundaryControl[];
  readonly modelBoundary: string;
  readonly toolAuthorityBoundary: string;
  readonly retryBoundary: string;
  readonly privacyBoundary: string;
  readonly implementationEvidence: readonly string[];
  readonly validation: readonly string[];
  readonly standards: readonly string[];
}

export const HOSTED_LLM_AGENT_TOOL_BOUNDARY_GUARDS: readonly HostedLlmAgentToolBoundaryGuard[] = [
  {
    id: 'admission.model-safe-feedback',
    title: 'Admission model-safe feedback boundary',
    surface: 'admission_model_feedback',
    routes: ['POST /api/v1/admissions'],
    agentRisks: [
      'prompt_injection_data_flow',
      'sensitive_information_disclosure',
      'system_prompt_leakage',
      'unsafe_retry_authority',
    ],
    requiredControls: [
      'model_safe_feedback_only',
      'structured_output_schema',
      'safe_instruction_only',
      'operator_only_reasons_not_model_retryable',
      'fail_closed_problem_details',
      'data_minimization_policy',
      'no_raw_prompt_or_provider_body',
      'no_store_response',
    ],
    modelBoundary:
      'Admission responses expose structured reason codes, safe instructions, missing field names, and evidence kind names only; raw prompts, raw model output, provider bodies, and customer payload bodies stay outside model feedback.',
    toolAuthorityBoundary:
      'The admission response is a decision contract, not a tool-call capability grant; downstream execution remains behind customer code or a protected adapter verifier.',
    retryBoundary:
      'Model retries are limited to correction catalog entries marked retryableByModel, while operator-only reasons stay non-retryable by model feedback.',
    privacyBoundary:
      'Fail-closed problem details and model feedback use redacted machine-readable fields and no-store responses, not debug traces or raw provider data.',
    implementationEvidence: [
      'src/consequence-admission/index.ts#ConsequenceAdmissionFeedback',
      'src/consequence-admission/data-minimization-redaction-policy.ts',
      'src/service/http/routes/generic-admission-routes.ts',
      'docs/api/attestor-action-authorization.openapi.json',
    ],
    validation: [
      'tests/consequence-admission-contract.test.ts',
      'tests/data-minimization-redaction-policy.test.ts',
      'tests/generic-admission-routes.test.ts',
      'tests/hosted-action-authorization-openapi.test.ts',
    ],
    standards: [
      'OWASP LLM02:2025 Sensitive Information Disclosure',
      'OWASP LLM07:2025 System Prompt Leakage',
      'OpenAI agent safety: structured outputs and private data leakage controls',
    ],
  },
  {
    id: 'agent.retry-loop-authority',
    title: 'Agent retry and correction authority boundary',
    surface: 'agent_retry_loop',
    routes: ['POST /api/v1/admissions'],
    agentRisks: [
      'excessive_agency',
      'tool_misuse',
      'unsafe_retry_authority',
      'prompt_injection_data_flow',
    ],
    requiredControls: [
      'retry_binding_required',
      'same_request_replay_rejected',
      'operator_only_reasons_not_model_retryable',
      'agent_loop_abuse_budget',
      'policy_probing_hold',
      'safe_instruction_only',
      'data_minimization_policy',
    ],
    modelBoundary:
      'Retry guidance gives the model only safe correction categories and bounded retry metadata; it does not reveal private thresholds or allow prompt-driven escalation.',
    toolAuthorityBoundary:
      'A retry attempt is another admission input, not permission to call downstream tools or bypass customer review.',
    retryBoundary:
      'Retries must bind previous admission id, admission digest, previous request id, attempt number, and correction reason codes; same-request replay and operator-only correction retries fail closed.',
    privacyBoundary:
      'Retry ledgers and agent-loop records store digests, reason codes, attempt counts, and safe instructions without raw prompts, raw tool payloads, private thresholds, or replay keys.',
    implementationEvidence: [
      'src/consequence-admission/index.ts#createAdmissionRetryGuidance',
      'src/consequence-admission/index.ts#evaluateConsequenceAdmissionRetryBudget',
      'src/consequence-admission/agent-loop-abuse-guard.ts',
      'src/consequence-admission/retry-attempt-ledger.ts',
    ],
    validation: [
      'tests/consequence-admission-contract.test.ts',
      'tests/consequence-admission-agent-loop-abuse-guard.test.ts',
      'tests/agent-retry-wrapper-demo.test.ts',
      'tests/retry-attempt-ledger.test.ts',
    ],
    standards: [
      'OWASP LLM06:2025 Excessive Agency',
      'OWASP Agentic Applications 2026: Tool Misuse and autonomy controls',
      'NIST AI RMF: risk management should be operationalized and monitored',
    ],
  },
  {
    id: 'shadow.recommendation-read-boundary',
    title: 'Shadow recommendation read boundary',
    surface: 'shadow_recommendation_read',
    routes: [
      'GET /api/v1/shadow/summary',
      'GET /api/v1/shadow/recommendations',
      'GET /api/v1/shadow/action-risk-inventory',
      'GET /api/v1/shadow/policy-candidates',
    ],
    agentRisks: [
      'shadow_auto_enforce',
      'sensitive_information_disclosure',
      'raw_tool_payload_leak',
      'provider_body_leak',
      'excessive_agency',
    ],
    requiredControls: [
      'shadow_read_only',
      'shadow_no_auto_enforce',
      'customer_approval_required',
      'digest_only_shadow_evidence',
      'data_minimization_policy',
      'no_raw_provider_body_or_customer_record',
      'no_store_response',
    ],
    modelBoundary:
      'Shadow read routes expose summaries, counts, recommendations, approval state, and digests rather than raw prompts, raw tools, customer records, provider bodies, or private policy thresholds.',
    toolAuthorityBoundary:
      'Shadow recommendations cannot activate policy, approve candidates, or authorize execution; customer approval and promotion routes remain separate controls.',
    retryBoundary:
      'Shadow reads cannot manufacture retry authority because they return decision-support material only and do not mint retry bindings.',
    privacyBoundary:
      'Shadow event aggregation is digest-first and no-store, with explicit rawPayloadStored false surfaces and approvalRequired true for candidate promotion material.',
    implementationEvidence: [
      'src/service/http/routes/shadow-routes.ts',
      'src/consequence-admission/shadow-events.ts',
      'src/consequence-admission/shadow-summary.ts',
      'src/consequence-admission/shadow-simulation.ts',
      'src/consequence-admission/policy-discovery-candidates.ts',
      'src/consequence-admission/action-risk-inventory.ts',
    ],
    validation: [
      'tests/shadow-summary-routes.test.ts',
      'tests/shadow-summary-surface.test.ts',
      'tests/shadow-policy-simulation.test.ts',
      'tests/policy-discovery-candidates.test.ts',
      'tests/action-risk-inventory.test.ts',
      'tests/hosted-action-authorization-openapi.test.ts',
    ],
    standards: [
      'OWASP LLM02:2025 Sensitive Information Disclosure',
      'OWASP LLM06:2025 Excessive Agency',
      'OpenAI agent safety: tool approvals and structured data flow',
    ],
  },
  {
    id: 'adapter.protected-tool-execution',
    title: 'Protected adapter tool execution boundary',
    surface: 'protected_adapter_execution',
    routes: ['package: @attestor/consequence-admission adapter framework'],
    agentRisks: [
      'tool_misuse',
      'excessive_agency',
      'raw_tool_payload_leak',
      'provider_body_leak',
      'unsafe_retry_authority',
    ],
    requiredControls: [
      'protected_adapter_verifies_before_execute',
      'raw_execute_not_exposed',
      'digest_only_tool_invocation',
      'credential_free_tool_record',
      'downstream_receipt_digest',
      'data_minimization_policy',
    ],
    modelBoundary:
      'Adapters receive verified admission objects and digest references instead of letting a model directly pass raw command bodies into privileged execution surfaces.',
    toolAuthorityBoundary:
      'Protected adapters verify Attestor admission before execution, keep rawExecute unavailable, and record invocation, idempotency, input, and result material as digests.',
    retryBoundary:
      'Adapter execution does not create retry permission; held or failed adapters return receipts that must re-enter normal admission and retry controls.',
    privacyBoundary:
      'Adapter receipts store verification and result digests without raw inputs, raw outputs, credentials, wallet material, or provider response bodies.',
    implementationEvidence: [
      'src/consequence-admission/adapter-framework.ts',
      'src/consequence-admission/downstream-enforcement-contract.ts',
      'src/consequence-admission/verifier-helper.ts',
      'docs/02-architecture/adapter-framework.md',
    ],
    validation: [
      'tests/consequence-admission-adapter-framework.test.ts',
      'tests/downstream-enforcement-contract.test.ts',
      'tests/consequence-verifier-helper.test.ts',
      'scripts/probe/probe-consequence-admission-package-surface.mjs',
    ],
    standards: [
      'OWASP Agentic Applications 2026: Tool Misuse and privilege controls',
      'OWASP LLM06:2025 Excessive Agency',
      'OpenAI agent safety: tool approvals and human confirmation for MCP tools',
    ],
  },
  {
    id: 'proof.dashboard.problem-surface',
    title: 'Proof, dashboard, and problem-detail surface boundary',
    surface: 'proof_dashboard_problem_surface',
    routes: [
      'GET /api/v1/shadow/audit-evidence',
      'GET /api/v1/shadow/business-risk-dashboard',
      'GET /api/v1/shadow/dashboard-summary',
      'RFC 9457 fail-closed problem responses',
    ],
    agentRisks: [
      'sensitive_information_disclosure',
      'system_prompt_leakage',
      'provider_body_leak',
      'shadow_auto_enforce',
    ],
    requiredControls: [
      'digest_first_proof_surface',
      'decision_support_only_dashboard',
      'fail_closed_problem_details',
      'data_minimization_policy',
      'no_raw_provider_body_or_customer_record',
      'no_store_response',
    ],
    modelBoundary:
      'Proof and problem surfaces are reviewer/operator evidence, not model prompt context; they publish digests, statuses, counts, and reason codes instead of private raw material.',
    toolAuthorityBoundary:
      'Dashboard and proof routes cannot authorize downstream tools, infer financial impact, or promote policy without explicit customer approval gates.',
    retryBoundary:
      'Problem details fail closed and expose stable reason codes, not hidden thresholds or retry workarounds.',
    privacyBoundary:
      'Audit, dashboard, external-review, and problem surfaces are governed by the shared data-minimization policy and no-store HTTP boundary.',
    implementationEvidence: [
      'src/consequence-admission/audit-evidence-export.ts',
      'src/consequence-admission/business-risk-dashboard.ts',
      'src/consequence-admission/dashboard-api-summary.ts',
      'src/consequence-admission/external-review-packet.ts',
      'src/consequence-admission/data-minimization-redaction-policy.ts',
      'docs/api/attestor-action-authorization.openapi.json',
    ],
    validation: [
      'tests/consequence-audit-evidence-export.test.ts',
      'tests/consequence-business-risk-dashboard.test.ts',
      'tests/consequence-dashboard-api-summary.test.ts',
      'tests/consequence-external-review-packet.test.ts',
      'tests/data-minimization-redaction-policy.test.ts',
      'tests/hosted-action-authorization-openapi.test.ts',
    ],
    standards: [
      'OWASP LLM02:2025 Sensitive Information Disclosure',
      'OWASP LLM07:2025 System Prompt Leakage',
      'NIST AI RMF: documented and monitored risk controls',
    ],
  },
] as const;

export function hostedLlmAgentToolBoundaryGuardProfile(): {
  readonly version: string;
  readonly posture: string;
  readonly unresolvedProductionDependency: string;
  readonly guards: readonly HostedLlmAgentToolBoundaryGuard[];
} {
  return {
    version: HOSTED_LLM_AGENT_TOOL_BOUNDARY_GUARD_VERSION,
    posture:
      'Hosted model feedback, agent retry, shadow recommendation, protected adapter, proof, dashboard, and problem-detail surfaces keep model context, tool authority, raw payload material, and retry authority separated by explicit contracts.',
    unresolvedProductionDependency:
      'Repo-side LLM/agent tool-use boundary guards do not replace live deployment env, service restart, readiness probes, webhook smoke tests, or hosted product smoke tests on a working deployment target.',
    guards: HOSTED_LLM_AGENT_TOOL_BOUNDARY_GUARDS,
  };
}

export function requireHostedLlmAgentToolBoundaryGuard(
  id: string,
): HostedLlmAgentToolBoundaryGuard {
  const guard = HOSTED_LLM_AGENT_TOOL_BOUNDARY_GUARDS.find((entry) => entry.id === id);
  if (!guard) {
    throw new Error(`Hosted LLM/agent tool-use boundary guard '${id}' was not found.`);
  }
  return guard;
}
