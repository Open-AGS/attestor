import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from './release-canonicalization.js';
import type { ReleaseTargetKind } from './object-model.js';
import type { ReleasePolicyDefinition } from './release-policy.js';
import {
  DETERMINISTIC_CONTROL_CATEGORIES,
  riskControlProfile,
  type DeterministicControlCategory,
  type ReleaseTokenEnforcementLevel,
} from './risk-controls.js';
import type {
  ConsequenceType,
  EvidenceRetentionClass,
  ReviewAuthorityMode,
  RiskClass,
} from './types.js';

/**
 * Compiled admission policy IR v1.
 *
 * The release policy language is the authoring surface. This IR is the
 * machine-facing form: stable digest, index key, obligation set, and static
 * verification contract before a policy is eligible for the decision hot path.
 */

export const COMPILED_ADMISSION_POLICY_IR_VERSION =
  'attestor.compiled-admission-policy-ir.v1';

export const ADMISSION_OBLIGATION_KINDS = [
  ...DETERMINISTIC_CONTROL_CATEGORIES,
  'release-token',
  'token-introspection',
  'signed-envelope',
  'durable-evidence-pack',
  'human-review',
  'replay-ledger',
  'regulated-retention',
] as const;

export type AdmissionObligationKind = typeof ADMISSION_OBLIGATION_KINDS[number];

export const ADMISSION_OBLIGATION_BITS: Record<AdmissionObligationKind, bigint> =
  Object.freeze(
    Object.fromEntries(
      ADMISSION_OBLIGATION_KINDS.map((kind, index) => [kind, 1n << BigInt(index)]),
    ) as Record<AdmissionObligationKind, bigint>,
  );

export interface CompiledAdmissionPolicyIndexKey {
  readonly wedgeId: string;
  readonly consequenceType: ConsequenceType;
  readonly riskClass: RiskClass;
  readonly targetKinds: readonly ReleaseTargetKind[];
  readonly artifactTypes: readonly string[];
  readonly dataDomains: readonly string[];
}

export interface CompiledAdmissionPolicyReleaseDiscipline {
  readonly reviewMode: ReviewAuthorityMode;
  readonly minimumReviewerCount: number;
  readonly tokenEnforcement: ReleaseTokenEnforcementLevel;
  readonly requireSignedEnvelope: boolean;
  readonly requireDurableEvidencePack: boolean;
  readonly requireDownstreamReceipt: boolean;
  readonly retentionClass: EvidenceRetentionClass;
}

export interface CompiledAdmissionPolicyCapabilityBoundary {
  readonly allowedTools: readonly string[];
  readonly allowedTargets: readonly string[];
  readonly allowedDataDomains: readonly string[];
  readonly requiresSingleTargetBinding: boolean;
}

export interface CompiledAdmissionPolicyOutputContract {
  readonly allowedArtifactTypes: readonly string[];
  readonly expectedShape: string;
}

export interface CompiledAdmissionPolicyAcceptance {
  readonly strategy: ReleasePolicyDefinition['acceptance']['strategy'];
  readonly maxWarnings: number;
  readonly failureDisposition: ReleasePolicyDefinition['acceptance']['failureDisposition'];
}

export interface CompiledAdmissionPolicyRollout {
  readonly mode: ReleasePolicyDefinition['rollout']['mode'];
  readonly activatedAt: string | null;
  readonly fallbackPolicyId: string | null;
}

export interface CompiledAdmissionPolicy {
  readonly version: typeof COMPILED_ADMISSION_POLICY_IR_VERSION;
  readonly sourcePolicyId: string;
  readonly sourcePolicyVersion: ReleasePolicyDefinition['version'];
  readonly sourcePolicyStatus: ReleasePolicyDefinition['status'];
  readonly policyHash: string;
  readonly irHash: string;
  readonly indexKey: CompiledAdmissionPolicyIndexKey;
  readonly outputContract: CompiledAdmissionPolicyOutputContract;
  readonly capabilityBoundary: CompiledAdmissionPolicyCapabilityBoundary;
  readonly acceptance: CompiledAdmissionPolicyAcceptance;
  readonly release: CompiledAdmissionPolicyReleaseDiscipline;
  readonly deterministicChecks: readonly DeterministicControlCategory[];
  readonly evidenceKinds: readonly string[];
  readonly requiredObligations: readonly AdmissionObligationKind[];
  readonly requiredObligationMaskHex: string;
  readonly rollout: CompiledAdmissionPolicyRollout;
}

export type CompiledAdmissionPolicyVerificationSeverity = 'error' | 'warning';

export type CompiledAdmissionPolicyVerificationCode =
  | 'version-mismatch'
  | 'policy-hash-invalid'
  | 'ir-hash-mismatch'
  | 'mask-mismatch'
  | 'empty-index-dimension'
  | 'empty-capability-boundary'
  | 'unknown-deterministic-check'
  | 'unknown-obligation'
  | 'missing-required-check'
  | 'token-enforcement-too-weak'
  | 'missing-token-introspection'
  | 'missing-durable-evidence-pack'
  | 'missing-downstream-receipt'
  | 'missing-human-review'
  | 'missing-signed-envelope'
  | 'missing-replay-ledger'
  | 'missing-regulated-retention'
  | 'missing-required-evidence'
  | 'non-active-policy';

export interface CompiledAdmissionPolicyVerificationFinding {
  readonly severity: CompiledAdmissionPolicyVerificationSeverity;
  readonly code: CompiledAdmissionPolicyVerificationCode;
  readonly message: string;
}

export interface CompiledAdmissionPolicyVerificationResult {
  readonly valid: boolean;
  readonly errors: readonly CompiledAdmissionPolicyVerificationFinding[];
  readonly warnings: readonly CompiledAdmissionPolicyVerificationFinding[];
}

type CompiledAdmissionPolicyWithoutIrHash = Omit<CompiledAdmissionPolicy, 'irHash'>;

const RELEASE_TOKEN_ENFORCEMENT_RANK: Record<ReleaseTokenEnforcementLevel, number> = {
  none: 0,
  optional: 1,
  required: 2,
  'required-with-introspection': 3,
};

function sha256Canonical(value: CanonicalReleaseJsonValue): string {
  return `sha256:${createHash('sha256').update(canonicalizeReleaseJson(value)).digest('hex')}`;
}

function uniqueSorted<T extends string>(values: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(values)].sort());
}

function policyHashPayload(policy: ReleasePolicyDefinition): CanonicalReleaseJsonValue {
  return {
    version: policy.version,
    id: policy.id,
    name: policy.name,
    status: policy.status,
    rollout: {
      mode: policy.rollout.mode,
      activatedAt: policy.rollout.activatedAt ?? null,
      fallbackPolicyId: policy.rollout.fallbackPolicyId ?? null,
    },
    scope: policy.scope,
    outputContract: policy.outputContract,
    capabilityBoundary: policy.capabilityBoundary,
    acceptance: policy.acceptance,
    release: policy.release,
    notes: policy.notes,
  } as unknown as CanonicalReleaseJsonValue;
}

function compiledPolicyHashPayload(
  policy: CompiledAdmissionPolicyWithoutIrHash,
): CanonicalReleaseJsonValue {
  return {
    version: policy.version,
    sourcePolicyId: policy.sourcePolicyId,
    sourcePolicyVersion: policy.sourcePolicyVersion,
    sourcePolicyStatus: policy.sourcePolicyStatus,
    policyHash: policy.policyHash,
    indexKey: policy.indexKey,
    outputContract: policy.outputContract,
    capabilityBoundary: policy.capabilityBoundary,
    acceptance: policy.acceptance,
    release: policy.release,
    deterministicChecks: policy.deterministicChecks,
    evidenceKinds: policy.evidenceKinds,
    requiredObligations: policy.requiredObligations,
    requiredObligationMaskHex: policy.requiredObligationMaskHex,
    rollout: policy.rollout,
  } as unknown as CanonicalReleaseJsonValue;
}

function releaseDisciplineObligations(
  policy: ReleasePolicyDefinition,
): readonly AdmissionObligationKind[] {
  const riskProfile = riskControlProfile(policy.scope.riskClass);
  const obligations: AdmissionObligationKind[] = [];

  if (policy.release.tokenEnforcement !== 'none') {
    obligations.push('release-token');
  }
  if (policy.release.tokenEnforcement === 'required-with-introspection') {
    obligations.push('token-introspection');
  }
  if (policy.release.requireSignedEnvelope) {
    obligations.push('signed-envelope');
  }
  if (policy.release.requireDurableEvidencePack) {
    obligations.push('durable-evidence-pack');
  }
  if (policy.release.reviewMode !== 'auto' || policy.release.minimumReviewerCount > 0) {
    obligations.push('human-review');
  }
  if (riskProfile.token.requiresReplayLedger) {
    obligations.push('replay-ledger');
  }
  if (policy.release.retentionClass === 'regulated') {
    obligations.push('regulated-retention');
  }

  return obligations;
}

export function isAdmissionObligationKind(value: string): value is AdmissionObligationKind {
  return (ADMISSION_OBLIGATION_KINDS as readonly string[]).includes(value);
}

export function admissionObligationMaskFor(
  obligations: readonly AdmissionObligationKind[],
): bigint {
  return obligations.reduce((mask, obligation) => mask | ADMISSION_OBLIGATION_BITS[obligation], 0n);
}

export function admissionObligationMaskHex(mask: bigint): string {
  return `0x${mask.toString(16)}`;
}

export function requiredObligationsForReleasePolicy(
  policy: ReleasePolicyDefinition,
): readonly AdmissionObligationKind[] {
  return uniqueSorted([
    ...policy.acceptance.requiredChecks,
    ...releaseDisciplineObligations(policy),
  ]);
}

export function requiredObligationMaskForReleasePolicy(
  policy: ReleasePolicyDefinition,
): bigint {
  return admissionObligationMaskFor(requiredObligationsForReleasePolicy(policy));
}

export function computeReleasePolicyHash(policy: ReleasePolicyDefinition): string {
  return sha256Canonical(policyHashPayload(policy));
}

export function computeCompiledAdmissionPolicyIrHash(
  policy: CompiledAdmissionPolicy | CompiledAdmissionPolicyWithoutIrHash,
): string {
  const { irHash: _irHash, ...withoutHash } = policy as CompiledAdmissionPolicy;
  return sha256Canonical(
    compiledPolicyHashPayload(withoutHash as CompiledAdmissionPolicyWithoutIrHash),
  );
}

export function compileReleasePolicyDefinition(
  policy: ReleasePolicyDefinition,
): CompiledAdmissionPolicy {
  const requiredObligations = requiredObligationsForReleasePolicy(policy);
  const requiredObligationMaskHex = admissionObligationMaskHex(
    admissionObligationMaskFor(requiredObligations),
  );

  const withoutHash: CompiledAdmissionPolicyWithoutIrHash = {
    version: COMPILED_ADMISSION_POLICY_IR_VERSION,
    sourcePolicyId: policy.id,
    sourcePolicyVersion: policy.version,
    sourcePolicyStatus: policy.status,
    policyHash: computeReleasePolicyHash(policy),
    indexKey: {
      wedgeId: policy.scope.wedgeId,
      consequenceType: policy.scope.consequenceType,
      riskClass: policy.scope.riskClass,
      targetKinds: uniqueSorted(policy.scope.targetKinds),
      artifactTypes: uniqueSorted(policy.outputContract.allowedArtifactTypes),
      dataDomains: uniqueSorted(policy.scope.dataDomains),
    },
    outputContract: {
      allowedArtifactTypes: uniqueSorted(policy.outputContract.allowedArtifactTypes),
      expectedShape: policy.outputContract.expectedShape,
    },
    capabilityBoundary: {
      allowedTools: uniqueSorted(policy.capabilityBoundary.allowedTools),
      allowedTargets: uniqueSorted(policy.capabilityBoundary.allowedTargets),
      allowedDataDomains: uniqueSorted(policy.capabilityBoundary.allowedDataDomains),
      requiresSingleTargetBinding: policy.capabilityBoundary.requiresSingleTargetBinding,
    },
    acceptance: {
      strategy: policy.acceptance.strategy,
      maxWarnings: policy.acceptance.maxWarnings,
      failureDisposition: policy.acceptance.failureDisposition,
    },
    release: {
      reviewMode: policy.release.reviewMode,
      minimumReviewerCount: policy.release.minimumReviewerCount,
      tokenEnforcement: policy.release.tokenEnforcement,
      requireSignedEnvelope: policy.release.requireSignedEnvelope,
      requireDurableEvidencePack: policy.release.requireDurableEvidencePack,
      requireDownstreamReceipt: policy.release.requireDownstreamReceipt,
      retentionClass: policy.release.retentionClass,
    },
    deterministicChecks: uniqueSorted(policy.acceptance.requiredChecks),
    evidenceKinds: uniqueSorted(policy.acceptance.requiredEvidenceKinds),
    requiredObligations,
    requiredObligationMaskHex,
    rollout: {
      mode: policy.rollout.mode,
      activatedAt: policy.rollout.activatedAt ?? null,
      fallbackPolicyId: policy.rollout.fallbackPolicyId ?? null,
    },
  };

  return Object.freeze({
    ...withoutHash,
    irHash: computeCompiledAdmissionPolicyIrHash(withoutHash),
  });
}

function finding(
  severity: CompiledAdmissionPolicyVerificationSeverity,
  code: CompiledAdmissionPolicyVerificationCode,
  message: string,
): CompiledAdmissionPolicyVerificationFinding {
  return { severity, code, message };
}

function hasObligation(
  policy: CompiledAdmissionPolicy,
  obligation: AdmissionObligationKind,
): boolean {
  return policy.requiredObligations.includes(obligation);
}

function assertRiskBaseline(
  policy: CompiledAdmissionPolicy,
  findings: CompiledAdmissionPolicyVerificationFinding[],
): void {
  const profile = riskControlProfile(policy.indexKey.riskClass);

  for (const check of profile.deterministicChecks) {
    if (!policy.deterministicChecks.includes(check) || !hasObligation(policy, check)) {
      findings.push(
        finding(
          'error',
          'missing-required-check',
          `Risk class ${policy.indexKey.riskClass} requires deterministic check ${check}.`,
        ),
      );
    }
  }

  const actualRank = RELEASE_TOKEN_ENFORCEMENT_RANK[policy.release.tokenEnforcement];
  const minimumRank = RELEASE_TOKEN_ENFORCEMENT_RANK[profile.token.minimumEnforcement];
  if (actualRank < minimumRank) {
    findings.push(
      finding(
        'error',
        'token-enforcement-too-weak',
        `Risk class ${policy.indexKey.riskClass} requires token enforcement ${profile.token.minimumEnforcement}.`,
      ),
    );
  }

  if (
    profile.token.minimumEnforcement === 'required-with-introspection' &&
    !hasObligation(policy, 'token-introspection')
  ) {
    findings.push(
      finding(
        'error',
        'missing-token-introspection',
        `Risk class ${policy.indexKey.riskClass} requires token introspection.`,
      ),
    );
  }

  if (
    profile.evidence.requiresDurableEvidencePack &&
    !hasObligation(policy, 'durable-evidence-pack')
  ) {
    findings.push(
      finding(
        'error',
        'missing-durable-evidence-pack',
        `Risk class ${policy.indexKey.riskClass} requires a durable evidence pack.`,
      ),
    );
  }

  if (
    profile.evidence.requiresDownstreamReceipt &&
    !hasObligation(policy, 'downstream-receipt-reconciliation')
  ) {
    findings.push(
      finding(
        'error',
        'missing-downstream-receipt',
        `Risk class ${policy.indexKey.riskClass} requires downstream receipt reconciliation.`,
      ),
    );
  }

  if (
    profile.review.minimumReviewerCount > 0 &&
    (!hasObligation(policy, 'human-review') ||
      policy.release.minimumReviewerCount < profile.review.minimumReviewerCount)
  ) {
    findings.push(
      finding(
        'error',
        'missing-human-review',
        `Risk class ${policy.indexKey.riskClass} requires at least ${profile.review.minimumReviewerCount} reviewer(s).`,
      ),
    );
  }

  if (profile.token.requiresReplayLedger && !hasObligation(policy, 'replay-ledger')) {
    findings.push(
      finding(
        'error',
        'missing-replay-ledger',
        `Risk class ${policy.indexKey.riskClass} requires a replay ledger.`,
      ),
    );
  }

  if (profile.evidence.retentionClass === 'regulated' && !hasObligation(policy, 'regulated-retention')) {
    findings.push(
      finding(
        'error',
        'missing-regulated-retention',
        `Risk class ${policy.indexKey.riskClass} requires regulated evidence retention.`,
      ),
    );
  }
}

export function verifyCompiledAdmissionPolicy(
  policy: CompiledAdmissionPolicy,
): CompiledAdmissionPolicyVerificationResult {
  const findings: CompiledAdmissionPolicyVerificationFinding[] = [];

  if (policy.version !== COMPILED_ADMISSION_POLICY_IR_VERSION) {
    findings.push(
      finding('error', 'version-mismatch', 'Compiled admission policy IR version is not supported.'),
    );
  }

  if (!policy.policyHash.startsWith('sha256:')) {
    findings.push(
      finding('error', 'policy-hash-invalid', 'Compiled admission policy must bind a SHA-256 policy hash.'),
    );
  }

  const expectedIrHash = computeCompiledAdmissionPolicyIrHash(policy);
  if (policy.irHash !== expectedIrHash) {
    findings.push(
      finding('error', 'ir-hash-mismatch', 'Compiled admission policy IR hash does not match its canonical payload.'),
    );
  }

  if (
    policy.indexKey.targetKinds.length === 0 ||
    policy.indexKey.artifactTypes.length === 0 ||
    policy.indexKey.dataDomains.length === 0
  ) {
    findings.push(
      finding('error', 'empty-index-dimension', 'Compiled admission policy index dimensions must be non-empty.'),
    );
  }

  if (
    policy.capabilityBoundary.allowedTools.length === 0 ||
    policy.capabilityBoundary.allowedTargets.length === 0 ||
    policy.capabilityBoundary.allowedDataDomains.length === 0
  ) {
    findings.push(
      finding('error', 'empty-capability-boundary', 'Compiled admission policy capability boundary must be non-empty.'),
    );
  }

  for (const check of policy.deterministicChecks) {
    if (!(DETERMINISTIC_CONTROL_CATEGORIES as readonly string[]).includes(check)) {
      findings.push(
        finding('error', 'unknown-deterministic-check', `Unknown deterministic check ${check}.`),
      );
    }
  }

  for (const obligation of policy.requiredObligations) {
    if (!isAdmissionObligationKind(obligation)) {
      findings.push(
        finding('error', 'unknown-obligation', `Unknown admission obligation ${obligation}.`),
      );
    }
  }

  const hasUnknownObligations = policy.requiredObligations.some(
    (obligation) => !isAdmissionObligationKind(obligation),
  );
  if (!hasUnknownObligations) {
    const expectedMaskHex = admissionObligationMaskHex(
      admissionObligationMaskFor(policy.requiredObligations),
    );
    if (policy.requiredObligationMaskHex !== expectedMaskHex) {
      findings.push(
        finding('error', 'mask-mismatch', 'Compiled admission policy obligation mask does not match its obligations.'),
      );
    }
  }

  if (policy.release.requireSignedEnvelope && !hasObligation(policy, 'signed-envelope')) {
    findings.push(
      finding('error', 'missing-signed-envelope', 'Signed-envelope release discipline is missing from obligations.'),
    );
  }

  if (policy.release.requireDurableEvidencePack && policy.evidenceKinds.length === 0) {
    findings.push(
      finding('error', 'missing-required-evidence', 'Durable evidence-pack release requires explicit evidence kinds.'),
    );
  }

  if (policy.indexKey.riskClass === 'R4' && !policy.evidenceKinds.includes('provenance')) {
    findings.push(
      finding('error', 'missing-required-evidence', 'R4 compiled admission policies must require provenance evidence.'),
    );
  }

  if (policy.sourcePolicyStatus !== 'active') {
    findings.push(
      finding(
        'warning',
        'non-active-policy',
        'Compiled policy is not active and should not be inserted into the enforced hot-path index.',
      ),
    );
  }

  assertRiskBaseline(policy, findings);

  const errors = findings.filter((item) => item.severity === 'error');
  const warnings = findings.filter((item) => item.severity === 'warning');

  return Object.freeze({
    valid: errors.length === 0,
    errors,
    warnings,
  });
}
