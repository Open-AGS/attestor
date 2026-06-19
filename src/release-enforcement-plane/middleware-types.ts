import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http';
import type {
  ReleaseTokenIntrospectionStore,
  ReleaseTokenIntrospector,
} from '../release-kernel/release-introspection.js';
import type { ReleasePolicyProvenanceSource } from '../release-kernel/object-model.js';
import type { ReleaseTokenVerificationKey } from '../release-kernel/release-token.js';
import type {
  CreateEnforcementPointReferenceInput,
  EnforcementFailureReason,
} from './types.js';
import type {
  EnforcementRequest,
  ReleasePresentation,
  VerificationResult,
} from './object-model.js';
import type {
  OfflineReleaseVerification,
  OfflineReleaseVerificationInput,
} from './offline-verifier.js';
import type {
  OnlineReleaseVerification,
  OnlineReleaseVerificationInput,
} from './online-verifier.js';
import type {
  NonceLedgerEntry,
  ReplayLedgerEntry,
} from './freshness.js';

export const RELEASE_ENFORCEMENT_MIDDLEWARE_SPEC_VERSION =
  'attestor.release-enforcement-middleware.v1';
export const HONO_RELEASE_ENFORCEMENT_CONTEXT_KEY = 'releaseEnforcement';
export const ATTESTOR_IDEMPOTENCY_KEY_HEADER = 'attestor-idempotency-key';
export const ATTESTOR_RELEASE_TOKEN_HEADER = 'attestor-release-token';
export const ATTESTOR_ENFORCEMENT_REQUEST_ID_HEADER = 'attestor-enforcement-request-id';
export const ATTESTOR_ENFORCEMENT_STATUS_HEADER = 'x-attestor-enforcement-status';
export const DEFAULT_PROTECTED_HTTP_METHODS = Object.freeze([
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
] as const);

export type ReleaseEnforcementMiddlewareStatus = 'allowed' | 'denied' | 'skipped';
export type ReleaseEnforcementMiddlewareVerifierMode = 'offline' | 'online';
export type ReleaseEnforcementMiddlewareBindingHeaderMode = 'disabled' | 'trusted-upstream';

export interface ReleaseEnforcementMiddlewareMethodCoverageProof {
  readonly proofRef: string;
  readonly readOnlyRoutesOnly: true;
}

export interface ReleaseEnforcementMiddlewareTrustedUpstreamProof {
  readonly proofRef: string;
  readonly nonBypassableUpstream: true;
  readonly stripsClientAttestorHeaders: true;
  readonly derivesBodyDigestFromRequest: true;
  readonly signedBindingEnvelope?: true;
}

export interface ReleaseEnforcementHttpRequest {
  readonly method: string;
  readonly url: string;
  readonly headers: Headers | IncomingHttpHeaders | Readonly<Record<string, string | readonly string[] | undefined>>;
}

export interface ReleaseEnforcementHttpContext {
  readonly request: ReleaseEnforcementHttpRequest;
  readonly checkedAt: string;
  readonly framework: 'hono' | 'node' | 'custom';
  readonly frameworkContext?: unknown;
}

export type ReleaseEnforcementResolver<T> =
  | T
  | ((context: ReleaseEnforcementHttpContext) => T | Promise<T>);

export interface ReleaseEnforcementMiddlewareResult {
  readonly version: typeof RELEASE_ENFORCEMENT_MIDDLEWARE_SPEC_VERSION;
  readonly status: ReleaseEnforcementMiddlewareStatus;
  readonly checkedAt: string;
  readonly request: EnforcementRequest | null;
  readonly presentation: ReleasePresentation | null;
  readonly verificationResult: VerificationResult | null;
  readonly offline: OfflineReleaseVerification | null;
  readonly online: OnlineReleaseVerification | null;
  readonly failureReasons: readonly EnforcementFailureReason[];
  readonly responseStatus: number | null;
}

export interface ReleaseEnforcementDeniedBody {
  readonly version: typeof RELEASE_ENFORCEMENT_MIDDLEWARE_SPEC_VERSION;
  readonly status: 'denied';
  readonly checkedAt: string;
  readonly failureReasons: readonly EnforcementFailureReason[];
  readonly verificationStatus: VerificationResult['status'] | null;
  readonly requestId: string | null;
}

export interface ReleaseEnforcementMiddlewareOptions {
  readonly verificationKey: ReleaseEnforcementResolver<ReleaseTokenVerificationKey>;
  readonly enforcementPoint: ReleaseEnforcementResolver<CreateEnforcementPointReferenceInput>;
  readonly verifierMode?: ReleaseEnforcementMiddlewareVerifierMode;
  readonly introspector?: ReleaseEnforcementResolver<ReleaseTokenIntrospector | undefined>;
  readonly usageStore?: ReleaseEnforcementResolver<ReleaseTokenIntrospectionStore | undefined>;
  readonly consumeOnSuccess?: boolean;
  readonly forceOnlineIntrospection?: boolean;
  readonly protectedMethods?: readonly string[];
  readonly methodCoverageProof?: ReleaseEnforcementMiddlewareMethodCoverageProof;
  readonly now?: () => string;
  readonly requestId?: ReleaseEnforcementResolver<string>;
  readonly targetId?: ReleaseEnforcementResolver<string | null | undefined>;
  readonly outputHash?: ReleaseEnforcementResolver<string | null | undefined>;
  readonly consequenceHash?: ReleaseEnforcementResolver<string | null | undefined>;
  readonly bodyDigest?: ReleaseEnforcementResolver<string | null | undefined>;
  readonly bindingHeaderMode?: ReleaseEnforcementMiddlewareBindingHeaderMode;
  readonly trustedUpstreamProof?: ReleaseEnforcementMiddlewareTrustedUpstreamProof;
  readonly policyHash?: ReleaseEnforcementResolver<string | null | undefined>;
  readonly policyVersion?: ReleaseEnforcementResolver<string | null | undefined>;
  readonly policyIrHash?: ReleaseEnforcementResolver<string | null | undefined>;
  readonly policyProvenanceSource?: ReleaseEnforcementResolver<ReleasePolicyProvenanceSource | string | null | undefined>;
  readonly compiledPolicyIndexVersion?: ReleaseEnforcementResolver<string | null | undefined>;
  readonly compiledPolicyIrVersion?: ReleaseEnforcementResolver<string | null | undefined>;
  readonly releaseTokenId?: ReleaseEnforcementResolver<string | null | undefined>;
  readonly releaseDecisionId?: ReleaseEnforcementResolver<string | null | undefined>;
  readonly idempotencyKey?: ReleaseEnforcementResolver<string | null | undefined>;
  readonly replayLedgerEntry?: ReleaseEnforcementResolver<ReplayLedgerEntry | null | undefined>;
  readonly nonceLedgerEntry?: ReleaseEnforcementResolver<NonceLedgerEntry | null | undefined>;
  readonly buildInput?: (
    context: ReleaseEnforcementHttpContext,
  ) => OfflineReleaseVerificationInput | OnlineReleaseVerificationInput | Promise<OfflineReleaseVerificationInput | OnlineReleaseVerificationInput>;
  readonly onAllowed?: (result: ReleaseEnforcementMiddlewareResult) => void | Promise<void>;
  readonly onDenied?: (result: ReleaseEnforcementMiddlewareResult) => void | Promise<void>;
}

export interface HonoReleaseEnforcementEnv {
  readonly Variables: {
    readonly releaseEnforcement: ReleaseEnforcementMiddlewareResult;
  };
}

export interface NodeReleaseEnforcementOptions {
  readonly baseUrl?: string;
  readonly trustForwardedProto?: boolean;
}

export type NodeReleaseEnforcementRequest = IncomingMessage & {
  releaseEnforcement?: ReleaseEnforcementMiddlewareResult;
};
export type NodeReleaseEnforcementNext = (error?: unknown) => void;
export type NodeReleaseEnforcementMiddleware = (
  request: NodeReleaseEnforcementRequest,
  response: ServerResponse,
  next: NodeReleaseEnforcementNext,
) => Promise<void>;
