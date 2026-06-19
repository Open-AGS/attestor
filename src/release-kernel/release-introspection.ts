import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { withFileLock, writeTextFileAtomic } from '../platform/file-store.js';
import type { ReleaseTokenClaims } from './object-model.js';
import { releaseDecisionMaxUses } from './object-model.js';
import {
  freezeReleaseDecisionRevocation,
  normalizeReleaseLifecycleText,
  releaseDecisionRevocationRecordFor,
} from './release-decision-revocation.js';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from './release-canonicalization.js';
import {
  ReleaseTokenVerificationFailure as ReleaseTokenVerificationFailureError,
  verifyIssuedReleaseToken,
} from './release-token.js';
import {
  ATTESTOR_RELEASE_TOKEN_INTROSPECTION_STORE_PATH_ENV,
  DEFAULT_RELEASE_TOKEN_TYPE_HINT,
  RELEASE_TOKEN_INTROSPECTION_SPEC_VERSION,
  RELEASE_TOKEN_REGISTRY_SPEC_VERSION,
  ReleaseTokenIntrospectionStoreError,
  type AwaitableReleaseTokenIntrospectionStore,
  type InactiveReleaseTokenIntrospectionResult,
  type RecordReleaseTokenUseInput,
  type RecordedReleaseTokenUseResult,
  type RegisteredReleaseToken,
  type RegisterIssuedReleaseTokenInput,
  type ReleaseTokenInactiveReason,
  type ReleaseTokenIntrospectionInput,
  type ReleaseTokenIntrospectionPolicyContext,
  type ReleaseTokenIntrospectionResult,
  type ReleaseTokenIntrospectionStore,
  type ReleaseTokenIntrospector,
  type ReleaseDecisionRevocationRecord,
  type RevokeReleaseTokensForDecisionInput,
  type RevokeReleaseTokensForDecisionResult,
  type RevokeReleaseTokenInput,
  type SupportedReleaseTokenTypeHint,
} from './release-introspection-types.js';

export {
  ATTESTOR_RELEASE_TOKEN_INTROSPECTION_STORE_PATH_ENV,
  DEFAULT_RELEASE_TOKEN_TYPE_HINT,
  RELEASE_TOKEN_INTROSPECTION_SPEC_VERSION,
  RELEASE_TOKEN_REGISTRY_SPEC_VERSION,
  ReleaseTokenIntrospectionStoreError,
} from './release-introspection-types.js';
export type {
  ActiveReleaseTokenIntrospectionResult,
  AwaitableReleaseTokenIntrospectionStore,
  InactiveReleaseTokenIntrospectionResult,
  RecordReleaseTokenUseInput,
  RecordedReleaseTokenUseResult,
  RegisteredReleaseToken,
  RegisterIssuedReleaseTokenInput,
  ReleaseTokenInactiveReason,
  ReleaseTokenIntrospectionInput,
  ReleaseTokenIntrospectionPolicyContext,
  ReleaseTokenIntrospectionResult,
  ReleaseTokenIntrospectionStore,
  ReleaseTokenIntrospector,
  ReleaseTokenRegistryStatus,
  ReleaseDecisionRevocationRecord,
  RevokeReleaseTokensForDecisionInput,
  RevokeReleaseTokensForDecisionResult,
  RevokeReleaseTokenInput,
  SupportedReleaseTokenTypeHint,
} from './release-introspection-types.js';

const DEFAULT_RELEASE_TOKEN_INTROSPECTION_STORE_PATH =
  '.attestor/release-token-introspection-store.json';

interface ReleaseTokenIntrospectionStoreFile {
  readonly version: 1;
  records: RegisteredReleaseToken[];
  decisionRevocations: ReleaseDecisionRevocationRecord[];
}

function introspectionTimestamp(currentDate?: string): string {
  if (!currentDate) {
    return new Date().toISOString();
  }

  const parsed = new Date(currentDate);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Release token introspection requires a valid currentDate when provided.');
  }
  return parsed.toISOString();
}

function inactiveReleaseTokenIntrospection(
  reason: ReleaseTokenInactiveReason,
  currentDate?: string,
  resourceServerId?: string,
): InactiveReleaseTokenIntrospectionResult {
  return {
    version: RELEASE_TOKEN_INTROSPECTION_SPEC_VERSION,
    active: false,
    inactive_reason: reason,
    token_type: DEFAULT_RELEASE_TOKEN_TYPE_HINT,
    checked_at: introspectionTimestamp(currentDate),
    resource_server_id: resourceServerId ?? null,
  };
}

function releaseTokenIntrospectionPolicyContext(
  claims: ReleaseTokenClaims,
): ReleaseTokenIntrospectionPolicyContext {
  return Object.freeze({
    policy_hash: claims.policy_hash,
    ...(claims.policy_version ? { policy_version: claims.policy_version } : {}),
    ...(claims.policy_ir_hash ? { policy_ir_hash: claims.policy_ir_hash } : {}),
    ...(claims.policy_provenance_source
      ? { policy_provenance_source: claims.policy_provenance_source }
      : {}),
    ...(claims.compiled_policy_index_version
      ? { compiled_policy_index_version: claims.compiled_policy_index_version }
      : {}),
    ...(claims.compiled_policy_ir_version
      ? { compiled_policy_ir_version: claims.compiled_policy_ir_version }
      : {}),
  });
}

function normalizeSupportedTokenTypeHint(
  tokenTypeHint?: string,
): SupportedReleaseTokenTypeHint | null {
  if (!tokenTypeHint) return null;
  return (
    tokenTypeHint === DEFAULT_RELEASE_TOKEN_TYPE_HINT ||
    tokenTypeHint === 'access_token'
  ) ? tokenTypeHint : null;
}

function registeredReleaseTokenMatchesClaims(
  record: RegisteredReleaseToken,
  claims: ReleaseTokenClaims,
): boolean {
  return (
    record.tokenId === claims.jti &&
    record.issuer === claims.iss &&
    record.subject === claims.sub &&
    record.audience === claims.aud &&
    (record.tenantId ?? null) === (claims.tenant_id ?? null) &&
    record.decisionId === claims.decision_id &&
    record.decisionStatus === claims.decision &&
    record.consequenceType === claims.consequence_type &&
    record.riskClass === claims.risk_class &&
    record.outputHash === claims.output_hash &&
    record.consequenceHash === claims.consequence_hash &&
    record.policyHash === claims.policy_hash &&
    (record.policyVersion ?? null) === (claims.policy_version ?? null) &&
    (record.policyIrHash ?? null) === (claims.policy_ir_hash ?? null) &&
    (record.policyProvenanceSource ?? null) === (claims.policy_provenance_source ?? null) &&
    (record.compiledPolicyIndexVersion ?? null) ===
      (claims.compiled_policy_index_version ?? null) &&
    (record.compiledPolicyIrVersion ?? null) === (claims.compiled_policy_ir_version ?? null) &&
    record.override === claims.override &&
    record.introspectionRequired === claims.introspection_required &&
    record.authorityMode === claims.authority_mode
  );
}

function inactiveReasonForRegisteredReleaseToken(
  record: RegisteredReleaseToken,
): ReleaseTokenInactiveReason {
  switch (record.status) {
    case 'revoked':
      return 'revoked';
    case 'expired':
      return 'expired';
    case 'consumed':
      return 'usage_exhausted';
    case 'issued':
    default:
      return 'invalid';
  }
}

function buildRegisteredReleaseToken(
  input: RegisterIssuedReleaseTokenInput,
): RegisteredReleaseToken {
  const { issuedToken, decision } = input;
  return Object.freeze({
    version: RELEASE_TOKEN_REGISTRY_SPEC_VERSION,
    status: 'issued',
    statusChangedAt: issuedToken.issuedAt,
    tokenId: issuedToken.tokenId,
    issuer: issuedToken.claims.iss,
    subject: issuedToken.claims.sub,
    audience: issuedToken.claims.aud,
    tenantId: issuedToken.claims.tenant_id ?? null,
    issuedAt: issuedToken.issuedAt,
    notBefore: new Date(issuedToken.claims.nbf * 1000).toISOString(),
    expiresAt: issuedToken.expiresAt,
    decisionId: decision.id,
    decisionStatus: decision.status,
    consequenceType: decision.consequenceType,
    riskClass: decision.riskClass,
    outputHash: decision.outputHash,
    consequenceHash: decision.consequenceHash,
    policyHash: decision.policyHash,
    policyVersion: issuedToken.claims.policy_version ?? decision.policyVersion,
    policyIrHash:
      issuedToken.claims.policy_ir_hash ??
      decision.policyProvenance?.compiledPolicyIrHash ??
      null,
    policyProvenanceSource:
      issuedToken.claims.policy_provenance_source ??
      decision.policyProvenance?.source ??
      null,
    compiledPolicyIndexVersion:
      issuedToken.claims.compiled_policy_index_version ??
      decision.policyProvenance?.compiledPolicyIndexVersion ??
      null,
    compiledPolicyIrVersion:
      issuedToken.claims.compiled_policy_ir_version ??
      decision.policyProvenance?.compiledPolicyIrVersion ??
      null,
    override: decision.override !== null || decision.status === 'overridden',
    introspectionRequired: issuedToken.claims.introspection_required,
    authorityMode: decision.reviewAuthority.mode,
    keyId: issuedToken.keyId,
    publicKeyFingerprint: issuedToken.publicKeyFingerprint,
    maxUses: Math.max(1, releaseDecisionMaxUses(decision) ?? 1),
    useCount: 0,
    firstUsedAt: null,
    lastUsedAt: null,
    lastUsedByResourceServerId: null,
    revokedAt: null,
    revocationReason: null,
    revokedBy: null,
    expiredAt: null,
  });
}

function freezeRegisteredReleaseToken(record: RegisteredReleaseToken): RegisteredReleaseToken {
  return Object.freeze({
    ...record,
  });
}

function defaultReleaseTokenIntrospectionStoreFile(): ReleaseTokenIntrospectionStoreFile {
  return {
    version: 1,
    records: [],
    decisionRevocations: [],
  };
}

function defaultReleaseTokenIntrospectionStorePath(): string {
  return resolve(
    process.env[ATTESTOR_RELEASE_TOKEN_INTROSPECTION_STORE_PATH_ENV] ??
      DEFAULT_RELEASE_TOKEN_INTROSPECTION_STORE_PATH,
  );
}

function ensureReleaseTokenIntrospectionStoreDirectory(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
}

function normalizeReleaseTokenIntrospectionStoreFile(
  value: unknown,
  path: string,
): ReleaseTokenIntrospectionStoreFile {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    (value as { version?: unknown }).version !== 1 ||
    !Array.isArray((value as { records?: unknown }).records) ||
    (
      (value as { decisionRevocations?: unknown }).decisionRevocations !== undefined &&
      !Array.isArray((value as { decisionRevocations?: unknown }).decisionRevocations)
    )
  ) {
    throw new ReleaseTokenIntrospectionStoreError(
      `Release token introspection store '${path}' has an invalid file shape.`,
    );
  }

  return {
    version: 1,
    records: (value as { records: RegisteredReleaseToken[] }).records.map((record) =>
      freezeRegisteredReleaseToken(record),
    ),
    decisionRevocations: (
      value as { decisionRevocations?: ReleaseDecisionRevocationRecord[] }
    ).decisionRevocations?.map((record) =>
      freezeReleaseDecisionRevocation(record, introspectionTimestamp)
    ) ?? [],
  };
}

function loadReleaseTokenIntrospectionStoreFile(
  path: string,
): ReleaseTokenIntrospectionStoreFile {
  ensureReleaseTokenIntrospectionStoreDirectory(path);
  if (!existsSync(path)) return defaultReleaseTokenIntrospectionStoreFile();

  try {
    return normalizeReleaseTokenIntrospectionStoreFile(
      JSON.parse(readFileSync(path, 'utf8')) as unknown,
      path,
    );
  } catch (error) {
    if (error instanceof ReleaseTokenIntrospectionStoreError) throw error;
    throw new ReleaseTokenIntrospectionStoreError(
      `Release token introspection store '${path}' could not be parsed.`,
    );
  }
}

function saveReleaseTokenIntrospectionStoreFile(
  path: string,
  file: ReleaseTokenIntrospectionStoreFile,
): void {
  writeTextFileAtomic(
    path,
    `${JSON.stringify(
      {
        version: 1,
        records: file.records,
        decisionRevocations: file.decisionRevocations,
      },
      null,
      2,
    )}\n`,
  );
}

function writeRegisteredReleaseToken(
  file: ReleaseTokenIntrospectionStoreFile,
  record: RegisteredReleaseToken,
): RegisteredReleaseToken {
  const frozen = freezeRegisteredReleaseToken(record);
  const existingIndex = file.records.findIndex((entry) => entry.tokenId === frozen.tokenId);
  if (existingIndex >= 0) {
    file.records[existingIndex] = frozen;
  } else {
    file.records.push(frozen);
  }
  return frozen;
}

function registeredTokenRecordsMatch(
  left: RegisteredReleaseToken,
  right: RegisteredReleaseToken,
): boolean {
  return (
    canonicalizeReleaseJson(JSON.parse(JSON.stringify(left)) as CanonicalReleaseJsonValue) ===
    canonicalizeReleaseJson(JSON.parse(JSON.stringify(right)) as CanonicalReleaseJsonValue)
  );
}

function assertRegistrationCanReplay(
  existing: RegisteredReleaseToken,
  proposed: RegisteredReleaseToken,
): void {
  if (existing.status !== 'issued') {
    throw new ReleaseTokenIntrospectionStoreError(
      `Release token '${proposed.tokenId}' cannot be re-registered after ${existing.status} state.`,
    );
  }

  if (!registeredTokenRecordsMatch(existing, proposed)) {
    throw new ReleaseTokenIntrospectionStoreError(
      `Release token '${proposed.tokenId}' is already registered with different authority state.`,
    );
  }
}

function insertRegisteredReleaseToken(
  file: ReleaseTokenIntrospectionStoreFile,
  record: RegisteredReleaseToken,
): RegisteredReleaseToken {
  const frozen = freezeRegisteredReleaseToken(record);
  if (file.decisionRevocations.some((entry) => entry.decisionId === frozen.decisionId)) {
    throw new ReleaseTokenIntrospectionStoreError(
      `Release decision '${frozen.decisionId}' is revoked and cannot issue active release tokens.`,
    );
  }
  const existing =
    file.records.find((entry) => entry.tokenId === frozen.tokenId) ?? null;
  if (existing) {
    assertRegistrationCanReplay(existing, frozen);
    return existing;
  }

  file.records.push(frozen);
  return frozen;
}

function normalizeLifecycleTimestamp(label: string, timestamp?: string): string {
  const normalized = introspectionTimestamp(timestamp);
  if (Number.isNaN(new Date(normalized).getTime())) {
    throw new Error(`Release token lifecycle requires a valid ${label} timestamp.`);
  }
  return normalized;
}

function expireRegisteredReleaseToken(
  record: RegisteredReleaseToken,
): RegisteredReleaseToken {
  if (record.status !== 'issued') {
    return record;
  }

  return Object.freeze({
    ...record,
    status: 'expired',
    statusChangedAt: record.expiresAt,
    expiredAt: record.expiresAt,
  });
}

function revokeRegisteredReleaseToken(
  record: RegisteredReleaseToken,
  input: RevokeReleaseTokenInput,
): RegisteredReleaseToken {
  if (record.status === 'revoked') {
    return record;
  }

  const revokedAt = normalizeLifecycleTimestamp('revokedAt', input.revokedAt);
  const reason = typeof input.reason === 'string' && input.reason.trim() !== ''
    ? input.reason.trim()
    : null;
  const revokedBy = typeof input.revokedBy === 'string' && input.revokedBy.trim() !== ''
    ? input.revokedBy.trim()
    : null;

  return Object.freeze({
    ...record,
    status: 'revoked',
    statusChangedAt: revokedAt,
    revokedAt,
    revocationReason: reason,
    revokedBy,
  });
}

function writeDecisionRevocation(
  file: ReleaseTokenIntrospectionStoreFile,
  record: ReleaseDecisionRevocationRecord,
): ReleaseDecisionRevocationRecord {
  const frozen = freezeReleaseDecisionRevocation(record, introspectionTimestamp);
  const existingIndex = file.decisionRevocations.findIndex((entry) =>
    entry.decisionId === frozen.decisionId
  );
  if (existingIndex >= 0) {
    return file.decisionRevocations[existingIndex];
  }
  file.decisionRevocations.push(frozen);
  return frozen;
}

function consumeRegisteredReleaseToken(
  record: RegisteredReleaseToken,
  input: RecordReleaseTokenUseInput,
): RegisteredReleaseToken {
  const usedAt = normalizeLifecycleTimestamp('usedAt', input.usedAt);
  const nextUseCount = record.useCount + 1;
  const exhausted = nextUseCount >= record.maxUses;

  return Object.freeze({
    ...record,
    status: exhausted ? 'consumed' : record.status,
    statusChangedAt: exhausted ? usedAt : record.statusChangedAt,
    useCount: nextUseCount,
    firstUsedAt: record.firstUsedAt ?? usedAt,
    lastUsedAt: usedAt,
    lastUsedByResourceServerId: input.resourceServerId ?? null,
  });
}

function createReleaseTokenIntrospectionStoreFromAccessors(accessors: {
  readonly read: () => ReleaseTokenIntrospectionStoreFile;
  readonly mutate: <T>(action: (file: ReleaseTokenIntrospectionStoreFile) => T) => T;
}): ReleaseTokenIntrospectionStore {
  return {
    registerIssuedToken(input: RegisterIssuedReleaseTokenInput): RegisteredReleaseToken {
      return accessors.mutate((file) =>
        insertRegisteredReleaseToken(file, buildRegisteredReleaseToken(input)),
      );
    },

    findToken(tokenId: string): RegisteredReleaseToken | null {
      return accessors.read().records.find((record) => record.tokenId === tokenId) ?? null;
    },

    revokeToken(input: RevokeReleaseTokenInput): RegisteredReleaseToken | null {
      return accessors.mutate((file) => {
        const existing = file.records.find((record) => record.tokenId === input.tokenId) ?? null;
        if (!existing) {
          return null;
        }

        const revoked = revokeRegisteredReleaseToken(existing, input);
        return writeRegisteredReleaseToken(file, revoked);
      });
    },

    findDecisionRevocation(decisionId: string): ReleaseDecisionRevocationRecord | null {
      const normalized = normalizeReleaseLifecycleText(decisionId, 'decisionId') ?? decisionId;
      return accessors.read().decisionRevocations.find((record) =>
        record.decisionId === normalized
      ) ?? null;
    },

    revokeTokensForDecision(
      input: RevokeReleaseTokensForDecisionInput,
    ): RevokeReleaseTokensForDecisionResult {
      return accessors.mutate((file) => {
        const decisionRevocation =
          writeDecisionRevocation(
            file,
            releaseDecisionRevocationRecordFor(input, normalizeLifecycleTimestamp),
          );
        const revokedTokens: RegisteredReleaseToken[] = [];
        const alreadyInactiveTokens: RegisteredReleaseToken[] = [];

        for (const record of file.records) {
          if (record.decisionId !== decisionRevocation.decisionId) continue;
          if (record.status !== 'issued') {
            alreadyInactiveTokens.push(record);
            continue;
          }

          const revoked = revokeRegisteredReleaseToken(record, {
            tokenId: record.tokenId,
            revokedAt: decisionRevocation.revokedAt,
            reason: decisionRevocation.reason ?? undefined,
            revokedBy: decisionRevocation.revokedBy ?? undefined,
          });
          revokedTokens.push(writeRegisteredReleaseToken(file, revoked));
        }

        return Object.freeze({
          decisionRevocation,
          revokedTokens: Object.freeze(revokedTokens),
          alreadyInactiveTokens: Object.freeze(alreadyInactiveTokens),
        });
      });
    },

    syncLifecycle(currentDate?: string): readonly RegisteredReleaseToken[] {
      const now = introspectionTimestamp(currentDate);
      return accessors.mutate((file) => {
        const expired: RegisteredReleaseToken[] = [];

        for (const record of file.records) {
          if (record.status === 'issued' && record.expiresAt <= now) {
            expired.push(writeRegisteredReleaseToken(file, expireRegisteredReleaseToken(record)));
          }
        }

        return Object.freeze(expired);
      });
    },

    recordTokenUse(input: RecordReleaseTokenUseInput): RecordedReleaseTokenUseResult {
      return accessors.mutate((file) => {
        const now = introspectionTimestamp(input.usedAt);
        for (const record of file.records) {
          if (record.status === 'issued' && record.expiresAt <= now) {
            writeRegisteredReleaseToken(file, expireRegisteredReleaseToken(record));
          }
        }

        const existing =
          file.records.find((record) => record.tokenId === input.tokenId) ?? null;
        if (!existing) {
          return Object.freeze({
            accepted: false,
            inactiveReason: 'unknown',
            record: null,
          });
        }

        if (existing.status !== 'issued') {
          return Object.freeze({
            accepted: false,
            inactiveReason: inactiveReasonForRegisteredReleaseToken(existing),
            record: existing,
          });
        }

        if (file.decisionRevocations.some((entry) => entry.decisionId === existing.decisionId)) {
          return Object.freeze({
            accepted: false,
            inactiveReason: 'revoked',
            record: existing,
          });
        }

        const consumed = consumeRegisteredReleaseToken(existing, input);
        writeRegisteredReleaseToken(file, consumed);
        return Object.freeze({
          accepted: true,
          inactiveReason: null,
          record: consumed,
        });
      });
    },
  };
}

export function createInMemoryReleaseTokenIntrospectionStore(): ReleaseTokenIntrospectionStore {
  let file = defaultReleaseTokenIntrospectionStoreFile();

  return createReleaseTokenIntrospectionStoreFromAccessors({
    read: () => file,
    mutate: (action) => {
      const workingCopy: ReleaseTokenIntrospectionStoreFile = {
        version: 1,
        records: [...file.records],
        decisionRevocations: [...file.decisionRevocations],
      };
      const result = action(workingCopy);
      file = workingCopy;
      return result;
    },
  });
}

export function createFileBackedReleaseTokenIntrospectionStore(
  path = defaultReleaseTokenIntrospectionStorePath(),
): ReleaseTokenIntrospectionStore {
  loadReleaseTokenIntrospectionStoreFile(path);

  return createReleaseTokenIntrospectionStoreFromAccessors({
    read: () => withFileLock(path, () => loadReleaseTokenIntrospectionStoreFile(path)),
    mutate: (action) =>
      withFileLock(path, () => {
        const file = loadReleaseTokenIntrospectionStoreFile(path);
        const result = action(file);
        saveReleaseTokenIntrospectionStoreFile(path, file);
        return result;
      }),
  });
}

export function resetFileBackedReleaseTokenIntrospectionStoreForTests(path?: string): void {
  const resolvedPath = path ?? defaultReleaseTokenIntrospectionStorePath();
  if (existsSync(resolvedPath)) {
    rmSync(resolvedPath, { force: true });
  }
  if (existsSync(`${resolvedPath}.lock`)) {
    rmSync(`${resolvedPath}.lock`, { recursive: true, force: true });
  }
}

export async function introspectReleaseToken(
  input: ReleaseTokenIntrospectionInput & {
    readonly store: AwaitableReleaseTokenIntrospectionStore;
  },
): Promise<ReleaseTokenIntrospectionResult> {
  const tokenTypeHint = normalizeSupportedTokenTypeHint(input.tokenTypeHint);
  if (input.tokenTypeHint && !tokenTypeHint) {
    return inactiveReleaseTokenIntrospection(
      'unsupported_token_type',
      input.currentDate,
      input.resourceServerId,
    );
  }

  await input.store.syncLifecycle(input.currentDate);

  let verified;
  try {
    verified = await verifyIssuedReleaseToken({
      token: input.token,
      verificationKey: input.verificationKey,
      audience: input.audience,
      currentDate: input.currentDate,
    });
  } catch (error) {
    if (
      error instanceof ReleaseTokenVerificationFailureError &&
      error.code === 'expired'
    ) {
      return inactiveReleaseTokenIntrospection(
        'expired',
        input.currentDate,
        input.resourceServerId,
      );
    }

    return inactiveReleaseTokenIntrospection(
      'invalid',
      input.currentDate,
      input.resourceServerId,
    );
  }

  const record = await input.store.findToken(verified.claims.jti);
  if (!record) {
    return inactiveReleaseTokenIntrospection(
      'unknown',
      input.currentDate,
      input.resourceServerId,
    );
  }

  if (!registeredReleaseTokenMatchesClaims(record, verified.claims)) {
    return inactiveReleaseTokenIntrospection(
      'claim_mismatch',
      input.currentDate,
      input.resourceServerId,
    );
  }

  if (record.status !== 'issued') {
    return inactiveReleaseTokenIntrospection(
      inactiveReasonForRegisteredReleaseToken(record),
      input.currentDate,
      input.resourceServerId,
    );
  }

  const decisionRevocation = await input.store.findDecisionRevocation(record.decisionId);
  if (decisionRevocation) {
    return inactiveReleaseTokenIntrospection(
      'revoked',
      input.currentDate,
      input.resourceServerId,
    );
  }

  return Object.freeze({
    version: RELEASE_TOKEN_INTROSPECTION_SPEC_VERSION,
    active: true,
    token_type: DEFAULT_RELEASE_TOKEN_TYPE_HINT,
    checked_at: introspectionTimestamp(input.currentDate),
    resource_server_id: input.resourceServerId ?? null,
    scope: verified.claims.scope ?? `release:${verified.claims.consequence_type}`,
    iss: verified.claims.iss,
    sub: verified.claims.sub,
    aud: verified.claims.aud,
    ...(verified.claims.tenant_id ? { tenant_id: verified.claims.tenant_id } : {}),
    jti: verified.claims.jti,
    iat: verified.claims.iat,
    nbf: verified.claims.nbf,
    exp: verified.claims.exp,
    decision_id: verified.claims.decision_id,
    decision: verified.claims.decision,
    consequence_type: verified.claims.consequence_type,
    risk_class: verified.claims.risk_class,
    output_hash: verified.claims.output_hash,
    consequence_hash: verified.claims.consequence_hash,
    policy_hash: verified.claims.policy_hash,
    ...(verified.claims.policy_version ? { policy_version: verified.claims.policy_version } : {}),
    ...(verified.claims.policy_ir_hash ? { policy_ir_hash: verified.claims.policy_ir_hash } : {}),
    ...(verified.claims.policy_provenance_source
      ? { policy_provenance_source: verified.claims.policy_provenance_source }
      : {}),
    ...(verified.claims.compiled_policy_index_version
      ? { compiled_policy_index_version: verified.claims.compiled_policy_index_version }
      : {}),
    ...(verified.claims.compiled_policy_ir_version
      ? { compiled_policy_ir_version: verified.claims.compiled_policy_ir_version }
      : {}),
    token_policy: releaseTokenIntrospectionPolicyContext(verified.claims),
    override: verified.claims.override,
    authority_mode: verified.claims.authority_mode,
    introspection_required: verified.claims.introspection_required,
    ...(verified.claims.resource ? { resource: verified.claims.resource } : {}),
    ...(verified.claims.act ? { act: verified.claims.act } : {}),
    ...(verified.claims.parent_jti ? { parent_jti: verified.claims.parent_jti } : {}),
    ...(verified.claims.exchange_id ? { exchange_id: verified.claims.exchange_id } : {}),
    ...(verified.claims.exchanged_at !== undefined
      ? { exchanged_at: verified.claims.exchanged_at }
      : {}),
    ...(verified.claims.source_aud ? { source_aud: verified.claims.source_aud } : {}),
    ...(verified.claims.token_use ? { token_use: verified.claims.token_use } : {}),
    ...(verified.claims.cnf ? { cnf: verified.claims.cnf } : {}),
  });
}

export function createReleaseTokenIntrospector(
  store: AwaitableReleaseTokenIntrospectionStore,
): ReleaseTokenIntrospector {
  return {
    introspect(
      input: ReleaseTokenIntrospectionInput,
    ): Promise<ReleaseTokenIntrospectionResult> {
      return introspectReleaseToken({
        ...input,
        store,
      });
    },
  };
}
