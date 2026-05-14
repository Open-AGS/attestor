import type { Hono } from 'hono';
import {
  evaluateConsequenceShadowReadinessClaimAlignment,
} from '../../../consequence-admission/shadow-readiness-claim-alignment.js';
import {
  releaseTokenVerificationKeysToJwks,
  type ReleaseTokenVerificationKey,
} from '../../../release-layer/index.js';

type DomainRegistryLike = {
  listIds(): string[];
  list(): Array<{
    id: string;
    version: string;
    displayName: string;
    description: string;
    clauses: readonly unknown[];
    guardrails: readonly unknown[];
  }>;
};
type ConnectorRegistryLike = {
  listIds(): string[];
  list(): Array<{
    id: string;
    displayName: string;
    loadConfig(): unknown;
    isAvailable(): Promise<boolean>;
  }>;
};
type FilingRegistryLike = {
  list(): Array<{ id: string }>;
};
type HighAvailabilityState = {
  enabled: boolean;
  publicHosted: boolean;
  ready: boolean;
};
type RuntimeProfileDiagnostics = {
  version: string;
  profile: {
    id: string;
    label: string;
    purpose: string;
    production: boolean;
  };
  releaseStores: readonly {
    component: string;
    mode: string;
    allowedModes: readonly string[];
    satisfiesSelectedProfile: boolean;
    sharedForProduction: boolean;
  }[];
  durability: {
    ready: boolean;
    summary: string;
    violations: readonly {
      component: string;
      observedMode: string;
      allowedModes: readonly string[];
    }[];
  };
};
type ReleaseRuntimeRequestPathDiagnostics = {
  version: string;
  usesSharedAuthorityStores: boolean;
  contract: string;
  storeModes: Record<string, string>;
  sharedComponents: readonly string[];
  blockers: readonly string[];
};
type ReleaseSigningProviderDiagnostics = {
  version: string;
  kind: string;
  configuredProvider: string | null;
  derivedProvider: string;
  productionProviderRequired: boolean;
  productionReady: boolean;
  privateKeyExportable: boolean;
  signingBoundary: string;
  rotationManagedBy: string;
  publicVerificationKeysServedBy: string;
  pkiPath: string | null;
  blockers: readonly string[];
};
type SharedAuthorityRuntimeReadiness = {
  version: string;
  evaluatedAt: string;
  runtimeProfileId: string | null;
  mode: 'postgres' | 'disabled';
  configured: boolean;
  ready: boolean;
  checks: Record<string, boolean>;
  summary: unknown;
  components: readonly unknown[];
  storeSummaries: unknown;
  blockers: readonly {
    code: string;
    message: string;
    components: readonly string[];
  }[];
};
type ProductionStoragePathEvaluation = {
  version: string;
  evaluatedAt: string;
  runtimeProfileId: string | null;
  state: string;
  readyForSelectedProfile: boolean;
  productionReady: boolean;
  rawPayloadStored: false;
  exposesConnectionStrings: false;
  components: readonly {
    component: string;
    plane: string;
    label: string;
    currentMode: string;
    requiredModeForProduction: string;
    satisfiesProductionShared: boolean;
    tenantScoped: boolean;
    rawPayloadStored: false;
    exposesStorageSecret: false;
    productionReady: boolean;
    migrationTarget: string;
    note: string;
  }[];
  blockers: readonly {
    code: string;
    component: string;
    message: string;
  }[];
  requiredProofs: readonly string[];
};

export interface CoreRouteDeps {
  evaluateApiHighAvailabilityState(input: {
    redisMode: 'external' | 'localhost' | 'embedded' | 'none' | 'unavailable';
    asyncBackendMode: 'bullmq' | 'in_process' | 'none';
    sharedControlPlane: boolean;
    sharedBillingLedger: boolean;
  }): HighAvailabilityState;
  redisMode: string;
  asyncBackendMode: 'bullmq' | 'in_process' | 'none';
  isSharedControlPlaneConfigured(): boolean;
  serviceInstanceId: string;
  serviceVersion: string;
  startTime: number;
  domainRegistry: DomainRegistryLike;
  connectorRegistry: ConnectorRegistryLike;
  filingRegistry: FilingRegistryLike;
  pkiReady: boolean;
  pki: {
    ca: {
      keyPair: { publicKeyPem: string };
      certificate: {
        certificateId?: string;
        name: string;
        notBefore?: string;
        notAfter?: string;
        publicKey?: string;
        fingerprint: string;
        signature?: string;
      };
    };
    signer: { certificate: { subject: string } };
    reviewer: { certificate: { subject: string } };
  };
  apiReleaseVerificationKeysPromise: Promise<readonly ReleaseTokenVerificationKey[]>;
  runtimeProfileDiagnostics: RuntimeProfileDiagnostics;
  releaseRuntimeRequestPathDiagnostics: ReleaseRuntimeRequestPathDiagnostics;
  releaseSigningProvider: ReleaseSigningProviderDiagnostics;
  evaluateSharedAuthorityRuntimeReadiness(input: {
    runtimeProfileId?: string | null;
    requestPathUsesSharedStores?: boolean;
  }): Promise<SharedAuthorityRuntimeReadiness>;
  evaluateProductionStoragePath(input: {
    runtimeProfileId?: string | null;
  }): ProductionStoragePathEvaluation;
  rlsActivationResult: {
    activated: boolean;
    policiesFound: number;
    tablesProtected: string[];
    error: string | null;
  };
}

export function registerCoreRoutes(app: Hono, deps: CoreRouteDeps): void {
  const {
    evaluateApiHighAvailabilityState,
    redisMode,
    asyncBackendMode,
    isSharedControlPlaneConfigured,
    serviceInstanceId,
    serviceVersion,
    startTime,
    domainRegistry,
    connectorRegistry,
    filingRegistry,
    pkiReady,
    pki,
    apiReleaseVerificationKeysPromise,
    runtimeProfileDiagnostics,
    releaseRuntimeRequestPathDiagnostics,
    releaseSigningProvider,
    evaluateSharedAuthorityRuntimeReadiness,
    evaluateProductionStoragePath,
    rlsActivationResult,
  } = deps;

  app.get('/api/v1/startup', (c) => {
    c.header('cache-control', 'no-store');
    return c.json({
      status: 'started',
      version: serviceVersion,
      instanceId: serviceInstanceId,
      uptime: Math.floor((Date.now() - startTime) / 1000),
      runtimeProfile: {
        id: runtimeProfileDiagnostics.profile.id,
        production: runtimeProfileDiagnostics.profile.production,
      },
      engine: 'attestor',
    });
  });

  app.get('/api/v1/health', async (c) => {
    c.header('cache-control', 'no-store');
    const highAvailability = evaluateApiHighAvailabilityState({
      redisMode: redisMode as 'external' | 'localhost' | 'embedded' | 'none' | 'unavailable',
      asyncBackendMode: asyncBackendMode as 'bullmq' | 'in_process' | 'none',
      sharedControlPlane: isSharedControlPlaneConfigured(),
      sharedBillingLedger: !!process.env.ATTESTOR_BILLING_LEDGER_PG_URL?.trim(),
    });
    const productionStoragePath = evaluateProductionStoragePath({
      runtimeProfileId: runtimeProfileDiagnostics.profile.id,
    });
    const shadowReadinessClaimAlignment = evaluateConsequenceShadowReadinessClaimAlignment({
      runtimeProfileId: runtimeProfileDiagnostics.profile.id,
      productionStoragePath,
    });
    return c.json({
      status: 'healthy',
      version: serviceVersion,
      instanceId: serviceInstanceId,
      uptime: Math.floor((Date.now() - startTime) / 1000),
      domains: domainRegistry.listIds(),
      connectors: connectorRegistry.listIds(),
      filingAdapters: filingRegistry.list().map((adapter) => adapter.id),
      pki: {
        ready: pkiReady,
        publicTrustRootRoute: '/api/v1/pki/ca',
      },
      tenantIsolation: {
        requestLevel: true,
        databaseRls: {
          schemaAvailable: true,
          configured: !!process.env.ATTESTOR_PG_URL,
          activated: rlsActivationResult.activated,
          policiesFound: rlsActivationResult.policiesFound,
          tablesProtected: rlsActivationResult.tablesProtected,
          error: rlsActivationResult.error,
        },
      },
      asyncBackend: { mode: asyncBackendMode, redisMode },
      runtimeProfile: runtimeProfileDiagnostics.profile,
      releaseRuntime: {
        diagnosticsVersion: runtimeProfileDiagnostics.version,
        durability: runtimeProfileDiagnostics.durability,
        stores: runtimeProfileDiagnostics.releaseStores,
        requestPath: releaseRuntimeRequestPathDiagnostics,
        signingProvider: releaseSigningProvider,
      },
      sharedAuthorityRuntime: await evaluateSharedAuthorityRuntimeReadiness({
        runtimeProfileId: runtimeProfileDiagnostics.profile.id,
        requestPathUsesSharedStores:
          releaseRuntimeRequestPathDiagnostics.usesSharedAuthorityStores,
      }),
      productionStoragePath,
      shadowReadinessClaimAlignment,
      highAvailability,
      engine: 'attestor',
    });
  });

  app.get('/api/v1/domains', (c) => {
    const domains = domainRegistry.list().map((domain) => ({
      id: domain.id,
      version: domain.version,
      displayName: domain.displayName,
      description: domain.description,
      clauseCount: domain.clauses.length,
      guardrailCount: domain.guardrails.length,
    }));
    return c.json({ domains });
  });

  app.get('/api/v1/connectors', async (c) => {
    const connectors = await Promise.all(
      connectorRegistry.list().map(async (connector) => ({
        id: connector.id,
        displayName: connector.displayName,
        configured: connector.loadConfig() !== null,
        available: await connector.isAvailable(),
      })),
    );
    return c.json({ connectors });
  });

  app.get('/api/v1/release-token/jwks', async (c) => {
    const verificationKeys = await apiReleaseVerificationKeysPromise;
    c.header('cache-control', 'no-store');
    return c.json(releaseTokenVerificationKeysToJwks(verificationKeys));
  });

  app.get('/api/v1/pki/ca', (c) => {
    c.header('cache-control', 'no-store');
    return c.json({
      version: 'attestor.release-runtime-ca-public-keys.v1',
      keys: [
        {
          keyId: pki.ca.certificate.fingerprint,
          algorithm: 'EdDSA',
          use: 'attestor-trust-root',
          publicKeyPem: pki.ca.keyPair.publicKeyPem,
          certificate: pki.ca.certificate,
        },
      ],
    });
  });

  app.get('/api/v1/ready', async (c) => {
    c.header('cache-control', 'no-store');
    const checks: Record<string, boolean> = {};
    let ready = true;
    const highAvailability = evaluateApiHighAvailabilityState({
      redisMode: redisMode as 'external' | 'localhost' | 'embedded' | 'none' | 'unavailable',
      asyncBackendMode: asyncBackendMode as 'bullmq' | 'in_process' | 'none',
      sharedControlPlane: isSharedControlPlaneConfigured(),
      sharedBillingLedger: !!process.env.ATTESTOR_BILLING_LEDGER_PG_URL?.trim(),
    });

    checks.asyncBackend = asyncBackendMode === 'bullmq' || asyncBackendMode === 'in_process';
    if (!checks.asyncBackend) ready = false;

    checks.pki = pkiReady;
    if (!checks.pki) ready = false;

    checks.releaseRuntime = runtimeProfileDiagnostics.durability.ready;
    if (!checks.releaseRuntime) ready = false;

    checks.releaseSigningProvider = releaseSigningProvider.productionProviderRequired
      ? releaseSigningProvider.productionReady
      : true;
    if (!checks.releaseSigningProvider) ready = false;

    const sharedAuthorityRuntime = await evaluateSharedAuthorityRuntimeReadiness({
      runtimeProfileId: runtimeProfileDiagnostics.profile.id,
      requestPathUsesSharedStores:
        releaseRuntimeRequestPathDiagnostics.usesSharedAuthorityStores,
    });
    checks.sharedAuthorityRuntime =
      runtimeProfileDiagnostics.profile.id === 'production-shared'
        ? sharedAuthorityRuntime.ready
        : true;
    if (!checks.sharedAuthorityRuntime) ready = false;

    const productionStoragePath = evaluateProductionStoragePath({
      runtimeProfileId: runtimeProfileDiagnostics.profile.id,
    });
    checks.productionStoragePath = productionStoragePath.readyForSelectedProfile;
    if (!checks.productionStoragePath) ready = false;

    const shadowReadinessClaimAlignment = evaluateConsequenceShadowReadinessClaimAlignment({
      runtimeProfileId: runtimeProfileDiagnostics.profile.id,
      productionStoragePath,
    });
    checks.shadowReadinessClaimAlignment =
      shadowReadinessClaimAlignment.readyForSelectedProfile;
    if (!checks.shadowReadinessClaimAlignment) ready = false;

    checks.domains = domainRegistry.listIds().length > 0;
    if (!checks.domains) ready = false;

    if (asyncBackendMode === 'bullmq') {
      checks.redis = redisMode !== 'unavailable' && redisMode !== 'none';
      if (!checks.redis) ready = false;
    }

    if (highAvailability.enabled || highAvailability.publicHosted) {
      checks.highAvailability = highAvailability.ready;
      if (!checks.highAvailability) ready = false;
    }

    const status = ready ? 200 : 503;
    return c.json({
      ready,
      checks,
      instanceId: serviceInstanceId,
      asyncBackendMode,
      redisMode,
      runtimeProfile: runtimeProfileDiagnostics.profile,
      releaseRuntime: {
        durability: runtimeProfileDiagnostics.durability,
        stores: runtimeProfileDiagnostics.releaseStores,
        requestPath: releaseRuntimeRequestPathDiagnostics,
        signingProvider: releaseSigningProvider,
      },
      sharedAuthorityRuntime,
      productionStoragePath,
      shadowReadinessClaimAlignment,
      highAvailability,
    }, status);
  });
}
