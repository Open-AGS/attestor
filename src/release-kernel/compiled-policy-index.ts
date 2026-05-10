import type { ReleaseEvaluationRequest } from './release-decision-engine.js';
import {
  compileReleasePolicyDefinition,
  type CompiledAdmissionPolicy,
  type CompiledAdmissionPolicyVerificationResult,
  verifyCompiledAdmissionPolicy,
} from './compiled-policy-ir.js';
import type { ReleasePolicyDefinition } from './release-policy.js';
import type { ReleaseTargetKind } from './object-model.js';
import type { ConsequenceType, RiskClass } from './types.js';

/**
 * Verified compiled policy index.
 *
 * This is the first hot-path data structure for compiled admission policies:
 * policy authoring objects are compiled and statically verified once, then
 * request-time matching starts from a narrow consequence/risk/target/artifact
 * bucket before checking the remaining boundary predicates.
 */

export const COMPILED_ADMISSION_POLICY_INDEX_VERSION =
  'attestor.compiled-admission-policy-index.v1';

export type CompiledAdmissionPolicyIndexRejectionReason =
  | 'verification-failed'
  | 'non-active-policy'
  | 'verification-warning';

export interface CompiledAdmissionPolicyIndexLookupKeyParts {
  readonly consequenceType: ConsequenceType;
  readonly riskClass: RiskClass;
  readonly targetKind: ReleaseTargetKind;
  readonly artifactType: string;
}

export interface CompiledAdmissionPolicyIndexEntry {
  readonly definition: ReleasePolicyDefinition;
  readonly compiled: CompiledAdmissionPolicy;
  readonly verification: CompiledAdmissionPolicyVerificationResult;
  readonly lookupKeys: readonly string[];
}

export interface RejectedCompiledAdmissionPolicyIndexEntry {
  readonly definition: ReleasePolicyDefinition;
  readonly compiled: CompiledAdmissionPolicy;
  readonly verification: CompiledAdmissionPolicyVerificationResult;
  readonly reason: CompiledAdmissionPolicyIndexRejectionReason;
}

export interface CompiledAdmissionPolicyIndex {
  readonly version: typeof COMPILED_ADMISSION_POLICY_INDEX_VERSION;
  readonly entries: readonly CompiledAdmissionPolicyIndexEntry[];
  readonly rejectedEntries: readonly RejectedCompiledAdmissionPolicyIndexEntry[];
  readonly buckets: Readonly<Record<string, readonly number[]>>;
}

export function compiledAdmissionPolicyIndexLookupKey(
  parts: CompiledAdmissionPolicyIndexLookupKeyParts,
): string {
  return [
    parts.consequenceType,
    parts.riskClass,
    parts.targetKind,
    parts.artifactType,
  ].join('|');
}

function lookupKeysForPolicy(policy: CompiledAdmissionPolicy): readonly string[] {
  const keys: string[] = [];
  for (const targetKind of policy.indexKey.targetKinds) {
    for (const artifactType of policy.indexKey.artifactTypes) {
      keys.push(
        compiledAdmissionPolicyIndexLookupKey({
          consequenceType: policy.indexKey.consequenceType,
          riskClass: policy.indexKey.riskClass,
          targetKind,
          artifactType,
        }),
      );
    }
  }

  return Object.freeze([...new Set(keys)].sort());
}

function rejectionReasonFor(
  policy: ReleasePolicyDefinition,
  verification: CompiledAdmissionPolicyVerificationResult,
): CompiledAdmissionPolicyIndexRejectionReason | null {
  if (!verification.valid) {
    return 'verification-failed';
  }
  if (policy.status !== 'active') {
    return 'non-active-policy';
  }
  if (verification.warnings.length > 0) {
    return 'verification-warning';
  }

  return null;
}

function bucketForRequest(request: ReleaseEvaluationRequest): string {
  return compiledAdmissionPolicyIndexLookupKey({
    consequenceType: request.outputContract.consequenceType,
    riskClass: request.outputContract.riskClass,
    targetKind: request.target.kind,
    artifactType: request.outputContract.artifactType,
  });
}

function compiledPolicyMatchesRequest(
  entry: CompiledAdmissionPolicyIndexEntry,
  request: ReleaseEvaluationRequest,
): boolean {
  const compiled = entry.compiled;
  const boundary = compiled.capabilityBoundary;
  const contract = compiled.outputContract;

  return (
    compiled.sourcePolicyStatus === 'active' &&
    compiled.indexKey.consequenceType === request.outputContract.consequenceType &&
    compiled.indexKey.riskClass === request.outputContract.riskClass &&
    compiled.indexKey.targetKinds.includes(request.target.kind) &&
    contract.allowedArtifactTypes.includes(request.outputContract.artifactType) &&
    contract.expectedShape === request.outputContract.expectedShape &&
    boundary.allowedTools.length > 0 &&
    boundary.allowedTargets.length > 0 &&
    boundary.allowedDataDomains.length > 0 &&
    request.capabilityBoundary.allowedTools.length > 0 &&
    request.capabilityBoundary.allowedTargets.length > 0 &&
    request.capabilityBoundary.allowedDataDomains.length > 0 &&
    request.capabilityBoundary.allowedTools.every((tool) =>
      boundary.allowedTools.includes(tool),
    ) &&
    request.capabilityBoundary.allowedTargets.every((target) =>
      boundary.allowedTargets.includes(target),
    ) &&
    request.capabilityBoundary.allowedDataDomains.every((domain) =>
      boundary.allowedDataDomains.includes(domain),
    )
  );
}

export function createCompiledAdmissionPolicyIndex(
  policies: readonly ReleasePolicyDefinition[],
): CompiledAdmissionPolicyIndex {
  const entries: CompiledAdmissionPolicyIndexEntry[] = [];
  const rejectedEntries: RejectedCompiledAdmissionPolicyIndexEntry[] = [];
  const mutableBuckets: Record<string, number[]> = {};

  for (const definition of policies) {
    const compiled = compileReleasePolicyDefinition(definition);
    const verification = verifyCompiledAdmissionPolicy(compiled);
    const reason = rejectionReasonFor(definition, verification);

    if (reason !== null) {
      rejectedEntries.push(
        Object.freeze({
          definition,
          compiled,
          verification,
          reason,
        }),
      );
      continue;
    }

    const lookupKeys = lookupKeysForPolicy(compiled);
    const entryIndex = entries.length;
    entries.push(
      Object.freeze({
        definition,
        compiled,
        verification,
        lookupKeys,
      }),
    );
    for (const key of lookupKeys) {
      mutableBuckets[key] = mutableBuckets[key] ?? [];
      mutableBuckets[key].push(entryIndex);
    }
  }

  const buckets = Object.freeze(
    Object.fromEntries(
      Object.entries(mutableBuckets)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => [key, Object.freeze([...value])]),
    ) as Record<string, readonly number[]>,
  );

  return Object.freeze({
    version: COMPILED_ADMISSION_POLICY_INDEX_VERSION,
    entries: Object.freeze(entries),
    rejectedEntries: Object.freeze(rejectedEntries),
    buckets,
  });
}

export function resolveCompiledAdmissionPolicyIndexEntries(
  index: CompiledAdmissionPolicyIndex,
  request: ReleaseEvaluationRequest,
): readonly CompiledAdmissionPolicyIndexEntry[] {
  const bucket = index.buckets[bucketForRequest(request)] ?? [];
  return Object.freeze(
    bucket
      .map((entryIndex) => index.entries[entryIndex])
      .filter((entry): entry is CompiledAdmissionPolicyIndexEntry => entry !== undefined)
      .filter((entry) => compiledPolicyMatchesRequest(entry, request)),
  );
}

export function resolveCompiledAdmissionPolicyIndexEntry(
  index: CompiledAdmissionPolicyIndex,
  request: ReleaseEvaluationRequest,
): CompiledAdmissionPolicyIndexEntry | null {
  return resolveCompiledAdmissionPolicyIndexEntries(index, request)[0] ?? null;
}
