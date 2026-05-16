import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  CUSTOMER_PEP_RUNTIME_ADOPTION_VERSION,
  type CustomerPepRuntimeAdoptionProof,
} from './customer-pep-runtime-adoption.js';
import {
  PROTECTED_ADMISSION_E2E_PROOF_PLAN_VERSION,
  type ProtectedAdmissionE2eProofPlanEvaluation,
} from './protected-admission-e2e-proof-plan.js';

export const CUSTOMER_PEP_ADOPTION_PACKAGE_VERSION =
  'attestor.customer-pep-adoption-package.v1';

export const CUSTOMER_PEP_ADOPTION_PACKAGE_CLAIM_SCOPES = [
  'scoped-runtime-adoption',
  'live-customer-enforcement',
  'production-readiness',
] as const;
export type CustomerPepAdoptionPackageClaimScope =
  typeof CUSTOMER_PEP_ADOPTION_PACKAGE_CLAIM_SCOPES[number];

export const CUSTOMER_PEP_ADOPTION_PACKAGE_EVIDENCE_KINDS = [
  'customer-pep-runtime-adoption-proof',
  'protected-admission-e2e-proof-plan',
  'route-coverage-manifest',
  'fail-closed-config',
  'no-bypass-review',
  'verifier-integration',
  'sender-constraint-policy',
  'online-introspection-policy',
  'token-use-replay-policy',
  'health-probe',
  'rollback-plan',
  'kill-switch',
  'monitoring-slo',
  'audit-receipt',
  'customer-approval',
  'activation-handoff',
  'activation-receipt',
  'downstream-receipt',
  'operator-runbook',
] as const;
export type CustomerPepAdoptionPackageEvidenceKind =
  typeof CUSTOMER_PEP_ADOPTION_PACKAGE_EVIDENCE_KINDS[number];

export const CUSTOMER_PEP_ADOPTION_PACKAGE_REQUIRED_EVIDENCE_KINDS = [
  'customer-pep-runtime-adoption-proof',
  'protected-admission-e2e-proof-plan',
  'route-coverage-manifest',
  'fail-closed-config',
  'no-bypass-review',
  'verifier-integration',
  'sender-constraint-policy',
  'online-introspection-policy',
  'token-use-replay-policy',
  'health-probe',
  'rollback-plan',
  'kill-switch',
  'monitoring-slo',
  'audit-receipt',
  'customer-approval',
  'activation-handoff',
  'activation-receipt',
  'downstream-receipt',
] as const satisfies readonly CustomerPepAdoptionPackageEvidenceKind[];

export const CUSTOMER_PEP_ADOPTION_PACKAGE_FAILURE_REASONS = [
  'runtime-adoption-version-mismatch',
  'protected-e2e-version-mismatch',
  'runtime-proof-digest-invalid',
  'protected-e2e-proof-digest-invalid',
  'runtime-adoption-not-ready',
  'runtime-non-bypassable-claim-not-allowed',
  'protected-e2e-proof-plan-not-satisfied',
  'e2e-customer-pep-stage-blocked',
  'e2e-downstream-receipt-stage-blocked',
  'tenant-id-mismatch',
  'runtime-id-mismatch',
  'environment-mismatch',
  'route-id-mismatch',
  'runtime-profile-id-missing',
  'runtime-profile-id-mismatch',
  'live-enforcement-claim-requested',
  'production-readiness-claim-requested',
  'package-evidence-incomplete',
  'customer-approval-evidence-missing',
  'activation-evidence-missing',
  'downstream-receipt-evidence-missing',
  'raw-token-storage-enabled',
  'raw-sender-proof-storage-enabled',
  'raw-payload-storage-enabled',
  'raw-provider-body-storage-enabled',
] as const;
export type CustomerPepAdoptionPackageFailureReason =
  typeof CUSTOMER_PEP_ADOPTION_PACKAGE_FAILURE_REASONS[number];

export type CustomerPepAdoptionPackageNoGoCondition =
  | 'scoped-runtime-adoption-not-proven'
  | 'live-customer-enforcement-not-proven'
  | 'production-readiness-not-proven'
  | 'route-non-bypassability-not-proven'
  | 'customer-authority-not-proven'
  | 'downstream-receipt-not-proven'
  | 'raw-material-storage-risk';

export interface CustomerPepAdoptionPackageEvidenceRef {
  readonly id: string;
  readonly kind: CustomerPepAdoptionPackageEvidenceKind;
  readonly digest: string;
  readonly uri: string | null;
}

export interface EvaluateCustomerPepAdoptionPackageInput {
  readonly packageId: string;
  readonly tenantId: string;
  readonly runtimeId: string;
  readonly environment: string;
  readonly routeId: string;
  readonly claimScope: CustomerPepAdoptionPackageClaimScope;
  readonly runtimeAdoptionProof: CustomerPepRuntimeAdoptionProof;
  readonly protectedAdmissionE2eProof: ProtectedAdmissionE2eProofPlanEvaluation;
  readonly evidenceRefs?: readonly CustomerPepAdoptionPackageEvidenceRef[] | null;
  readonly rawTokenStored?: boolean | null;
  readonly rawSenderProofStored?: boolean | null;
  readonly rawPayloadStored?: boolean | null;
  readonly rawProviderBodyStored?: boolean | null;
  readonly generatedAt?: string | null;
}

export interface CustomerPepAdoptionPackageProof {
  readonly version: typeof CUSTOMER_PEP_ADOPTION_PACKAGE_VERSION;
  readonly packageId: string;
  readonly generatedAt: string;
  readonly tenantId: string;
  readonly runtimeId: string;
  readonly environment: string;
  readonly routeId: string;
  readonly claimScope: CustomerPepAdoptionPackageClaimScope;
  readonly runtimeKind: CustomerPepRuntimeAdoptionProof['runtimeKind'];
  readonly downstreamSystem: string;
  readonly runtimeAdoptionProofDigest: string;
  readonly protectedAdmissionE2eProofDigest: string;
  readonly runtimeAdoptionReady: boolean;
  readonly protectedE2eSatisfied: boolean;
  readonly customerPepStageProven: boolean;
  readonly downstreamReceiptStageProven: boolean;
  readonly evidenceRefs: readonly CustomerPepAdoptionPackageEvidenceRef[];
  readonly missingEvidenceKinds: readonly CustomerPepAdoptionPackageEvidenceKind[];
  readonly packageReady: boolean;
  readonly scopedCustomerPepAdoptionClaimAllowed: boolean;
  readonly liveCustomerEnforcementClaimAllowed: false;
  readonly productionReady: false;
  readonly activatesRuntime: false;
  readonly deploysInfrastructure: false;
  readonly rawTokenStored: boolean;
  readonly rawSenderProofStored: boolean;
  readonly rawPayloadStored: boolean;
  readonly rawProviderBodyStored: boolean;
  readonly dataMinimized: boolean;
  readonly failureReasons: readonly CustomerPepAdoptionPackageFailureReason[];
  readonly noGoConditions: readonly CustomerPepAdoptionPackageNoGoCondition[];
  readonly reasonCodes: readonly string[];
  readonly protectedPrinciples: readonly [
    'fail-closed boundary',
    'customer authority',
    'proof integrity',
    'replay and idempotency safety',
    'data minimization and redaction',
    'runtime readiness',
    'auditability',
    'no overclaim',
  ];
  readonly instruction: string;
  readonly limitation: string;
  readonly canonical: string;
  readonly digest: string;
}

export interface CustomerPepAdoptionPackageDescriptor {
  readonly version: typeof CUSTOMER_PEP_ADOPTION_PACKAGE_VERSION;
  readonly claimScopes: typeof CUSTOMER_PEP_ADOPTION_PACKAGE_CLAIM_SCOPES;
  readonly evidenceKinds: typeof CUSTOMER_PEP_ADOPTION_PACKAGE_EVIDENCE_KINDS;
  readonly requiredEvidenceKinds:
    typeof CUSTOMER_PEP_ADOPTION_PACKAGE_REQUIRED_EVIDENCE_KINDS;
  readonly failureReasons: typeof CUSTOMER_PEP_ADOPTION_PACKAGE_FAILURE_REASONS;
  readonly requiresRuntimeAdoptionProof: true;
  readonly requiresProtectedAdmissionE2eProof: true;
  readonly requiresRouteCoverage: true;
  readonly requiresNoBypassReview: true;
  readonly requiresFailClosedConfig: true;
  readonly requiresCustomerApproval: true;
  readonly requiresDownstreamReceipt: true;
  readonly productionReady: false;
  readonly activatesRuntime: false;
  readonly deploysInfrastructure: false;
  readonly storesRawTokens: false;
  readonly storesRawPayloads: false;
  readonly primaryAnchors: readonly string[];
}

export class CustomerPepAdoptionPackageError extends Error {
  readonly proof: CustomerPepAdoptionPackageProof;
  readonly failureReasons: readonly CustomerPepAdoptionPackageFailureReason[];

  constructor(proof: CustomerPepAdoptionPackageProof) {
    super(`Customer PEP adoption package is not ready: ${proof.failureReasons.join(', ')}`);
    this.name = 'CustomerPepAdoptionPackageError';
    this.proof = proof;
    this.failureReasons = proof.failureReasons;
  }
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

function isSha256Digest(value: string | null | undefined): boolean {
  return typeof value === 'string' && /^sha256:[0-9a-f]{64}$/u.test(value);
}

function normalizeIdentifier(value: string | null | undefined, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Customer PEP adoption package ${fieldName} requires a string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Customer PEP adoption package ${fieldName} requires a non-empty value.`);
  }
  return normalized;
}

function normalizeOptionalIdentifier(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) return null;
  return normalizeIdentifier(value, fieldName);
}

function normalizeDigest(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!isSha256Digest(normalized)) {
    throw new Error(`Customer PEP adoption package ${fieldName} must be a sha256 digest.`);
  }
  return normalized;
}

function normalizeIsoTimestamp(
  value: string | null | undefined,
  fallback: string,
  fieldName: string,
): string {
  const raw = value ?? fallback;
  const timestamp = new Date(raw);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Customer PEP adoption package ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function includesValue<T extends readonly string[]>(values: T, value: string): value is T[number] {
  return values.includes(value);
}

function normalizeEnumValue<T extends readonly string[]>(
  value: T[number],
  values: T,
  fieldName: string,
): T[number] {
  if (!includesValue(values, String(value))) {
    throw new Error(
      `Customer PEP adoption package ${fieldName} must be one of: ${values.join(', ')}.`,
    );
  }
  return value;
}

function normalizeEvidenceRef(
  value: CustomerPepAdoptionPackageEvidenceRef,
): CustomerPepAdoptionPackageEvidenceRef {
  return Object.freeze({
    id: normalizeIdentifier(value.id, 'evidenceRefs[].id'),
    kind: normalizeEnumValue(
      value.kind,
      CUSTOMER_PEP_ADOPTION_PACKAGE_EVIDENCE_KINDS,
      'evidenceRefs[].kind',
    ),
    digest: normalizeDigest(value.digest, 'evidenceRefs[].digest'),
    uri: normalizeOptionalIdentifier(value.uri, 'evidenceRefs[].uri'),
  });
}

function missingEvidenceKinds(
  evidenceRefs: readonly CustomerPepAdoptionPackageEvidenceRef[],
): readonly CustomerPepAdoptionPackageEvidenceKind[] {
  const present = new Set(evidenceRefs.map((ref) => ref.kind));
  return Object.freeze(
    CUSTOMER_PEP_ADOPTION_PACKAGE_REQUIRED_EVIDENCE_KINDS.filter((kind) =>
      !present.has(kind),
    ),
  );
}

function uniqueFailureReasons(
  reasons: readonly CustomerPepAdoptionPackageFailureReason[],
): readonly CustomerPepAdoptionPackageFailureReason[] {
  const present = new Set(reasons);
  return Object.freeze(
    CUSTOMER_PEP_ADOPTION_PACKAGE_FAILURE_REASONS.filter((reason) =>
      present.has(reason),
    ),
  );
}

function uniqueNoGos(
  values: readonly CustomerPepAdoptionPackageNoGoCondition[],
): readonly CustomerPepAdoptionPackageNoGoCondition[] {
  return Object.freeze(Array.from(new Set(values)));
}

function instruction(packageReady: boolean): string {
  return packageReady
    ? 'Scoped customer PEP adoption package is ready for review. Keep live enforcement, deployment activation, and production readiness as separate evidence.'
    : 'Do not claim scoped customer PEP adoption. Resolve the package failure reasons first.';
}

export function evaluateCustomerPepAdoptionPackage(
  input: EvaluateCustomerPepAdoptionPackageInput,
): CustomerPepAdoptionPackageProof {
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt,
    new Date().toISOString(),
    'generatedAt',
  );
  const packageId = normalizeIdentifier(input.packageId, 'packageId');
  const tenantId = normalizeIdentifier(input.tenantId, 'tenantId');
  const runtimeId = normalizeIdentifier(input.runtimeId, 'runtimeId');
  const environment = normalizeIdentifier(input.environment, 'environment');
  const routeId = normalizeIdentifier(input.routeId, 'routeId');
  const claimScope = normalizeEnumValue(
    input.claimScope,
    CUSTOMER_PEP_ADOPTION_PACKAGE_CLAIM_SCOPES,
    'claimScope',
  );
  const evidenceRefs = Object.freeze((input.evidenceRefs ?? []).map(normalizeEvidenceRef));
  const missingEvidence = missingEvidenceKinds(evidenceRefs);
  const customerPepStage = input.protectedAdmissionE2eProof.stages.find((stage) =>
    stage.id === 'customer-pep-enforcement',
  );
  const downstreamReceiptStage = input.protectedAdmissionE2eProof.stages.find((stage) =>
    stage.id === 'downstream-receipt',
  );
  const runtimeProfileId = input.protectedAdmissionE2eProof.runtimeProfileId;
  const rawTokenStored =
    (input.rawTokenStored ?? false) || input.runtimeAdoptionProof.rawTokenStored;
  const rawPayloadStored =
    (input.rawPayloadStored ?? false) || input.runtimeAdoptionProof.rawPayloadStored;
  const rawProviderBodyStored =
    (input.rawProviderBodyStored ?? false) ||
    input.runtimeAdoptionProof.providerBodyStored;
  const rawSenderProofStored =
    input.rawSenderProofStored ?? input.protectedAdmissionE2eProof.noGoConditions.includes(
      'raw-material-storage-risk',
    );

  const failures: CustomerPepAdoptionPackageFailureReason[] = [];
  if (input.runtimeAdoptionProof.version !== CUSTOMER_PEP_RUNTIME_ADOPTION_VERSION) {
    failures.push('runtime-adoption-version-mismatch');
  }
  if (input.protectedAdmissionE2eProof.version !== PROTECTED_ADMISSION_E2E_PROOF_PLAN_VERSION) {
    failures.push('protected-e2e-version-mismatch');
  }
  if (!isSha256Digest(input.runtimeAdoptionProof.digest)) {
    failures.push('runtime-proof-digest-invalid');
  }
  if (!isSha256Digest(input.protectedAdmissionE2eProof.digest)) {
    failures.push('protected-e2e-proof-digest-invalid');
  }
  if (!input.runtimeAdoptionProof.pepRuntimeAdoptionReady) {
    failures.push('runtime-adoption-not-ready');
  }
  if (!input.runtimeAdoptionProof.nonBypassableRuntimeClaimAllowed) {
    failures.push('runtime-non-bypassable-claim-not-allowed');
  }
  if (!input.protectedAdmissionE2eProof.proofPlanSatisfied) {
    failures.push('protected-e2e-proof-plan-not-satisfied');
  }
  if (customerPepStage?.status !== 'proven') {
    failures.push('e2e-customer-pep-stage-blocked');
  }
  if (downstreamReceiptStage?.status !== 'proven') {
    failures.push('e2e-downstream-receipt-stage-blocked');
  }
  if (tenantId !== input.runtimeAdoptionProof.tenantId) {
    failures.push('tenant-id-mismatch');
  }
  if (runtimeId !== input.runtimeAdoptionProof.runtimeId) {
    failures.push('runtime-id-mismatch');
  }
  if (environment !== input.runtimeAdoptionProof.environment) {
    failures.push('environment-mismatch');
  }
  if (routeId !== input.protectedAdmissionE2eProof.routeId) {
    failures.push('route-id-mismatch');
  }
  if (runtimeProfileId === null) {
    failures.push('runtime-profile-id-missing');
  } else if (runtimeProfileId !== runtimeId) {
    failures.push('runtime-profile-id-mismatch');
  }
  if (claimScope === 'live-customer-enforcement') {
    failures.push('live-enforcement-claim-requested');
  }
  if (claimScope === 'production-readiness') {
    failures.push('production-readiness-claim-requested');
  }
  if (missingEvidence.length > 0) {
    failures.push('package-evidence-incomplete');
  }
  if (missingEvidence.includes('customer-approval')) {
    failures.push('customer-approval-evidence-missing');
  }
  if (
    missingEvidence.includes('activation-handoff') ||
    missingEvidence.includes('activation-receipt')
  ) {
    failures.push('activation-evidence-missing');
  }
  if (missingEvidence.includes('downstream-receipt')) {
    failures.push('downstream-receipt-evidence-missing');
  }
  if (rawTokenStored) failures.push('raw-token-storage-enabled');
  if (rawSenderProofStored) failures.push('raw-sender-proof-storage-enabled');
  if (rawPayloadStored) failures.push('raw-payload-storage-enabled');
  if (rawProviderBodyStored) failures.push('raw-provider-body-storage-enabled');

  const failureReasons = uniqueFailureReasons(failures);
  const packageReady = failureReasons.length === 0;
  const noGoConditions: CustomerPepAdoptionPackageNoGoCondition[] = [];
  if (!packageReady) noGoConditions.push('scoped-runtime-adoption-not-proven');
  if (
    failureReasons.some((reason) =>
      reason === 'runtime-non-bypassable-claim-not-allowed' ||
      reason === 'protected-e2e-proof-plan-not-satisfied' ||
      reason === 'e2e-customer-pep-stage-blocked' ||
      reason === 'runtime-profile-id-missing' ||
      reason === 'runtime-profile-id-mismatch')
  ) {
    noGoConditions.push('route-non-bypassability-not-proven');
  }
  if (
    failureReasons.some((reason) =>
      reason === 'customer-approval-evidence-missing' ||
      reason === 'tenant-id-mismatch')
  ) {
    noGoConditions.push('customer-authority-not-proven');
  }
  if (
    failureReasons.some((reason) =>
      reason === 'e2e-downstream-receipt-stage-blocked' ||
      reason === 'downstream-receipt-evidence-missing')
  ) {
    noGoConditions.push('downstream-receipt-not-proven');
  }
  if (
    failureReasons.some((reason) =>
      reason === 'raw-token-storage-enabled' ||
      reason === 'raw-sender-proof-storage-enabled' ||
      reason === 'raw-payload-storage-enabled' ||
      reason === 'raw-provider-body-storage-enabled')
  ) {
    noGoConditions.push('raw-material-storage-risk');
  }
  if (
    claimScope === 'live-customer-enforcement' ||
    failureReasons.includes('live-enforcement-claim-requested')
  ) {
    noGoConditions.push('live-customer-enforcement-not-proven');
  }
  if (
    claimScope === 'production-readiness' ||
    failureReasons.includes('production-readiness-claim-requested')
  ) {
    noGoConditions.push('production-readiness-not-proven');
  }

  const payload = {
    version: CUSTOMER_PEP_ADOPTION_PACKAGE_VERSION,
    packageId,
    generatedAt,
    tenantId,
    runtimeId,
    environment,
    routeId,
    claimScope,
    runtimeKind: input.runtimeAdoptionProof.runtimeKind,
    downstreamSystem: input.runtimeAdoptionProof.downstreamSystem,
    runtimeAdoptionProofDigest: input.runtimeAdoptionProof.digest,
    protectedAdmissionE2eProofDigest: input.protectedAdmissionE2eProof.digest,
    runtimeAdoptionReady: input.runtimeAdoptionProof.pepRuntimeAdoptionReady,
    protectedE2eSatisfied: input.protectedAdmissionE2eProof.proofPlanSatisfied,
    customerPepStageProven: customerPepStage?.status === 'proven',
    downstreamReceiptStageProven: downstreamReceiptStage?.status === 'proven',
    evidenceRefs,
    missingEvidenceKinds: missingEvidence,
    packageReady,
    scopedCustomerPepAdoptionClaimAllowed: packageReady,
    liveCustomerEnforcementClaimAllowed: false,
    productionReady: false,
    activatesRuntime: false,
    deploysInfrastructure: false,
    rawTokenStored,
    rawSenderProofStored,
    rawPayloadStored,
    rawProviderBodyStored,
    dataMinimized:
      !rawTokenStored && !rawSenderProofStored && !rawPayloadStored && !rawProviderBodyStored,
    failureReasons,
    noGoConditions: uniqueNoGos(noGoConditions),
    reasonCodes: Object.freeze([
      ...input.runtimeAdoptionProof.reasonCodes,
      ...input.protectedAdmissionE2eProof.blockers.map((blocker) =>
        `customer-pep-adoption-e2e-${blocker}`
      ),
      ...failureReasons.map((reason) => `customer-pep-adoption-${reason}`),
      `customer-pep-adoption-${packageReady ? 'ready' : 'held'}`,
    ]),
    protectedPrinciples: [
      'fail-closed boundary',
      'customer authority',
      'proof integrity',
      'replay and idempotency safety',
      'data minimization and redaction',
      'runtime readiness',
      'auditability',
      'no overclaim',
    ] as const,
    instruction: instruction(packageReady),
    limitation:
      'This package proves a scoped repository-side customer PEP adoption claim only. It does not deploy infrastructure, operate the customer PEP, activate live enforcement, prove universal non-bypassability, or prove production readiness.',
  } as const;
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);

  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function assertCustomerPepAdoptionPackageReady(
  input: EvaluateCustomerPepAdoptionPackageInput,
): CustomerPepAdoptionPackageProof {
  const proof = evaluateCustomerPepAdoptionPackage(input);
  if (!proof.packageReady) {
    throw new CustomerPepAdoptionPackageError(proof);
  }
  return proof;
}

export function customerPepAdoptionPackageDescriptor():
CustomerPepAdoptionPackageDescriptor {
  return Object.freeze({
    version: CUSTOMER_PEP_ADOPTION_PACKAGE_VERSION,
    claimScopes: CUSTOMER_PEP_ADOPTION_PACKAGE_CLAIM_SCOPES,
    evidenceKinds: CUSTOMER_PEP_ADOPTION_PACKAGE_EVIDENCE_KINDS,
    requiredEvidenceKinds: CUSTOMER_PEP_ADOPTION_PACKAGE_REQUIRED_EVIDENCE_KINDS,
    failureReasons: CUSTOMER_PEP_ADOPTION_PACKAGE_FAILURE_REASONS,
    requiresRuntimeAdoptionProof: true,
    requiresProtectedAdmissionE2eProof: true,
    requiresRouteCoverage: true,
    requiresNoBypassReview: true,
    requiresFailClosedConfig: true,
    requiresCustomerApproval: true,
    requiresDownstreamReceipt: true,
    productionReady: false,
    activatesRuntime: false,
    deploysInfrastructure: false,
    storesRawTokens: false,
    storesRawPayloads: false,
    primaryAnchors: Object.freeze([
      'Envoy ext_authz',
      'Istio custom authorization',
      'OPA Envoy external authorization',
      'OAuth DPoP RFC 9449',
      'OAuth Token Introspection RFC 7662',
    ]),
  });
}
