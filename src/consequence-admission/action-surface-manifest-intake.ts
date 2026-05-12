import { createHash } from 'node:crypto';
import { load as parseYaml } from 'js-yaml';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  type ActionSurfaceDeclaration,
} from './action-surface-profiler.js';
import {
  type ActionSurfaceDeclarationIngestionResult,
  type ActionSurfaceDeclarationIngestorOptions,
  ingestAsyncApiActionSurfaceDeclarations,
  ingestMcpToolActionSurfaceDeclarations,
  ingestOpenApiActionSurfaceDeclarations,
  ingestWorkflowActionSurfaceDeclarations,
} from './action-surface-declaration-ingestors.js';

export const ACTION_SURFACE_MANIFEST_INTAKE_VERSION =
  'attestor.action-surface-manifest-intake.v1';

export const ACTION_SURFACE_MANIFEST_FORMATS = [
  'json',
  'yaml',
] as const;
export type ActionSurfaceManifestFormat =
  typeof ACTION_SURFACE_MANIFEST_FORMATS[number];

export const ACTION_SURFACE_MANIFEST_KINDS = [
  'openapi',
  'asyncapi',
  'mcp-tools',
  'workflow-manifest',
] as const;
export type ActionSurfaceManifestKind =
  typeof ACTION_SURFACE_MANIFEST_KINDS[number];

export interface ActionSurfaceManifestIntakeOptions
  extends ActionSurfaceDeclarationIngestorOptions {
  readonly manifestKind?: ActionSurfaceManifestKind | 'auto' | null;
  readonly format?: ActionSurfaceManifestFormat | 'auto' | null;
  readonly maxBytes?: number | null;
}

export interface ActionSurfaceManifestIntakeResult {
  readonly version: typeof ACTION_SURFACE_MANIFEST_INTAKE_VERSION;
  readonly manifestKind: ActionSurfaceManifestKind;
  readonly format: ActionSurfaceManifestFormat;
  readonly sourceRef: string | null;
  readonly byteLength: number;
  readonly contentDigest: string;
  readonly declarationCount: number;
  readonly skippedCount: number;
  readonly warningCount: number;
  readonly warnings: readonly string[];
  readonly declarations: readonly ActionSurfaceDeclaration[];
  readonly ingestionDigest: string;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface ActionSurfaceManifestIntakeDescriptor {
  readonly version: typeof ACTION_SURFACE_MANIFEST_INTAKE_VERSION;
  readonly formats: typeof ACTION_SURFACE_MANIFEST_FORMATS;
  readonly manifestKinds: typeof ACTION_SURFACE_MANIFEST_KINDS;
  readonly defaultMaxBytes: number;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly liveProviderAccessRequired: false;
}

type UnknownRecord = Readonly<Record<string, unknown>>;

const DEFAULT_MAX_MANIFEST_BYTES = 512 * 1024;

function canonicalObject(value: CanonicalReleaseJsonValue): {
  readonly canonical: string;
  readonly digest: string;
} {
  const canonical = canonicalizeReleaseJson(value);
  return Object.freeze({
    canonical,
    digest: `sha256:${createHash('sha256').update(canonical).digest('hex')}`,
  });
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizedSourceRef(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function digestText(text: string): string {
  return `sha256:${createHash('sha256').update(text).digest('hex')}`;
}

function maxBytes(options: ActionSurfaceManifestIntakeOptions): number {
  const configured = options.maxBytes;
  if (configured === undefined || configured === null) return DEFAULT_MAX_MANIFEST_BYTES;
  if (!Number.isInteger(configured) || configured <= 0) {
    throw new Error('Action surface manifest intake maxBytes must be a positive integer.');
  }
  return configured;
}

function detectFormat(
  text: string,
  sourceRef: string | null,
  requested: ActionSurfaceManifestFormat | 'auto' | null | undefined,
): ActionSurfaceManifestFormat {
  if (requested === 'json' || requested === 'yaml') return requested;
  const lowerRef = sourceRef?.toLowerCase() ?? '';
  if (lowerRef.endsWith('.json')) return 'json';
  if (lowerRef.endsWith('.yaml') || lowerRef.endsWith('.yml')) return 'yaml';
  const trimmed = text.trimStart();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
  return 'yaml';
}

function parseManifestText(
  text: string,
  format: ActionSurfaceManifestFormat,
): unknown {
  if (format === 'json') {
    return JSON.parse(text) as unknown;
  }
  return parseYaml(text, {
    filename: 'action-surface-manifest',
    json: false,
  }) as unknown;
}

function detectKind(
  parsed: unknown,
  sourceRef: string | null,
  requested: ActionSurfaceManifestKind | 'auto' | null | undefined,
): ActionSurfaceManifestKind {
  if (requested && requested !== 'auto') return requested;
  if (!isRecord(parsed)) {
    throw new Error('Action surface manifest intake requires a mapping/object manifest.');
  }
  if (typeof parsed.openapi === 'string') return 'openapi';
  if (typeof parsed.asyncapi === 'string') return 'asyncapi';
  if (Array.isArray(parsed.tools)) return 'mcp-tools';
  if (isRecord(parsed.jobs)) return 'workflow-manifest';
  const lowerRef = sourceRef?.toLowerCase() ?? '';
  if (lowerRef.includes('/.github/workflows/') || lowerRef.includes('\\.github\\workflows\\')) {
    return 'workflow-manifest';
  }
  throw new Error(
    'Action surface manifest intake could not detect manifest kind. Pass manifestKind explicitly.',
  );
}

function ingestParsedManifest(
  parsed: unknown,
  kind: ActionSurfaceManifestKind,
  options: ActionSurfaceManifestIntakeOptions,
): ActionSurfaceDeclarationIngestionResult {
  switch (kind) {
    case 'openapi':
      return ingestOpenApiActionSurfaceDeclarations(parsed, options);
    case 'asyncapi':
      return ingestAsyncApiActionSurfaceDeclarations(parsed, options);
    case 'mcp-tools':
      return ingestMcpToolActionSurfaceDeclarations(parsed, options);
    case 'workflow-manifest':
      return ingestWorkflowActionSurfaceDeclarations(parsed, options);
  }
}

export function ingestActionSurfaceManifestText(
  text: string,
  options: ActionSurfaceManifestIntakeOptions = {},
): ActionSurfaceManifestIntakeResult {
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('Action surface manifest intake requires non-empty text.');
  }
  const sourceRef = normalizedSourceRef(options.sourceRef);
  const byteLength = Buffer.byteLength(text, 'utf8');
  const limit = maxBytes(options);
  if (byteLength > limit) {
    throw new Error(
      `Action surface manifest intake rejected manifest larger than ${limit} bytes.`,
    );
  }

  const format = detectFormat(text, sourceRef, options.format);
  const parsed = parseManifestText(text, format);
  const manifestKind = detectKind(parsed, sourceRef, options.manifestKind);
  const ingestion = ingestParsedManifest(parsed, manifestKind, {
    ...options,
    sourceRef,
  });
  const body = {
    version: ACTION_SURFACE_MANIFEST_INTAKE_VERSION,
    manifestKind,
    format,
    sourceRef,
    byteLength,
    contentDigest: digestText(text),
    declarationCount: ingestion.declarationCount,
    skippedCount: ingestion.skippedCount,
    warningCount: ingestion.warningCount,
    warnings: ingestion.warnings,
    declarations: ingestion.declarations,
    ingestionDigest: ingestion.digest,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
  } as const;
  const canonical = canonicalObject(body as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...body,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function actionSurfaceManifestIntakeDescriptor(): ActionSurfaceManifestIntakeDescriptor {
  return Object.freeze({
    version: ACTION_SURFACE_MANIFEST_INTAKE_VERSION,
    formats: ACTION_SURFACE_MANIFEST_FORMATS,
    manifestKinds: ACTION_SURFACE_MANIFEST_KINDS,
    defaultMaxBytes: DEFAULT_MAX_MANIFEST_BYTES,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    liveProviderAccessRequired: false,
  });
}
