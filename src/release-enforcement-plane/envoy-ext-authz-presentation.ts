import { randomUUID } from 'node:crypto';
import {
  createEnforcementRequest,
  createReleasePresentation,
  type EnforcementRequest,
  type ReleasePresentation,
  type ReleasePresentationProof,
} from './object-model.js';
import type { OfflineTrustedWorkloadBinding } from './offline-verifier.js';
import {
  ATTESTOR_RELEASE_DECISION_ID_HEADER,
  ATTESTOR_RELEASE_TOKEN_ID_HEADER,
  httpReleaseTokenDigest,
} from './http-message-signatures.js';
import {
  ATTESTOR_ENFORCEMENT_REQUEST_ID_HEADER,
  ATTESTOR_IDEMPOTENCY_KEY_HEADER,
  ATTESTOR_RELEASE_TOKEN_HEADER,
} from './middleware.js';
import {
  normalizeCertificateThumbprint,
  normalizeSpiffeId,
  trustDomainFromSpiffeId,
} from './workload-binding.js';
import { verifyDpopProof } from './dpop.js';
import {
  type CreateEnforcementPointReferenceInput,
  type EnforcementFailureReason,
  type ReleasePresentationMode,
} from './types.js';
import {
  strictAuthorizationCredential,
  strictReleaseTokenCredential,
} from './authorization-headers.js';
import {
  ATTESTOR_CLIENT_CERTIFICATE_THUMBPRINT_HEADER,
  ATTESTOR_RELEASE_PRESENTATION_MODE_HEADER,
  type EnvoyExtAuthzBridgeOptions,
  type EnvoyExtAuthzCanonicalBinding,
} from './envoy-ext-authz-types.js';
import { headerValue } from './envoy-ext-authz-canonical.js';
import { normalizeIdentifier } from './envoy-ext-authz-utils.js';

function createProxyEnforcementPoint(input: {
  readonly options: EnvoyExtAuthzBridgeOptions;
  readonly binding: EnvoyExtAuthzCanonicalBinding;
  readonly sourcePrincipal: string | null;
}): CreateEnforcementPointReferenceInput {
  return {
    environment: input.options.environment,
    enforcementPointId: input.options.enforcementPointId,
    pointKind: 'proxy-ext-authz',
    boundaryKind: 'proxy-admission',
    consequenceType: input.binding.outputContract.consequenceType,
    riskClass: input.binding.outputContract.riskClass,
    tenantId: input.options.tenantId,
    accountId: input.options.accountId,
    workloadId: input.options.workloadId ?? input.sourcePrincipal,
    audience: input.binding.target.id,
  };
}

export function createProxyEnforcementRequest(input: {
  readonly checkedAt: string;
  readonly binding: EnvoyExtAuthzCanonicalBinding;
  readonly authorization: ExtractedProxyAuthorization;
  readonly options: EnvoyExtAuthzBridgeOptions;
  readonly headers: Readonly<Record<string, string>>;
}): EnforcementRequest {
  const requestId =
    input.options.requestId ??
    headerValue(input.headers, ATTESTOR_ENFORCEMENT_REQUEST_ID_HEADER) ??
    input.binding.proxyRequest.requestId ??
    `erq_envoy_ext_authz_${randomUUID()}`;
  return createEnforcementRequest({
    id: requestId,
    receivedAt: input.checkedAt,
    enforcementPoint: createProxyEnforcementPoint({
      options: input.options,
      binding: input.binding,
      sourcePrincipal: input.binding.proxyRequest.source.principal,
    }),
    targetId: input.binding.target.id,
    outputHash: input.binding.hashBundle.outputHash,
    consequenceHash: input.binding.hashBundle.consequenceHash,
    releaseTokenId: input.authorization.releaseTokenId,
    releaseDecisionId: input.authorization.releaseDecisionId,
    traceId:
      normalizeIdentifier(input.options.traceId) ??
      headerValue(input.headers, 'traceparent') ??
      input.binding.proxyRequest.requestId,
    idempotencyKey:
      headerValue(input.headers, ATTESTOR_IDEMPOTENCY_KEY_HEADER) ??
      headerValue(input.headers, 'idempotency-key') ??
      input.binding.proxyRequest.requestId,
    transport: {
      kind: 'http',
      method: input.binding.proxyRequest.method,
      uri: input.binding.proxyRequest.targetUri,
      headersDigest: input.binding.headersDigest,
      bodyDigest: input.binding.bodyDigest,
    },
  });
}

export interface ExtractedProxyAuthorization {
  readonly releaseToken: string;
  readonly releaseTokenId: string | null;
  readonly releaseDecisionId: string | null;
  readonly requestedMode: ReleasePresentationMode | null;
}

export function extractAuthorization(
  headers: Readonly<Record<string, string>>,
): ExtractedProxyAuthorization | null {
  const authorization = headerValue(headers, 'authorization');
  let releaseToken: string | null = null;
  if (authorization) {
    const parsed = strictAuthorizationCredential(authorization, ['bearer', 'dpop']);
    if (parsed) {
      releaseToken = parsed.credential;
    }
  }

  releaseToken = releaseToken ?? strictReleaseTokenCredential(headerValue(headers, ATTESTOR_RELEASE_TOKEN_HEADER));
  if (!releaseToken) {
    return null;
  }

  const requestedMode = headerValue(headers, ATTESTOR_RELEASE_PRESENTATION_MODE_HEADER);
  return Object.freeze({
    releaseToken,
    releaseTokenId: headerValue(headers, ATTESTOR_RELEASE_TOKEN_ID_HEADER),
    releaseDecisionId: headerValue(headers, ATTESTOR_RELEASE_DECISION_ID_HEADER),
    requestedMode:
      requestedMode === 'bearer-release-token' ||
      requestedMode === 'dpop-bound-token' ||
      requestedMode === 'mtls-bound-token' ||
      requestedMode === 'spiffe-bound-token'
        ? requestedMode
        : null,
  });
}

function clientCertificateThumbprint(
  headers: Readonly<Record<string, string>>,
  binding: EnvoyExtAuthzCanonicalBinding,
): string | null {
  const fromHeader = headerValue(headers, ATTESTOR_CLIENT_CERTIFICATE_THUMBPRINT_HEADER);
  if (fromHeader) {
    try {
      return normalizeCertificateThumbprint(fromHeader);
    } catch {
      return null;
    }
  }
  return binding.proxyRequest.source.certificateThumbprint;
}

function spiffePrincipal(binding: EnvoyExtAuthzCanonicalBinding): string | null {
  const principal = binding.proxyRequest.source.principal;
  if (!principal?.startsWith('spiffe://')) {
    return null;
  }
  try {
    return normalizeSpiffeId(principal);
  } catch {
    return null;
  }
}

function proxyPresentationProof(input: {
  readonly mode: ReleasePresentationMode;
  readonly binding: EnvoyExtAuthzCanonicalBinding;
  readonly headers: Readonly<Record<string, string>>;
  readonly checkedAt: string;
  readonly authorization: ExtractedProxyAuthorization;
}): Promise<ReleasePresentationProof | null> | ReleasePresentationProof | null {
  if (input.mode === 'dpop-bound-token') {
    const proofJwt = headerValue(input.headers, 'dpop');
    if (!proofJwt) {
      return null;
    }
    return verifyDpopProof({
      proofJwt,
      httpMethod: input.binding.proxyRequest.method,
      httpUri: input.binding.proxyRequest.targetUri,
      accessToken: input.authorization.releaseToken,
      now: input.checkedAt,
    }).then((verified) => {
      if (
        verified.status !== 'valid' ||
        verified.proofJti === null ||
        verified.httpMethod === null ||
        verified.httpUri === null ||
        verified.publicKeyThumbprint === null
      ) {
        return null;
      }
      return Object.freeze({
        kind: 'dpop' as const,
        proofJwt,
        httpMethod: verified.httpMethod,
        httpUri: verified.httpUri,
        proofJti: verified.proofJti,
        accessTokenHash: verified.accessTokenHash,
        nonce: verified.nonce,
        keyThumbprint: verified.publicKeyThumbprint,
      });
    });
  }

  if (input.mode === 'spiffe-bound-token') {
    const spiffeId = spiffePrincipal(input.binding);
    if (!spiffeId) {
      return null;
    }
    return Object.freeze({
      kind: 'spiffe' as const,
      spiffeId,
      trustDomain: trustDomainFromSpiffeId(spiffeId),
      svidThumbprint: clientCertificateThumbprint(input.headers, input.binding),
    });
  }

  if (input.mode === 'mtls-bound-token') {
    const certificateThumbprint = clientCertificateThumbprint(input.headers, input.binding);
    if (!certificateThumbprint) {
      return null;
    }
    const spiffeId = spiffePrincipal(input.binding);
    return Object.freeze({
      kind: 'mtls' as const,
      certificateThumbprint,
      subjectDn: spiffeId ? null : input.binding.proxyRequest.source.principal,
      spiffeId,
    });
  }

  return null;
}

export async function createProxyPresentation(input: {
  readonly binding: EnvoyExtAuthzCanonicalBinding;
  readonly headers: Readonly<Record<string, string>>;
  readonly checkedAt: string;
  readonly authorization: ExtractedProxyAuthorization;
  readonly allowBearerFallback: boolean;
}): Promise<ReleasePresentation | readonly EnforcementFailureReason[]> {
  const hasDpopProof = headerValue(input.headers, 'dpop') !== null;
  const spiffeId = spiffePrincipal(input.binding);
  const certificateThumbprint = clientCertificateThumbprint(input.headers, input.binding);
  const requestedMode = input.authorization.requestedMode;
  const mode: ReleasePresentationMode | null =
    requestedMode ??
    (hasDpopProof
      ? 'dpop-bound-token'
      : spiffeId
        ? 'spiffe-bound-token'
        : certificateThumbprint
          ? 'mtls-bound-token'
          : input.allowBearerFallback
            ? 'bearer-release-token'
            : null);

  if (mode === null) {
    return ['binding-mismatch'];
  }
  if (mode === 'bearer-release-token') {
    if (!input.allowBearerFallback) {
      return ['binding-mismatch'];
    }
    return createReleasePresentation({
      mode,
      presentedAt: input.checkedAt,
      releaseToken: input.authorization.releaseToken,
      releaseTokenId: input.authorization.releaseTokenId,
      releaseTokenDigest: httpReleaseTokenDigest(input.authorization.releaseToken),
    });
  }

  const proof = await proxyPresentationProof({
    mode,
    binding: input.binding,
    headers: input.headers,
    checkedAt: input.checkedAt,
    authorization: input.authorization,
  });
  if (proof === null) {
    return ['binding-mismatch'];
  }

  return createReleasePresentation({
    mode,
    presentedAt: input.checkedAt,
    releaseToken: input.authorization.releaseToken,
    releaseTokenId: input.authorization.releaseTokenId,
    releaseTokenDigest: httpReleaseTokenDigest(input.authorization.releaseToken),
    proof,
  });
}

export function trustedWorkloadBindingFromProxy(input: {
  readonly binding: EnvoyExtAuthzCanonicalBinding;
  readonly headers: Readonly<Record<string, string>>;
}): OfflineTrustedWorkloadBinding | undefined {
  const expectedSpiffeId = spiffePrincipal(input.binding);
  const expectedCertificateThumbprint = clientCertificateThumbprint(input.headers, input.binding);
  if (!expectedSpiffeId && !expectedCertificateThumbprint) {
    return undefined;
  }
  return Object.freeze({
    expectedSpiffeId,
    expectedTrustDomain: expectedSpiffeId ? trustDomainFromSpiffeId(expectedSpiffeId) : null,
    expectedCertificateThumbprint,
  });
}
