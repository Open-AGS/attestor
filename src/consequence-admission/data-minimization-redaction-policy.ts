import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';

export const CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION =
  'attestor.consequence-data-minimization-redaction-policy.v1';

export const CONSEQUENCE_DATA_MINIMIZATION_SURFACE_KINDS = [
  'admission-model-feedback',
  'pack-decision-profile',
  'admission-problem',
  'retry-attempt-ledger',
  'shadow-summary',
  'shadow-simulation',
  'policy-discovery-candidates',
  'policy-foundry-active-questions',
  'policy-foundry-onboarding-session',
  'policy-foundry-coverage-score',
  'policy-foundry-gate-planner',
  'policy-foundry-candidate-registry',
  'policy-foundry-counterexample-ledger',
  'policy-foundry-policy-twin-summary',
  'policy-foundry-authority-relationship-context',
  'policy-foundry-review-only-patch-pack',
  'policy-foundry-self-onboarding-cli',
  'policy-foundry-outcome-feedback-loop',
  'policy-foundry-drift-policy-debt-detector',
  'policy-foundry-commercial-boundary',
  'policy-foundry-adversarial-replay-executor',
  'audit-evidence-export',
  'tamper-evident-history',
  'business-risk-dashboard',
  'dashboard-api-summary',
  'external-review-packet',
  'downstream-presentation-binding',
  'presentation-replay-ledger',
  'downstream-execution-receipt',
] as const;
export type ConsequenceDataMinimizationSurfaceKind =
  typeof CONSEQUENCE_DATA_MINIMIZATION_SURFACE_KINDS[number];

export const CONSEQUENCE_DATA_MINIMIZATION_AUDIENCES = [
  'model',
  'customer-reviewer',
  'operator',
  'external-reviewer',
  'dashboard-viewer',
] as const;
export type ConsequenceDataMinimizationAudience =
  typeof CONSEQUENCE_DATA_MINIMIZATION_AUDIENCES[number];

export const CONSEQUENCE_DATA_MINIMIZATION_ALLOWED_UNITS = [
  'reason-codes',
  'safe-instruction',
  'missing-field-names',
  'required-evidence-kinds',
  'counts',
  'digests',
  'timestamps',
  'tenant-scope',
  'environment-scope',
  'consequence-domain',
  'surface-digest',
  'artifact-reference',
  'policy-reference',
  'approval-state',
  'status',
  'operator-supplied-aggregate-impact',
] as const;
export type ConsequenceDataMinimizationAllowedUnit =
  typeof CONSEQUENCE_DATA_MINIMIZATION_ALLOWED_UNITS[number];

export const CONSEQUENCE_DATA_MINIMIZATION_FORBIDDEN_RAW_CLASSES = [
  'raw-model-prompt',
  'raw-model-output',
  'raw-tool-payload',
  'raw-customer-identifier',
  'raw-personal-data',
  'raw-bank-or-payment-data',
  'raw-wallet-key-or-secret',
  'raw-recipient-details',
  'raw-evidence-document',
  'raw-database-row-or-query-result',
  'raw-downstream-response',
  'credential-or-secret',
  'private-policy-threshold',
  'raw-idempotency-key',
  'raw-replay-key',
] as const;
export type ConsequenceDataMinimizationForbiddenRawClass =
  typeof CONSEQUENCE_DATA_MINIMIZATION_FORBIDDEN_RAW_CLASSES[number];

export const CONSEQUENCE_DATA_MINIMIZATION_RUNTIME_SECRET_MARKERS = [
  'bearer ',
  'jwt.',
  'private_key',
  'secret=',
  'release-token=',
  'attestor-release-token',
] as const;
export type ConsequenceDataMinimizationRuntimeSecretMarker =
  typeof CONSEQUENCE_DATA_MINIMIZATION_RUNTIME_SECRET_MARKERS[number];

export const CONSEQUENCE_DATA_MINIMIZATION_GOVERNANCE_REFS = [
  'nist-ai-rmf-risk-documentation',
  'nist-sp-800-122-pii-confidentiality',
  'gdpr-art-5-data-minimisation',
  'owasp-llm02-sensitive-information-disclosure',
  'pci-dss-sensitive-authentication-data-not-stored',
  'rfc9457-problem-details-not-debugging',
] as const;
export type ConsequenceDataMinimizationGovernanceRef =
  typeof CONSEQUENCE_DATA_MINIMIZATION_GOVERNANCE_REFS[number];

export interface ConsequenceDataMinimizationSurfacePolicy {
  readonly surfaceKind: ConsequenceDataMinimizationSurfaceKind;
  readonly audience: ConsequenceDataMinimizationAudience;
  readonly modelSafe: boolean;
  readonly allowedUnits: readonly ConsequenceDataMinimizationAllowedUnit[];
  readonly forbiddenRawClasses: typeof CONSEQUENCE_DATA_MINIMIZATION_FORBIDDEN_RAW_CLASSES;
  readonly rawPayloadStored: false;
  readonly rawOverrideSupported: false;
  readonly approvalRequiredForRawOverride: true;
}

export interface ConsequenceDataMinimizationRedactionPolicyDescriptor {
  readonly version: typeof CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION;
  readonly surfaces: readonly ConsequenceDataMinimizationSurfacePolicy[];
  readonly surfaceKinds: typeof CONSEQUENCE_DATA_MINIMIZATION_SURFACE_KINDS;
  readonly audiences: typeof CONSEQUENCE_DATA_MINIMIZATION_AUDIENCES;
  readonly allowedUnits: typeof CONSEQUENCE_DATA_MINIMIZATION_ALLOWED_UNITS;
  readonly forbiddenRawClasses: typeof CONSEQUENCE_DATA_MINIMIZATION_FORBIDDEN_RAW_CLASSES;
  readonly governanceRefs: typeof CONSEQUENCE_DATA_MINIMIZATION_GOVERNANCE_REFS;
  readonly modelFeedbackIsRedacted: true;
  readonly proofSurfacesAreDigestFirst: true;
  readonly dashboardIsDecisionSupportOnly: true;
  readonly rawPayloadStored: false;
  readonly rawOverrideSupported: false;
  readonly productionReady: false;
}

export interface EvaluateConsequenceDataMinimizationArtifactInput {
  readonly surfaceKind: ConsequenceDataMinimizationSurfaceKind;
  readonly rawPayloadStored?: boolean | null;
  readonly exposedUnits?: readonly ConsequenceDataMinimizationAllowedUnit[] | null;
  readonly exposedRawClasses?: readonly ConsequenceDataMinimizationForbiddenRawClass[] | null;
}

export interface ConsequenceDataMinimizationMaterialSafetyFindingInput {
  readonly material: string;
  readonly findingSubject?: string | null;
  readonly extraSensitiveMarkers?: readonly string[] | null;
}

export interface ConsequenceDataMinimizationArtifactEvaluation {
  readonly version: typeof CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION;
  readonly surfaceKind: ConsequenceDataMinimizationSurfaceKind;
  readonly allowed: boolean;
  readonly failClosed: boolean;
  readonly rawPayloadStored: false;
  readonly rawOverrideSupported: false;
  readonly reasonCodes: readonly string[];
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

function surface(
  surfaceKind: ConsequenceDataMinimizationSurfaceKind,
  audience: ConsequenceDataMinimizationAudience,
  modelSafe: boolean,
  allowedUnits: readonly ConsequenceDataMinimizationAllowedUnit[],
): ConsequenceDataMinimizationSurfacePolicy {
  return Object.freeze({
    surfaceKind,
    audience,
    modelSafe,
    allowedUnits: Object.freeze([...allowedUnits]),
    forbiddenRawClasses: CONSEQUENCE_DATA_MINIMIZATION_FORBIDDEN_RAW_CLASSES,
    rawPayloadStored: false,
    rawOverrideSupported: false,
    approvalRequiredForRawOverride: true,
  });
}

const SURFACE_POLICIES: readonly ConsequenceDataMinimizationSurfacePolicy[] =
Object.freeze([
  surface('admission-model-feedback', 'model', true, [
    'reason-codes',
    'safe-instruction',
    'missing-field-names',
    'required-evidence-kinds',
    'status',
  ]),
  surface('pack-decision-profile', 'operator', true, [
    'reason-codes',
    'safe-instruction',
    'counts',
    'digests',
    'timestamps',
    'consequence-domain',
    'surface-digest',
    'artifact-reference',
    'approval-state',
    'status',
  ]),
  surface('admission-problem', 'model', true, [
    'reason-codes',
    'safe-instruction',
    'status',
  ]),
  surface('retry-attempt-ledger', 'operator', false, [
    'reason-codes',
    'missing-field-names',
    'counts',
    'digests',
    'timestamps',
    'tenant-scope',
    'approval-state',
    'status',
  ]),
  surface('shadow-summary', 'operator', false, [
    'reason-codes',
    'counts',
    'digests',
    'timestamps',
    'tenant-scope',
    'environment-scope',
    'consequence-domain',
    'surface-digest',
    'approval-state',
    'status',
  ]),
  surface('shadow-simulation', 'customer-reviewer', false, [
    'reason-codes',
    'counts',
    'digests',
    'timestamps',
    'tenant-scope',
    'environment-scope',
    'consequence-domain',
    'approval-state',
    'status',
  ]),
  surface('policy-discovery-candidates', 'customer-reviewer', false, [
    'reason-codes',
    'counts',
    'digests',
    'timestamps',
    'policy-reference',
    'approval-state',
    'status',
  ]),
  surface('policy-foundry-active-questions', 'customer-reviewer', false, [
    'reason-codes',
    'safe-instruction',
    'counts',
    'digests',
    'timestamps',
    'consequence-domain',
    'surface-digest',
    'approval-state',
    'status',
  ]),
  surface('policy-foundry-onboarding-session', 'customer-reviewer', false, [
    'reason-codes',
    'safe-instruction',
    'counts',
    'digests',
    'timestamps',
    'consequence-domain',
    'surface-digest',
    'artifact-reference',
    'approval-state',
    'status',
  ]),
  surface('policy-foundry-coverage-score', 'customer-reviewer', false, [
    'reason-codes',
    'safe-instruction',
    'counts',
    'digests',
    'timestamps',
    'consequence-domain',
    'surface-digest',
    'artifact-reference',
    'approval-state',
    'status',
  ]),
  surface('policy-foundry-gate-planner', 'customer-reviewer', false, [
    'reason-codes',
    'safe-instruction',
    'counts',
    'digests',
    'timestamps',
    'consequence-domain',
    'surface-digest',
    'artifact-reference',
    'approval-state',
    'status',
  ]),
  surface('policy-foundry-candidate-registry', 'customer-reviewer', false, [
    'reason-codes',
    'safe-instruction',
    'counts',
    'digests',
    'timestamps',
    'consequence-domain',
    'surface-digest',
    'policy-reference',
    'approval-state',
    'status',
  ]),
  surface('policy-foundry-counterexample-ledger', 'customer-reviewer', false, [
    'reason-codes',
    'safe-instruction',
    'counts',
    'digests',
    'timestamps',
    'consequence-domain',
    'surface-digest',
    'policy-reference',
    'approval-state',
    'status',
  ]),
  surface('policy-foundry-policy-twin-summary', 'customer-reviewer', false, [
    'reason-codes',
    'safe-instruction',
    'counts',
    'digests',
    'timestamps',
    'consequence-domain',
    'surface-digest',
    'policy-reference',
    'approval-state',
    'status',
  ]),
  surface('policy-foundry-authority-relationship-context', 'customer-reviewer', false, [
    'reason-codes',
    'safe-instruction',
    'counts',
    'digests',
    'timestamps',
    'tenant-scope',
    'consequence-domain',
    'surface-digest',
    'artifact-reference',
    'policy-reference',
    'approval-state',
    'status',
  ]),
  surface('policy-foundry-review-only-patch-pack', 'customer-reviewer', false, [
    'reason-codes',
    'safe-instruction',
    'counts',
    'digests',
    'timestamps',
    'tenant-scope',
    'environment-scope',
    'consequence-domain',
    'surface-digest',
    'artifact-reference',
    'policy-reference',
    'approval-state',
    'status',
  ]),
  surface('policy-foundry-self-onboarding-cli', 'customer-reviewer', false, [
    'reason-codes',
    'safe-instruction',
    'counts',
    'digests',
    'timestamps',
    'tenant-scope',
    'environment-scope',
    'consequence-domain',
    'surface-digest',
    'artifact-reference',
    'policy-reference',
    'approval-state',
    'status',
  ]),
  surface('policy-foundry-outcome-feedback-loop', 'customer-reviewer', false, [
    'reason-codes',
    'safe-instruction',
    'counts',
    'digests',
    'timestamps',
    'tenant-scope',
    'consequence-domain',
    'surface-digest',
    'policy-reference',
    'approval-state',
    'status',
  ]),
  surface('policy-foundry-drift-policy-debt-detector', 'customer-reviewer', false, [
    'reason-codes',
    'safe-instruction',
    'counts',
    'digests',
    'timestamps',
    'tenant-scope',
    'consequence-domain',
    'surface-digest',
    'policy-reference',
    'approval-state',
    'status',
  ]),
  surface('policy-foundry-commercial-boundary', 'customer-reviewer', false, [
    'reason-codes',
    'safe-instruction',
    'counts',
    'digests',
    'timestamps',
    'consequence-domain',
    'surface-digest',
    'artifact-reference',
    'approval-state',
    'status',
  ]),
  surface('policy-foundry-adversarial-replay-executor', 'customer-reviewer', false, [
    'reason-codes',
    'safe-instruction',
    'counts',
    'digests',
    'timestamps',
    'tenant-scope',
    'environment-scope',
    'consequence-domain',
    'surface-digest',
    'artifact-reference',
    'approval-state',
    'status',
  ]),
  surface('audit-evidence-export', 'external-reviewer', false, [
    'reason-codes',
    'counts',
    'digests',
    'timestamps',
    'tenant-scope',
    'environment-scope',
    'consequence-domain',
    'surface-digest',
    'artifact-reference',
    'approval-state',
    'status',
  ]),
  surface('tamper-evident-history', 'external-reviewer', false, [
    'reason-codes',
    'counts',
    'digests',
    'timestamps',
    'tenant-scope',
    'environment-scope',
    'artifact-reference',
    'approval-state',
    'status',
  ]),
  surface('business-risk-dashboard', 'dashboard-viewer', false, [
    'reason-codes',
    'counts',
    'digests',
    'timestamps',
    'tenant-scope',
    'environment-scope',
    'consequence-domain',
    'surface-digest',
    'operator-supplied-aggregate-impact',
    'approval-state',
    'status',
  ]),
  surface('dashboard-api-summary', 'dashboard-viewer', false, [
    'reason-codes',
    'counts',
    'digests',
    'timestamps',
    'tenant-scope',
    'environment-scope',
    'consequence-domain',
    'surface-digest',
    'artifact-reference',
    'approval-state',
    'status',
  ]),
  surface('external-review-packet', 'external-reviewer', false, [
    'reason-codes',
    'counts',
    'digests',
    'timestamps',
    'tenant-scope',
    'environment-scope',
    'consequence-domain',
    'surface-digest',
    'artifact-reference',
    'approval-state',
    'status',
  ]),
  surface('downstream-presentation-binding', 'operator', false, [
    'reason-codes',
    'digests',
    'timestamps',
    'tenant-scope',
    'environment-scope',
    'consequence-domain',
    'artifact-reference',
    'approval-state',
    'status',
  ]),
  surface('presentation-replay-ledger', 'operator', false, [
    'reason-codes',
    'digests',
    'timestamps',
    'tenant-scope',
    'environment-scope',
    'approval-state',
    'status',
  ]),
  surface('downstream-execution-receipt', 'operator', false, [
    'reason-codes',
    'counts',
    'digests',
    'timestamps',
    'tenant-scope',
    'environment-scope',
    'artifact-reference',
    'approval-state',
    'status',
  ]),
]);

function policyForSurface(
  surfaceKind: ConsequenceDataMinimizationSurfaceKind,
): ConsequenceDataMinimizationSurfacePolicy {
  const policy = SURFACE_POLICIES.find((entry) => entry.surfaceKind === surfaceKind);
  if (!policy) {
    throw new Error(`Consequence data minimization unknown surface: ${surfaceKind}`);
  }
  return policy;
}

function materialContainsRawPayloadMarker(material: string): boolean {
  return material.includes('raw_') && material.includes('must_not_escape');
}

function materialDeclaresRawPayloadStorage(material: string): boolean {
  return (
    material.includes('rawpayloadstored":true') ||
    material.includes('raw_payload_stored":true')
  );
}

export function consequenceDataMinimizationMaterialSafetyFindings(
  input: ConsequenceDataMinimizationMaterialSafetyFindingInput,
): readonly string[] {
  const material = input.material.toLowerCase();
  const findingSubject = input.findingSubject?.trim() || 'material';
  const markers = new Set([
    ...CONSEQUENCE_DATA_MINIMIZATION_RUNTIME_SECRET_MARKERS,
    ...CONSEQUENCE_DATA_MINIMIZATION_FORBIDDEN_RAW_CLASSES,
    ...(input.extraSensitiveMarkers ?? []),
  ].map((marker) => marker.toLowerCase()));
  const findings: string[] = [];

  for (const marker of markers) {
    if (material.includes(marker)) {
      findings.push(`${findingSubject} contains sensitive marker: ${marker.trim()}`);
    }
  }
  if (materialContainsRawPayloadMarker(material)) {
    findings.push(`${findingSubject} contains raw payload marker`);
  }
  if (materialDeclaresRawPayloadStorage(material)) {
    findings.push(`${findingSubject} declares raw payload storage`);
  }

  return Object.freeze(findings);
}

export function consequenceDataMinimizationRedactionPolicyDescriptor():
ConsequenceDataMinimizationRedactionPolicyDescriptor {
  return Object.freeze({
    version: CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
    surfaces: SURFACE_POLICIES,
    surfaceKinds: CONSEQUENCE_DATA_MINIMIZATION_SURFACE_KINDS,
    audiences: CONSEQUENCE_DATA_MINIMIZATION_AUDIENCES,
    allowedUnits: CONSEQUENCE_DATA_MINIMIZATION_ALLOWED_UNITS,
    forbiddenRawClasses: CONSEQUENCE_DATA_MINIMIZATION_FORBIDDEN_RAW_CLASSES,
    governanceRefs: CONSEQUENCE_DATA_MINIMIZATION_GOVERNANCE_REFS,
    modelFeedbackIsRedacted: true,
    proofSurfacesAreDigestFirst: true,
    dashboardIsDecisionSupportOnly: true,
    rawPayloadStored: false,
    rawOverrideSupported: false,
    productionReady: false,
  });
}

export function evaluateConsequenceDataMinimizationArtifact(
  input: EvaluateConsequenceDataMinimizationArtifactInput,
): ConsequenceDataMinimizationArtifactEvaluation {
  const policy = policyForSurface(input.surfaceKind);
  const reasonCodes: string[] = [];
  const rawClasses = input.exposedRawClasses ?? [];
  const exposedUnits = input.exposedUnits ?? [];

  if (input.rawPayloadStored === true) {
    reasonCodes.push('raw-payload-stored');
  }
  for (const rawClass of rawClasses) {
    if (policy.forbiddenRawClasses.includes(rawClass)) {
      reasonCodes.push(`forbidden-raw-class:${rawClass}`);
    }
  }
  for (const unit of exposedUnits) {
    if (!policy.allowedUnits.includes(unit)) {
      reasonCodes.push(`data-unit-not-allowed:${unit}`);
    }
  }

  const payload = {
    version: CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
    surfaceKind: input.surfaceKind,
    rawPayloadStored: false,
    rawOverrideSupported: false,
    reasonCodes: Object.freeze([...new Set(reasonCodes)].sort()),
  } as const;
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);

  return Object.freeze({
    ...payload,
    allowed: payload.reasonCodes.length === 0,
    failClosed: payload.reasonCodes.length > 0,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}
