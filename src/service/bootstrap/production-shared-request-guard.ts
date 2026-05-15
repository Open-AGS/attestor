import type { Hono, MiddlewareHandler } from 'hono';
import type { AppRuntime } from './runtime.js';

export const PRODUCTION_SHARED_REQUEST_GUARD_SPEC_VERSION =
  'attestor.production-shared-request-guard.v1';

const ALLOWED_PREFLIGHT_PATHS = Object.freeze([
  '/api/v1/startup',
  '/api/v1/health',
  '/api/v1/ready',
]);

interface ReleaseRuntimeRequestPathDiagnosticsLike {
  readonly version?: unknown;
  readonly usesSharedAuthorityStores?: unknown;
  readonly blockers?: unknown;
}

interface ConsequenceSharedStoreProfileLike {
  readonly readyForSelectedProfile?: unknown;
  readonly state?: unknown;
  readonly blockers?: unknown;
  readonly blockingComponentIds?: unknown;
}

interface RuntimeSecurityLike {
  readonly runtimeProfile?: unknown;
  readonly releaseRuntimeRequestPathDiagnostics?: ReleaseRuntimeRequestPathDiagnosticsLike;
  readonly consequenceSharedStoreProfile?: ConsequenceSharedStoreProfileLike;
}

export interface ProductionSharedRequestGuardDecision {
  readonly version: typeof PRODUCTION_SHARED_REQUEST_GUARD_SPEC_VERSION;
  readonly blocked: boolean;
  readonly runtimeProfile: string | null;
  readonly requestPathUsesSharedStores: boolean;
  readonly consequenceSharedStoreProfileReady: boolean;
  readonly consequenceSharedStoreProfileState: string | null;
  readonly allowedPreflightPaths: readonly string[];
  readonly blockers: readonly string[];
}

function securityFor(runtime: AppRuntime<unknown>): RuntimeSecurityLike {
  return (runtime.infra.security ?? {}) as RuntimeSecurityLike;
}

function requestPathDiagnosticsFor(
  runtime: AppRuntime<unknown>,
): ReleaseRuntimeRequestPathDiagnosticsLike {
  return securityFor(runtime).releaseRuntimeRequestPathDiagnostics ?? {};
}

function consequenceSharedStoreProfileFor(
  runtime: AppRuntime<unknown>,
): ConsequenceSharedStoreProfileLike {
  return securityFor(runtime).consequenceSharedStoreProfile ?? {};
}

function recordFor(value: unknown): Readonly<Record<string, unknown>> | null {
  return value && typeof value === 'object'
    ? value as Readonly<Record<string, unknown>>
    : null;
}

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? Object.freeze(value.filter((item): item is string => typeof item === 'string'))
    : Object.freeze([]);
}

function blockerStrings(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return Object.freeze([]);

  return Object.freeze(value.flatMap((item): string[] => {
    if (typeof item === 'string') return [item];

    const record = recordFor(item);
    if (!record) return [];

    const code = typeof record.code === 'string' ? record.code : null;
    const component = typeof record.component === 'string' ? record.component : null;
    if (code && component) return [`${component}:${code}`];
    if (code) return [code];
    if (component) return [`${component}:blocked`];
    return [];
  }));
}

function unique(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)]);
}

export function evaluateProductionSharedRequestGuard(
  runtime: AppRuntime<unknown>,
): ProductionSharedRequestGuardDecision {
  const security = securityFor(runtime);
  const diagnostics = requestPathDiagnosticsFor(runtime);
  const consequenceSharedStoreProfile = consequenceSharedStoreProfileFor(runtime);
  const runtimeProfile =
    typeof security.runtimeProfile === 'string' ? security.runtimeProfile : null;
  const requestPathUsesSharedStores =
    diagnostics.usesSharedAuthorityStores === true;
  const consequenceSharedStoreProfileReady = runtimeProfile === 'production-shared'
    ? consequenceSharedStoreProfile.readyForSelectedProfile === true
    : true;
  const consequenceSharedStoreProfileState =
    typeof consequenceSharedStoreProfile.state === 'string'
      ? consequenceSharedStoreProfile.state
      : null;
  const consequenceSharedStoreBlockers = runtimeProfile === 'production-shared'
    ? consequenceSharedStoreProfileState
      ? blockerStrings(consequenceSharedStoreProfile.blockers)
      : ['consequence shared-store profile diagnostics missing']
    : [];
  const consequenceSharedStoreComponents = runtimeProfile === 'production-shared'
    ? stringArray(consequenceSharedStoreProfile.blockingComponentIds)
      .map((component) => `consequence-shared-store:${component}`)
    : [];
  const blocked = runtimeProfile === 'production-shared' &&
    (!requestPathUsesSharedStores || !consequenceSharedStoreProfileReady);

  return Object.freeze({
    version: PRODUCTION_SHARED_REQUEST_GUARD_SPEC_VERSION,
    blocked,
    runtimeProfile,
    requestPathUsesSharedStores,
    consequenceSharedStoreProfileReady,
    consequenceSharedStoreProfileState,
    allowedPreflightPaths: ALLOWED_PREFLIGHT_PATHS,
    blockers: unique([
      ...stringArray(diagnostics.blockers),
      ...consequenceSharedStoreBlockers,
      ...consequenceSharedStoreComponents,
    ]),
  });
}

export function createProductionSharedRequestGuard(
  runtime: AppRuntime<unknown>,
): MiddlewareHandler {
  return async (c, next) => {
    const decision = evaluateProductionSharedRequestGuard(runtime);

    if (!decision.blocked || ALLOWED_PREFLIGHT_PATHS.includes(c.req.path)) {
      await next();
      return;
    }

    return c.json(
      {
        error: 'production_shared_request_path_not_ready',
        message:
          'Production-shared request handling is fail-closed until the release/policy runtime request path and consequence shared-store profile both clear shared-store readiness.',
        guard: decision,
      },
      503,
    );
  };
}

export function installProductionSharedRequestGuard<Packet>(
  app: Hono,
  runtime: AppRuntime<Packet>,
): void {
  app.use('/api/v1/*', createProductionSharedRequestGuard(runtime as AppRuntime<unknown>));
}
