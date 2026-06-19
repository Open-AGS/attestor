import {
  ATTESTOR_CLIENT_CERTIFICATE_THUMBPRINT_HEADER,
  ATTESTOR_PROXY_ENFORCEMENT_RECEIPT_DIGEST_HEADER,
  ATTESTOR_PROXY_ENFORCEMENT_STATUS_HEADER,
  ATTESTOR_RELEASE_PRESENTATION_MODE_HEADER,
  ENVOY_EXT_AUTHZ_DYNAMIC_METADATA_NAMESPACE,
  ENVOY_EXT_AUTHZ_DEFAULT_RISK_CLASS,
  ENVOY_EXT_AUTHZ_ROUTE_RISK_CLASS_CONTEXT_EXTENSION,
  RELEASE_ENVOY_EXT_AUTHZ_BRIDGE_SPEC_VERSION,
  buildEnvoyExtAuthzCanonicalBinding,
  envoyOriginalRequestUri,
  evaluateEnvoyExternalAuthorization,
  renderEnvoyExtAuthzHttpFilterConfig,
  renderIstioExtAuthzAuthorizationPolicy,
  renderIstioExtAuthzExtensionProvider,
} from '../src/release-enforcement-plane/envoy-ext-authz.js';
import { ATTESTOR_TARGET_ID_HEADER } from '../src/release-enforcement-plane/http-message-signatures.js';
import { ATTESTOR_RELEASE_TOKEN_HEADER } from '../src/release-enforcement-plane/middleware.js';
import { createEnforcementReceiptDigest } from '../src/release-enforcement-plane/object-model.js';
import { dpopReplayKey, generateDpopKeyPair } from '../src/release-enforcement-plane/dpop.js';
import { createMtlsReleaseTokenConfirmation, createSpiffeReleaseTokenConfirmation } from '../src/release-enforcement-plane/workload-binding.js';
import {
  BASE_CHECK,
  CHECKED_AT,
  COMPILED_POLICY_INDEX_VERSION,
  COMPILED_POLICY_IR_VERSION,
  PEER_CERTIFICATE_THUMBPRINT,
  POLICY_HASH,
  POLICY_IR_HASH,
  WORKLOAD_SPIFFE_ID,
  deepEqual,
  dpopHeaders,
  equal,
  issueProxyToken,
  nonceLedgerEntry,
  ok,
  options,
  passedCount,
  register,
  tokenBindingHeaders,
  throws,
  withContextExtensions,
  withHeaders,
  withPath,
  withoutSourceIdentity,
} from './release-enforcement-plane-envoy-ext-authz-fixtures.js';

async function testCanonicalBinding(): Promise<void> {
  const left = buildEnvoyExtAuthzCanonicalBinding(BASE_CHECK);
  const right = buildEnvoyExtAuthzCanonicalBinding(BASE_CHECK);

  equal(left.version, RELEASE_ENVOY_EXT_AUTHZ_BRIDGE_SPEC_VERSION, 'Envoy bridge: binding version is stable');
  equal(left.outputContract.riskClass, ENVOY_EXT_AUTHZ_DEFAULT_RISK_CLASS, 'Envoy bridge: fallback risk class is explicit');
  equal(left.target.id, 'finance.reporting.proxy.prepare-filing', 'Envoy bridge: target comes from context extension');
  equal(left.target.kind, 'endpoint', 'Envoy bridge: proxy target defaults to endpoint');
  equal(left.proxyRequest.method, 'POST', 'Envoy bridge: method is normalized');
  equal(left.proxyRequest.targetUri, 'https://finance.attestor.local/v1/filings/prepare?run=2026-04-18', 'Envoy bridge: original request URI is reconstructed');
  equal(left.proxyRequest.source.principal, WORKLOAD_SPIFFE_ID, 'Envoy bridge: source principal is captured');
  equal(left.proxyRequest.source.certificateThumbprint, PEER_CERTIFICATE_THUMBPRINT, 'Envoy bridge: source certificate thumbprint is derived');
  ok(left.proxyRequest.selectedHeaders.authorization === undefined, 'Envoy bridge: authorization header is excluded from release binding');
  equal(left.hashBundle.outputHash, right.hashBundle.outputHash, 'Envoy bridge: output hash is deterministic');
  equal(left.hashBundle.consequenceHash, right.hashBundle.consequenceHash, 'Envoy bridge: consequence hash is deterministic');
  ok(left.checkHash.startsWith('sha256:'), 'Envoy bridge: check hash is recorded');
}

async function testClientTargetHeaderIsNotTrustedByDefault(): Promise<void> {
  const headerScoped = withHeaders(
    withContextExtensions(BASE_CHECK, { 'attestor.target_id': '' }),
    { [ATTESTOR_TARGET_ID_HEADER]: 'client.supplied.target' },
  );
  const defaultBinding = buildEnvoyExtAuthzCanonicalBinding(headerScoped);
  const explicitOptInBinding = buildEnvoyExtAuthzCanonicalBinding(headerScoped, {
    allowClientTargetHeader: true,
  });

  equal(
    defaultBinding.target.id,
    'finance-gateway.attestor.svc.cluster.local',
    'Envoy bridge: client target header is ignored without explicit opt-in',
  );
  equal(
    explicitOptInBinding.target.id,
    'client.supplied.target',
    'Envoy bridge: client target header requires explicit opt-in',
  );
}

async function testRouteRiskClassMapping(): Promise<void> {
  const routeScoped = buildEnvoyExtAuthzCanonicalBinding(
    withContextExtensions(BASE_CHECK, {
      [ENVOY_EXT_AUTHZ_ROUTE_RISK_CLASS_CONTEXT_EXTENSION]: 'R4',
    }),
  );
  equal(routeScoped.outputContract.riskClass, 'R4', 'Envoy bridge: route context sets risk class');
  equal(
    (routeScoped.consequencePayload as { readonly riskClass?: unknown }).riskClass,
    'R4',
    'Envoy bridge: route risk class binds the consequence payload',
  );

  const explicitOption = buildEnvoyExtAuthzCanonicalBinding(
    withContextExtensions(BASE_CHECK, {
      [ENVOY_EXT_AUTHZ_ROUTE_RISK_CLASS_CONTEXT_EXTENSION]: 'R4',
    }),
    { riskClass: 'R2' },
  );
  equal(explicitOption.outputContract.riskClass, 'R2', 'Envoy bridge: explicit server option overrides route context risk');

  throws(
    () => buildEnvoyExtAuthzCanonicalBinding(
      withContextExtensions(BASE_CHECK, {
        [ENVOY_EXT_AUTHZ_ROUTE_RISK_CLASS_CONTEXT_EXTENSION]: 'R9000',
      }),
    ),
    /route risk class must be one of/u,
  );
}

async function testConfigRendering(): Promise<void> {
  const envoy = renderEnvoyExtAuthzHttpFilterConfig();
  equal(envoy.name, 'envoy.filters.http.ext_authz', 'Envoy bridge: renders ext_authz HTTP filter');
  equal(envoy.typed_config.failure_mode_allow, false, 'Envoy bridge: failure mode is fail closed');
  equal(envoy.typed_config.include_peer_certificate, true, 'Envoy bridge: peer certificate inclusion is enabled');
  equal(envoy.typed_config.include_tls_session, true, 'Envoy bridge: TLS session inclusion is enabled');
  equal(envoy.typed_config.validate_mutations, true, 'Envoy bridge: response mutation validation is enabled');
  equal(envoy.typed_config.status_on_error.code, 503, 'Envoy bridge: control-plane errors surface as unavailable');
  ok(envoy.typed_config.allowed_headers.patterns.some((pattern) => pattern.exact === 'dpop'), 'Envoy bridge: DPoP header is included in checks');
  ok(
    !envoy.typed_config.allowed_headers.patterns.some((pattern) => pattern.exact === ATTESTOR_TARGET_ID_HEADER),
    'Envoy bridge: target ID is not forwarded as a trusted default header',
  );

  const provider = renderIstioExtAuthzExtensionProvider({
    name: 'attestor-release-ext-authz',
    service: 'attestor-release-ext-authz.attestor-system.svc.cluster.local',
    port: 9000,
  });
  equal(provider.name, 'attestor-release-ext-authz', 'Istio bridge: provider name is stable');
  equal(provider.envoyExtAuthzGrpc.service, 'attestor-release-ext-authz.attestor-system.svc.cluster.local', 'Istio bridge: provider service is rendered');
  equal(provider.envoyExtAuthzGrpc.port, '9000', 'Istio bridge: provider port is a string for MeshConfig');
  ok(provider.envoyExtAuthzGrpc.headersToUpstreamOnAllow.includes(ATTESTOR_PROXY_ENFORCEMENT_RECEIPT_DIGEST_HEADER), 'Istio bridge: receipt digest can go upstream on allow');

  const policy = renderIstioExtAuthzAuthorizationPolicy({
    name: 'attestor-release-ext-authz',
    namespace: 'attestor',
    providerName: 'attestor-release-ext-authz',
    selectorLabels: { app: 'finance-gateway' },
    paths: ['/v1/filings/*'],
    methods: ['POST'],
  });
  equal(policy.apiVersion, 'security.istio.io/v1', 'Istio bridge: policy uses stable security API');
  equal(policy.spec.action, 'CUSTOM', 'Istio bridge: policy delegates through CUSTOM action');
  equal(policy.spec.provider.name, 'attestor-release-ext-authz', 'Istio bridge: policy references provider');
  deepEqual(policy.spec.selector?.matchLabels, { app: 'finance-gateway' }, 'Istio bridge: selector labels are preserved');
  deepEqual(policy.spec.rules[0]?.to[0]?.operation.paths, ['/v1/filings/*'], 'Istio bridge: protected paths are rendered');
}

async function testValidDpopProxyCheck(): Promise<void> {
  const dpopKey = await generateDpopKeyPair();
  const { issued, verificationKey, decision } = await issueProxyToken({
    tokenId: 'token-envoy-dpop',
    decisionId: 'decision-envoy-dpop',
    confirmation: { jkt: dpopKey.publicKeyThumbprint },
  });
  const { store, introspector } = register(issued, decision);
  const proof = await dpopHeaders({ issued, decision, dpopKey });
  const checkRequest = withHeaders(BASE_CHECK, proof.headers);

  const result = await evaluateEnvoyExternalAuthorization({
    checkRequest,
    options: options({
      verificationKey,
      introspector,
      store,
      nonce: proof.nonce,
    }),
  });

  equal(result.status, 'allowed', 'Envoy bridge: valid DPoP proxy check is allowed');
  equal(result.checkResponse.status.code, 0, 'Envoy bridge: allowed CheckResponse uses gRPC OK');
  equal(result.httpResponse.status, 200, 'Envoy bridge: HTTP authorization service allows with 200');
  equal(result.presentation?.mode, 'dpop-bound-token', 'Envoy bridge: DPoP proof becomes DPoP presentation');
  equal(result.request?.enforcementPoint.pointKind, 'proxy-ext-authz', 'Envoy bridge: request uses proxy-ext-authz point kind');
  equal(result.request?.enforcementPoint.boundaryKind, 'proxy-admission', 'Envoy bridge: request uses proxy-admission boundary');
  equal(result.online?.consumed, true, 'Envoy bridge: online verifier consumes successful proxy token');
  equal(store.findToken(issued.tokenId)?.status, 'consumed', 'Envoy bridge: token store records consumption');
  ok(result.checkResponse.ok_response?.headers_to_remove?.includes('authorization'), 'Envoy bridge: credentials are stripped before upstream by default');
  ok(result.checkResponse.ok_response?.headers?.some((entry) => entry.header.key === ATTESTOR_PROXY_ENFORCEMENT_STATUS_HEADER), 'Envoy bridge: allow status header is added');
  ok(result.receipt?.receiptDigest?.startsWith('sha256:'), 'Envoy bridge: allowed check has an enforcement receipt digest');
  equal(result.receipt?.policyIrHash, POLICY_IR_HASH, 'Envoy bridge: receipt preserves compiled policy IR provenance');
  equal(result.receipt?.compiledPolicyIrVersion, COMPILED_POLICY_IR_VERSION, 'Envoy bridge: receipt preserves compiled policy IR version');
  deepEqual(
    result.verificationResult?.policyContext,
    {
      policyHash: POLICY_HASH,
      policyVersion: 'policy.release-envoy-ext-authz-test.v1',
      policyIrHash: POLICY_IR_HASH,
      policyProvenanceSource: 'compiled-admission-policy-index',
      compiledPolicyIndexVersion: COMPILED_POLICY_INDEX_VERSION,
      compiledPolicyIrVersion: COMPILED_POLICY_IR_VERSION,
    },
    'Envoy bridge: verification exposes structured policy context',
  );
  deepEqual(
    result.receipt?.policyContext,
    result.verificationResult?.policyContext,
    'Envoy bridge: receipt carries the verified structured policy context',
  );
  equal(
    result.receipt?.receiptDigest,
    result.decision ? createEnforcementReceiptDigest({ decision: result.decision }) : null,
    'Envoy bridge: receipt digest binds structured policy context',
  );
  if (!result.decision) {
    throw new Error('Expected Envoy allow result to carry an enforcement decision.');
  }
  const tamperedPolicyDecision = {
    ...result.decision,
    verification: {
      ...result.decision.verification,
      policyContext: {
        ...result.decision.verification.policyContext,
        compiledPolicyIrVersion: 'attestor.policy-ir.tampered.v1',
      },
    },
  };
  ok(
    createEnforcementReceiptDigest({ decision: tamperedPolicyDecision }) !== result.receipt?.receiptDigest,
    'Envoy bridge: changing structured policy context changes receipt digest',
  );
  ok(Boolean(result.checkResponse.dynamic_metadata?.[ENVOY_EXT_AUTHZ_DYNAMIC_METADATA_NAMESPACE]), 'Envoy bridge: dynamic metadata is populated');
}

async function testValidSpiffeProxyCheck(): Promise<void> {
  const { issued, verificationKey, decision } = await issueProxyToken({
    tokenId: 'token-envoy-spiffe',
    decisionId: 'decision-envoy-spiffe',
    confirmation: createSpiffeReleaseTokenConfirmation({
      spiffeId: WORKLOAD_SPIFFE_ID,
      certificateThumbprint: PEER_CERTIFICATE_THUMBPRINT,
    }),
  });
  const { store, introspector } = register(issued, decision);
  const binding = buildEnvoyExtAuthzCanonicalBinding(BASE_CHECK);
  const checkRequest = withHeaders(BASE_CHECK, {
    authorization: `Bearer ${issued.token}`,
    [ATTESTOR_RELEASE_PRESENTATION_MODE_HEADER]: 'spiffe-bound-token',
    ...tokenBindingHeaders({ issued, decision, binding }),
  });

  const result = await evaluateEnvoyExternalAuthorization({
    checkRequest,
    options: options({ verificationKey, introspector, store }),
  });

  equal(result.status, 'allowed', 'Envoy bridge: valid SPIFFE proxy check is allowed');
  equal(result.presentation?.mode, 'spiffe-bound-token', 'Envoy bridge: SPIFFE principal becomes SPIFFE presentation');
  equal(result.presentation?.proof?.kind, 'spiffe', 'Envoy bridge: SPIFFE proof is attached');
  equal(result.responseStatus, 200, 'Envoy bridge: SPIFFE allow response is 200');
  equal(result.online?.active, true, 'Envoy bridge: SPIFFE token is active at introspection');
}

async function testValidMtlsProxyCheck(): Promise<void> {
  const mtlsCheck = withHeaders(BASE_CHECK, {
    [ATTESTOR_CLIENT_CERTIFICATE_THUMBPRINT_HEADER]: PEER_CERTIFICATE_THUMBPRINT,
  });
  const { issued, verificationKey, decision, binding } = await issueProxyToken({
    tokenId: 'token-envoy-mtls',
    decisionId: 'decision-envoy-mtls',
    checkRequest: mtlsCheck,
    confirmation: createMtlsReleaseTokenConfirmation({
      certificateThumbprint: PEER_CERTIFICATE_THUMBPRINT,
      spiffeId: WORKLOAD_SPIFFE_ID,
    }),
  });
  const { store, introspector } = register(issued, decision);
  const checkRequest = withHeaders(mtlsCheck, {
    authorization: `Bearer ${issued.token}`,
    [ATTESTOR_RELEASE_PRESENTATION_MODE_HEADER]: 'mtls-bound-token',
    ...tokenBindingHeaders({ issued, decision, binding }),
  });

  const result = await evaluateEnvoyExternalAuthorization({
    checkRequest,
    options: options({ verificationKey, introspector, store }),
  });

  equal(result.status, 'allowed', 'Envoy bridge: valid mTLS proxy check is allowed');
  equal(result.presentation?.mode, 'mtls-bound-token', 'Envoy bridge: mTLS thumbprint becomes mTLS presentation');
  equal(result.presentation?.proof?.kind, 'mtls', 'Envoy bridge: mTLS proof is attached');
  equal(result.responseStatus, 200, 'Envoy bridge: mTLS allow response is 200');
}

async function testMissingAuthorizationFailsClosed(): Promise<void> {
  const { verificationKey } = await issueProxyToken({
    tokenId: 'token-envoy-missing',
    decisionId: 'decision-envoy-missing',
  });
  const result = await evaluateEnvoyExternalAuthorization({
    checkRequest: BASE_CHECK,
    options: options({ verificationKey }),
  });

  equal(result.status, 'denied', 'Envoy bridge: missing authorization is denied');
  equal(result.responseStatus, 401, 'Envoy bridge: missing authorization maps to 401');
  equal(result.checkResponse.status.code, 16, 'Envoy bridge: missing authorization maps to gRPC unauthenticated');
  deepEqual(result.failureReasons, ['missing-release-authorization'], 'Envoy bridge: missing authorization reason is stable');
  ok(Boolean(result.httpResponse.headers['www-authenticate']), 'Envoy bridge: deny response includes WWW-Authenticate');
}

async function testBearerDowngradeFailsClosed(): Promise<void> {
  const { issued, verificationKey, decision, binding } = await issueProxyToken({
    tokenId: 'token-envoy-bearer',
    decisionId: 'decision-envoy-bearer',
  });
  const { store, introspector } = register(issued, decision);
  const checkRequest = withHeaders(withoutSourceIdentity(BASE_CHECK), {
    authorization: `Bearer ${issued.token}`,
    ...tokenBindingHeaders({ issued, decision, binding }),
  });

  const result = await evaluateEnvoyExternalAuthorization({
    checkRequest,
    options: options({ verificationKey, introspector, store }),
  });

  equal(result.status, 'denied', 'Envoy bridge: bearer downgrade is denied by default');
  equal(result.responseStatus, 403, 'Envoy bridge: bearer downgrade maps to 403');
  deepEqual(result.failureReasons, ['binding-mismatch'], 'Envoy bridge: bearer downgrade maps to binding mismatch');
  equal(store.findToken(issued.tokenId)?.status, 'issued', 'Envoy bridge: denied bearer token is not consumed');
}

async function testAmbiguousAuthorizationCredentialFailsClosed(): Promise<void> {
  const { issued, verificationKey, decision, binding } = await issueProxyToken({
    tokenId: 'token-envoy-ambiguous-auth',
    decisionId: 'decision-envoy-ambiguous-auth',
  });
  const { store, introspector } = register(issued, decision);
  const checkRequest = withHeaders(BASE_CHECK, {
    authorization: `Bearer ${issued.token}, Bearer ${issued.token}`,
    ...tokenBindingHeaders({ issued, decision, binding }),
  });

  const result = await evaluateEnvoyExternalAuthorization({
    checkRequest,
    options: options({ verificationKey, introspector, store }),
  });

  equal(result.status, 'denied', 'Envoy bridge: combined Authorization credentials are denied');
  equal(result.responseStatus, 401, 'Envoy bridge: combined Authorization maps to missing authorization');
  deepEqual(
    result.failureReasons,
    ['missing-release-authorization'],
    'Envoy bridge: combined Authorization is not parsed as a release credential',
  );
  equal(store.findToken(issued.tokenId)?.status, 'issued', 'Envoy bridge: ambiguous authorization is not consumed');
}

async function testChangedPathFailsBinding(): Promise<void> {
  const dpopKey = await generateDpopKeyPair();
  const { issued, verificationKey, decision } = await issueProxyToken({
    tokenId: 'token-envoy-path',
    decisionId: 'decision-envoy-path',
    confirmation: { jkt: dpopKey.publicKeyThumbprint },
  });
  const { store, introspector } = register(issued, decision);
  const changed = withPath(BASE_CHECK, '/v1/filings/submit?run=2026-04-18');
  const proof = await dpopHeaders({
    issued,
    decision,
    dpopKey,
    checkRequest: changed,
    nonce: 'nonce-envoy-path',
    proofJti: 'dpop-proof-envoy-path',
  });
  const checkRequest = withHeaders(changed, proof.headers);

  const result = await evaluateEnvoyExternalAuthorization({
    checkRequest,
    options: options({
      verificationKey,
      introspector,
      store,
      nonce: proof.nonce,
    }),
  });

  equal(result.status, 'denied', 'Envoy bridge: changed route path is denied');
  equal(result.responseStatus, 403, 'Envoy bridge: changed route path maps to 403');
  ok(result.failureReasons.includes('binding-mismatch'), 'Envoy bridge: changed route path maps to binding mismatch');
  equal(store.findToken(issued.tokenId)?.status, 'issued', 'Envoy bridge: mismatched token is not consumed');
}

async function testWrongDpopUriFails(): Promise<void> {
  const dpopKey = await generateDpopKeyPair();
  const { issued, verificationKey, decision } = await issueProxyToken({
    tokenId: 'token-envoy-wrong-dpop',
    decisionId: 'decision-envoy-wrong-dpop',
    confirmation: { jkt: dpopKey.publicKeyThumbprint },
  });
  const { store, introspector } = register(issued, decision);
  const proof = await dpopHeaders({
    issued,
    decision,
    dpopKey,
    nonce: 'nonce-envoy-wrong-dpop',
    proofJti: 'dpop-proof-envoy-wrong-dpop',
    uri: 'https://finance.attestor.local/v1/other',
  });
  const checkRequest = withHeaders(BASE_CHECK, proof.headers);

  const result = await evaluateEnvoyExternalAuthorization({
    checkRequest,
    options: options({
      verificationKey,
      introspector,
      store,
      nonce: proof.nonce,
    }),
  });

  equal(result.status, 'denied', 'Envoy bridge: DPoP htu mismatch is denied');
  equal(result.responseStatus, 403, 'Envoy bridge: DPoP htu mismatch maps to 403');
  deepEqual(result.failureReasons, ['binding-mismatch'], 'Envoy bridge: DPoP htu mismatch maps to binding mismatch');
  equal(result.presentation, null, 'Envoy bridge: invalid DPoP proof does not become a presentation');
}

async function testOfflineModeRequiresFreshIntrospection(): Promise<void> {
  const dpopKey = await generateDpopKeyPair();
  const { issued, verificationKey, decision } = await issueProxyToken({
    tokenId: 'token-envoy-offline',
    decisionId: 'decision-envoy-offline',
    confirmation: { jkt: dpopKey.publicKeyThumbprint },
  });
  const proof = await dpopHeaders({
    issued,
    decision,
    dpopKey,
    nonce: 'nonce-envoy-offline',
    proofJti: 'dpop-proof-envoy-offline',
  });
  const checkRequest = withHeaders(BASE_CHECK, proof.headers);

  const result = await evaluateEnvoyExternalAuthorization({
    checkRequest,
    options: options({
      verificationKey,
      verifierMode: 'offline',
      nonce: proof.nonce,
    }),
  });

  equal(result.status, 'denied', 'Envoy bridge: offline high-risk proxy check is denied');
  equal(result.responseStatus, 428, 'Envoy bridge: offline high-risk proxy check requires fresh introspection');
  deepEqual(result.failureReasons, ['fresh-introspection-required'], 'Envoy bridge: offline path reports fresh introspection requirement');
  equal(result.checkResponse.status.code, 9, 'Envoy bridge: fresh introspection requirement maps to gRPC failed precondition');
}

async function testRevokedTokenFails(): Promise<void> {
  const dpopKey = await generateDpopKeyPair();
  const { issued, verificationKey, decision } = await issueProxyToken({
    tokenId: 'token-envoy-revoked',
    decisionId: 'decision-envoy-revoked',
    confirmation: { jkt: dpopKey.publicKeyThumbprint },
  });
  const { store, introspector } = register(issued, decision);
  store.revokeToken({
    tokenId: issued.tokenId,
    revokedAt: '2026-04-18T22:00:05.000Z',
    reason: 'test revocation',
    revokedBy: 'release-authority',
  });
  const proof = await dpopHeaders({
    issued,
    decision,
    dpopKey,
    nonce: 'nonce-envoy-revoked',
    proofJti: 'dpop-proof-envoy-revoked',
  });
  const checkRequest = withHeaders(BASE_CHECK, proof.headers);

  const result = await evaluateEnvoyExternalAuthorization({
    checkRequest,
    options: options({
      verificationKey,
      introspector,
      store,
      nonce: proof.nonce,
    }),
  });

  equal(result.status, 'denied', 'Envoy bridge: revoked token is denied');
  equal(result.responseStatus, 403, 'Envoy bridge: revoked token maps to 403');
  deepEqual(result.failureReasons, ['revoked-authorization', 'negative-cache-hit'], 'Envoy bridge: revoked token reason is stable');
}

async function testIntrospectionUnavailableFailsClosed(): Promise<void> {
  const dpopKey = await generateDpopKeyPair();
  const { issued, verificationKey, decision } = await issueProxyToken({
    tokenId: 'token-envoy-unavailable',
    decisionId: 'decision-envoy-unavailable',
    confirmation: { jkt: dpopKey.publicKeyThumbprint },
  });
  const proof = await dpopHeaders({
    issued,
    decision,
    dpopKey,
    nonce: 'nonce-envoy-unavailable',
    proofJti: 'dpop-proof-envoy-unavailable',
  });
  const checkRequest = withHeaders(BASE_CHECK, proof.headers);

  const result = await evaluateEnvoyExternalAuthorization({
    checkRequest,
    options: options({
      verificationKey,
      nonce: proof.nonce,
    }),
  });

  equal(result.status, 'denied', 'Envoy bridge: missing introspector is denied');
  equal(result.responseStatus, 503, 'Envoy bridge: missing introspector maps to 503');
  deepEqual(result.failureReasons, ['introspection-unavailable'], 'Envoy bridge: missing introspector reason is stable');
  equal(result.checkResponse.status.code, 14, 'Envoy bridge: missing introspector maps to gRPC unavailable');
}

async function testReplayFailsClosed(): Promise<void> {
  const dpopKey = await generateDpopKeyPair();
  const { issued, verificationKey, decision } = await issueProxyToken({
    tokenId: 'token-envoy-replay',
    decisionId: 'decision-envoy-replay',
    confirmation: { jkt: dpopKey.publicKeyThumbprint },
  });
  const { store, introspector } = register(issued, decision);
  const proofJti = 'dpop-proof-envoy-replay';
  const proof = await dpopHeaders({
    issued,
    decision,
    dpopKey,
    nonce: 'nonce-envoy-replay',
    proofJti,
  });
  const checkRequest = withHeaders(BASE_CHECK, proof.headers);

  const result = await evaluateEnvoyExternalAuthorization({
    checkRequest,
    options: options({
      verificationKey,
      introspector,
      store,
      nonce: proof.nonce,
      replayLedgerEntry: {
        subjectKind: 'dpop-proof',
        key: dpopReplayKey(proofJti),
        firstSeenAt: '2026-04-18T22:00:11.000Z',
        expiresAt: '2026-04-18T22:01:20.000Z',
      },
    }),
  });

  equal(result.status, 'denied', 'Envoy bridge: replayed DPoP proof is denied');
  equal(result.responseStatus, 409, 'Envoy bridge: replayed DPoP proof maps to 409');
  deepEqual(result.failureReasons, ['replayed-authorization'], 'Envoy bridge: replay reason is stable');
  equal(result.checkResponse.status.code, 10, 'Envoy bridge: replay maps to gRPC aborted');
}

async function testMalformedCheckFailsClosed(): Promise<void> {
  const { verificationKey } = await issueProxyToken({
    tokenId: 'token-envoy-malformed',
    decisionId: 'decision-envoy-malformed',
  });
  const result = await evaluateEnvoyExternalAuthorization({
    checkRequest: { attributes: { request: {} } },
    options: options({ verificationKey }),
  });

  equal(result.status, 'denied', 'Envoy bridge: malformed check request is denied');
  equal(result.responseStatus, 403, 'Envoy bridge: malformed check request maps to 403');
  deepEqual(result.failureReasons, ['binding-mismatch'], 'Envoy bridge: malformed check request maps to binding mismatch');
  equal(result.binding, null, 'Envoy bridge: malformed check request has no binding');
}

async function run(): Promise<void> {
  await testCanonicalBinding();
  await testClientTargetHeaderIsNotTrustedByDefault();
  await testRouteRiskClassMapping();
  await testConfigRendering();
  await testValidDpopProxyCheck();
  await testValidSpiffeProxyCheck();
  await testValidMtlsProxyCheck();
  await testMissingAuthorizationFailsClosed();
  await testBearerDowngradeFailsClosed();
  await testAmbiguousAuthorizationCredentialFailsClosed();
  await testChangedPathFailsBinding();
  await testWrongDpopUriFails();
  await testOfflineModeRequiresFreshIntrospection();
  await testRevokedTokenFails();
  await testIntrospectionUnavailableFailsClosed();
  await testReplayFailsClosed();
  await testMalformedCheckFailsClosed();

  console.log(`Release enforcement-plane Envoy ext_authz tests: ${passedCount()} passed, 0 failed`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
