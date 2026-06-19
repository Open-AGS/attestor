import type {
  ReleaseTokenIntrospectionStore,
  ReleaseTokenIntrospector,
} from '../release-kernel/release-introspection.js';
import type { ReleaseTokenVerificationKey } from '../release-kernel/release-token.js';
import type {
  CanonicalReleaseHashBundle,
  CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type { ReleaseTargetReference } from '../release-kernel/object-model.js';
import type { OutputContractDescriptor } from '../release-kernel/types.js';
import type {
  EnforcementDecision,
  EnforcementReceipt,
  EnforcementRequest,
  ReleasePresentation,
  VerificationResult,
} from './object-model.js';
import type { OfflineReleaseVerification } from './offline-verifier.js';
import type { OnlineReleaseVerification } from './online-verifier.js';
import {
  ATTESTOR_CONSEQUENCE_HASH_HEADER,
  ATTESTOR_OUTPUT_HASH_HEADER,
  ATTESTOR_RELEASE_DECISION_ID_HEADER,
  ATTESTOR_RELEASE_TOKEN_DIGEST_HEADER,
  ATTESTOR_RELEASE_TOKEN_ID_HEADER,
  ATTESTOR_TARGET_ID_HEADER,
} from './http-message-signatures.js';
import {
  ATTESTOR_ENFORCEMENT_REQUEST_ID_HEADER,
  ATTESTOR_IDEMPOTENCY_KEY_HEADER,
  ATTESTOR_RELEASE_TOKEN_HEADER,
} from './middleware.js';
import type { NonceLedgerEntry, ReplayLedgerEntry } from './freshness.js';
import type {
  EnforcementFailureReason,
  ReleaseEnforcementConsequenceType,
  ReleaseEnforcementRiskClass,
} from './types.js';

export const RELEASE_ENVOY_EXT_AUTHZ_BRIDGE_SPEC_VERSION =
  'attestor.release-enforcement-envoy-ext-authz.v1';
export const ENVOY_EXT_AUTHZ_OUTPUT_ARTIFACT_TYPE =
  'attestor.envoy-ext-authz.check-request';
export const ENVOY_EXT_AUTHZ_OUTPUT_EXPECTED_SHAPE =
  'canonical proxy admission check';
export const ENVOY_EXT_AUTHZ_DEFAULT_VERIFIER_MODE = 'online';
export const ENVOY_EXT_AUTHZ_DEFAULT_CONSEQUENCE_TYPE = 'action';
export const ENVOY_EXT_AUTHZ_DEFAULT_RISK_CLASS = 'R3';
export const ENVOY_EXT_AUTHZ_ROUTE_RISK_CLASS_CONTEXT_EXTENSION =
  'attestor.risk_class';
export const ENVOY_EXT_AUTHZ_FILTER_NAME = 'envoy.filters.http.ext_authz';
export const ENVOY_EXT_AUTHZ_TYPE_URL =
  'type.googleapis.com/envoy.extensions.filters.http.ext_authz.v3.ExtAuthz';
export const ENVOY_EXT_AUTHZ_DYNAMIC_METADATA_NAMESPACE =
  'attestor.release_enforcement';
export const ATTESTOR_PROXY_ENFORCEMENT_STATUS_HEADER =
  'x-attestor-proxy-enforcement-status';
export const ATTESTOR_PROXY_ENFORCEMENT_RECEIPT_DIGEST_HEADER =
  'attestor-enforcement-receipt-digest';
export const ATTESTOR_RELEASE_PRESENTATION_MODE_HEADER =
  'attestor-release-presentation-mode';
export const ATTESTOR_CLIENT_CERTIFICATE_THUMBPRINT_HEADER =
  'attestor-client-certificate-thumbprint';

export type EnvoyExtAuthzBridgeStatus = 'allowed' | 'denied';
export type EnvoyExtAuthzBridgeVerifierMode = 'offline' | 'online';
export type EnvoyExtAuthzTransportMode = 'grpc' | 'http';
export type EnvoyExtAuthzHeaderValue =
  | string
  | readonly string[]
  | Uint8Array
  | Buffer
  | null
  | undefined;

export interface EnvoyExtAuthzAddress {
  readonly socket_address?: {
    readonly address?: string;
    readonly port_value?: number;
  };
  readonly pipe?: {
    readonly path?: string;
  };
}

export interface EnvoyExtAuthzPeer {
  readonly address?: EnvoyExtAuthzAddress;
  readonly service?: string;
  readonly labels?: Readonly<Record<string, string>>;
  readonly principal?: string;
  readonly certificate?: string;
}

export interface EnvoyExtAuthzHeaderMapEntry {
  readonly key: string;
  readonly value?: string;
  readonly raw_value?: string | Uint8Array | Buffer;
}

export interface EnvoyExtAuthzHeaderMap {
  readonly headers?: readonly EnvoyExtAuthzHeaderMapEntry[];
}

export interface EnvoyExtAuthzHttpRequestAttributes {
  readonly id?: string;
  readonly method?: string;
  readonly headers?: Readonly<Record<string, EnvoyExtAuthzHeaderValue>>;
  readonly header_map?: EnvoyExtAuthzHeaderMap;
  readonly path?: string;
  readonly host?: string;
  readonly scheme?: string;
  readonly query?: string;
  readonly fragment?: string;
  readonly size?: number | string;
  readonly protocol?: string;
  readonly body?: string;
  readonly raw_body?: string | Uint8Array | Buffer;
}

export interface EnvoyExtAuthzRequestAttributes {
  readonly time?: string;
  readonly http?: EnvoyExtAuthzHttpRequestAttributes;
}

export type EnvoyExtAuthzMetadata =
  Readonly<Record<string, unknown>>;

export interface EnvoyExtAuthzAttributeContext {
  readonly source?: EnvoyExtAuthzPeer;
  readonly destination?: EnvoyExtAuthzPeer;
  readonly request?: EnvoyExtAuthzRequestAttributes;
  readonly context_extensions?: Readonly<Record<string, string>>;
  readonly metadata_context?: EnvoyExtAuthzMetadata;
  readonly route_metadata_context?: EnvoyExtAuthzMetadata;
  readonly tls_session?: {
    readonly sni?: string;
  };
}

export interface EnvoyExtAuthzCheckRequest {
  readonly attributes?: EnvoyExtAuthzAttributeContext;
}

export interface EnvoyExtAuthzProxyRequestCanonical {
  readonly requestId: string | null;
  readonly method: string;
  readonly scheme: string;
  readonly host: string;
  readonly path: string;
  readonly targetUri: string;
  readonly protocol: string | null;
  readonly bodyDigest: string | null;
  readonly selectedHeaders: Readonly<Record<string, string>>;
  readonly source: {
    readonly service: string | null;
    readonly principal: string | null;
    readonly certificateThumbprint: string | null;
    readonly labels: Readonly<Record<string, string>>;
  };
  readonly destination: {
    readonly service: string | null;
    readonly host: string | null;
    readonly sni: string | null;
    readonly labels: Readonly<Record<string, string>>;
  };
  readonly route: {
    readonly contextExtensions: Readonly<Record<string, string>>;
    readonly metadataDigest: string | null;
    readonly routeMetadataDigest: string | null;
  };
}

export interface EnvoyExtAuthzCanonicalBindingOptions {
  readonly targetId?: string | null;
  readonly targetKind?: ReleaseTargetReference['kind'];
  readonly riskClass?: ReleaseEnforcementRiskClass;
  readonly consequenceType?: ReleaseEnforcementConsequenceType;
  readonly includeHeaders?: readonly string[];
  readonly allowClientTargetHeader?: boolean;
}

export interface EnvoyExtAuthzCanonicalBinding {
  readonly version: typeof RELEASE_ENVOY_EXT_AUTHZ_BRIDGE_SPEC_VERSION;
  readonly target: ReleaseTargetReference;
  readonly outputContract: OutputContractDescriptor;
  readonly outputPayload: CanonicalReleaseJsonValue;
  readonly consequencePayload: CanonicalReleaseJsonValue;
  readonly hashBundle: CanonicalReleaseHashBundle;
  readonly proxyRequest: EnvoyExtAuthzProxyRequestCanonical;
  readonly checkCanonical: string;
  readonly checkHash: string;
  readonly headersDigest: string;
  readonly bodyDigest: string | null;
}

export interface EnvoyExtAuthzBridgeOptions {
  readonly verificationKey: ReleaseTokenVerificationKey;
  readonly enforcementPointId: string;
  readonly environment: string;
  readonly tenantId?: string | null;
  readonly accountId?: string | null;
  readonly workloadId?: string | null;
  readonly targetId?: string | null;
  readonly riskClass?: ReleaseEnforcementRiskClass;
  readonly consequenceType?: ReleaseEnforcementConsequenceType;
  readonly verifierMode?: EnvoyExtAuthzBridgeVerifierMode;
  readonly introspector?: ReleaseTokenIntrospector;
  readonly usageStore?: ReleaseTokenIntrospectionStore;
  readonly consumeOnSuccess?: boolean;
  readonly forceOnlineIntrospection?: boolean;
  readonly allowBearerFallback?: boolean;
  readonly replayLedgerEntry?: ReplayLedgerEntry | null;
  readonly nonceLedgerEntry?: NonceLedgerEntry | null;
  readonly now?: () => string;
  readonly requestId?: string;
  readonly traceId?: string | null;
  readonly removeCredentialsOnAllow?: boolean;
}

export interface EnvoyExtAuthzBridgeInput {
  readonly checkRequest: EnvoyExtAuthzCheckRequest;
  readonly options: EnvoyExtAuthzBridgeOptions;
}

export interface EnvoyExtAuthzHeaderValueOption {
  readonly header: {
    readonly key: string;
    readonly value: string;
  };
  readonly append?: boolean;
}

export interface EnvoyExtAuthzCheckResponse {
  readonly status: {
    readonly code: number;
    readonly message?: string;
  };
  readonly ok_response?: {
    readonly headers?: readonly EnvoyExtAuthzHeaderValueOption[];
    readonly headers_to_remove?: readonly string[];
    readonly dynamic_metadata?: EnvoyExtAuthzMetadata;
    readonly response_headers_to_add?: readonly EnvoyExtAuthzHeaderValueOption[];
  };
  readonly denied_response?: {
    readonly status: {
      readonly code: number;
    };
    readonly headers?: readonly EnvoyExtAuthzHeaderValueOption[];
    readonly body?: string;
  };
  readonly error_response?: {
    readonly status: {
      readonly code: number;
    };
    readonly headers?: readonly EnvoyExtAuthzHeaderValueOption[];
    readonly body?: string;
  };
  readonly dynamic_metadata?: EnvoyExtAuthzMetadata;
}

export interface EnvoyExtAuthzHttpServiceResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
}

export interface EnvoyExtAuthzBridgeResult {
  readonly version: typeof RELEASE_ENVOY_EXT_AUTHZ_BRIDGE_SPEC_VERSION;
  readonly status: EnvoyExtAuthzBridgeStatus;
  readonly checkedAt: string;
  readonly binding: EnvoyExtAuthzCanonicalBinding | null;
  readonly request: EnforcementRequest | null;
  readonly presentation: ReleasePresentation | null;
  readonly verificationResult: VerificationResult | null;
  readonly offline: OfflineReleaseVerification | null;
  readonly online: OnlineReleaseVerification | null;
  readonly decision: EnforcementDecision | null;
  readonly receipt: EnforcementReceipt | null;
  readonly failureReasons: readonly EnforcementFailureReason[];
  readonly responseStatus: number;
  readonly checkResponse: EnvoyExtAuthzCheckResponse;
  readonly httpResponse: EnvoyExtAuthzHttpServiceResponse;
}

export interface EnvoyExtAuthzFilterConfigOptions {
  readonly clusterName?: string;
  readonly statPrefix?: string;
  readonly timeout?: string;
  readonly maxRequestBytes?: number;
  readonly includePeerCertificate?: boolean;
  readonly includeTlsSession?: boolean;
  readonly statusOnError?: number;
  readonly allowedHeaders?: readonly string[];
}

export interface IstioExtAuthzExtensionProviderOptions {
  readonly name: string;
  readonly service: string;
  readonly port: number | string;
  readonly transport?: EnvoyExtAuthzTransportMode;
  readonly includeRequestHeadersInCheck?: readonly string[];
  readonly headersToUpstreamOnAllow?: readonly string[];
  readonly headersToDownstreamOnDeny?: readonly string[];
}

export interface IstioExtAuthzAuthorizationPolicyOptions {
  readonly name: string;
  readonly namespace?: string;
  readonly providerName: string;
  readonly selectorLabels?: Readonly<Record<string, string>>;
  readonly paths?: readonly string[];
  readonly methods?: readonly string[];
}

export const GRPC_STATUS_OK = 0;
export const GRPC_STATUS_ABORTED = 10;
export const GRPC_STATUS_FAILED_PRECONDITION = 9;
export const GRPC_STATUS_PERMISSION_DENIED = 7;
export const GRPC_STATUS_UNAUTHENTICATED = 16;
export const GRPC_STATUS_UNAVAILABLE = 14;

export const DEFAULT_ALLOWED_HEADERS = Object.freeze([
  'authorization',
  'dpop',
  ATTESTOR_RELEASE_TOKEN_HEADER,
  ATTESTOR_RELEASE_PRESENTATION_MODE_HEADER,
  ATTESTOR_RELEASE_TOKEN_DIGEST_HEADER,
  ATTESTOR_RELEASE_TOKEN_ID_HEADER,
  ATTESTOR_RELEASE_DECISION_ID_HEADER,
  ATTESTOR_OUTPUT_HASH_HEADER,
  ATTESTOR_CONSEQUENCE_HASH_HEADER,
  ATTESTOR_IDEMPOTENCY_KEY_HEADER,
  ATTESTOR_ENFORCEMENT_REQUEST_ID_HEADER,
  ATTESTOR_CLIENT_CERTIFICATE_THUMBPRINT_HEADER,
  'x-request-id',
  'traceparent',
] as const);

export const SENSITIVE_BINDING_HEADERS = new Set([
  'authorization',
  'dpop',
  'cookie',
  'set-cookie',
  ATTESTOR_RELEASE_TOKEN_HEADER,
  ATTESTOR_RELEASE_PRESENTATION_MODE_HEADER,
  ATTESTOR_RELEASE_TOKEN_DIGEST_HEADER,
  ATTESTOR_RELEASE_TOKEN_ID_HEADER,
  ATTESTOR_RELEASE_DECISION_ID_HEADER,
  ATTESTOR_TARGET_ID_HEADER,
  ATTESTOR_OUTPUT_HASH_HEADER,
  ATTESTOR_CONSEQUENCE_HASH_HEADER,
]);
