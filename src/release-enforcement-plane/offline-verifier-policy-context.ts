import type { ReleaseTokenClaims } from '../release-kernel/object-model.js';
import type { ReleaseEnforcementPolicyContext } from './object-model.js';

export function policyContextFromClaims(
  claims: ReleaseTokenClaims,
): ReleaseEnforcementPolicyContext {
  return Object.freeze({
    policyHash: claims.policy_hash,
    policyVersion: claims.policy_version ?? null,
    policyIrHash: claims.policy_ir_hash ?? null,
    policyProvenanceSource: claims.policy_provenance_source ?? null,
    compiledPolicyIndexVersion: claims.compiled_policy_index_version ?? null,
    compiledPolicyIrVersion: claims.compiled_policy_ir_version ?? null,
  });
}

export function policyContextMatchesClaims(
  expected: ReleaseEnforcementPolicyContext,
  claims: ReleaseTokenClaims,
): boolean {
  const actual = policyContextFromClaims(claims);
  return actual.policyHash === expected.policyHash &&
    actual.policyVersion === expected.policyVersion &&
    actual.policyIrHash === expected.policyIrHash &&
    actual.policyProvenanceSource === expected.policyProvenanceSource &&
    actual.compiledPolicyIndexVersion === expected.compiledPolicyIndexVersion &&
    actual.compiledPolicyIrVersion === expected.compiledPolicyIrVersion;
}
