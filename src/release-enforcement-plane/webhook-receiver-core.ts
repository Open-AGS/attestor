import { randomUUID } from 'node:crypto';
import type { ReleasePolicyProvenanceSource } from '../release-kernel/object-model.js';
import {
  createEnforcementDecision,
  createEnforcementReceipt,
  createEnforcementReceiptDigest,
  createEnforcementRequest,
  createReleasePresentation,
  type CreateEnforcementRequestInput,
  type EnforcementBreakGlassGrant,
  type EnforcementDecision,
  type EnforcementReceipt,
  type EnforcementRequest,
  type ReleasePresentation,
  type VerificationResult,
} from './object-model.js';
import {
  verifyOfflineReleaseAuthorization,
  type OfflineReleaseVerification,
  type OfflineReleaseVerificationInput,
} from './offline-verifier.js';
import {
  verifyOnlineReleaseAuthorization,
  type OnlineReleaseVerification,
  type OnlineReleaseVerificationInput,
} from './online-verifier.js';
import {
  ATTESTOR_COMPILED_POLICY_INDEX_VERSION_HEADER,
  ATTESTOR_COMPILED_POLICY_IR_VERSION_HEADER,
  ATTESTOR_CONSEQUENCE_HASH_HEADER,
  ATTESTOR_OUTPUT_HASH_HEADER,
  ATTESTOR_POLICY_HASH_HEADER,
  ATTESTOR_POLICY_IR_HASH_HEADER,
  ATTESTOR_POLICY_PROVENANCE_SOURCE_HEADER,
  ATTESTOR_POLICY_VERSION_HEADER,
  ATTESTOR_RELEASE_DECISION_ID_HEADER,
  ATTESTOR_RELEASE_TOKEN_DIGEST_HEADER,
  ATTESTOR_RELEASE_TOKEN_ID_HEADER,
  ATTESTOR_TARGET_ID_HEADER,
  HTTP_MESSAGE_SIGNATURE_LABEL,
  HTTP_MESSAGE_SIGNATURE_TAG,
  contentDigestForBody,
  httpReleaseTokenDigest,
  normalizeHttpSignatureTargetUri,
  verifyHttpMessageSignature,
  type HttpMessageSignatureVerification,
} from './http-message-signatures.js';
import {
  ATTESTOR_ENFORCEMENT_REQUEST_ID_HEADER,
  ATTESTOR_IDEMPOTENCY_KEY_HEADER,
} from './middleware.js';
import type { EnforcementFailureReason } from './types.js';
import {
  DEFAULT_WEBHOOK_RECEIVER_HTTP_AUTHORIZATION_COMPONENTS,
  RELEASE_WEBHOOK_RECEIVER_SPEC_VERSION,
  ATTESTOR_WEBHOOK_EVENT_ID_HEADER,
  type ReleaseWebhookReceiverContext,
  type ReleaseWebhookReceiverHttpRequest,
  type ReleaseWebhookReceiverOptions,
  type ReleaseWebhookReceiverResult,
} from './webhook-receiver-types.js';
import {
  activeBreakGlassGrant,
  canUseBreakGlass,
} from './webhook-receiver-break-glass.js';
import {
  isRetryableFailure,
  receiverFailureReasons,
  responseStatusForFailures,
  resultFromEarlyRejection,
} from './webhook-receiver-result.js';
import {
  bearerReleaseToken,
  bodyForSignature,
  headerValue,
  headersDigest,
  methodAllowed,
  normalizeIdentifier,
  normalizeIsoTimestamp,
  normalizeMethod,
  releaseWebhookMessage,
  resolveOption,
  resolveRequiredBinding,
  uniqueFailureReasons,
} from './webhook-receiver-utils.js';

function createDecisionAndReceipt(input: {
  readonly request: EnforcementRequest;
  readonly verification: VerificationResult;
  readonly checkedAt: string;
  readonly failureReasons: readonly EnforcementFailureReason[];
  readonly breakGlass: EnforcementBreakGlassGrant | null;
}): {
  readonly decision: EnforcementDecision;
  readonly receipt: EnforcementReceipt;
} {
  const decision = createEnforcementDecision({
    id: `ed_webhook_${input.request.id}`,
    request: input.request,
    decidedAt: input.checkedAt,
    verification: input.verification,
    failureReasons: input.failureReasons,
    breakGlass: input.breakGlass,
  });
  const receipt = createEnforcementReceipt({
    id: `er_webhook_${input.request.id}`,
    issuedAt: input.checkedAt,
    decision,
    receiptDigest: createEnforcementReceiptDigest({ decision }),
  });

  return { decision, receipt };
}

async function resultFromVerification(input: {
  readonly context: ReleaseWebhookReceiverContext;
  readonly checkedAt: string;
  readonly request: EnforcementRequest;
  readonly presentation: ReleasePresentation;
  readonly signature: HttpMessageSignatureVerification;
  readonly offline: OfflineReleaseVerification | null;
  readonly online: OnlineReleaseVerification | null;
  readonly options: ReleaseWebhookReceiverOptions;
  readonly breakGlassGrant: EnforcementBreakGlassGrant | null;
}): Promise<ReleaseWebhookReceiverResult> {
  const verificationResult =
    input.online?.verificationResult ?? input.offline?.verificationResult ?? null;
  if (verificationResult === null) {
    return resultFromEarlyRejection({
      checkedAt: input.checkedAt,
      failureReasons: ['invalid-signature'],
    });
  }

  const verifierFailures = receiverFailureReasons(
    input.online?.failureReasons ?? input.offline?.failureReasons ?? ['invalid-signature'],
  );

  if (verifierFailures.length === 0) {
    const { decision, receipt } = createDecisionAndReceipt({
      request: input.request,
      verification: verificationResult,
      checkedAt: input.checkedAt,
      failureReasons: [],
      breakGlass: null,
    });
    return Object.freeze({
      version: RELEASE_WEBHOOK_RECEIVER_SPEC_VERSION,
      status: 'accepted',
      checkedAt: input.checkedAt,
      request: input.request,
      presentation: input.presentation,
      signature: input.signature,
      verificationResult,
      offline: input.offline,
      online: input.online,
      decision,
      receipt,
      breakGlass: null,
      failureReasons: Object.freeze([]),
      responseStatus: 202,
      retryable: false,
    });
  }

  const activeGrant = activeBreakGlassGrant(
    input.breakGlassGrant,
    input.checkedAt,
    input.options.breakGlassMaxTtlSeconds,
  );
  const breakGlassEligible = canUseBreakGlass({
    online: input.online,
    offline: input.offline,
    failureReasons: verifierFailures,
    options: input.options,
  });

  const consumedGrant = activeGrant && breakGlassEligible && input.options.consumeBreakGlassGrant
    ? activeBreakGlassGrant(
        await input.options.consumeBreakGlassGrant({
          context: input.context,
          request: input.request,
          presentation: input.presentation,
          signature: input.signature,
          verificationResult,
          offline: input.offline,
          online: input.online,
          failureReasons: verifierFailures,
          grant: activeGrant,
        }),
        input.checkedAt,
        input.options.breakGlassMaxTtlSeconds,
      )
    : null;

  if (consumedGrant && breakGlassEligible) {
    const { decision, receipt } = createDecisionAndReceipt({
      request: input.request,
      verification: verificationResult,
      checkedAt: input.checkedAt,
      failureReasons: verifierFailures,
      breakGlass: consumedGrant,
    });
    return Object.freeze({
      version: RELEASE_WEBHOOK_RECEIVER_SPEC_VERSION,
      status: 'break-glass-accepted',
      checkedAt: input.checkedAt,
      request: input.request,
      presentation: input.presentation,
      signature: input.signature,
      verificationResult,
      offline: input.offline,
      online: input.online,
      decision,
      receipt,
      breakGlass: consumedGrant,
      failureReasons: verifierFailures,
      responseStatus: 202,
      retryable: false,
    });
  }

  const failureReasons = uniqueFailureReasons([
    ...verifierFailures,
    ...(breakGlassEligible ? ['break-glass-required' as const] : []),
  ]);
  const { decision, receipt } = createDecisionAndReceipt({
    request: input.request,
    verification: verificationResult,
    checkedAt: input.checkedAt,
    failureReasons,
    breakGlass: null,
  });

  return Object.freeze({
    version: RELEASE_WEBHOOK_RECEIVER_SPEC_VERSION,
    status: 'rejected',
    checkedAt: input.checkedAt,
    request: input.request,
    presentation: input.presentation,
    signature: input.signature,
    verificationResult,
    offline: input.offline,
    online: input.online,
    decision,
    receipt,
    breakGlass: null,
    failureReasons,
    responseStatus: responseStatusForFailures(failureReasons),
    retryable: isRetryableFailure(failureReasons),
  });
}

function inputUsesOnlineVerifier(
  input: OfflineReleaseVerificationInput | OnlineReleaseVerificationInput,
  options: ReleaseWebhookReceiverOptions,
): input is OnlineReleaseVerificationInput {
  return (
    options.verifierMode !== 'offline' ||
    options.forceOnlineIntrospection === true ||
    'introspector' in input ||
    'forceOnlineIntrospection' in input
  );
}

async function buildVerifierInput(
  context: ReleaseWebhookReceiverContext,
  options: ReleaseWebhookReceiverOptions,
): Promise<
  | {
      readonly input: OfflineReleaseVerificationInput | OnlineReleaseVerificationInput;
      readonly signature: HttpMessageSignatureVerification;
    }
  | ReleaseWebhookReceiverResult
> {
  if (!methodAllowed(context.request, options)) {
    return resultFromEarlyRejection({
      checkedAt: context.checkedAt,
      failureReasons: ['binding-mismatch'],
      responseStatus: 405,
    });
  }

  const releaseToken = bearerReleaseToken(context.request.headers);
  if (releaseToken === null) {
    return resultFromEarlyRejection({
      checkedAt: context.checkedAt,
      failureReasons: ['missing-release-authorization'],
      responseStatus: 401,
    });
  }

  const signatureInput = headerValue(context.request.headers, 'signature-input');
  const signatureHeader = headerValue(context.request.headers, 'signature');
  if (signatureInput === null || signatureHeader === null) {
    return resultFromEarlyRejection({
      checkedAt: context.checkedAt,
      failureReasons: ['invalid-signature'],
      responseStatus: 401,
    });
  }

  const targetId = await resolveRequiredBinding(
    options.targetId,
    context,
    ATTESTOR_TARGET_ID_HEADER,
  );
  const outputHash = await resolveRequiredBinding(
    options.outputHash,
    context,
    ATTESTOR_OUTPUT_HASH_HEADER,
  );
  const consequenceHash = await resolveRequiredBinding(
    options.consequenceHash,
    context,
    ATTESTOR_CONSEQUENCE_HASH_HEADER,
  );
  const policyHash =
    normalizeIdentifier(await resolveOption(options.policyHash, context)) ??
    headerValue(context.request.headers, ATTESTOR_POLICY_HASH_HEADER);
  const policyVersion =
    normalizeIdentifier(await resolveOption(options.policyVersion, context)) ??
    headerValue(context.request.headers, ATTESTOR_POLICY_VERSION_HEADER);
  const policyIrHash =
    normalizeIdentifier(await resolveOption(options.policyIrHash, context)) ??
    headerValue(context.request.headers, ATTESTOR_POLICY_IR_HASH_HEADER);
  const policyProvenanceSource =
    normalizeIdentifier(await resolveOption(options.policyProvenanceSource, context)) ??
    headerValue(context.request.headers, ATTESTOR_POLICY_PROVENANCE_SOURCE_HEADER);
  const compiledPolicyIndexVersion =
    normalizeIdentifier(await resolveOption(options.compiledPolicyIndexVersion, context)) ??
    headerValue(context.request.headers, ATTESTOR_COMPILED_POLICY_INDEX_VERSION_HEADER);
  const compiledPolicyIrVersion =
    normalizeIdentifier(await resolveOption(options.compiledPolicyIrVersion, context)) ??
    headerValue(context.request.headers, ATTESTOR_COMPILED_POLICY_IR_VERSION_HEADER);
  if (targetId === null || outputHash === null || consequenceHash === null) {
    return resultFromEarlyRejection({
      checkedAt: context.checkedAt,
      failureReasons: ['binding-mismatch'],
    });
  }

  const releaseTokenId =
    normalizeIdentifier(await resolveOption(options.releaseTokenId, context)) ??
    headerValue(context.request.headers, ATTESTOR_RELEASE_TOKEN_ID_HEADER);
  const releaseDecisionId =
    normalizeIdentifier(await resolveOption(options.releaseDecisionId, context)) ??
    headerValue(context.request.headers, ATTESTOR_RELEASE_DECISION_ID_HEADER);
  const requestId =
    normalizeIdentifier(await resolveOption(options.requestId, context)) ??
    headerValue(context.request.headers, ATTESTOR_WEBHOOK_EVENT_ID_HEADER) ??
    headerValue(context.request.headers, ATTESTOR_ENFORCEMENT_REQUEST_ID_HEADER) ??
    randomUUID();
  const idempotencyKey =
    normalizeIdentifier(await resolveOption(options.idempotencyKey, context)) ??
    headerValue(context.request.headers, ATTESTOR_IDEMPOTENCY_KEY_HEADER) ??
    headerValue(context.request.headers, 'idempotency-key');
  const traceId =
    normalizeIdentifier(await resolveOption(options.traceId, context)) ??
    headerValue(context.request.headers, 'traceparent');
  const enforcementPoint = await resolveOption(options.enforcementPoint, context);
  if (!enforcementPoint) {
    return resultFromEarlyRejection({
      checkedAt: context.checkedAt,
      failureReasons: ['binding-mismatch'],
    });
  }

  const message = releaseWebhookMessage(context.request);
  const signaturePublicJwk = await resolveOption(options.signaturePublicJwk, context);
  if (!signaturePublicJwk) {
    return resultFromEarlyRejection({
      checkedAt: context.checkedAt,
      failureReasons: ['invalid-signature'],
    });
  }

  const expectedNonce = normalizeIdentifier(await resolveOption(options.expectedNonce, context));
  const replayLedgerEntry = await resolveOption(options.replayLedgerEntry, context) ?? null;
  const nonceLedgerEntry = await resolveOption(options.nonceLedgerEntry, context) ?? null;
  const signature = await verifyHttpMessageSignature({
    message,
    signatureInput,
    signature: signatureHeader,
    publicJwk: signaturePublicJwk,
    label: HTTP_MESSAGE_SIGNATURE_LABEL,
    expectedNonce,
    expectedTag: HTTP_MESSAGE_SIGNATURE_TAG,
    requiredCoveredComponents:
      options.requiredCoveredComponents ?? DEFAULT_WEBHOOK_RECEIVER_HTTP_AUTHORIZATION_COMPONENTS,
    now: context.checkedAt,
    maxSignatureAgeSeconds: options.maxSignatureAgeSeconds,
    clockSkewSeconds: options.clockSkewSeconds,
    replayLedgerEntry,
  });

  const requestInput: CreateEnforcementRequestInput = {
    id: requestId,
    receivedAt: context.checkedAt,
    enforcementPoint,
    targetId,
    outputHash,
    consequenceHash,
    releaseTokenId,
    releaseDecisionId,
    traceId,
    idempotencyKey,
    transport: {
      kind: 'http',
      method: normalizeMethod(context.request.method),
      uri: normalizeHttpSignatureTargetUri(context.request.url),
      headersDigest: headersDigest(context.request.headers),
      bodyDigest: contentDigestForBody(bodyForSignature(context.request.body)),
    },
  };
  const enforcementRequest = createEnforcementRequest(requestInput);
  const presentation = createReleasePresentation({
    mode: 'http-message-signature',
    presentedAt: context.checkedAt,
    releaseToken,
    releaseTokenId,
    releaseTokenDigest:
      headerValue(context.request.headers, ATTESTOR_RELEASE_TOKEN_DIGEST_HEADER) ??
      httpReleaseTokenDigest(releaseToken),
    audience: targetId,
    proof: {
      kind: 'http-message-signature',
      signatureInput,
      signature: signatureHeader,
      keyId: signature.keyId ?? 'unknown-http-message-signature-key',
      coveredComponents: signature.coveredComponents,
      createdAt: signature.createdAt,
      expiresAt: signature.expiresAt,
      nonce: signature.nonce,
    },
  });
  const verificationKey = await resolveOption(options.verificationKey, context);
  if (!verificationKey) {
    return resultFromEarlyRejection({
      checkedAt: context.checkedAt,
      failureReasons: ['invalid-signature'],
    });
  }

  const baseInput: OfflineReleaseVerificationInput = {
    request: enforcementRequest,
    presentation,
    verificationKey,
    now: context.checkedAt,
    expected:
      policyHash !== null ||
      policyVersion !== null ||
      policyIrHash !== null ||
      policyProvenanceSource !== null ||
      compiledPolicyIndexVersion !== null ||
      compiledPolicyIrVersion !== null
        ? {
            policyHash: policyHash ?? undefined,
            policyVersion: policyVersion ?? undefined,
            policyIrHash: policyIrHash ?? undefined,
            policyProvenanceSource:
              policyProvenanceSource as ReleasePolicyProvenanceSource | undefined,
            compiledPolicyIndexVersion: compiledPolicyIndexVersion ?? undefined,
            compiledPolicyIrVersion: compiledPolicyIrVersion ?? undefined,
          }
        : undefined,
    replayLedgerEntry,
    nonceLedgerEntry,
    httpMessageSignature: {
      message,
      publicJwk: signaturePublicJwk,
      expectedNonce,
      expectedTag: HTTP_MESSAGE_SIGNATURE_TAG,
      requiredCoveredComponents:
        options.requiredCoveredComponents ?? DEFAULT_WEBHOOK_RECEIVER_HTTP_AUTHORIZATION_COMPONENTS,
      maxSignatureAgeSeconds: options.maxSignatureAgeSeconds,
      clockSkewSeconds: options.clockSkewSeconds,
    },
  };

  if (options.verifierMode === 'offline') {
    return { input: baseInput, signature };
  }

  return {
    input: {
      ...baseInput,
      introspector: await resolveOption(options.introspector, context),
      usageStore: await resolveOption(options.usageStore, context),
      consumeOnSuccess: options.consumeOnSuccess ?? true,
      forceOnlineIntrospection: options.forceOnlineIntrospection ?? true,
      resourceServerId: enforcementRequest.enforcementPoint.enforcementPointId,
    } satisfies OnlineReleaseVerificationInput,
    signature,
  };
}

function isReceiverResult(value: unknown): value is ReleaseWebhookReceiverResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { readonly version?: unknown }).version === RELEASE_WEBHOOK_RECEIVER_SPEC_VERSION
  );
}

export async function evaluateReleaseWebhookRequest(
  request: ReleaseWebhookReceiverHttpRequest,
  options: ReleaseWebhookReceiverOptions,
  framework: ReleaseWebhookReceiverContext['framework'] = 'custom',
  frameworkContext?: unknown,
): Promise<ReleaseWebhookReceiverResult> {
  const checkedAt = normalizeIsoTimestamp(options.now?.() ?? new Date().toISOString());
  const context: ReleaseWebhookReceiverContext = Object.freeze({
    request,
    checkedAt,
    framework,
    frameworkContext,
  });

  const inputOrReject = await buildVerifierInput(context, options);
  if (isReceiverResult(inputOrReject)) {
    await options.onRejected?.(inputOrReject);
    return inputOrReject;
  }

  const verifierInput = inputOrReject.input;
  const breakGlassGrant =
    activeBreakGlassGrant(
      await resolveOption(options.breakGlassGrant, context),
      checkedAt,
      options.breakGlassMaxTtlSeconds,
    );

  if (inputUsesOnlineVerifier(verifierInput, options)) {
    const online = await verifyOnlineReleaseAuthorization(verifierInput);
    const result = await resultFromVerification({
      context,
      checkedAt,
      request: verifierInput.request,
      presentation: verifierInput.presentation,
      signature: inputOrReject.signature,
      offline: online.offline,
      online,
      options,
      breakGlassGrant,
    });
    if (result.status === 'rejected') {
      await options.onRejected?.(result);
    } else {
      await options.onAccepted?.(result);
    }
    return result;
  }

  const offline = await verifyOfflineReleaseAuthorization(verifierInput);
  const result = await resultFromVerification({
    context,
    checkedAt,
    request: verifierInput.request,
    presentation: verifierInput.presentation,
    signature: inputOrReject.signature,
    offline,
    online: null,
    options,
    breakGlassGrant,
  });
  if (result.status === 'rejected') {
    await options.onRejected?.(result);
  } else {
    await options.onAccepted?.(result);
  }
  return result;
}
