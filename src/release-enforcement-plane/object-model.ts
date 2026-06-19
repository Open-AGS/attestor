import { createHash } from 'node:crypto';
import type { ReleasePolicyProvenanceSource } from '../release-kernel/object-model.js';
import type {
  EnforcementFailureReason,
  EnforcementOutcome,
  ReleasePresentationMode,
} from './types.js';
import {
  ENFORCEMENT_OUTCOMES,
  createEnforcementPointReference,
  enforcementPointReferenceLabel,
  type CreateEnforcementPointReferenceInput,
  type EnforcementPointReference,
} from './types.js';
import {
  ENFORCEMENT_DECISION_SPEC_VERSION,
  ENFORCEMENT_RECEIPT_SPEC_VERSION,
  ENFORCEMENT_REQUEST_SPEC_VERSION,
  INTROSPECTION_SNAPSHOT_SPEC_VERSION,
  RELEASE_PRESENTATION_SPEC_VERSION,
  VERIFICATION_RESULT_SPEC_VERSION,
  type CreateEnforcementDecisionInput,
  type CreateEnforcementReceiptDigestInput,
  type CreateEnforcementReceiptInput,
  type CreateEnforcementRequestInput,
  type CreateIntrospectionSnapshotInput,
  type CreateReleasePresentationInput,
  type CreateVerificationResultInput,
  type EnforcementBreakGlassGrant,
  type EnforcementDecision,
  type EnforcementEvidenceSemantics,
  type EnforcementReceipt,
  type EnforcementReceiptDigestMaterial,
  type EnforcementRequest,
  type EnforcementRequestTransport,
  type IntrospectionSnapshot,
  type ReleaseEnforcementPolicyContext,
  type ReleasePresentation,
  type ReleasePresentationProof,
  type VerificationResult,
} from './object-model-types.js';

export * from './object-model-types.js';

/**
 * Versioned object model for Attestor's release enforcement plane.
 *
 * This is the shared contract for downstream PEPs, verifier cores,
 * introspection calls, sender-constrained presentations, and enforcement
 * receipts. It defines the stable objects only; cryptographic verification and
 * live network behavior arrive in later steps.
 */

function normalizeIdentifier(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`Release enforcement-plane ${fieldName} requires a non-empty value.`);
  }
  return normalized;
}

function normalizeOptionalIdentifier(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`Release enforcement-plane ${fieldName} cannot be blank when provided.`);
  }

  return normalized;
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function sha256(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function normalizeIsoTimestamp(value: string, fieldName: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Release enforcement-plane ${fieldName} must be a valid ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function normalizeOptionalIsoTimestamp(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  return normalizeIsoTimestamp(value, fieldName);
}

function normalizeScope(values: readonly string[] | undefined): readonly string[] {
  if (!values || values.length === 0) {
    return Object.freeze([]);
  }

  return Object.freeze(
    Array.from(
      new Set(
        values
          .map((value) => value.trim())
          .filter((value) => value.length > 0),
      ),
    ).sort(),
  );
}

function normalizeFailureReasons(
  reasons: readonly EnforcementFailureReason[] | undefined,
): readonly EnforcementFailureReason[] {
  if (!reasons || reasons.length === 0) {
    return Object.freeze([]);
  }
  return Object.freeze(Array.from(new Set(reasons)).sort());
}

function normalizeEvidenceKinds(values: readonly string[]): readonly string[] {
  return Object.freeze(
    Array.from(
      new Set(
        values
          .map((value) => value.trim())
          .filter((value) => value.length > 0),
      ),
    ).sort(),
  );
}

export function normalizeEnforcementEvidenceSemantics(
  value: EnforcementEvidenceSemantics | null | undefined,
): EnforcementEvidenceSemantics | null {
  if (!value) {
    return null;
  }

  if (
    !Number.isSafeInteger(value.declaredEvidenceCount) ||
    value.declaredEvidenceCount < 0
  ) {
    throw new Error('Release enforcement-plane evidence semantics requires a non-negative declared evidence count.');
  }
  if (
    !Number.isSafeInteger(value.verifiedEvidenceCount) ||
    value.verifiedEvidenceCount < 0
  ) {
    throw new Error('Release enforcement-plane evidence semantics requires a non-negative verified evidence count.');
  }

  if (value.boundary === 'none') {
    if (
      value.declarationBound ||
      value.verifiedEvidence ||
      value.declaredEvidenceCount !== 0 ||
      value.verifiedEvidenceCount !== 0
    ) {
      throw new Error('Release enforcement-plane empty evidence boundary cannot carry declared or verified evidence.');
    }
  } else if (value.boundary === 'declared-only') {
    if (
      !value.declarationBound ||
      value.verifiedEvidence ||
      value.declaredEvidenceCount === 0 ||
      value.verifiedEvidenceCount !== 0
    ) {
      throw new Error('Release enforcement-plane declared-only evidence boundary cannot claim verified evidence.');
    }
  } else if (value.boundary === 'verified') {
    if (!value.verifiedEvidence || value.verifiedEvidenceCount === 0) {
      throw new Error('Release enforcement-plane verified evidence boundary requires verified evidence.');
    }
  }

  return Object.freeze({
    declarationBound: value.declarationBound,
    verifiedEvidence: value.verifiedEvidence,
    declaredEvidenceCount: value.declaredEvidenceCount,
    verifiedEvidenceCount: value.verifiedEvidenceCount,
    evidenceKinds: normalizeEvidenceKinds(value.evidenceKinds),
    boundary: value.boundary,
  });
}

function buildPolicyContext(input: {
  readonly policyHash: string | null;
  readonly policyVersion: string | null;
  readonly policyIrHash: string | null;
  readonly policyProvenanceSource: ReleasePolicyProvenanceSource | null;
  readonly compiledPolicyIndexVersion: string | null;
  readonly compiledPolicyIrVersion: string | null;
}): ReleaseEnforcementPolicyContext {
  return Object.freeze({
    policyHash: input.policyHash,
    policyVersion: input.policyVersion,
    policyIrHash: input.policyIrHash,
    policyProvenanceSource: input.policyProvenanceSource,
    compiledPolicyIndexVersion: input.compiledPolicyIndexVersion,
    compiledPolicyIrVersion: input.compiledPolicyIrVersion,
  });
}

function normalizeCoveredComponents(
  components: readonly string[],
): readonly string[] {
  return Object.freeze(
    Array.from(
      new Set(
        components
          .map((component) => component.trim())
          .filter((component) => component.length > 0),
      ),
    ).sort(),
  );
}

function normalizeTransport(
  transport: EnforcementRequestTransport | null | undefined,
): EnforcementRequestTransport | null {
  if (!transport) {
    return null;
  }

  switch (transport.kind) {
    case 'http':
      return Object.freeze({
        kind: 'http',
        method: normalizeIdentifier(transport.method.toUpperCase(), 'transport.method'),
        uri: normalizeIdentifier(transport.uri, 'transport.uri'),
        headersDigest: normalizeOptionalIdentifier(transport.headersDigest, 'transport.headersDigest'),
        bodyDigest: normalizeOptionalIdentifier(transport.bodyDigest, 'transport.bodyDigest'),
      });
    case 'async':
      return Object.freeze({
        kind: 'async',
        messageId: normalizeIdentifier(transport.messageId, 'transport.messageId'),
        queueOrTopic: normalizeIdentifier(transport.queueOrTopic, 'transport.queueOrTopic'),
        envelopeDigest: normalizeOptionalIdentifier(transport.envelopeDigest, 'transport.envelopeDigest'),
      });
    case 'artifact':
      return Object.freeze({
        kind: 'artifact',
        artifactId: normalizeIdentifier(transport.artifactId, 'transport.artifactId'),
        artifactDigest: normalizeIdentifier(transport.artifactDigest, 'transport.artifactDigest'),
      });
  }
}

function normalizeProof(proof: ReleasePresentationProof): ReleasePresentationProof {
  switch (proof.kind) {
    case 'dpop':
      return Object.freeze({
        kind: 'dpop',
        proofJwt: normalizeIdentifier(proof.proofJwt, 'dpop.proofJwt'),
        httpMethod: normalizeIdentifier(proof.httpMethod.toUpperCase(), 'dpop.httpMethod'),
        httpUri: normalizeIdentifier(proof.httpUri, 'dpop.httpUri'),
        proofJti: normalizeIdentifier(proof.proofJti, 'dpop.proofJti'),
        accessTokenHash: normalizeOptionalIdentifier(proof.accessTokenHash, 'dpop.accessTokenHash'),
        nonce: normalizeOptionalIdentifier(proof.nonce, 'dpop.nonce'),
        keyThumbprint: normalizeIdentifier(proof.keyThumbprint, 'dpop.keyThumbprint'),
      });
    case 'mtls':
      return Object.freeze({
        kind: 'mtls',
        certificateThumbprint: normalizeIdentifier(
          proof.certificateThumbprint,
          'mtls.certificateThumbprint',
        ),
        subjectDn: normalizeOptionalText(proof.subjectDn),
        spiffeId: normalizeOptionalIdentifier(proof.spiffeId, 'mtls.spiffeId'),
      });
    case 'spiffe':
      return Object.freeze({
        kind: 'spiffe',
        spiffeId: normalizeIdentifier(proof.spiffeId, 'spiffe.spiffeId'),
        trustDomain: normalizeIdentifier(proof.trustDomain, 'spiffe.trustDomain'),
        svidThumbprint: normalizeOptionalIdentifier(proof.svidThumbprint, 'spiffe.svidThumbprint'),
      });
    case 'http-message-signature':
      return Object.freeze({
        kind: 'http-message-signature',
        signatureInput: normalizeIdentifier(
          proof.signatureInput,
          'httpMessageSignature.signatureInput',
        ),
        signature: normalizeIdentifier(proof.signature, 'httpMessageSignature.signature'),
        keyId: normalizeIdentifier(proof.keyId, 'httpMessageSignature.keyId'),
        coveredComponents: normalizeCoveredComponents(proof.coveredComponents),
        createdAt: normalizeOptionalIsoTimestamp(
          proof.createdAt,
          'httpMessageSignature.createdAt',
        ),
        expiresAt: normalizeOptionalIsoTimestamp(
          proof.expiresAt,
          'httpMessageSignature.expiresAt',
        ),
        nonce: normalizeOptionalIdentifier(proof.nonce, 'httpMessageSignature.nonce'),
      });
    case 'signed-json-envelope':
      return Object.freeze({
        kind: 'signed-json-envelope',
        envelopeDigest: normalizeIdentifier(proof.envelopeDigest, 'signedEnvelope.envelopeDigest'),
        subjectDigest: normalizeIdentifier(proof.subjectDigest, 'signedEnvelope.subjectDigest'),
        signatureRef: normalizeOptionalIdentifier(proof.signatureRef, 'signedEnvelope.signatureRef'),
      });
  }
}

function assertPresentationProof(mode: ReleasePresentationMode, proof: ReleasePresentationProof | null): void {
  switch (mode) {
    case 'bearer-release-token':
      return;
    case 'dpop-bound-token':
      if (proof?.kind !== 'dpop') {
        throw new Error('Release enforcement-plane DPoP-bound presentation requires a DPoP proof.');
      }
      return;
    case 'mtls-bound-token':
      if (proof?.kind !== 'mtls') {
        throw new Error('Release enforcement-plane mTLS-bound presentation requires an mTLS proof.');
      }
      return;
    case 'spiffe-bound-token':
      if (proof?.kind !== 'spiffe') {
        throw new Error('Release enforcement-plane SPIFFE-bound presentation requires a SPIFFE proof.');
      }
      return;
    case 'http-message-signature':
      if (proof?.kind !== 'http-message-signature') {
        throw new Error(
          'Release enforcement-plane HTTP message signature presentation requires an HTTP message signature proof.',
        );
      }
      return;
    case 'signed-json-envelope':
      if (proof?.kind !== 'signed-json-envelope') {
        throw new Error(
          'Release enforcement-plane signed JSON envelope presentation requires an envelope proof.',
        );
      }
      return;
  }
}

function resolveEnforcementPoint(
  reference: CreateEnforcementPointReferenceInput | EnforcementPointReference,
): EnforcementPointReference {
  if ('enforcementPointId' in reference && 'riskClass' in reference) {
    return createEnforcementPointReference(reference);
  }
  return reference;
}

function deriveOutcome(
  verification: VerificationResult,
  breakGlass: EnforcementBreakGlassGrant | null,
): EnforcementOutcome {
  if (breakGlass) {
    return 'break-glass-allow';
  }
  if (verification.mode === 'shadow-observe') {
    return 'shadow-allow';
  }
  if (verification.status === 'valid') {
    return 'allow';
  }
  if (verification.status === 'indeterminate') {
    return 'needs-introspection';
  }
  return 'deny';
}

function assertEnforcementOutcomeCoherence(
  outcome: EnforcementOutcome,
  verification: VerificationResult,
  failureReasons: readonly EnforcementFailureReason[],
  breakGlass: EnforcementBreakGlassGrant | null,
): void {
  if (outcome === 'allow' && verification.status !== 'valid') {
    throw new Error('Release enforcement-plane allow decisions require valid verification.');
  }
  if (outcome === 'deny' && failureReasons.length === 0) {
    throw new Error('Release enforcement-plane deny decisions require at least one failure reason.');
  }
  if (outcome === 'break-glass-allow' && breakGlass === null) {
    throw new Error('Release enforcement-plane break-glass allow decisions require a break-glass grant.');
  }
  if (!ENFORCEMENT_OUTCOMES.includes(outcome)) {
    throw new Error(`Release enforcement-plane unknown outcome: ${outcome}`);
  }
}

export function createEnforcementRequest(
  input: CreateEnforcementRequestInput,
): EnforcementRequest {
  const enforcementPoint = resolveEnforcementPoint(input.enforcementPoint);

  return Object.freeze({
    version: ENFORCEMENT_REQUEST_SPEC_VERSION,
    id: normalizeIdentifier(input.id, 'enforcementRequest.id'),
    receivedAt: normalizeIsoTimestamp(input.receivedAt, 'enforcementRequest.receivedAt'),
    enforcementPoint,
    enforcementPointLabel: enforcementPointReferenceLabel(enforcementPoint),
    targetId: normalizeIdentifier(input.targetId, 'enforcementRequest.targetId'),
    outputHash: normalizeIdentifier(input.outputHash, 'enforcementRequest.outputHash'),
    consequenceHash: normalizeIdentifier(
      input.consequenceHash,
      'enforcementRequest.consequenceHash',
    ),
    releaseTokenId: normalizeOptionalIdentifier(
      input.releaseTokenId,
      'enforcementRequest.releaseTokenId',
    ),
    releaseDecisionId: normalizeOptionalIdentifier(
      input.releaseDecisionId,
      'enforcementRequest.releaseDecisionId',
    ),
    requester: input.requester ?? null,
    traceId: normalizeOptionalIdentifier(input.traceId, 'enforcementRequest.traceId'),
    idempotencyKey: normalizeOptionalIdentifier(
      input.idempotencyKey,
      'enforcementRequest.idempotencyKey',
    ),
    transport: normalizeTransport(input.transport),
  });
}

export function createReleasePresentation(
  input: CreateReleasePresentationInput,
): ReleasePresentation {
  const proof = input.proof ? normalizeProof(input.proof) : null;
  assertPresentationProof(input.mode, proof);

  return Object.freeze({
    version: RELEASE_PRESENTATION_SPEC_VERSION,
    mode: input.mode,
    presentedAt: normalizeIsoTimestamp(input.presentedAt, 'releasePresentation.presentedAt'),
    releaseToken: normalizeOptionalText(input.releaseToken),
    releaseTokenId: normalizeOptionalIdentifier(
      input.releaseTokenId,
      'releasePresentation.releaseTokenId',
    ),
    releaseTokenDigest: normalizeOptionalIdentifier(
      input.releaseTokenDigest,
      'releasePresentation.releaseTokenDigest',
    ),
    issuer: normalizeOptionalIdentifier(input.issuer, 'releasePresentation.issuer'),
    subject: normalizeOptionalIdentifier(input.subject, 'releasePresentation.subject'),
    audience: normalizeOptionalIdentifier(input.audience, 'releasePresentation.audience'),
    expiresAt: normalizeOptionalIsoTimestamp(input.expiresAt, 'releasePresentation.expiresAt'),
    scope: normalizeScope(input.scope),
    proof,
  });
}

export function createIntrospectionSnapshot(
  input: CreateIntrospectionSnapshotInput,
): IntrospectionSnapshot {
  const policyHash = normalizeOptionalIdentifier(input.policyHash, 'introspectionSnapshot.policyHash');
  const policyVersion = normalizeOptionalIdentifier(
    input.policyVersion,
    'introspectionSnapshot.policyVersion',
  );
  const policyIrHash = normalizeOptionalIdentifier(
    input.policyIrHash,
    'introspectionSnapshot.policyIrHash',
  );
  const policyProvenanceSource = input.policyProvenanceSource ?? null;
  const compiledPolicyIndexVersion = normalizeOptionalIdentifier(
    input.compiledPolicyIndexVersion,
    'introspectionSnapshot.compiledPolicyIndexVersion',
  );
  const compiledPolicyIrVersion = normalizeOptionalIdentifier(
    input.compiledPolicyIrVersion,
    'introspectionSnapshot.compiledPolicyIrVersion',
  );

  return Object.freeze({
    version: INTROSPECTION_SNAPSHOT_SPEC_VERSION,
    checkedAt: normalizeIsoTimestamp(input.checkedAt, 'introspectionSnapshot.checkedAt'),
    authority: normalizeIdentifier(input.authority, 'introspectionSnapshot.authority'),
    active: input.active,
    releaseTokenId: normalizeOptionalIdentifier(
      input.releaseTokenId,
      'introspectionSnapshot.releaseTokenId',
    ),
    releaseDecisionId: normalizeOptionalIdentifier(
      input.releaseDecisionId,
      'introspectionSnapshot.releaseDecisionId',
    ),
    issuer: normalizeOptionalIdentifier(input.issuer, 'introspectionSnapshot.issuer'),
    subject: normalizeOptionalIdentifier(input.subject, 'introspectionSnapshot.subject'),
    audience: normalizeOptionalIdentifier(input.audience, 'introspectionSnapshot.audience'),
    tenantId: normalizeOptionalIdentifier(input.tenantId, 'introspectionSnapshot.tenantId'),
    scope: normalizeScope(input.scope),
    issuedAt: normalizeOptionalIsoTimestamp(input.issuedAt, 'introspectionSnapshot.issuedAt'),
    expiresAt: normalizeOptionalIsoTimestamp(input.expiresAt, 'introspectionSnapshot.expiresAt'),
    notBefore: normalizeOptionalIsoTimestamp(input.notBefore, 'introspectionSnapshot.notBefore'),
    clientId: normalizeOptionalIdentifier(input.clientId, 'introspectionSnapshot.clientId'),
    consequenceType: input.consequenceType ?? null,
    riskClass: input.riskClass ?? null,
    policyHash,
    policyVersion,
    policyIrHash,
    policyProvenanceSource,
    compiledPolicyIndexVersion,
    compiledPolicyIrVersion,
    policyContext: buildPolicyContext({
      policyHash,
      policyVersion,
      policyIrHash,
      policyProvenanceSource,
      compiledPolicyIndexVersion,
      compiledPolicyIrVersion,
    }),
  });
}

export function createVerificationResult(
  input: CreateVerificationResultInput,
): VerificationResult {
  const failureReasons = normalizeFailureReasons(input.failureReasons);
  if (input.status === 'invalid' && failureReasons.length === 0) {
    throw new Error('Release enforcement-plane invalid verification requires a failure reason.');
  }
  if (input.status === 'valid' && failureReasons.length > 0) {
    throw new Error('Release enforcement-plane valid verification cannot carry failure reasons.');
  }
  const policyHash =
    normalizeOptionalIdentifier(input.policyHash, 'verificationResult.policyHash') ??
    input.introspection?.policyHash ??
    null;
  const policyVersion =
    normalizeOptionalIdentifier(input.policyVersion, 'verificationResult.policyVersion') ??
    input.introspection?.policyVersion ??
    null;
  const policyIrHash =
    normalizeOptionalIdentifier(input.policyIrHash, 'verificationResult.policyIrHash') ??
    input.introspection?.policyIrHash ??
    null;
  const policyProvenanceSource =
    input.policyProvenanceSource ?? input.introspection?.policyProvenanceSource ?? null;
  const compiledPolicyIndexVersion =
    normalizeOptionalIdentifier(
      input.compiledPolicyIndexVersion,
      'verificationResult.compiledPolicyIndexVersion',
    ) ??
    input.introspection?.compiledPolicyIndexVersion ??
    null;
  const compiledPolicyIrVersion =
    normalizeOptionalIdentifier(
      input.compiledPolicyIrVersion,
      'verificationResult.compiledPolicyIrVersion',
    ) ??
    input.introspection?.compiledPolicyIrVersion ??
    null;

  return Object.freeze({
    version: VERIFICATION_RESULT_SPEC_VERSION,
    id: normalizeIdentifier(input.id, 'verificationResult.id'),
    checkedAt: normalizeIsoTimestamp(input.checkedAt, 'verificationResult.checkedAt'),
    mode: input.mode,
    status: input.status,
    cacheState: input.cacheState ?? 'miss',
    degradedState: input.degradedState ?? 'normal',
    presentationMode: input.presentation.mode,
    releaseTokenId: input.presentation.releaseTokenId,
    releaseDecisionId: normalizeOptionalIdentifier(
      input.releaseDecisionId,
      'verificationResult.releaseDecisionId',
    ),
    issuer: input.presentation.issuer,
    subject: input.presentation.subject,
    audience: input.presentation.audience,
    tenantId:
      normalizeOptionalIdentifier(input.tenantId, 'verificationResult.tenantId') ??
      input.introspection?.tenantId ??
      null,
    outputHash: normalizeOptionalIdentifier(input.outputHash, 'verificationResult.outputHash'),
    consequenceHash: normalizeOptionalIdentifier(
      input.consequenceHash,
      'verificationResult.consequenceHash',
    ),
    policyHash,
    policyVersion,
    policyIrHash,
    policyProvenanceSource,
    compiledPolicyIndexVersion,
    compiledPolicyIrVersion,
    policyContext: buildPolicyContext({
      policyHash,
      policyVersion,
      policyIrHash,
      policyProvenanceSource,
      compiledPolicyIndexVersion,
      compiledPolicyIrVersion,
    }),
    failureReasons,
    introspection: input.introspection ?? null,
  });
}

export function createEnforcementDecision(
  input: CreateEnforcementDecisionInput,
): EnforcementDecision {
  const breakGlass = input.breakGlass ?? null;
  const outcome = input.outcome ?? deriveOutcome(input.verification, breakGlass);
  const failureReasons =
    input.failureReasons !== undefined
      ? normalizeFailureReasons(input.failureReasons)
      : input.verification.failureReasons;

  assertEnforcementOutcomeCoherence(outcome, input.verification, failureReasons, breakGlass);

  return Object.freeze({
    version: ENFORCEMENT_DECISION_SPEC_VERSION,
    id: normalizeIdentifier(input.id, 'enforcementDecision.id'),
    requestId: input.request.id,
    decidedAt: normalizeIsoTimestamp(input.decidedAt, 'enforcementDecision.decidedAt'),
    outcome,
    enforcementPoint: input.request.enforcementPoint,
    releaseTokenId: input.verification.releaseTokenId,
    releaseDecisionId: input.verification.releaseDecisionId,
    verification: input.verification,
    failureReasons,
    cacheState: input.verification.cacheState,
    degradedState: input.verification.degradedState,
    breakGlass,
  });
}

export function enforcementReceiptDigestMaterial(
  input: CreateEnforcementReceiptDigestInput,
): EnforcementReceiptDigestMaterial {
  const outputHash =
    normalizeOptionalIdentifier(input.outputHash, 'enforcementReceipt.outputHash') ??
    input.decision.verification.outputHash;
  const consequenceHash =
    normalizeOptionalIdentifier(input.consequenceHash, 'enforcementReceipt.consequenceHash') ??
    input.decision.verification.consequenceHash;
  const evidenceSemantics = normalizeEnforcementEvidenceSemantics(input.evidenceSemantics);

  return Object.freeze({
    decisionId: input.decision.id,
    requestId: input.decision.requestId,
    outcome: input.decision.outcome,
    releaseTokenId: input.decision.releaseTokenId,
    releaseDecisionId: input.decision.releaseDecisionId,
    outputHash,
    consequenceHash,
    policyHash: input.decision.verification.policyHash,
    policyVersion: input.decision.verification.policyVersion,
    policyIrHash: input.decision.verification.policyIrHash,
    policyProvenanceSource: input.decision.verification.policyProvenanceSource,
    compiledPolicyIndexVersion: input.decision.verification.compiledPolicyIndexVersion,
    compiledPolicyIrVersion: input.decision.verification.compiledPolicyIrVersion,
    policyContext: input.decision.verification.policyContext,
    verificationStatus: input.decision.verification.status,
    failureReasons: input.decision.failureReasons,
    ...(evidenceSemantics ? { evidenceSemantics } : {}),
  });
}

export function createEnforcementReceiptDigest(
  input: CreateEnforcementReceiptDigestInput,
): string {
  return sha256(JSON.stringify(enforcementReceiptDigestMaterial(input)));
}

export function createEnforcementReceipt(
  input: CreateEnforcementReceiptInput,
): EnforcementReceipt {
  const digestMaterial = enforcementReceiptDigestMaterial(input);
  const evidenceSemantics = normalizeEnforcementEvidenceSemantics(input.evidenceSemantics);
  return Object.freeze({
    version: ENFORCEMENT_RECEIPT_SPEC_VERSION,
    id: normalizeIdentifier(input.id, 'enforcementReceipt.id'),
    issuedAt: normalizeIsoTimestamp(input.issuedAt, 'enforcementReceipt.issuedAt'),
    decisionId: input.decision.id,
    requestId: input.decision.requestId,
    outcome: input.decision.outcome,
    enforcementPointLabel: enforcementPointReferenceLabel(input.decision.enforcementPoint),
    releaseTokenId: input.decision.releaseTokenId,
    releaseDecisionId: input.decision.releaseDecisionId,
    outputHash: digestMaterial.outputHash,
    consequenceHash: digestMaterial.consequenceHash,
    policyHash: digestMaterial.policyHash,
    policyVersion: digestMaterial.policyVersion,
    policyIrHash: digestMaterial.policyIrHash,
    policyProvenanceSource: digestMaterial.policyProvenanceSource,
    compiledPolicyIndexVersion: digestMaterial.compiledPolicyIndexVersion,
    compiledPolicyIrVersion: digestMaterial.compiledPolicyIrVersion,
    policyContext: digestMaterial.policyContext,
    verificationStatus: input.decision.verification.status,
    failureReasons: input.decision.failureReasons,
    evidenceSemantics,
    receiptDigest: normalizeOptionalIdentifier(
      input.receiptDigest,
      'enforcementReceipt.receiptDigest',
    ),
  });
}
