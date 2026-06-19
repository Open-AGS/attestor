import assert from 'node:assert/strict';
import { generateKeyPair } from '../src/signing/keys.js';
import { createReleaseDecisionSkeleton } from '../src/release-kernel/object-model.js';
import {
  createReleaseTokenIssuer,
  type IssuedReleaseToken,
  type ReleaseTokenVerificationKey,
} from '../src/release-kernel/release-token.js';
import type {
  ReleaseDecision,
  ReleasePolicyProvenance,
  ReleaseTokenConfirmationClaim,
} from '../src/release-kernel/object-model.js';
import {
  createInMemoryReleaseTokenIntrospectionStore,
  createReleaseTokenIntrospector,
  type ReleaseTokenIntrospectionStore,
  type ReleaseTokenIntrospector,
} from '../src/release-kernel/release-introspection.js';
import {
  buildEnvoyExtAuthzCanonicalBinding,
  envoyOriginalRequestUri,
  type EnvoyExtAuthzCheckRequest,
} from '../src/release-enforcement-plane/envoy-ext-authz.js';
import {
  ATTESTOR_CONSEQUENCE_HASH_HEADER,
  ATTESTOR_OUTPUT_HASH_HEADER,
  ATTESTOR_RELEASE_DECISION_ID_HEADER,
  ATTESTOR_RELEASE_TOKEN_ID_HEADER,
  ATTESTOR_TARGET_ID_HEADER,
} from '../src/release-enforcement-plane/http-message-signatures.js';
import {
  ATTESTOR_ENFORCEMENT_REQUEST_ID_HEADER,
  ATTESTOR_RELEASE_TOKEN_HEADER,
} from '../src/release-enforcement-plane/middleware.js';
import {
  createDpopProof,
  generateDpopKeyPair,
  type DpopKeyPair,
} from '../src/release-enforcement-plane/dpop.js';
import {
  certificateThumbprintFromPem,
} from '../src/release-enforcement-plane/workload-binding.js';
import type { ReplayLedgerEntry } from '../src/release-enforcement-plane/freshness.js';

let passed = 0;

export function passedCount(): number { return passed; }

export function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

export function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

export function deepEqual<T>(actual: T, expected: T, message: string): void {
  assert.deepEqual(actual, expected, message);
  passed += 1;
}

export function throws(fn: () => unknown, expected: RegExp, message?: string): void {
  assert.throws(fn, expected, message);
  passed += 1;
}

export const CHECKED_AT = '2026-04-18T22:00:20.000Z';
export const WORKLOAD_SPIFFE_ID = 'spiffe://attestor.test/ns/finance/sa/proxy-client';
export const PEER_CERTIFICATE = [
  '-----BEGIN CERTIFICATE-----',
  'AQIDBAUGBwgJCgsMDQ4PEA==',
  '-----END CERTIFICATE-----',
].join('\n');
export const PEER_CERTIFICATE_THUMBPRINT = certificateThumbprintFromPem(PEER_CERTIFICATE);
export const POLICY_HASH = 'sha256:policy';
export const POLICY_IR_HASH = 'sha256:policy-ir';
export const COMPILED_POLICY_INDEX_VERSION = 'attestor.policy-index.test.v1';
export const COMPILED_POLICY_IR_VERSION = 'attestor.policy-ir.test.v1';

export const BASE_CHECK: EnvoyExtAuthzCheckRequest = Object.freeze({
  attributes: Object.freeze({
    source: Object.freeze({
      service: 'finance-api.attestor.svc.cluster.local',
      principal: WORKLOAD_SPIFFE_ID,
      certificate: PEER_CERTIFICATE,
      labels: Object.freeze({
        app: 'finance-api',
        version: 'v1',
      }),
    }),
    destination: Object.freeze({
      service: 'finance-gateway.attestor.svc.cluster.local',
      labels: Object.freeze({
        app: 'finance-gateway',
      }),
    }),
    request: Object.freeze({
      time: CHECKED_AT,
      http: Object.freeze({
        id: 'req-envoy-ext-authz-1',
        method: 'POST',
        scheme: 'https',
        host: 'finance.attestor.local',
        path: '/v1/filings/prepare?run=2026-04-18',
        protocol: 'HTTP/2',
        headers: Object.freeze({
          ':method': 'POST',
          ':path': '/v1/filings/prepare?run=2026-04-18',
          ':scheme': 'https',
          ':authority': 'finance.attestor.local',
          'content-type': 'application/json',
          'x-request-id': 'req-envoy-ext-authz-1',
          traceparent: '00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01',
          'x-attestor-workflow': 'filing-prepare',
        }),
        body: '{"runId":"run-2026-04-18","transition":"prepare"}',
      }),
    }),
    context_extensions: Object.freeze({
      'attestor.target_id': 'finance.reporting.proxy.prepare-filing',
      'istio.authorization_provider': 'attestor-release-ext-authz',
    }),
    metadata_context: Object.freeze({
      filter_metadata: Object.freeze({
        'envoy.filters.http.jwt_authn': Object.freeze({
          issuer: 'attestor.release.local',
        }),
      }),
    }),
    route_metadata_context: Object.freeze({
      route: Object.freeze({
        name: 'finance-prepare-filing',
      }),
    }),
    tls_session: Object.freeze({
      sni: 'finance.attestor.local',
    }),
  }),
});

export function policyProvenance(): ReleasePolicyProvenance {
  return {
    source: 'compiled-admission-policy-index',
    policyId: 'policy.release-envoy-ext-authz-test',
    policySpecVersion: 'attestor.release-policy.v1',
    policyHash: POLICY_HASH,
    compiledPolicyHash: POLICY_HASH,
    compiledPolicyIrHash: POLICY_IR_HASH,
    compiledPolicyIndexVersion: COMPILED_POLICY_INDEX_VERSION,
    compiledPolicyIrVersion: COMPILED_POLICY_IR_VERSION,
    verificationValid: true,
    verificationErrorCodes: [],
    verificationWarningCodes: [],
  };
}

export function makeDecision(input: {
  readonly id: string;
  readonly binding: ReturnType<typeof buildEnvoyExtAuthzCanonicalBinding>;
}): ReleaseDecision {
  return createReleaseDecisionSkeleton({
    id: input.id,
    createdAt: '2026-04-18T22:00:00.000Z',
    status: 'accepted',
    policyVersion: 'policy.release-envoy-ext-authz-test.v1',
    policyHash: POLICY_HASH,
    policyProvenance: policyProvenance(),
    outputHash: input.binding.hashBundle.outputHash,
    consequenceHash: input.binding.hashBundle.consequenceHash,
    outputContract: input.binding.outputContract,
    capabilityBoundary: {
      allowedTools: ['proxy-ext-authz', 'envoy-ext-authz', 'istio-custom-authz'],
      allowedTargets: [input.binding.target.id],
      allowedDataDomains: ['financial-reporting'],
    },
    requester: {
      id: 'svc.release-envoy-ext-authz-test',
      type: 'service',
    },
    target: input.binding.target,
  });
}

export async function setupIssuer() {
  const keyPair = generateKeyPair();
  const issuer = createReleaseTokenIssuer({
    issuer: 'attestor.release.local',
    privateKeyPem: keyPair.privateKeyPem,
    publicKeyPem: keyPair.publicKeyPem,
  });
  return {
    issuer,
    verificationKey: await issuer.exportVerificationKey(),
  };
}

export async function issueProxyToken(input: {
  readonly tokenId: string;
  readonly decisionId: string;
  readonly checkRequest?: EnvoyExtAuthzCheckRequest;
  readonly confirmation?: ReleaseTokenConfirmationClaim;
}): Promise<{
  readonly issued: IssuedReleaseToken;
  readonly verificationKey: ReleaseTokenVerificationKey;
  readonly decision: ReleaseDecision;
  readonly binding: ReturnType<typeof buildEnvoyExtAuthzCanonicalBinding>;
}> {
  const binding = buildEnvoyExtAuthzCanonicalBinding(input.checkRequest ?? BASE_CHECK);
  const { issuer, verificationKey } = await setupIssuer();
  const decision = makeDecision({
    id: input.decisionId,
    binding,
  });
  const issued = await issuer.issue({
    decision,
    issuedAt: '2026-04-18T22:00:00.000Z',
    tokenId: input.tokenId,
    tenantId: 'tenant-test',
    confirmation: input.confirmation,
  });

  return { issued, verificationKey, decision, binding };
}

export function register(
  issued: IssuedReleaseToken,
  decision: ReleaseDecision,
): {
  readonly store: ReleaseTokenIntrospectionStore;
  readonly introspector: ReleaseTokenIntrospector;
} {
  const store = createInMemoryReleaseTokenIntrospectionStore();
  const introspector = createReleaseTokenIntrospector(store);
  store.registerIssuedToken({ issuedToken: issued, decision });
  return { store, introspector };
}

export function nonceLedgerEntry(nonce: string) {
  return {
    nonce,
    issuedAt: '2026-04-18T21:59:50.000Z',
    expiresAt: '2026-04-18T22:01:30.000Z',
  };
}

export function options(input: {
  readonly verificationKey: ReleaseTokenVerificationKey;
  readonly introspector?: ReleaseTokenIntrospector;
  readonly store?: ReleaseTokenIntrospectionStore;
  readonly verifierMode?: 'offline' | 'online';
  readonly nonce?: string;
  readonly replayLedgerEntry?: ReplayLedgerEntry | null;
}) {
  return {
    verificationKey: input.verificationKey,
    enforcementPointId: 'attestor-release-ext-authz',
    environment: 'test',
    tenantId: 'tenant-test',
    accountId: 'acct-test',
    introspector: input.introspector,
    usageStore: input.store,
    verifierMode: input.verifierMode,
    requestId: 'erq-envoy-ext-authz-test',
    replayLedgerEntry: input.replayLedgerEntry ?? null,
    nonceLedgerEntry: input.nonce ? nonceLedgerEntry(input.nonce) : undefined,
    now: () => CHECKED_AT,
  };
}

export function withHeaders(
  checkRequest: EnvoyExtAuthzCheckRequest,
  headers: Readonly<Record<string, string>>,
): EnvoyExtAuthzCheckRequest {
  const attributes = checkRequest.attributes ?? {};
  const request = attributes.request ?? {};
  const http = request.http ?? {};
  return Object.freeze({
    attributes: Object.freeze({
      ...attributes,
      request: Object.freeze({
        ...request,
        http: Object.freeze({
          ...http,
          headers: Object.freeze({
            ...(http.headers ?? {}),
            ...headers,
          }),
        }),
      }),
    }),
  });
}

export function withoutSourceIdentity(checkRequest: EnvoyExtAuthzCheckRequest): EnvoyExtAuthzCheckRequest {
  const attributes = checkRequest.attributes ?? {};
  return Object.freeze({
    attributes: Object.freeze({
      ...attributes,
      source: Object.freeze({
        service: attributes.source?.service,
        labels: attributes.source?.labels,
      }),
    }),
  });
}

export function withPath(checkRequest: EnvoyExtAuthzCheckRequest, path: string): EnvoyExtAuthzCheckRequest {
  const attributes = checkRequest.attributes ?? {};
  const request = attributes.request ?? {};
  const http = request.http ?? {};
  return Object.freeze({
    attributes: Object.freeze({
      ...attributes,
      request: Object.freeze({
        ...request,
        http: Object.freeze({
          ...http,
          path,
          headers: Object.freeze({
            ...(http.headers ?? {}),
            ':path': path,
          }),
        }),
      }),
    }),
  });
}

export function withContextExtensions(
  checkRequest: EnvoyExtAuthzCheckRequest,
  extensions: Readonly<Record<string, string>>,
): EnvoyExtAuthzCheckRequest {
  const attributes = checkRequest.attributes ?? {};
  return Object.freeze({
    attributes: Object.freeze({
      ...attributes,
      context_extensions: Object.freeze({
        ...(attributes.context_extensions ?? {}),
        ...extensions,
      }),
    }),
  });
}

export async function dpopHeaders(input: {
  readonly issued: IssuedReleaseToken;
  readonly decision: ReleaseDecision;
  readonly dpopKey: DpopKeyPair;
  readonly checkRequest?: EnvoyExtAuthzCheckRequest;
  readonly nonce?: string;
  readonly proofJti?: string;
  readonly uri?: string;
}) {
  const nonce = input.nonce ?? 'nonce-envoy-ext-authz';
  const proof = await createDpopProof({
    privateJwk: input.dpopKey.privateJwk,
    publicJwk: input.dpopKey.publicJwk,
    httpMethod: 'POST',
    httpUri: input.uri ?? envoyOriginalRequestUri(input.checkRequest ?? BASE_CHECK),
    accessToken: input.issued.token,
    nonce,
    proofJti: input.proofJti ?? 'dpop-proof-envoy-ext-authz',
    issuedAt: '2026-04-18T22:00:10.000Z',
  });

  return {
    headers: {
      authorization: `DPoP ${input.issued.token}`,
      dpop: proof.proofJwt,
      [ATTESTOR_RELEASE_TOKEN_ID_HEADER]: input.issued.tokenId,
      [ATTESTOR_RELEASE_DECISION_ID_HEADER]: input.decision.id,
    },
    nonce,
    proof,
  };
}

export function tokenBindingHeaders(input: {
  readonly issued: IssuedReleaseToken;
  readonly decision: ReleaseDecision;
  readonly binding: ReturnType<typeof buildEnvoyExtAuthzCanonicalBinding>;
}): Readonly<Record<string, string>> {
  return {
    [ATTESTOR_RELEASE_TOKEN_ID_HEADER]: input.issued.tokenId,
    [ATTESTOR_RELEASE_DECISION_ID_HEADER]: input.decision.id,
    [ATTESTOR_TARGET_ID_HEADER]: input.binding.target.id,
    [ATTESTOR_OUTPUT_HASH_HEADER]: input.binding.hashBundle.outputHash,
    [ATTESTOR_CONSEQUENCE_HASH_HEADER]: input.binding.hashBundle.consequenceHash,
  };
}
