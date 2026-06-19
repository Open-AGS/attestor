import type {
  ReleaseDecision,
  ReleaseEvidencePolicyContext,
  ReleasePolicyProvenanceSource,
} from './object-model.js';
import type { IssuedReleaseToken } from './release-token.js';
import type { ReleaseEvidenceTokenPolicyContext } from './release-evidence-pack-types.js';

export function assertSameNullableString(
  left: string | null | undefined,
  right: string | null | undefined,
  message: string,
): void {
  if ((left ?? null) !== (right ?? null)) {
    throw new Error(message);
  }
}

export function assertNullableStringField(value: unknown, fieldName: string): void {
  if (value !== null && typeof value !== 'string') {
    throw new Error(`Release evidence pack verification requires ${fieldName} to be a string or null.`);
  }
}

export function assertRequiredStringField(value: unknown, fieldName: string): void {
  if (typeof value !== 'string') {
    throw new Error(`Release evidence pack verification requires ${fieldName} to be a string.`);
  }
}

export function buildDecisionPolicyContext(decision: ReleaseDecision): ReleaseEvidencePolicyContext {
  return Object.freeze({
    policyVersion: decision.policyVersion,
    policyHash: decision.policyHash,
    policyIrHash: decision.policyProvenance?.compiledPolicyIrHash ?? null,
    policyProvenanceSource: decision.policyProvenance?.source ?? null,
    compiledPolicyIndexVersion: decision.policyProvenance?.compiledPolicyIndexVersion ?? null,
    compiledPolicyIrVersion: decision.policyProvenance?.compiledPolicyIrVersion ?? null,
  });
}

export function buildEvidencePackPolicyContext(pack: {
  readonly policyVersion: string;
  readonly policyHash: string;
  readonly policyIrHash: string | null;
  readonly policyProvenanceSource: ReleasePolicyProvenanceSource | null;
  readonly compiledPolicyIndexVersion: string | null;
  readonly compiledPolicyIrVersion: string | null;
}): ReleaseEvidencePolicyContext {
  return Object.freeze({
    policyVersion: pack.policyVersion,
    policyHash: pack.policyHash,
    policyIrHash: pack.policyIrHash,
    policyProvenanceSource: pack.policyProvenanceSource,
    compiledPolicyIndexVersion: pack.compiledPolicyIndexVersion,
    compiledPolicyIrVersion: pack.compiledPolicyIrVersion,
  });
}

export function buildTokenPolicyContext(
  issuedToken: IssuedReleaseToken,
): ReleaseEvidenceTokenPolicyContext {
  return Object.freeze({
    policyVersion: issuedToken.claims.policy_version ?? null,
    policyHash: issuedToken.claims.policy_hash,
    policyIrHash: issuedToken.claims.policy_ir_hash ?? null,
    policyProvenanceSource: issuedToken.claims.policy_provenance_source ?? null,
    compiledPolicyIndexVersion: issuedToken.claims.compiled_policy_index_version ?? null,
    compiledPolicyIrVersion: issuedToken.claims.compiled_policy_ir_version ?? null,
  });
}

export function freezeReleaseEvidencePolicyContext(
  context: ReleaseEvidencePolicyContext,
): ReleaseEvidencePolicyContext {
  return Object.freeze({ ...context });
}

export function freezeReleaseEvidenceTokenPolicyContext(
  context: ReleaseEvidenceTokenPolicyContext,
): ReleaseEvidenceTokenPolicyContext {
  return Object.freeze({ ...context });
}

export function assertReleaseEvidencePolicyContextShape(
  value: unknown,
  fieldName: string,
  policyVersionMode: 'required' | 'nullable',
): void {
  if (!value || typeof value !== 'object') {
    throw new Error(`Release evidence pack verification requires ${fieldName} to be an object.`);
  }
  const context = value as Record<string, unknown>;
  if (policyVersionMode === 'required') {
    assertRequiredStringField(context.policyVersion, `${fieldName}.policyVersion`);
  } else {
    assertNullableStringField(context.policyVersion, `${fieldName}.policyVersion`);
  }
  assertRequiredStringField(context.policyHash, `${fieldName}.policyHash`);
  assertNullableStringField(context.policyIrHash, `${fieldName}.policyIrHash`);
  assertNullableStringField(
    context.policyProvenanceSource,
    `${fieldName}.policyProvenanceSource`,
  );
  assertNullableStringField(
    context.compiledPolicyIndexVersion,
    `${fieldName}.compiledPolicyIndexVersion`,
  );
  assertNullableStringField(
    context.compiledPolicyIrVersion,
    `${fieldName}.compiledPolicyIrVersion`,
  );
}

export function assertPolicyContextMatchesFields(
  context: ReleaseEvidenceTokenPolicyContext,
  fields: ReleaseEvidenceTokenPolicyContext,
  label: string,
): void {
  assertSameNullableString(
    context.policyVersion,
    fields.policyVersion,
    `${label} policy version does not match flat policy version.`,
  );
  if (context.policyHash !== fields.policyHash) {
    throw new Error(`${label} policy hash does not match flat policy hash.`);
  }
  assertSameNullableString(
    context.policyIrHash,
    fields.policyIrHash,
    `${label} policy IR hash does not match flat policy IR hash.`,
  );
  if (context.policyProvenanceSource !== fields.policyProvenanceSource) {
    throw new Error(`${label} policy provenance source does not match flat policy provenance source.`);
  }
  assertSameNullableString(
    context.compiledPolicyIndexVersion,
    fields.compiledPolicyIndexVersion,
    `${label} compiled policy index version does not match flat compiled policy index version.`,
  );
  assertSameNullableString(
    context.compiledPolicyIrVersion,
    fields.compiledPolicyIrVersion,
    `${label} compiled policy IR version does not match flat compiled policy IR version.`,
  );
}
