import type {
  ReleasePolicyProvenanceSource,
  ReleaseTokenClaims,
} from '../release-kernel/object-model.js';
import type {
  ReleaseEnforcementPolicyContext,
} from './object-model.js';
import type {
  OfflineReleaseVerification,
  OfflineReleaseVerificationInput,
} from './offline-verifier-types.js';

export interface ResolvedOfflineVerifierExpectedBinding {
  readonly audience: string;
  readonly tenantId: string | null;
  readonly releaseTokenId: string;
  readonly releaseDecisionId: string;
  readonly consequenceType: OfflineReleaseVerificationInput['request']['enforcementPoint']['consequenceType'];
  readonly riskClass: OfflineReleaseVerificationInput['request']['enforcementPoint']['riskClass'];
  readonly outputHash: string;
  readonly consequenceHash: string;
  readonly policyHash: string;
  readonly policyVersion: string;
  readonly policyIrHash: string;
  readonly policyProvenanceSource: ReleasePolicyProvenanceSource | null;
  readonly compiledPolicyIndexVersion: string;
  readonly compiledPolicyIrVersion: string;
  readonly policyContext: ReleaseEnforcementPolicyContext | null;
}

export function expectedBindingForRequest(
  input: OfflineReleaseVerificationInput,
): ResolvedOfflineVerifierExpectedBinding {
  const request = input.request;
  return {
    audience: input.expected?.audience ?? request.targetId,
    tenantId: expectedTenantIdForRequest(input).tenantId,
    releaseTokenId: input.expected?.releaseTokenId ?? request.releaseTokenId ?? '',
    releaseDecisionId: input.expected?.releaseDecisionId ?? request.releaseDecisionId ?? '',
    consequenceType: input.expected?.consequenceType ?? request.enforcementPoint.consequenceType,
    riskClass: input.expected?.riskClass ?? request.enforcementPoint.riskClass,
    outputHash: input.expected?.outputHash ?? request.outputHash,
    consequenceHash: input.expected?.consequenceHash ?? request.consequenceHash,
    policyHash: input.expected?.policyHash ?? '',
    policyVersion: input.expected?.policyVersion ?? '',
    policyIrHash: input.expected?.policyIrHash ?? '',
    policyProvenanceSource: input.expected?.policyProvenanceSource ?? null,
    compiledPolicyIndexVersion: input.expected?.compiledPolicyIndexVersion ?? '',
    compiledPolicyIrVersion: input.expected?.compiledPolicyIrVersion ?? '',
    policyContext: input.expected?.policyContext ?? null,
  };
}

function expectedTenantIdForRequest(input: OfflineReleaseVerificationInput): {
  readonly tenantId: string | null;
  readonly source: 'input' | 'request-enforcement-point' | 'tenantless-explicit';
} {
  const expected = input.expected;
  if (
    expected !== undefined &&
    Object.prototype.hasOwnProperty.call(expected, 'tenantId')
  ) {
    return {
      tenantId: expected.tenantId ?? null,
      source: expected.tenantId === null ? 'tenantless-explicit' : 'input',
    };
  }
  return {
    tenantId: input.request.enforcementPoint.tenantId ?? null,
    source: 'request-enforcement-point',
  };
}

export function tenantBindingResult(input: {
  readonly verifierInput: OfflineReleaseVerificationInput;
  readonly claims: ReleaseTokenClaims | null;
}): OfflineReleaseVerification['tenantBinding'] {
  const expected = expectedTenantIdForRequest(input.verifierInput);
  const claimsTenantId = input.claims?.tenant_id ?? null;
  const checked = expected.tenantId !== null;
  return Object.freeze({
    expectedTenantId: expected.tenantId,
    expectedSource: expected.source,
    claimsTenantId,
    checked,
    matched: checked ? claimsTenantId === expected.tenantId : null,
  });
}
