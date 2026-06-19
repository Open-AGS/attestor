import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http';
import type { Context } from 'hono';
import type { JWK } from 'jose';
import type {
  ReleaseTokenIntrospectionStore,
  ReleaseTokenIntrospector,
} from '../release-kernel/release-introspection.js';
import type { ReleasePolicyProvenanceSource } from '../release-kernel/object-model.js';
import type { ReleaseTokenVerificationKey } from '../release-kernel/release-token.js';
import type {
  EnforcementBreakGlassGrant,
  EnforcementDecision,
  EnforcementReceipt,
  EnforcementRequest,
  ReleasePresentation,
  VerificationResult,
} from './object-model.js';
import type {
  OfflineReleaseVerification,
} from './offline-verifier.js';
import type {
  OnlineReleaseVerification,
} from './online-verifier.js';
import {
  ATTESTOR_COMPILED_POLICY_INDEX_VERSION_HEADER,
  ATTESTOR_COMPILED_POLICY_IR_VERSION_HEADER,
  ATTESTOR_POLICY_IR_HASH_HEADER,
  ATTESTOR_POLICY_PROVENANCE_SOURCE_HEADER,
  ATTESTOR_POLICY_VERSION_HEADER,
  DEFAULT_HTTP_AUTHORIZATION_ENVELOPE_COMPONENTS,
  type HttpMessageHeaderValue,
  type HttpMessageSignatureVerification,
} from './http-message-signatures.js';
import type {
  CreateEnforcementPointReferenceInput,
  EnforcementFailureReason,
} from './types.js';
import type { NonceLedgerEntry, ReplayLedgerEntry } from './freshness.js';

/**
 * Reference webhook receiver policy-enforcement point.
 *
 * Webhook boundaries are a harsher shape than ordinary middleware: the body
 * must stay byte-for-byte intact until signature verification, high-risk paths
 * need live token state, and retrying senders should see deterministic
 * fail-closed responses. This module gives receivers one small admission gate
 * before they hand a webhook body to business logic.
 */

export const RELEASE_WEBHOOK_RECEIVER_SPEC_VERSION =
  'attestor.release-enforcement-webhook-receiver.v1';
export const HONO_RELEASE_WEBHOOK_RECEIVER_CONTEXT_KEY = 'releaseWebhookReceiver';
export const HONO_RELEASE_WEBHOOK_BODY_CONTEXT_KEY = 'releaseWebhookBody';
export const ATTESTOR_WEBHOOK_EVENT_ID_HEADER = 'attestor-webhook-event-id';
export const ATTESTOR_WEBHOOK_RECEIVER_STATUS_HEADER = 'x-attestor-webhook-receiver-status';
export const DEFAULT_WEBHOOK_RECEIVER_METHODS = Object.freeze(['POST'] as const);
export const DEFAULT_WEBHOOK_RECEIVER_HTTP_AUTHORIZATION_COMPONENTS = Object.freeze([
  ...DEFAULT_HTTP_AUTHORIZATION_ENVELOPE_COMPONENTS,
  ATTESTOR_POLICY_VERSION_HEADER,
  ATTESTOR_POLICY_IR_HASH_HEADER,
  ATTESTOR_POLICY_PROVENANCE_SOURCE_HEADER,
  ATTESTOR_COMPILED_POLICY_INDEX_VERSION_HEADER,
  ATTESTOR_COMPILED_POLICY_IR_VERSION_HEADER,
] as const);
export const DEFAULT_WEBHOOK_BREAK_GLASS_FAILURE_REASONS = Object.freeze([
  'introspection-unavailable',
  'fresh-introspection-required',
] as const satisfies readonly EnforcementFailureReason[]);
export const DEFAULT_WEBHOOK_BREAK_GLASS_MAX_TTL_SECONDS = 30 * 60;

export type ReleaseWebhookReceiverStatus =
  | 'accepted'
  | 'rejected'
  | 'break-glass-accepted';
export type ReleaseWebhookReceiverVerifierMode = 'offline' | 'online';

export interface ReleaseWebhookReceiverHttpRequest {
  readonly method: string;
  readonly url: string;
  readonly headers:
    | Headers
    | IncomingHttpHeaders
    | Readonly<Record<string, HttpMessageHeaderValue>>;
  readonly body?: string | Uint8Array | Buffer | null;
}

export interface ReleaseWebhookReceiverContext {
  readonly request: ReleaseWebhookReceiverHttpRequest;
  readonly checkedAt: string;
  readonly framework: 'hono' | 'node' | 'custom';
  readonly frameworkContext?: unknown;
}

export type ReleaseWebhookReceiverResolver<T> =
  | T
  | ((context: ReleaseWebhookReceiverContext) => T | Promise<T>);

export interface ReleaseWebhookReceiverBreakGlassConsumptionInput {
  readonly context: ReleaseWebhookReceiverContext;
  readonly request: EnforcementRequest;
  readonly presentation: ReleasePresentation;
  readonly signature: HttpMessageSignatureVerification;
  readonly verificationResult: VerificationResult;
  readonly offline: OfflineReleaseVerification | null;
  readonly online: OnlineReleaseVerification | null;
  readonly failureReasons: readonly EnforcementFailureReason[];
  readonly grant: EnforcementBreakGlassGrant;
}

export type ReleaseWebhookReceiverBreakGlassConsumer = (
  input: ReleaseWebhookReceiverBreakGlassConsumptionInput,
) => EnforcementBreakGlassGrant | null | undefined | Promise<EnforcementBreakGlassGrant | null | undefined>;

export interface ReleaseWebhookReceiverResult {
  readonly version: typeof RELEASE_WEBHOOK_RECEIVER_SPEC_VERSION;
  readonly status: ReleaseWebhookReceiverStatus;
  readonly checkedAt: string;
  readonly request: EnforcementRequest | null;
  readonly presentation: ReleasePresentation | null;
  readonly signature: HttpMessageSignatureVerification | null;
  readonly verificationResult: VerificationResult | null;
  readonly offline: OfflineReleaseVerification | null;
  readonly online: OnlineReleaseVerification | null;
  readonly decision: EnforcementDecision | null;
  readonly receipt: EnforcementReceipt | null;
  readonly breakGlass: EnforcementBreakGlassGrant | null;
  readonly failureReasons: readonly EnforcementFailureReason[];
  readonly responseStatus: number;
  readonly retryable: boolean;
}

export interface ReleaseWebhookReceiverDeniedBody {
  readonly version: typeof RELEASE_WEBHOOK_RECEIVER_SPEC_VERSION;
  readonly status: 'rejected';
  readonly checkedAt: string;
  readonly failureReasons: readonly EnforcementFailureReason[];
  readonly verificationStatus: VerificationResult['status'] | null;
  readonly requestId: string | null;
  readonly retryable: boolean;
}

export interface ReleaseWebhookReceiverOptions {
  readonly verificationKey: ReleaseWebhookReceiverResolver<ReleaseTokenVerificationKey>;
  readonly signaturePublicJwk: ReleaseWebhookReceiverResolver<JWK>;
  readonly enforcementPoint: ReleaseWebhookReceiverResolver<CreateEnforcementPointReferenceInput>;
  readonly verifierMode?: ReleaseWebhookReceiverVerifierMode;
  readonly introspector?: ReleaseWebhookReceiverResolver<ReleaseTokenIntrospector | undefined>;
  readonly usageStore?: ReleaseWebhookReceiverResolver<ReleaseTokenIntrospectionStore | undefined>;
  readonly consumeOnSuccess?: boolean;
  readonly forceOnlineIntrospection?: boolean;
  readonly acceptedMethods?: readonly string[];
  readonly now?: () => string;
  readonly requestId?: ReleaseWebhookReceiverResolver<string>;
  readonly targetId?: ReleaseWebhookReceiverResolver<string | null | undefined>;
  readonly outputHash?: ReleaseWebhookReceiverResolver<string | null | undefined>;
  readonly consequenceHash?: ReleaseWebhookReceiverResolver<string | null | undefined>;
  readonly policyHash?: ReleaseWebhookReceiverResolver<string | null | undefined>;
  readonly policyVersion?: ReleaseWebhookReceiverResolver<string | null | undefined>;
  readonly policyIrHash?: ReleaseWebhookReceiverResolver<string | null | undefined>;
  readonly policyProvenanceSource?: ReleaseWebhookReceiverResolver<
    ReleasePolicyProvenanceSource | string | null | undefined
  >;
  readonly compiledPolicyIndexVersion?: ReleaseWebhookReceiverResolver<string | null | undefined>;
  readonly compiledPolicyIrVersion?: ReleaseWebhookReceiverResolver<string | null | undefined>;
  readonly releaseTokenId?: ReleaseWebhookReceiverResolver<string | null | undefined>;
  readonly releaseDecisionId?: ReleaseWebhookReceiverResolver<string | null | undefined>;
  readonly idempotencyKey?: ReleaseWebhookReceiverResolver<string | null | undefined>;
  readonly traceId?: ReleaseWebhookReceiverResolver<string | null | undefined>;
  readonly expectedNonce?: ReleaseWebhookReceiverResolver<string | null | undefined>;
  readonly replayLedgerEntry?: ReleaseWebhookReceiverResolver<ReplayLedgerEntry | null | undefined>;
  readonly nonceLedgerEntry?: ReleaseWebhookReceiverResolver<NonceLedgerEntry | null | undefined>;
  readonly breakGlassGrant?: ReleaseWebhookReceiverResolver<EnforcementBreakGlassGrant | null | undefined>;
  readonly consumeBreakGlassGrant?: ReleaseWebhookReceiverBreakGlassConsumer;
  readonly breakGlassAllowedFailureReasons?: readonly EnforcementFailureReason[];
  readonly breakGlassMaxTtlSeconds?: number;
  readonly requiredCoveredComponents?: readonly string[];
  readonly maxSignatureAgeSeconds?: number;
  readonly clockSkewSeconds?: number;
  readonly onAccepted?: (result: ReleaseWebhookReceiverResult) => void | Promise<void>;
  readonly onRejected?: (result: ReleaseWebhookReceiverResult) => void | Promise<void>;
}

export interface HonoReleaseWebhookReceiverEnv {
  readonly Variables: {
    readonly releaseWebhookReceiver: ReleaseWebhookReceiverResult;
    readonly releaseWebhookBody: Uint8Array;
  };
}

export type HonoReleaseWebhookReceiverHandler<E extends HonoReleaseWebhookReceiverEnv = HonoReleaseWebhookReceiverEnv> = (
  context: Context<E>,
  result: ReleaseWebhookReceiverResult,
  body: Uint8Array,
) => Response | Promise<Response>;

export type NodeReleaseWebhookReceiverRequest = IncomingMessage & {
  releaseWebhookReceiver?: ReleaseWebhookReceiverResult;
  releaseWebhookBody?: Buffer;
};

export type NodeReleaseWebhookReceiverHandler = (
  request: NodeReleaseWebhookReceiverRequest,
  response: ServerResponse,
  result: ReleaseWebhookReceiverResult,
  body: Buffer,
) => void | Promise<void>;

export interface NodeReleaseWebhookReceiverOptions {
  readonly baseUrl?: string;
  readonly trustForwardedProto?: boolean;
}
