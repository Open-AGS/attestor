import type { Context, Hono } from 'hono';
import {
  ACTION_SURFACE_DECLARED_CREDENTIAL_POSTURES,
  ACTION_SURFACE_MANIFEST_FORMATS,
  ACTION_SURFACE_MANIFEST_KINDS,
  createActionSurfaceOnboardingPacket,
  createConsequenceAdmissionProblem,
  type ActionSurfaceDeclaration,
  type ActionSurfaceDeclaredCredentialPosture,
  type ActionSurfaceManifestFormat,
  type ActionSurfaceManifestKind,
  type ActionSurfaceOnboardingReadinessOverride,
  type ShadowAdmissionEvent,
} from '../../../consequence-admission/index.js';
import type { TenantContext } from '../../tenant-isolation.js';

const HOSTED_ACTION_SURFACE_ONBOARDING_ROUTE =
  '/api/v1/shadow/action-surface/onboarding-packet';

const MAX_HOSTED_MANIFESTS = 20;
const MAX_HOSTED_DECLARATIONS = 500;
const MAX_HOSTED_READINESS_OVERRIDES = 500;
const DEFAULT_HOSTED_MANIFEST_MAX_BYTES = 512 * 1024;

type HostedOnboardingProblemStatus = 400 | 503;

type HostedActionSurfaceOnboardingRequestBody = {
  readonly generatedAt?: unknown;
  readonly attestorBaseUrl?: unknown;
  readonly includeShadowEvents?: unknown;
  readonly manifests?: unknown;
  readonly declarations?: unknown;
  readonly readinessOverrides?: unknown;
  readonly defaultDomain?: unknown;
  readonly downstreamSystem?: unknown;
  readonly credentialPosture?: unknown;
};

export interface ActionSurfaceOnboardingRouteDeps {
  currentTenant(context: Context): TenantContext;
  listShadowEvents(input: { readonly tenant: TenantContext }): readonly ShadowAdmissionEvent[];
  now?(): string;
}

function tenantSummary(tenant: TenantContext): {
  readonly tenantId: string;
  readonly source: TenantContext['source'];
  readonly planId: string | null;
} {
  return Object.freeze({
    tenantId: tenant.tenantId,
    source: tenant.source,
    planId: tenant.planId,
  });
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown, fieldName: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw new Error(`Action surface onboarding hosted route ${fieldName} must be a string.`);
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function optionalBoolean(value: unknown, fieldName: string, fallback: boolean): boolean {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'boolean') {
    throw new Error(`Action surface onboarding hosted route ${fieldName} must be a boolean.`);
  }
  return value;
}

function optionalIsoTimestamp(value: unknown, fallback: string): string {
  const raw = optionalString(value, 'generatedAt') ?? fallback;
  const timestamp = new Date(raw);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error('Action surface onboarding hosted route generatedAt must be an ISO timestamp.');
  }
  return timestamp.toISOString();
}

function optionalManifestKind(value: unknown): ActionSurfaceManifestKind | 'auto' | null {
  const normalized = optionalString(value, 'manifestKind');
  if (normalized === null) return null;
  if (normalized === 'auto') return normalized;
  if (!(ACTION_SURFACE_MANIFEST_KINDS as readonly string[]).includes(normalized)) {
    throw new Error(
      `Action surface onboarding hosted route manifestKind must be one of: auto, ${ACTION_SURFACE_MANIFEST_KINDS.join(', ')}.`,
    );
  }
  return normalized as ActionSurfaceManifestKind;
}

function optionalManifestFormat(value: unknown): ActionSurfaceManifestFormat | 'auto' | null {
  const normalized = optionalString(value, 'format');
  if (normalized === null) return null;
  if (normalized === 'auto') return normalized;
  if (!(ACTION_SURFACE_MANIFEST_FORMATS as readonly string[]).includes(normalized)) {
    throw new Error(
      `Action surface onboarding hosted route format must be one of: auto, ${ACTION_SURFACE_MANIFEST_FORMATS.join(', ')}.`,
    );
  }
  return normalized as ActionSurfaceManifestFormat;
}

function optionalCredentialPosture(
  value: unknown,
  fallback: string | null,
): ActionSurfaceDeclaredCredentialPosture | null {
  const normalized = optionalString(value, 'credentialPosture') ?? fallback;
  if (normalized === null) return null;
  if (!(ACTION_SURFACE_DECLARED_CREDENTIAL_POSTURES as readonly string[]).includes(normalized)) {
    throw new Error(
      `Action surface onboarding hosted route credentialPosture must be one of: ${ACTION_SURFACE_DECLARED_CREDENTIAL_POSTURES.join(', ')}.`,
    );
  }
  return normalized as ActionSurfaceDeclaredCredentialPosture;
}

function arrayFromBody(value: unknown, fieldName: string, maxItems: number): readonly unknown[] {
  if (value === undefined || value === null) return Object.freeze([]);
  if (!Array.isArray(value)) {
    throw new Error(`Action surface onboarding hosted route ${fieldName} must be an array.`);
  }
  if (value.length > maxItems) {
    throw new Error(
      `Action surface onboarding hosted route ${fieldName} is limited to ${maxItems} items.`,
    );
  }
  return Object.freeze(value);
}

function normalizeManifestInputs(
  body: HostedActionSurfaceOnboardingRequestBody,
): Parameters<typeof createActionSurfaceOnboardingPacket>[0]['manifests'] {
  const manifests = arrayFromBody(body.manifests, 'manifests', MAX_HOSTED_MANIFESTS);
  const defaultDomain = optionalString(body.defaultDomain, 'defaultDomain');
  const downstreamSystem = optionalString(body.downstreamSystem, 'downstreamSystem');
  const defaultCredentialPosture = optionalCredentialPosture(body.credentialPosture, null);

  return Object.freeze(
    manifests.map((manifest, index) => {
      if (!isRecord(manifest)) {
        throw new Error('Action surface onboarding hosted route manifests entries must be objects.');
      }
      const text = optionalString(manifest.text, 'manifests[].text');
      if (!text) {
        throw new Error('Action surface onboarding hosted route manifests[].text is required.');
      }
      return Object.freeze({
        text,
        sourceRef: `hosted-request-manifest:${index + 1}`,
        manifestKind: optionalManifestKind(manifest.manifestKind) ?? 'auto',
        format: optionalManifestFormat(manifest.format) ?? 'auto',
        defaultDomain: optionalString(manifest.defaultDomain, 'manifests[].defaultDomain') ?? defaultDomain,
        downstreamSystem:
          optionalString(manifest.downstreamSystem, 'manifests[].downstreamSystem') ?? downstreamSystem,
        credentialPosture: optionalCredentialPosture(
          manifest.credentialPosture,
          defaultCredentialPosture,
        ),
        maxBytes: DEFAULT_HOSTED_MANIFEST_MAX_BYTES,
      });
    }),
  );
}

function normalizeDeclarations(
  value: unknown,
): readonly ActionSurfaceDeclaration[] {
  return arrayFromBody(value, 'declarations', MAX_HOSTED_DECLARATIONS) as readonly ActionSurfaceDeclaration[];
}

function normalizeReadinessOverrides(
  value: unknown,
): readonly ActionSurfaceOnboardingReadinessOverride[] {
  return arrayFromBody(
    value,
    'readinessOverrides',
    MAX_HOSTED_READINESS_OVERRIDES,
  ) as readonly ActionSurfaceOnboardingReadinessOverride[];
}

function problem(
  c: Context,
  input: {
    readonly type: string;
    readonly title: string;
    readonly status: HostedOnboardingProblemStatus;
    readonly detail: string;
    readonly reasonCodes: readonly string[];
  },
): Response {
  const payload = createConsequenceAdmissionProblem({
    ...input,
    instance: c.req.path,
  });
  return c.json(payload, input.status);
}

async function readBody(c: Context): Promise<HostedActionSurfaceOnboardingRequestBody | Response> {
  try {
    const parsed = await c.req.json<unknown>();
    if (!isRecord(parsed)) {
      return problem(c, {
        type: 'https://attestor.dev/problems/action-surface-onboarding-body-invalid',
        title: 'Invalid action surface onboarding body',
        status: 400,
        detail: 'The hosted action surface onboarding route requires a JSON object.',
        reasonCodes: ['action-surface-onboarding-body-invalid'],
      });
    }
    return parsed;
  } catch {
    return problem(c, {
      type: 'https://attestor.dev/problems/action-surface-onboarding-json-invalid',
      title: 'Invalid action surface onboarding JSON',
      status: 400,
      detail: 'The hosted action surface onboarding route requires valid JSON.',
      reasonCodes: ['action-surface-onboarding-json-invalid'],
    });
  }
}

export function registerActionSurfaceOnboardingRoutes(
  app: Hono,
  deps: ActionSurfaceOnboardingRouteDeps,
): void {
  app.post(HOSTED_ACTION_SURFACE_ONBOARDING_ROUTE, async (c) => {
    c.header('cache-control', 'no-store');
    const body = await readBody(c);
    if (body instanceof Response) return body;

    try {
      const tenant = deps.currentTenant(c);
      const generatedAt = optionalIsoTimestamp(body.generatedAt, deps.now?.() ?? new Date().toISOString());
      const includeShadowEvents = optionalBoolean(body.includeShadowEvents, 'includeShadowEvents', true);
      const events = includeShadowEvents ? deps.listShadowEvents({ tenant }) : [];
      const packet = createActionSurfaceOnboardingPacket({
        generatedAt,
        attestorBaseUrl: optionalString(body.attestorBaseUrl, 'attestorBaseUrl'),
        manifests: normalizeManifestInputs(body),
        declarations: normalizeDeclarations(body.declarations),
        events,
        readinessOverrides: normalizeReadinessOverrides(body.readinessOverrides),
      });
      return c.json({
        tenant: tenantSummary(tenant),
        storageMode: 'stateless-review-packet',
        route: HOSTED_ACTION_SURFACE_ONBOARDING_ROUTE,
        approvalRequired: true,
        autoEnforce: false,
        rawPayloadStored: false,
        productionReady: false,
        executionPlanOnly: true,
        deploysInfrastructure: false,
        issuesCredentials: false,
        activatesEnforcement: false,
        includedShadowEvents: includeShadowEvents,
        packet,
      });
    } catch (error) {
      const detail =
        error instanceof Error
          ? error.message
          : 'The action surface onboarding packet could not be rendered.';
      const status: HostedOnboardingProblemStatus =
        detail.includes('hosted route') ||
        detail.includes('Action surface') ||
        detail.includes('must be') ||
        detail.includes('requires')
          ? 400
          : 503;
      return problem(c, {
        type: 'https://attestor.dev/problems/action-surface-onboarding-render-failed',
        title: 'Action surface onboarding render failed',
        status,
        detail,
        reasonCodes: ['action-surface-onboarding-render-failed'],
      });
    }
  });
}
