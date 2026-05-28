import type { ReplayLedgerEntry } from '../../release-enforcement-plane/freshness.js';
import {
  type HostedGenericAdmissionDpopProofReplayClaim,
  type HostedGenericAdmissionDpopProofReplayClaimInput,
  type HostedGenericAdmissionDpopProofReplayStore,
  createInMemoryHostedGenericAdmissionDpopProofReplayStore,
} from './hosted-generic-admission-sender-confirmation.js';
import {
  RELEASE_AUTHORITY_SCHEMA,
  ensureReleaseAuthorityStore,
  resetReleaseAuthorityStoreForTests,
  withReleaseAuthorityTransaction,
} from '../release/release-authority-store.js';
import type { AttestorRuntimeProfileId } from '../bootstrap/runtime-profile.js';

export const HOSTED_GENERIC_ADMISSION_DPOP_PROOF_REPLAY_COMPONENT =
  'generic-admission-dpop-proof-replay';
export const HOSTED_GENERIC_ADMISSION_DPOP_PROOF_REPLAY_TABLE =
  `${RELEASE_AUTHORITY_SCHEMA}.generic_admission_dpop_proof_replay_claims`;
export const SHARED_HOSTED_GENERIC_ADMISSION_DPOP_PROOF_REPLAY_STORE_VERSION = 1;

type PgQueryResultRow = Record<string, unknown>;

export interface SharedHostedGenericAdmissionDpopProofReplayStoreSummary {
  readonly component: typeof HOSTED_GENERIC_ADMISSION_DPOP_PROOF_REPLAY_COMPONENT;
  readonly table: typeof HOSTED_GENERIC_ADMISSION_DPOP_PROOF_REPLAY_TABLE;
  readonly totalRecords: number;
  readonly activeRecords: number;
  readonly expiredRecords: number;
  readonly rawProofStored: false;
}

export interface SharedHostedGenericAdmissionDpopProofReplayStore
  extends HostedGenericAdmissionDpopProofReplayStore {
  readonly durability: 'shared';
  summary(): Promise<SharedHostedGenericAdmissionDpopProofReplayStoreSummary>;
}

export class SharedHostedGenericAdmissionDpopProofReplayStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SharedHostedGenericAdmissionDpopProofReplayStoreError';
  }
}

let initPromise: Promise<void> | null = null;

function requireInteger(value: unknown, fieldName: string): number {
  if (typeof value === 'string' && /^-?\d+$/u.test(value)) {
    value = Number(value);
  }
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new SharedHostedGenericAdmissionDpopProofReplayStoreError(
      `Shared hosted DPoP proof replay row has invalid ${fieldName}.`,
    );
  }
  return value;
}

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new SharedHostedGenericAdmissionDpopProofReplayStoreError(
      `Shared hosted DPoP proof replay row has invalid ${fieldName}.`,
    );
  }
  return value.trim();
}

function normalizeIso(value: unknown, fieldName: string): string {
  const parsed =
    value instanceof Date
      ? value
      : new Date(requireString(value, fieldName));
  if (Number.isNaN(parsed.getTime())) {
    throw new SharedHostedGenericAdmissionDpopProofReplayStoreError(
      `Shared hosted DPoP proof replay row has invalid ${fieldName}.`,
    );
  }
  return parsed.toISOString();
}

function replayLedgerEntryFromRow(row: PgQueryResultRow): ReplayLedgerEntry {
  return Object.freeze({
    subjectKind: 'dpop-proof',
    key: requireString(row.replay_key, 'replay_key'),
    firstSeenAt: normalizeIso(row.first_seen_at, 'first_seen_at'),
    expiresAt: normalizeIso(row.expires_at, 'expires_at'),
  });
}

function normalizeClaimInput(
  input: HostedGenericAdmissionDpopProofReplayClaimInput,
): HostedGenericAdmissionDpopProofReplayClaimInput {
  const replayKey = requireString(input.replayKey, 'replayKey');
  const proofJti = requireString(input.proofJti, 'proofJti');
  const checkedAt = normalizeIso(input.checkedAt, 'checkedAt');
  const expiresAt = normalizeIso(input.expiresAt, 'expiresAt');
  if (new Date(expiresAt).getTime() <= new Date(checkedAt).getTime()) {
    throw new SharedHostedGenericAdmissionDpopProofReplayStoreError(
      'Shared hosted DPoP proof replay claim requires expiresAt after checkedAt.',
    );
  }
  return Object.freeze({ replayKey, proofJti, checkedAt, expiresAt });
}

async function ensureReplayTable(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await ensureReleaseAuthorityStore();
      await withReleaseAuthorityTransaction(async (client) => {
        await client.query(`
          CREATE TABLE IF NOT EXISTS ${HOSTED_GENERIC_ADMISSION_DPOP_PROOF_REPLAY_TABLE} (
            replay_key TEXT PRIMARY KEY,
            proof_jti TEXT NOT NULL,
            first_seen_at TIMESTAMPTZ NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL CHECK (expires_at > first_seen_at),
            record_json JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS generic_admission_dpop_proof_replay_expires_idx
            ON ${HOSTED_GENERIC_ADMISSION_DPOP_PROOF_REPLAY_TABLE} (expires_at ASC);
        `);
      });
    })().catch((error) => {
      initPromise = null;
      throw error;
    });
  }
  await initPromise;
}

async function claimProofReplay(
  input: HostedGenericAdmissionDpopProofReplayClaimInput,
): Promise<HostedGenericAdmissionDpopProofReplayClaim> {
  const claim = normalizeClaimInput(input);
  await ensureReplayTable();
  return withReleaseAuthorityTransaction(async (client) => {
    await client.query(
      `DELETE FROM ${HOSTED_GENERIC_ADMISSION_DPOP_PROOF_REPLAY_TABLE}
        WHERE replay_key = $1
          AND expires_at < $2::timestamptz`,
      [claim.replayKey, claim.checkedAt],
    );

    const entry: ReplayLedgerEntry = Object.freeze({
      subjectKind: 'dpop-proof',
      key: claim.replayKey,
      firstSeenAt: claim.checkedAt,
      expiresAt: claim.expiresAt,
    });
    const inserted = await client.query(
      `INSERT INTO ${HOSTED_GENERIC_ADMISSION_DPOP_PROOF_REPLAY_TABLE} (
        replay_key,
        proof_jti,
        first_seen_at,
        expires_at,
        record_json
      ) VALUES (
        $1,
        $2,
        $3::timestamptz,
        $4::timestamptz,
        $5::jsonb
      )
      ON CONFLICT (replay_key) DO NOTHING
      RETURNING replay_key, first_seen_at, expires_at`,
      [
        claim.replayKey,
        claim.proofJti,
        claim.checkedAt,
        claim.expiresAt,
        JSON.stringify(entry),
      ],
    );
    if (inserted.rows[0]) {
      return Object.freeze({
        accepted: true,
        replayLedgerEntry: replayLedgerEntryFromRow(inserted.rows[0]),
        rawProofStored: false,
      });
    }

    const existing = await client.query(
      `SELECT replay_key, first_seen_at, expires_at
         FROM ${HOSTED_GENERIC_ADMISSION_DPOP_PROOF_REPLAY_TABLE}
        WHERE replay_key = $1
        LIMIT 1`,
      [claim.replayKey],
    );
    return Object.freeze({
      accepted: false,
      replayLedgerEntry: existing.rows[0]
        ? replayLedgerEntryFromRow(existing.rows[0])
        : null,
      rawProofStored: false,
    });
  });
}

async function summary(): Promise<SharedHostedGenericAdmissionDpopProofReplayStoreSummary> {
  await ensureReplayTable();
  return withReleaseAuthorityTransaction(async (client) => {
    const result = await client.query(
      `SELECT COUNT(*)::int AS total_records,
              COUNT(*) FILTER (WHERE expires_at >= NOW())::int AS active_records,
              COUNT(*) FILTER (WHERE expires_at < NOW())::int AS expired_records
         FROM ${HOSTED_GENERIC_ADMISSION_DPOP_PROOF_REPLAY_TABLE}`,
    );
    const row = result.rows[0] ?? {};
    return Object.freeze({
      component: HOSTED_GENERIC_ADMISSION_DPOP_PROOF_REPLAY_COMPONENT,
      table: HOSTED_GENERIC_ADMISSION_DPOP_PROOF_REPLAY_TABLE,
      totalRecords: requireInteger(row.total_records ?? 0, 'total_records'),
      activeRecords: requireInteger(row.active_records ?? 0, 'active_records'),
      expiredRecords: requireInteger(row.expired_records ?? 0, 'expired_records'),
      rawProofStored: false,
    });
  });
}

export async function ensureSharedHostedGenericAdmissionDpopProofReplayStore(): Promise<
  SharedHostedGenericAdmissionDpopProofReplayStoreSummary
> {
  await ensureReplayTable();
  return summary();
}

export function createSharedHostedGenericAdmissionDpopProofReplayStore():
  SharedHostedGenericAdmissionDpopProofReplayStore {
  return Object.freeze({
    durability: 'shared',
    claimProofReplay,
    summary,
  });
}

export async function createRuntimeHostedGenericAdmissionDpopProofReplayStore(input: {
  readonly runtimeProfileId: AttestorRuntimeProfileId;
  readonly sharedAuthorityRequestPathReady: boolean;
}): Promise<HostedGenericAdmissionDpopProofReplayStore> {
  if (
    input.runtimeProfileId === 'production-shared' &&
    input.sharedAuthorityRequestPathReady
  ) {
    const store = createSharedHostedGenericAdmissionDpopProofReplayStore();
    await store.summary();
    return store;
  }
  return createInMemoryHostedGenericAdmissionDpopProofReplayStore();
}

export async function resetSharedHostedGenericAdmissionDpopProofReplayStoreForTests():
  Promise<void> {
  initPromise = null;
  await resetReleaseAuthorityStoreForTests();
}
