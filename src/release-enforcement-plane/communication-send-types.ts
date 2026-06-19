import type { JWK } from 'jose';
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
  EnforcementEvidenceSemantics,
  EnforcementReceipt,
  EnforcementRequest,
  ReleasePresentation,
  ReleasePresentationProof,
  VerificationResult,
} from './object-model.js';
import type { OfflineReleaseVerification } from './offline-verifier.js';
import type { OnlineReleaseVerification } from './online-verifier.js';
import type { HttpMessageForSignature } from './http-message-signatures.js';
import type { NonceLedgerEntry, ReplayLedgerEntry } from './freshness.js';
import type {
  EnforcementFailureReason,
  ReleaseEnforcementRiskClass,
} from './types.js';

export const RELEASE_COMMUNICATION_SEND_GATEWAY_SPEC_VERSION =
  'attestor.release-enforcement-communication-send.v1';
export const COMMUNICATION_SEND_OUTPUT_ARTIFACT_TYPE =
  'attestor.communication-send.message';
export const COMMUNICATION_SEND_OUTPUT_EXPECTED_SHAPE =
  'canonical outbound communication artifact';
export const COMMUNICATION_SEND_DEFAULT_VERIFIER_MODE = 'online';
export const COMMUNICATION_SEND_DEFAULT_BASE_URI =
  'https://attestor.local/release-enforcement/communication-send';
export const COMMUNICATION_SEND_HTTP_METHOD = 'POST';

export type CommunicationSendGatewayStatus = 'allowed' | 'denied';
export type CommunicationSendGatewayVerifierMode = 'offline' | 'online';
export type CommunicationSendChannel =
  | 'email'
  | 'memo'
  | 'sms'
  | 'chat'
  | 'webhook'
  | 'internal-message';
export type CommunicationSendValue =
  | null
  | boolean
  | number
  | string
  | readonly CommunicationSendValue[]
  | { readonly [key: string]: CommunicationSendValue };

export interface CommunicationSendAttachment {
  readonly attachmentId: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly digest: string;
  readonly sizeBytes: number;
  readonly disposition?: 'attachment' | 'inline' | null;
}

export interface CommunicationSendMessage {
  readonly channel: CommunicationSendChannel;
  readonly channelId: string;
  readonly recipientId: string;
  readonly targetId?: string | null;
  readonly subject?: string | null;
  readonly body?: string | null;
  readonly html?: string | null;
  readonly templateId?: string | null;
  readonly locale?: string | null;
  readonly attachments?: readonly CommunicationSendAttachment[];
  readonly metadata?: CommunicationSendValue | null;
  readonly idempotencyKey?: string | null;
  readonly actorId?: string | null;
}

export interface CommunicationSendBindingOptions {
  readonly riskClass?: ReleaseEnforcementRiskClass;
  readonly sendBaseUri?: string | null;
}

export interface CommunicationSendCanonicalBinding {
  readonly version: typeof RELEASE_COMMUNICATION_SEND_GATEWAY_SPEC_VERSION;
  readonly target: ReleaseTargetReference;
  readonly outputContract: OutputContractDescriptor;
  readonly outputPayload: CanonicalReleaseJsonValue;
  readonly consequencePayload: CanonicalReleaseJsonValue;
  readonly hashBundle: CanonicalReleaseHashBundle;
  readonly messageCanonical: string;
  readonly messageHash: string;
  readonly evidenceSemantics: EnforcementEvidenceSemantics;
  readonly httpMethod: typeof COMMUNICATION_SEND_HTTP_METHOD;
  readonly sendUri: string;
}

export interface CommunicationSendReleaseAuthorization {
  readonly releaseToken: string;
  readonly releaseTokenId?: string | null;
  readonly releaseDecisionId?: string | null;
  readonly mode?: 'bearer-release-token' | 'dpop-bound-token' | 'http-message-signature';
  readonly proof?: ReleasePresentationProof | null;
  readonly issuer?: string | null;
  readonly subject?: string | null;
  readonly audience?: string | null;
  readonly expiresAt?: string | null;
  readonly scope?: readonly string[];
}

export interface CommunicationSendHttpMessageSignatureContext {
  readonly message: HttpMessageForSignature;
  readonly publicJwk: JWK;
  readonly label?: string;
  readonly expectedNonce?: string | null;
  readonly expectedTag?: string | null;
  readonly requiredCoveredComponents?: readonly string[];
  readonly maxSignatureAgeSeconds?: number;
  readonly clockSkewSeconds?: number;
}

export interface CommunicationSendGatewayOptions {
  readonly verificationKey: ReleaseTokenVerificationKey;
  readonly enforcementPointId: string;
  readonly environment: string;
  readonly tenantId?: string | null;
  readonly accountId?: string | null;
  readonly workloadId?: string | null;
  readonly riskClass?: ReleaseEnforcementRiskClass;
  readonly verifierMode?: CommunicationSendGatewayVerifierMode;
  readonly introspector?: ReleaseTokenIntrospector;
  readonly usageStore?: ReleaseTokenIntrospectionStore;
  readonly consumeOnSuccess?: boolean;
  readonly forceOnlineIntrospection?: boolean;
  readonly replayLedgerEntry?: ReplayLedgerEntry | null;
  readonly nonceLedgerEntry?: NonceLedgerEntry | null;
  readonly httpMessageSignature?: CommunicationSendHttpMessageSignatureContext;
  readonly sendBaseUri?: string | null;
  readonly now?: () => string;
  readonly requestId?: string;
  readonly traceId?: string | null;
}

export interface CommunicationSendGatewayInput {
  readonly message: CommunicationSendMessage;
  readonly authorization?: CommunicationSendReleaseAuthorization | null;
  readonly options: CommunicationSendGatewayOptions;
}

export interface CommunicationSendGatewayResult {
  readonly version: typeof RELEASE_COMMUNICATION_SEND_GATEWAY_SPEC_VERSION;
  readonly status: CommunicationSendGatewayStatus;
  readonly checkedAt: string;
  readonly binding: CommunicationSendCanonicalBinding;
  readonly request: EnforcementRequest | null;
  readonly presentation: ReleasePresentation | null;
  readonly offline: OfflineReleaseVerification | null;
  readonly online: OnlineReleaseVerification | null;
  readonly verificationResult: VerificationResult | null;
  readonly decision: EnforcementDecision | null;
  readonly receipt: EnforcementReceipt | null;
  readonly evidenceSemantics: EnforcementEvidenceSemantics;
  readonly failureReasons: readonly EnforcementFailureReason[];
  readonly responseStatus: number;
}
