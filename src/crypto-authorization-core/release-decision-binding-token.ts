import {
  releaseDecisionExpiresAt,
  releaseDecisionMaxUses,
  releaseDecisionRequiresIntrospection,
  type ReleaseDecision,
  type ReleaseTokenClaims,
} from '../release-kernel/object-model.js';
import type { CryptoReplayFreshnessRules } from './replay-freshness-rules.js';
import type {
  CreateCryptoReleaseDecisionBindingInput,
  CryptoReleaseTokenPosture,
} from './release-decision-binding-types.js';

function tokenTtlCeilingSeconds(
  releaseDecision: ReleaseDecision,
  freshnessRules: CryptoReplayFreshnessRules,
): number {
  const createdAt = Math.floor(Date.parse(releaseDecision.createdAt) / 1000);
  if (!Number.isFinite(createdAt)) {
    throw new Error('Crypto release decision binding release decision createdAt must be an ISO timestamp.');
  }
  const releaseExpiry = releaseDecisionExpiresAt(releaseDecision);
  const releaseExpirySeconds = releaseExpiry
    ? Math.floor(Date.parse(releaseExpiry) / 1000)
    : Number.MAX_SAFE_INTEGER;
  const freshnessExpiry = freshnessRules.validityWindow.effectiveExpiresAtEpochSeconds;
  return Math.max(0, Math.min(releaseExpirySeconds, freshnessExpiry) - createdAt);
}

function validateReleaseTokenClaims(
  claims: ReleaseTokenClaims,
  releaseDecision: ReleaseDecision,
): void {
  if (claims.decision_id !== releaseDecision.id) {
    throw new Error('Crypto release decision binding release token decision id does not match release decision.');
  }
  if (claims.decision !== releaseDecision.status) {
    throw new Error('Crypto release decision binding release token status does not match release decision.');
  }
  if (claims.output_hash !== releaseDecision.outputHash) {
    throw new Error('Crypto release decision binding release token output hash does not match release decision.');
  }
  if (claims.consequence_hash !== releaseDecision.consequenceHash) {
    throw new Error('Crypto release decision binding release token consequence hash does not match release decision.');
  }
  if (claims.policy_hash !== releaseDecision.policyHash) {
    throw new Error('Crypto release decision binding release token policy hash does not match release decision.');
  }
  if (claims.aud !== releaseDecision.target.id) {
    throw new Error('Crypto release decision binding release token audience does not match release target.');
  }
  if (claims.introspection_required !== releaseDecisionRequiresIntrospection(releaseDecision)) {
    throw new Error('Crypto release decision binding release token introspection posture does not match release decision.');
  }
}

export function releaseTokenPostureFor(
  input: CreateCryptoReleaseDecisionBindingInput,
  releaseDecision: ReleaseDecision,
): CryptoReleaseTokenPosture {
  const eligible = releaseDecision.status === 'accepted';
  const required = eligible;
  const claims = input.releaseTokenClaims ?? null;
  if (claims) {
    validateReleaseTokenClaims(claims, releaseDecision);
  }

  const tokenClaimStatus = !required
    ? 'not-required'
    : claims
      ? 'bound'
      : 'required-not-present';

  return Object.freeze({
    required,
    eligible,
    tokenClaimStatus,
    tokenId: claims?.jti ?? releaseDecision.releaseTokenId,
    audience: releaseDecision.target.id,
    subject: `releaseDecision:${releaseDecision.id}`,
    scope: `release:crypto:${input.intent.consequenceKind}`,
    resource: [
      input.envelope.chainBinding.caip2ChainId,
      input.envelope.signerBinding.accountAddress,
      input.intent.target.targetId,
    ].join('/'),
    introspectionRequired: releaseDecisionRequiresIntrospection(releaseDecision),
    consumeOnSuccess:
      input.freshnessRules.replayLedger.consumeOnAllow ||
      (releaseDecisionMaxUses(releaseDecision) ?? 1) === 1,
    maxUses: releaseDecisionMaxUses(releaseDecision) ?? 1,
    ttlCeilingSeconds: tokenTtlCeilingSeconds(releaseDecision, input.freshnessRules),
  });
}
