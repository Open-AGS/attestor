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
import type {
  OfflineReleaseVerification,
  OfflineTrustedWorkloadBinding,
} from './offline-verifier.js';
import type { OnlineReleaseVerification } from './online-verifier.js';
import type { NonceLedgerEntry, ReplayLedgerEntry } from './freshness.js';
import type {
  EnforcementFailureReason,
  ReleaseEnforcementRiskClass,
} from './types.js';

export const RELEASE_ACTION_DISPATCH_GATEWAY_SPEC_VERSION =
  'attestor.release-enforcement-action-dispatch.v1';
export const ACTION_DISPATCH_OUTPUT_ARTIFACT_TYPE =
  'attestor.action-dispatch.request';
export const ACTION_DISPATCH_OUTPUT_EXPECTED_SHAPE =
  'canonical downstream action dispatch';
export const ACTION_DISPATCH_DEFAULT_VERIFIER_MODE = 'online';
export const ACTION_DISPATCH_DEFAULT_BASE_URI =
  'https://attestor.local/release-enforcement/action-dispatch';
export const ACTION_DISPATCH_HTTP_METHOD = 'POST';

export type ActionDispatchGatewayStatus = 'allowed' | 'denied';
export type ActionDispatchGatewayVerifierMode = 'offline' | 'online';
export type ActionDispatchType =
  | 'workflow-dispatch'
  | 'tool-call'
  | 'async-dispatch'
  | 'http-call'
  | 'job-start';
export const ACTION_DISPATCH_TYPES = Object.freeze([
  'workflow-dispatch',
  'tool-call',
  'async-dispatch',
  'http-call',
  'job-start',
] as const satisfies readonly ActionDispatchType[]);

export type ActionDispatchTargetKind = ReleaseTargetReference['kind'];
export const ACTION_DISPATCH_TARGET_KINDS = Object.freeze([
  'endpoint',
  'queue',
  'record-store',
  'workflow',
  'artifact-registry',
] as const satisfies readonly ActionDispatchTargetKind[]);

export type ActionDispatchPreconditionKind =
  | 'state'
  | 'approval'
  | 'evidence'
  | 'time-window'
  | 'idempotency';
export const ACTION_DISPATCH_PRECONDITION_KINDS = Object.freeze([
  'state',
  'approval',
  'evidence',
  'time-window',
  'idempotency',
] as const satisfies readonly ActionDispatchPreconditionKind[]);

export type ActionDispatchValue =
  | null
  | boolean
  | number
  | string
  | readonly ActionDispatchValue[]
  | { readonly [key: string]: ActionDispatchValue };

export interface ActionDispatchPrecondition {
  readonly preconditionId: string;
  readonly kind: ActionDispatchPreconditionKind;
  readonly expected?: ActionDispatchValue | null;
  readonly digest?: string | null;
}

export interface ActionDispatchRequest {
  readonly actionType: ActionDispatchType;
  readonly operation: string;
  readonly targetId?: string | null;
  readonly targetKind?: ActionDispatchTargetKind | null;
  readonly workflowId?: string | null;
  readonly toolName?: string | null;
  readonly queueOrTopic?: string | null;
  readonly resourceUri?: string | null;
  readonly requestedTransition?: string | null;
  readonly parameters?: ActionDispatchValue | null;
  readonly preconditions?: readonly ActionDispatchPrecondition[];
  readonly dryRun?: boolean;
  readonly reason?: string | null;
  readonly idempotencyKey?: string | null;
  readonly actorId?: string | null;
  readonly traceparent?: string | null;
  readonly tracestate?: string | null;
}

export interface ActionDispatchBindingOptions {
  readonly riskClass?: ReleaseEnforcementRiskClass;
  readonly dispatchBaseUri?: string | null;
}

export interface ActionDispatchCanonicalBinding {
  readonly version: typeof RELEASE_ACTION_DISPATCH_GATEWAY_SPEC_VERSION;
  readonly target: ReleaseTargetReference;
  readonly outputContract: OutputContractDescriptor;
  readonly outputPayload: CanonicalReleaseJsonValue;
  readonly consequencePayload: CanonicalReleaseJsonValue;
  readonly hashBundle: CanonicalReleaseHashBundle;
  readonly dispatchCanonical: string;
  readonly dispatchHash: string;
  readonly evidenceSemantics: EnforcementEvidenceSemantics;
  readonly httpMethod: typeof ACTION_DISPATCH_HTTP_METHOD;
  readonly dispatchUri: string;
}

export interface ActionDispatchReleaseAuthorization {
  readonly releaseToken: string;
  readonly releaseTokenId?: string | null;
  readonly releaseDecisionId?: string | null;
  readonly mode?:
    | 'bearer-release-token'
    | 'dpop-bound-token'
    | 'mtls-bound-token'
    | 'spiffe-bound-token';
  readonly proof?: ReleasePresentationProof | null;
  readonly issuer?: string | null;
  readonly subject?: string | null;
  readonly audience?: string | null;
  readonly expiresAt?: string | null;
  readonly scope?: readonly string[];
}

export interface ActionDispatchGatewayOptions {
  readonly verificationKey: ReleaseTokenVerificationKey;
  readonly enforcementPointId: string;
  readonly environment: string;
  readonly tenantId?: string | null;
  readonly accountId?: string | null;
  readonly workloadId?: string | null;
  readonly riskClass?: ReleaseEnforcementRiskClass;
  readonly verifierMode?: ActionDispatchGatewayVerifierMode;
  readonly introspector?: ReleaseTokenIntrospector;
  readonly usageStore?: ReleaseTokenIntrospectionStore;
  readonly consumeOnSuccess?: boolean;
  readonly forceOnlineIntrospection?: boolean;
  readonly replayLedgerEntry?: ReplayLedgerEntry | null;
  readonly nonceLedgerEntry?: NonceLedgerEntry | null;
  readonly trustedWorkloadBinding?: OfflineTrustedWorkloadBinding;
  readonly dispatchBaseUri?: string | null;
  readonly now?: () => string;
  readonly requestId?: string;
  readonly traceId?: string | null;
}

export interface ActionDispatchGatewayInput {
  readonly action: ActionDispatchRequest;
  readonly authorization?: ActionDispatchReleaseAuthorization | null;
  readonly options: ActionDispatchGatewayOptions;
}

export interface ActionDispatchGatewayResult {
  readonly version: typeof RELEASE_ACTION_DISPATCH_GATEWAY_SPEC_VERSION;
  readonly status: ActionDispatchGatewayStatus;
  readonly checkedAt: string;
  readonly binding: ActionDispatchCanonicalBinding;
  readonly request: EnforcementRequest | null;
  readonly presentation: ReleasePresentation | null;
  readonly verificationResult: VerificationResult | null;
  readonly offline: OfflineReleaseVerification | null;
  readonly online: OnlineReleaseVerification | null;
  readonly decision: EnforcementDecision | null;
  readonly receipt: EnforcementReceipt | null;
  readonly evidenceSemantics: EnforcementEvidenceSemantics;
  readonly failureReasons: readonly EnforcementFailureReason[];
  readonly responseStatus: number;
}
