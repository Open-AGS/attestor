import type { ReleaseDecision, ReleaseTokenClaims } from './object-model.js';
import type {
  IssuedReleaseToken,
  VerifyReleaseTokenInput,
} from './release-token.js';

export const RELEASE_TOKEN_REGISTRY_SPEC_VERSION =
  'attestor.release-token-registry.v2';
export const RELEASE_TOKEN_INTROSPECTION_SPEC_VERSION =
  'attestor.release-introspection.v2';
export const DEFAULT_RELEASE_TOKEN_TYPE_HINT = 'attestor_release_token';
export const ATTESTOR_RELEASE_TOKEN_INTROSPECTION_STORE_PATH_ENV =
  'ATTESTOR_RELEASE_TOKEN_INTROSPECTION_STORE_PATH';

export type SupportedReleaseTokenTypeHint =
  | typeof DEFAULT_RELEASE_TOKEN_TYPE_HINT
  | 'access_token';

export type ReleaseTokenRegistryStatus = 'issued' | 'revoked' | 'expired' | 'consumed';
export type ReleaseTokenInactiveReason =
  | 'invalid'
  | 'unknown'
  | 'unsupported_token_type'
  | 'claim_mismatch'
  | 'revoked'
  | 'expired'
  | 'usage_exhausted';

export interface RegisteredReleaseToken {
  readonly version: typeof RELEASE_TOKEN_REGISTRY_SPEC_VERSION;
  readonly status: ReleaseTokenRegistryStatus;
  readonly statusChangedAt: string;
  readonly tokenId: string;
  readonly issuer: string;
  readonly subject: string;
  readonly audience: string;
  readonly tenantId?: string | null;
  readonly issuedAt: string;
  readonly notBefore: string;
  readonly expiresAt: string;
  readonly decisionId: string;
  readonly decisionStatus: ReleaseDecision['status'];
  readonly consequenceType: ReleaseDecision['consequenceType'];
  readonly riskClass: ReleaseDecision['riskClass'];
  readonly outputHash: string;
  readonly consequenceHash: string;
  readonly policyHash: string;
  readonly policyVersion?: string;
  readonly policyIrHash?: string | null;
  readonly policyProvenanceSource?: ReleaseTokenClaims['policy_provenance_source'] | null;
  readonly compiledPolicyIndexVersion?: string | null;
  readonly compiledPolicyIrVersion?: string | null;
  readonly override: boolean;
  readonly introspectionRequired: boolean;
  readonly authorityMode: ReleaseDecision['reviewAuthority']['mode'];
  readonly keyId: string;
  readonly publicKeyFingerprint: string;
  readonly maxUses: number;
  readonly useCount: number;
  readonly firstUsedAt: string | null;
  readonly lastUsedAt: string | null;
  readonly lastUsedByResourceServerId: string | null;
  readonly revokedAt: string | null;
  readonly revocationReason: string | null;
  readonly revokedBy: string | null;
  readonly expiredAt: string | null;
}

export interface RegisterIssuedReleaseTokenInput {
  readonly issuedToken: IssuedReleaseToken;
  readonly decision: ReleaseDecision;
}

export interface RevokeReleaseTokenInput {
  readonly tokenId: string;
  readonly revokedAt?: string;
  readonly reason?: string;
  readonly revokedBy?: string;
}

export interface ReleaseDecisionRevocationRecord {
  readonly version: typeof RELEASE_TOKEN_REGISTRY_SPEC_VERSION;
  readonly decisionId: string;
  readonly revokedAt: string;
  readonly reason: string | null;
  readonly revokedBy: string | null;
  readonly rawPayloadStored: false;
}

export interface RevokeReleaseTokensForDecisionInput {
  readonly decisionId: string;
  readonly revokedAt?: string;
  readonly reason?: string;
  readonly revokedBy?: string;
}

export interface RevokeReleaseTokensForDecisionResult {
  readonly decisionRevocation: ReleaseDecisionRevocationRecord;
  readonly revokedTokens: readonly RegisteredReleaseToken[];
  readonly alreadyInactiveTokens: readonly RegisteredReleaseToken[];
}

export interface RecordReleaseTokenUseInput {
  readonly tokenId: string;
  readonly usedAt?: string;
  readonly resourceServerId?: string;
}

export interface RecordedReleaseTokenUseResult {
  readonly accepted: boolean;
  readonly inactiveReason: ReleaseTokenInactiveReason | null;
  readonly record: RegisteredReleaseToken | null;
}

export interface ReleaseTokenIntrospectionStore {
  registerIssuedToken(input: RegisterIssuedReleaseTokenInput): RegisteredReleaseToken;
  findToken(tokenId: string): RegisteredReleaseToken | null;
  revokeToken(input: RevokeReleaseTokenInput): RegisteredReleaseToken | null;
  findDecisionRevocation(decisionId: string): ReleaseDecisionRevocationRecord | null;
  revokeTokensForDecision(
    input: RevokeReleaseTokensForDecisionInput,
  ): RevokeReleaseTokensForDecisionResult;
  syncLifecycle(currentDate?: string): readonly RegisteredReleaseToken[];
  recordTokenUse(input: RecordReleaseTokenUseInput): RecordedReleaseTokenUseResult;
}

export interface ReleaseTokenIntrospectionInput
  extends Pick<VerifyReleaseTokenInput, 'token' | 'verificationKey' | 'audience' | 'currentDate'> {
  readonly tokenTypeHint?: string;
  readonly resourceServerId?: string;
}

interface ReleaseTokenIntrospectionBase {
  readonly version: typeof RELEASE_TOKEN_INTROSPECTION_SPEC_VERSION;
  readonly token_type: typeof DEFAULT_RELEASE_TOKEN_TYPE_HINT;
  readonly checked_at: string;
  readonly resource_server_id: string | null;
}

export interface InactiveReleaseTokenIntrospectionResult
  extends ReleaseTokenIntrospectionBase {
  readonly active: false;
  readonly inactive_reason: ReleaseTokenInactiveReason;
}

export interface ReleaseTokenIntrospectionPolicyContext {
  readonly policy_hash: string;
  readonly policy_version?: string;
  readonly policy_ir_hash?: string;
  readonly policy_provenance_source?: ReleaseTokenClaims['policy_provenance_source'];
  readonly compiled_policy_index_version?: string;
  readonly compiled_policy_ir_version?: string;
}

export interface ActiveReleaseTokenIntrospectionResult
  extends ReleaseTokenIntrospectionBase {
  readonly active: true;
  readonly scope: string;
  readonly iss: string;
  readonly sub: string;
  readonly aud: string;
  readonly tenant_id?: string;
  readonly jti: string;
  readonly iat: number;
  readonly nbf: number;
  readonly exp: number;
  readonly decision_id: string;
  readonly decision: ReleaseTokenClaims['decision'];
  readonly consequence_type: ReleaseTokenClaims['consequence_type'];
  readonly risk_class: ReleaseTokenClaims['risk_class'];
  readonly output_hash: string;
  readonly consequence_hash: string;
  readonly policy_hash: string;
  readonly policy_version?: string;
  readonly policy_ir_hash?: string;
  readonly policy_provenance_source?: ReleaseTokenClaims['policy_provenance_source'];
  readonly compiled_policy_index_version?: string;
  readonly compiled_policy_ir_version?: string;
  readonly token_policy: ReleaseTokenIntrospectionPolicyContext;
  readonly override: boolean;
  readonly authority_mode: ReleaseTokenClaims['authority_mode'];
  readonly introspection_required: boolean;
  readonly resource?: string;
  readonly act?: ReleaseTokenClaims['act'];
  readonly parent_jti?: string;
  readonly exchange_id?: string;
  readonly exchanged_at?: number;
  readonly source_aud?: string;
  readonly token_use?: ReleaseTokenClaims['token_use'];
  readonly cnf?: ReleaseTokenClaims['cnf'];
}

export type ReleaseTokenIntrospectionResult =
  | InactiveReleaseTokenIntrospectionResult
  | ActiveReleaseTokenIntrospectionResult;

export interface ReleaseTokenIntrospector {
  introspect(
    input: ReleaseTokenIntrospectionInput,
  ): Promise<ReleaseTokenIntrospectionResult>;
}

export type AwaitableReleaseTokenIntrospectionStore = {
  [K in keyof ReleaseTokenIntrospectionStore]: ReleaseTokenIntrospectionStore[K] extends (
    ...args: infer Args
  ) => infer Result
    ? (...args: Args) => Result | Promise<Result>
    : ReleaseTokenIntrospectionStore[K];
};

export class ReleaseTokenIntrospectionStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReleaseTokenIntrospectionStoreError';
  }
}
