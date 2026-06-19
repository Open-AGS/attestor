import type { ReleasePresentation } from './object-model.js';
import { verifyOfflineReleaseAuthorization } from './offline-verifier.js';
import { verifyOnlineReleaseAuthorization } from './online-verifier.js';
import type { EnforcementFailureReason } from './types.js';
import {
  type EnvoyExtAuthzBridgeInput,
  type EnvoyExtAuthzBridgeResult,
  type EnvoyExtAuthzCanonicalBinding,
} from './envoy-ext-authz-types.js';
import {
  buildEnvoyExtAuthzCanonicalBinding,
  normalizeHeaders,
} from './envoy-ext-authz-canonical.js';
import {
  createProxyEnforcementRequest,
  createProxyPresentation,
  extractAuthorization,
  trustedWorkloadBindingFromProxy,
} from './envoy-ext-authz-presentation.js';
import {
  bridgeResult,
  resultFromVerification,
} from './envoy-ext-authz-response.js';
import { normalizeIsoTimestamp } from './envoy-ext-authz-utils.js';

export async function evaluateEnvoyExternalAuthorization(
  input: EnvoyExtAuthzBridgeInput,
): Promise<EnvoyExtAuthzBridgeResult> {
  const checkedAt = normalizeIsoTimestamp(input.options.now?.() ?? new Date().toISOString());
  const removeCredentialsOnAllow = input.options.removeCredentialsOnAllow ?? true;
  let binding: EnvoyExtAuthzCanonicalBinding;
  let headers: Readonly<Record<string, string>>;

  try {
    binding = buildEnvoyExtAuthzCanonicalBinding(input.checkRequest, {
      targetId: input.options.targetId,
      riskClass: input.options.riskClass,
      consequenceType: input.options.consequenceType,
    });
    headers = normalizeHeaders(input.checkRequest.attributes?.request?.http);
  } catch {
    return bridgeResult({
      status: 'denied',
      checkedAt,
      binding: null,
      request: null,
      presentation: null,
      verificationResult: null,
      offline: null,
      online: null,
      decision: null,
      receipt: null,
      failureReasons: ['binding-mismatch'],
      removeCredentialsOnAllow,
    });
  }

  const authorization = extractAuthorization(headers);
  if (authorization === null) {
    return bridgeResult({
      status: 'denied',
      checkedAt,
      binding,
      request: null,
      presentation: null,
      verificationResult: null,
      offline: null,
      online: null,
      decision: null,
      receipt: null,
      failureReasons: ['missing-release-authorization'],
      removeCredentialsOnAllow,
    });
  }

  const request = createProxyEnforcementRequest({
    checkedAt,
    binding,
    authorization,
    options: input.options,
    headers,
  });
  const presentationOrFailures = await createProxyPresentation({
    binding,
    headers,
    checkedAt,
    authorization,
    allowBearerFallback: input.options.allowBearerFallback ?? false,
  });
  if (Array.isArray(presentationOrFailures)) {
    const failureReasons = presentationOrFailures as readonly EnforcementFailureReason[];
    return bridgeResult({
      status: 'denied',
      checkedAt,
      binding,
      request,
      presentation: null,
      verificationResult: null,
      offline: null,
      online: null,
      decision: null,
      receipt: null,
      failureReasons,
      removeCredentialsOnAllow,
    });
  }
  const presentation = presentationOrFailures as ReleasePresentation;

  if (input.options.verifierMode === 'offline') {
    const offline = await verifyOfflineReleaseAuthorization({
      request,
      presentation,
      verificationKey: input.options.verificationKey,
      now: checkedAt,
      replayLedgerEntry: input.options.replayLedgerEntry,
      nonceLedgerEntry: input.options.nonceLedgerEntry,
      trustedWorkloadBinding: trustedWorkloadBindingFromProxy({ binding, headers }),
    });
    return resultFromVerification({
      checkedAt,
      binding,
      request,
      presentation,
      offline,
      online: null,
      removeCredentialsOnAllow,
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
    trustedWorkloadBinding: trustedWorkloadBindingFromProxy({ binding, headers }),
    resourceServerId: input.options.enforcementPointId,
  });

  return resultFromVerification({
    checkedAt,
    binding,
    request,
    presentation,
    offline: online.offline,
    online,
    removeCredentialsOnAllow,
  });
}
