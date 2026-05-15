import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  createReleaseDecisionSkeleton,
  type ReleaseDecision,
  type ReleasePolicyProvenance,
  type ReleaseTargetKind,
  type ReleaseTokenConfirmationClaim,
} from '../release-kernel/object-model.js';
import {
  isConsequenceType,
  isRiskClass,
  type ConsequenceType,
  type RiskClass,
} from '../release-kernel/types.js';
import type {
  ReleaseTokenIssuer,
} from '../release-kernel/release-token.js';
import type {
  AwaitableReleaseTokenIntrospectionStore,
} from '../release-kernel/release-introspection.js';
import {
  createConsequenceAdmissionResponse,
  type ConsequenceAdmissionProofRef,
  type ConsequenceAdmissionResponse,
  type GenericAdmissionEnvelope,
} from './index.js';
import type {
  ConsequenceAdmissionDownstreamBoundaryKind,
} from './downstream-enforcement-contract.js';
import {
  CONSEQUENCE_ADMISSION_PROTECTED_ENFORCEMENT_PROFILE_VERSION,
  resolveConsequenceAdmissionProtectedEnforcementProfile,
  type ConsequenceAdmissionProtectedEnforcementProfile,
} from './protected-enforcement-profile.js';
import type {
  ConsequenceAdmissionDomain,
} from './taxonomy.js';

export const CONSEQUENCE_ADMISSION_PROTECTED_RELEASE_TOKEN_ISSUANCE_VERSION =
  'attestor.consequence-admission-protected-release-token-issuance.v1';
export const CONSEQUENCE_ADMISSION_PROTECTED_RELEASE_TOKEN_POLICY_INDEX_VERSION =
  'attestor.generic-admission-protected-release-token.policy-index.v1';
export const CONSEQUENCE_ADMISSION_PROTECTED_RELEASE_TOKEN_POLICY_IR_VERSION =
  'attestor.generic-admission-protected-release-token.policy-ir.v1';

export const CONSEQUENCE_ADMISSION_PROTECTED_RELEASE_TOKEN_FAILURE_REASONS = [
  'admission-not-allowed',
  'non-enforcing-mode',
  'protected-release-token-not-required',
  'unsupported-risk-class',
  'tenant-id-required',
  'sender-confirmation-required',
  'review-authority-required',
] as const;
export type ConsequenceAdmissionProtectedReleaseTokenFailureReason =
  typeof CONSEQUENCE_ADMISSION_PROTECTED_RELEASE_TOKEN_FAILURE_REASONS[number];

export interface EvaluateGenericAdmissionProtectedReleaseTokenRequirementInput {
  readonly envelope: GenericAdmissionEnvelope;
  readonly boundaryKind?: ConsequenceAdmissionDownstreamBoundaryKind | null;
  readonly productionSensitive?: boolean | null;
}

export interface GenericAdmissionProtectedReleaseTokenRequirement {
  readonly version: typeof CONSEQUENCE_ADMISSION_PROTECTED_RELEASE_TOKEN_ISSUANCE_VERSION;
  readonly required: boolean;
  readonly profile: ConsequenceAdmissionProtectedEnforcementProfile | null;
  readonly failureReasons: readonly ConsequenceAdmissionProtectedReleaseTokenFailureReason[];
  readonly reasonCodes: readonly string[];
  readonly failClosedIfRequired: true;
  readonly rawReleaseTokenStored: false;
}

export interface GenericAdmissionProtectedReleaseTokenSummary {
  readonly version: typeof CONSEQUENCE_ADMISSION_PROTECTED_RELEASE_TOKEN_ISSUANCE_VERSION;
  readonly issued: true;
  readonly tokenId: string;
  readonly tokenDigest: string;
  readonly releaseDecisionId: string;
  readonly audience: string;
  readonly tenantId: string;
  readonly expiresAt: string;
  readonly keyId: string;
  readonly algorithm: string;
  readonly senderConstrained: true;
  readonly introspectionRequired: boolean;
  readonly replayConsumptionRequired: true;
  readonly introspectionAuthorityRegistered: boolean;
  readonly proofRefMatched: true;
  readonly profileVersion: typeof CONSEQUENCE_ADMISSION_PROTECTED_ENFORCEMENT_PROFILE_VERSION;
  readonly rawReleaseTokenStored: false;
}

export interface GenericAdmissionProtectedReleaseTokenIssuedEnvelope
  extends GenericAdmissionEnvelope {
  readonly protectedReleaseToken: GenericAdmissionProtectedReleaseTokenSummary;
}

export interface GenericAdmissionProtectedReleaseTokenAuthorization {
  readonly version: typeof CONSEQUENCE_ADMISSION_PROTECTED_RELEASE_TOKEN_ISSUANCE_VERSION;
  readonly tokenType: 'Bearer';
  readonly token: string;
  readonly tokenId: string;
  readonly tokenDigest: string;
  readonly audience: string;
  readonly expiresAt: string;
  readonly presentationRequired: 'sender-constrained';
  readonly rawTokenReturnedToCaller: true;
  readonly storeRawTokenInAdmissionOrShadow: false;
}

export interface IssueGenericAdmissionProtectedReleaseTokenInput
  extends EvaluateGenericAdmissionProtectedReleaseTokenRequirementInput {
  readonly issuer: ReleaseTokenIssuer;
  readonly confirmation?: ReleaseTokenConfirmationClaim | null;
  readonly issuedAt?: string | null;
  readonly tokenId?: string | null;
  readonly audience?: string | null;
  readonly ttlSeconds?: number;
  readonly introspectionStore?: Pick<
    AwaitableReleaseTokenIntrospectionStore,
    'registerIssuedToken'
  > | null;
}

export interface GenericAdmissionProtectedReleaseTokenIssueResult {
  readonly version: typeof CONSEQUENCE_ADMISSION_PROTECTED_RELEASE_TOKEN_ISSUANCE_VERSION;
  readonly envelope: GenericAdmissionProtectedReleaseTokenIssuedEnvelope;
  readonly authorization: GenericAdmissionProtectedReleaseTokenAuthorization;
  readonly releaseDecision: ReleaseDecision;
  readonly proofRef: ConsequenceAdmissionProofRef;
}

export class GenericAdmissionProtectedReleaseTokenIssuanceError extends Error {
  readonly failureReasons: readonly ConsequenceAdmissionProtectedReleaseTokenFailureReason[];
  readonly reasonCodes: readonly string[];

  constructor(input: {
    readonly message: string;
    readonly failureReasons: readonly ConsequenceAdmissionProtectedReleaseTokenFailureReason[];
  }) {
    super(input.message);
    this.name = 'GenericAdmissionProtectedReleaseTokenIssuanceError';
    this.failureReasons = Object.freeze([...input.failureReasons]);
    this.reasonCodes = Object.freeze(
      input.failureReasons.map((reason) => `protected-release-token-${reason}`),
    );
  }
}

function canonicalDigest(value: CanonicalReleaseJsonValue): string {
  const canonical = canonicalizeReleaseJson(value);
  return `sha256:${createHash('sha256').update(canonical).digest('hex')}`;
}

function releaseTokenDigest(token: string): string {
  return `sha256:${createHash('sha256').update(token).digest('hex')}`;
}

function domainFromAdmission(admission: ConsequenceAdmissionResponse): ConsequenceAdmissionDomain | null {
  const domain = admission.request.policyScope.dimensions.domain;
  return typeof domain === 'string' ? domain as ConsequenceAdmissionDomain : null;
}

function inferBoundaryKind(admission: ConsequenceAdmissionResponse): ConsequenceAdmissionDownstreamBoundaryKind {
  switch (domainFromAdmission(admission)) {
    case 'financial-record':
      return 'record-writer';
    case 'money-movement':
      return 'payment-adapter';
    case 'programmable-money':
      return 'wallet-adapter';
    case 'data-disclosure':
      return 'artifact-exporter';
    case 'authority-change':
    case 'system-operation':
      return 'action-dispatcher';
    case 'external-communication':
      return 'communication-sender';
    case 'regulated-filing':
      return 'artifact-exporter';
    case 'decision-support':
      return 'http-handler';
    default:
      return 'custom';
  }
}

function confirmationHasSenderConstraint(
  confirmation: ReleaseTokenConfirmationClaim | null | undefined,
): confirmation is ReleaseTokenConfirmationClaim {
  if (!confirmation) return false;
  return (
    typeof confirmation.jkt === 'string' && confirmation.jkt.trim().length > 0
  ) || (
    typeof confirmation['x5t#S256'] === 'string' &&
    confirmation['x5t#S256'].trim().length > 0
  ) || (
    typeof confirmation.spiffe_id === 'string' &&
    confirmation.spiffe_id.trim().length > 0
  );
}

function normalizeOptionalIdentifier(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeIssuedAt(value: string | null | undefined, fallback: string): string {
  const candidate = value ?? fallback;
  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Generic admission protected release-token issuance requires a valid issuedAt timestamp.');
  }
  return parsed.toISOString();
}

function riskClassFor(admission: ConsequenceAdmissionResponse): RiskClass | null {
  const riskClass = admission.request.proposedConsequence.riskClass;
  return typeof riskClass === 'string' && isRiskClass(riskClass) ? riskClass : null;
}

function consequenceTypeFor(admission: ConsequenceAdmissionResponse): ConsequenceType {
  const kind = admission.request.proposedConsequence.consequenceKind;
  return isConsequenceType(kind) ? kind : 'action';
}

function targetKindFor(boundaryKind: ConsequenceAdmissionDownstreamBoundaryKind): ReleaseTargetKind {
  switch (boundaryKind) {
    case 'record-writer':
      return 'record-store';
    case 'artifact-exporter':
      return 'artifact-registry';
    case 'message-consumer':
      return 'queue';
    case 'http-handler':
      return 'endpoint';
    default:
      return 'workflow';
  }
}

function reviewAuthoritySatisfied(admission: ConsequenceAdmissionResponse): boolean {
  const riskClass = riskClassFor(admission);
  if (riskClass !== 'R3' && riskClass !== 'R4') return true;
  const reviewerRef = normalizeOptionalIdentifier(admission.request.authority.reviewerRef);
  if (reviewerRef === null) return false;
  if (riskClass !== 'R4') return true;
  const signerRef = normalizeOptionalIdentifier(admission.request.authority.signerRef);
  return signerRef !== null && signerRef !== reviewerRef;
}

function releasePolicyProvenanceFor(input: {
  readonly admission: ConsequenceAdmissionResponse;
  readonly policyHash: string;
  readonly policyIrHash: string;
}): ReleasePolicyProvenance {
  const policyRef = normalizeOptionalIdentifier(input.admission.request.policyScope.policyRef) ??
    'generic-admission-policy';
  return Object.freeze({
    source: 'compiled-admission-policy-index',
    policyId: policyRef,
    policySpecVersion: input.admission.version,
    policyHash: input.policyHash,
    compiledPolicyHash: input.policyHash,
    compiledPolicyIrHash: input.policyIrHash,
    compiledPolicyIndexVersion: CONSEQUENCE_ADMISSION_PROTECTED_RELEASE_TOKEN_POLICY_INDEX_VERSION,
    compiledPolicyIrVersion: CONSEQUENCE_ADMISSION_PROTECTED_RELEASE_TOKEN_POLICY_IR_VERSION,
    verificationValid: true,
    verificationErrorCodes: Object.freeze([]),
    verificationWarningCodes: Object.freeze([]),
  });
}

function releaseDecisionFor(input: {
  readonly admission: ConsequenceAdmissionResponse;
  readonly boundaryKind: ConsequenceAdmissionDownstreamBoundaryKind;
  readonly issuedAt: string;
  readonly audience: string;
}): ReleaseDecision {
  const admission = input.admission;
  const riskClass = riskClassFor(admission);
  if (riskClass === null) {
    throw new GenericAdmissionProtectedReleaseTokenIssuanceError({
      message: 'Generic admission protected release-token issuance requires a standard R0-R4 risk class.',
      failureReasons: ['unsupported-risk-class'],
    });
  }
  const policyHash = canonicalDigest({
    policyRef: admission.request.policyScope.policyRef,
    requestId: admission.request.requestId,
    reasonCodes: admission.reasonCodes,
    checks: admission.checks.map((check) => ({
      kind: check.kind,
      outcome: check.outcome,
      required: check.required,
      reasonCodes: check.reasonCodes,
    })),
  } as unknown as CanonicalReleaseJsonValue);
  const policyIrHash = canonicalDigest({
    admissionDigest: admission.digest,
    profileVersion: CONSEQUENCE_ADMISSION_PROTECTED_ENFORCEMENT_PROFILE_VERSION,
    protectedReleaseTokenPolicyIndexVersion:
      CONSEQUENCE_ADMISSION_PROTECTED_RELEASE_TOKEN_POLICY_INDEX_VERSION,
    boundaryKind: input.boundaryKind,
    audience: input.audience,
  } as unknown as CanonicalReleaseJsonValue);
  const consequenceHash = canonicalDigest({
    proposedConsequence: admission.request.proposedConsequence,
    policyScope: admission.request.policyScope,
  } as unknown as CanonicalReleaseJsonValue);
  const policyRef = normalizeOptionalIdentifier(admission.request.policyScope.policyRef) ??
    'generic-admission-policy';
  const reviewerRef = normalizeOptionalIdentifier(admission.request.authority.reviewerRef);

  return createReleaseDecisionSkeleton({
    id: `release-decision:${admission.admissionId}`,
    createdAt: input.issuedAt,
    status: 'accepted',
    policyVersion: policyRef,
    policyHash,
    policyProvenance: releasePolicyProvenanceFor({
      admission,
      policyHash,
      policyIrHash,
    }),
    outputHash: admission.digest,
    consequenceHash,
    outputContract: {
      artifactType: `generic-admission:${domainFromAdmission(admission) ?? 'custom'}`,
      expectedShape: admission.request.proposedConsequence.summary,
      consequenceType: consequenceTypeFor(admission),
      riskClass,
    },
    capabilityBoundary: {
      allowedTools: [admission.request.proposedConsequence.action],
      allowedTargets: [input.audience],
      allowedDataDomains: [domainFromAdmission(admission) ?? 'custom'],
    },
    requester: {
      id: admission.request.authority.actorRef ?? admission.request.proposedConsequence.actor,
      type: 'service',
    },
    target: {
      kind: targetKindFor(input.boundaryKind),
      id: input.audience,
    },
    reviewAuthority: reviewerRef
      ? {
          requiredReviewerIds: [reviewerRef],
          requiredRoles: [],
        }
      : undefined,
  });
}

export function evaluateGenericAdmissionProtectedReleaseTokenRequirement(
  input: EvaluateGenericAdmissionProtectedReleaseTokenRequirementInput,
): GenericAdmissionProtectedReleaseTokenRequirement {
  const admission = input.envelope.admission;
  const riskClass = riskClassFor(admission);
  const failureReasons: ConsequenceAdmissionProtectedReleaseTokenFailureReason[] = [];

  if (!admission.allowed) {
    failureReasons.push('admission-not-allowed');
  }
  if (!input.envelope.enforcementActive || input.envelope.downstreamPosture !== 'enforce-decision') {
    failureReasons.push('non-enforcing-mode');
  }
  if (riskClass === null) {
    failureReasons.push('unsupported-risk-class');
  }

  const profile = riskClass === null
    ? null
    : resolveConsequenceAdmissionProtectedEnforcementProfile({
        riskClass,
        boundaryKind: input.boundaryKind ?? inferBoundaryKind(admission),
        consequenceDomain: domainFromAdmission(admission),
        consequenceKind: admission.request.proposedConsequence.consequenceKind,
        productionSensitive: input.productionSensitive,
      });
  const required =
    failureReasons.length === 0 &&
    profile?.minimumPath === 'release-enforcement-plane';
  if (failureReasons.length === 0 && !required) {
    failureReasons.push('protected-release-token-not-required');
  }

  return Object.freeze({
    version: CONSEQUENCE_ADMISSION_PROTECTED_RELEASE_TOKEN_ISSUANCE_VERSION,
    required,
    profile,
    failureReasons: Object.freeze([...new Set(failureReasons)]),
    reasonCodes: Object.freeze([
      required
        ? 'protected-release-token-required'
        : 'protected-release-token-not-required',
      ...failureReasons.map((reason) => `protected-release-token-${reason}`),
    ]),
    failClosedIfRequired: true,
    rawReleaseTokenStored: false,
  });
}

export async function issueGenericAdmissionProtectedReleaseToken(
  input: IssueGenericAdmissionProtectedReleaseTokenInput,
): Promise<GenericAdmissionProtectedReleaseTokenIssueResult> {
  const requirement = evaluateGenericAdmissionProtectedReleaseTokenRequirement(input);
  const admission = input.envelope.admission;
  const tenantId = normalizeOptionalIdentifier(
    input.envelope.admission.request.policyScope.tenantId,
  );
  const audience = normalizeOptionalIdentifier(input.audience) ??
    admission.request.proposedConsequence.downstreamSystem;
  const issuedAt = normalizeIssuedAt(input.issuedAt, admission.decidedAt);
  const failureReasons: ConsequenceAdmissionProtectedReleaseTokenFailureReason[] = [];

  if (!requirement.required) {
    failureReasons.push(...requirement.failureReasons);
  }
  if (tenantId === null) {
    failureReasons.push('tenant-id-required');
  }
  if (!confirmationHasSenderConstraint(input.confirmation)) {
    failureReasons.push('sender-confirmation-required');
  }
  if (!reviewAuthoritySatisfied(admission)) {
    failureReasons.push('review-authority-required');
  }

  const uniqueFailures = Object.freeze([...new Set(failureReasons)]);
  if (uniqueFailures.length > 0) {
    throw new GenericAdmissionProtectedReleaseTokenIssuanceError({
      message: `Generic admission protected release-token issuance failed: ${uniqueFailures.join(', ')}.`,
      failureReasons: uniqueFailures,
    });
  }
  if (tenantId === null) {
    throw new GenericAdmissionProtectedReleaseTokenIssuanceError({
      message: 'Generic admission protected release-token issuance requires a tenant id.',
      failureReasons: ['tenant-id-required'],
    });
  }

  const boundaryKind = input.boundaryKind ?? inferBoundaryKind(admission);
  const releaseDecision = releaseDecisionFor({
    admission,
    boundaryKind,
    issuedAt,
    audience,
  });
  const issuedToken = await input.issuer.issue({
    decision: releaseDecision,
    issuedAt,
    tokenId: normalizeOptionalIdentifier(input.tokenId) ?? undefined,
    ttlSeconds: input.ttlSeconds,
    audience,
    tenantId,
    scope: `${domainFromAdmission(admission) ?? 'custom'}:${admission.request.proposedConsequence.action}`,
    resource: audience,
    actor: {
      sub: admission.request.proposedConsequence.actor,
      actor_type: 'service',
    },
    confirmation: input.confirmation ?? undefined,
  });
  const registeredToken = input.introspectionStore
    ? await input.introspectionStore.registerIssuedToken({
        issuedToken,
        decision: releaseDecision,
      })
    : null;
  const tokenDigest = releaseTokenDigest(issuedToken.token);
  const proofRef = Object.freeze({
    kind: 'release-token',
    id: issuedToken.tokenId,
    digest: tokenDigest,
    uri: null,
    verifyHint:
      'Verify this sender-constrained release token with attestor/release-enforcement-plane before executing the protected generic admission.',
  } satisfies ConsequenceAdmissionProofRef);
  const finalAdmission = createConsequenceAdmissionResponse({
    request: admission.request,
    decidedAt: admission.decidedAt,
    decision: admission.decision,
    reason: admission.reason,
    reasonCodes: [
      ...admission.reasonCodes,
      'protected-release-token-issued',
      'protected-release-token-sender-constrained',
      'protected-release-token-online-introspection-required',
      'protected-release-token-replay-consume-required',
      ...(registeredToken
        ? ['protected-release-token-introspection-authority-registered']
        : []),
    ],
    checks: admission.checks,
    constraints: admission.constraints,
    nativeDecision: admission.nativeDecision,
    proof: [...admission.proof, proofRef],
    operationalContext: {
      ...admission.operationalContext,
      protectedReleaseTokenIssued: true,
      protectedReleaseTokenId: issuedToken.tokenId,
      protectedReleaseTokenDigest: tokenDigest,
      protectedReleaseTokenAudience: audience,
      protectedReleaseTokenSenderConstrained: true,
      protectedReleaseTokenIntrospectionRequired: issuedToken.claims.introspection_required,
      protectedReleaseTokenReplayConsumeRequired: true,
      protectedReleaseTokenIntrospectionAuthorityRegistered: registeredToken !== null,
      protectedReleaseTokenRawStored: false,
      protectedEnforcementProfileVersion: CONSEQUENCE_ADMISSION_PROTECTED_ENFORCEMENT_PROFILE_VERSION,
      protectedReleaseTokenIssuanceVersion:
        CONSEQUENCE_ADMISSION_PROTECTED_RELEASE_TOKEN_ISSUANCE_VERSION,
    },
  });
  const summary = Object.freeze({
    version: CONSEQUENCE_ADMISSION_PROTECTED_RELEASE_TOKEN_ISSUANCE_VERSION,
    issued: true,
    tokenId: issuedToken.tokenId,
    tokenDigest,
    releaseDecisionId: releaseDecision.id,
    audience,
    tenantId,
    expiresAt: issuedToken.expiresAt,
    keyId: issuedToken.keyId,
    algorithm: issuedToken.algorithm,
    senderConstrained: true,
    introspectionRequired: issuedToken.claims.introspection_required,
    replayConsumptionRequired: true,
    introspectionAuthorityRegistered: registeredToken !== null,
    proofRefMatched: true,
    profileVersion: CONSEQUENCE_ADMISSION_PROTECTED_ENFORCEMENT_PROFILE_VERSION,
    rawReleaseTokenStored: false,
  } satisfies GenericAdmissionProtectedReleaseTokenSummary);
  const envelope = Object.freeze({
    ...input.envelope,
    admission: finalAdmission,
    protectedReleaseToken: summary,
  } satisfies GenericAdmissionProtectedReleaseTokenIssuedEnvelope);

  return Object.freeze({
    version: CONSEQUENCE_ADMISSION_PROTECTED_RELEASE_TOKEN_ISSUANCE_VERSION,
    envelope,
    authorization: Object.freeze({
      version: CONSEQUENCE_ADMISSION_PROTECTED_RELEASE_TOKEN_ISSUANCE_VERSION,
      tokenType: 'Bearer',
      token: issuedToken.token,
      tokenId: issuedToken.tokenId,
      tokenDigest,
      audience,
      expiresAt: issuedToken.expiresAt,
      presentationRequired: 'sender-constrained',
      rawTokenReturnedToCaller: true,
      storeRawTokenInAdmissionOrShadow: false,
    } satisfies GenericAdmissionProtectedReleaseTokenAuthorization),
    releaseDecision,
    proofRef,
  });
}
