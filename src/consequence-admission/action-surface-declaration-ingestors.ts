import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  type ActionSurfaceDeclaration,
  type ActionSurfaceDeclaredCredentialPosture,
} from './action-surface-profiler.js';
import {
  type AttestorIntegrationMode,
} from './integration-mode-readiness.js';
import {
  CONSEQUENCE_ADMISSION_DOMAINS,
  type ConsequenceAdmissionDomain,
} from './taxonomy.js';

export const ACTION_SURFACE_DECLARATION_INGESTORS_VERSION =
  'attestor.action-surface-declaration-ingestors.v1';

export const ACTION_SURFACE_DECLARATION_INGESTOR_SOURCE_KINDS = [
  'openapi',
  'asyncapi',
  'mcp-tools',
  'workflow-manifest',
] as const;
export type ActionSurfaceDeclarationIngestorSourceKind =
  typeof ACTION_SURFACE_DECLARATION_INGESTOR_SOURCE_KINDS[number];

export interface ActionSurfaceDeclarationIngestorOptions {
  readonly downstreamSystem?: string | null;
  readonly defaultDomain?: ConsequenceAdmissionDomain | string | null;
  readonly credentialPosture?: ActionSurfaceDeclaredCredentialPosture | null;
  readonly integrationModeHint?: AttestorIntegrationMode | null;
  readonly includeReadOperations?: boolean | null;
  readonly sourceRef?: string | null;
}

export interface ActionSurfaceDeclarationIngestionResult {
  readonly version: typeof ACTION_SURFACE_DECLARATION_INGESTORS_VERSION;
  readonly sourceKind: ActionSurfaceDeclarationIngestorSourceKind;
  readonly sourceRef: string | null;
  readonly declarationCount: number;
  readonly skippedCount: number;
  readonly warningCount: number;
  readonly warnings: readonly string[];
  readonly declarations: readonly ActionSurfaceDeclaration[];
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface ActionSurfaceDeclarationIngestorsDescriptor {
  readonly version: typeof ACTION_SURFACE_DECLARATION_INGESTORS_VERSION;
  readonly sourceKinds: typeof ACTION_SURFACE_DECLARATION_INGESTOR_SOURCE_KINDS;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly outputIsDeclarationOnly: true;
  readonly liveProviderAccessRequired: false;
}

type UnknownRecord = Readonly<Record<string, unknown>>;

const HTTP_METHODS = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
] as const;

const WRITE_HTTP_METHODS = new Set(['post', 'put', 'patch', 'delete']);

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

function recordValue(value: unknown): UnknownRecord | null {
  return isRecord(value) ? value : null;
}

function stringValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function stringArrayValue(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze(
    value
      .map((item) => stringValue(item))
      .filter((item): item is string => item !== null),
  );
}

function normalizeSourceRef(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  return stringValue(value);
}

function slug(value: string | null | undefined, fallback: string): string {
  const raw = value ?? fallback;
  const withCamelBreaks = raw.replace(/([a-z0-9])([A-Z])/g, '$1_$2');
  const normalized = withCamelBreaks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
  return normalized || fallback;
}

function textForInference(parts: readonly (string | null | undefined)[]): string {
  return parts
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join(' ')
    .toLowerCase();
}

function isKnownDomain(value: string | null | undefined): value is ConsequenceAdmissionDomain {
  return typeof value === 'string' &&
    (CONSEQUENCE_ADMISSION_DOMAINS as readonly string[]).includes(value);
}

function inferDomain(
  parts: readonly (string | null | undefined)[],
  fallback: ConsequenceAdmissionDomain | string | null | undefined,
): ConsequenceAdmissionDomain | string {
  const explicit = stringValue(fallback ?? null);
  const text = textForInference(parts);

  if (/\b(refund|payment|payout|invoice|billing|charge|credit|settlement)\b/u.test(text)) {
    return 'money-movement';
  }
  if (/\b(wallet|chain|token|contract|transaction|swap|bridge|custody|safe|userop)\b/u.test(text)) {
    return 'programmable-money';
  }
  if (/\b(export|download|customer[_ -]?data|warehouse|query|report|backup|extract)\b/u.test(text)) {
    return 'data-disclosure';
  }
  if (/\b(filing|tax|regulatory|disclosure|legal|statutory)\b/u.test(text)) {
    return 'regulated-filing';
  }
  if (/\b(email|message|notify|notification|ticket|reply|sms|slack)\b/u.test(text)) {
    return 'external-communication';
  }
  if (/\b(role|permission|entitlement|admin|account|user|access|delegation)\b/u.test(text)) {
    return 'authority-change';
  }
  if (/\b(deploy|release|rollout|infra|infrastructure|cloud|secret|rotate|restart|incident|workflow)\b/u.test(text)) {
    return 'system-operation';
  }
  if (/\b(triage|recommend|analysis|analyze|briefing|score|classify)\b/u.test(text)) {
    return 'decision-support';
  }
  return explicit && isKnownDomain(explicit) ? explicit : explicit ?? 'custom';
}

function defaultCredentialPosture(
  options: ActionSurfaceDeclarationIngestorOptions,
): ActionSurfaceDeclaredCredentialPosture {
  return options.credentialPosture ?? 'unknown';
}

function operationSecurityPosture(
  root: UnknownRecord,
  operation: UnknownRecord,
  options: ActionSurfaceDeclarationIngestorOptions,
): ActionSurfaceDeclaredCredentialPosture {
  if (options.credentialPosture) return options.credentialPosture;
  if (Array.isArray(operation.security) && operation.security.length === 0) return 'none';
  if (operation.security !== undefined || root.security !== undefined) return 'unknown';
  return 'unknown';
}

function downstreamFrom(
  options: ActionSurfaceDeclarationIngestorOptions,
  fallback: string,
): string {
  return slug(options.downstreamSystem ?? fallback, fallback);
}

function createResult(input: {
  readonly sourceKind: ActionSurfaceDeclarationIngestorSourceKind;
  readonly sourceRef: string | null;
  readonly declarations: readonly ActionSurfaceDeclaration[];
  readonly skippedCount: number;
  readonly warnings?: readonly string[];
}): ActionSurfaceDeclarationIngestionResult {
  const warnings = Object.freeze([...(input.warnings ?? [])]);
  const body = {
    version: ACTION_SURFACE_DECLARATION_INGESTORS_VERSION,
    sourceKind: input.sourceKind,
    sourceRef: input.sourceRef,
    declarationCount: input.declarations.length,
    skippedCount: input.skippedCount,
    warningCount: warnings.length,
    warnings,
    declarations: input.declarations,
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

function declaration(input: ActionSurfaceDeclaration): ActionSurfaceDeclaration {
  return Object.freeze(input);
}

function openApiFallbackAction(method: string, path: string): string {
  return `${method}_${path}`;
}

export function ingestOpenApiActionSurfaceDeclarations(
  document: unknown,
  options: ActionSurfaceDeclarationIngestorOptions = {},
): ActionSurfaceDeclarationIngestionResult {
  const root = recordValue(document);
  if (!root) {
    throw new Error('OpenAPI action surface ingestion requires a document object.');
  }
  const paths = recordValue(root.paths);
  if (!paths) {
    throw new Error('OpenAPI action surface ingestion requires a paths object.');
  }

  const info = recordValue(root.info);
  const downstreamSystem = downstreamFrom(options, stringValue(info?.title) ?? 'openapi');
  const includeReadOperations = options.includeReadOperations !== false;
  const declarations: ActionSurfaceDeclaration[] = [];
  let skippedCount = 0;

  for (const [path, rawPathItem] of Object.entries(paths)) {
    const pathItem = recordValue(rawPathItem);
    if (!pathItem) {
      skippedCount += 1;
      continue;
    }
    for (const method of HTTP_METHODS) {
      if (!includeReadOperations && !WRITE_HTTP_METHODS.has(method)) continue;
      const operation = recordValue(pathItem[method]);
      if (!operation) continue;
      const operationId = stringValue(operation.operationId);
      const tags = stringArrayValue(operation.tags);
      const action = slug(operationId ?? openApiFallbackAction(method, path), `${method}_operation`);
      const domain = inferDomain(
        [
          operationId,
          method,
          path,
          stringValue(operation.summary),
          stringValue(operation.description),
          ...tags,
        ],
        options.defaultDomain,
      );
      declarations.push(declaration({
        sourceKind: 'openapi',
        actionSurface: `${downstreamSystem}.${action}`,
        domain,
        downstreamSystem,
        action,
        operationRef: `${method.toUpperCase()} ${path}`,
        method: method.toUpperCase(),
        path,
        credentialPosture: operationSecurityPosture(root, operation, options),
        integrationModeHint: options.integrationModeHint ??
          (WRITE_HTTP_METHODS.has(method) ? 'gateway-proxy' : null),
      }));
    }
  }

  return createResult({
    sourceKind: 'openapi',
    sourceRef: normalizeSourceRef(options.sourceRef),
    declarations: Object.freeze(declarations),
    skippedCount,
  });
}

function refName(value: unknown): string | null {
  if (typeof value === 'string') return stringValue(value);
  const record = recordValue(value);
  const ref = stringValue(record?.$ref);
  if (ref) return ref.split('/').filter(Boolean).at(-1) ?? ref;
  return stringValue(record?.address) ?? stringValue(record?.name);
}

export function ingestAsyncApiActionSurfaceDeclarations(
  document: unknown,
  options: ActionSurfaceDeclarationIngestorOptions = {},
): ActionSurfaceDeclarationIngestionResult {
  const root = recordValue(document);
  if (!root) {
    throw new Error('AsyncAPI action surface ingestion requires a document object.');
  }
  const info = recordValue(root.info);
  const downstreamSystem = downstreamFrom(options, stringValue(info?.title) ?? 'asyncapi');
  const declarations: ActionSurfaceDeclaration[] = [];
  let skippedCount = 0;

  const operations = recordValue(root.operations);
  if (operations) {
    for (const [operationKey, rawOperation] of Object.entries(operations)) {
      const operation = recordValue(rawOperation);
      if (!operation) {
        skippedCount += 1;
        continue;
      }
      const actionName = stringValue(operation.operationId) ?? operationKey;
      const channel = refName(operation.channel);
      const action = slug(actionName, 'async_operation');
      declarations.push(declaration({
        sourceKind: 'asyncapi',
        actionSurface: `${downstreamSystem}.${action}`,
        domain: inferDomain(
          [
            actionName,
            stringValue(operation.action),
            channel,
            stringValue(operation.summary),
            stringValue(operation.description),
          ],
          options.defaultDomain,
        ),
        downstreamSystem,
        action,
        operationRef: `asyncapi:${operationKey}`,
        channel,
        credentialPosture: defaultCredentialPosture(options),
        integrationModeHint: options.integrationModeHint ?? null,
      }));
    }
  }

  const channels = recordValue(root.channels);
  if (!operations && channels) {
    for (const [channelKey, rawChannel] of Object.entries(channels)) {
      const channel = recordValue(rawChannel);
      if (!channel) {
        skippedCount += 1;
        continue;
      }
      for (const operationName of ['publish', 'subscribe'] as const) {
        const operation = recordValue(channel[operationName]);
        if (!operation) continue;
        const action = slug(`${operationName}_${channelKey}`, 'async_operation');
        declarations.push(declaration({
          sourceKind: 'asyncapi',
          actionSurface: `${downstreamSystem}.${action}`,
          domain: inferDomain(
            [
              channelKey,
              operationName,
              stringValue(operation.summary),
              stringValue(operation.description),
            ],
            options.defaultDomain,
          ),
          downstreamSystem,
          action,
          operationRef: `asyncapi:${channelKey}:${operationName}`,
          channel: channelKey,
          credentialPosture: defaultCredentialPosture(options),
          integrationModeHint: options.integrationModeHint ?? null,
        }));
      }
    }
  }

  return createResult({
    sourceKind: 'asyncapi',
    sourceRef: normalizeSourceRef(options.sourceRef),
    declarations: Object.freeze(declarations),
    skippedCount,
    warnings: declarations.length === 0
      ? Object.freeze(['No AsyncAPI operations or channel operations produced action surface declarations.'])
      : Object.freeze([]),
  });
}

function toolsFrom(input: unknown): readonly UnknownRecord[] {
  if (Array.isArray(input)) {
    return Object.freeze(input.filter(isRecord));
  }
  const root = recordValue(input);
  if (!root) return Object.freeze([]);
  const tools = root.tools;
  return Array.isArray(tools) ? Object.freeze(tools.filter(isRecord)) : Object.freeze([]);
}

export function ingestMcpToolActionSurfaceDeclarations(
  manifest: unknown,
  options: ActionSurfaceDeclarationIngestorOptions = {},
): ActionSurfaceDeclarationIngestionResult {
  const root = recordValue(manifest);
  const downstreamSystem = downstreamFrom(
    options,
    stringValue(root?.serverName) ?? stringValue(root?.name) ?? 'mcp-tools',
  );
  const declarations: ActionSurfaceDeclaration[] = [];
  let skippedCount = 0;

  for (const tool of toolsFrom(manifest)) {
    const toolName = stringValue(tool.name);
    if (!toolName) {
      skippedCount += 1;
      continue;
    }
    const action = slug(toolName, 'mcp_tool');
    declarations.push(declaration({
      sourceKind: 'mcp-tools',
      actionSurface: `${downstreamSystem}.${action}`,
      domain: inferDomain([toolName], options.defaultDomain),
      downstreamSystem,
      action,
      operationRef: `tool:${toolName}`,
      toolName,
      credentialPosture: defaultCredentialPosture(options),
      integrationModeHint: options.integrationModeHint ?? 'mcp-tool-gateway',
    }));
  }

  return createResult({
    sourceKind: 'mcp-tools',
    sourceRef: normalizeSourceRef(options.sourceRef),
    declarations: Object.freeze(declarations),
    skippedCount,
    warnings: declarations.length === 0
      ? Object.freeze(['No MCP tools produced action surface declarations.'])
      : Object.freeze([]),
  });
}

function containsSecretReference(value: unknown): boolean {
  if (typeof value === 'string') {
    return /\bsecrets\./iu.test(value) || /\bsecret[_ -]?[a-z0-9_ -]*\b/iu.test(value);
  }
  if (Array.isArray(value)) {
    return value.some((item) => containsSecretReference(item));
  }
  if (isRecord(value)) {
    return Object.entries(value).some(([key, item]) =>
      containsSecretReference(key) || containsSecretReference(item)
    );
  }
  return false;
}

function workflowCredentialPosture(
  workflow: UnknownRecord,
  job: UnknownRecord,
  options: ActionSurfaceDeclarationIngestorOptions,
): ActionSurfaceDeclaredCredentialPosture {
  if (options.credentialPosture) return options.credentialPosture;
  if (containsSecretReference(job)) return 'agent-held-static-secret';
  if (workflow.permissions !== undefined || job.permissions !== undefined) {
    return 'short-lived-downscoped-token';
  }
  return 'unknown';
}

export function ingestWorkflowActionSurfaceDeclarations(
  workflow: unknown,
  options: ActionSurfaceDeclarationIngestorOptions = {},
): ActionSurfaceDeclarationIngestionResult {
  const root = recordValue(workflow);
  if (!root) {
    throw new Error('Workflow action surface ingestion requires a workflow object.');
  }
  const jobs = recordValue(root.jobs);
  if (!jobs) {
    throw new Error('Workflow action surface ingestion requires a jobs object.');
  }
  const downstreamSystem = downstreamFrom(options, 'github-actions');
  const sourceRef = normalizeSourceRef(options.sourceRef) ?? slug(stringValue(root.name), 'workflow');
  const declarations: ActionSurfaceDeclaration[] = [];
  let skippedCount = 0;

  for (const [jobId, rawJob] of Object.entries(jobs)) {
    const job = recordValue(rawJob);
    if (!job) {
      skippedCount += 1;
      continue;
    }
    const jobName = stringValue(job.name);
    const action = slug(jobId, 'workflow_job');
    declarations.push(declaration({
      sourceKind: 'workflow-manifest',
      actionSurface: `${downstreamSystem}.${action}`,
      domain: inferDomain([jobId, jobName], options.defaultDomain),
      downstreamSystem,
      action,
      operationRef: `workflow:${sourceRef}#jobs.${jobId}`,
      workflowRef: `${sourceRef}#jobs.${jobId}`,
      credentialPosture: workflowCredentialPosture(root, job, options),
      integrationModeHint: options.integrationModeHint ?? 'sidecar-ext-authz',
    }));
  }

  return createResult({
    sourceKind: 'workflow-manifest',
    sourceRef,
    declarations: Object.freeze(declarations),
    skippedCount,
  });
}

export function actionSurfaceDeclarationIngestorsDescriptor(): ActionSurfaceDeclarationIngestorsDescriptor {
  return Object.freeze({
    version: ACTION_SURFACE_DECLARATION_INGESTORS_VERSION,
    sourceKinds: ACTION_SURFACE_DECLARATION_INGESTOR_SOURCE_KINDS,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    outputIsDeclarationOnly: true,
    liveProviderAccessRequired: false,
  });
}
