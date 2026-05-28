import type {
  ReleaseTokenConfirmationClaim,
} from '../../release-layer/index.js';
import {
  DEFAULT_DPOP_CLOCK_SKEW_SECONDS,
  DEFAULT_DPOP_MAX_PROOF_AGE_SECONDS,
  DPOP_PRESENTATION_SPEC_VERSION,
  verifyDpopProof,
  type DpopProofVerification,
} from '../../release-enforcement-plane/dpop.js';
import type { EnforcementFailureReason } from '../../release-enforcement-plane/types.js';
import type { ReplayLedgerEntry } from '../../release-enforcement-plane/freshness.js';

export const HOSTED_GENERIC_ADMISSION_SENDER_CONFIRMATION_SPEC_VERSION =
  'attestor.hosted-generic-admission-sender-confirmation.v1';

export type HostedGenericAdmissionSenderConfirmationStatus =
  | 'valid'
  | 'missing'
  | 'invalid';

export interface HostedGenericAdmissionDpopSenderConfirmation {
  readonly version: typeof HOSTED_GENERIC_ADMISSION_SENDER_CONFIRMATION_SPEC_VERSION;
  readonly dpopVersion: typeof DPOP_PRESENTATION_SPEC_VERSION;
  readonly status: HostedGenericAdmissionSenderConfirmationStatus;
  readonly source: 'dpop-jkt' | 'none';
  readonly confirmation: ReleaseTokenConfirmationClaim | null;
  readonly proofJti: string | null;
  readonly publicKeyThumbprint: string | null;
  readonly replayKey: string | null;
  readonly replayChecked: boolean;
  readonly replayAccepted: boolean | null;
  readonly replayStoreDurability: 'local' | 'shared' | 'missing';
  readonly rawProofStored: false;
  readonly failureReasons: readonly string[];
  readonly reasonCodes: readonly string[];
}

export interface HostedGenericAdmissionDpopProofReplayClaimInput {
  readonly replayKey: string;
  readonly proofJti: string;
  readonly checkedAt: string;
  readonly expiresAt: string;
}

export interface HostedGenericAdmissionDpopProofReplayClaim {
  readonly accepted: boolean;
  readonly replayLedgerEntry: ReplayLedgerEntry | null;
  readonly rawProofStored: false;
}

export interface HostedGenericAdmissionDpopProofReplayStore {
  readonly durability: 'local' | 'shared';
  claimProofReplay(
    input: HostedGenericAdmissionDpopProofReplayClaimInput,
  ): HostedGenericAdmissionDpopProofReplayClaim | Promise<HostedGenericAdmissionDpopProofReplayClaim>;
}

export interface ResolveHostedGenericAdmissionDpopSenderConfirmationInput {
  readonly proofJwt?: string | null;
  readonly httpMethod: string;
  readonly httpUri: string;
  readonly now: string;
  readonly proofReplayStore?: HostedGenericAdmissionDpopProofReplayStore | null;
}

function normalizedHeader(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function resultFromVerification(
  verification: DpopProofVerification,
  replayClaim?: HostedGenericAdmissionDpopProofReplayClaim | null,
  replayStoreDurability: 'local' | 'shared' | 'missing' = 'missing',
): HostedGenericAdmissionDpopSenderConfirmation {
  const replayChecked = replayClaim !== undefined && replayClaim !== null;
  const replayAccepted = replayClaim?.accepted ?? null;
  if (verification.status !== 'valid' || verification.publicKeyThumbprint === null) {
    return Object.freeze({
      version: HOSTED_GENERIC_ADMISSION_SENDER_CONFIRMATION_SPEC_VERSION,
      dpopVersion: DPOP_PRESENTATION_SPEC_VERSION,
      status: 'invalid',
      source: 'none',
      confirmation: null,
      proofJti: verification.proofJti,
      publicKeyThumbprint: verification.publicKeyThumbprint,
      replayKey: verification.replayKey,
      replayChecked,
      replayAccepted,
      replayStoreDurability,
      rawProofStored: false,
      failureReasons: verification.failureReasons,
      reasonCodes: Object.freeze([
        'hosted-generic-admission-dpop-invalid',
        ...verification.failureReasons.map((reason) => `dpop-${reason}`),
      ]),
    });
  }

  return Object.freeze({
    version: HOSTED_GENERIC_ADMISSION_SENDER_CONFIRMATION_SPEC_VERSION,
    dpopVersion: DPOP_PRESENTATION_SPEC_VERSION,
    status: 'valid',
    source: 'dpop-jkt',
    confirmation: Object.freeze({ jkt: verification.publicKeyThumbprint }),
    proofJti: verification.proofJti,
    publicKeyThumbprint: verification.publicKeyThumbprint,
    replayKey: verification.replayKey,
    replayChecked,
    replayAccepted,
    replayStoreDurability,
    rawProofStored: false,
    failureReasons: Object.freeze([]),
    reasonCodes: Object.freeze(['hosted-generic-admission-dpop-valid']),
  });
}

function replayExpiresAt(checkedAt: string): string {
  return new Date(
    new Date(checkedAt).getTime() +
      (DEFAULT_DPOP_MAX_PROOF_AGE_SECONDS + DEFAULT_DPOP_CLOCK_SKEW_SECONDS) * 1000,
  ).toISOString();
}

function replayedVerification(
  verification: DpopProofVerification,
): DpopProofVerification {
  return Object.freeze({
    ...verification,
    status: 'invalid',
    failureReasons: Object.freeze([
      'replayed-authorization',
    ] as const satisfies readonly EnforcementFailureReason[]),
  });
}

function expired(entry: ReplayLedgerEntry, checkedAt: string): boolean {
  return new Date(entry.expiresAt).getTime() < new Date(checkedAt).getTime();
}

export function createInMemoryHostedGenericAdmissionDpopProofReplayStore():
  HostedGenericAdmissionDpopProofReplayStore {
  const entries = new Map<string, ReplayLedgerEntry>();

  return Object.freeze({
    durability: 'local',
    claimProofReplay(input: HostedGenericAdmissionDpopProofReplayClaimInput) {
      const existing = entries.get(input.replayKey);
      if (existing && !expired(existing, input.checkedAt)) {
        return Object.freeze({
          accepted: false,
          replayLedgerEntry: existing,
          rawProofStored: false,
        });
      }

      const entry: ReplayLedgerEntry = Object.freeze({
        subjectKind: 'dpop-proof',
        key: input.replayKey,
        firstSeenAt: input.checkedAt,
        expiresAt: input.expiresAt,
      });
      entries.set(input.replayKey, entry);

      return Object.freeze({
        accepted: true,
        replayLedgerEntry: entry,
        rawProofStored: false,
      });
    },
  });
}

export async function resolveHostedGenericAdmissionDpopSenderConfirmation(
  input: ResolveHostedGenericAdmissionDpopSenderConfirmationInput,
): Promise<HostedGenericAdmissionDpopSenderConfirmation> {
  const proofJwt = normalizedHeader(input.proofJwt);
  if (proofJwt === null) {
    return Object.freeze({
      version: HOSTED_GENERIC_ADMISSION_SENDER_CONFIRMATION_SPEC_VERSION,
      dpopVersion: DPOP_PRESENTATION_SPEC_VERSION,
      status: 'missing',
      source: 'none',
      confirmation: null,
      proofJti: null,
      publicKeyThumbprint: null,
      replayKey: null,
      replayChecked: false,
      replayAccepted: null,
      replayStoreDurability: input.proofReplayStore?.durability ?? 'missing',
      rawProofStored: false,
      failureReasons: Object.freeze(['missing-dpop-proof']),
      reasonCodes: Object.freeze(['hosted-generic-admission-dpop-missing']),
    });
  }

  const verification = await verifyDpopProof({
    proofJwt,
    httpMethod: input.httpMethod,
    httpUri: input.httpUri,
    now: input.now,
  });

  if (
    verification.status === 'valid' &&
    verification.proofJti !== null &&
    verification.replayKey !== null &&
    input.proofReplayStore
  ) {
    const replayClaim = await input.proofReplayStore.claimProofReplay({
      proofJti: verification.proofJti,
      replayKey: verification.replayKey,
      checkedAt: verification.checkedAt,
      expiresAt: replayExpiresAt(verification.checkedAt),
    });
    if (!replayClaim.accepted) {
      return resultFromVerification(
        replayedVerification(verification),
        replayClaim,
        input.proofReplayStore.durability,
      );
    }
    return resultFromVerification(verification, replayClaim, input.proofReplayStore.durability);
  }

  return resultFromVerification(verification);
}
