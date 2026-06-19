import {
  CONSEQUENCE_APPROVAL_SOURCE_KINDS,
  CONSEQUENCE_APPROVAL_STATES,
  CONSEQUENCE_APPROVAL_TRUST_CLASSES,
} from './approval-provenance-guard.js';
import {
  GENERIC_ADMISSION_GUARD_INPUT_ASSERTION_KINDS,
  GENERIC_ADMISSION_GUARD_INPUT_KINDS,
  GENERIC_ADMISSION_GUARD_INPUT_SOURCE_CLASSES,
  GENERIC_ADMISSION_OBSERVED_FEATURE_ORIGINS,
  type GenericAdmissionApproval,
  type GenericAdmissionAuthoritySource,
  type GenericAdmissionFeatureValue,
  type GenericAdmissionGuardInputAssertionKind,
  type GenericAdmissionGuardInputKind,
  type GenericAdmissionGuardInputProvenanceRecord,
  type GenericAdmissionGuardInputSourceClass,
  type GenericAdmissionNoGoCondition,
  type GenericAdmissionObservedFeatureOrigin,
} from './contracts.js';
import {
  CONSEQUENCE_NO_GO_CONDITION_KINDS,
  CONSEQUENCE_NO_GO_CONDITION_SOURCE_KINDS,
  CONSEQUENCE_NO_GO_CONDITION_STATES,
} from './no-go-condition-ledger.js';
import {
  isRecord,
  normalizeEnumValue,
  normalizeIdentifier,
  normalizeOptionalIdentifier,
  readOptionalBoolean,
  readOptionalString,
  readOptionalTimestamp,
  readRequiredString,
} from './normalization.js';
import {
  CONSEQUENCE_UNTRUSTED_CONTENT_AUTHORITY_CLAIM_KINDS,
  CONSEQUENCE_UNTRUSTED_CONTENT_AUTHORITY_SOURCE_KINDS,
  CONSEQUENCE_UNTRUSTED_CONTENT_AUTHORITY_TRUST_CLASSES,
} from './untrusted-content-authority-guard.js';

export function normalizeGenericObservedFeatures(
  value: unknown,
): Readonly<Record<string, GenericAdmissionFeatureValue>> {
  if (value === undefined || value === null) return Object.freeze({});
  if (!isRecord(value)) {
    throw new Error('Consequence admission observedFeatures must be an object when provided.');
  }
  const normalized: Record<string, GenericAdmissionFeatureValue> = {};
  for (const [key, entry] of Object.entries(value)) {
    const normalizedKey = normalizeIdentifier(key, 'observedFeatures key');
    if (
      entry !== null &&
      typeof entry !== 'string' &&
      typeof entry !== 'number' &&
      typeof entry !== 'boolean'
    ) {
      throw new Error(
        `Consequence admission observedFeatures.${normalizedKey} must be scalar or null.`,
      );
    }
    if (typeof entry === 'number' && !Number.isFinite(entry)) {
      throw new Error(
        `Consequence admission observedFeatures.${normalizedKey} must be finite.`,
      );
    }
    normalized[normalizedKey] = entry;
  }
  return Object.freeze(normalized);
}

export function normalizeGenericObservedFeatureOrigins(
  value: unknown,
): Readonly<Record<string, GenericAdmissionObservedFeatureOrigin>> {
  if (value === undefined || value === null) return Object.freeze({});
  if (!isRecord(value)) {
    throw new Error('Consequence admission observedFeatureOrigins must be an object when provided.');
  }
  const normalized: Record<string, GenericAdmissionObservedFeatureOrigin> = {};
  for (const [key, entry] of Object.entries(value)) {
    const normalizedKey = normalizeIdentifier(key, 'observedFeatureOrigins key');
    if (typeof entry !== 'string') {
      throw new Error(
        `Consequence admission observedFeatureOrigins.${normalizedKey} must be a string.`,
      );
    }
    normalized[normalizedKey] = normalizeEnumValue(
      entry,
      GENERIC_ADMISSION_OBSERVED_FEATURE_ORIGINS,
      `observedFeatureOrigins.${normalizedKey}`,
    );
  }
  return Object.freeze(normalized);
}

export function normalizeGenericGuardInputAssertionKinds(
  value: unknown,
  fieldName: string,
): readonly GenericAdmissionGuardInputAssertionKind[] {
  if (!Array.isArray(value)) {
    throw new Error(`Consequence admission ${fieldName} must be an array.`);
  }
  const normalized = value.map((entry, index) => normalizeEnumValue(
    typeof entry === 'string' ? entry : String(entry),
    GENERIC_ADMISSION_GUARD_INPUT_ASSERTION_KINDS,
    `${fieldName}[${index}]`,
  ));
  const unique = [...new Set(normalized)].sort() as GenericAdmissionGuardInputAssertionKind[];
  if (unique.length === 0) {
    throw new Error(`Consequence admission ${fieldName} must not be empty.`);
  }
  return Object.freeze(unique);
}

export function normalizeGenericGuardInputProvenance(
  value: unknown,
): readonly GenericAdmissionGuardInputProvenanceRecord[] {
  if (value === undefined || value === null) return Object.freeze([]);
  if (!Array.isArray(value)) {
    throw new Error('Consequence admission guardInputProvenance must be an array when provided.');
  }
  return Object.freeze(
    value.map((entry, index) => {
      const field = `guardInputProvenance[${index}]`;
      if (!isRecord(entry)) {
        throw new Error(`Consequence admission ${field} must be an object.`);
      }
      const sourceRef = readOptionalString(entry, 'sourceRef');
      const sourceDigest = readOptionalString(entry, 'sourceDigest');
      const evidenceDigest = readOptionalString(entry, 'evidenceDigest');
      const tenantId = readOptionalString(entry, 'tenantId');
      const recordedAt = readOptionalTimestamp(entry, 'recordedAt');
      const trustedBoundary = readOptionalBoolean(entry, 'trustedBoundary');

      return Object.freeze({
        guardKind: normalizeEnumValue(
          readRequiredString(entry, 'guardKind'),
          GENERIC_ADMISSION_GUARD_INPUT_KINDS,
          `${field}.guardKind`,
        ) as GenericAdmissionGuardInputKind,
        sourceClass: normalizeEnumValue(
          readRequiredString(entry, 'sourceClass'),
          GENERIC_ADMISSION_GUARD_INPUT_SOURCE_CLASSES,
          `${field}.sourceClass`,
        ) as GenericAdmissionGuardInputSourceClass,
        assertionKinds: normalizeGenericGuardInputAssertionKinds(
          entry.assertionKinds,
          `${field}.assertionKinds`,
        ),
        ...(sourceRef === null ? {} : { sourceRef }),
        ...(sourceDigest === null ? {} : { sourceDigest }),
        ...(evidenceDigest === null ? {} : { evidenceDigest }),
        ...(tenantId === null ? {} : { tenantId }),
        ...(recordedAt === null ? {} : { recordedAt }),
        ...(trustedBoundary === null ? {} : { trustedBoundary }),
      });
    }),
  );
}

export function normalizeRequiredGuardInputProvenance(
  value: unknown,
): readonly GenericAdmissionGuardInputKind[] {
  if (value === undefined || value === null) return Object.freeze([]);
  if (!Array.isArray(value)) {
    throw new Error(
      'Consequence admission requiredGuardInputProvenance must be an array when provided.',
    );
  }
  const normalized = value.map((entry, index) => normalizeEnumValue(
    typeof entry === 'string' ? entry : String(entry),
    GENERIC_ADMISSION_GUARD_INPUT_KINDS,
    `requiredGuardInputProvenance[${index}]`,
  ));
  return Object.freeze([...new Set(normalized)].sort() as GenericAdmissionGuardInputKind[]);
}

export function normalizeGenericAuthoritySources(
  value: unknown,
): readonly GenericAdmissionAuthoritySource[] {
  if (value === undefined || value === null) return Object.freeze([]);
  if (!Array.isArray(value)) {
    throw new Error('Consequence admission authoritySources must be an array when provided.');
  }
  return Object.freeze(
    value.map((entry, index) => {
      const field = `authoritySources[${index}]`;
      if (!isRecord(entry)) {
        throw new Error(`Consequence admission ${field} must be an object.`);
      }
      const sourceKind = normalizeEnumValue(
        readRequiredString(entry, 'sourceKind'),
        CONSEQUENCE_UNTRUSTED_CONTENT_AUTHORITY_SOURCE_KINDS,
        `${field}.sourceKind`,
      );
      const claimKind = normalizeEnumValue(
        readRequiredString(entry, 'claimKind'),
        CONSEQUENCE_UNTRUSTED_CONTENT_AUTHORITY_CLAIM_KINDS,
        `${field}.claimKind`,
      );
      const trustClassValue = readOptionalString(entry, 'trustClass');
      const evidenceDigest = readOptionalString(entry, 'evidenceDigest');
      return Object.freeze({
        sourceKind,
        claimKind,
        sourceRef: readRequiredString(entry, 'sourceRef'),
        ...(trustClassValue === null
          ? {}
          : {
              trustClass: normalizeEnumValue(
                trustClassValue,
                CONSEQUENCE_UNTRUSTED_CONTENT_AUTHORITY_TRUST_CLASSES,
                `${field}.trustClass`,
              ),
            }),
        ...(evidenceDigest === null ? {} : { evidenceDigest }),
      });
    }),
  );
}

export function normalizeGenericApprovals(
  value: unknown,
): readonly GenericAdmissionApproval[] {
  if (value === undefined || value === null) return Object.freeze([]);
  if (!Array.isArray(value)) {
    throw new Error('Consequence admission approvals must be an array when provided.');
  }
  return Object.freeze(
    value.map((entry, index) => {
      const field = `approvals[${index}]`;
      if (!isRecord(entry)) {
        throw new Error(`Consequence admission ${field} must be an object.`);
      }
      const sourceKind = normalizeEnumValue(
        readRequiredString(entry, 'sourceKind'),
        CONSEQUENCE_APPROVAL_SOURCE_KINDS,
        `${field}.sourceKind`,
      );
      const stateValue = readOptionalString(entry, 'state');
      const sourceRef = readOptionalString(entry, 'sourceRef');
      const reviewerRef = readOptionalString(entry, 'reviewerRef');
      const reviewerAuthorityDigest = readOptionalString(entry, 'reviewerAuthorityDigest');
      const approvalDigest = readOptionalString(entry, 'approvalDigest');
      const scopeDigest = readOptionalString(entry, 'scopeDigest');
      const issuedAt = readOptionalTimestamp(entry, 'issuedAt');
      const expiresAt = readOptionalTimestamp(entry, 'expiresAt');
      const trustClassValue = readOptionalString(entry, 'trustClass');
      const signatureVerified = readOptionalBoolean(entry, 'signatureVerified');
      const stepUpVerified = readOptionalBoolean(entry, 'stepUpVerified');
      return Object.freeze({
        approvalRef: readRequiredString(entry, 'approvalRef'),
        sourceKind,
        ...(stateValue === null
          ? {}
          : {
              state: normalizeEnumValue(
                stateValue,
                CONSEQUENCE_APPROVAL_STATES,
                `${field}.state`,
              ),
            }),
        ...(sourceRef === null ? {} : { sourceRef }),
        ...(reviewerRef === null ? {} : { reviewerRef }),
        ...(reviewerAuthorityDigest === null ? {} : { reviewerAuthorityDigest }),
        ...(approvalDigest === null ? {} : { approvalDigest }),
        ...(scopeDigest === null ? {} : { scopeDigest }),
        ...(issuedAt === null ? {} : { issuedAt }),
        ...(expiresAt === null ? {} : { expiresAt }),
        ...(trustClassValue === null
          ? {}
          : {
              trustClass: normalizeEnumValue(
                trustClassValue,
                CONSEQUENCE_APPROVAL_TRUST_CLASSES,
                `${field}.trustClass`,
              ),
            }),
        ...(signatureVerified === null ? {} : { signatureVerified }),
        ...(stepUpVerified === null ? {} : { stepUpVerified }),
      });
    }),
  );
}

export function normalizeGenericNoGoConditions(
  value: unknown,
): readonly GenericAdmissionNoGoCondition[] | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) {
    throw new Error('Consequence admission noGoConditions must be an array when provided.');
  }
  return Object.freeze(
    value.map((entry, index) => {
      const field = `noGoConditions[${index}]`;
      if (!isRecord(entry)) {
        throw new Error(`Consequence admission ${field} must be an object.`);
      }
      const sourceRef = normalizeOptionalIdentifier(
        entry.sourceRef as string | null | undefined,
        `${field}.sourceRef`,
      );
      const ownerRef = normalizeOptionalIdentifier(
        entry.ownerRef as string | null | undefined,
        `${field}.ownerRef`,
      );
      const ownerAuthorityDigest = normalizeOptionalIdentifier(
        entry.ownerAuthorityDigest as string | null | undefined,
        `${field}.ownerAuthorityDigest`,
      );
      const scopeDigest = normalizeOptionalIdentifier(
        entry.scopeDigest as string | null | undefined,
        `${field}.scopeDigest`,
      );
      const issuedAt = normalizeOptionalIdentifier(
        entry.issuedAt as string | null | undefined,
        `${field}.issuedAt`,
      );
      const expiresAt = normalizeOptionalIdentifier(
        entry.expiresAt as string | null | undefined,
        `${field}.expiresAt`,
      );
      const releaseDigest = normalizeOptionalIdentifier(
        entry.releaseDigest as string | null | undefined,
        `${field}.releaseDigest`,
      );
      return Object.freeze({
        conditionRef: normalizeIdentifier(
          entry.conditionRef as string | null | undefined,
          `${field}.conditionRef`,
        ),
        kind: normalizeEnumValue(
          normalizeIdentifier(entry.kind as string | null | undefined, `${field}.kind`),
          CONSEQUENCE_NO_GO_CONDITION_KINDS,
          `${field}.kind`,
        ),
        state: normalizeEnumValue(
          normalizeIdentifier(entry.state as string | null | undefined, `${field}.state`),
          CONSEQUENCE_NO_GO_CONDITION_STATES,
          `${field}.state`,
        ),
        sourceKind: normalizeEnumValue(
          normalizeIdentifier(
            entry.sourceKind as string | null | undefined,
            `${field}.sourceKind`,
          ),
          CONSEQUENCE_NO_GO_CONDITION_SOURCE_KINDS,
          `${field}.sourceKind`,
        ),
        ...(sourceRef === null ? {} : { sourceRef }),
        ...(ownerRef === null ? {} : { ownerRef }),
        ...(ownerAuthorityDigest === null ? {} : { ownerAuthorityDigest }),
        ...(scopeDigest === null ? {} : { scopeDigest }),
        ...(issuedAt === null ? {} : { issuedAt }),
        ...(expiresAt === null ? {} : { expiresAt }),
        ...(releaseDigest === null ? {} : { releaseDigest }),
      });
    }),
  );
}
