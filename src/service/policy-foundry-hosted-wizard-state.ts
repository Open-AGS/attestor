/**
 * Policy Foundry hosted wizard state - digest-only evaluation persistence.
 *
 * BOUNDARY:
 * - Local file-backed evaluation store only
 * - Stores compact hosted review state, not raw manifests or shadow payloads
 * - Tenant-bound lookup uses tenant digests
 * - No credential issuance, patch application, deployment, traffic execution, or enforcement activation
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
  consequenceDataMinimizationMaterialSafetyFindings,
} from '../consequence-admission/data-minimization-redaction-policy.js';
import type {
  PolicyFoundryHostedReviewEvidenceCard,
  PolicyFoundryHostedReviewNoGoCard,
  PolicyFoundryHostedReviewSurface,
  PolicyFoundryHostedReviewTask,
} from '../consequence-admission/policy-foundry-hosted-review-surface.js';
import { withFileLock, writeTextFileAtomic } from './file-store.js';
import { stableJsonStringify } from './json-stable.js';

export const POLICY_FOUNDRY_HOSTED_WIZARD_STATE_VERSION =
  'attestor.policy-foundry-hosted-wizard-state.v1';
export const POLICY_FOUNDRY_HOSTED_WIZARD_STATE_DEFAULT_TTL_HOURS = 24;

export type PolicyFoundryHostedWizardStateEventKind =
  'created' | 'updated';

export interface PolicyFoundryHostedWizardStateEvent {
  readonly sequence: number;
  readonly eventKind: PolicyFoundryHostedWizardStateEventKind;
  readonly occurredAt: string;
  readonly workflowDigest: string;
  readonly reviewSurfaceDigest: string;
}

export type PolicyFoundryHostedWizardTaskSnapshot = Pick<
  PolicyFoundryHostedReviewTask,
  | 'stepId'
  | 'status'
  | 'priority'
  | 'title'
  | 'safeInstruction'
  | 'reasonCodes'
  | 'sourceDigest'
  | 'customerActionRequired'
  | 'approvalRequired'
>;

export type PolicyFoundryHostedWizardNoGoSnapshot =
  PolicyFoundryHostedReviewNoGoCard;

export type PolicyFoundryHostedWizardEvidenceSnapshot =
  PolicyFoundryHostedReviewEvidenceCard;

export interface PolicyFoundryHostedWizardStateRecord {
  readonly version: typeof POLICY_FOUNDRY_HOSTED_WIZARD_STATE_VERSION;
  readonly sessionId: string;
  readonly tenantDigest: string;
  readonly tenantSource: string;
  readonly planId: string | null;
  readonly workflowId: string;
  readonly workflowDigest: string;
  readonly reviewSurfaceId: string;
  readonly reviewSurfaceDigest: string;
  readonly status: PolicyFoundryHostedReviewSurface['status'];
  readonly headline: string;
  readonly nextSafeStep: string;
  readonly surfaceCount: number;
  readonly shadowEventCount: number;
  readonly blockerCount: number;
  readonly currentTaskCount: number;
  readonly noGoCount: number;
  readonly taskCards: readonly PolicyFoundryHostedWizardTaskSnapshot[];
  readonly noGoCards: readonly PolicyFoundryHostedWizardNoGoSnapshot[];
  readonly evidenceCards: readonly PolicyFoundryHostedWizardEvidenceSnapshot[];
  readonly safeAutomations: readonly string[];
  readonly approvalGatedAutomations: readonly string[];
  readonly prohibitedAutomations: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly expiresAt: string;
  readonly events: readonly PolicyFoundryHostedWizardStateEvent[];
  readonly approvalRequired: true;
  readonly customerApprovalRecorded: boolean;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly rawReviewSurfaceStored: false;
  readonly productionReady: false;
  readonly reviewMaterialOnly: true;
  readonly fullPacketRequiredForImplementation: true;
  readonly storageMode: 'file-backed-evaluation';
  readonly dataMinimizationPolicyVersion: typeof CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION;
  readonly dataMinimizationSurfaceKind: 'policy-foundry-hosted-wizard-state';
  readonly limitations: readonly string[];
  readonly canonical: string;
  readonly digest: string;
}

type PolicyFoundryHostedWizardStatePayload =
  Omit<PolicyFoundryHostedWizardStateRecord, 'canonical' | 'digest'>;

interface PolicyFoundryHostedWizardStateStoreFile {
  version: 1;
  records: PolicyFoundryHostedWizardStateRecord[];
}

export interface UpsertPolicyFoundryHostedWizardStateInput {
  readonly sessionId?: string | null;
  readonly tenantDigest: string;
  readonly tenantSource: string;
  readonly planId?: string | null;
  readonly reviewSurface: PolicyFoundryHostedReviewSurface;
  readonly ttlHours?: number | null;
  readonly recordedAt?: string | null;
}

export interface FindPolicyFoundryHostedWizardStateInput {
  readonly tenantDigest: string;
  readonly sessionId: string;
  readonly now?: string | null;
}

export interface PolicyFoundryHostedWizardStateStore {
  upsert(input: UpsertPolicyFoundryHostedWizardStateInput): {
    readonly kind: 'created' | 'updated';
    readonly record: PolicyFoundryHostedWizardStateRecord;
    readonly path: string;
  };
  find(input: FindPolicyFoundryHostedWizardStateInput): {
    readonly record: PolicyFoundryHostedWizardStateRecord | null;
    readonly path: string;
  };
  exportSnapshot(): {
    readonly path: string;
    readonly version: 1;
    readonly exportedAt: string;
    readonly recordCount: number;
    readonly records: readonly PolicyFoundryHostedWizardStateRecord[];
  };
}

export interface PolicyFoundryHostedWizardStateDescriptor {
  readonly version: typeof POLICY_FOUNDRY_HOSTED_WIZARD_STATE_VERSION;
  readonly storageMode: 'file-backed-evaluation';
  readonly defaultTtlHours: typeof POLICY_FOUNDRY_HOSTED_WIZARD_STATE_DEFAULT_TTL_HOURS;
  readonly tenantBoundLookup: true;
  readonly storesRawPayload: false;
  readonly storesRawReviewSurface: false;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly dataMinimizationPolicyVersion: typeof CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION;
  readonly dataMinimizationSurfaceKind: 'policy-foundry-hosted-wizard-state';
}

function defaultStorePath(): string {
  return resolve(
    process.env.ATTESTOR_POLICY_FOUNDRY_HOSTED_WIZARD_STATE_STORE_PATH ??
      '.attestor/policy-foundry-hosted-wizard-state.json',
  );
}

function defaultStore(): PolicyFoundryHostedWizardStateStoreFile {
  return { version: 1, records: [] };
}

function normalizeIdentifier(value: string | null | undefined, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Policy Foundry hosted wizard state ${fieldName} requires a string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Policy Foundry hosted wizard state ${fieldName} requires a non-empty value.`);
  }
  return normalized;
}

function normalizeOptionalIdentifier(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeIsoTimestamp(
  value: string | null | undefined,
  fallback: string,
  fieldName: string,
): string {
  const raw = value ?? fallback;
  const timestamp = new Date(raw);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Policy Foundry hosted wizard state ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function normalizeTtlHours(value: number | null | undefined): number {
  if (value === undefined || value === null) {
    const parsed = Number.parseInt(
      process.env.ATTESTOR_POLICY_FOUNDRY_HOSTED_WIZARD_STATE_TTL_HOURS ?? '',
      10,
    );
    return Number.isFinite(parsed) && parsed > 0
      ? Math.min(parsed, 168)
      : POLICY_FOUNDRY_HOSTED_WIZARD_STATE_DEFAULT_TTL_HOURS;
  }
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('Policy Foundry hosted wizard state ttlHours must be positive.');
  }
  return Math.min(Math.ceil(value), 168);
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function sessionIdFor(input: UpsertPolicyFoundryHostedWizardStateInput): string {
  const external = normalizeOptionalIdentifier(input.sessionId);
  const seed = [
    input.tenantDigest,
    external ?? input.reviewSurface.workflowId,
  ].join('\n');
  return `pfwiz_${sha256(seed).slice(0, 24)}`;
}

function canonicalObject(value: unknown): {
  readonly canonical: string;
  readonly digest: string;
} {
  const canonical = stableJsonStringify(value);
  return Object.freeze({
    canonical,
    digest: `sha256:${createHash('sha256').update(canonical).digest('hex')}`,
  });
}

function assertSafePayload(payload: PolicyFoundryHostedWizardStatePayload): void {
  const findings = consequenceDataMinimizationMaterialSafetyFindings({
    findingSubject: 'Policy Foundry hosted wizard state',
    material: JSON.stringify(payload),
  });
  if (findings.length > 0) {
    throw new Error(`Policy Foundry hosted wizard state contains sensitive material: ${findings.join('; ')}`);
  }
}

function finalizeRecord(
  payload: PolicyFoundryHostedWizardStatePayload,
): PolicyFoundryHostedWizardStateRecord {
  assertSafePayload(payload);
  const canonical = canonicalObject(payload);
  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

function taskSnapshot(
  task: PolicyFoundryHostedReviewTask,
): PolicyFoundryHostedWizardTaskSnapshot {
  return Object.freeze({
    stepId: task.stepId,
    status: task.status,
    priority: task.priority,
    title: task.title,
    safeInstruction: task.safeInstruction,
    reasonCodes: task.reasonCodes,
    sourceDigest: task.sourceDigest,
    customerActionRequired: task.customerActionRequired,
    approvalRequired: task.approvalRequired,
  });
}

function expiresAt(recordedAt: string, ttlHours: number): string {
  return new Date(new Date(recordedAt).getTime() + (ttlHours * 60 * 60 * 1_000)).toISOString();
}

function isExpired(record: PolicyFoundryHostedWizardStateRecord, now: string): boolean {
  return Date.parse(record.expiresAt) <= Date.parse(now);
}

function newEvent(
  sequence: number,
  eventKind: PolicyFoundryHostedWizardStateEventKind,
  occurredAt: string,
  reviewSurface: PolicyFoundryHostedReviewSurface,
): PolicyFoundryHostedWizardStateEvent {
  return Object.freeze({
    sequence,
    eventKind,
    occurredAt,
    workflowDigest: reviewSurface.workflowDigest,
    reviewSurfaceDigest: reviewSurface.digest,
  });
}

function createRecordPayload(
  input: UpsertPolicyFoundryHostedWizardStateInput,
  existing: PolicyFoundryHostedWizardStateRecord | null,
): PolicyFoundryHostedWizardStatePayload {
  const tenantDigest = normalizeIdentifier(input.tenantDigest, 'tenantDigest');
  const tenantSource = normalizeIdentifier(input.tenantSource, 'tenantSource');
  const recordedAt = normalizeIsoTimestamp(input.recordedAt, new Date().toISOString(), 'recordedAt');
  const ttlHours = normalizeTtlHours(input.ttlHours);
  const events = Object.freeze([
    ...(existing?.events ?? []),
    newEvent(
      (existing?.events.length ?? 0) + 1,
      existing ? 'updated' : 'created',
      recordedAt,
      input.reviewSurface,
    ),
  ]);

  return Object.freeze({
    version: POLICY_FOUNDRY_HOSTED_WIZARD_STATE_VERSION,
    sessionId: sessionIdFor(input),
    tenantDigest,
    tenantSource,
    planId: normalizeOptionalIdentifier(input.planId),
    workflowId: input.reviewSurface.workflowId,
    workflowDigest: input.reviewSurface.workflowDigest,
    reviewSurfaceId: input.reviewSurface.reviewSurfaceId,
    reviewSurfaceDigest: input.reviewSurface.digest,
    status: input.reviewSurface.status,
    headline: input.reviewSurface.headline,
    nextSafeStep: input.reviewSurface.nextSafeStep,
    surfaceCount: input.reviewSurface.surfaceCount,
    shadowEventCount: input.reviewSurface.shadowEventCount,
    blockerCount: input.reviewSurface.blockerCount,
    currentTaskCount: input.reviewSurface.currentTaskCount,
    noGoCount: input.reviewSurface.noGoCount,
    taskCards: Object.freeze(input.reviewSurface.taskCards.map(taskSnapshot)),
    noGoCards: input.reviewSurface.noGoCards,
    evidenceCards: input.reviewSurface.evidenceCards,
    safeAutomations: input.reviewSurface.safeAutomations,
    approvalGatedAutomations: input.reviewSurface.approvalGatedAutomations,
    prohibitedAutomations: input.reviewSurface.prohibitedAutomations,
    createdAt: existing?.createdAt ?? recordedAt,
    updatedAt: recordedAt,
    expiresAt: expiresAt(recordedAt, ttlHours),
    events,
    approvalRequired: true,
    customerApprovalRecorded: input.reviewSurface.customerApprovalRecorded,
    autoEnforce: false,
    rawPayloadStored: false,
    rawReviewSurfaceStored: false,
    productionReady: false,
    reviewMaterialOnly: true,
    fullPacketRequiredForImplementation: true,
    storageMode: 'file-backed-evaluation',
    dataMinimizationPolicyVersion: CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
    dataMinimizationSurfaceKind: 'policy-foundry-hosted-wizard-state',
    limitations: Object.freeze([
      'This is local file-backed evaluation state, not shared production workflow storage.',
      'It stores compact digest-bound review state only, not raw manifests, shadow payloads, or full packets.',
      'It does not apply patches, issue credentials, deploy infrastructure, execute production traffic, activate enforcement, or prove production readiness.',
    ]),
  });
}

function normalizeRecord(record: PolicyFoundryHostedWizardStateRecord):
PolicyFoundryHostedWizardStateRecord {
  const payload: PolicyFoundryHostedWizardStatePayload = {
    version: POLICY_FOUNDRY_HOSTED_WIZARD_STATE_VERSION,
    sessionId: normalizeIdentifier(record.sessionId, 'sessionId'),
    tenantDigest: normalizeIdentifier(record.tenantDigest, 'tenantDigest'),
    tenantSource: normalizeIdentifier(record.tenantSource, 'tenantSource'),
    planId: normalizeOptionalIdentifier(record.planId),
    workflowId: normalizeIdentifier(record.workflowId, 'workflowId'),
    workflowDigest: normalizeIdentifier(record.workflowDigest, 'workflowDigest'),
    reviewSurfaceId: normalizeIdentifier(record.reviewSurfaceId, 'reviewSurfaceId'),
    reviewSurfaceDigest: normalizeIdentifier(record.reviewSurfaceDigest, 'reviewSurfaceDigest'),
    status: record.status,
    headline: normalizeIdentifier(record.headline, 'headline'),
    nextSafeStep: normalizeIdentifier(record.nextSafeStep, 'nextSafeStep'),
    surfaceCount: Math.max(0, Math.trunc(record.surfaceCount)),
    shadowEventCount: Math.max(0, Math.trunc(record.shadowEventCount)),
    blockerCount: Math.max(0, Math.trunc(record.blockerCount)),
    currentTaskCount: Math.max(0, Math.trunc(record.currentTaskCount)),
    noGoCount: Math.max(0, Math.trunc(record.noGoCount)),
    taskCards: Object.freeze((record.taskCards ?? []).map((task) => Object.freeze({ ...task }))),
    noGoCards: Object.freeze((record.noGoCards ?? []).map((card) => Object.freeze({ ...card }))),
    evidenceCards: Object.freeze((record.evidenceCards ?? []).map((card) => Object.freeze({ ...card }))),
    safeAutomations: Object.freeze([...(record.safeAutomations ?? [])]),
    approvalGatedAutomations: Object.freeze([...(record.approvalGatedAutomations ?? [])]),
    prohibitedAutomations: Object.freeze([...(record.prohibitedAutomations ?? [])]),
    createdAt: normalizeIsoTimestamp(record.createdAt, new Date().toISOString(), 'createdAt'),
    updatedAt: normalizeIsoTimestamp(record.updatedAt, new Date().toISOString(), 'updatedAt'),
    expiresAt: normalizeIsoTimestamp(record.expiresAt, new Date().toISOString(), 'expiresAt'),
    events: Object.freeze((record.events ?? []).map((event, index) => Object.freeze({
      sequence: Math.max(1, Math.trunc(event.sequence ?? index + 1)),
      eventKind: event.eventKind === 'updated' ? 'updated' : 'created',
      occurredAt: normalizeIsoTimestamp(event.occurredAt, record.updatedAt, 'events[].occurredAt'),
      workflowDigest: normalizeIdentifier(event.workflowDigest, 'events[].workflowDigest'),
      reviewSurfaceDigest: normalizeIdentifier(event.reviewSurfaceDigest, 'events[].reviewSurfaceDigest'),
    }))),
    approvalRequired: true,
    customerApprovalRecorded: Boolean(record.customerApprovalRecorded),
    autoEnforce: false,
    rawPayloadStored: false,
    rawReviewSurfaceStored: false,
    productionReady: false,
    reviewMaterialOnly: true,
    fullPacketRequiredForImplementation: true,
    storageMode: 'file-backed-evaluation',
    dataMinimizationPolicyVersion: CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
    dataMinimizationSurfaceKind: 'policy-foundry-hosted-wizard-state',
    limitations: Object.freeze(record.limitations ?? []),
  };
  return finalizeRecord(payload);
}

function readStore(path: string): PolicyFoundryHostedWizardStateStoreFile {
  if (!existsSync(path)) return defaultStore();
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as PolicyFoundryHostedWizardStateStoreFile;
    if (parsed.version !== 1 || !Array.isArray(parsed.records)) {
      throw new Error('invalid store shape');
    }
    return {
      version: 1,
      records: parsed.records.map(normalizeRecord),
    };
  } catch {
    throw new Error('Policy Foundry hosted wizard state store corruption detected.');
  }
}

function saveStore(path: string, store: PolicyFoundryHostedWizardStateStoreFile): void {
  mkdirSync(dirname(path), { recursive: true });
  writeTextFileAtomic(path, `${JSON.stringify(store, null, 2)}\n`);
}

function pruneExpired(
  store: PolicyFoundryHostedWizardStateStoreFile,
  now: string,
): boolean {
  const before = store.records.length;
  store.records = store.records.filter((record) => !isExpired(record, now));
  return before !== store.records.length;
}

export function createFileBackedPolicyFoundryHostedWizardStateStore(options?: {
  readonly path?: string | null;
}): PolicyFoundryHostedWizardStateStore {
  const path = resolve(options?.path ?? defaultStorePath());

  function withStoreLock<T>(action: (store: PolicyFoundryHostedWizardStateStoreFile) => T): T {
    return withFileLock(path, () => action(readStore(path)));
  }

  return Object.freeze({
    upsert(input: UpsertPolicyFoundryHostedWizardStateInput) {
      return withStoreLock((store) => {
        const now = normalizeIsoTimestamp(input.recordedAt, new Date().toISOString(), 'recordedAt');
        pruneExpired(store, now);
        const sessionId = sessionIdFor(input);
        const existingIndex = store.records.findIndex((record) => record.sessionId === sessionId);
        const existing = existingIndex >= 0 ? normalizeRecord(store.records[existingIndex]!) : null;
        const tenantDigest = normalizeIdentifier(input.tenantDigest, 'tenantDigest');
        if (existing && existing.tenantDigest !== tenantDigest) {
          throw new Error('Policy Foundry hosted wizard state tenant boundary mismatch.');
        }
        const record = finalizeRecord(createRecordPayload(input, existing));
        if (existingIndex >= 0) {
          store.records[existingIndex] = record;
        } else {
          store.records.push(record);
        }
        saveStore(path, store);
        return {
          kind: existing ? 'updated' : 'created',
          record,
          path,
        } as const;
      });
    },
    find(input: FindPolicyFoundryHostedWizardStateInput) {
      const sessionId = normalizeIdentifier(input.sessionId, 'sessionId');
      const tenantDigest = normalizeIdentifier(input.tenantDigest, 'tenantDigest');
      const now = normalizeIsoTimestamp(input.now, new Date().toISOString(), 'now');
      return withStoreLock((store) => {
        if (pruneExpired(store, now)) saveStore(path, store);
        const record = store.records.find((entry) =>
          entry.sessionId === sessionId &&
          entry.tenantDigest === tenantDigest
        ) ?? null;
        return { record: record ? normalizeRecord(record) : null, path };
      });
    },
    exportSnapshot() {
      const store = readStore(path);
      return Object.freeze({
        path,
        version: 1,
        exportedAt: new Date().toISOString(),
        recordCount: store.records.length,
        records: Object.freeze([...store.records]),
      });
    },
  });
}

export function policyFoundryHostedWizardStateDescriptor():
PolicyFoundryHostedWizardStateDescriptor {
  return Object.freeze({
    version: POLICY_FOUNDRY_HOSTED_WIZARD_STATE_VERSION,
    storageMode: 'file-backed-evaluation',
    defaultTtlHours: POLICY_FOUNDRY_HOSTED_WIZARD_STATE_DEFAULT_TTL_HOURS,
    tenantBoundLookup: true,
    storesRawPayload: false,
    storesRawReviewSurface: false,
    approvalRequired: true,
    autoEnforce: false,
    productionReady: false,
    dataMinimizationPolicyVersion: CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
    dataMinimizationSurfaceKind: 'policy-foundry-hosted-wizard-state',
  });
}

export function resetPolicyFoundryHostedWizardStateStoreForTests(options?: {
  readonly path?: string | null;
}): void {
  const path = resolve(options?.path ?? defaultStorePath());
  if (existsSync(path)) rmSync(path, { force: true });
  if (existsSync(`${path}.lock`)) rmSync(`${path}.lock`, { recursive: true, force: true });
}
