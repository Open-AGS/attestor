import type { Context } from 'hono';
import {
  activationApprovals as controlPlaneActivationApprovals,
  activationRecords as controlPlaneActivationRecords,
  auditLog as controlPlaneAuditLog,
  bundleCache as controlPlaneBundleCache,
  impactSummary as controlPlaneImpactSummary,
  objectModel as controlPlaneObjectModel,
  simulation as controlPlaneSimulation,
  store as controlPlaneStore,
  types as controlPlaneTypes,
  type PolicyActivationApprovalGateResult,
  type PolicyActivationApprovalRequest,
  type PolicyActivationApprovalState,
  type PolicyActivationApprovalStore,
  type PolicyMutationAuditEntry,
  type PolicyBundleCacheDescriptor,
  type PolicyActivationRecord,
  type PolicyPackMetadata,
  type PolicyControlPlaneStore,
  type StoredPolicyBundleRecord,
  type UpsertStoredPolicyBundleInput,
  type PolicyActivationTarget,
  type PolicyBundleReference,
  type PolicyPackLifecycleState,
  type PolicyMutationAction,
} from '../../../release-policy-control-plane/index.js';
import type {
  RequestPathPolicyActivationApprovalStore,
  RequestPathPolicyControlPlaneStore,
  RequestPathPolicyMutationAuditLogWriter,
} from '../../release/release-authority-request-path.js';
import type {
  ReleaseActorReference,
  ReleasePolicyRolloutMode,
} from '../../../release-layer/index.js';
import { vocabulary } from '../../../release-layer/index.js';
import type { AdminAuditAction } from '../../admin-audit-log.js';
import { releaseAdminActorForContext } from '../release-admin-authorization.js';
export {
  RELEASE_ADMIN_BREAK_GLASS_ROLES,
  RELEASE_ADMIN_MUTATION_ROLES,
  RELEASE_ADMIN_READ_ROLES,
  authorizeReleaseAdminRoute,
} from '../release-admin-authorization.js';

export const {
  activatePolicyBundle,
  findLatestActiveExactTargetActivation,
  freezePolicyActivationScope,
  rollbackPolicyActivation,
} = controlPlaneActivationRecords;
export const {
  evaluatePolicyActivationApprovalGate,
  recordPolicyActivationApprovalDecision,
  requestPolicyActivationApproval,
} = controlPlaneActivationApprovals;
export const {
  createPolicyMutationAuditSubjectFromActivation,
  createPolicyMutationAuditSubjectFromBundle,
  createPolicyMutationAuditSubjectFromPack,
} = controlPlaneAuditLog;
export const {
  createPolicyBundleConditionalResponse,
  policyBundleCacheHeaders,
} = controlPlaneBundleCache;
export const { createPolicyImpactApi } = controlPlaneImpactSummary;
export const {
  createPolicyControlPlaneMetadata,
  createPolicyPackMetadata,
} = controlPlaneObjectModel;
export const { createPolicySimulationApi } = controlPlaneSimulation;
export const {
  POLICY_PACK_LIFECYCLE_STATES,
  createPolicyActivationTarget,
} = controlPlaneTypes;

export type JsonRecord = Record<string, unknown>;
export type PolicyControlPlaneErrorCode =
  | 'bad_request'
  | 'not_found'
  | 'conflict'
  | 'forbidden'
  | 'internal';
export type PolicyControlPlaneHttpStatus = 400 | 403 | 404 | 409 | 500;

export const DEFAULT_RELEASE_POLICY_LIST_LIMIT = 50;
export const MAX_RELEASE_POLICY_LIST_LIMIT = 100;
export const POLICY_CONTROL_ERROR_STATUS: Record<PolicyControlPlaneErrorCode, PolicyControlPlaneHttpStatus> = {
  bad_request: 400,
  not_found: 404,
  conflict: 409,
  forbidden: 403,
  internal: 500,
};

export interface ReleasePolicyControlRouteDeps {
  currentAdminAuthorized(c: Context): Response | null;
  policyControlPlaneStore: RequestPathPolicyControlPlaneStore;
  policyActivationApprovalStore: RequestPathPolicyActivationApprovalStore;
  policyMutationAuditLog: RequestPathPolicyMutationAuditLogWriter;
  adminMutationRequest?: (
    c: Context,
    routeId: string,
    requestPayload: unknown,
  ) => Promise<{ idempotencyKey: string | null; requestHash: string } | Response>;
  finalizeAdminMutation?: (options: {
    idempotencyKey: string | null;
    routeId: string;
    requestPayload: unknown;
    statusCode: number;
    responseBody: Record<string, unknown>;
    audit: {
      action: AdminAuditAction;
      accountId?: string | null;
      tenantId?: string | null;
      requestHash?: string;
      metadata?: Record<string, unknown>;
    };
  }) => Promise<Record<string, unknown>>;
}

export const ROLLOUT_MODES = ['dry-run', 'canary', 'enforce', 'rolled-back'] as const;
export function noStore(c: Context): void {
  c.header('cache-control', 'no-store');
}

export class PolicyControlPlaneRouteError extends Error {
  readonly code: PolicyControlPlaneErrorCode;

  constructor(code: PolicyControlPlaneErrorCode, message: string) {
    super(message);
    this.name = 'PolicyControlPlaneRouteError';
    this.code = code;
  }
}

export function policyControlPlaneError(
  code: PolicyControlPlaneErrorCode,
  message: string,
): PolicyControlPlaneRouteError {
  return new PolicyControlPlaneRouteError(code, message);
}

export function badRequest(message: string): PolicyControlPlaneRouteError {
  return policyControlPlaneError('bad_request', message);
}

export function policyErrorResponse(c: Context, error: unknown): Response {
  const mapped = mapPolicyControlPlaneError(error);
  return c.json({
    error: mapped.message,
    code: mapped.code,
  }, mapped.status);
}

export function mapPolicyControlPlaneError(error: unknown): {
  readonly code: PolicyControlPlaneErrorCode;
  readonly status: PolicyControlPlaneHttpStatus;
  readonly message: string;
} {
  if (error instanceof PolicyControlPlaneRouteError) {
    return {
      code: error.code,
      status: POLICY_CONTROL_ERROR_STATUS[error.code],
      message: error.message,
    };
  }
  if (!(error instanceof Error)) {
    return internalPolicyError();
  }

  const message = error.message;
  const normalized = message.toLowerCase();
  if (normalized.includes('was not found') || normalized.includes(' not found')) {
    return knownPolicyError('not_found', message);
  }
  if (
    normalized.includes('already ') ||
    normalized.includes('ambiguous') ||
    normalized.includes('conflict') ||
    normalized.includes('cannot rollback policy activation')
  ) {
    return knownPolicyError('conflict', message);
  }
  if (
    normalized.includes('cannot be granted by the same actor') ||
    normalized.includes('is not allowed for this policy activation approval')
  ) {
    return knownPolicyError('forbidden', message);
  }
  if (
    normalized.includes(' must ') ||
    normalized.includes(' requires ') ||
    normalized.includes(' require ') ||
    normalized.includes(' cannot be blank') ||
    normalized.startsWith('unsupported ') ||
    normalized.includes(' is invalid') ||
    normalized.includes(' invalid ')
  ) {
    return knownPolicyError('bad_request', message);
  }
  return internalPolicyError();
}

export function knownPolicyError(
  code: PolicyControlPlaneErrorCode,
  message: string,
): {
  readonly code: PolicyControlPlaneErrorCode;
  readonly status: PolicyControlPlaneHttpStatus;
  readonly message: string;
} {
  return {
    code,
    status: POLICY_CONTROL_ERROR_STATUS[code],
    message,
  };
}

export function internalPolicyError(): {
  readonly code: PolicyControlPlaneErrorCode;
  readonly status: PolicyControlPlaneHttpStatus;
  readonly message: string;
} {
  return {
    code: 'internal',
    status: 500,
    message: 'Release policy control-plane operation failed.',
  };
}

export function isJsonRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function requiredString(source: JsonRecord, key: string): string {
  const value = source[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw badRequest(`${key} is required and must be a non-empty string.`);
  }
  return value.trim();
}

export function optionalString(source: JsonRecord, key: string): string | null {
  const value = source[key];
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw badRequest(`${key} must be a string when provided.`);
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function optionalStringArray(source: JsonRecord, key: string): readonly string[] {
  const value = source[key];
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw badRequest(`${key} must be an array of strings when provided.`);
  }
  return value.map((entry) => entry.trim()).filter(Boolean).sort();
}

export function optionalConsequenceType(source: JsonRecord): string | null {
  const value = optionalString(source, 'consequenceType');
  if (value === null) {
    return null;
  }
  if (!(vocabulary.CONSEQUENCE_TYPES as readonly string[]).includes(value)) {
    throw badRequest(`consequenceType must be one of: ${vocabulary.CONSEQUENCE_TYPES.join(', ')}.`);
  }
  return value;
}

export function optionalRiskClass(source: JsonRecord): string | null {
  const value = optionalString(source, 'riskClass');
  if (value === null) {
    return null;
  }
  if (!(vocabulary.RISK_CLASSES as readonly string[]).includes(value)) {
    throw badRequest(`riskClass must be one of: ${vocabulary.RISK_CLASSES.join(', ')}.`);
  }
  return value;
}

export function parseLifecycleState(value: unknown): PolicyPackLifecycleState | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (
    typeof value !== 'string' ||
    !(POLICY_PACK_LIFECYCLE_STATES as readonly string[]).includes(value)
  ) {
    throw badRequest(`lifecycleState must be one of: ${POLICY_PACK_LIFECYCLE_STATES.join(', ')}.`);
  }
  return value as PolicyPackLifecycleState;
}

export function parseBundleReference(value: unknown): PolicyBundleReference | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (!isJsonRecord(value)) {
    throw badRequest('latestBundleRef must be an object when provided.');
  }
  return {
    packId: requiredString(value, 'packId'),
    bundleId: requiredString(value, 'bundleId'),
    bundleVersion: requiredString(value, 'bundleVersion'),
    digest: requiredString(value, 'digest'),
  };
}

export function parsePackMetadata(value: unknown): PolicyPackMetadata {
  if (!isJsonRecord(value)) {
    throw badRequest('pack must be an object.');
  }
  const now = new Date().toISOString();
  return createPolicyPackMetadata({
    id: requiredString(value, 'id'),
    name: requiredString(value, 'name'),
    description: optionalString(value, 'description'),
    lifecycleState: parseLifecycleState(value.lifecycleState),
    owners: optionalStringArray(value, 'owners'),
    labels: optionalStringArray(value, 'labels'),
    createdAt: optionalString(value, 'createdAt') ?? now,
    updatedAt: optionalString(value, 'updatedAt') ?? now,
    latestBundleRef: parseBundleReference(value.latestBundleRef),
  });
}

export function parseActivationTarget(value: unknown): PolicyActivationTarget {
  if (!isJsonRecord(value)) {
    throw badRequest('target must be an object.');
  }
  return createPolicyActivationTarget({
    environment: requiredString(value, 'environment'),
    tenantId: optionalString(value, 'tenantId'),
    accountId: optionalString(value, 'accountId'),
    domainId: optionalString(value, 'domainId'),
    wedgeId: optionalString(value, 'wedgeId'),
    consequenceType: (optionalConsequenceType(value) ?? undefined) as never,
    riskClass: (optionalRiskClass(value) ?? undefined) as never,
    cohortId: optionalString(value, 'cohortId'),
    planId: optionalString(value, 'planId'),
  });
}

export function parseRolloutMode(value: unknown): ReleasePolicyRolloutMode {
  if (value === undefined || value === null) {
    return 'enforce';
  }
  if (typeof value !== 'string' || !(ROLLOUT_MODES as readonly string[]).includes(value)) {
    throw badRequest(`rolloutMode must be one of: ${ROLLOUT_MODES.join(', ')}.`);
  }
  return value as ReleasePolicyRolloutMode;
}

export function parseApprovalState(value: string | undefined): PolicyActivationApprovalState | null {
  if (value === undefined || value.trim().length === 0) return null;
  const normalized = value.trim();
  if (!['pending', 'approved', 'rejected'].includes(normalized)) {
    throw badRequest('state must be one of: pending, approved, rejected.');
  }
  return normalized as PolicyActivationApprovalState;
}

export async function parseJsonBody(c: Context): Promise<JsonRecord | Response> {
  try {
    const body = await c.req.json();
    if (!isJsonRecord(body)) {
      return c.json({ error: 'JSON request body must be an object.' }, 400);
    }
    return body;
  } catch {
    return c.json({ error: 'Valid JSON request body required.' }, 400);
  }
}

export function packView(pack: PolicyPackMetadata): Record<string, unknown> {
  return {
    id: pack.id,
    name: pack.name,
    description: pack.description,
    lifecycleState: pack.lifecycleState,
    owners: pack.owners,
    labels: pack.labels,
    createdAt: pack.createdAt,
    updatedAt: pack.updatedAt,
    latestBundleRef: pack.latestBundleRef,
  };
}

export function bundleSummaryView(record: StoredPolicyBundleRecord): Record<string, unknown> {
  return {
    packId: record.packId,
    bundleId: record.bundleId,
    bundleVersion: record.bundleVersion,
    storedAt: record.storedAt,
    entryCount: record.manifest.entries.length,
    payloadDigest: record.artifact.payloadDigest,
    packDigest: record.artifact.packDigest,
    manifestDigest: record.artifact.manifestDigest,
    entriesDigest: record.artifact.entriesDigest,
    signed: record.signedBundle !== null,
    signatureStatus: record.signedBundle ? 'verified' : 'unsigned',
    keyId: record.verificationKey?.keyId ?? null,
    publicKeyFingerprint: record.verificationKey?.publicKeyFingerprint ?? null,
  };
}

export function bundleDetailView(record: StoredPolicyBundleRecord, c: Context): Record<string, unknown> {
  const includeArtifact = c.req.query('includeArtifact') === 'true';
  const includeSignedBundle = c.req.query('includeSignedBundle') === 'true';
  return {
    ...bundleSummaryView(record),
    manifest: record.manifest,
    artifact: includeArtifact
      ? record.artifact
      : {
          version: record.artifact.version,
          bundleId: record.artifact.bundleId,
          packId: record.artifact.packId,
          payloadType: record.artifact.payloadType,
          payloadDigest: record.artifact.payloadDigest,
          packDigest: record.artifact.packDigest,
          manifestDigest: record.artifact.manifestDigest,
          entriesDigest: record.artifact.entriesDigest,
          schemasDigest: record.artifact.schemasDigest,
        },
    signedBundle: includeSignedBundle ? record.signedBundle : null,
    verificationKey: record.verificationKey,
  };
}

export function applyBundleCacheHeaders(
  c: Context,
  descriptor: PolicyBundleCacheDescriptor,
): void {
  for (const [key, value] of Object.entries(policyBundleCacheHeaders(descriptor))) {
    c.header(key, value);
  }
}

export function activationView(record: PolicyActivationRecord): Record<string, unknown> {
  return {
    id: record.id,
    state: record.state,
    operationType: record.operationType,
    target: record.target,
    selector: record.selector,
    targetLabel: record.targetLabel,
    bundle: record.bundle,
    activatedBy: record.activatedBy,
    activatedAt: record.activatedAt,
    rolloutMode: record.rolloutMode,
    reasonCode: record.reasonCode,
    rationale: record.rationale,
    previousActivationId: record.previousActivationId,
    supersededByActivationId: record.supersededByActivationId,
    rollbackOfActivationId: record.rollbackOfActivationId,
    freezeReason: record.freezeReason,
  };
}

export function approvalRequestView(request: PolicyActivationApprovalRequest): Record<string, unknown> {
  return {
    id: request.id,
    state: request.state,
    target: request.target,
    targetLabel: request.targetLabel,
    bundle: request.bundle,
    requestedBy: request.requestedBy,
    requestedAt: request.requestedAt,
    expiresAt: request.expiresAt,
    reasonCode: request.reasonCode,
    rationale: request.rationale,
    requirement: request.requirement,
    decisions: request.decisions,
    approvedReviewerIds: request.approvedReviewerIds,
    rejectedReviewerIds: request.rejectedReviewerIds,
    latestDecisionAt: request.latestDecisionAt,
    approvalDigest: request.approvalDigest,
  };
}

export function approvalGateView(gate: PolicyActivationApprovalGateResult): Record<string, unknown> {
  return {
    allowed: gate.allowed,
    status: gate.status,
    message: gate.message,
    requirement: gate.requirement,
    request: gate.request ? approvalRequestView(gate.request) : null,
  };
}

export function auditEntryView(
  entry: PolicyMutationAuditEntry,
  includeSnapshot: boolean,
): Record<string, unknown> {
  return {
    entryId: entry.entryId,
    sequence: entry.sequence,
    occurredAt: entry.occurredAt,
    action: entry.action,
    actor: entry.actor,
    subject: entry.subject,
    reasonCode: entry.reasonCode,
    rationale: entry.rationale,
    mutationDigest: entry.mutationDigest,
    previousEntryDigest: entry.previousEntryDigest,
    entryDigest: entry.entryDigest,
    mutationSnapshot: includeSnapshot ? entry.mutationSnapshot : undefined,
  };
}

export function routeAdminActor(c: Context): ReleaseActorReference {
  return releaseAdminActorForContext(c).releaseActor;
}

export function requireBreakGlassAuthorization(
  c: Context,
  body: JsonRecord,
): {
  readonly actor: ReleaseActorReference;
  readonly reasonCode: string;
  readonly rationale: string;
  readonly incidentId: string | null;
} | Response {
  const actor = routeAdminActor(c);
  const acknowledged =
    body.breakGlass === true ||
    c.req.header('x-attestor-break-glass')?.trim().toLowerCase() === 'true';
  if (!acknowledged) {
    return c.json({
      error: 'Emergency policy control operations require breakGlass=true or x-attestor-break-glass: true.',
    }, 400);
  }

  const reasonCode = optionalString(body, 'reasonCode');
  const rationale = optionalString(body, 'rationale');
  if (!reasonCode || !rationale) {
    return c.json({
      error: 'Emergency policy control operations require non-empty reasonCode and rationale fields.',
    }, 400);
  }

  return {
    actor,
    reasonCode,
    rationale,
    incidentId: optionalString(body, 'incidentId'),
  };
}

export function parseBoundedListInteger(
  value: string | undefined,
  fieldName: 'cursor' | 'limit',
): number | Response | null {
  if (value === undefined) return null;
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    return new Response(JSON.stringify({
      error: `${fieldName} must be a ${fieldName === 'cursor' ? 'non-negative' : 'positive'} integer.`,
      code: 'bad_request',
    }), {
      status: 400,
      headers: { 'content-type': 'application/json; charset=UTF-8' },
    });
  }
  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || (fieldName === 'limit' && parsed === 0)) {
    return new Response(JSON.stringify({
      error: `${fieldName} must be a ${fieldName === 'cursor' ? 'non-negative' : 'positive'} integer.`,
      code: 'bad_request',
    }), {
      status: 400,
      headers: { 'content-type': 'application/json; charset=UTF-8' },
    });
  }
  if (fieldName === 'limit' && parsed > MAX_RELEASE_POLICY_LIST_LIMIT) {
    return new Response(JSON.stringify({
      error: `limit must be less than or equal to ${MAX_RELEASE_POLICY_LIST_LIMIT}.`,
      code: 'bad_request',
    }), {
      status: 400,
      headers: { 'content-type': 'application/json; charset=UTF-8' },
    });
  }
  return parsed;
}

export function paginateReleasePolicyList<T>(
  entries: readonly T[],
  c: Context,
): {
  readonly items: readonly T[];
  readonly pageInfo: Record<string, unknown>;
} | Response {
  const parsedLimit = parseBoundedListInteger(c.req.query('limit'), 'limit');
  if (parsedLimit instanceof Response) return parsedLimit;
  const parsedCursor = parseBoundedListInteger(c.req.query('cursor'), 'cursor');
  if (parsedCursor instanceof Response) return parsedCursor;
  const limit = parsedLimit ?? DEFAULT_RELEASE_POLICY_LIST_LIMIT;
  const cursor = parsedCursor ?? 0;
  const items = entries.slice(cursor, cursor + limit);
  const nextOffset = cursor + items.length;
  return {
    items,
    pageInfo: {
      limit,
      cursor: String(cursor),
      nextCursor: nextOffset < entries.length ? String(nextOffset) : null,
      totalItems: entries.length,
    },
  };
}

export function parsePositiveLimit(value: string | undefined): number | null {
  if (value === undefined) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export function filterAuditEntries(
  entries: readonly PolicyMutationAuditEntry[],
  c: Context,
): readonly PolicyMutationAuditEntry[] | Response {
  const limitQuery = c.req.query('limit');
  const limit = parsePositiveLimit(limitQuery);
  if (limitQuery !== undefined && limit === null) {
    return c.json({ error: 'limit must be a positive integer.' }, 400);
  }
  const action = c.req.query('action')?.trim() as PolicyMutationAction | undefined;
  const packId = c.req.query('packId')?.trim();
  const bundleId = c.req.query('bundleId')?.trim();
  const activationId = c.req.query('activationId')?.trim();
  const filtered = entries
    .filter((entry) => !action || entry.action === action)
    .filter((entry) => !packId || entry.subject.packId === packId)
    .filter((entry) => !bundleId || entry.subject.bundleId === bundleId)
    .filter((entry) => !activationId || entry.subject.activationId === activationId)
    .sort((left, right) => right.sequence - left.sequence);
  return limit ? filtered.slice(0, limit) : filtered;
}

export async function beginMutation(
  c: Context,
  deps: ReleasePolicyControlRouteDeps,
  routeId: string,
  body: JsonRecord,
): Promise<{ idempotencyKey: string | null; requestHash: string } | Response> {
  if (deps.adminMutationRequest) {
    return deps.adminMutationRequest(c, routeId, body);
  }
  return {
    idempotencyKey: null,
    requestHash: `route:${routeId}`,
  };
}

export async function finishMutation(
  deps: ReleasePolicyControlRouteDeps,
  options: {
    idempotencyKey: string | null;
    requestHash: string;
    routeId: string;
    requestPayload: JsonRecord;
    statusCode: number;
    responseBody: Record<string, unknown>;
    adminAuditAction: AdminAuditAction;
    target?: PolicyActivationTarget | null;
    metadata?: Record<string, unknown>;
  },
): Promise<Record<string, unknown>> {
  if (!deps.finalizeAdminMutation) {
    return options.responseBody;
  }
  return deps.finalizeAdminMutation({
    idempotencyKey: options.idempotencyKey,
    routeId: options.routeId,
    requestPayload: options.requestPayload,
    statusCode: options.statusCode,
    responseBody: options.responseBody,
    audit: {
      action: options.adminAuditAction,
      tenantId: options.target?.tenantId ?? null,
      accountId: options.target?.accountId ?? null,
      requestHash: options.requestHash,
      metadata: options.metadata ?? {},
    },
  });
}

export async function snapshotPolicyStore(
  store: RequestPathPolicyControlPlaneStore,
): Promise<PolicyControlPlaneStore> {
  return controlPlaneStore.createInMemoryPolicyControlPlaneStoreFromSnapshot(
    await store.exportSnapshot(),
  );
}

export async function snapshotApprovalStore(
  store: RequestPathPolicyActivationApprovalStore,
): Promise<PolicyActivationApprovalStore> {
  return controlPlaneActivationApprovals.createInMemoryPolicyActivationApprovalStoreFromSnapshot(
    await store.exportSnapshot(),
  );
}

export async function publishStoreMetadata(
  store: RequestPathPolicyControlPlaneStore,
  bundle: StoredPolicyBundleRecord,
  latestActivationId: string | null,
): Promise<void> {
  const previous = await store.getMetadata();
  await store.setMetadata(
    createPolicyControlPlaneMetadata(
      store.kind,
      previous?.discoveryMode ?? 'scoped-active',
      bundle.manifest.bundle,
      latestActivationId ?? previous?.latestActivationId ?? null,
    ),
  );
}

export async function findRequiredBundle(
  store: RequestPathPolicyControlPlaneStore,
  packId: string,
  bundleId: string,
): Promise<StoredPolicyBundleRecord | null> {
  return store.getBundle(packId, bundleId);
}

export async function requestActivationApproval(
  store: RequestPathPolicyActivationApprovalStore,
  input: Parameters<typeof requestPolicyActivationApproval>[1],
): Promise<PolicyActivationApprovalRequest> {
  const localStore = await snapshotApprovalStore(store);
  const request = requestPolicyActivationApproval(localStore, input);
  return store.upsert(request);
}

export async function recordActivationApprovalDecision(
  store: RequestPathPolicyActivationApprovalStore,
  input: Parameters<typeof recordPolicyActivationApprovalDecision>[1],
): Promise<PolicyActivationApprovalRequest> {
  const localStore = await snapshotApprovalStore(store);
  const request = recordPolicyActivationApprovalDecision(localStore, input);
  return store.upsert(request);
}

export async function evaluateActivationApprovalGate(
  store: RequestPathPolicyActivationApprovalStore,
  input: Parameters<typeof evaluatePolicyActivationApprovalGate>[1],
): Promise<PolicyActivationApprovalGateResult> {
  const localStore = await snapshotApprovalStore(store);
  return evaluatePolicyActivationApprovalGate(localStore, input);
}

export async function applyPolicyLifecycle(
  store: RequestPathPolicyControlPlaneStore,
  action: (localStore: PolicyControlPlaneStore) => ReturnType<typeof activatePolicyBundle>,
): Promise<ReturnType<typeof activatePolicyBundle>> {
  const localStore = await snapshotPolicyStore(store);
  const lifecycle = action(localStore);
  await store.upsertActivation(lifecycle.appliedRecord);
  if (lifecycle.updatedHistoricalRecord) {
    await store.upsertActivation(lifecycle.updatedHistoricalRecord);
  }
  return lifecycle;
}

export function parseBundleUpsertInput(body: JsonRecord): UpsertStoredPolicyBundleInput {
  const source = isJsonRecord(body.bundle) ? body.bundle : body;
  if (!isJsonRecord(source.manifest)) {
    throw badRequest('manifest must be provided as an object.');
  }
  if (!isJsonRecord(source.artifact)) {
    throw badRequest('artifact must be provided as an object.');
  }
  const signedBundle = isJsonRecord(source.signedBundle) ? source.signedBundle : null;
  return {
    manifest: source.manifest as never,
    artifact: source.artifact as never,
    signedBundle: signedBundle as never,
    verificationKey: (source.verificationKey ?? signedBundle?.verificationKey ?? null) as never,
    storedAt: optionalString(source, 'storedAt') ?? undefined,
  };
}
