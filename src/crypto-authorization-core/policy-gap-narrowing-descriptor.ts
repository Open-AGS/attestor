import {
  CRYPTO_NARROWING_CANDIDATE_KINDS,
  CRYPTO_NARROWING_SCOPE_KINDS,
  CRYPTO_POLICY_COVERAGE_SOURCE_KINDS,
  CRYPTO_POLICY_DIMENSION_COVERAGE_STATUSES,
  CRYPTO_POLICY_GAP_CLASSES,
  CRYPTO_POLICY_GAP_NARROWING_SPEC_VERSION,
  CRYPTO_POLICY_INTELLIGENCE_OPERATOR_ACTIONS,
  CRYPTO_POLICY_INTELLIGENCE_ROUTE_KINDS,
  CRYPTO_POLICY_INTELLIGENCE_ROUTING_SPEC_VERSION,
  type CryptoPolicyGapNarrowingDescriptor,
  type CryptoPolicyIntelligenceRoutingDescriptor,
} from './policy-gap-narrowing-types.js';

export function cryptoPolicyIntelligenceRoutingDescriptor():
CryptoPolicyIntelligenceRoutingDescriptor {
  return Object.freeze({
    version: CRYPTO_POLICY_INTELLIGENCE_ROUTING_SPEC_VERSION,
    routeKinds: CRYPTO_POLICY_INTELLIGENCE_ROUTE_KINDS,
    operatorActions: CRYPTO_POLICY_INTELLIGENCE_OPERATOR_ACTIONS,
    explicitDenyWins: true,
    implicitDenyFailsClosed: true,
    conflictResolutionRequired: true,
    stalePolicyMustRefresh: true,
    rawPolicyThresholdExposed: false,
    rawPayloadStored: false,
  });
}

export function cryptoPolicyGapNarrowingDescriptor():
CryptoPolicyGapNarrowingDescriptor {
  return Object.freeze({
    version: CRYPTO_POLICY_GAP_NARROWING_SPEC_VERSION,
    gapClasses: CRYPTO_POLICY_GAP_CLASSES,
    candidateKinds: CRYPTO_NARROWING_CANDIDATE_KINDS,
    scopeKinds: CRYPTO_NARROWING_SCOPE_KINDS,
    policyCoverageStatuses: CRYPTO_POLICY_DIMENSION_COVERAGE_STATUSES,
    policyCoverageSourceKinds: CRYPTO_POLICY_COVERAGE_SOURCE_KINDS,
    policyIntelligenceRoutingVersion:
      CRYPTO_POLICY_INTELLIGENCE_ROUTING_SPEC_VERSION,
    policyIntelligenceRouteKinds: CRYPTO_POLICY_INTELLIGENCE_ROUTE_KINDS,
    policyIntelligenceOperatorActions:
      CRYPTO_POLICY_INTELLIGENCE_OPERATOR_ACTIONS,
    approvalRequired: true,
    autoApply: false,
    rawPolicyThresholdExposed: false,
    explicitDenyWins: true,
    implicitDenyFailsClosed: true,
    conflictResolutionRequired: true,
    stalePolicyMustRefresh: true,
  });
}
