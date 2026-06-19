import type {
  GenericAdmissionAmount,
  GenericAdmissionDataScope,
  GenericAdmissionScopeInput,
  GenericAdmissionToolResult,
} from './contracts.js';
import {
  isRecord,
  normalizeEnumValue,
  normalizeIdentifier,
  normalizePositiveInteger,
  normalizeStringArray,
  readOptionalBoolean,
  readOptionalString,
  readOptionalTimestamp,
  readRequiredString,
} from './normalization.js';
import {
  CONSEQUENCE_SCOPE_EXPLOSION_DATA_CLASSES,
  CONSEQUENCE_SCOPE_EXPLOSION_OPERATION_TYPES,
  CONSEQUENCE_SCOPE_EXPLOSION_REVERSIBILITY_CLASSES,
} from './scope-explosion-guard.js';
import {
  CONSEQUENCE_TOOL_RESULT_EVIDENCE_CLASSES,
  CONSEQUENCE_TOOL_RESULT_RISK_LEVELS,
  CONSEQUENCE_TOOL_RESULT_SOURCE_TRUST_CLASSES,
  CONSEQUENCE_TOOL_RESULT_TOOL_KINDS,
  CONSEQUENCE_TOOL_RESULT_USE_KINDS,
} from './tool-result-poisoning-guard.js';

export function normalizeGenericAmount(value: unknown): GenericAdmissionAmount | null {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) {
    throw new Error('Consequence admission amount must be an object when provided.');
  }
  const rawAmount = value.value;
  if (typeof rawAmount !== 'string' && typeof rawAmount !== 'number') {
    throw new Error('Consequence admission amount.value must be a string or number.');
  }
  if (typeof rawAmount === 'number' && !Number.isFinite(rawAmount)) {
    throw new Error('Consequence admission amount.value must be finite.');
  }
  const amountValue =
    typeof rawAmount === 'string'
      ? normalizeIdentifier(rawAmount, 'amount.value')
      : rawAmount;

  return Object.freeze({
    value: amountValue,
    currency: readOptionalString(value, 'currency'),
    asset: readOptionalString(value, 'asset'),
    chain: readOptionalString(value, 'chain'),
  });
}

export function normalizeGenericDataScope(value: unknown): GenericAdmissionDataScope | null {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) {
    throw new Error('Consequence admission dataScope must be an object when provided.');
  }
  const rawRecords = value.records;
  if (
    rawRecords !== undefined &&
    rawRecords !== null &&
    (typeof rawRecords !== 'number' || !Number.isFinite(rawRecords) || rawRecords < 0)
  ) {
    throw new Error('Consequence admission dataScope.records must be a non-negative number.');
  }
  return Object.freeze({
    records: typeof rawRecords === 'number' ? rawRecords : null,
    classification: readOptionalString(value, 'classification'),
    fields: normalizeStringArray(value.fields, 'dataScope.fields'),
  });
}

export function normalizeOptionalNonNegativeFiniteNumber(
  value: unknown,
  fieldName: string,
): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(
      `Consequence admission ${fieldName} must be a non-negative finite number when provided.`,
    );
  }
  return value;
}

export function normalizeOptionalPositiveInteger(
  value: unknown,
  fieldName: string,
): number | null {
  if (value === undefined || value === null) return null;
  return normalizePositiveInteger(value, fieldName);
}

export function normalizeOptionalPositiveFiniteNumber(
  value: unknown,
  fieldName: string,
): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(
      `Consequence admission ${fieldName} must be a positive finite number when provided.`,
    );
  }
  return value;
}

export function normalizeOptionalEnumArray<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fieldName: string,
): readonly T[] | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) {
    throw new Error(`Consequence admission ${fieldName} must be an array when provided.`);
  }
  return Object.freeze(
    value.map((entry, index) => normalizeEnumValue(
      typeof entry === 'string' ? entry : String(entry),
      allowed,
      `${fieldName}[${index}]`,
    )),
  );
}

export function normalizeGenericScopeInput(
  value: unknown,
  fieldName: string,
): GenericAdmissionScopeInput | null {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) {
    throw new Error(`Consequence admission ${fieldName} must be an object when provided.`);
  }

  const operationType = readOptionalString(value, 'operationType');
  const dataClass = readOptionalString(value, 'dataClass');
  const reversibilityClass = readOptionalString(value, 'reversibilityClass');

  return Object.freeze({
    amountMinorUnits: normalizeOptionalNonNegativeFiniteNumber(
      value.amountMinorUnits,
      `${fieldName}.amountMinorUnits`,
    ),
    maxAmountMinorUnits: normalizeOptionalNonNegativeFiniteNumber(
      value.maxAmountMinorUnits,
      `${fieldName}.maxAmountMinorUnits`,
    ),
    currency: readOptionalString(value, 'currency'),
    recordCount: normalizeOptionalNonNegativeFiniteNumber(value.recordCount, `${fieldName}.recordCount`),
    maxRecordCount: normalizeOptionalNonNegativeFiniteNumber(
      value.maxRecordCount,
      `${fieldName}.maxRecordCount`,
    ),
    operationType: operationType === null
      ? null
      : normalizeEnumValue(
        operationType,
        CONSEQUENCE_SCOPE_EXPLOSION_OPERATION_TYPES,
        `${fieldName}.operationType`,
      ),
    operationTypes: normalizeOptionalEnumArray(
      value.operationTypes,
      CONSEQUENCE_SCOPE_EXPLOSION_OPERATION_TYPES,
      `${fieldName}.operationTypes`,
    ),
    recipientId: readOptionalString(value, 'recipientId'),
    recipientIds: value.recipientIds === undefined || value.recipientIds === null
      ? null
      : normalizeStringArray(value.recipientIds, `${fieldName}.recipientIds`),
    tenantId: readOptionalString(value, 'tenantId'),
    environment: readOptionalString(value, 'environment'),
    environments: value.environments === undefined || value.environments === null
      ? null
      : normalizeStringArray(value.environments, `${fieldName}.environments`),
    downstreamSystem: readOptionalString(value, 'downstreamSystem'),
    downstreamSystems:
      value.downstreamSystems === undefined || value.downstreamSystems === null
        ? null
        : normalizeStringArray(value.downstreamSystems, `${fieldName}.downstreamSystems`),
    dataClass: dataClass === null
      ? null
      : normalizeEnumValue(
        dataClass,
        CONSEQUENCE_SCOPE_EXPLOSION_DATA_CLASSES,
        `${fieldName}.dataClass`,
      ),
    dataClasses: normalizeOptionalEnumArray(
      value.dataClasses,
      CONSEQUENCE_SCOPE_EXPLOSION_DATA_CLASSES,
      `${fieldName}.dataClasses`,
    ),
    reversibilityClass: reversibilityClass === null
      ? null
      : normalizeEnumValue(
        reversibilityClass,
        CONSEQUENCE_SCOPE_EXPLOSION_REVERSIBILITY_CLASSES,
        `${fieldName}.reversibilityClass`,
      ),
    reversibilityClasses: normalizeOptionalEnumArray(
      value.reversibilityClasses,
      CONSEQUENCE_SCOPE_EXPLOSION_REVERSIBILITY_CLASSES,
      `${fieldName}.reversibilityClasses`,
    ),
  });
}

export function normalizeGenericToolResults(
  value: unknown,
): readonly GenericAdmissionToolResult[] | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) {
    throw new Error('Consequence admission toolResults must be an array when provided.');
  }
  return Object.freeze(
    value.map((entry, index) => {
      const field = `toolResults[${index}]`;
      if (!isRecord(entry)) {
        throw new Error(`Consequence admission ${field} must be an object.`);
      }
      const sourceRef = readOptionalString(entry, 'sourceRef');
      const sourceTimestamp = readOptionalTimestamp(entry, 'sourceTimestamp');
      const integrityDigest = readOptionalString(entry, 'integrityDigest');
      const evidenceDigest = readOptionalString(entry, 'evidenceDigest');
      const evidenceClass = readOptionalString(entry, 'evidenceClass');
      const allowedEvidenceClasses = normalizeOptionalEnumArray(
        entry.allowedEvidenceClasses,
        CONSEQUENCE_TOOL_RESULT_EVIDENCE_CLASSES,
        `${field}.allowedEvidenceClasses`,
      );
      const signatureVerified = readOptionalBoolean(entry, 'signatureVerified');
      const toolRisk = readOptionalString(entry, 'toolRisk');
      return Object.freeze({
        toolResultRef: readRequiredString(entry, 'toolResultRef'),
        toolKind: normalizeEnumValue(
          readRequiredString(entry, 'toolKind'),
          CONSEQUENCE_TOOL_RESULT_TOOL_KINDS,
          `${field}.toolKind`,
        ),
        sourceTrustClass: normalizeEnumValue(
          readRequiredString(entry, 'sourceTrustClass'),
          CONSEQUENCE_TOOL_RESULT_SOURCE_TRUST_CLASSES,
          `${field}.sourceTrustClass`,
        ),
        resultUse: normalizeEnumValue(
          readRequiredString(entry, 'resultUse'),
          CONSEQUENCE_TOOL_RESULT_USE_KINDS,
          `${field}.resultUse`,
        ),
        ...(sourceRef === null ? {} : { sourceRef }),
        ...(sourceTimestamp === null ? {} : { sourceTimestamp }),
        ...(integrityDigest === null ? {} : { integrityDigest }),
        ...(evidenceDigest === null ? {} : { evidenceDigest }),
        ...(evidenceClass === null
          ? {}
          : {
              evidenceClass: normalizeEnumValue(
                evidenceClass,
                CONSEQUENCE_TOOL_RESULT_EVIDENCE_CLASSES,
                `${field}.evidenceClass`,
              ),
            }),
        ...(allowedEvidenceClasses === null ? {} : { allowedEvidenceClasses }),
        ...(signatureVerified === null ? {} : { signatureVerified }),
        ...(toolRisk === null
          ? {}
          : {
              toolRisk: normalizeEnumValue(
                toolRisk,
                CONSEQUENCE_TOOL_RESULT_RISK_LEVELS,
                `${field}.toolRisk`,
              ),
            }),
      });
    }),
  );
}
