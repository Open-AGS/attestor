import {
  createHash,
} from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type {
  ConsequenceAdmissionCorrectionCatalog,
  ConsequenceAdmissionCorrectionCatalogEntry,
  ConsequenceAdmissionDecision,
  ConsequenceAdmissionFeedback,
  ConsequenceAdmissionFeedbackDisclosureLevel,
  ConsequenceAdmissionRetryBudgetEvaluation,
  ConsequenceAdmissionRetryGuidance,
  EvaluateConsequenceAdmissionRetryBudgetInput,
  GenericAdmissionMode,
} from './contracts.js';
import {
  CONSEQUENCE_ADMISSION_CORRECTION_CATALOG_VERSION,
  CONSEQUENCE_ADMISSION_RETRY_BINDING_FIELDS,
  CONSEQUENCE_ADMISSION_RETRY_DEFAULT_MAX_ATTEMPTS,
  CONSEQUENCE_ADMISSION_RETRY_DEFAULT_WINDOW_SECONDS,
  CONSEQUENCE_ADMISSION_RETRY_RULE_VERSION,
  GENERIC_ADMISSION_MODES,
} from './contracts.js';

import { CONSEQUENCE_ADMISSION_CORRECTION_CATALOG_ENTRIES } from './correction-catalog-entries.js';
export { CONSEQUENCE_ADMISSION_CORRECTION_CATALOG_ENTRIES } from './correction-catalog-entries.js';

function normalizeIdentifier(value: string | null | undefined, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Consequence admission ${fieldName} is required.`);
  }
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`Consequence admission ${fieldName} must not be empty.`);
  }
  return normalized;
}

function normalizeIsoTimestamp(value: string, fieldName: string): string {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    throw new Error(`Consequence admission ${fieldName} must be a valid timestamp.`);
  }
  return parsed.toISOString();
}

function canonicalObject<T extends CanonicalReleaseJsonValue>(value: T): {
  readonly canonical: string;
  readonly digest: string;
} {
  const canonical = canonicalizeReleaseJson(value);
  return Object.freeze({
    canonical,
    digest: `sha256:${createHash('sha256').update(canonical).digest('hex')}`,
  });
}

function readonlyCopy<T>(items: readonly T[] | null | undefined): readonly T[] {
  return Object.freeze([...(items ?? [])]);
}

function normalizePositiveInteger(value: unknown, fieldName: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new Error(`Consequence admission ${fieldName} must be a positive integer.`);
  }
  return value;
}

const ADMISSION_CORRECTION_HINTS:
Readonly<Record<string, ConsequenceAdmissionCorrectionCatalogEntry>> = Object.freeze(
  Object.fromEntries(
    CONSEQUENCE_ADMISSION_CORRECTION_CATALOG_ENTRIES.map((entry) => [
      entry.reasonCode,
      entry,
    ]),
  ) as Record<string, ConsequenceAdmissionCorrectionCatalogEntry>,
);

export function uniqueSortedStrings(items: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(items)].sort());
}

function admissionCorrectionHints(
  reasonCodes: readonly string[],
): readonly ConsequenceAdmissionCorrectionCatalogEntry[] {
  return Object.freeze(
    reasonCodes
      .map((code) => ADMISSION_CORRECTION_HINTS[code])
      .filter((hint): hint is ConsequenceAdmissionCorrectionCatalogEntry => hint !== undefined),
  );
}

export function consequenceAdmissionCorrectionCatalog():
ConsequenceAdmissionCorrectionCatalog {
  const entries = CONSEQUENCE_ADMISSION_CORRECTION_CATALOG_ENTRIES;
  return Object.freeze({
    version: CONSEQUENCE_ADMISSION_CORRECTION_CATALOG_VERSION,
    entries,
    reasonCodes: uniqueSortedStrings(entries.map((entry) => entry.reasonCode)),
    modelRetryableReasonCodes: uniqueSortedStrings(
      entries
        .filter((entry) => entry.retryableByModel && !entry.operatorOnly)
        .map((entry) => entry.reasonCode),
    ),
    operatorOnlyReasonCodes: uniqueSortedStrings(
      entries.filter((entry) => entry.operatorOnly).map((entry) => entry.reasonCode),
    ),
  });
}

export function consequenceAdmissionCorrectionForReason(
  reasonCode: string,
): ConsequenceAdmissionCorrectionCatalogEntry | null {
  const normalized = normalizeIdentifier(reasonCode, 'correction reasonCode');
  return ADMISSION_CORRECTION_HINTS[normalized] ?? null;
}

function admissionFeedbackInstruction(input: {
  readonly allowed: boolean;
  readonly retryAllowed: boolean;
  readonly operatorOnlyReasonCodes: readonly string[];
  readonly reasonCodes: readonly string[];
}): string {
  if (input.allowed && input.reasonCodes.length === 0) {
    return 'No correction is required. Do not retry solely to seek a different decision.';
  }
  if (input.retryAllowed) {
    return [
      'Retry only with bounded references for the missing fields.',
      'Do not include raw customer, bank, wallet, credential, secret, or private policy data.',
    ].join(' ');
  }
  if (input.operatorOnlyReasonCodes.length > 0) {
    return 'Do not retry automatically. Route the action to the customer review or operator boundary.';
  }
  if (input.allowed) {
    return 'Use the reason codes as shadow feedback. Do not include raw sensitive data in a retry.';
  }
  return 'Do not retry automatically without customer-controlled review.';
}

export function createAdmissionFeedback(input: {
  readonly allowed: boolean;
  readonly reasonCodes: readonly string[];
  readonly retryAllowed: boolean;
}): ConsequenceAdmissionFeedback {
  const hints = admissionCorrectionHints(input.reasonCodes);
  const missingFields = uniqueSortedStrings(hints.flatMap((hint) => [...hint.missingFields]));
  const requiredEvidenceKinds = uniqueSortedStrings(
    hints.flatMap((hint) => [...hint.requiredEvidenceKinds]),
  );
  const operatorOnlyReasonCodes = uniqueSortedStrings(
    input.reasonCodes.filter((code) => ADMISSION_CORRECTION_HINTS[code]?.operatorOnly === true),
  );
  const disclosureLevel: ConsequenceAdmissionFeedbackDisclosureLevel =
    missingFields.length > 0 || requiredEvidenceKinds.length > 0
      ? 'actionable'
      : 'minimal';

  return Object.freeze({
    disclosureLevel,
    safeForModel: true,
    reasonCodes: readonlyCopy(input.reasonCodes),
    missingFields,
    requiredEvidenceKinds,
    operatorOnlyReasonCodes,
    safeInstruction: admissionFeedbackInstruction({
      allowed: input.allowed,
      retryAllowed: input.retryAllowed,
      operatorOnlyReasonCodes,
      reasonCodes: input.reasonCodes,
    }),
  });
}

function genericModeFromOperationalContext(
  operationalContext: Readonly<Record<string, string | number | boolean | null>>,
): GenericAdmissionMode | null {
  const mode = operationalContext.mode;
  return typeof mode === 'string' && GENERIC_ADMISSION_MODES.includes(mode as GenericAdmissionMode)
    ? mode as GenericAdmissionMode
    : null;
}

function retryAllowedByReasonCodes(reasonCodes: readonly string[]): boolean {
  const hints = admissionCorrectionHints(reasonCodes);
  return hints.some((hint) => hint.retryableByModel) &&
    !hints.some((hint) => hint.operatorOnly);
}

function nonRetryableReasonCodes(reasonCodes: readonly string[]): readonly string[] {
  return uniqueSortedStrings(
    reasonCodes.filter((code) => ADMISSION_CORRECTION_HINTS[code]?.operatorOnly === true),
  );
}

export function createAdmissionRetryGuidance(input: {
  readonly decision: ConsequenceAdmissionDecision;
  readonly allowed: boolean;
  readonly reasonCodes: readonly string[];
  readonly operationalContext: Readonly<Record<string, string | number | boolean | null>>;
}): ConsequenceAdmissionRetryGuidance {
  const nonRetryable = nonRetryableReasonCodes(input.reasonCodes);
  const retryAllowed =
    input.decision === 'review' &&
    !input.allowed &&
    nonRetryable.length === 0 &&
    retryAllowedByReasonCodes(input.reasonCodes);
  const retryCategory: ConsequenceAdmissionRetryGuidance['retryCategory'] =
    input.allowed
      ? 'not-needed'
      : retryAllowed
        ? 'safe-correction'
        : input.decision === 'review'
          ? 'human-review-required'
          : 'not-retryable';

  return Object.freeze({
    retryAllowed,
    retryCategory,
    maxAttempts: retryAllowed ? CONSEQUENCE_ADMISSION_RETRY_DEFAULT_MAX_ATTEMPTS : 0,
    retryWindowSeconds: retryAllowed
      ? CONSEQUENCE_ADMISSION_RETRY_DEFAULT_WINDOW_SECONDS
      : null,
    nextAllowedMode: retryAllowed
      ? genericModeFromOperationalContext(input.operationalContext)
      : null,
    requiresChangedRequest: retryAllowed,
    sameRequestReplayAllowed: false,
    retryBindingRequired: retryAllowed,
    retryBindingFields: retryAllowed
      ? CONSEQUENCE_ADMISSION_RETRY_BINDING_FIELDS
      : Object.freeze([]),
    nonRetryableReasonCodes: nonRetryable,
  });
}

function retryBudgetNumber(
  value: number | null | undefined,
  fallback: number,
  fieldName: string,
): number {
  if (value === undefined || value === null) return fallback;
  return normalizePositiveInteger(value, fieldName);
}

function addSeconds(timestamp: string, seconds: number): string {
  return new Date(new Date(timestamp).getTime() + seconds * 1000).toISOString();
}

function retryBudgetInstruction(retryAllowed: boolean): string {
  if (retryAllowed) {
    return [
      'Bound retry may proceed as a correction attempt.',
      'The downstream system must still honor the new admission decision before execution.',
    ].join(' ');
  }
  return 'Do not retry automatically. Route the action to customer review or operator control.';
}

export function evaluateConsequenceAdmissionRetryBudget(
  input: EvaluateConsequenceAdmissionRetryBudgetInput,
): ConsequenceAdmissionRetryBudgetEvaluation {
  const previous = input.previousAdmission;
  const attempt = input.retryAttempt;
  const maxAttempts = retryBudgetNumber(
    input.maxAttempts,
    previous.retry.maxAttempts,
    'retryBudget.maxAttempts',
  );
  const retryWindowSeconds = retryBudgetNumber(
    input.retryWindowSeconds,
    previous.retry.retryWindowSeconds ?? CONSEQUENCE_ADMISSION_RETRY_DEFAULT_WINDOW_SECONDS,
    'retryBudget.retryWindowSeconds',
  );
  const evaluatedAt = normalizeIsoTimestamp(
    input.evaluatedAt ?? attempt.attemptedAt,
    'retryBudget.evaluatedAt',
  );
  const windowStartedAt = previous.decidedAt;
  const windowExpiresAt = addSeconds(windowStartedAt, retryWindowSeconds);
  const reasonCodes: string[] = [];

  if (!previous.retry.retryAllowed) {
    reasonCodes.push('previous-retry-not-allowed');
  }
  if (attempt.previousAdmissionId !== previous.admissionId) {
    reasonCodes.push('retry-previous-admission-id-mismatch');
  }
  if (attempt.previousAdmissionDigest !== previous.digest) {
    reasonCodes.push('retry-previous-admission-digest-mismatch');
  }
  if (attempt.previousRequestId !== previous.request.requestId) {
    reasonCodes.push('retry-previous-request-id-mismatch');
  }
  if (attempt.attemptNumber > maxAttempts) {
    reasonCodes.push('retry-budget-exhausted');
  }
  if (new Date(attempt.attemptedAt).getTime() < new Date(windowStartedAt).getTime()) {
    reasonCodes.push('retry-before-previous-decision');
  }
  if (new Date(attempt.attemptedAt).getTime() > new Date(windowExpiresAt).getTime()) {
    reasonCodes.push('retry-window-expired');
  }
  if (attempt.correctionReasonCodes.length === 0) {
    reasonCodes.push('retry-correction-reason-missing');
  }

  const previousFeedbackReasons = new Set(previous.feedback.reasonCodes);
  const unboundCorrectionReasons = attempt.correctionReasonCodes.filter(
    (reason) => !previousFeedbackReasons.has(reason),
  );
  if (unboundCorrectionReasons.length > 0) {
    reasonCodes.push('retry-correction-reason-unbound');
  }

  const previousOperatorOnlyReasons = new Set(previous.feedback.operatorOnlyReasonCodes);
  const operatorOnlyCorrectionReasons = attempt.correctionReasonCodes.filter((reason) =>
    previousOperatorOnlyReasons.has(reason),
  );
  if (operatorOnlyCorrectionReasons.length > 0) {
    reasonCodes.push('retry-operator-only-reason');
  }

  const retryAllowed = reasonCodes.length === 0;
  const payload = {
    version: CONSEQUENCE_ADMISSION_RETRY_RULE_VERSION,
    outcome: retryAllowed ? 'allow-retry' : 'hold-for-review',
    retryAllowed,
    failClosed: !retryAllowed,
    previousAdmissionId: previous.admissionId,
    previousAdmissionDigest: previous.digest,
    retryAttemptId: attempt.attemptId,
    attemptNumber: attempt.attemptNumber,
    maxAttempts,
    attemptsRemaining: Math.max(maxAttempts - attempt.attemptNumber, 0),
    retryWindowSeconds,
    windowStartedAt,
    windowExpiresAt,
    evaluatedAt,
    reasonCodes: uniqueSortedStrings(reasonCodes),
    safeInstruction: retryBudgetInstruction(retryAllowed),
  } satisfies Omit<ConsequenceAdmissionRetryBudgetEvaluation, 'canonical' | 'digest'>;
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);

  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}
