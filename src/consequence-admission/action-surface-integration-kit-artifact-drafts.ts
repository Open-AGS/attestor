import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type {
  ActionSurfaceIntegrationKitArtifactEntry,
  ActionSurfaceIntegrationKitPacket,
} from './action-surface-integration-kit-packet.js';
import type {
  AttestorIntegrationMode,
} from './integration-mode-readiness.js';

export const ACTION_SURFACE_INTEGRATION_KIT_ARTIFACT_DRAFTS_VERSION =
  'attestor.action-surface-integration-kit-artifact-drafts.v1';

export const ACTION_SURFACE_INTEGRATION_KIT_ARTIFACT_REVIEW_EVIDENCE_FIELDS = [
  'request-digest',
  'attestor-presentation-digest',
  'customer-stop-point-decision-digest',
  'downstream-receipt-or-denial-digest',
  'operator-review-record-digest',
] as const;
export type ActionSurfaceIntegrationKitArtifactReviewEvidenceField =
  typeof ACTION_SURFACE_INTEGRATION_KIT_ARTIFACT_REVIEW_EVIDENCE_FIELDS[number];

export interface CreateActionSurfaceIntegrationKitArtifactDraftBundleInput {
  readonly kit: ActionSurfaceIntegrationKitPacket;
  readonly generatedAt?: string | null;
  readonly targetOpenApiRef?: string | null;
}

export interface ActionSurfaceIntegrationKitHttpRouteDraft {
  readonly actionSurface: string;
  readonly mode: AttestorIntegrationMode;
  readonly domain: string | null;
  readonly downstreamSystem: string | null;
  readonly method: string;
  readonly path: string;
  readonly artifactDigests: readonly string[];
  readonly reviewRequired: true;
  readonly customerStopPointRequired: true;
  readonly routePlacementReviewed: false;
  readonly credentialBoundaryReviewRequired: true;
  readonly executionProofRequired: true;
  readonly requiredEvidence:
    readonly ActionSurfaceIntegrationKitArtifactReviewEvidenceField[];
  readonly authority: 'route-review-hint-only';
}

export interface ActionSurfaceIntegrationKitOpenApiOverlayActionDraft {
  readonly target: string;
  readonly description: string;
  readonly update: Readonly<Record<string, CanonicalReleaseJsonValue>>;
}

export interface ActionSurfaceIntegrationKitOpenApiOverlayDraft {
  readonly overlay: '1.1.0';
  readonly info: {
    readonly title: string;
    readonly version: '1.0.0';
    readonly description: string;
  };
  readonly extends: string;
  readonly actions: readonly ActionSurfaceIntegrationKitOpenApiOverlayActionDraft[];
  readonly requiredReview: true;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly nonBypassableClaimAllowed: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface ActionSurfaceIntegrationKitEnvoyExtAuthzDraft {
  readonly kind: 'envoy-ext-authz-http-filter-draft';
  readonly filter: Readonly<Record<string, CanonicalReleaseJsonValue>>;
  readonly routeHints: readonly ActionSurfaceIntegrationKitHttpRouteDraft[];
  readonly reviewPlan: Readonly<Record<string, CanonicalReleaseJsonValue>>;
  readonly failureModeAllow: false;
  readonly requiredReview: true;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly nonBypassableClaimAllowed: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface ActionSurfaceIntegrationKitArtifactDraftBundle {
  readonly version: typeof ACTION_SURFACE_INTEGRATION_KIT_ARTIFACT_DRAFTS_VERSION;
  readonly generatedAt: string;
  readonly sourceKitDigest: string;
  readonly routeCount: number;
  readonly openApiOverlay: ActionSurfaceIntegrationKitOpenApiOverlayDraft;
  readonly envoyExtAuthz: ActionSurfaceIntegrationKitEnvoyExtAuthzDraft;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly deploysInfrastructure: false;
  readonly issuesCredentials: false;
  readonly activatesEnforcement: false;
  readonly nonBypassableClaimAllowed: false;
  readonly limitations: readonly string[];
  readonly canonical: string;
  readonly digest: string;
}

export interface ActionSurfaceIntegrationKitArtifactDraftDescriptor {
  readonly version: typeof ACTION_SURFACE_INTEGRATION_KIT_ARTIFACT_DRAFTS_VERSION;
  readonly overlayVersion: '1.1.0';
  readonly gatewayDraftKind: 'envoy-ext-authz-http-filter-draft';
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly deploysInfrastructure: false;
  readonly issuesCredentials: false;
  readonly activatesEnforcement: false;
  readonly nonBypassableClaimAllowed: false;
}

const HTTP_OPERATION_PATTERN =
  /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|TRACE)\s+(\S.*)$/u;

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
    throw new Error(`Action surface integration kit artifact drafts ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function normalizeTargetOpenApiRef(value: string | null | undefined): string {
  const normalized = value?.trim();
  return normalized && normalized.length > 0
    ? normalized
    : '<customer-openapi-document>';
}

function parseHttpOperationRef(ref: string): {
  readonly method: string;
  readonly path: string;
} | null {
  const match = ref.match(HTTP_OPERATION_PATTERN);
  if (!match) return null;
  return Object.freeze({
    method: match[1] ?? '',
    path: match[2]?.trim() ?? '',
  });
}

function routeKey(route: Pick<ActionSurfaceIntegrationKitHttpRouteDraft, 'actionSurface' | 'method' | 'path'>): string {
  return `${route.actionSurface}\n${route.method}\n${route.path}`;
}

function collectHttpRouteDrafts(
  artifacts: readonly ActionSurfaceIntegrationKitArtifactEntry[],
): readonly ActionSurfaceIntegrationKitHttpRouteDraft[] {
  const entries = new Map<string, ActionSurfaceIntegrationKitHttpRouteDraft>();
  for (const artifact of artifacts) {
    for (const operationRef of artifact.operationRefs) {
      const operation = parseHttpOperationRef(operationRef);
      if (!operation) continue;
      const draft = entries.get(routeKey({
        actionSurface: artifact.actionSurface,
        method: operation.method,
        path: operation.path,
      }));
      const artifactDigests = Object.freeze([
        ...new Set([
          ...(draft?.artifactDigests ?? []),
          artifact.digest,
        ]),
      ].sort());
      entries.set(routeKey({
        actionSurface: artifact.actionSurface,
        method: operation.method,
        path: operation.path,
      }), Object.freeze({
        actionSurface: artifact.actionSurface,
        mode: artifact.mode,
        domain: draft?.domain ?? artifact.domain,
        downstreamSystem: draft?.downstreamSystem ?? artifact.downstreamSystem,
        method: operation.method,
        path: operation.path,
        artifactDigests,
        reviewRequired: true,
        customerStopPointRequired: true,
        routePlacementReviewed: false,
        credentialBoundaryReviewRequired: true,
        executionProofRequired: true,
        requiredEvidence:
          ACTION_SURFACE_INTEGRATION_KIT_ARTIFACT_REVIEW_EVIDENCE_FIELDS,
        authority: 'route-review-hint-only',
      }));
    }
  }
  return Object.freeze(
    [...entries.values()].sort((left, right) =>
      left.actionSurface.localeCompare(right.actionSurface) ||
      left.method.localeCompare(right.method) ||
      left.path.localeCompare(right.path)
    ),
  );
}

function escapeJsonPathSingleQuoted(value: string): string {
  return value.replace(/\\/gu, '\\\\').replace(/'/gu, "\\'");
}

function openApiOverlayTarget(route: ActionSurfaceIntegrationKitHttpRouteDraft): string {
  return `$.paths['${escapeJsonPathSingleQuoted(route.path)}'].${route.method.toLowerCase()}`;
}

function createOpenApiOverlay(input: {
  readonly kit: ActionSurfaceIntegrationKitPacket;
  readonly targetOpenApiRef: string;
  readonly routes: readonly ActionSurfaceIntegrationKitHttpRouteDraft[];
}): ActionSurfaceIntegrationKitOpenApiOverlayDraft {
  const actions = Object.freeze(
    input.routes.map((route) =>
      Object.freeze({
        target: openApiOverlayTarget(route),
        description: `Mark ${route.actionSurface} as an Attestor-reviewed action surface.`,
        update: Object.freeze({
          'x-attestor': Object.freeze({
            actionSurface: route.actionSurface,
            integrationMode: route.mode,
            domain: route.domain,
            downstreamSystem: route.downstreamSystem,
            sourceKitDigest: input.kit.digest,
            sourcePacketDigest: input.kit.sourcePacketDigest,
            artifactDigests: route.artifactDigests,
            requiredEvidence:
              ACTION_SURFACE_INTEGRATION_KIT_ARTIFACT_REVIEW_EVIDENCE_FIELDS,
            reviewRequired: true,
            customerStopPointRequired: true,
            routePlacementReviewed: false,
            credentialBoundaryReviewRequired: true,
            executionProofRequired: true,
            authority: 'review-metadata-only',
            autoEnforce: false,
            rawPayloadStored: false,
            productionReady: false,
            nonBypassableClaimAllowed: false,
          }),
        }),
      })
    ),
  );
  return withCanonical({
    overlay: '1.1.0',
    info: Object.freeze({
      title: 'Attestor action surface review overlay',
      version: '1.0.0',
      description: 'Review-only metadata for Attestor action-surface integration planning.',
    }),
    extends: input.targetOpenApiRef,
    actions,
    requiredReview: true,
    rawPayloadStored: false,
    productionReady: false,
    nonBypassableClaimAllowed: false,
  } as const);
}

function createEnvoyExtAuthzDraft(input: {
  readonly routes: readonly ActionSurfaceIntegrationKitHttpRouteDraft[];
}): ActionSurfaceIntegrationKitEnvoyExtAuthzDraft {
  return withCanonical({
    kind: 'envoy-ext-authz-http-filter-draft',
    filter: Object.freeze({
      name: 'envoy.filters.http.ext_authz',
      typedConfig: Object.freeze({
        '@type': 'type.googleapis.com/envoy.extensions.filters.http.ext_authz.v3.ExtAuthz',
        failureModeAllow: false,
        statusOnError: Object.freeze({
          code: 'Forbidden',
        }),
        httpService: Object.freeze({
          serverUri: Object.freeze({
            uri: 'https://attestor.example.invalid/api/v1/admissions',
            cluster: 'attestor-ext-authz',
            timeout: '0.5s',
          }),
        }),
      }),
    }),
    routeHints: input.routes,
    reviewPlan: Object.freeze({
      authority: 'configuration-review-only',
      customerOwnedStopPointRequired: true,
      routePlacementReviewed: false,
      credentialBoundaryReviewRequired: true,
      bodyForwarding: 'digest-or-redacted-summary-only',
      rawRequestBodyAllowed: false,
      requiredEvidence:
        ACTION_SURFACE_INTEGRATION_KIT_ARTIFACT_REVIEW_EVIDENCE_FIELDS,
      reviewerActions: Object.freeze([
        'confirm route coverage before applying any gateway config',
        'confirm failureModeAllow remains false for enforcement-mode routes',
        'confirm the agent cannot call downstream with direct credentials',
        'record digest-bound denial or receipt evidence after probes run',
      ]),
    }),
    failureModeAllow: false,
    requiredReview: true,
    rawPayloadStored: false,
    productionReady: false,
    nonBypassableClaimAllowed: false,
  } as const);
}

export function createActionSurfaceIntegrationKitArtifactDraftBundle(
  input: CreateActionSurfaceIntegrationKitArtifactDraftBundleInput,
): ActionSurfaceIntegrationKitArtifactDraftBundle {
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt,
    input.kit.generatedAt,
    'generatedAt',
  );
  const routes = collectHttpRouteDrafts(input.kit.artifactManifest.artifacts);
  const openApiOverlay = createOpenApiOverlay({
    kit: input.kit,
    targetOpenApiRef: normalizeTargetOpenApiRef(input.targetOpenApiRef),
    routes,
  });
  const envoyExtAuthz = createEnvoyExtAuthzDraft({ routes });
  const body = {
    version: ACTION_SURFACE_INTEGRATION_KIT_ARTIFACT_DRAFTS_VERSION,
    generatedAt,
    sourceKitDigest: input.kit.digest,
    routeCount: routes.length,
    openApiOverlay,
    envoyExtAuthz,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    deploysInfrastructure: false,
    issuesCredentials: false,
    activatesEnforcement: false,
    nonBypassableClaimAllowed: false,
    limitations: Object.freeze([
      'These artifacts are review drafts only.',
      'They do not apply an OpenAPI Overlay, deploy Envoy, or configure a gateway.',
      'Customer-controlled route placement and no-bypass probes remain required.',
    ]),
  } as const;
  return withCanonical(body);
}

export function actionSurfaceIntegrationKitArtifactDraftDescriptor(): ActionSurfaceIntegrationKitArtifactDraftDescriptor {
  return Object.freeze({
    version: ACTION_SURFACE_INTEGRATION_KIT_ARTIFACT_DRAFTS_VERSION,
    overlayVersion: '1.1.0',
    gatewayDraftKind: 'envoy-ext-authz-http-filter-draft',
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    deploysInfrastructure: false,
    issuesCredentials: false,
    activatesEnforcement: false,
    nonBypassableClaimAllowed: false,
  });
}
