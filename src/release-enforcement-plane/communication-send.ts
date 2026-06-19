import { createHash, randomUUID } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  createCanonicalReleaseHashBundle,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type { ReleaseTargetReference } from '../release-kernel/object-model.js';
import type { OutputContractDescriptor } from '../release-kernel/types.js';
import { stripTrailingSlashes } from '../platform/string-normalization.js';
import {
  createEnforcementDecision,
  createEnforcementReceipt,
  createEnforcementReceiptDigest,
  createEnforcementRequest,
  createReleasePresentation,
  type EnforcementDecision,
  type EnforcementEvidenceSemantics,
  type EnforcementReceipt,
  type EnforcementRequest,
  type ReleasePresentation,
  type VerificationResult,
} from './object-model.js';
import {
  verifyOfflineReleaseAuthorization,
  type OfflineReleaseVerification,
} from './offline-verifier.js';
import {
  verifyOnlineReleaseAuthorization,
  type OnlineReleaseVerification,
} from './online-verifier.js';
import {
  httpReleaseTokenDigest,
} from './http-message-signatures.js';
import {
  ENFORCEMENT_FAILURE_REASONS,
  type CreateEnforcementPointReferenceInput,
  type EnforcementFailureReason,
  type ReleaseEnforcementRiskClass,
  type ReleasePresentationMode,
} from './types.js';
import {
  COMMUNICATION_SEND_DEFAULT_BASE_URI,
  COMMUNICATION_SEND_HTTP_METHOD,
  COMMUNICATION_SEND_OUTPUT_ARTIFACT_TYPE,
  COMMUNICATION_SEND_OUTPUT_EXPECTED_SHAPE,
  RELEASE_COMMUNICATION_SEND_GATEWAY_SPEC_VERSION,
  type CommunicationSendAttachment,
  type CommunicationSendBindingOptions,
  type CommunicationSendCanonicalBinding,
  type CommunicationSendGatewayInput,
  type CommunicationSendGatewayOptions,
  type CommunicationSendGatewayResult,
  type CommunicationSendMessage,
  type CommunicationSendReleaseAuthorization,
  type CommunicationSendValue,
} from './communication-send-types.js';

export {
  COMMUNICATION_SEND_DEFAULT_BASE_URI,
  COMMUNICATION_SEND_DEFAULT_VERIFIER_MODE,
  COMMUNICATION_SEND_HTTP_METHOD,
  COMMUNICATION_SEND_OUTPUT_ARTIFACT_TYPE,
  COMMUNICATION_SEND_OUTPUT_EXPECTED_SHAPE,
  RELEASE_COMMUNICATION_SEND_GATEWAY_SPEC_VERSION,
} from './communication-send-types.js';
export type {
  CommunicationSendAttachment,
  CommunicationSendBindingOptions,
  CommunicationSendCanonicalBinding,
  CommunicationSendChannel,
  CommunicationSendGatewayInput,
  CommunicationSendGatewayOptions,
  CommunicationSendGatewayResult,
  CommunicationSendGatewayStatus,
  CommunicationSendGatewayVerifierMode,
  CommunicationSendHttpMessageSignatureContext,
  CommunicationSendMessage,
  CommunicationSendReleaseAuthorization,
  CommunicationSendValue,
} from './communication-send-types.js';

/**
 * Communication-send enforcement gateway.
 *
 * This adapter sits immediately before outbound email, memo, chat, webhook,
 * and internal-message dispatch. It binds the exact message payload and target
 * to a release token and then requires a sender-constrained presentation before
 * the message can leave the release boundary.
 */

const SHA256_DIGEST_REFERENCE_PATTERN = /^sha256:[a-f0-9]{64}$/u;

function uniqueFailureReasons(
  reasons: readonly EnforcementFailureReason[],
): readonly EnforcementFailureReason[] {
  const present = new Set(reasons);
  return Object.freeze(ENFORCEMENT_FAILURE_REASONS.filter((reason) => present.has(reason)));
}

function normalizeIdentifier(value: string | null | undefined, fieldName: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`Communication-send enforcement ${fieldName} requires a non-empty value.`);
  }
  return normalized;
}

function normalizeOptionalIdentifier(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeSha256DigestReference(
  value: string | null | undefined,
  fieldName: string,
): string {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!SHA256_DIGEST_REFERENCE_PATTERN.test(normalized)) {
    throw new Error(
      `Communication-send enforcement ${fieldName} must use sha256:<64 lowercase hex>.`,
    );
  }
  return normalized;
}

function normalizeOptionalText(value: string | null | undefined, fieldName: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (value.trim().length === 0) {
    throw new Error(`Communication-send enforcement ${fieldName} cannot be blank when present.`);
  }
  return value;
}

function normalizeIsoTimestamp(value: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error('Communication-send enforcement now() must return a valid ISO timestamp.');
  }
  return timestamp.toISOString();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeCommunicationValue(
  value: CommunicationSendValue,
  path: string,
): CanonicalReleaseJsonValue {
  if (value === null) {
    return null;
  }

  if (typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(
        `Communication-send enforcement cannot canonicalize non-finite number at ${path}.`,
      );
    }
    return value;
  }

  if (Array.isArray(value)) {
    return Object.freeze(
      value.map((item, index) => normalizeCommunicationValue(item, `${path}[${index}]`)),
    );
  }

  if (!isPlainObject(value)) {
    throw new Error(`Communication-send enforcement only accepts plain JSON values at ${path}.`);
  }

  return Object.freeze(
    Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, normalizeCommunicationValue(value[key], `${path}.${key}`)]),
    ) as { readonly [key: string]: CanonicalReleaseJsonValue },
  );
}

function normalizeAttachment(
  attachment: CommunicationSendAttachment,
  index: number,
): Record<string, CanonicalReleaseJsonValue> {
  if (!Number.isSafeInteger(attachment.sizeBytes) || attachment.sizeBytes < 0) {
    throw new Error(
      `Communication-send enforcement attachment[${index}].sizeBytes must be a safe non-negative integer.`,
    );
  }

  return {
    attachmentId: normalizeIdentifier(attachment.attachmentId, `attachment[${index}].attachmentId`),
    fileName: normalizeIdentifier(attachment.fileName, `attachment[${index}].fileName`),
    contentType: normalizeIdentifier(attachment.contentType, `attachment[${index}].contentType`),
    digest: normalizeSha256DigestReference(attachment.digest, `attachment[${index}].digest`),
    sizeBytes: attachment.sizeBytes,
    disposition: normalizeOptionalIdentifier(attachment.disposition),
  };
}

function normalizeAttachments(
  attachments: readonly CommunicationSendAttachment[] | undefined,
): readonly Record<string, CanonicalReleaseJsonValue>[] {
  const normalized = (attachments ?? []).map((attachment, index) =>
    normalizeAttachment(attachment, index),
  );
  const seenIds = new Set<string>();
  for (const attachment of normalized) {
    const attachmentId = attachment.attachmentId as string;
    if (seenIds.has(attachmentId)) {
      throw new Error(
        `Communication-send enforcement duplicate attachment id is not allowed: ${attachmentId}.`,
      );
    }
    seenIds.add(attachmentId);
  }
  return Object.freeze(
    [...normalized].sort((left, right) =>
      (left.attachmentId as string).localeCompare(right.attachmentId as string),
    ),
  );
}

function declaredEvidenceSemantics(input: {
  readonly declaredEvidenceCount: number;
  readonly evidenceKind: string;
}): EnforcementEvidenceSemantics {
  if (input.declaredEvidenceCount === 0) {
    return Object.freeze({
      declarationBound: false,
      verifiedEvidence: false,
      declaredEvidenceCount: 0,
      verifiedEvidenceCount: 0,
      evidenceKinds: Object.freeze([]),
      boundary: 'none',
    });
  }

  return Object.freeze({
    declarationBound: true,
    verifiedEvidence: false,
    declaredEvidenceCount: input.declaredEvidenceCount,
    verifiedEvidenceCount: 0,
    evidenceKinds: Object.freeze([input.evidenceKind]),
    boundary: 'declared-only',
  });
}

function targetIdForMessage(message: CommunicationSendMessage): string {
  return (
    normalizeOptionalIdentifier(message.targetId) ??
    [
      normalizeIdentifier(message.channelId, 'message.channelId'),
      normalizeIdentifier(message.recipientId, 'message.recipientId'),
    ].join('/')
  );
}

function normalizeMessage(
  message: CommunicationSendMessage,
): Record<string, CanonicalReleaseJsonValue> {
  const body = normalizeOptionalText(message.body, 'message.body');
  const html = normalizeOptionalText(message.html, 'message.html');
  const templateId = normalizeOptionalIdentifier(message.templateId);
  if (body === null && html === null && templateId === null) {
    throw new Error(
      'Communication-send enforcement requires message.body, message.html, or message.templateId.',
    );
  }

  return {
    channel: normalizeIdentifier(message.channel, 'message.channel'),
    channelId: normalizeIdentifier(message.channelId, 'message.channelId'),
    recipientId: normalizeIdentifier(message.recipientId, 'message.recipientId'),
    targetId: targetIdForMessage(message),
    subject: normalizeOptionalText(message.subject, 'message.subject'),
    body,
    html,
    templateId,
    locale: normalizeOptionalIdentifier(message.locale),
    declaredAttachments: normalizeAttachments(message.attachments),
    metadata:
      message.metadata === undefined || message.metadata === null
        ? null
        : normalizeCommunicationValue(message.metadata, '$.metadata'),
    idempotencyKey: normalizeOptionalIdentifier(message.idempotencyKey),
    actorId: normalizeOptionalIdentifier(message.actorId),
  };
}

function sha256(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function communicationTarget(message: CommunicationSendMessage): ReleaseTargetReference {
  return Object.freeze({
    kind: 'endpoint',
    id: targetIdForMessage(message),
  });
}

function outputContract(riskClass: ReleaseEnforcementRiskClass): OutputContractDescriptor {
  return {
    artifactType: COMMUNICATION_SEND_OUTPUT_ARTIFACT_TYPE,
    expectedShape: COMMUNICATION_SEND_OUTPUT_EXPECTED_SHAPE,
    consequenceType: 'communication',
    riskClass,
  };
}

function normalizeSendBaseUri(sendBaseUri?: string | null): string {
  const base = normalizeOptionalIdentifier(sendBaseUri) ?? COMMUNICATION_SEND_DEFAULT_BASE_URI;
  const parsed = new URL(base);
  parsed.hash = '';
  parsed.search = '';
  return stripTrailingSlashes(parsed.toString());
}

export function communicationSendUri(
  targetId: string,
  sendBaseUri?: string | null,
): string {
  return `${normalizeSendBaseUri(sendBaseUri)}/${encodeURIComponent(
    normalizeIdentifier(targetId, 'targetId'),
  )}`;
}

export function buildCommunicationSendCanonicalBinding(
  message: CommunicationSendMessage,
  options: CommunicationSendBindingOptions = {},
): CommunicationSendCanonicalBinding {
  const riskClass = options.riskClass ?? 'R2';
  const normalizedMessage = normalizeMessage(message);
  const declaredAttachments = normalizedMessage.declaredAttachments as readonly unknown[];
  const target = communicationTarget(message);
  const contract = outputContract(riskClass);
  const outputPayload = Object.freeze({
    communicationSend: normalizedMessage,
  } satisfies Record<string, CanonicalReleaseJsonValue>);
  const consequencePayload = Object.freeze({
    operation: 'communication-send',
    targetId: target.id,
    communicationSend: normalizedMessage,
  } satisfies Record<string, CanonicalReleaseJsonValue>);
  const hashBundle = createCanonicalReleaseHashBundle({
    outputContract: contract,
    target,
    outputPayload,
    consequencePayload,
    idempotencyKey: normalizeOptionalIdentifier(message.idempotencyKey) ?? undefined,
  });
  const messageCanonical = canonicalizeReleaseJson(normalizedMessage);

  return Object.freeze({
    version: RELEASE_COMMUNICATION_SEND_GATEWAY_SPEC_VERSION,
    target,
    outputContract: contract,
    outputPayload,
    consequencePayload,
    hashBundle,
    messageCanonical,
    messageHash: sha256(messageCanonical),
    evidenceSemantics: declaredEvidenceSemantics({
      declaredEvidenceCount: declaredAttachments.length,
      evidenceKind: 'attachment',
    }),
    httpMethod: COMMUNICATION_SEND_HTTP_METHOD,
    sendUri: communicationSendUri(target.id, options.sendBaseUri),
  });
}

function createCommunicationEnforcementPoint(
  options: CommunicationSendGatewayOptions,
  binding: CommunicationSendCanonicalBinding,
): CreateEnforcementPointReferenceInput {
  return {
    environment: options.environment,
    enforcementPointId: options.enforcementPointId,
    pointKind: 'communication-send-gateway',
    boundaryKind: 'communication-send',
    consequenceType: 'communication',
    riskClass: binding.outputContract.riskClass,
    tenantId: options.tenantId,
    accountId: options.accountId,
    workloadId: options.workloadId,
    audience: binding.target.id,
  };
}

function communicationHeadersDigest(input: {
  readonly binding: CommunicationSendCanonicalBinding;
  readonly authorization: CommunicationSendReleaseAuthorization;
}): string {
  return sha256(canonicalizeReleaseJson({
    targetId: input.binding.target.id,
    outputHash: input.binding.hashBundle.outputHash,
    consequenceHash: input.binding.hashBundle.consequenceHash,
    releaseTokenId: normalizeOptionalIdentifier(input.authorization.releaseTokenId),
    releaseDecisionId: normalizeOptionalIdentifier(input.authorization.releaseDecisionId),
  }));
}

function createCommunicationSendRequest(input: {
  readonly checkedAt: string;
  readonly binding: CommunicationSendCanonicalBinding;
  readonly message: CommunicationSendMessage;
  readonly authorization: CommunicationSendReleaseAuthorization;
  readonly options: CommunicationSendGatewayOptions;
}): EnforcementRequest {
  return createEnforcementRequest({
    id: input.options.requestId ?? `erq_communication_send_${randomUUID()}`,
    receivedAt: input.checkedAt,
    enforcementPoint: createCommunicationEnforcementPoint(input.options, input.binding),
    targetId: input.binding.target.id,
    outputHash: input.binding.hashBundle.outputHash,
    consequenceHash: input.binding.hashBundle.consequenceHash,
    releaseTokenId: normalizeOptionalIdentifier(input.authorization.releaseTokenId),
    releaseDecisionId: normalizeOptionalIdentifier(input.authorization.releaseDecisionId),
    traceId: normalizeOptionalIdentifier(input.options.traceId),
    idempotencyKey: normalizeOptionalIdentifier(input.message.idempotencyKey),
    transport: {
      kind: 'http',
      method: input.binding.httpMethod,
      uri: input.binding.sendUri,
      headersDigest: communicationHeadersDigest({
        binding: input.binding,
        authorization: input.authorization,
      }),
      bodyDigest: input.binding.messageHash,
    },
  });
}

function createCommunicationSendPresentation(
  authorization: CommunicationSendReleaseAuthorization,
  checkedAt: string,
): ReleasePresentation {
  return createReleasePresentation({
    mode: authorization.mode ?? 'bearer-release-token',
    presentedAt: checkedAt,
    releaseToken: authorization.releaseToken,
    releaseTokenId: authorization.releaseTokenId,
    releaseTokenDigest: httpReleaseTokenDigest(authorization.releaseToken),
    issuer: authorization.issuer,
    subject: authorization.subject,
    audience: authorization.audience,
    expiresAt: authorization.expiresAt,
    scope: authorization.scope,
    proof: authorization.proof ?? null,
  });
}

function senderConstrainedPresentationFailureReasons(
  mode: ReleasePresentationMode,
): readonly EnforcementFailureReason[] {
  return mode === 'dpop-bound-token' || mode === 'http-message-signature'
    ? []
    : ['binding-mismatch'];
}

function decisionAndReceipt(input: {
  readonly request: EnforcementRequest;
  readonly verification: VerificationResult;
  readonly checkedAt: string;
  readonly failureReasons: readonly EnforcementFailureReason[];
  readonly evidenceSemantics: EnforcementEvidenceSemantics;
}): {
  readonly decision: EnforcementDecision;
  readonly receipt: EnforcementReceipt;
} {
  const decision = createEnforcementDecision({
    id: `ed_communication_send_${input.request.id}`,
    request: input.request,
    decidedAt: input.checkedAt,
    verification: input.verification,
    failureReasons: input.failureReasons,
  });
  const receipt = createEnforcementReceipt({
    id: `er_communication_send_${input.request.id}`,
    issuedAt: input.checkedAt,
    decision,
    evidenceSemantics: input.evidenceSemantics,
    receiptDigest: createEnforcementReceiptDigest({
      decision,
      evidenceSemantics: input.evidenceSemantics,
    }),
  });

  return { decision, receipt };
}

function responseStatusForFailures(failureReasons: readonly EnforcementFailureReason[]): number {
  if (failureReasons.includes('missing-release-authorization')) {
    return 401;
  }
  if (failureReasons.includes('introspection-unavailable')) {
    return 503;
  }
  if (failureReasons.includes('replayed-authorization')) {
    return 409;
  }
  if (
    failureReasons.includes('fresh-introspection-required') &&
    failureReasons.every((reason) => reason === 'fresh-introspection-required')
  ) {
    return 428;
  }
  return 403;
}

function gatewayFailureReasons(
  reasons: readonly EnforcementFailureReason[],
): readonly EnforcementFailureReason[] {
  const unique = uniqueFailureReasons(reasons);
  const hasHardFailure = unique.some(
    (reason) => reason !== 'fresh-introspection-required' && reason !== 'introspection-unavailable',
  );
  return hasHardFailure
    ? uniqueFailureReasons(unique.filter((reason) => reason !== 'fresh-introspection-required'))
    : unique;
}

function deniedEarlyResult(input: {
  readonly checkedAt: string;
  readonly binding: CommunicationSendCanonicalBinding;
  readonly failureReasons: readonly EnforcementFailureReason[];
}): CommunicationSendGatewayResult {
  const failureReasons = uniqueFailureReasons(input.failureReasons);
  return Object.freeze({
    version: RELEASE_COMMUNICATION_SEND_GATEWAY_SPEC_VERSION,
    status: 'denied',
    checkedAt: input.checkedAt,
    binding: input.binding,
    request: null,
    presentation: null,
    verificationResult: null,
    offline: null,
    online: null,
    decision: null,
    receipt: null,
    evidenceSemantics: input.binding.evidenceSemantics,
    failureReasons,
    responseStatus: responseStatusForFailures(failureReasons),
  });
}

function resultFromVerification(input: {
  readonly checkedAt: string;
  readonly binding: CommunicationSendCanonicalBinding;
  readonly request: EnforcementRequest;
  readonly presentation: ReleasePresentation;
  readonly offline: OfflineReleaseVerification | null;
  readonly online: OnlineReleaseVerification | null;
}): CommunicationSendGatewayResult {
  const verificationResult =
    input.online?.verificationResult ?? input.offline?.verificationResult ?? null;
  if (verificationResult === null) {
    return deniedEarlyResult({
      checkedAt: input.checkedAt,
      binding: input.binding,
      failureReasons: ['invalid-signature'],
    });
  }

  const failureReasons = gatewayFailureReasons(
    input.online?.failureReasons ?? input.offline?.failureReasons ?? [],
  );
  const { decision, receipt } = decisionAndReceipt({
    request: input.request,
    verification: verificationResult,
    checkedAt: input.checkedAt,
    failureReasons,
    evidenceSemantics: input.binding.evidenceSemantics,
  });
  const allowed = failureReasons.length === 0 && verificationResult.status === 'valid';

  return Object.freeze({
    version: RELEASE_COMMUNICATION_SEND_GATEWAY_SPEC_VERSION,
    status: allowed ? 'allowed' : 'denied',
    checkedAt: input.checkedAt,
    binding: input.binding,
    request: input.request,
    presentation: input.presentation,
    verificationResult,
    offline: input.offline,
    online: input.online,
    decision,
    receipt,
    evidenceSemantics: input.binding.evidenceSemantics,
    failureReasons,
    responseStatus: allowed ? 200 : responseStatusForFailures(failureReasons),
  });
}

export async function enforceCommunicationSend(
  input: CommunicationSendGatewayInput,
): Promise<CommunicationSendGatewayResult> {
  const checkedAt = normalizeIsoTimestamp(input.options.now?.() ?? new Date().toISOString());
  const binding = buildCommunicationSendCanonicalBinding(input.message, {
    riskClass: input.options.riskClass,
    sendBaseUri: input.options.sendBaseUri,
  });
  const authorization = input.authorization ?? null;

  if (!authorization?.releaseToken) {
    return deniedEarlyResult({
      checkedAt,
      binding,
      failureReasons: ['missing-release-authorization'],
    });
  }

  const request = createCommunicationSendRequest({
    checkedAt,
    binding,
    message: input.message,
    authorization,
    options: input.options,
  });
  const presentation = createCommunicationSendPresentation(authorization, checkedAt);
  const presentationModeFailures = senderConstrainedPresentationFailureReasons(presentation.mode);
  if (presentationModeFailures.length > 0) {
    const verifierPresentation = createReleasePresentation({
      mode: presentation.mode,
      presentedAt: checkedAt,
      releaseToken: authorization.releaseToken,
      releaseTokenId: authorization.releaseTokenId,
    });
    const offline = await verifyOfflineReleaseAuthorization({
      request,
      presentation: verifierPresentation,
      verificationKey: input.options.verificationKey,
      now: checkedAt,
      replayLedgerEntry: input.options.replayLedgerEntry,
      nonceLedgerEntry: input.options.nonceLedgerEntry,
      httpMessageSignature: input.options.httpMessageSignature,
    });
    const forcedFailureReasons = gatewayFailureReasons([
      ...presentationModeFailures,
      ...offline.failureReasons,
    ]);
    const forcedVerification = {
      ...offline.verificationResult,
      status: 'invalid' as const,
      failureReasons: forcedFailureReasons,
    };
    const { decision, receipt } = decisionAndReceipt({
      request,
      verification: forcedVerification,
      checkedAt,
      failureReasons: forcedFailureReasons,
      evidenceSemantics: binding.evidenceSemantics,
    });
    return Object.freeze({
      version: RELEASE_COMMUNICATION_SEND_GATEWAY_SPEC_VERSION,
      status: 'denied',
      checkedAt,
      binding,
      request,
      presentation,
      verificationResult: forcedVerification,
      offline,
      online: null,
      decision,
      receipt,
      evidenceSemantics: binding.evidenceSemantics,
      failureReasons: forcedFailureReasons,
      responseStatus: responseStatusForFailures(forcedFailureReasons),
    });
  }

  if (input.options.verifierMode === 'offline') {
    const offline = await verifyOfflineReleaseAuthorization({
      request,
      presentation,
      verificationKey: input.options.verificationKey,
      now: checkedAt,
      replayLedgerEntry: input.options.replayLedgerEntry,
      nonceLedgerEntry: input.options.nonceLedgerEntry,
      httpMessageSignature: input.options.httpMessageSignature,
    });
    return resultFromVerification({
      checkedAt,
      binding,
      request,
      presentation,
      offline,
      online: null,
    });
  }

  const online = await verifyOnlineReleaseAuthorization({
    request,
    presentation,
    verificationKey: input.options.verificationKey,
    now: checkedAt,
    introspector: input.options.introspector,
    usageStore: input.options.usageStore,
    consumeOnSuccess: input.options.consumeOnSuccess ?? true,
    forceOnlineIntrospection: input.options.forceOnlineIntrospection ?? true,
    replayLedgerEntry: input.options.replayLedgerEntry,
    nonceLedgerEntry: input.options.nonceLedgerEntry,
    httpMessageSignature: input.options.httpMessageSignature,
    resourceServerId: input.options.enforcementPointId,
  });

  return resultFromVerification({
    checkedAt,
    binding,
    request,
    presentation,
    offline: online.offline,
    online,
  });
}
