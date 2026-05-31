import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type {
  ActionSurfaceIntegrationKitArtifactEntry,
  ActionSurfaceIntegrationKitPacket,
} from './action-surface-integration-kit-packet.js';

export const ACTION_SURFACE_INTEGRATION_KIT_MCP_GATEWAY_DRAFTS_VERSION =
  'attestor.action-surface-integration-kit-mcp-gateway-drafts.v1';

export interface CreateActionSurfaceIntegrationKitMcpGatewayDraftBundleInput {
  readonly kit: ActionSurfaceIntegrationKitPacket;
  readonly generatedAt?: string | null;
  readonly serverName?: string | null;
}

export interface ActionSurfaceIntegrationKitMcpToolDraft {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly inputSchema: Readonly<Record<string, CanonicalReleaseJsonValue>>;
  readonly actionSurface: string;
  readonly sourceArtifactDigests: readonly string[];
  readonly requiredReview: true;
  readonly annotationsTrusted: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
}

export interface ActionSurfaceIntegrationKitCredentialIsolationCheck {
  readonly actionSurface: string;
  readonly sourceArtifactDigests: readonly string[];
  readonly targetCredentialPosture: 'gateway-held-secret';
  readonly gatewayOwnsToolCredentialRequired: true;
  readonly agentDirectCredentialAllowed: false;
  readonly credentialIssued: false;
  readonly credentialRotated: false;
  readonly customerApprovalRequired: true;
  readonly reviewRequired: true;
  readonly noGoReasons: readonly string[];
}

export interface ActionSurfaceIntegrationKitMcpGatewayDraftBundle {
  readonly version: typeof ACTION_SURFACE_INTEGRATION_KIT_MCP_GATEWAY_DRAFTS_VERSION;
  readonly generatedAt: string;
  readonly sourceKitDigest: string;
  readonly serverName: string;
  readonly toolCount: number;
  readonly tools: readonly ActionSurfaceIntegrationKitMcpToolDraft[];
  readonly credentialIsolationChecks: readonly ActionSurfaceIntegrationKitCredentialIsolationCheck[];
  readonly authorizationRequired: true;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly deploysInfrastructure: false;
  readonly issuesCredentials: false;
  readonly rotatesCredentials: false;
  readonly activatesEnforcement: false;
  readonly nonBypassableClaimAllowed: false;
  readonly limitations: readonly string[];
  readonly canonical: string;
  readonly digest: string;
}

export interface ActionSurfaceIntegrationKitMcpGatewayDraftDescriptor {
  readonly version: typeof ACTION_SURFACE_INTEGRATION_KIT_MCP_GATEWAY_DRAFTS_VERSION;
  readonly authorizationRequired: true;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly deploysInfrastructure: false;
  readonly issuesCredentials: false;
  readonly rotatesCredentials: false;
  readonly activatesEnforcement: false;
  readonly nonBypassableClaimAllowed: false;
  readonly annotationsTrusted: false;
}

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

function withCanonical<T extends object>(
  body: T,
): T & {
  readonly canonical: string;
  readonly digest: string;
} {
  const canonical = canonicalObject(body as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...body,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

function normalizeIsoTimestamp(
  value: string | null | undefined,
  fallback: string,
  fieldName: string,
): string {
  const raw = value ?? fallback;
  const timestamp = new Date(raw);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Action surface integration kit MCP gateway drafts ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function normalizeServerName(value: string | null | undefined): string {
  const normalized = value?.trim();
  return normalized && normalized.length > 0
    ? normalized
    : 'attestor-mcp-gateway-review-draft';
}

function toolNameFromOperationRefs(
  artifact: ActionSurfaceIntegrationKitArtifactEntry,
): string {
  const toolRef = artifact.operationRefs.find((ref) => ref.startsWith('tool:'));
  if (toolRef) return toolRef.slice('tool:'.length);
  return artifact.actionSurface;
}

function normalizeMcpToolName(value: string): string {
  const normalized = value
    .trim()
    .replace(/[^A-Za-z0-9_.-]+/gu, '_')
    .replace(/^_+|_+$/gu, '')
    .slice(0, 128);
  return normalized.length > 0 ? normalized : 'attestor_review_tool';
}

function mcpArtifacts(
  kit: ActionSurfaceIntegrationKitPacket,
): readonly ActionSurfaceIntegrationKitArtifactEntry[] {
  return Object.freeze(
    kit.artifactManifest.artifacts.filter((artifact) =>
      artifact.kind === 'mcp-tool-gateway-config' ||
      artifact.operationRefs.some((ref) => ref.startsWith('tool:')) ||
      artifact.mode === 'mcp-tool-gateway'
    ),
  );
}

function groupedArtifactDigestsBySurface(
  artifacts: readonly ActionSurfaceIntegrationKitArtifactEntry[],
): ReadonlyMap<string, readonly string[]> {
  const grouped = new Map<string, string[]>();
  for (const artifact of artifacts) {
    const current = grouped.get(artifact.actionSurface) ?? [];
    current.push(artifact.digest);
    grouped.set(artifact.actionSurface, current);
  }
  return new Map(
    [...grouped.entries()].map(([surface, digests]) => [
      surface,
      Object.freeze([...new Set(digests)].sort()),
    ]),
  );
}

function createToolDrafts(
  artifacts: readonly ActionSurfaceIntegrationKitArtifactEntry[],
): readonly ActionSurfaceIntegrationKitMcpToolDraft[] {
  const grouped = new Map<string, ActionSurfaceIntegrationKitMcpToolDraft>();
  for (const artifact of artifacts) {
    const name = normalizeMcpToolName(toolNameFromOperationRefs(artifact));
    const existing = grouped.get(name);
    const sourceArtifactDigests = Object.freeze([
      ...new Set([
        ...(existing?.sourceArtifactDigests ?? []),
        artifact.digest,
      ]),
    ].sort());
    grouped.set(name, Object.freeze({
      name,
      title: `Review ${artifact.actionSurface}`,
      description: 'Review-only MCP gateway tool draft for Attestor admission planning.',
      inputSchema: Object.freeze({
        type: 'object',
        additionalProperties: false,
        properties: Object.freeze({
          requestDigest: Object.freeze({
            type: 'string',
            description: 'Digest of the proposed tool invocation request.',
          }),
          presentationDigest: Object.freeze({
            type: 'string',
            description: 'Digest of the Attestor admission presentation, if present.',
          }),
        }),
        required: Object.freeze(['requestDigest']),
      }),
      actionSurface: artifact.actionSurface,
      sourceArtifactDigests,
      requiredReview: true,
      annotationsTrusted: false,
      rawPayloadStored: false,
      productionReady: false,
    }));
  }
  return Object.freeze(
    [...grouped.values()].sort((left, right) => left.name.localeCompare(right.name)),
  );
}

function createCredentialIsolationChecks(
  artifacts: readonly ActionSurfaceIntegrationKitArtifactEntry[],
): readonly ActionSurfaceIntegrationKitCredentialIsolationCheck[] {
  const grouped = groupedArtifactDigestsBySurface(artifacts);
  return Object.freeze(
    [...grouped.entries()]
      .map(([actionSurface, sourceArtifactDigests]) =>
        Object.freeze({
          actionSurface,
          sourceArtifactDigests,
          targetCredentialPosture: 'gateway-held-secret' as const,
          gatewayOwnsToolCredentialRequired: true,
          agentDirectCredentialAllowed: false,
          credentialIssued: false,
          credentialRotated: false,
          customerApprovalRequired: true,
          reviewRequired: true,
          noGoReasons: Object.freeze([
            'credential-boundary-review-required',
            'customer-owned-mcp-gateway-not-proven',
          ]),
        })
      )
      .sort((left, right) => left.actionSurface.localeCompare(right.actionSurface)),
  );
}

export function createActionSurfaceIntegrationKitMcpGatewayDraftBundle(
  input: CreateActionSurfaceIntegrationKitMcpGatewayDraftBundleInput,
): ActionSurfaceIntegrationKitMcpGatewayDraftBundle {
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt,
    input.kit.generatedAt,
    'generatedAt',
  );
  const artifacts = mcpArtifacts(input.kit);
  const tools = createToolDrafts(artifacts);
  const credentialIsolationChecks = createCredentialIsolationChecks(artifacts);
  const body = {
    version: ACTION_SURFACE_INTEGRATION_KIT_MCP_GATEWAY_DRAFTS_VERSION,
    generatedAt,
    sourceKitDigest: input.kit.digest,
    serverName: normalizeServerName(input.serverName),
    toolCount: tools.length,
    tools,
    credentialIsolationChecks,
    authorizationRequired: true,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    deploysInfrastructure: false,
    issuesCredentials: false,
    rotatesCredentials: false,
    activatesEnforcement: false,
    nonBypassableClaimAllowed: false,
    limitations: Object.freeze([
      'These MCP gateway entries are review drafts only.',
      'They do not run an MCP server, expose tools, issue credentials, or rotate credentials.',
      'Tool annotations are not authority and customer credential isolation proof remains required.',
    ]),
  } as const;
  return withCanonical(body);
}

export function actionSurfaceIntegrationKitMcpGatewayDraftDescriptor():
  ActionSurfaceIntegrationKitMcpGatewayDraftDescriptor {
  return Object.freeze({
    version: ACTION_SURFACE_INTEGRATION_KIT_MCP_GATEWAY_DRAFTS_VERSION,
    authorizationRequired: true,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    deploysInfrastructure: false,
    issuesCredentials: false,
    rotatesCredentials: false,
    activatesEnforcement: false,
    nonBypassableClaimAllowed: false,
    annotationsTrusted: false,
  });
}
