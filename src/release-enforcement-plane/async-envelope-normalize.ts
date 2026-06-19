import type { IssuedReleaseToken } from '../release-kernel/release-token.js';
import type { ReleaseEnforcementPolicyContext } from './object-model.js';
import {
  ENFORCEMENT_FAILURE_REASONS,
  type EnforcementFailureReason,
} from './types.js';
import type { AsyncConsequenceBinding } from './async-envelope-types.js';
import { canonicalJson } from './async-envelope-canonical.js';
import { timingSafeStringEqual } from './async-envelope-crypto.js';

export function uniqueFailureReasons(
  reasons: readonly EnforcementFailureReason[],
): readonly EnforcementFailureReason[] {
  const present = new Set(reasons);
  return Object.freeze(ENFORCEMENT_FAILURE_REASONS.filter((reason) => present.has(reason)));
}

export function normalizeIdentifier(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`Async consequence envelope ${fieldName} requires a non-empty value.`);
  }
  return normalized;
}

export function normalizeOptionalIdentifier(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  return normalizeIdentifier(value, fieldName);
}

export function normalizeIsoTimestamp(value: string, fieldName: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Async consequence envelope ${fieldName} must be a valid ISO timestamp.`);
  }
  return parsed.toISOString();
}

export function normalizeScope(values: readonly string[] | undefined): readonly string[] {
  if (!values || values.length === 0) {
    return Object.freeze([]);
  }

  return Object.freeze(
    Array.from(
      new Set(
        values
          .map((value) => value.trim())
          .filter((value) => value.length > 0),
      ),
    ).sort(),
  );
}

export function policyContextFromClaims(
  claims: IssuedReleaseToken['claims'],
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

export function normalizePolicyContext(
  context: ReleaseEnforcementPolicyContext | null | undefined,
): ReleaseEnforcementPolicyContext | null {
  if (!context) {
    return null;
  }
  return Object.freeze({
    policyHash: context.policyHash ?? null,
    policyVersion: context.policyVersion ?? null,
    policyIrHash: context.policyIrHash ?? null,
    policyProvenanceSource: context.policyProvenanceSource ?? null,
    compiledPolicyIndexVersion: context.compiledPolicyIndexVersion ?? null,
    compiledPolicyIrVersion: context.compiledPolicyIrVersion ?? null,
  });
}

export function policyContextFromConsequence(
  consequence: AsyncConsequenceBinding,
): ReleaseEnforcementPolicyContext {
  return Object.freeze({
    policyHash: consequence.policyHash ?? null,
    policyVersion: consequence.policyVersion ?? null,
    policyIrHash: consequence.policyIrHash ?? null,
    policyProvenanceSource: consequence.policyProvenanceSource ?? null,
    compiledPolicyIndexVersion: consequence.compiledPolicyIndexVersion ?? null,
    compiledPolicyIrVersion: consequence.compiledPolicyIrVersion ?? null,
  });
}

export function policyContextMatchesConsequence(consequence: AsyncConsequenceBinding): boolean {
  const policyContext = normalizePolicyContext(consequence.policyContext);
  return policyContext !== null &&
    timingSafeStringEqual(
      canonicalJson(policyContext),
      canonicalJson(policyContextFromConsequence(consequence)),
    );
}

export function epochSeconds(value: string): number {
  return Math.floor(new Date(value).getTime() / 1000);
}
