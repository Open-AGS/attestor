import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';

export const PROTECTED_ADMISSION_E2E_PROOF_PLAN_VERSION =
  'attestor.protected-admission-e2e-proof-plan.v1';

export const PROTECTED_ADMISSION_E2E_STAGE_IDS = [
  'admission-decision',
  'sender-confirmed-token-request',
  'protected-release-token-issuance',
  'online-introspection',
  'token-use-replay-consumption',
  'customer-pep-enforcement',
  'downstream-receipt',
] as const;
export type ProtectedAdmissionE2eStageId =
  typeof PROTECTED_ADMISSION_E2E_STAGE_IDS[number];

export type ProtectedAdmissionE2eStageStatus = 'proven' | 'blocked';

export type ProtectedAdmissionE2eStoreDurability = 'shared' | 'local' | 'missing';

export type ProtectedAdmissionE2eIssuerBoundary =
  | 'external-kms-hsm'
  | 'runtime-release-token-issuer'
  | 'missing';

export type ProtectedAdmissionE2ePepKind =
  | 'envoy-ext-authz'
  | 'istio-custom-authz'
  | 'node-middleware'
  | 'hono-middleware'
  | 'customer-custom-pep'
  | 'missing';

export type ProtectedAdmissionE2eNextUnlock =
  | 'customer-pep-adoption-package'
  | 'close-protected-admission-fixture-gaps';

export type ProtectedAdmissionE2eBlocker =
  | 'admission-not-allowed'
  | 'admission-digest-missing'
  | 'review-authority-missing'
  | 'r4-distinct-signer-missing'
  | 'dpop-proof-not-verified'
  | 'dpop-confirmation-not-bound'
  | 'dpop-proof-replay-not-consumed'
  | 'production-dpop-proof-replay-store-not-shared'
  | 'raw-dpop-proof-storage-risk'
  | 'protected-release-token-not-issued'
  | 'protected-release-token-not-sender-constrained'
  | 'protected-release-token-proof-ref-missing'
  | 'issuer-boundary-missing'
  | 'production-issuer-boundary-not-external'
  | 'external-issuer-proof-not-valid'
  | 'raw-release-token-storage-risk'
  | 'online-introspection-not-required'
  | 'introspection-authority-not-registered'
  | 'online-introspection-not-active'
  | 'production-introspection-store-not-shared'
  | 'token-use-replay-not-consumed'
  | 'token-use-replay-not-separated-from-dpop-proof-replay'
  | 'production-token-use-replay-store-not-shared'
  | 'pep-runtime-missing'
  | 'pep-route-coverage-incomplete'
  | 'pep-fail-closed-not-configured'
  | 'pep-bypass-routes-present'
  | 'pep-verifier-not-integrated'
  | 'customer-approval-missing'
  | 'downstream-receipt-missing'
  | 'downstream-receipt-not-bound-to-admission'
  | 'downstream-receipt-not-bound-to-decision'
  | 'downstream-receipt-not-bound-to-token-use'
  | 'raw-downstream-payload-storage-risk'
  | 'signed-bearer-helper-insufficient';

export type ProtectedAdmissionE2eNoGoCondition =
  | 'signed-bearer-only'
  | 'sender-proof-replay-not-proven'
  | 'external-issuer-not-proven'
  | 'online-liveness-not-proven'
  | 'token-use-replay-not-proven'
  | 'customer-pep-not-proven'
  | 'downstream-receipt-not-proven'
  | 'raw-material-storage-risk'
  | 'production-shared-not-proven';

export interface ProtectedAdmissionE2eStageRequirement {
  readonly id: ProtectedAdmissionE2eStageId;
  readonly order: number;
  readonly requiredEvidence: readonly string[];
  readonly primaryAnchor: string;
}

export interface ProtectedAdmissionE2eProofPlanDescriptor {
  readonly version: typeof PROTECTED_ADMISSION_E2E_PROOF_PLAN_VERSION;
  readonly stages: readonly ProtectedAdmissionE2eStageRequirement[];
  readonly requiresDpopSenderConstraint: true;
  readonly requiresOnlineIntrospection: true;
  readonly requiresReplayConsumption: true;
  readonly requiresCustomerPep: true;
  readonly requiresDownstreamReceipt: true;
  readonly rawTokenStorageAllowed: false;
  readonly productionReady: false;
  readonly activatesRuntime: false;
  readonly primaryAnchors: readonly string[];
}

export interface ProtectedAdmissionE2eProofPlanInput {
  readonly routeId: string;
  readonly runtimeProfileId?: string | null;
  readonly riskClass: 'R3' | 'R4';
  readonly admissionAllowed: boolean;
  readonly admissionDecisionDigest?: string | null;
  readonly reviewerRefPresent?: boolean | null;
  readonly signerRefDistinct?: boolean | null;
  readonly dpopProofVerified?: boolean | null;
  readonly dpopConfirmationJktBound?: boolean | null;
  readonly dpopProofReplayConsumed?: boolean | null;
  readonly dpopProofReplayStoreDurability?: ProtectedAdmissionE2eStoreDurability | null;
  readonly rawDpopProofStored?: boolean | null;
  readonly protectedReleaseTokenIssued?: boolean | null;
  readonly protectedReleaseTokenSenderConstrained?: boolean | null;
  readonly protectedReleaseTokenProofRefDigest?: string | null;
  readonly issuerBoundary?: ProtectedAdmissionE2eIssuerBoundary | null;
  readonly externalIssuerProofValid?: boolean | null;
  readonly rawReleaseTokenStored?: boolean | null;
  readonly onlineIntrospectionRequired?: boolean | null;
  readonly introspectionAuthorityRegistered?: boolean | null;
  readonly onlineIntrospectionActive?: boolean | null;
  readonly introspectionStoreDurability?: ProtectedAdmissionE2eStoreDurability | null;
  readonly tokenUseReplayConsumed?: boolean | null;
  readonly tokenUseReplayStoreDurability?: ProtectedAdmissionE2eStoreDurability | null;
  readonly tokenUseReplaySeparatedFromDpopProofReplay?: boolean | null;
  readonly pepKind?: ProtectedAdmissionE2ePepKind | null;
  readonly pepRouteCoverageComplete?: boolean | null;
  readonly pepFailClosed?: boolean | null;
  readonly pepBypassRoutesPresent?: boolean | null;
  readonly pepVerifierIntegrated?: boolean | null;
  readonly customerApprovalDigest?: string | null;
  readonly downstreamReceiptDigest?: string | null;
  readonly downstreamReceiptBoundToAdmission?: boolean | null;
  readonly downstreamReceiptBoundToDecision?: boolean | null;
  readonly downstreamReceiptBoundToTokenUse?: boolean | null;
  readonly rawDownstreamPayloadStored?: boolean | null;
}

export interface ProtectedAdmissionE2eStageEvaluation {
  readonly id: ProtectedAdmissionE2eStageId;
  readonly order: number;
  readonly status: ProtectedAdmissionE2eStageStatus;
  readonly blockers: readonly ProtectedAdmissionE2eBlocker[];
}

export interface ProtectedAdmissionE2eProofPlanEvaluation {
  readonly version: typeof PROTECTED_ADMISSION_E2E_PROOF_PLAN_VERSION;
  readonly routeId: string;
  readonly runtimeProfileId: string | null;
  readonly riskClass: 'R3' | 'R4';
  readonly stages: readonly ProtectedAdmissionE2eStageEvaluation[];
  readonly proofPlanSatisfied: boolean;
  readonly firstNarrowFixtureReady: boolean;
  readonly signedBearerHelperSufficient: false;
  readonly productionReady: false;
  readonly activatesRuntime: false;
  readonly nextUnlock: ProtectedAdmissionE2eNextUnlock;
  readonly blockers: readonly ProtectedAdmissionE2eBlocker[];
  readonly noGoConditions: readonly ProtectedAdmissionE2eNoGoCondition[];
  readonly digest: string;
  readonly limitation: string;
}

const STAGE_REQUIREMENTS: readonly ProtectedAdmissionE2eStageRequirement[] =
  Object.freeze([
    {
      id: 'admission-decision',
      order: 1,
      requiredEvidence: Object.freeze([
        'allowed admission decision',
        'admission digest',
        'R3 reviewer or R4 reviewer plus distinct signer',
      ]),
      primaryAnchor: 'Attestor consequence admission contract',
    },
    {
      id: 'sender-confirmed-token-request',
      order: 2,
      requiredEvidence: Object.freeze([
        'valid DPoP proof',
        'DPoP jwk thumbprint confirmation',
        'DPoP proof jti replay consumption',
      ]),
      primaryAnchor: 'OAuth DPoP RFC 9449',
    },
    {
      id: 'protected-release-token-issuance',
      order: 3,
      requiredEvidence: Object.freeze([
        'sender-constrained protected release token',
        'admission proof ref token digest',
        'issuer boundary evidence',
      ]),
      primaryAnchor: 'OAuth Token Exchange RFC 8693 and JWT BCP RFC 8725',
    },
    {
      id: 'online-introspection',
      order: 4,
      requiredEvidence: Object.freeze([
        'registered introspection authority',
        'active online introspection result',
        'durable introspection store for production-shared',
      ]),
      primaryAnchor: 'OAuth Token Introspection RFC 7662',
    },
    {
      id: 'token-use-replay-consumption',
      order: 5,
      requiredEvidence: Object.freeze([
        'release token use consumed',
        'token-use replay separated from DPoP proof replay',
        'durable replay store for production-shared',
      ]),
      primaryAnchor: 'PostgreSQL INSERT ON CONFLICT first-writer-wins pattern',
    },
    {
      id: 'customer-pep-enforcement',
      order: 6,
      requiredEvidence: Object.freeze([
        'route coverage',
        'fail-closed PEP',
        'no bypass routes',
        'verifier integrated',
        'customer approval',
      ]),
      primaryAnchor: 'Envoy ext_authz / Istio custom authorization PEP pattern',
    },
    {
      id: 'downstream-receipt',
      order: 7,
      requiredEvidence: Object.freeze([
        'downstream receipt digest',
        'receipt bound to admission',
        'receipt bound to release decision',
        'receipt bound to token-use consumption',
      ]),
      primaryAnchor: 'Attestor release and consequence receipt model',
    },
  ]);

function isSha256Digest(value: string | null | undefined): boolean {
  return typeof value === 'string' && /^sha256:[a-f0-9]{64}$/u.test(value);
}

function normalizeRouteId(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error('Protected admission E2E proof plan requires a route id.');
  }
  return normalized;
}

function normalizeRuntimeProfileId(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeDurability(
  value: ProtectedAdmissionE2eStoreDurability | null | undefined,
): ProtectedAdmissionE2eStoreDurability {
  return value ?? 'missing';
}

function unique<T extends string>(values: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(values)]);
}

function digestEvaluation(value: CanonicalReleaseJsonValue): string {
  return `sha256:${createHash('sha256').update(canonicalizeReleaseJson(value)).digest('hex')}`;
}

function evaluateStage(
  id: ProtectedAdmissionE2eStageId,
  blockers: readonly ProtectedAdmissionE2eBlocker[],
): ProtectedAdmissionE2eStageEvaluation {
  const requirement = STAGE_REQUIREMENTS.find((entry) => entry.id === id);
  if (!requirement) {
    throw new Error(`Unknown protected admission E2E stage: ${id}.`);
  }
  const stageBlockers = unique(blockers);
  return Object.freeze({
    id,
    order: requirement.order,
    status: stageBlockers.length === 0 ? 'proven' : 'blocked',
    blockers: stageBlockers,
  });
}

export function protectedAdmissionE2eProofPlanDescriptor():
ProtectedAdmissionE2eProofPlanDescriptor {
  return Object.freeze({
    version: PROTECTED_ADMISSION_E2E_PROOF_PLAN_VERSION,
    stages: STAGE_REQUIREMENTS,
    requiresDpopSenderConstraint: true,
    requiresOnlineIntrospection: true,
    requiresReplayConsumption: true,
    requiresCustomerPep: true,
    requiresDownstreamReceipt: true,
    rawTokenStorageAllowed: false,
    productionReady: false,
    activatesRuntime: false,
    primaryAnchors: Object.freeze([
      'OAuth DPoP RFC 9449',
      'OAuth Token Introspection RFC 7662',
      'OAuth Token Exchange RFC 8693',
      'JWT BCP RFC 8725',
      'Envoy ext_authz',
      'Istio custom authorization',
    ]),
  });
}

export function evaluateProtectedAdmissionE2eProofPlan(
  input: ProtectedAdmissionE2eProofPlanInput,
): ProtectedAdmissionE2eProofPlanEvaluation {
  const routeId = normalizeRouteId(input.routeId);
  const runtimeProfileId = normalizeRuntimeProfileId(input.runtimeProfileId);
  const productionShared = runtimeProfileId === 'production-shared';
  const dpopDurability = normalizeDurability(input.dpopProofReplayStoreDurability);
  const introspectionDurability = normalizeDurability(input.introspectionStoreDurability);
  const tokenUseDurability = normalizeDurability(input.tokenUseReplayStoreDurability);
  const issuerBoundary = input.issuerBoundary ?? 'missing';

  const admissionBlockers: ProtectedAdmissionE2eBlocker[] = [];
  if (!input.admissionAllowed) admissionBlockers.push('admission-not-allowed');
  if (!isSha256Digest(input.admissionDecisionDigest)) {
    admissionBlockers.push('admission-digest-missing');
  }
  if (input.reviewerRefPresent !== true) {
    admissionBlockers.push('review-authority-missing');
  }
  if (input.riskClass === 'R4' && input.signerRefDistinct !== true) {
    admissionBlockers.push('r4-distinct-signer-missing');
  }

  const senderBlockers: ProtectedAdmissionE2eBlocker[] = [];
  if (input.dpopProofVerified !== true) senderBlockers.push('dpop-proof-not-verified');
  if (input.dpopConfirmationJktBound !== true) {
    senderBlockers.push('dpop-confirmation-not-bound');
  }
  if (input.dpopProofReplayConsumed !== true) {
    senderBlockers.push('dpop-proof-replay-not-consumed');
  }
  if (productionShared && dpopDurability !== 'shared') {
    senderBlockers.push('production-dpop-proof-replay-store-not-shared');
  }
  if (input.rawDpopProofStored === true) senderBlockers.push('raw-dpop-proof-storage-risk');

  const tokenBlockers: ProtectedAdmissionE2eBlocker[] = [];
  if (input.protectedReleaseTokenIssued !== true) {
    tokenBlockers.push('protected-release-token-not-issued');
  }
  if (input.protectedReleaseTokenSenderConstrained !== true) {
    tokenBlockers.push('protected-release-token-not-sender-constrained');
  }
  if (!isSha256Digest(input.protectedReleaseTokenProofRefDigest)) {
    tokenBlockers.push('protected-release-token-proof-ref-missing');
  }
  if (issuerBoundary === 'missing') tokenBlockers.push('issuer-boundary-missing');
  if (productionShared && issuerBoundary !== 'external-kms-hsm') {
    tokenBlockers.push('production-issuer-boundary-not-external');
  }
  if (issuerBoundary === 'external-kms-hsm' && input.externalIssuerProofValid !== true) {
    tokenBlockers.push('external-issuer-proof-not-valid');
  }
  if (input.rawReleaseTokenStored === true) {
    tokenBlockers.push('raw-release-token-storage-risk');
  }

  const introspectionBlockers: ProtectedAdmissionE2eBlocker[] = [];
  if (input.onlineIntrospectionRequired !== true) {
    introspectionBlockers.push('online-introspection-not-required');
  }
  if (input.introspectionAuthorityRegistered !== true) {
    introspectionBlockers.push('introspection-authority-not-registered');
  }
  if (input.onlineIntrospectionActive !== true) {
    introspectionBlockers.push('online-introspection-not-active');
  }
  if (productionShared && introspectionDurability !== 'shared') {
    introspectionBlockers.push('production-introspection-store-not-shared');
  }

  const replayBlockers: ProtectedAdmissionE2eBlocker[] = [];
  if (input.tokenUseReplayConsumed !== true) {
    replayBlockers.push('token-use-replay-not-consumed');
  }
  if (input.tokenUseReplaySeparatedFromDpopProofReplay !== true) {
    replayBlockers.push('token-use-replay-not-separated-from-dpop-proof-replay');
  }
  if (productionShared && tokenUseDurability !== 'shared') {
    replayBlockers.push('production-token-use-replay-store-not-shared');
  }

  const pepBlockers: ProtectedAdmissionE2eBlocker[] = [];
  if ((input.pepKind ?? 'missing') === 'missing') pepBlockers.push('pep-runtime-missing');
  if (input.pepRouteCoverageComplete !== true) {
    pepBlockers.push('pep-route-coverage-incomplete');
  }
  if (input.pepFailClosed !== true) pepBlockers.push('pep-fail-closed-not-configured');
  if (input.pepBypassRoutesPresent === true) pepBlockers.push('pep-bypass-routes-present');
  if (input.pepVerifierIntegrated !== true) pepBlockers.push('pep-verifier-not-integrated');
  if (!isSha256Digest(input.customerApprovalDigest)) {
    pepBlockers.push('customer-approval-missing');
  }

  const receiptBlockers: ProtectedAdmissionE2eBlocker[] = [];
  if (!isSha256Digest(input.downstreamReceiptDigest)) {
    receiptBlockers.push('downstream-receipt-missing');
  }
  if (input.downstreamReceiptBoundToAdmission !== true) {
    receiptBlockers.push('downstream-receipt-not-bound-to-admission');
  }
  if (input.downstreamReceiptBoundToDecision !== true) {
    receiptBlockers.push('downstream-receipt-not-bound-to-decision');
  }
  if (input.downstreamReceiptBoundToTokenUse !== true) {
    receiptBlockers.push('downstream-receipt-not-bound-to-token-use');
  }
  if (input.rawDownstreamPayloadStored === true) {
    receiptBlockers.push('raw-downstream-payload-storage-risk');
  }

  if (
    input.protectedReleaseTokenIssued === true &&
    (
      input.protectedReleaseTokenSenderConstrained !== true ||
      input.onlineIntrospectionRequired !== true ||
      input.tokenUseReplayConsumed !== true
    )
  ) {
    tokenBlockers.push('signed-bearer-helper-insufficient');
  }

  const stages = Object.freeze([
    evaluateStage('admission-decision', admissionBlockers),
    evaluateStage('sender-confirmed-token-request', senderBlockers),
    evaluateStage('protected-release-token-issuance', tokenBlockers),
    evaluateStage('online-introspection', introspectionBlockers),
    evaluateStage('token-use-replay-consumption', replayBlockers),
    evaluateStage('customer-pep-enforcement', pepBlockers),
    evaluateStage('downstream-receipt', receiptBlockers),
  ]);
  const blockers = unique(stages.flatMap((stage) => stage.blockers));
  const proofPlanSatisfied = blockers.length === 0;
  const noGoConditions: ProtectedAdmissionE2eNoGoCondition[] = [];

  if (blockers.includes('signed-bearer-helper-insufficient')) {
    noGoConditions.push('signed-bearer-only');
  }
  if (senderBlockers.length > 0) noGoConditions.push('sender-proof-replay-not-proven');
  if (
    tokenBlockers.includes('issuer-boundary-missing') ||
    tokenBlockers.includes('production-issuer-boundary-not-external') ||
    tokenBlockers.includes('external-issuer-proof-not-valid')
  ) {
    noGoConditions.push('external-issuer-not-proven');
  }
  if (introspectionBlockers.length > 0) noGoConditions.push('online-liveness-not-proven');
  if (replayBlockers.length > 0) noGoConditions.push('token-use-replay-not-proven');
  if (pepBlockers.length > 0) noGoConditions.push('customer-pep-not-proven');
  if (receiptBlockers.length > 0) noGoConditions.push('downstream-receipt-not-proven');
  if (
    blockers.some((blocker) =>
      blocker === 'raw-dpop-proof-storage-risk' ||
      blocker === 'raw-release-token-storage-risk' ||
      blocker === 'raw-downstream-payload-storage-risk')
  ) {
    noGoConditions.push('raw-material-storage-risk');
  }
  if (
    productionShared &&
    blockers.some((blocker) =>
      blocker === 'production-dpop-proof-replay-store-not-shared' ||
      blocker === 'production-issuer-boundary-not-external' ||
      blocker === 'production-introspection-store-not-shared' ||
      blocker === 'production-token-use-replay-store-not-shared')
  ) {
    noGoConditions.push('production-shared-not-proven');
  }

  const digest = digestEvaluation({
    version: PROTECTED_ADMISSION_E2E_PROOF_PLAN_VERSION,
    routeId,
    runtimeProfileId,
    riskClass: input.riskClass,
    stages: stages.map((stage) => ({
      id: stage.id,
      order: stage.order,
      status: stage.status,
      blockers: stage.blockers,
    })),
    proofPlanSatisfied,
    blockers,
    noGoConditions: unique(noGoConditions),
  } as CanonicalReleaseJsonValue);

  return Object.freeze({
    version: PROTECTED_ADMISSION_E2E_PROOF_PLAN_VERSION,
    routeId,
    runtimeProfileId,
    riskClass: input.riskClass,
    stages,
    proofPlanSatisfied,
    firstNarrowFixtureReady: proofPlanSatisfied,
    signedBearerHelperSufficient: false,
    productionReady: false,
    activatesRuntime: false,
    nextUnlock: proofPlanSatisfied
      ? 'customer-pep-adoption-package'
      : 'close-protected-admission-fixture-gaps',
    blockers,
    noGoConditions: unique(noGoConditions),
    digest,
    limitation:
      'This is a repository-side protected admission proof-plan evaluation. It does not deploy a customer PEP, activate runtime external-KMS issuance, operate a live authorization server, or prove production readiness.',
  });
}
