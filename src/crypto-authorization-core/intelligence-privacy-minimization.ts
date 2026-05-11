import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
  consequenceDataMinimizationMaterialSafetyFindings,
} from '../consequence-admission/data-minimization-redaction-policy.js';

/**
 * Crypto intelligence privacy and telemetry minimization gate.
 *
 * This module is intentionally positioned above the existing data-minimization
 * policy. It adds crypto-specific leak classes while reusing the shared
 * consequence-admission scanner for secrets and raw-payload markers.
 */

export const CRYPTO_INTELLIGENCE_PRIVACY_MINIMIZATION_SPEC_VERSION =
  'attestor.crypto-intelligence-privacy-minimization.v1';

export const CRYPTO_INTELLIGENCE_PRIVACY_SURFACE_KINDS = [
  'risk-signal-assessment',
  'policy-gap-narrowing',
  'adapter-readiness-manifest',
  'adapter-readiness-intelligence-profile',
  'negative-conformance-fixtures',
  'admission-telemetry-event',
  'intelligence-dashboard-summary',
  'intelligence-performance-benchmark',
  'intelligence-proof-packet',
] as const;
export type CryptoIntelligencePrivacySurfaceKind =
  typeof CRYPTO_INTELLIGENCE_PRIVACY_SURFACE_KINDS[number];

export const CRYPTO_INTELLIGENCE_PRIVACY_ALLOWED_UNITS = [
  'reason-codes',
  'missing-evidence-classes',
  'safe-instructions',
  'scoped-refs',
  'digests',
  'counts',
  'statuses',
  'timestamps',
  'surface',
  'adapter-kind',
  'plan-digest',
  'fixture-id',
  'aggregate-risk-posture',
  'readiness-coverage',
  'model-safe-labels',
] as const;
export type CryptoIntelligencePrivacyAllowedUnit =
  typeof CRYPTO_INTELLIGENCE_PRIVACY_ALLOWED_UNITS[number];

export const CRYPTO_INTELLIGENCE_PRIVACY_FORBIDDEN_RAW_CLASSES = [
  'raw-wallet-metadata',
  'raw-transaction-payload',
  'raw-custody-callback-body',
  'raw-provider-error-body',
  'raw-provider-response-body',
  'raw-solver-route-secret',
  'raw-customer-identifier',
  'raw-private-policy-threshold',
  'private-policy-threshold',
  'raw-payment-header',
  'raw-idempotency-key',
  'raw-recipient-details',
  'credential-or-secret',
] as const;
export type CryptoIntelligencePrivacyForbiddenRawClass =
  typeof CRYPTO_INTELLIGENCE_PRIVACY_FORBIDDEN_RAW_CLASSES[number];

export const CRYPTO_INTELLIGENCE_PRIVACY_GOVERNANCE_REFS = [
  'attestor-consequence-data-minimization-policy',
  'nist-ai-rmf-risk-documentation',
  'nist-privacy-framework-minimize-risk',
  'owasp-llm02-sensitive-information-disclosure',
  'opentelemetry-opt-in-sensitive-or-high-cardinality-attributes',
] as const;
export type CryptoIntelligencePrivacyGovernanceRef =
  typeof CRYPTO_INTELLIGENCE_PRIVACY_GOVERNANCE_REFS[number];

export interface CryptoIntelligencePrivacySurfacePolicy {
  readonly surfaceKind: CryptoIntelligencePrivacySurfaceKind;
  readonly modelSafe: boolean;
  readonly allowedUnits: typeof CRYPTO_INTELLIGENCE_PRIVACY_ALLOWED_UNITS;
  readonly forbiddenRawClasses: typeof CRYPTO_INTELLIGENCE_PRIVACY_FORBIDDEN_RAW_CLASSES;
  readonly rawPayloadStored: false;
  readonly rawProviderResponseStored: false;
  readonly customerIdentifiersStored: false;
  readonly privatePolicyThresholdsStored: false;
  readonly solverRouteSecretsStored: false;
}

export interface CryptoIntelligencePrivacyFinding {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export interface EvaluateCryptoIntelligencePrivacyMinimizationArtifactInput {
  readonly surfaceKind: CryptoIntelligencePrivacySurfaceKind;
  readonly artifact: unknown;
  readonly rawPayloadStored?: boolean | null;
  readonly rawProviderResponseStored?: boolean | null;
  readonly customerIdentifiersStored?: boolean | null;
  readonly privatePolicyThresholdsStored?: boolean | null;
  readonly solverRouteSecretsStored?: boolean | null;
  readonly exposedRawClasses?: readonly CryptoIntelligencePrivacyForbiddenRawClass[] | null;
  readonly extraSensitiveMarkers?: readonly string[] | null;
}

export interface CryptoIntelligencePrivacyMinimizationEvaluation {
  readonly version: typeof CRYPTO_INTELLIGENCE_PRIVACY_MINIMIZATION_SPEC_VERSION;
  readonly surfaceKind: CryptoIntelligencePrivacySurfaceKind;
  readonly allowed: boolean;
  readonly failClosed: boolean;
  readonly modelSafe: boolean;
  readonly rawPayloadStored: false;
  readonly rawProviderResponseStored: false;
  readonly customerIdentifiersStored: false;
  readonly privatePolicyThresholdsStored: false;
  readonly solverRouteSecretsStored: false;
  readonly reasonCodes: readonly string[];
  readonly findings: readonly CryptoIntelligencePrivacyFinding[];
  readonly canonical: string;
  readonly digest: string;
}

export interface CryptoIntelligencePrivacyMinimizationDescriptor {
  readonly version: typeof CRYPTO_INTELLIGENCE_PRIVACY_MINIMIZATION_SPEC_VERSION;
  readonly upstreamPolicyVersion: typeof CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION;
  readonly surfaceKinds: typeof CRYPTO_INTELLIGENCE_PRIVACY_SURFACE_KINDS;
  readonly allowedUnits: typeof CRYPTO_INTELLIGENCE_PRIVACY_ALLOWED_UNITS;
  readonly forbiddenRawClasses: typeof CRYPTO_INTELLIGENCE_PRIVACY_FORBIDDEN_RAW_CLASSES;
  readonly governanceRefs: typeof CRYPTO_INTELLIGENCE_PRIVACY_GOVERNANCE_REFS;
  readonly surfaces: readonly CryptoIntelligencePrivacySurfacePolicy[];
  readonly modelFeedbackIsSafeOnly: true;
  readonly proofAndTelemetryAreDigestFirst: true;
  readonly rawPayloadStored: false;
  readonly rawProviderResponseStored: false;
  readonly customerIdentifiersStored: false;
  readonly privatePolicyThresholdsStored: false;
  readonly solverRouteSecretsStored: false;
}

interface ForbiddenFieldRule {
  readonly normalizedFieldName: string;
  readonly code: string;
  readonly message: string;
  readonly triggersOnTruthyOnly: boolean;
}

const FORBIDDEN_FIELD_RULES: readonly ForbiddenFieldRule[] = Object.freeze([
  fieldRule('rawPayload', 'raw-payload-field'),
  fieldRule('rawWalletMetadata', 'raw-wallet-metadata-field'),
  fieldRule('walletMetadataRaw', 'raw-wallet-metadata-field'),
  fieldRule('rawTransactionPayload', 'raw-transaction-payload-field'),
  fieldRule('transactionPayload', 'raw-transaction-payload-field'),
  fieldRule('custodyCallbackBody', 'raw-custody-callback-body-field'),
  fieldRule('rawCustodyCallbackBody', 'raw-custody-callback-body-field'),
  fieldRule('providerErrorBody', 'raw-provider-error-body-field'),
  fieldRule('rawProviderErrorBody', 'raw-provider-error-body-field'),
  fieldRule('providerResponseBody', 'raw-provider-response-body-field'),
  fieldRule('rawProviderResponseBody', 'raw-provider-response-body-field'),
  fieldRule('solverRouteSecret', 'raw-solver-route-secret-field'),
  fieldRule('rawSolverRouteSecret', 'raw-solver-route-secret-field'),
  fieldRule('routeSecret', 'raw-solver-route-secret-field'),
  fieldRule('privatePolicyThreshold', 'private-policy-threshold-field'),
  fieldRule('rawPrivatePolicyThreshold', 'private-policy-threshold-field'),
  fieldRule('customerIdentifier', 'raw-customer-identifier-field'),
  fieldRule('customerId', 'raw-customer-identifier-field'),
  fieldRule('rawCustomerIdentifier', 'raw-customer-identifier-field'),
  fieldRule('paymentHeader', 'raw-payment-header-field'),
  fieldRule('rawPaymentHeader', 'raw-payment-header-field'),
  fieldRule('idempotencyKey', 'raw-idempotency-key-field'),
  fieldRule('rawIdempotencyKey', 'raw-idempotency-key-field'),
  fieldRule('recipientDetails', 'raw-recipient-details-field'),
  fieldRule('rawRecipientDetails', 'raw-recipient-details-field'),
  fieldRule('rawPayloadStored', 'raw-payload-stored', true),
  fieldRule('rawProviderResponseStored', 'raw-provider-response-stored', true),
  fieldRule('customerIdentifiersStored', 'customer-identifiers-stored', true),
  fieldRule('privatePolicyThresholdsStored', 'private-policy-thresholds-stored', true),
  fieldRule('solverRouteSecretsStored', 'solver-route-secrets-stored', true),
]);

const SURFACE_POLICIES: readonly CryptoIntelligencePrivacySurfacePolicy[] =
  Object.freeze(
    CRYPTO_INTELLIGENCE_PRIVACY_SURFACE_KINDS.map((surfaceKind) =>
      Object.freeze({
        surfaceKind,
        modelSafe: true,
        allowedUnits: CRYPTO_INTELLIGENCE_PRIVACY_ALLOWED_UNITS,
        forbiddenRawClasses: CRYPTO_INTELLIGENCE_PRIVACY_FORBIDDEN_RAW_CLASSES,
        rawPayloadStored: false,
        rawProviderResponseStored: false,
        customerIdentifiersStored: false,
        privatePolicyThresholdsStored: false,
        solverRouteSecretsStored: false,
      }),
    ),
  );

function fieldRule(
  fieldName: string,
  code: string,
  triggersOnTruthyOnly = false,
): ForbiddenFieldRule {
  return Object.freeze({
    normalizedFieldName: normalizeFieldName(fieldName),
    code,
    message: `${fieldName} must not be present in crypto intelligence outputs.`,
    triggersOnTruthyOnly,
  });
}

function normalizeFieldName(value: string): string {
  return value.toLowerCase().replaceAll(/[^a-z0-9]/gu, '');
}

function canonicalObject(value: CanonicalReleaseJsonValue): {
  readonly canonical: string;
  readonly digest: string;
} {
  const canonical = canonicalizeReleaseJson(value);
  return Object.freeze({
    canonical,
    digest: `sha256:${createHash('sha256').update(canonical).digest('hex')}`,
  });
}

function materialForArtifact(artifact: unknown): string {
  try {
    return canonicalizeReleaseJson(artifact as CanonicalReleaseJsonValue);
  } catch {
    return JSON.stringify(artifact) ?? String(artifact);
  }
}

function ruleApplies(rule: ForbiddenFieldRule, value: unknown): boolean {
  if (!rule.triggersOnTruthyOnly) return true;
  return value !== false && value !== null && value !== undefined;
}

function scanForbiddenFields(
  value: unknown,
  path = '$',
): readonly CryptoIntelligencePrivacyFinding[] {
  if (value === null || value === undefined) return Object.freeze([]);
  if (Array.isArray(value)) {
    return Object.freeze(
      value.flatMap((entry, index) => scanForbiddenFields(entry, `${path}[${index}]`)),
    );
  }
  if (typeof value !== 'object') return Object.freeze([]);

  const findings: CryptoIntelligencePrivacyFinding[] = [];
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const normalizedKey = normalizeFieldName(key);
    const rule = FORBIDDEN_FIELD_RULES.find(
      (candidate) => candidate.normalizedFieldName === normalizedKey,
    );
    const entryPath = `${path}.${key}`;
    if (rule && ruleApplies(rule, entry)) {
      findings.push({
        code: rule.code,
        path: entryPath,
        message: rule.message,
      });
    }
    findings.push(...scanForbiddenFields(entry, entryPath));
  }

  return Object.freeze(findings);
}

function materialSafetyFindings(input: {
  readonly artifact: unknown;
  readonly surfaceKind: CryptoIntelligencePrivacySurfaceKind;
  readonly extraSensitiveMarkers?: readonly string[] | null;
}): readonly CryptoIntelligencePrivacyFinding[] {
  const findings = consequenceDataMinimizationMaterialSafetyFindings({
    material: materialForArtifact(input.artifact),
    findingSubject: input.surfaceKind,
    extraSensitiveMarkers: input.extraSensitiveMarkers ?? [],
  });

  const actionableFindings = findings.filter(
    (finding) => !finding.includes('private-policy-threshold'),
  );

  return Object.freeze(
    actionableFindings.map((_finding, index) => ({
      code: 'sensitive-marker-detected',
      path: `$material[${index}]`,
      message: 'Artifact material contains a forbidden sensitive marker.',
    })),
  );
}

function explicitFlagFindings(
  input: EvaluateCryptoIntelligencePrivacyMinimizationArtifactInput,
): readonly CryptoIntelligencePrivacyFinding[] {
  const findings: CryptoIntelligencePrivacyFinding[] = [];
  const rawFlags = [
    ['rawPayloadStored', input.rawPayloadStored, 'raw-payload-stored'],
    ['rawProviderResponseStored', input.rawProviderResponseStored, 'raw-provider-response-stored'],
    ['customerIdentifiersStored', input.customerIdentifiersStored, 'customer-identifiers-stored'],
    [
      'privatePolicyThresholdsStored',
      input.privatePolicyThresholdsStored,
      'private-policy-thresholds-stored',
    ],
    ['solverRouteSecretsStored', input.solverRouteSecretsStored, 'solver-route-secrets-stored'],
  ] as const;

  for (const [path, value, code] of rawFlags) {
    if (value === true) {
      findings.push({
        code,
        path: `$.${path}`,
        message: `${path} must remain false for crypto intelligence outputs.`,
      });
    }
  }

  for (const rawClass of input.exposedRawClasses ?? []) {
    findings.push({
      code: `forbidden-raw-class:${rawClass}`,
      path: '$.exposedRawClasses',
      message: 'Crypto intelligence output declares a forbidden raw data class.',
    });
  }

  return Object.freeze(findings);
}

function dedupeFindings(
  findings: readonly CryptoIntelligencePrivacyFinding[],
): readonly CryptoIntelligencePrivacyFinding[] {
  const byKey = new Map<string, CryptoIntelligencePrivacyFinding>();
  for (const finding of findings) {
    byKey.set(`${finding.code}\n${finding.path}`, finding);
  }
  return Object.freeze(
    [...byKey.values()].sort((left, right) =>
      `${left.code}:${left.path}`.localeCompare(`${right.code}:${right.path}`),
    ),
  );
}

export function cryptoIntelligencePrivacyMinimizationDescriptor():
CryptoIntelligencePrivacyMinimizationDescriptor {
  return Object.freeze({
    version: CRYPTO_INTELLIGENCE_PRIVACY_MINIMIZATION_SPEC_VERSION,
    upstreamPolicyVersion: CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
    surfaceKinds: CRYPTO_INTELLIGENCE_PRIVACY_SURFACE_KINDS,
    allowedUnits: CRYPTO_INTELLIGENCE_PRIVACY_ALLOWED_UNITS,
    forbiddenRawClasses: CRYPTO_INTELLIGENCE_PRIVACY_FORBIDDEN_RAW_CLASSES,
    governanceRefs: CRYPTO_INTELLIGENCE_PRIVACY_GOVERNANCE_REFS,
    surfaces: SURFACE_POLICIES,
    modelFeedbackIsSafeOnly: true,
    proofAndTelemetryAreDigestFirst: true,
    rawPayloadStored: false,
    rawProviderResponseStored: false,
    customerIdentifiersStored: false,
    privatePolicyThresholdsStored: false,
    solverRouteSecretsStored: false,
  });
}

export function evaluateCryptoIntelligencePrivacyMinimizationArtifact(
  input: EvaluateCryptoIntelligencePrivacyMinimizationArtifactInput,
): CryptoIntelligencePrivacyMinimizationEvaluation {
  const findings = dedupeFindings([
    ...scanForbiddenFields(input.artifact),
    ...materialSafetyFindings(input),
    ...explicitFlagFindings(input),
  ]);
  const reasonCodes = Object.freeze(
    [...new Set(findings.map((finding) => finding.code))].sort(),
  );
  const payload = {
    version: CRYPTO_INTELLIGENCE_PRIVACY_MINIMIZATION_SPEC_VERSION,
    surfaceKind: input.surfaceKind,
    modelSafe: true,
    rawPayloadStored: false,
    rawProviderResponseStored: false,
    customerIdentifiersStored: false,
    privatePolicyThresholdsStored: false,
    solverRouteSecretsStored: false,
    reasonCodes,
    findings,
  } as const;
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);

  return Object.freeze({
    ...payload,
    allowed: reasonCodes.length === 0,
    failClosed: reasonCodes.length > 0,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function assertCryptoIntelligencePrivacyMinimized(
  input: EvaluateCryptoIntelligencePrivacyMinimizationArtifactInput,
): CryptoIntelligencePrivacyMinimizationEvaluation {
  const evaluation = evaluateCryptoIntelligencePrivacyMinimizationArtifact(input);
  if (!evaluation.allowed) {
    throw new Error(
      `Crypto intelligence privacy minimization rejected ${input.surfaceKind}: ${evaluation.reasonCodes.join(', ')}`,
    );
  }
  return evaluation;
}
