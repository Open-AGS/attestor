/**
 * Pipeline Idempotency Store - safe retry support for tenant pipeline POSTs.
 *
 * BOUNDARY:
 * - Stores an idempotency-key digest scoped by tenant and route, never the raw key
 * - Replay payloads are encrypted at rest
 * - Production-like runtimes require ATTESTOR_PIPELINE_IDEMPOTENCY_ENCRYPTION_KEY
 * - Local/dev may fall back to ATTESTOR_ADMIN_API_KEY for test convenience only
 */

import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { isProductionLikeRuntimeEnv } from './deployment-safety.js';
import { withFileLock, writeTextFileAtomic } from './file-store.js';
import { hashJsonValue, stableJsonStringify } from './json-stable.js';
import { deriveServiceKey } from './secret-derivation.js';

export interface PipelineIdempotencyRecord {
  id: string;
  idempotencyKeyDigest: string;
  tenantId: string;
  routeId: string;
  requestHash: string;
  statusCode: number;
  responseCiphertext: string;
  responseIv: string;
  responseAuthTag: string;
  createdAt: string;
  lastReplayedAt: string | null;
  replayCount: number;
}

interface PipelineIdempotencyStoreFile {
  version: 1;
  records: PipelineIdempotencyRecord[];
}

export type PipelineIdempotencyLookup =
  | { kind: 'miss'; requestHash: string }
  | { kind: 'replay'; requestHash: string; record: PipelineIdempotencyRecord; response: unknown }
  | { kind: 'conflict'; requestHash: string; record: PipelineIdempotencyRecord };

function storePath(): string {
  return resolve(process.env.ATTESTOR_PIPELINE_IDEMPOTENCY_STORE_PATH ?? '.attestor/pipeline-idempotency.json');
}

function ttlHours(): number {
  const raw = process.env.ATTESTOR_PIPELINE_IDEMPOTENCY_TTL_HOURS?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : 24;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 24;
}

export function pipelineIdempotencyEncryptionKeySource(): 'dedicated' | 'local-admin-fallback' {
  const dedicated = process.env.ATTESTOR_PIPELINE_IDEMPOTENCY_ENCRYPTION_KEY?.trim();
  if (dedicated) return 'dedicated';
  const fallback = process.env.ATTESTOR_ADMIN_API_KEY?.trim();
  if (fallback && !isProductionLikeRuntimeEnv()) return 'local-admin-fallback';
  throw new Error(
    'ATTESTOR_PIPELINE_IDEMPOTENCY_ENCRYPTION_KEY must be set before enabling pipeline idempotency in this runtime.',
  );
}

export function ensurePipelineIdempotencyStorageReady(): void {
  pipelineIdempotencyEncryptionKeySource();
}

function encryptionKey(): Buffer {
  const source = pipelineIdempotencyEncryptionKeySource();
  const raw = source === 'dedicated'
    ? process.env.ATTESTOR_PIPELINE_IDEMPOTENCY_ENCRYPTION_KEY?.trim()
    : process.env.ATTESTOR_ADMIN_API_KEY?.trim();
  if (!raw) {
    throw new Error(
      'ATTESTOR_PIPELINE_IDEMPOTENCY_ENCRYPTION_KEY must be set before enabling pipeline idempotency in this runtime.',
    );
  }
  return deriveServiceKey(raw, 'pipeline.idempotency.encryption');
}

export function buildPipelineIdempotencyKeyDigest(input: {
  tenantId: string;
  routeId: string;
  idempotencyKey: string;
}): string {
  return hashJsonValue({
    tenantId: input.tenantId,
    routeId: input.routeId,
    idempotencyKey: input.idempotencyKey,
  });
}

export function buildPipelineIdempotencyRequestHash(input: {
  tenantId: string;
  routeId: string;
  payload: unknown;
}): string {
  return hashJsonValue({
    tenantId: input.tenantId,
    routeId: input.routeId,
    payload: input.payload,
  });
}

export function encryptPipelineIdempotencyResponse(response: unknown): {
  ciphertext: string;
  iv: string;
  authTag: string;
} {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const plaintext = stableJsonStringify(response);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
  };
}

export function decryptPipelineIdempotencyResponse(record: Pick<
  PipelineIdempotencyRecord,
  'responseCiphertext' | 'responseIv' | 'responseAuthTag'
>): unknown {
  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(record.responseIv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(record.responseAuthTag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(record.responseCiphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
  return JSON.parse(plaintext);
}

function defaultStore(): PipelineIdempotencyStoreFile {
  return { version: 1, records: [] };
}

export function pipelineIdempotencyCutoffIso(): string {
  return new Date(Date.now() - ttlHours() * 60 * 60 * 1000).toISOString();
}

function pruneExpired(records: PipelineIdempotencyRecord[]): PipelineIdempotencyRecord[] {
  const cutoff = Date.parse(pipelineIdempotencyCutoffIso());
  return records.filter((record) => Date.parse(record.createdAt) >= cutoff);
}

function loadStore(): PipelineIdempotencyStoreFile {
  const path = storePath();
  if (!existsSync(path)) return defaultStore();
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as PipelineIdempotencyStoreFile;
    if (parsed.version === 1 && Array.isArray(parsed.records)) {
      return { version: 1, records: pruneExpired(parsed.records) };
    }
  } catch {
    // fall through to safe default
  }
  return defaultStore();
}

function saveStore(store: PipelineIdempotencyStoreFile): void {
  const path = storePath();
  mkdirSync(dirname(path), { recursive: true });
  writeTextFileAtomic(path, `${JSON.stringify({ ...store, records: pruneExpired(store.records) }, null, 2)}\n`);
}

export function readPipelineIdempotencySnapshot(): {
  path: string;
  records: PipelineIdempotencyRecord[];
} {
  const path = storePath();
  return withFileLock(path, () => {
    const store = loadStore();
    return {
      path,
      records: [...store.records],
    };
  });
}

export function lookupPipelineIdempotency(options: {
  idempotencyKey: string;
  tenantId: string;
  routeId: string;
  requestPayload: unknown;
}): PipelineIdempotencyLookup {
  const idempotencyKeyDigest = buildPipelineIdempotencyKeyDigest(options);
  const requestHash = buildPipelineIdempotencyRequestHash({
    tenantId: options.tenantId,
    routeId: options.routeId,
    payload: options.requestPayload,
  });
  return withFileLock(storePath(), () => {
    const store = loadStore();
    const existing = store.records.find((record) => record.idempotencyKeyDigest === idempotencyKeyDigest);
    if (!existing) return { kind: 'miss', requestHash };
    if (existing.tenantId !== options.tenantId || existing.routeId !== options.routeId || existing.requestHash !== requestHash) {
      return { kind: 'conflict', requestHash, record: existing };
    }

    existing.lastReplayedAt = new Date().toISOString();
    existing.replayCount += 1;
    saveStore(store);
    return {
      kind: 'replay',
      requestHash,
      record: existing,
      response: decryptPipelineIdempotencyResponse(existing),
    };
  });
}

export function recordPipelineIdempotency(options: {
  idempotencyKey: string;
  tenantId: string;
  routeId: string;
  requestPayload: unknown;
  statusCode: number;
  response: unknown;
}): { record: PipelineIdempotencyRecord; path: string } {
  const path = storePath();
  const idempotencyKeyDigest = buildPipelineIdempotencyKeyDigest(options);
  const requestHash = buildPipelineIdempotencyRequestHash({
    tenantId: options.tenantId,
    routeId: options.routeId,
    payload: options.requestPayload,
  });
  return withFileLock(path, () => {
    const store = loadStore();
    const existing = store.records.find((record) => record.idempotencyKeyDigest === idempotencyKeyDigest);
    if (existing) {
      if (existing.tenantId !== options.tenantId || existing.routeId !== options.routeId || existing.requestHash !== requestHash) {
        throw new Error('Idempotency-Key already exists for a different pipeline request');
      }
      return { record: existing, path };
    }

    const encrypted = encryptPipelineIdempotencyResponse(options.response);
    const record: PipelineIdempotencyRecord = {
      id: `pipe_idem_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
      idempotencyKeyDigest,
      tenantId: options.tenantId,
      routeId: options.routeId,
      requestHash,
      statusCode: options.statusCode,
      responseCiphertext: encrypted.ciphertext,
      responseIv: encrypted.iv,
      responseAuthTag: encrypted.authTag,
      createdAt: new Date().toISOString(),
      lastReplayedAt: null,
      replayCount: 0,
    };
    store.records.push(record);
    saveStore(store);
    return { record, path };
  });
}

export function resetPipelineIdempotencyStoreForTests(): void {
  const path = storePath();
  if (existsSync(path)) rmSync(path, { force: true });
  if (existsSync(`${path}.lock`)) rmSync(`${path}.lock`, { recursive: true, force: true });
}
