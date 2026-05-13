import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';

export const CONSEQUENCE_FAILURE_MODE_REGISTRY_VERSION =
  'attestor.consequence-failure-mode-registry.v1';

export const CONSEQUENCE_FAILURE_MODE_SEVERITIES = [
  'medium',
  'high',
  'blocker',
] as const;
export type ConsequenceFailureModeSeverity =
  typeof CONSEQUENCE_FAILURE_MODE_SEVERITIES[number];

export const CONSEQUENCE_FAILURE_MODE_PROTECTED_PRINCIPLES = [
  'proof integrity',
  'fail-closed boundary',
  'tenant isolation',
  'customer authority',
  'data minimization and redaction',
  'no overclaim',
  'runtime readiness',
  'release provenance',
  'auditability',
  'replay/idempotency safety',
  'operational boundedness',
] as const;
export type ConsequenceFailureModeProtectedPrinciple =
  typeof CONSEQUENCE_FAILURE_MODE_PROTECTED_PRINCIPLES[number];

export const CONSEQUENCE_FAILURE_MODE_DEFAULT_DECISIONS = [
  'narrow',
  'review',
  'block',
] as const;
export type ConsequenceFailureModeDefaultDecision =
  typeof CONSEQUENCE_FAILURE_MODE_DEFAULT_DECISIONS[number];

export const CONSEQUENCE_FAILURE_MODE_CLASSIFICATIONS = [
  'model-quality',
  'system-design',
  'authority',
  'evidence',
  'policy',
  'workflow',
  'auditability',
  'security',
  'human-oversight',
] as const;
export type ConsequenceFailureModeClassification =
  typeof CONSEQUENCE_FAILURE_MODE_CLASSIFICATIONS[number];

export const CONSEQUENCE_FAILURE_MODE_SOURCE_IDS = [
  'nist-ai-600-1',
  'owasp-llm-top10-2025',
  'owasp-agentic-top10-2026',
  'ncsc-prompt-injection',
  'microsoft-indirect-prompt-injection',
  'openai-agent-builder-safety',
  'agentdojo',
  'the-agent-company',
  'echoleak',
] as const;
export type ConsequenceFailureModeSourceId =
  typeof CONSEQUENCE_FAILURE_MODE_SOURCE_IDS[number];

export const CONSEQUENCE_FAILURE_MODE_IDS = [
  'direct-prompt-injection',
  'indirect-prompt-injection',
  'untrusted-content-authorizes-action',
  'tool-misuse-excessive-agency',
  'tool-result-poisoning',
  'sensitive-data-disclosure',
  'cross-tenant-leakage',
  'wrong-recipient-disclosure',
  'fake-approval-laundering',
  'stale-authority-or-policy',
  'no-go-hold-bypass',
  'scope-explosion',
  'duplicate-execution-replay',
  'review-required-auto-promote',
  'human-review-fatigue',
  'model-tool-config-drift',
  'multi-agent-delegation-confusion',
  'hidden-downstream-side-effect',
  'unsupported-confidence-or-hallucinated-evidence',
  'agentic-supply-chain-compromise',
] as const;
export type ConsequenceFailureModeId =
  typeof CONSEQUENCE_FAILURE_MODE_IDS[number];

export interface ConsequenceFailureModeSourceRef {
  readonly id: ConsequenceFailureModeSourceId;
  readonly title: string;
  readonly url: string;
  readonly sourceKind: 'standard' | 'security-guidance' | 'vendor-guidance' | 'academic' | 'incident-case';
}

export interface ConsequenceFailureModeRepositoryEvidenceRef {
  readonly kind: 'code' | 'test' | 'doc';
  readonly path: string;
  readonly symbolOrSection: string;
}

export interface ConsequenceFailureModeRegistryEntry {
  readonly id: ConsequenceFailureModeId;
  readonly name: string;
  readonly summary: string;
  readonly classifications: readonly ConsequenceFailureModeClassification[];
  readonly severity: ConsequenceFailureModeSeverity;
  readonly protectedPrinciples: readonly ConsequenceFailureModeProtectedPrinciple[];
  readonly sourceRefs: readonly ConsequenceFailureModeSourceId[];
  readonly requiredControls: readonly string[];
  readonly defaultDecision: ConsequenceFailureModeDefaultDecision;
  readonly repositoryEvidence: readonly ConsequenceFailureModeRepositoryEvidenceRef[];
  readonly limitation: string;
}

export interface ConsequenceFailureModeRegistry {
  readonly version: typeof CONSEQUENCE_FAILURE_MODE_REGISTRY_VERSION;
  readonly entryCount: number;
  readonly entries: readonly ConsequenceFailureModeRegistryEntry[];
  readonly sources: readonly ConsequenceFailureModeSourceRef[];
  readonly severityValues: typeof CONSEQUENCE_FAILURE_MODE_SEVERITIES;
  readonly defaultDecisionValues: typeof CONSEQUENCE_FAILURE_MODE_DEFAULT_DECISIONS;
  readonly protectedPrinciples: typeof CONSEQUENCE_FAILURE_MODE_PROTECTED_PRINCIPLES;
  readonly classifications: typeof CONSEQUENCE_FAILURE_MODE_CLASSIFICATIONS;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
  readonly rawPayloadStored: false;
  readonly limitation: string;
  readonly canonical: string;
  readonly digest: string;
}

function canonicalObject(value: CanonicalReleaseJsonValue): {
  readonly canonical: string;
  readonly digest: string;
} {
  const canonical = canonicalizeReleaseJson(value);
  return Object.freeze({
    canonical,
    digest: `sha256:${createHash('sha256').update(canonical).digest('hex')}`,
  });
}

const SOURCE_REFS: readonly ConsequenceFailureModeSourceRef[] = Object.freeze([
  {
    id: 'nist-ai-600-1',
    title: 'NIST AI 600-1: Artificial Intelligence Risk Management Framework: Generative AI Profile',
    url: 'https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence',
    sourceKind: 'standard',
  },
  {
    id: 'owasp-llm-top10-2025',
    title: 'OWASP Top 10 for LLM Applications 2025',
    url: 'https://genai.owasp.org/resource/owasp-top-10-for-llm-applications-2025/',
    sourceKind: 'security-guidance',
  },
  {
    id: 'owasp-agentic-top10-2026',
    title: 'OWASP Top 10 for Agentic Applications 2026',
    url: 'https://genai.owasp.org/2025/12/09/owasp-top-10-for-agentic-applications-the-benchmark-for-agentic-security-in-the-age-of-autonomous-ai/',
    sourceKind: 'security-guidance',
  },
  {
    id: 'ncsc-prompt-injection',
    title: 'NCSC: Prompt injection is not SQL injection',
    url: 'https://www.ncsc.gov.uk/blog-post/prompt-injection-is-not-sql-injection',
    sourceKind: 'security-guidance',
  },
  {
    id: 'microsoft-indirect-prompt-injection',
    title: 'Microsoft: Defend against indirect prompt injection attacks',
    url: 'https://learn.microsoft.com/en-us/security/zero-trust/sfi/defend-indirect-prompt-injection',
    sourceKind: 'vendor-guidance',
  },
  {
    id: 'openai-agent-builder-safety',
    title: 'OpenAI: Safety in building agents',
    url: 'https://developers.openai.com/api/docs/guides/agent-builder-safety',
    sourceKind: 'vendor-guidance',
  },
  {
    id: 'agentdojo',
    title: 'AgentDojo: A Dynamic Environment to Evaluate Prompt Injection Attacks and Defenses for LLM Agents',
    url: 'https://arxiv.org/abs/2406.13352',
    sourceKind: 'academic',
  },
  {
    id: 'the-agent-company',
    title: 'TheAgentCompany: Benchmarking LLM Agents on Consequential Real World Tasks',
    url: 'https://arxiv.org/abs/2412.14161',
    sourceKind: 'academic',
  },
  {
    id: 'echoleak',
    title: 'EchoLeak: Zero-click prompt injection in a production LLM system',
    url: 'https://arxiv.org/abs/2509.10540',
    sourceKind: 'incident-case',
  },
]);

function evidence(
  kind: ConsequenceFailureModeRepositoryEvidenceRef['kind'],
  path: string,
  symbolOrSection: string,
): ConsequenceFailureModeRepositoryEvidenceRef {
  return Object.freeze({ kind, path, symbolOrSection });
}

function entry(input: ConsequenceFailureModeRegistryEntry): ConsequenceFailureModeRegistryEntry {
  return Object.freeze({
    ...input,
    classifications: Object.freeze([...input.classifications]),
    protectedPrinciples: Object.freeze([...input.protectedPrinciples]),
    sourceRefs: Object.freeze([...input.sourceRefs]),
    requiredControls: Object.freeze([...input.requiredControls]),
    repositoryEvidence: Object.freeze([...input.repositoryEvidence]),
  });
}

const COMMON_REVIEW_LIMITATION =
  'Registry membership is a control requirement, not proof that every customer workflow is covered.';

export const CONSEQUENCE_FAILURE_MODE_REGISTRY_ENTRIES: readonly ConsequenceFailureModeRegistryEntry[] =
Object.freeze([
  entry({
    id: 'direct-prompt-injection',
    name: 'Direct prompt injection',
    summary: 'A direct user or caller instruction attempts to override intended agent or admission behavior.',
    classifications: ['security', 'system-design'],
    severity: 'high',
    protectedPrinciples: ['customer authority', 'fail-closed boundary'],
    sourceRefs: ['owasp-llm-top10-2025', 'owasp-agentic-top10-2026', 'ncsc-prompt-injection'],
    requiredControls: [
      'prompt-injection-signal-review',
      'reason-code-policy-check',
      'customer-review-boundary',
    ],
    defaultDecision: 'review',
    repositoryEvidence: [
      evidence('code', 'src/consequence-admission/action-surface-onboarding-red-team-fixtures.ts', 'malicious-summary'),
      evidence('test', 'tests/policy-foundry-red-team-replay.test.ts', 'malicious summary signal case'),
    ],
    limitation: COMMON_REVIEW_LIMITATION,
  }),
  entry({
    id: 'indirect-prompt-injection',
    name: 'Indirect prompt injection',
    summary: 'Untrusted email, document, website, plugin, or tool-returned content is treated as instruction.',
    classifications: ['security', 'system-design'],
    severity: 'blocker',
    protectedPrinciples: ['customer authority', 'fail-closed boundary', 'data minimization and redaction'],
    sourceRefs: [
      'ncsc-prompt-injection',
      'microsoft-indirect-prompt-injection',
      'openai-agent-builder-safety',
      'agentdojo',
      'echoleak',
    ],
    requiredControls: [
      'untrusted-content-isolation',
      'structured-field-extraction',
      'tool-boundary-monitoring',
      'customer-review-boundary',
    ],
    defaultDecision: 'block',
    repositoryEvidence: [
      evidence('code', 'src/service/hosted-llm-agent-tool-boundary-guard.ts', 'hosted LLM agent tool boundary guard'),
      evidence('test', 'tests/hosted-llm-agent-tool-boundary-guard.test.ts', 'tool boundary guard standards'),
    ],
    limitation: 'Current evidence is strongest for hosted/tool-boundary surfaces; per-customer untrusted-content isolation still has to be proven at integration time.',
  }),
  entry({
    id: 'untrusted-content-authorizes-action',
    name: 'Untrusted content authorizes action',
    summary: 'Prompt text, email text, document text, tool output, or model summary is accepted as business authority.',
    classifications: ['authority', 'security', 'workflow'],
    severity: 'blocker',
    protectedPrinciples: ['customer authority', 'fail-closed boundary', 'auditability'],
    sourceRefs: ['ncsc-prompt-injection', 'microsoft-indirect-prompt-injection', 'owasp-agentic-top10-2026'],
    requiredControls: [
      'trusted-authority-source',
      'approval-provenance-required',
      'llm-authority-source-no-go',
    ],
    defaultDecision: 'block',
    repositoryEvidence: [
      evidence('code', 'src/consequence-admission/policy-foundry-authority-relationship-context.ts', 'llm-authority-source'),
      evidence('test', 'tests/policy-foundry-authority-relationship-context.test.ts', 'LLM-suggested authority source is a no-go'),
    ],
    limitation: 'This is explicit in Policy Foundry authority context; the next control-binding step must make it a central invariant.',
  }),
  entry({
    id: 'tool-misuse-excessive-agency',
    name: 'Tool misuse and excessive agency',
    summary: 'A valid tool is used with unsafe scope, unsafe arguments, unsafe credentials, or too much autonomy.',
    classifications: ['security', 'system-design', 'policy'],
    severity: 'blocker',
    protectedPrinciples: ['customer authority', 'operational boundedness', 'fail-closed boundary'],
    sourceRefs: ['owasp-llm-top10-2025', 'owasp-agentic-top10-2026', 'openai-agent-builder-safety', 'agentdojo'],
    requiredControls: [
      'tool-allowlist',
      'argument-schema-validation',
      'credential-isolation',
      'verifier-or-gateway',
    ],
    defaultDecision: 'block',
    repositoryEvidence: [
      evidence('code', 'src/consequence-admission/adapter-framework.ts', 'adapter framework'),
      evidence('code', 'src/consequence-admission/integration-mode-readiness.ts', 'credential isolation and bypass risk'),
      evidence('test', 'tests/action-surface-onboarding-red-team-fixtures.test.ts', 'direct credential bypass case'),
    ],
    limitation: 'Repo contracts can identify missing controls; customer tool execution still needs verifier, gateway, or provider-native delegation evidence.',
  }),
  entry({
    id: 'tool-result-poisoning',
    name: 'Tool result poisoning',
    summary: 'A tool result is treated as evidence or instruction without source, integrity, timestamp, or allowed evidence class.',
    classifications: ['evidence', 'security', 'system-design'],
    severity: 'high',
    protectedPrinciples: ['proof integrity', 'customer authority', 'auditability'],
    sourceRefs: ['microsoft-indirect-prompt-injection', 'agentdojo', 'owasp-agentic-top10-2026'],
    requiredControls: [
      'tool-output-trust-classification',
      'evidence-source-binding',
      'evidence-integrity-digest',
      'evidence-timestamp',
    ],
    defaultDecision: 'review',
    repositoryEvidence: [
      evidence('code', 'src/consequence-admission/index.ts', 'ConsequenceAdmissionEvidenceRef'),
      evidence('code', 'src/consequence-admission/policy-foundry-coverage-score.ts', 'evidence-binding'),
      evidence('code', 'src/consequence-admission/tool-result-poisoning-guard.ts', 'tool result trust classification guard'),
      evidence('test', 'tests/policy-foundry-coverage-score.test.ts', 'missing evidence binding is visible'),
      evidence('test', 'tests/tool-result-poisoning-guard.test.ts', 'tool result source, timestamp, integrity, and evidence class checks'),
    ],
    limitation: 'A dedicated tool-result trust classification guard exists; individual tools and adapters still need source-specific validators and metadata emission.',
  }),
  entry({
    id: 'sensitive-data-disclosure',
    name: 'Sensitive data disclosure',
    summary: 'Private prompts, payloads, customer identifiers, payment data, wallet material, secrets, or raw evidence leak through proof, review, dashboard, telemetry, or model feedback surfaces.',
    classifications: ['security', 'auditability'],
    severity: 'blocker',
    protectedPrinciples: ['data minimization and redaction', 'tenant isolation', 'auditability'],
    sourceRefs: ['owasp-llm-top10-2025', 'nist-ai-600-1', 'microsoft-indirect-prompt-injection'],
    requiredControls: [
      'data-minimization-surface-policy',
      'forbidden-raw-class-blocker',
      'digest-or-reference-only-output',
    ],
    defaultDecision: 'block',
    repositoryEvidence: [
      evidence('code', 'src/consequence-admission/data-minimization-redaction-policy.ts', 'CONSEQUENCE_DATA_MINIMIZATION_FORBIDDEN_RAW_CLASSES'),
      evidence('test', 'tests/data-minimization-redaction-policy.test.ts', 'forbidden raw classes are blockers'),
      evidence('doc', 'docs/02-architecture/data-minimization-redaction-policy.md', 'Data minimization and redaction policy'),
    ],
    limitation: 'Central policy exists; every future surface must keep importing and enforcing it.',
  }),
  entry({
    id: 'cross-tenant-leakage',
    name: 'Cross-tenant leakage',
    summary: 'A tenant-scoped API, review packet, dashboard, simulation, or export includes another tenant record.',
    classifications: ['security', 'workflow'],
    severity: 'blocker',
    protectedPrinciples: ['tenant isolation', 'data minimization and redaction', 'fail-closed boundary'],
    sourceRefs: ['nist-ai-600-1', 'owasp-llm-top10-2025'],
    requiredControls: [
      'tenant-bound-record-check',
      'foreign-record-rejection',
      'tenant-safe-error-output',
    ],
    defaultDecision: 'block',
    repositoryEvidence: [
      evidence('test', 'tests/shadow-route-tenant-boundary.test.ts', 'foreign records rejected before serialization'),
      evidence('doc', 'docs/02-architecture/tenant-isolation-boundary.md', 'Tenant isolation boundary'),
      evidence('code', 'src/consequence-admission/action-surface-onboarding-red-team-fixtures.ts', 'foreign-tenant-record'),
      evidence('code', 'src/consequence-admission/recipient-tenant-boundary-replay.ts', 'recipient and tenant boundary replay contract'),
      evidence('test', 'tests/recipient-tenant-boundary-replay.test.ts', 'foreign tenant replay blocks without raw tenant output'),
    ],
    limitation: 'Shadow route coverage is strong and a dedicated boundary replay contract exists; all future review/export/dashboard surfaces still need route-level integration evidence.',
  }),
  entry({
    id: 'wrong-recipient-disclosure',
    name: 'Wrong recipient disclosure',
    summary: 'A message, export, review packet, or downstream send action targets a recipient outside the approved scope.',
    classifications: ['security', 'workflow', 'evidence'],
    severity: 'blocker',
    protectedPrinciples: ['data minimization and redaction', 'customer authority', 'fail-closed boundary'],
    sourceRefs: ['owasp-llm-top10-2025', 'nist-ai-600-1'],
    requiredControls: [
      'recipient-scope-binding',
      'recipient-boundary-check',
      'raw-recipient-redaction',
    ],
    defaultDecision: 'block',
    repositoryEvidence: [
      evidence('code', 'src/consequence-admission/index.ts', 'recipient-scope-missing'),
      evidence('code', 'src/consequence-admission/data-minimization-redaction-policy.ts', 'raw-recipient-details'),
      evidence('code', 'src/consequence-admission/recipient-tenant-boundary-replay.ts', 'recipient and tenant boundary replay contract'),
      evidence('test', 'tests/downstream-enforcement-contract.test.ts', 'scope and constraint checks'),
      evidence('test', 'tests/recipient-tenant-boundary-replay.test.ts', 'wrong recipient and disallowed data class replay blocks'),
    ],
    limitation: 'A dedicated wrong-recipient replay contract exists; downstream senders must still enforce equivalent recipient checks before delivery.',
  }),
  entry({
    id: 'fake-approval-laundering',
    name: 'Fake approval laundering',
    summary: 'A chat, email, ticket comment, model summary, or unverified tool output saying approved is accepted as actual approval.',
    classifications: ['authority', 'human-oversight', 'workflow'],
    severity: 'blocker',
    protectedPrinciples: ['customer authority', 'auditability', 'proof integrity'],
    sourceRefs: ['owasp-agentic-top10-2026', 'microsoft-indirect-prompt-injection', 'the-agent-company'],
    requiredControls: [
      'approval-provenance-required',
      'verified-reviewer-source',
      'approval-state-binding',
    ],
    defaultDecision: 'block',
    repositoryEvidence: [
      evidence('code', 'src/release-kernel/reviewer-queue.ts', 'reviewer authority and token issuance'),
      evidence('code', 'src/consequence-admission/policy-foundry-authority-relationship-context.ts', 'approver-binding-missing'),
      evidence('code', 'src/consequence-admission/approval-provenance-guard.ts', 'approval provenance guard'),
      evidence('test', 'tests/policy-foundry-authority-relationship-context.test.ts', 'missing approver is a no-go'),
      evidence('test', 'tests/approval-provenance-guard.test.ts', 'fake chat/email/model approval is blocked'),
    ],
    limitation: 'A dedicated approval provenance guard exists; live IdP, approval workflow, reviewer queue, and downstream verifier integrations still need customer setup and route integration.',
  }),
  entry({
    id: 'stale-authority-or-policy',
    name: 'Stale authority or stale policy',
    summary: 'Old approval, old policy, stale context, stale token, or stale introspection result is reused for a new action.',
    classifications: ['authority', 'policy', 'security'],
    severity: 'blocker',
    protectedPrinciples: ['customer authority', 'runtime readiness', 'fail-closed boundary'],
    sourceRefs: ['nist-ai-600-1', 'owasp-agentic-top10-2026'],
    requiredControls: [
      'policy-version-binding',
      'authority-time-bounds',
      'fresh-introspection-required',
      'drift-review-required',
    ],
    defaultDecision: 'block',
    repositoryEvidence: [
      evidence('test', 'tests/release-enforcement-plane-freshness.test.ts', 'stale authorization failure'),
      evidence('code', 'src/consequence-admission/policy-foundry-drift-policy-debt-detector.ts', 'stale policy and policy debt'),
      evidence('code', 'src/consequence-admission/stale-authority-policy-guard.ts', 'stale authority and policy guard'),
      evidence('test', 'tests/policy-foundry-drift-policy-debt-detector.test.ts', 'policy/shadow mismatch no-go'),
      evidence('test', 'tests/stale-authority-policy-guard.test.ts', 'policy version, approval validity, authority freshness, and no-go checks'),
    ],
    limitation: 'A dedicated stale authority/policy guard exists; customer policy stores, IdP checks, approval workflows, and downstream verifiers still need source-of-truth integration.',
  }),
  entry({
    id: 'no-go-hold-bypass',
    name: 'No-go condition bypass',
    summary: 'Fraud hold, legal hold, compliance hold, security hold, or another explicit no-go is bypassed by natural-language rationale.',
    classifications: ['policy', 'authority', 'workflow'],
    severity: 'blocker',
    protectedPrinciples: ['fail-closed boundary', 'customer authority', 'auditability'],
    sourceRefs: ['nist-ai-600-1', 'owasp-agentic-top10-2026'],
    requiredControls: [
      'no-go-condition-ledger',
      'natural-language-bypass-deny',
      'hold-state-binding',
    ],
    defaultDecision: 'block',
    repositoryEvidence: [
      evidence('code', 'src/consequence-admission/policy-foundry-drift-policy-debt-detector.ts', 'noGoReasons'),
      evidence('code', 'src/consequence-admission/policy-foundry-live-downstream-replay.ts', 'noGoReasons'),
      evidence('test', 'tests/policy-foundry-live-downstream-replay.test.ts', 'no-go reasons block scoped rollout review'),
    ],
    limitation: 'No-go reasons are present in multiple contracts; a unified hold ledger is still a later step.',
  }),
  entry({
    id: 'scope-explosion',
    name: 'Scope explosion',
    summary: 'The requested action grows beyond approved scope: single to batch, low amount to high amount, read to write, or narrow to broad target.',
    classifications: ['policy', 'authority', 'workflow'],
    severity: 'blocker',
    protectedPrinciples: ['customer authority', 'fail-closed boundary', 'operational boundedness'],
    sourceRefs: ['owasp-agentic-top10-2026', 'openai-agent-builder-safety', 'the-agent-company'],
    requiredControls: [
      'requested-vs-approved-scope-diff',
      'scope-narrowing-engine',
      'amount-record-recipient-boundary',
    ],
    defaultDecision: 'narrow',
    repositoryEvidence: [
      evidence('code', 'src/consequence-admission/index.ts', 'narrow-required and scope missing reason codes'),
      evidence('code', 'src/consequence-admission/downstream-enforcement-contract.ts', 'accepted constraint acknowledgement'),
      evidence('test', 'tests/downstream-enforcement-contract.test.ts', 'private constraint and downstream hold checks'),
    ],
    limitation: 'Narrowing exists, but a dedicated scope-explosion guard and replay set are still future work.',
  }),
  entry({
    id: 'duplicate-execution-replay',
    name: 'Duplicate execution and replay',
    summary: 'The same admitted consequence, token, presentation, refund, payment, webhook, or downstream request is executed more than once.',
    classifications: ['security', 'workflow', 'auditability'],
    severity: 'blocker',
    protectedPrinciples: ['replay/idempotency safety', 'proof integrity', 'fail-closed boundary'],
    sourceRefs: ['owasp-agentic-top10-2026', 'nist-ai-600-1'],
    requiredControls: [
      'presentation-replay-ledger',
      'idempotency-key',
      'consume-on-allow',
      'duplicate-request-replay',
    ],
    defaultDecision: 'block',
    repositoryEvidence: [
      evidence('code', 'src/consequence-admission/presentation-replay-ledger.ts', 'presentation replay ledger'),
      evidence('test', 'tests/presentation-replay-ledger.test.ts', 'duplicate replay failure reason'),
      evidence('code', 'src/consequence-admission/action-surface-onboarding-red-team-fixtures.ts', 'duplicate-request'),
    ],
    limitation: 'Reference replay ledger proves shape; distributed customer enforcement needs shared atomic consume evidence.',
  }),
  entry({
    id: 'review-required-auto-promote',
    name: 'Review-required auto-promote',
    summary: 'An integration treats review or hold as advisory and proceeds unless the decision says block.',
    classifications: ['workflow', 'system-design', 'human-oversight'],
    severity: 'blocker',
    protectedPrinciples: ['fail-closed boundary', 'customer authority', 'no overclaim'],
    sourceRefs: ['owasp-agentic-top10-2026', 'nist-ai-600-1'],
    requiredControls: [
      'admit-or-narrow-only-proceed',
      'customer-gate-review-deny-default',
      'review-required-replay',
    ],
    defaultDecision: 'block',
    repositoryEvidence: [
      evidence('code', 'src/consequence-admission/customer-gate.ts', 'allowedByAdmission'),
      evidence('test', 'tests/consequence-admission-customer-gate.test.ts', 'blocked and proof-missing decisions hold'),
      evidence('code', 'src/consequence-admission/action-surface-onboarding-red-team-fixtures.ts', 'review-required-auto-promote'),
    ],
    limitation: 'Customer gate is correct; external integrations still need to adopt it or prove equivalent behavior.',
  }),
  entry({
    id: 'human-review-fatigue',
    name: 'Human review fatigue',
    summary: 'Review packets are too noisy, long, weakly prioritized, or misleading, increasing unsafe approvals.',
    classifications: ['human-oversight', 'workflow', 'auditability'],
    severity: 'high',
    protectedPrinciples: ['customer authority', 'no overclaim', 'auditability'],
    sourceRefs: ['owasp-agentic-top10-2026', 'nist-ai-600-1', 'the-agent-company'],
    requiredControls: [
      'compact-review-packet',
      'missing-evidence-highlight',
      'no-go-highlight',
      'reviewer-focus-areas',
    ],
    defaultDecision: 'review',
    repositoryEvidence: [
      evidence('code', 'src/consequence-admission/policy-foundry-hosted-review-surface.ts', 'hosted review surface'),
      evidence('code', 'src/consequence-admission/external-review-packet.ts', 'external review packet'),
      evidence('test', 'tests/policy-foundry-hosted-review-surface.test.ts', 'no-go cards and evidence digest cards'),
    ],
    limitation: 'Review surfaces are compact, but there is no explicit fatigue scoring or reviewer-load no-go yet.',
  }),
  entry({
    id: 'model-tool-config-drift',
    name: 'Model, tool, or config drift',
    summary: 'A decision proof no longer reflects the active model, tool schema, policy, config, or downstream verifier state.',
    classifications: ['auditability', 'policy', 'system-design'],
    severity: 'high',
    protectedPrinciples: ['runtime readiness', 'proof integrity', 'auditability'],
    sourceRefs: ['nist-ai-600-1', 'openai-agent-builder-safety', 'owasp-agentic-top10-2026'],
    requiredControls: [
      'decision-context-version-binding',
      'drift-detector',
      'new-simulation-required',
      'policy-debt-no-go',
    ],
    defaultDecision: 'review',
    repositoryEvidence: [
      evidence('code', 'src/consequence-admission/policy-foundry-drift-policy-debt-detector.ts', 'drift and policy debt detector'),
      evidence('test', 'tests/policy-foundry-drift-policy-debt-detector.test.ts', 'blocker chains produce no-go status'),
      evidence('code', 'src/release-kernel/release-verification.ts', 'policy hash and version verification'),
    ],
    limitation: 'Drift detection summarizes supplied evidence; it does not independently scan every customer runtime.',
  }),
  entry({
    id: 'multi-agent-delegation-confusion',
    name: 'Multi-agent delegation confusion',
    summary: 'An agent delegates or relays a high-impact action through another agent, service account, or workflow without clear authority and scope.',
    classifications: ['authority', 'workflow', 'security'],
    severity: 'high',
    protectedPrinciples: ['customer authority', 'auditability', 'fail-closed boundary'],
    sourceRefs: ['owasp-agentic-top10-2026', 'the-agent-company'],
    requiredControls: [
      'delegation-scope-binding',
      'inter-agent-authority-check',
      'approver-owner-separation',
    ],
    defaultDecision: 'review',
    repositoryEvidence: [
      evidence('code', 'src/consequence-admission/policy-foundry-authority-relationship-context.ts', 'unscoped-delegation'),
      evidence('test', 'tests/policy-foundry-authority-relationship-context.test.ts', 'unscoped delegation is a no-go'),
    ],
    limitation: 'Delegation no-go exists in authority context; inter-agent communication replay is not yet complete.',
  }),
  entry({
    id: 'hidden-downstream-side-effect',
    name: 'Hidden downstream side effect',
    summary: 'A locally valid action triggers irreversible, external, batch, financial, legal, or operational side effects not represented in the proposed consequence.',
    classifications: ['system-design', 'workflow', 'policy'],
    severity: 'high',
    protectedPrinciples: ['operational boundedness', 'customer authority', 'auditability'],
    sourceRefs: ['nist-ai-600-1', 'owasp-agentic-top10-2026', 'the-agent-company'],
    requiredControls: [
      'downstream-side-effect-inventory',
      'reversibility-classification',
      'execution-receipt-required',
      'rollback-capability-or-review',
    ],
    defaultDecision: 'review',
    repositoryEvidence: [
      evidence('code', 'src/consequence-admission/downstream-enforcement-contract.ts', 'downstream enforcement contract'),
      evidence('code', 'src/consequence-admission/downstream-execution-receipt.ts', 'downstream execution receipt'),
      evidence('test', 'tests/downstream-execution-receipt.test.ts', 'execution receipt'),
    ],
    limitation: 'Receipts exist; irreversible side-effect classification is not yet a central primitive.',
  }),
  entry({
    id: 'unsupported-confidence-or-hallucinated-evidence',
    name: 'Unsupported confidence or hallucinated evidence',
    summary: 'A model, agent, or packet presents confidence, proof, approval, or source material that is not backed by verifiable evidence.',
    classifications: ['model-quality', 'evidence', 'auditability'],
    severity: 'high',
    protectedPrinciples: ['proof integrity', 'no overclaim', 'auditability'],
    sourceRefs: ['nist-ai-600-1', 'owasp-llm-top10-2025', 'agentdojo'],
    requiredControls: [
      'evidence-reference-required',
      'proof-digest-required',
      'unsupported-claim-no-go',
      'external-review-required',
    ],
    defaultDecision: 'review',
    repositoryEvidence: [
      evidence('code', 'src/consequence-admission/audit-evidence-export.ts', 'audit evidence export'),
      evidence('code', 'src/consequence-admission/external-review-packet.ts', 'required repository evidence'),
      evidence('test', 'tests/consequence-external-review-packet.test.ts', 'compliance and production readiness not claimed'),
    ],
    limitation: 'Evidence exports can organize proof; they do not certify truth without source-system verification.',
  }),
  entry({
    id: 'agentic-supply-chain-compromise',
    name: 'Agentic supply chain compromise',
    summary: 'A package, connector, plugin, MCP server, workflow, generated adapter, or domain pack introduces unsafe behavior or excess privileges.',
    classifications: ['security', 'system-design', 'auditability'],
    severity: 'blocker',
    protectedPrinciples: ['release provenance', 'customer authority', 'runtime readiness'],
    sourceRefs: ['owasp-agentic-top10-2026', 'openai-agent-builder-safety', 'agentdojo'],
    requiredControls: [
      'adapter-readiness-manifest',
      'package-provenance-review',
      'generated-artifact-review',
      'least-privilege-tool-scope',
    ],
    defaultDecision: 'block',
    repositoryEvidence: [
      evidence('code', 'src/consequence-admission/adapter-framework.ts', 'adapter readiness'),
      evidence('code', 'src/consequence-admission/action-surface-integration-artifacts.ts', 'review-required generated artifacts'),
      evidence('test', 'tests/action-surface-onboarding-review-handoff.test.ts', 'generated artifacts reviewed'),
    ],
    limitation: 'Repo can require review/provenance; it cannot prove third-party pack behavior without customer-supplied evidence and runtime tests.',
  }),
]);

function assertRegistryShape(): void {
  const sourceIds = new Set(SOURCE_REFS.map((source) => source.id));
  const seen = new Set<string>();
  for (const item of CONSEQUENCE_FAILURE_MODE_REGISTRY_ENTRIES) {
    if (seen.has(item.id)) {
      throw new Error(`Duplicate failure mode registry id: ${item.id}`);
    }
    seen.add(item.id);
    if (item.requiredControls.length === 0) {
      throw new Error(`Failure mode ${item.id} must declare at least one required control.`);
    }
    for (const sourceRef of item.sourceRefs) {
      if (!sourceIds.has(sourceRef)) {
        throw new Error(`Failure mode ${item.id} references unknown source ${sourceRef}.`);
      }
    }
  }
}

assertRegistryShape();

export function consequenceFailureModeRegistry(): ConsequenceFailureModeRegistry {
  const payload = {
    version: CONSEQUENCE_FAILURE_MODE_REGISTRY_VERSION,
    entries: CONSEQUENCE_FAILURE_MODE_REGISTRY_ENTRIES,
    sources: SOURCE_REFS,
    severityValues: CONSEQUENCE_FAILURE_MODE_SEVERITIES,
    defaultDecisionValues: CONSEQUENCE_FAILURE_MODE_DEFAULT_DECISIONS,
    protectedPrinciples: CONSEQUENCE_FAILURE_MODE_PROTECTED_PRINCIPLES,
    classifications: CONSEQUENCE_FAILURE_MODE_CLASSIFICATIONS,
    approvalRequired: true,
    autoEnforce: false,
    productionReady: false,
    activatesEnforcement: false,
    rawPayloadStored: false,
    limitation:
      'The registry records known AI-action failure modes and required controls. It does not activate enforcement, prove customer coverage, or certify production readiness.',
  } as const;
  const { canonical, digest } = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    entryCount: CONSEQUENCE_FAILURE_MODE_REGISTRY_ENTRIES.length,
    canonical,
    digest,
  });
}
