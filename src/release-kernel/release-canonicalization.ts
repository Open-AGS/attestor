import { createHash } from 'node:crypto';
import type { OutputContractDescriptor } from './types.js';
import type { ReleaseTargetReference } from './object-model.js';

/**
 * Canonicalization and hashing for releasable outputs.
 *
 * The release layer needs one invariant byte representation for the output
 * artifact and one for the downstream consequence candidate, so that the
 * decision, token, and verifier layers all bind to the same hashes.
 *
 * This module follows the spirit of RFC 8785 (JSON canonicalization) while
 * staying intentionally strict about accepted values. We only allow
 * canonicalizable JSON-compatible values and fail fast on ambiguous or lossy
 * inputs such as undefined, NaN, Infinity, functions, or custom class
 * instances.
 */

export const RELEASE_CANONICALIZATION_SPEC_VERSION = 'attestor.release-canonicalization.v1';
const MAX_CANONICAL_RELEASE_JSON_DEPTH = 128;
const MAX_CANONICAL_RELEASE_JSON_NODES = 100_000;

export type CanonicalReleaseJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly CanonicalReleaseJsonValue[]
  | { readonly [key: string]: CanonicalReleaseJsonValue };

type CanonicalReleaseObject = { readonly [key: string]: CanonicalReleaseJsonValue };

interface CanonicalizationState {
  readonly activeReferences: WeakSet<object>;
  nodeCount: number;
}

export interface ReleaseOutputEnvelope {
  readonly outputContract: OutputContractDescriptor;
  readonly payload: CanonicalReleaseJsonValue;
}

export interface ReleaseConsequenceEnvelope {
  readonly consequenceType: OutputContractDescriptor['consequenceType'];
  readonly target: ReleaseTargetReference;
  readonly payload: CanonicalReleaseJsonValue;
  readonly recipientId?: string;
  readonly idempotencyKey?: string;
}

export interface CreateCanonicalReleaseHashBundleInput {
  readonly outputContract: OutputContractDescriptor;
  readonly target: ReleaseTargetReference;
  readonly outputPayload: CanonicalReleaseJsonValue;
  readonly consequencePayload: CanonicalReleaseJsonValue;
  readonly recipientId?: string;
  readonly idempotencyKey?: string;
}

export interface CanonicalReleaseHashBundle {
  readonly version: typeof RELEASE_CANONICALIZATION_SPEC_VERSION;
  readonly outputCanonical: string;
  readonly consequenceCanonical: string;
  readonly outputHash: string;
  readonly consequenceHash: string;
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isCanonicalReleaseObject(value: CanonicalReleaseJsonValue): value is CanonicalReleaseObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function enterCanonicalNode(path: string, depth: number, state: CanonicalizationState): void {
  state.nodeCount += 1;
  if (state.nodeCount > MAX_CANONICAL_RELEASE_JSON_NODES) {
    throw new Error(
      `Canonical JSON exceeds maximum node count of ${MAX_CANONICAL_RELEASE_JSON_NODES} at ${path}.`,
    );
  }

  if (depth > MAX_CANONICAL_RELEASE_JSON_DEPTH) {
    throw new Error(
      `Canonical JSON exceeds maximum depth of ${MAX_CANONICAL_RELEASE_JSON_DEPTH} at ${path}.`,
    );
  }
}

function enterCanonicalReference(
  value: object,
  path: string,
  state: CanonicalizationState,
): void {
  if (state.activeReferences.has(value)) {
    throw new Error(`Circular object references are not canonicalizable at ${path}.`);
  }
  state.activeReferences.add(value);
}

function leaveCanonicalReference(value: object, state: CanonicalizationState): void {
  state.activeReferences.delete(value);
}

function normalizeCanonicalValue(
  value: CanonicalReleaseJsonValue,
  path: string,
  state: CanonicalizationState,
  depth: number,
): CanonicalReleaseJsonValue {
  enterCanonicalNode(path, depth, state);

  if (value === null) {
    return null;
  }

  if (typeof value === 'boolean' || typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`Non-finite number is not canonicalizable at ${path}.`);
    }
    return value;
  }

  if (Array.isArray(value)) {
    enterCanonicalReference(value, path, state);
    try {
      return Object.freeze(
        value.map((item, index) => normalizeCanonicalValue(item, `${path}[${index}]`, state, depth + 1)),
      );
    } finally {
      leaveCanonicalReference(value, state);
    }
  }

  if (!isPlainObject(value)) {
    throw new Error(`Only plain JSON objects are canonicalizable at ${path}.`);
  }

  enterCanonicalReference(value, path, state);
  try {
    const normalizedEntries = Object.keys(value)
      .sort()
      .map((key) => {
        const nestedValue = value[key];
        if (nestedValue === undefined) {
          throw new Error(`Undefined values are not canonicalizable at ${path}.${key}.`);
        }
        return [
          key,
          normalizeCanonicalValue(nestedValue as CanonicalReleaseJsonValue, `${path}.${key}`, state, depth + 1),
        ] as const;
      });

    return Object.freeze(
      Object.fromEntries(normalizedEntries) as { readonly [key: string]: CanonicalReleaseJsonValue },
    );
  } finally {
    leaveCanonicalReference(value, state);
  }
}

function serializeCanonicalValue(value: CanonicalReleaseJsonValue): string {
  if (value === null) {
    return 'null';
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (typeof value === 'number' || typeof value === 'string') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => serializeCanonicalValue(item)).join(',')}]`;
  }

  if (!isCanonicalReleaseObject(value)) {
    throw new Error('Only canonical JSON objects may reach object serialization.');
  }

  return serializeCanonicalObject(value);
}

function serializeCanonicalObject(value: CanonicalReleaseObject): string {
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${serializeCanonicalValue(value[key])}`)
    .join(',')}}`;
}

export function canonicalizeReleaseJson(value: CanonicalReleaseJsonValue): string {
  const normalized = normalizeCanonicalValue(
    value,
    '$',
    { activeReferences: new WeakSet<object>(), nodeCount: 0 },
    0,
  );
  return serializeCanonicalValue(normalized);
}

export function canonicalizeReleaseOutputEnvelope(input: ReleaseOutputEnvelope): string {
  return canonicalizeReleaseJson({
    artifactType: input.outputContract.artifactType,
    expectedShape: input.outputContract.expectedShape,
    consequenceType: input.outputContract.consequenceType,
    riskClass: input.outputContract.riskClass,
    payload: input.payload,
  });
}

export function canonicalizeReleaseConsequenceEnvelope(
  input: ReleaseConsequenceEnvelope,
): string {
  return canonicalizeReleaseJson({
    consequenceType: input.consequenceType,
    target: {
      kind: input.target.kind,
      id: input.target.id,
    },
    recipientId: input.recipientId ?? null,
    idempotencyKey: input.idempotencyKey ?? null,
    payload: input.payload,
  });
}

export function createCanonicalReleaseHashBundle(
  input: CreateCanonicalReleaseHashBundleInput,
): CanonicalReleaseHashBundle {
  const outputCanonical = canonicalizeReleaseOutputEnvelope({
    outputContract: input.outputContract,
    payload: input.outputPayload,
  });
  const consequenceCanonical = canonicalizeReleaseConsequenceEnvelope({
    consequenceType: input.outputContract.consequenceType,
    target: input.target,
    payload: input.consequencePayload,
    recipientId: input.recipientId,
    idempotencyKey: input.idempotencyKey,
  });

  return {
    version: RELEASE_CANONICALIZATION_SPEC_VERSION,
    outputCanonical,
    consequenceCanonical,
    outputHash: `sha256:${sha256Hex(outputCanonical)}`,
    consequenceHash: `sha256:${sha256Hex(consequenceCanonical)}`,
  };
}
