import { ATTESTOR_ENFORCEMENT_REQUEST_ID_HEADER } from './middleware.js';
import {
  ATTESTOR_PROXY_ENFORCEMENT_RECEIPT_DIGEST_HEADER,
  ATTESTOR_PROXY_ENFORCEMENT_STATUS_HEADER,
  DEFAULT_ALLOWED_HEADERS,
  ENVOY_EXT_AUTHZ_FILTER_NAME,
  ENVOY_EXT_AUTHZ_TYPE_URL,
  type EnvoyExtAuthzFilterConfigOptions,
  type IstioExtAuthzAuthorizationPolicyOptions,
  type IstioExtAuthzExtensionProviderOptions,
} from './envoy-ext-authz-types.js';

function matcherPatterns(headers: readonly string[]) {
  return Object.freeze(
    headers.map((name) =>
      Object.freeze({
        exact: name,
      }),
    ),
  );
}

export function renderEnvoyExtAuthzHttpFilterConfig(
  options: EnvoyExtAuthzFilterConfigOptions = {},
) {
  return Object.freeze({
    name: ENVOY_EXT_AUTHZ_FILTER_NAME,
    typed_config: Object.freeze({
      '@type': ENVOY_EXT_AUTHZ_TYPE_URL,
      stat_prefix: options.statPrefix ?? 'attestor_release_ext_authz',
      transport_api_version: 'V3',
      grpc_service: Object.freeze({
        envoy_grpc: Object.freeze({
          cluster_name: options.clusterName ?? 'attestor-release-ext-authz',
        }),
        timeout: options.timeout ?? '0.5s',
      }),
      failure_mode_allow: false,
      status_on_error: Object.freeze({
        code: options.statusOnError ?? 503,
      }),
      validate_mutations: true,
      include_peer_certificate: options.includePeerCertificate ?? true,
      include_tls_session: options.includeTlsSession ?? true,
      encode_raw_headers: true,
      with_request_body: Object.freeze({
        max_request_bytes: options.maxRequestBytes ?? 16384,
        allow_partial_message: false,
        pack_as_bytes: true,
      }),
      allowed_headers: Object.freeze({
        patterns: matcherPatterns(options.allowedHeaders ?? DEFAULT_ALLOWED_HEADERS),
      }),
    }),
  });
}

export function renderIstioExtAuthzExtensionProvider(
  options: IstioExtAuthzExtensionProviderOptions,
) {
  const common = Object.freeze({
    service: options.service,
    port: String(options.port),
    includeRequestHeadersInCheck: Object.freeze(
      options.includeRequestHeadersInCheck ?? DEFAULT_ALLOWED_HEADERS,
    ),
    headersToUpstreamOnAllow: Object.freeze(
      options.headersToUpstreamOnAllow ?? [
        ATTESTOR_PROXY_ENFORCEMENT_STATUS_HEADER,
        ATTESTOR_ENFORCEMENT_REQUEST_ID_HEADER,
        ATTESTOR_PROXY_ENFORCEMENT_RECEIPT_DIGEST_HEADER,
      ],
    ),
    headersToDownstreamOnDeny: Object.freeze(
      options.headersToDownstreamOnDeny ?? [
        'content-type',
        'www-authenticate',
        ATTESTOR_PROXY_ENFORCEMENT_STATUS_HEADER,
      ],
    ),
  });

  return Object.freeze({
    name: options.name,
    ...(options.transport === 'http'
      ? { envoyExtAuthzHttp: common }
      : { envoyExtAuthzGrpc: common }),
  });
}

export function renderIstioExtAuthzAuthorizationPolicy(
  options: IstioExtAuthzAuthorizationPolicyOptions,
) {
  return Object.freeze({
    apiVersion: 'security.istio.io/v1',
    kind: 'AuthorizationPolicy',
    metadata: Object.freeze({
      name: options.name,
      ...(options.namespace ? { namespace: options.namespace } : {}),
    }),
    spec: Object.freeze({
      ...(options.selectorLabels
        ? {
            selector: Object.freeze({
              matchLabels: Object.freeze({ ...options.selectorLabels }),
            }),
          }
        : {}),
      action: 'CUSTOM',
      provider: Object.freeze({
        name: options.providerName,
      }),
      rules: Object.freeze([
        Object.freeze({
          to: Object.freeze([
            Object.freeze({
              operation: Object.freeze({
                ...(options.paths ? { paths: Object.freeze([...options.paths]) } : {}),
                ...(options.methods ? { methods: Object.freeze([...options.methods]) } : {}),
              }),
            }),
          ]),
        }),
      ]),
    }),
  });
}
