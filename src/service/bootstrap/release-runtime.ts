import { existsSync, readFileSync, chmodSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { generatePkiHierarchy } from '../../signing/pki-chain.js';
import {
  decisionLog,
  evidence,
  introspection,
  review,
  shadow,
  token,
  type ReleaseDecisionEngine,
  type DeterministicCheckObservation,
  type ReleaseDeterministicEvaluationResult,
  type ReleaseDecisionLogPhase,
  type ReleaseEvidencePackIssuer,
  type ReleaseEvaluationResult,
  type ReleaseEvaluationRequest,
  type ReleaseTokenIntrospector,
  type ReleaseTokenIssuer,
  type ReleaseTokenVerificationKey,
  type ShadowModeReleaseEvaluator,
} from '../../release-layer/index.js';
import {
  activationApprovals as controlPlaneActivationApprovals,
  auditLog as controlPlaneAuditLog,
  financeProving as controlPlaneFinanceProving,
  store as controlPlaneStore,
  type PolicyControlPlaneStore,
} from '../../release-policy-control-plane/index.js';
import {
  createFileBackedDegradedModeGrantStore,
} from '../../release-enforcement-plane/degraded-mode.js';
import {
  CURRENT_RELEASE_RUNTIME_STORE_MODES,
  assertReleaseRuntimeDurability,
  buildRuntimeProfileStartupDiagnostics,
  evaluateReleaseRuntimeDurability,
  resolveRuntimeProfile,
  type AttestorRuntimeProfile,
  type ReleaseRuntimeStoreComponent,
  type ReleaseRuntimeStoreModes,
  type RuntimeProfileDurabilityEvaluation,
  type RuntimeProfileStartupDiagnostics,
} from './runtime-profile.js';
import {
  assertReleaseSigningProviderAllowed,
  assertReleaseSigningProviderPreflight,
  type ReleaseSigningProviderDiagnostics,
} from './release-signing-provider.js';
import {
  isReleaseAuthorityStoreConfigured,
  listReleaseAuthorityComponents,
  recordReleaseAuthorityComponentState,
  releaseAuthorityStoreMode,
} from '../release-authority-store.js';
import {
  createSharedReleaseDecisionLogStore,
} from '../release-decision-log-store.js';
import {
  createSharedReleaseReviewerQueueStore,
} from '../release-reviewer-queue-store.js';
import {
  createSharedReleaseTokenIntrospectionStore,
} from '../release-token-introspection-store.js';
import {
  createSharedReleaseEvidencePackStore,
} from '../release-evidence-pack-store.js';
import {
  createSharedReleaseDegradedModeGrantStore,
} from '../release-degraded-mode-grant-store.js';
import {
  createSharedPolicyActivationApprovalStore,
  createSharedPolicyControlPlaneStore,
  createSharedPolicyMutationAuditLogWriter,
} from '../release-policy-authority-store.js';
import type {
  Awaitable,
  RequestPathDegradedModeGrantStore,
  RequestPathPolicyActivationApprovalStore,
  RequestPathPolicyControlPlaneStore,
  RequestPathPolicyMutationAuditLogWriter,
  RequestPathReleaseDecisionEngine,
  RequestPathReleaseDecisionLogWriter,
  RequestPathReleaseEvidencePackStore,
  RequestPathReleaseReviewerQueueStore,
  RequestPathReleaseShadowEvaluator,
  RequestPathReleaseTokenIntrospectionStore,
} from '../release-authority-request-path.js';
import { withFileLock, writeTextFileAtomic } from '../file-store.js';

const {
  createFileBackedReleaseDecisionLogWriter,
  createInMemoryReleaseDecisionLogWriter,
} = decisionLog;
const {
  createFileBackedReleaseEvidencePackStore,
  createInMemoryReleaseEvidencePackStore,
  createReleaseEvidencePackIssuer,
} = evidence;
const {
  createFileBackedReleaseTokenIntrospectionStore,
  createInMemoryReleaseTokenIntrospectionStore,
  createReleaseTokenIntrospector,
} = introspection;
const {
  createFileBackedReleaseReviewerQueueStore,
  createInMemoryReleaseReviewerQueueStore,
} = review;
const { createShadowModeReleaseEvaluator } = shadow;
const { createReleaseTokenIssuer } = token;
const { createFileBackedPolicyActivationApprovalStore } = controlPlaneActivationApprovals;
const { createFileBackedPolicyMutationAuditLogWriter } = controlPlaneAuditLog;
const {
  createFinanceControlPlaneReleaseDecisionEngine,
  ensureFinanceProvingPolicies,
  FINANCE_PROVING_POLICY_ENVIRONMENT,
} = controlPlaneFinanceProving;
const { createFileBackedPolicyControlPlaneStore } = controlPlaneStore;

const RELEASE_ISSUER = 'attestor.api.release.local';
const API_CA_SUBJECT = 'Attestor Keyless CA';
const API_SIGNER_SUBJECT = 'API Runtime Signer';
const API_REVIEWER_SUBJECT = 'API Reviewer';
export const ATTESTOR_RELEASE_RUNTIME_PKI_PATH_ENV = 'ATTESTOR_RELEASE_RUNTIME_PKI_PATH';
export const ATTESTOR_RELEASE_RUNTIME_PKI_ROTATION_ID_ENV =
  'ATTESTOR_RELEASE_RUNTIME_PKI_ROTATION_ID';
export const RELEASE_RUNTIME_PKI_STORE_SPEC_VERSION = 'attestor.release-runtime-pki-store.v1';
export const RELEASE_RUNTIME_REQUEST_PATH_DIAGNOSTICS_SPEC_VERSION =
  'attestor.release-runtime-request-path-diagnostics.v1';
export const RELEASE_RUNTIME_REQUEST_PATH_CONTRACTS = Object.freeze([
  'synchronous-local-authority-stores',
  'async-shared-authority-stores',
] as const);

export type ReleaseRuntimeRequestPathContract =
  typeof RELEASE_RUNTIME_REQUEST_PATH_CONTRACTS[number];

type ReleaseRuntimePki = ReturnType<typeof generatePkiHierarchy>;

interface StoredReleaseRuntimeVerificationKey {
  readonly keyId: string;
  readonly algorithm: 'EdDSA';
  readonly publicKeyFingerprint: string;
  readonly publicKeyPem: string;
  readonly retiredAt: string;
  readonly rotationId: string | null;
}

export interface ReleaseRuntimePkiPersistence {
  readonly mode: 'ephemeral' | 'file';
  readonly path: string | null;
  readonly generated: boolean;
  readonly rotated: boolean;
  readonly rotationId: string | null;
  readonly retiredVerificationKeyCount: number;
}

interface StoredReleaseRuntimePki {
  readonly version: typeof RELEASE_RUNTIME_PKI_STORE_SPEC_VERSION;
  readonly issuer: typeof RELEASE_ISSUER;
  readonly createdAt: string;
  readonly rotationId?: string | null;
  readonly rotatedAt?: string | null;
  readonly retiredVerificationKeys?: readonly StoredReleaseRuntimeVerificationKey[];
  readonly pki: ReleaseRuntimePki;
}

export interface ReleaseRuntimeRequestPathDiagnostics {
  readonly version: typeof RELEASE_RUNTIME_REQUEST_PATH_DIAGNOSTICS_SPEC_VERSION;
  readonly usesSharedAuthorityStores: boolean;
  readonly contract: ReleaseRuntimeRequestPathContract;
  readonly storeModes: ReleaseRuntimeStoreModes;
  readonly sharedComponents: readonly ReleaseRuntimeStoreComponent[];
  readonly localComponents: readonly ReleaseRuntimeStoreComponent[];
  readonly requiredSharedComponents: readonly ReleaseRuntimeStoreComponent[];
  readonly blockers: readonly string[];
}

export interface BuildReleaseRuntimeRequestPathDiagnosticsInput {
  readonly contract?: ReleaseRuntimeRequestPathContract;
}

function releaseRuntimeStoreModesForProfile(
  runtimeProfile: AttestorRuntimeProfile,
  sharedRequestPathReady = false,
): ReleaseRuntimeStoreModes {
  if (runtimeProfile.id === 'production-shared' && sharedRequestPathReady) {
    return Object.freeze({
      'release-decision-log': 'shared',
      'release-reviewer-queue': 'shared',
      'release-token-introspection': 'shared',
      'release-evidence-pack-store': 'shared',
      'release-degraded-mode-grants': 'shared',
      'policy-control-plane-store': 'shared',
      'policy-activation-approval-store': 'shared',
      'policy-mutation-audit-log': 'shared',
    });
  }

  return Object.freeze({
    ...CURRENT_RELEASE_RUNTIME_STORE_MODES,
    'release-decision-log':
      runtimeProfile.id === 'local-dev'
        ? 'memory'
        : CURRENT_RELEASE_RUNTIME_STORE_MODES['release-decision-log'],
    'release-reviewer-queue':
      runtimeProfile.id === 'local-dev'
        ? 'memory'
        : CURRENT_RELEASE_RUNTIME_STORE_MODES['release-reviewer-queue'],
    'release-token-introspection':
      runtimeProfile.id === 'local-dev'
        ? 'memory'
        : CURRENT_RELEASE_RUNTIME_STORE_MODES['release-token-introspection'],
    'release-evidence-pack-store':
      runtimeProfile.id === 'local-dev'
        ? 'memory'
        : CURRENT_RELEASE_RUNTIME_STORE_MODES['release-evidence-pack-store'],
  });
}

function releaseRuntimePkiPath(): string {
  const configured = process.env[ATTESTOR_RELEASE_RUNTIME_PKI_PATH_ENV]?.trim();
  return configured && configured.length > 0
    ? configured
    : join(process.cwd(), '.attestor', 'release-runtime-pki.json');
}

function releaseRuntimePkiRotationId(): string | null {
  const configured = process.env[ATTESTOR_RELEASE_RUNTIME_PKI_ROTATION_ID_ENV]?.trim();
  return configured && configured.length > 0 ? configured : null;
}

function assertPem(value: unknown, fieldName: string): asserts value is string {
  if (typeof value !== 'string' || !value.includes('-----BEGIN') || !value.includes('-----END')) {
    throw new Error(`Release runtime PKI store has invalid ${fieldName}.`);
  }
}

function assertStoredVerificationKey(
  value: unknown,
  fieldName: string,
): asserts value is StoredReleaseRuntimeVerificationKey {
  const record = value as Partial<StoredReleaseRuntimeVerificationKey> | undefined;
  if (!record || typeof record !== 'object') {
    throw new Error(`Release runtime PKI store has invalid ${fieldName}.`);
  }
  if (typeof record.keyId !== 'string' || record.keyId.length === 0) {
    throw new Error(`Release runtime PKI store has invalid ${fieldName}.keyId.`);
  }
  if (record.algorithm !== 'EdDSA') {
    throw new Error(`Release runtime PKI store has invalid ${fieldName}.algorithm.`);
  }
  if (
    typeof record.publicKeyFingerprint !== 'string' ||
    record.publicKeyFingerprint.length === 0
  ) {
    throw new Error(`Release runtime PKI store has invalid ${fieldName}.publicKeyFingerprint.`);
  }
  assertPem(record.publicKeyPem, `${fieldName}.publicKeyPem`);
  if (typeof record.retiredAt !== 'string' || Number.isNaN(new Date(record.retiredAt).getTime())) {
    throw new Error(`Release runtime PKI store has invalid ${fieldName}.retiredAt.`);
  }
  if (record.rotationId !== null && typeof record.rotationId !== 'string') {
    throw new Error(`Release runtime PKI store has invalid ${fieldName}.rotationId.`);
  }
}

function signerVerificationKeyFromPki(
  pki: ReleaseRuntimePki,
  retiredAt: string,
  rotationId: string | null,
): StoredReleaseRuntimeVerificationKey {
  return Object.freeze({
    keyId: pki.signer.keyPair.fingerprint,
    algorithm: 'EdDSA' as const,
    publicKeyFingerprint: pki.signer.keyPair.fingerprint,
    publicKeyPem: pki.signer.keyPair.publicKeyPem,
    retiredAt,
    rotationId,
  });
}

function parseStoredReleaseRuntimePki(content: string): {
  pki: ReleaseRuntimePki;
  rotationId: string | null;
  retiredVerificationKeys: readonly StoredReleaseRuntimeVerificationKey[];
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Release runtime PKI store is not valid JSON.');
  }

  const record = parsed as Partial<StoredReleaseRuntimePki>;
  if (record.version !== RELEASE_RUNTIME_PKI_STORE_SPEC_VERSION) {
    throw new Error('Release runtime PKI store has an unsupported version.');
  }
  if (record.issuer !== RELEASE_ISSUER) {
    throw new Error('Release runtime PKI store issuer does not match this runtime.');
  }

  const pki = record.pki as ReleaseRuntimePki | undefined;
  assertPem(pki?.ca?.keyPair?.privateKeyPem, 'ca.keyPair.privateKeyPem');
  assertPem(pki?.ca?.keyPair?.publicKeyPem, 'ca.keyPair.publicKeyPem');
  assertPem(pki?.signer?.keyPair?.privateKeyPem, 'signer.keyPair.privateKeyPem');
  assertPem(pki?.signer?.keyPair?.publicKeyPem, 'signer.keyPair.publicKeyPem');
  assertPem(pki?.reviewer?.keyPair?.privateKeyPem, 'reviewer.keyPair.privateKeyPem');
  assertPem(pki?.reviewer?.keyPair?.publicKeyPem, 'reviewer.keyPair.publicKeyPem');

  const retiredVerificationKeys = Array.isArray(record.retiredVerificationKeys)
    ? record.retiredVerificationKeys
    : [];
  retiredVerificationKeys.forEach((key, index) =>
    assertStoredVerificationKey(key, `retiredVerificationKeys[${index}]`),
  );

  return {
    pki,
    rotationId: typeof record.rotationId === 'string' ? record.rotationId : null,
    retiredVerificationKeys: Object.freeze([...retiredVerificationKeys]),
  };
}

function loadOrCreateFileBackedReleaseRuntimePki(path: string): {
  pki: ReleaseRuntimePki;
  retiredVerificationKeys: readonly StoredReleaseRuntimeVerificationKey[];
  persistence: ReleaseRuntimePkiPersistence;
} {
  mkdirSync(dirname(path), { recursive: true });
  return withFileLock(path, () => {
    const rotationId = releaseRuntimePkiRotationId();
    if (existsSync(path)) {
      const stored = parseStoredReleaseRuntimePki(readFileSync(path, 'utf8'));
      if (rotationId !== null && stored.rotationId !== rotationId) {
        const now = new Date().toISOString();
        const pki = generatePkiHierarchy(API_CA_SUBJECT, API_SIGNER_SUBJECT, API_REVIEWER_SUBJECT);
        const retiredVerificationKeys = Object.freeze([
          signerVerificationKeyFromPki(stored.pki, now, stored.rotationId),
          ...stored.retiredVerificationKeys,
        ]);
        const next: StoredReleaseRuntimePki = {
          version: RELEASE_RUNTIME_PKI_STORE_SPEC_VERSION,
          issuer: RELEASE_ISSUER,
          createdAt: now,
          rotationId,
          rotatedAt: now,
          retiredVerificationKeys,
          pki,
        };
        writeTextFileAtomic(path, `${JSON.stringify(next, null, 2)}\n`);
        try {
          chmodSync(path, 0o600);
        } catch {
          // chmod is best-effort on some Windows filesystems.
        }

        return {
          pki,
          retiredVerificationKeys,
          persistence: {
            mode: 'file',
            path,
            generated: true,
            rotated: true,
            rotationId,
            retiredVerificationKeyCount: retiredVerificationKeys.length,
          },
        };
      }

      return {
        pki: stored.pki,
        retiredVerificationKeys: stored.retiredVerificationKeys,
        persistence: {
          mode: 'file',
          path,
          generated: false,
          rotated: false,
          rotationId: stored.rotationId,
          retiredVerificationKeyCount: stored.retiredVerificationKeys.length,
        },
      };
    }

    const pki = generatePkiHierarchy(API_CA_SUBJECT, API_SIGNER_SUBJECT, API_REVIEWER_SUBJECT);
    const stored: StoredReleaseRuntimePki = {
      version: RELEASE_RUNTIME_PKI_STORE_SPEC_VERSION,
      issuer: RELEASE_ISSUER,
      createdAt: new Date().toISOString(),
      rotationId,
      rotatedAt: null,
      retiredVerificationKeys: [],
      pki,
    };
    writeTextFileAtomic(path, `${JSON.stringify(stored, null, 2)}\n`);
    try {
      chmodSync(path, 0o600);
    } catch {
      // chmod is best-effort on some Windows filesystems; the file remains
      // local to the selected runtime store path and is never committed.
    }

    return {
      pki,
      retiredVerificationKeys: [],
      persistence: {
        mode: 'file',
        path,
        generated: true,
        rotated: false,
        rotationId,
        retiredVerificationKeyCount: 0,
      },
    };
  });
}

function resolveReleaseRuntimePki(runtimeProfile: AttestorRuntimeProfile): {
  pki: ReleaseRuntimePki;
  retiredVerificationKeys: readonly StoredReleaseRuntimeVerificationKey[];
  persistence: ReleaseRuntimePkiPersistence;
} {
  if (
    runtimeProfile.id === 'local-dev' &&
    !(process.env[ATTESTOR_RELEASE_RUNTIME_PKI_PATH_ENV]?.trim())
  ) {
    return {
      pki: generatePkiHierarchy(API_CA_SUBJECT, API_SIGNER_SUBJECT, API_REVIEWER_SUBJECT),
      retiredVerificationKeys: [],
      persistence: {
        mode: 'ephemeral',
        path: null,
        generated: true,
        rotated: false,
        rotationId: null,
        retiredVerificationKeyCount: 0,
      },
    };
  }

  return loadOrCreateFileBackedReleaseRuntimePki(releaseRuntimePkiPath());
}

function createReleaseDecisionLogWriterForProfile(
  runtimeProfile: AttestorRuntimeProfile,
): RequestPathReleaseDecisionLogWriter {
  if (runtimeProfile.id === 'local-dev') {
    return createInMemoryReleaseDecisionLogWriter();
  }
  return createFileBackedReleaseDecisionLogWriter();
}

function createReleaseReviewerQueueStoreForProfile(
  runtimeProfile: AttestorRuntimeProfile,
): RequestPathReleaseReviewerQueueStore {
  if (runtimeProfile.id === 'local-dev') {
    return createInMemoryReleaseReviewerQueueStore();
  }
  return createFileBackedReleaseReviewerQueueStore();
}

function createReleaseTokenIntrospectionStoreForProfile(
  runtimeProfile: AttestorRuntimeProfile,
): RequestPathReleaseTokenIntrospectionStore {
  if (runtimeProfile.id === 'local-dev') {
    return createInMemoryReleaseTokenIntrospectionStore();
  }
  return createFileBackedReleaseTokenIntrospectionStore();
}

function createReleaseEvidencePackStoreForProfile(
  runtimeProfile: AttestorRuntimeProfile,
): RequestPathReleaseEvidencePackStore {
  if (runtimeProfile.id === 'local-dev') {
    return createInMemoryReleaseEvidencePackStore();
  }
  return createFileBackedReleaseEvidencePackStore();
}

type FinanceControlPlaneFlow = Parameters<
  typeof createFinanceControlPlaneReleaseDecisionEngine
>[0]['flow'];

interface SharedReleaseAuthorityRequestPath {
  readonly financeReleaseDecisionLog: RequestPathReleaseDecisionLogWriter;
  readonly apiReleaseReviewerQueueStore: RequestPathReleaseReviewerQueueStore;
  readonly apiReleaseIntrospectionStore: RequestPathReleaseTokenIntrospectionStore;
  readonly apiReleaseEvidencePackStore: RequestPathReleaseEvidencePackStore;
  readonly apiReleaseDegradedModeGrantStore: RequestPathDegradedModeGrantStore;
  readonly policyControlPlaneStore: RequestPathPolicyControlPlaneStore;
  readonly policyActivationApprovalStore: RequestPathPolicyActivationApprovalStore;
  readonly policyMutationAuditLog: RequestPathPolicyMutationAuditLogWriter;
  readonly financeReleaseDecisionEngine: RequestPathReleaseDecisionEngine;
  readonly financeCommunicationReleaseShadowEvaluator: RequestPathReleaseShadowEvaluator<
    ReturnType<ShadowModeReleaseEvaluator['evaluate']>
  >;
  readonly financeActionReleaseShadowEvaluator: RequestPathReleaseShadowEvaluator<
    ReturnType<ShadowModeReleaseEvaluator['evaluate']>
  >;
}

function unavailableAuthorityError(component: string): Error {
  return new Error(
    `Production-shared release authority request path is fail-closed because ${component} is not wired to the shared authority store.`,
  );
}

function unavailableDecisionLog(): RequestPathReleaseDecisionLogWriter {
  return {
    append: () => {
      throw unavailableAuthorityError('release decision log');
    },
    entries: () => {
      throw unavailableAuthorityError('release decision log');
    },
    latestEntryDigest: () => {
      throw unavailableAuthorityError('release decision log');
    },
    verify: () => {
      throw unavailableAuthorityError('release decision log');
    },
  };
}

function unavailableReviewerQueue(): RequestPathReleaseReviewerQueueStore {
  return {
    upsert: () => {
      throw unavailableAuthorityError('release reviewer queue');
    },
    get: () => {
      throw unavailableAuthorityError('release reviewer queue');
    },
    getRecord: () => {
      throw unavailableAuthorityError('release reviewer queue');
    },
    listPending: () => {
      throw unavailableAuthorityError('release reviewer queue');
    },
  };
}

function unavailableTokenIntrospection(): RequestPathReleaseTokenIntrospectionStore {
  return {
    registerIssuedToken: () => {
      throw unavailableAuthorityError('release token introspection store');
    },
    findToken: () => {
      throw unavailableAuthorityError('release token introspection store');
    },
    revokeToken: () => {
      throw unavailableAuthorityError('release token introspection store');
    },
    syncLifecycle: () => {
      throw unavailableAuthorityError('release token introspection store');
    },
    recordTokenUse: () => {
      throw unavailableAuthorityError('release token introspection store');
    },
  };
}

function unavailableEvidencePackStore(): RequestPathReleaseEvidencePackStore {
  return {
    upsert: () => {
      throw unavailableAuthorityError('release evidence pack store');
    },
    get: () => {
      throw unavailableAuthorityError('release evidence pack store');
    },
  };
}

function unavailableDegradedModeGrantStore(): RequestPathDegradedModeGrantStore {
  return {
    registerGrant: () => {
      throw unavailableAuthorityError('release degraded-mode grant store');
    },
    findGrant: () => {
      throw unavailableAuthorityError('release degraded-mode grant store');
    },
    listGrants: () => {
      throw unavailableAuthorityError('release degraded-mode grant store');
    },
    revokeGrant: () => {
      throw unavailableAuthorityError('release degraded-mode grant store');
    },
    consumeGrant: () => {
      throw unavailableAuthorityError('release degraded-mode grant store');
    },
    listAuditRecords: () => {
      throw unavailableAuthorityError('release degraded-mode grant store');
    },
    auditHead: () => {
      throw unavailableAuthorityError('release degraded-mode grant store');
    },
  };
}

function unavailablePolicyStore(): RequestPathPolicyControlPlaneStore {
  return {
    kind: 'postgres',
    getMetadata: () => {
      throw unavailableAuthorityError('policy control-plane store');
    },
    setMetadata: () => {
      throw unavailableAuthorityError('policy control-plane store');
    },
    upsertPack: () => {
      throw unavailableAuthorityError('policy control-plane store');
    },
    getPack: () => {
      throw unavailableAuthorityError('policy control-plane store');
    },
    listPacks: () => {
      throw unavailableAuthorityError('policy control-plane store');
    },
    upsertBundle: () => {
      throw unavailableAuthorityError('policy control-plane store');
    },
    getBundle: () => {
      throw unavailableAuthorityError('policy control-plane store');
    },
    listBundleHistory: () => {
      throw unavailableAuthorityError('policy control-plane store');
    },
    listBundles: () => {
      throw unavailableAuthorityError('policy control-plane store');
    },
    upsertActivation: () => {
      throw unavailableAuthorityError('policy control-plane store');
    },
    getActivation: () => {
      throw unavailableAuthorityError('policy control-plane store');
    },
    listActivations: () => {
      throw unavailableAuthorityError('policy control-plane store');
    },
    exportSnapshot: () => {
      throw unavailableAuthorityError('policy control-plane store');
    },
  };
}

function unavailableApprovalStore(): RequestPathPolicyActivationApprovalStore {
  return {
    kind: 'postgres',
    upsert: () => {
      throw unavailableAuthorityError('policy activation approval store');
    },
    get: () => {
      throw unavailableAuthorityError('policy activation approval store');
    },
    list: () => {
      throw unavailableAuthorityError('policy activation approval store');
    },
    exportSnapshot: () => {
      throw unavailableAuthorityError('policy activation approval store');
    },
  };
}

function unavailablePolicyAuditLog(): RequestPathPolicyMutationAuditLogWriter {
  return {
    kind: 'postgres',
    append: () => {
      throw unavailableAuthorityError('policy mutation audit log');
    },
    entries: () => {
      throw unavailableAuthorityError('policy mutation audit log');
    },
    latestEntryDigest: () => {
      throw unavailableAuthorityError('policy mutation audit log');
    },
    verify: () => {
      throw unavailableAuthorityError('policy mutation audit log');
    },
    exportSnapshot: () => {
      throw unavailableAuthorityError('policy mutation audit log');
    },
  };
}

function unavailableReleaseDecisionEngine(): RequestPathReleaseDecisionEngine {
  return {
    evaluate: () => {
      throw unavailableAuthorityError('release decision engine');
    },
    evaluateWithDeterministicChecks: () => {
      throw unavailableAuthorityError('release decision engine');
    },
  };
}

function unavailableShadowEvaluator(): RequestPathReleaseShadowEvaluator<
  ReturnType<ShadowModeReleaseEvaluator['evaluate']>
> {
  return {
    evaluate: () => {
      throw unavailableAuthorityError('release shadow evaluator');
    },
  };
}

function sharedPolicyStore(
  store: ReturnType<typeof createSharedPolicyControlPlaneStore>,
): RequestPathPolicyControlPlaneStore {
  return Object.freeze({
    kind: 'postgres' as const,
    ...store,
  });
}

function sharedApprovalStore(
  store: ReturnType<typeof createSharedPolicyActivationApprovalStore>,
): RequestPathPolicyActivationApprovalStore {
  return Object.freeze({
    kind: 'postgres' as const,
    ...store,
  });
}

function sharedPolicyAuditLog(
  writer: ReturnType<typeof createSharedPolicyMutationAuditLogWriter>,
): RequestPathPolicyMutationAuditLogWriter {
  return Object.freeze({
    kind: 'postgres' as const,
    ...writer,
  });
}

async function seedFinancePoliciesInSharedStore(
  store: RequestPathPolicyControlPlaneStore,
  environment: string,
): Promise<void> {
  const localStore = controlPlaneStore.createInMemoryPolicyControlPlaneStoreFromSnapshot(
    await store.exportSnapshot(),
  );
  ensureFinanceProvingPolicies(localStore, { environment });
  const snapshot = localStore.exportSnapshot();
  for (const pack of snapshot.packs) {
    await store.upsertPack(pack);
  }
  for (const bundle of snapshot.bundles) {
    await store.upsertBundle({
      manifest: bundle.manifest,
      artifact: bundle.artifact,
      signedBundle: bundle.signedBundle,
      verificationKey: bundle.verificationKey,
      storedAt: bundle.storedAt,
    });
  }
  for (const activation of snapshot.activations) {
    await store.upsertActivation(activation);
  }
  if (snapshot.metadata) {
    await store.setMetadata(snapshot.metadata);
  }
}

async function markSharedAuthorityBootstrapWired(): Promise<void> {
  const records = await listReleaseAuthorityComponents();
  const wiredAt = new Date().toISOString();
  await Promise.all(
    records.map((record) =>
      recordReleaseAuthorityComponentState({
        component: record.component,
        status: 'ready',
        migratedAt: record.migratedAt ?? wiredAt,
        metadata: {
          ...record.metadata,
          bootstrapWired: true,
          bootstrapWiredAt: wiredAt,
          requestPathContract: 'async-shared-authority-stores',
        },
      }),
    ),
  );
}

function appendDecisionLog(
  writer: RequestPathReleaseDecisionLogWriter | undefined,
  request: ReleaseEvaluationRequest,
  result: ReleaseEvaluationResult,
  phase: ReleaseDecisionLogPhase,
  deterministicChecksCompleted: boolean,
): Awaitable<unknown> {
  return writer?.append({
    occurredAt: request.createdAt,
    requestId: request.id,
    phase,
    matchedPolicyId: result.matchedPolicyId,
    decision: result.decision,
    metadata: {
      policyMatched: result.policyMatched,
      pendingChecks: result.plan.pendingChecks,
      pendingEvidenceKinds: result.plan.pendingEvidenceKinds,
      requiresReview: result.plan.requiresReview,
      deterministicChecksCompleted,
      effectivePolicyId: result.plan.effectivePolicyId,
      rolloutMode: result.plan.rolloutMode,
      rolloutEvaluationMode: result.plan.rolloutEvaluationMode,
      rolloutReason: result.plan.rolloutReason,
      rolloutCanaryBucket: result.plan.rolloutCanaryBucket,
      rolloutFallbackPolicyId: result.plan.rolloutFallbackPolicyId,
    },
  });
}

async function snapshotFinanceEngine(input: {
  readonly store: RequestPathPolicyControlPlaneStore;
  readonly flow: FinanceControlPlaneFlow;
  readonly environment: string;
}): Promise<ReleaseDecisionEngine> {
  const snapshotStore = controlPlaneStore.createInMemoryPolicyControlPlaneStoreFromSnapshot(
    await input.store.exportSnapshot(),
  );
  return createFinanceControlPlaneReleaseDecisionEngine({
    store: snapshotStore,
    flow: input.flow,
    environment: input.environment,
  });
}

function createAsyncFinanceControlPlaneEngine(input: {
  readonly store: RequestPathPolicyControlPlaneStore;
  readonly flow: FinanceControlPlaneFlow;
  readonly environment: string;
  readonly decisionLog?: RequestPathReleaseDecisionLogWriter;
}): RequestPathReleaseDecisionEngine {
  return {
    async evaluate(request: ReleaseEvaluationRequest): Promise<ReleaseEvaluationResult> {
      const engine = await snapshotFinanceEngine(input);
      const result = engine.evaluate(request);
      await appendDecisionLog(input.decisionLog, request, result, 'policy-resolution', false);
      return result;
    },

    async evaluateWithDeterministicChecks(
      request: ReleaseEvaluationRequest,
      observation: DeterministicCheckObservation,
    ): Promise<ReleaseDeterministicEvaluationResult> {
      const engine = await snapshotFinanceEngine(input);
      const initial = engine.evaluate(request);
      await appendDecisionLog(input.decisionLog, request, initial, 'policy-resolution', false);
      const result = engine.evaluateWithDeterministicChecks(request, observation);
      await appendDecisionLog(input.decisionLog, request, result, 'deterministic-checks', true);
      return result;
    },
  };
}

function createAsyncShadowEvaluator(input: {
  readonly store: RequestPathPolicyControlPlaneStore;
  readonly flow: FinanceControlPlaneFlow;
  readonly environment: string;
}): RequestPathReleaseShadowEvaluator<ReturnType<ShadowModeReleaseEvaluator['evaluate']>> {
  return {
    async evaluate(request, observation) {
      const engine = await snapshotFinanceEngine(input);
      return createShadowModeReleaseEvaluator({ engine }).evaluate(request, observation);
    },
  };
}

async function createSharedReleaseAuthorityRequestPath(
  financePolicyEnvironment: string,
): Promise<SharedReleaseAuthorityRequestPath | null> {
  if (!isReleaseAuthorityStoreConfigured()) {
    return null;
  }

  const financeReleaseDecisionLog = createSharedReleaseDecisionLogStore();
  const apiReleaseReviewerQueueStore = createSharedReleaseReviewerQueueStore();
  const apiReleaseIntrospectionStore = createSharedReleaseTokenIntrospectionStore();
  const apiReleaseEvidencePackStore = createSharedReleaseEvidencePackStore();
  const apiReleaseDegradedModeGrantStore = createSharedReleaseDegradedModeGrantStore();
  const rawPolicyControlPlaneStore = createSharedPolicyControlPlaneStore();
  const rawPolicyActivationApprovalStore = createSharedPolicyActivationApprovalStore();
  const rawPolicyMutationAuditLog = createSharedPolicyMutationAuditLogWriter();
  const policyControlPlaneStore = sharedPolicyStore(rawPolicyControlPlaneStore);
  const policyActivationApprovalStore = sharedApprovalStore(rawPolicyActivationApprovalStore);
  const policyMutationAuditLog = sharedPolicyAuditLog(rawPolicyMutationAuditLog);

  const sharedStoreProbes = [
    () => financeReleaseDecisionLog.summary(),
    () => apiReleaseReviewerQueueStore.summary(),
    () => apiReleaseIntrospectionStore.summary(),
    () => apiReleaseEvidencePackStore.summary(),
    () => apiReleaseDegradedModeGrantStore.summary(),
    () => rawPolicyControlPlaneStore.summary(),
    () => rawPolicyActivationApprovalStore.summary(),
    () => rawPolicyMutationAuditLog.summary(),
  ];
  for (const probe of sharedStoreProbes) {
    await probe();
  }
  await seedFinancePoliciesInSharedStore(policyControlPlaneStore, financePolicyEnvironment);
  await markSharedAuthorityBootstrapWired();

  return Object.freeze({
    financeReleaseDecisionLog,
    apiReleaseReviewerQueueStore,
    apiReleaseIntrospectionStore,
    apiReleaseEvidencePackStore,
    apiReleaseDegradedModeGrantStore,
    policyControlPlaneStore,
    policyActivationApprovalStore,
    policyMutationAuditLog,
    financeReleaseDecisionEngine: createAsyncFinanceControlPlaneEngine({
      store: policyControlPlaneStore,
      flow: 'record',
      environment: financePolicyEnvironment,
      decisionLog: financeReleaseDecisionLog,
    }),
    financeCommunicationReleaseShadowEvaluator: createAsyncShadowEvaluator({
      store: policyControlPlaneStore,
      flow: 'communication',
      environment: financePolicyEnvironment,
    }),
    financeActionReleaseShadowEvaluator: createAsyncShadowEvaluator({
      store: policyControlPlaneStore,
      flow: 'action',
      environment: financePolicyEnvironment,
    }),
  });
}

export function buildReleaseRuntimeRequestPathDiagnostics(
  storeModes: ReleaseRuntimeStoreModes,
  input: BuildReleaseRuntimeRequestPathDiagnosticsInput = {},
): ReleaseRuntimeRequestPathDiagnostics {
  const contract = input.contract ?? 'synchronous-local-authority-stores';
  const sharedComponents = Object.entries(storeModes)
    .filter(([, mode]) => mode === 'shared')
    .map(([component]) => component as ReleaseRuntimeStoreComponent);
  const localComponents = Object.entries(storeModes)
    .filter(([, mode]) => mode !== 'shared')
    .map(([component]) => component as ReleaseRuntimeStoreComponent);
  const requiredSharedComponents = Object.keys(storeModes) as ReleaseRuntimeStoreComponent[];
  const allComponentsShared = localComponents.length === 0;
  const usesSharedAuthorityStores =
    contract === 'async-shared-authority-stores' && allComponentsShared;
  const blockers = [
    ...(allComponentsShared
      ? []
      : [
          `release runtime components still use non-shared modes: ${localComponents.join(', ')}`,
        ]),
    ...(contract === 'async-shared-authority-stores'
      ? []
      : [
          'release/policy request handlers still consume synchronous release-layer authority store contracts',
        ]),
  ];

  return Object.freeze({
    version: RELEASE_RUNTIME_REQUEST_PATH_DIAGNOSTICS_SPEC_VERSION,
    usesSharedAuthorityStores,
    contract,
    storeModes,
    sharedComponents: Object.freeze(sharedComponents),
    localComponents: Object.freeze(localComponents),
    requiredSharedComponents: Object.freeze(requiredSharedComponents),
    blockers: Object.freeze(blockers),
  });
}

export interface ReleaseRuntimeBootstrap {
  runtimeProfile: AttestorRuntimeProfile;
  releaseRuntimeStoreModes: ReleaseRuntimeStoreModes;
  releaseRuntimeRequestPathDiagnostics: ReleaseRuntimeRequestPathDiagnostics;
  releaseRuntimeDurability: RuntimeProfileDurabilityEvaluation;
  runtimeProfileDiagnostics: RuntimeProfileStartupDiagnostics;
  releaseAuthorityStore: {
    mode: 'postgres' | 'disabled';
    configured: boolean;
  };
  pki: ReturnType<typeof generatePkiHierarchy>;
  pkiPersistence: ReleaseRuntimePkiPersistence;
  releaseSigningProvider: ReleaseSigningProviderDiagnostics;
  pkiReady: boolean;
  financeReleaseDecisionLog: RequestPathReleaseDecisionLogWriter;
  apiReleaseReviewerQueueStore: RequestPathReleaseReviewerQueueStore;
  apiReleaseIntrospectionStore: RequestPathReleaseTokenIntrospectionStore;
  apiReleaseIntrospector: ReleaseTokenIntrospector;
  apiReleaseTokenIssuer: ReleaseTokenIssuer;
  apiReleaseEvidencePackStore: RequestPathReleaseEvidencePackStore;
  apiReleaseEvidencePackIssuer: ReleaseEvidencePackIssuer;
  apiReleaseVerificationKeyPromise: Promise<ReleaseTokenVerificationKey>;
  apiReleaseVerificationKeysPromise: Promise<readonly ReleaseTokenVerificationKey[]>;
  apiReleaseDegradedModeGrantStore: RequestPathDegradedModeGrantStore;
  policyControlPlaneStore: RequestPathPolicyControlPlaneStore;
  policyActivationApprovalStore: RequestPathPolicyActivationApprovalStore;
  policyMutationAuditLog: RequestPathPolicyMutationAuditLogWriter;
  financePolicyEnvironment: string;
  financeReleaseDecisionEngine: RequestPathReleaseDecisionEngine;
  financeCommunicationReleaseShadowEvaluator: RequestPathReleaseShadowEvaluator<
    ReturnType<ShadowModeReleaseEvaluator['evaluate']>
  >;
  financeActionReleaseShadowEvaluator: RequestPathReleaseShadowEvaluator<
    ReturnType<ShadowModeReleaseEvaluator['evaluate']>
  >;
}

export interface CreateReleaseRuntimeBootstrapInput {
  runtimeProfile?: AttestorRuntimeProfile;
  allowPreflightOnDurabilityViolation?: boolean;
}

export async function createReleaseRuntimeBootstrap(
  input: CreateReleaseRuntimeBootstrapInput = {},
): Promise<ReleaseRuntimeBootstrap> {
  const runtimeProfile = input.runtimeProfile ?? resolveRuntimeProfile();
  const financePolicyEnvironment =
    process.env.ATTESTOR_RELEASE_POLICY_ENVIRONMENT?.trim() ||
    FINANCE_PROVING_POLICY_ENVIRONMENT;
  const sharedAuthorityRequestPath =
    runtimeProfile.id === 'production-shared'
      ? await createSharedReleaseAuthorityRequestPath(financePolicyEnvironment).catch(() => null)
      : null;
  const releaseRuntimeStoreModes = releaseRuntimeStoreModesForProfile(
    runtimeProfile,
    sharedAuthorityRequestPath !== null,
  );
  const releaseRuntimeRequestPathDiagnostics =
    buildReleaseRuntimeRequestPathDiagnostics(releaseRuntimeStoreModes, {
      contract:
        sharedAuthorityRequestPath !== null
          ? 'async-shared-authority-stores'
          : 'synchronous-local-authority-stores',
    });
  const releaseRuntimeDurability = input.allowPreflightOnDurabilityViolation === true
    ? evaluateReleaseRuntimeDurability(runtimeProfile, releaseRuntimeStoreModes)
    : assertReleaseRuntimeDurability(runtimeProfile, releaseRuntimeStoreModes);
  const runtimeProfileDiagnostics = buildRuntimeProfileStartupDiagnostics(
    runtimeProfile,
    releaseRuntimeStoreModes,
    releaseRuntimeDurability,
  );
  const releaseAuthorityStore = Object.freeze({
    mode: releaseAuthorityStoreMode(),
    configured: isReleaseAuthorityStoreConfigured(),
  });
  assertReleaseSigningProviderPreflight();
  const {
    pki,
    retiredVerificationKeys,
    persistence: pkiPersistence,
  } = resolveReleaseRuntimePki(runtimeProfile);
  const releaseSigningProvider = assertReleaseSigningProviderAllowed({
    runtimeProfile,
    pkiPersistence,
  });
  const pkiReady = true;
  const financeReleaseDecisionLog =
    sharedAuthorityRequestPath?.financeReleaseDecisionLog ??
    (runtimeProfile.id === 'production-shared'
      ? unavailableDecisionLog()
      : createReleaseDecisionLogWriterForProfile(runtimeProfile));
  const apiReleaseReviewerQueueStore =
    sharedAuthorityRequestPath?.apiReleaseReviewerQueueStore ??
    (runtimeProfile.id === 'production-shared'
      ? unavailableReviewerQueue()
      : createReleaseReviewerQueueStoreForProfile(runtimeProfile));
  const apiReleaseIntrospectionStore =
    sharedAuthorityRequestPath?.apiReleaseIntrospectionStore ??
    (runtimeProfile.id === 'production-shared'
      ? unavailableTokenIntrospection()
      : createReleaseTokenIntrospectionStoreForProfile(runtimeProfile));
  const apiReleaseIntrospector = createReleaseTokenIntrospector(apiReleaseIntrospectionStore);
  const apiReleaseTokenIssuer = createReleaseTokenIssuer({
    issuer: RELEASE_ISSUER,
    privateKeyPem: pki.signer.keyPair.privateKeyPem,
    publicKeyPem: pki.signer.keyPair.publicKeyPem,
  });
  const apiReleaseEvidencePackStore =
    sharedAuthorityRequestPath?.apiReleaseEvidencePackStore ??
    (runtimeProfile.id === 'production-shared'
      ? unavailableEvidencePackStore()
      : createReleaseEvidencePackStoreForProfile(runtimeProfile));
  const apiReleaseEvidencePackIssuer = createReleaseEvidencePackIssuer({
    issuer: RELEASE_ISSUER,
    privateKeyPem: pki.signer.keyPair.privateKeyPem,
    publicKeyPem: pki.signer.keyPair.publicKeyPem,
  });
  const apiReleaseVerificationKeyPromise = apiReleaseTokenIssuer.exportVerificationKey();
  const apiReleaseVerificationKeysPromise = apiReleaseVerificationKeyPromise.then(
    async (activeVerificationKey) => {
      const retired = await Promise.all(
        retiredVerificationKeys.map((retiredKey) =>
          token.createReleaseTokenVerificationKey({
            issuer: RELEASE_ISSUER,
            publicKeyPem: retiredKey.publicKeyPem,
            keyId: retiredKey.keyId,
            algorithm: retiredKey.algorithm,
          }),
        ),
      );
      return Object.freeze([activeVerificationKey, ...retired]);
    },
  );
  const apiReleaseDegradedModeGrantStore =
    sharedAuthorityRequestPath?.apiReleaseDegradedModeGrantStore ??
    (runtimeProfile.id === 'production-shared'
      ? unavailableDegradedModeGrantStore()
      : createFileBackedDegradedModeGrantStore());
  const policyControlPlaneStore =
    sharedAuthorityRequestPath?.policyControlPlaneStore ??
    (runtimeProfile.id === 'production-shared'
      ? unavailablePolicyStore()
      : createFileBackedPolicyControlPlaneStore());
  const policyActivationApprovalStore =
    sharedAuthorityRequestPath?.policyActivationApprovalStore ??
    (runtimeProfile.id === 'production-shared'
      ? unavailableApprovalStore()
      : createFileBackedPolicyActivationApprovalStore());
  const policyMutationAuditLog =
    sharedAuthorityRequestPath?.policyMutationAuditLog ??
    (runtimeProfile.id === 'production-shared'
      ? unavailablePolicyAuditLog()
      : createFileBackedPolicyMutationAuditLogWriter());

  if (runtimeProfile.id !== 'production-shared') {
    ensureFinanceProvingPolicies(policyControlPlaneStore as PolicyControlPlaneStore, {
      environment: financePolicyEnvironment,
    });
  }

  const financeReleaseDecisionEngine =
    sharedAuthorityRequestPath?.financeReleaseDecisionEngine ??
    (runtimeProfile.id === 'production-shared'
      ? unavailableReleaseDecisionEngine()
      : createFinanceControlPlaneReleaseDecisionEngine({
          store: policyControlPlaneStore as PolicyControlPlaneStore,
          flow: 'record',
          environment: financePolicyEnvironment,
          decisionLog: financeReleaseDecisionLog as never,
        }));
  const financeCommunicationReleaseShadowEvaluator =
    sharedAuthorityRequestPath?.financeCommunicationReleaseShadowEvaluator ??
    (runtimeProfile.id === 'production-shared'
      ? unavailableShadowEvaluator()
      : createShadowModeReleaseEvaluator({
          engine: createFinanceControlPlaneReleaseDecisionEngine({
            store: policyControlPlaneStore as PolicyControlPlaneStore,
            flow: 'communication',
            environment: financePolicyEnvironment,
          }),
        }));
  const financeActionReleaseShadowEvaluator =
    sharedAuthorityRequestPath?.financeActionReleaseShadowEvaluator ??
    (runtimeProfile.id === 'production-shared'
      ? unavailableShadowEvaluator()
      : createShadowModeReleaseEvaluator({
          engine: createFinanceControlPlaneReleaseDecisionEngine({
            store: policyControlPlaneStore as PolicyControlPlaneStore,
            flow: 'action',
            environment: financePolicyEnvironment,
          }),
        }));

  return {
    runtimeProfile,
    releaseRuntimeStoreModes,
    releaseRuntimeRequestPathDiagnostics,
    releaseRuntimeDurability,
    runtimeProfileDiagnostics,
    releaseAuthorityStore,
    pki,
    pkiPersistence,
    releaseSigningProvider,
    pkiReady,
    financeReleaseDecisionLog,
    apiReleaseReviewerQueueStore,
    apiReleaseIntrospectionStore,
    apiReleaseIntrospector,
    apiReleaseTokenIssuer,
    apiReleaseEvidencePackStore,
    apiReleaseEvidencePackIssuer,
    apiReleaseVerificationKeyPromise,
    apiReleaseVerificationKeysPromise,
    apiReleaseDegradedModeGrantStore,
    policyControlPlaneStore,
    policyActivationApprovalStore,
    policyMutationAuditLog,
    financePolicyEnvironment,
    financeReleaseDecisionEngine,
    financeCommunicationReleaseShadowEvaluator,
    financeActionReleaseShadowEvaluator,
  };
}
