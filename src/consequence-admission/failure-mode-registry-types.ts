import type { AttestorControlPlaneRole } from './control-plane-roles.js';

export const CONSEQUENCE_FAILURE_MODE_REGISTRY_VERSION =
  'attestor.consequence-failure-mode-registry.v1';

export const CONSEQUENCE_FAILURE_MODE_REGISTRY_PLACEMENT_VERSION =
  'attestor.consequence-failure-mode-registry-placement.v1';

export const CONSEQUENCE_FAILURE_MODE_REGISTRY_PLACEMENT_SOURCE_FILES = [
  'src/consequence-admission/failure-mode-registry.ts',
  'src/consequence-admission/failure-mode-control-bindings.ts',
  'src/consequence-admission/failure-mode-replay-fixtures.ts',
  'src/consequence-admission/failure-mode-guard-coverage.ts',
  'src/consequence-admission/failure-mode-runtime-extensions.ts',
  'src/consequence-admission/agentic-supply-chain-guard.ts',
] as const;
export type ConsequenceFailureModeRegistryPlacementSourceFile =
  typeof CONSEQUENCE_FAILURE_MODE_REGISTRY_PLACEMENT_SOURCE_FILES[number];

export type ConsequenceFailureModeRegistryOwningRole =
  Extract<AttestorControlPlaneRole, 'pdp'>;

export interface ConsequenceFailureModeRegistryPlacementDescriptor {
  readonly version: typeof CONSEQUENCE_FAILURE_MODE_REGISTRY_PLACEMENT_VERSION;
  readonly owningLayer: 'shared-control-layer';
  readonly primaryRole: ConsequenceFailureModeRegistryOwningRole;
  readonly supportingRoles: readonly AttestorControlPlaneRole[];
  readonly consumerRoles: readonly AttestorControlPlaneRole[];
  readonly nonOwningRoles: readonly AttestorControlPlaneRole[];
  readonly sourceFiles: typeof CONSEQUENCE_FAILURE_MODE_REGISTRY_PLACEMENT_SOURCE_FILES;
  readonly publicPackageSurface: 'attestor/consequence-admission';
  readonly packExtensionBoundary: string;
  readonly hostedServiceBoundary: string;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
  readonly limitation: string;
}

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
