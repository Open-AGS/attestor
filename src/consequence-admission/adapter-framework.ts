import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type {
  ConsequenceAdmissionResponse,
} from './index.js';
import {
  ConsequenceAdmissionVerificationHeldError,
  createConsequenceAdmissionVerifier,
  type ConsequenceAdmissionVerification,
} from './verifier-helper.js';
import type {
  ConsequenceAdmissionDownstreamContract,
  ConsequenceAdmissionDownstreamObservation,
  CreateConsequenceAdmissionDownstreamContractInput,
} from './downstream-enforcement-contract.js';

export const CONSEQUENCE_ADMISSION_ADAPTER_FRAMEWORK_VERSION =
  'attestor.consequence-admission-adapter-framework.v1';

export const CONSEQUENCE_ADMISSION_ADAPTER_KINDS = [
  'http-handler',
  'message-consumer',
  'tool-wrapper',
  'mcp-tool-wrapper',
  'record-writer',
  'communication-sender',
  'action-dispatcher',
  'payment-adapter',
  'wallet-adapter',
  'artifact-exporter',
  'custom',
] as const;
export type ConsequenceAdmissionAdapterKind =
  typeof CONSEQUENCE_ADMISSION_ADAPTER_KINDS[number];

export const CONSEQUENCE_ADMISSION_ADAPTER_OUTCOMES = [
  'executed',
  'held',
  'execution-failed',
] as const;
export type ConsequenceAdmissionAdapterOutcome =
  typeof CONSEQUENCE_ADMISSION_ADAPTER_OUTCOMES[number];

export const CONSEQUENCE_ADMISSION_ADAPTER_FAILURE_REASONS = [
  'verification-held',
  'executor-threw',
] as const;
export type ConsequenceAdmissionAdapterFailureReason =
  typeof CONSEQUENCE_ADMISSION_ADAPTER_FAILURE_REASONS[number];

export interface ConsequenceAdmissionAdapterInvocation {
  readonly invocationId: string;
  readonly invokedAt: string;
  readonly idempotencyKeyDigest: string | null;
  readonly inputDigest: string | null;
  readonly rawInputStored: false;
}

export interface ConsequenceAdmissionAdapterExecutionRecord {
  readonly executedAt: string;
  readonly resultDigest: string;
  readonly rawResultStored: false;
}

export interface ConsequenceAdmissionAdapterDecision {
  readonly version: typeof CONSEQUENCE_ADMISSION_ADAPTER_FRAMEWORK_VERSION;
  readonly adapterId: string;
  readonly adapterKind: ConsequenceAdmissionAdapterKind;
  readonly outcome: ConsequenceAdmissionAdapterOutcome;
  readonly executed: boolean;
  readonly failClosed: boolean;
  readonly invocation: ConsequenceAdmissionAdapterInvocation;
  readonly verification: ConsequenceAdmissionVerification;
  readonly execution: ConsequenceAdmissionAdapterExecutionRecord | null;
  readonly failureReasons: readonly ConsequenceAdmissionAdapterFailureReason[];
  readonly reasonCodes: readonly string[];
  readonly reason: string;
  readonly instruction: string;
  readonly receiptDigest: string;
}

export interface RunConsequenceAdmissionAdapterInput<TResult extends CanonicalReleaseJsonValue> {
  readonly admission: ConsequenceAdmissionResponse;
  readonly observation?: ConsequenceAdmissionDownstreamObservation | null;
  readonly invocationId?: string | null;
  readonly invokedAt?: string | null;
  readonly inputDigest?: string | null;
  readonly idempotencyKey?: string | null;
  readonly execute: (verification: ConsequenceAdmissionVerification) => TResult;
}

export interface ConsequenceAdmissionProtectedAdapter {
  readonly version: typeof CONSEQUENCE_ADMISSION_ADAPTER_FRAMEWORK_VERSION;
  readonly adapterId: string;
  readonly adapterKind: ConsequenceAdmissionAdapterKind;
  readonly contract: ConsequenceAdmissionDownstreamContract;
  readonly rawExecuteExposed: false;
  readonly run: <TResult extends CanonicalReleaseJsonValue>(
    input: RunConsequenceAdmissionAdapterInput<TResult>,
  ) => ConsequenceAdmissionAdapterDecision;
}

export interface CreateConsequenceAdmissionProtectedAdapterInput {
  readonly adapterId: string;
  readonly adapterKind: ConsequenceAdmissionAdapterKind;
  readonly contract:
    | ConsequenceAdmissionDownstreamContract
    | CreateConsequenceAdmissionDownstreamContractInput;
  readonly verifierRef?: string | null;
  readonly now?: (() => string) | null;
}

export interface ConsequenceAdmissionAdapterFrameworkDescriptor {
  readonly version: typeof CONSEQUENCE_ADMISSION_ADAPTER_FRAMEWORK_VERSION;
  readonly adapterKinds: typeof CONSEQUENCE_ADMISSION_ADAPTER_KINDS;
  readonly outcomes: typeof CONSEQUENCE_ADMISSION_ADAPTER_OUTCOMES;
  readonly failureReasons: typeof CONSEQUENCE_ADMISSION_ADAPTER_FAILURE_REASONS;
  readonly verifiesBeforeExecute: true;
  readonly rawExecuteExposed: false;
  readonly storesRawInputsExternally: false;
  readonly storesRawResultsExternally: false;
  readonly failClosed: true;
}

function normalizeIdentifier(value: string | null | undefined, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Consequence admission adapter framework ${fieldName} requires a string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(
      `Consequence admission adapter framework ${fieldName} requires a non-empty value.`,
    );
  }
  return normalized;
}

function normalizeOptionalIdentifier(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) return null;
  return normalizeIdentifier(value, fieldName);
}

function normalizeIsoTimestamp(value: string, fieldName: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(
      `Consequence admission adapter framework ${fieldName} must be an ISO timestamp.`,
    );
  }
  return timestamp.toISOString();
}

function assertAdapterKind(value: ConsequenceAdmissionAdapterKind): void {
  if (!CONSEQUENCE_ADMISSION_ADAPTER_KINDS.includes(value)) {
    throw new Error(
      `Consequence admission adapter framework adapterKind must be one of: ${CONSEQUENCE_ADMISSION_ADAPTER_KINDS.join(', ')}.`,
    );
  }
}

function defaultNow(): string {
  return new Date().toISOString();
}

function digestValue(value: CanonicalReleaseJsonValue): string {
  const canonical = canonicalizeReleaseJson(value);
  return `sha256:${createHash('sha256').update(canonical).digest('hex')}`;
}

function digestText(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function invocationIdFor(input: {
  readonly adapterId: string;
  readonly adapterKind: ConsequenceAdmissionAdapterKind;
  readonly admissionId: string;
  readonly admissionDigest: string;
  readonly idempotencyKey: string | null;
  readonly inputDigest: string | null;
}): string {
  return `adapter-invocation:${digestValue({
    version: CONSEQUENCE_ADMISSION_ADAPTER_FRAMEWORK_VERSION,
    adapterId: input.adapterId,
    adapterKind: input.adapterKind,
    admissionId: input.admissionId,
    admissionDigest: input.admissionDigest,
    idempotencyKey: input.idempotencyKey,
    inputDigest: input.inputDigest,
  } as CanonicalReleaseJsonValue)}`;
}

function orderedFailureReasons(
  reasons: readonly ConsequenceAdmissionAdapterFailureReason[],
): readonly ConsequenceAdmissionAdapterFailureReason[] {
  const present = new Set(reasons);
  return Object.freeze(
    CONSEQUENCE_ADMISSION_ADAPTER_FAILURE_REASONS.filter((reason) =>
      present.has(reason),
    ),
  );
}

function reasonFor(
  outcome: ConsequenceAdmissionAdapterOutcome,
  failureReasons: readonly ConsequenceAdmissionAdapterFailureReason[],
): string {
  if (outcome === 'executed') {
    return 'Protected adapter verified the Attestor admission before executing the downstream operation.';
  }
  if (failureReasons.includes('verification-held')) {
    return 'Protected adapter held the downstream operation because Attestor verification did not allow it.';
  }
  if (failureReasons.includes('executor-threw')) {
    return 'Protected adapter recorded a downstream execution failure after verification allowed the operation.';
  }
  return 'Protected adapter held the downstream operation because the protected execution boundary could not close.';
}

function receiptDigest(input: {
  readonly adapterId: string;
  readonly adapterKind: ConsequenceAdmissionAdapterKind;
  readonly outcome: ConsequenceAdmissionAdapterOutcome;
  readonly invocation: ConsequenceAdmissionAdapterInvocation;
  readonly verificationDigest: string;
  readonly executionDigest: string | null;
  readonly failureReasons: readonly ConsequenceAdmissionAdapterFailureReason[];
}): string {
  const payload: CanonicalReleaseJsonValue = {
    version: CONSEQUENCE_ADMISSION_ADAPTER_FRAMEWORK_VERSION,
    adapterId: input.adapterId,
    adapterKind: input.adapterKind,
    outcome: input.outcome,
    invocation: {
      invocationId: input.invocation.invocationId,
      invokedAt: input.invocation.invokedAt,
      idempotencyKeyDigest: input.invocation.idempotencyKeyDigest,
      inputDigest: input.invocation.inputDigest,
      rawInputStored: input.invocation.rawInputStored,
    },
    verificationDigest: input.verificationDigest,
    executionDigest: input.executionDigest,
    failureReasons: [...input.failureReasons],
  };
  return digestValue(payload);
}

function decision(input: {
  readonly adapterId: string;
  readonly adapterKind: ConsequenceAdmissionAdapterKind;
  readonly outcome: ConsequenceAdmissionAdapterOutcome;
  readonly invocation: ConsequenceAdmissionAdapterInvocation;
  readonly verification: ConsequenceAdmissionVerification;
  readonly execution: ConsequenceAdmissionAdapterExecutionRecord | null;
  readonly failureReasons: readonly ConsequenceAdmissionAdapterFailureReason[];
}): ConsequenceAdmissionAdapterDecision {
  const failureReasons = orderedFailureReasons(input.failureReasons);
  const digest = receiptDigest({
    adapterId: input.adapterId,
    adapterKind: input.adapterKind,
    outcome: input.outcome,
    invocation: input.invocation,
    verificationDigest: input.verification.receiptDigest,
    executionDigest: input.execution?.resultDigest ?? null,
    failureReasons,
  });

  return Object.freeze({
    version: CONSEQUENCE_ADMISSION_ADAPTER_FRAMEWORK_VERSION,
    adapterId: input.adapterId,
    adapterKind: input.adapterKind,
    outcome: input.outcome,
    executed: input.outcome === 'executed',
    failClosed: input.outcome !== 'executed',
    invocation: input.invocation,
    verification: input.verification,
    execution: input.execution,
    failureReasons,
    reasonCodes: Object.freeze([
      ...input.verification.reasonCodes,
      ...failureReasons.map((reason) => `adapter-framework-${reason}`),
      `adapter-framework-${input.outcome}`,
    ]),
    reason: reasonFor(input.outcome, failureReasons),
    instruction: input.outcome === 'executed'
      ? `Protected adapter executed: ${input.adapterId}`
      : `Protected adapter did not execute: ${input.adapterId}`,
    receiptDigest: digest,
  });
}

function errorDigest(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return digestText(message);
}

export function createConsequenceAdmissionProtectedAdapter(
  input: CreateConsequenceAdmissionProtectedAdapterInput,
): ConsequenceAdmissionProtectedAdapter {
  assertAdapterKind(input.adapterKind);
  const adapterId = normalizeIdentifier(input.adapterId, 'adapterId');
  const now = input.now ?? defaultNow;
  const verifier = createConsequenceAdmissionVerifier({
    contract: input.contract,
    verifierRef: input.verifierRef ?? adapterId,
    now,
  });

  function run<TResult extends CanonicalReleaseJsonValue>(
    runInput: RunConsequenceAdmissionAdapterInput<TResult>,
  ): ConsequenceAdmissionAdapterDecision {
    const invokedAt = normalizeIsoTimestamp(runInput.invokedAt ?? now(), 'invokedAt');
    const idempotencyKey = normalizeOptionalIdentifier(
      runInput.idempotencyKey ?? runInput.observation?.idempotencyKey,
      'idempotencyKey',
    );
    const inputDigest = normalizeOptionalIdentifier(runInput.inputDigest, 'inputDigest');
    const invocation = Object.freeze({
      invocationId: normalizeOptionalIdentifier(runInput.invocationId, 'invocationId') ??
        invocationIdFor({
          adapterId,
          adapterKind: input.adapterKind,
          admissionId: runInput.admission.admissionId,
          admissionDigest: runInput.admission.digest,
          idempotencyKey,
          inputDigest,
        }),
      invokedAt,
      idempotencyKeyDigest: idempotencyKey === null ? null : digestText(idempotencyKey),
      inputDigest,
      rawInputStored: false as const,
    });

    try {
      const verification = verifier.assert({
        admission: runInput.admission,
        observation: {
          ...(runInput.observation ?? {}),
          idempotencyKey: idempotencyKey ?? runInput.observation?.idempotencyKey ?? null,
        },
        verifiedAt: invokedAt,
      });
      try {
        const result = runInput.execute(verification);
        const execution = Object.freeze({
          executedAt: invokedAt,
          resultDigest: digestValue(result),
          rawResultStored: false as const,
        });
        return decision({
          adapterId,
          adapterKind: input.adapterKind,
          outcome: 'executed',
          invocation,
          verification,
          execution,
          failureReasons: [],
        });
      } catch (error) {
        const execution = Object.freeze({
          executedAt: invokedAt,
          resultDigest: errorDigest(error),
          rawResultStored: false as const,
        });
        return decision({
          adapterId,
          adapterKind: input.adapterKind,
          outcome: 'execution-failed',
          invocation,
          verification,
          execution,
          failureReasons: ['executor-threw'],
        });
      }
    } catch (error) {
      if (!(error instanceof ConsequenceAdmissionVerificationHeldError)) {
        throw error;
      }
      return decision({
        adapterId,
        adapterKind: input.adapterKind,
        outcome: 'held',
        invocation,
        verification: error.verification,
        execution: null,
        failureReasons: ['verification-held'],
      });
    }
  }

  return Object.freeze({
    version: CONSEQUENCE_ADMISSION_ADAPTER_FRAMEWORK_VERSION,
    adapterId,
    adapterKind: input.adapterKind,
    contract: verifier.contract,
    rawExecuteExposed: false,
    run,
  });
}

export function consequenceAdmissionAdapterFrameworkDescriptor():
ConsequenceAdmissionAdapterFrameworkDescriptor {
  return Object.freeze({
    version: CONSEQUENCE_ADMISSION_ADAPTER_FRAMEWORK_VERSION,
    adapterKinds: CONSEQUENCE_ADMISSION_ADAPTER_KINDS,
    outcomes: CONSEQUENCE_ADMISSION_ADAPTER_OUTCOMES,
    failureReasons: CONSEQUENCE_ADMISSION_ADAPTER_FAILURE_REASONS,
    verifiesBeforeExecute: true,
    rawExecuteExposed: false,
    storesRawInputsExternally: false,
    storesRawResultsExternally: false,
    failClosed: true,
  });
}
