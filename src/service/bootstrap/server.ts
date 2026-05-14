import { serve } from '@hono/node-server';
import type { Hono } from 'hono';
import { evaluateApiHighAvailabilityState } from '../high-availability.js';
import {
  forceFlushTelemetry,
  initializeTelemetry,
  shutdownTelemetry,
} from '../observability.js';
import { shutdownHostedEmailDelivery } from '../email-delivery.js';
import { isSharedControlPlaneConfigured } from '../control-plane-store.js';
import {
  asyncBackendMode,
  configureTenantRuntimeBackends,
  redisMode,
  shutdownTenantRuntimeBackends,
} from '../runtime/tenant-runtime.js';
import { ATTESTOR_SERVICE_VERSION } from '../version.js';

export interface HttpServerHandle {
  port: number;
  close(): void;
}

export interface HttpServerStartupDiagnostics {
  runtimeProfileDiagnostics?: {
    profile: {
      id: string;
      label: string;
      production: boolean;
    };
    releaseStores: readonly {
      component: string;
      mode: string;
    }[];
    durability: {
      ready: boolean;
      summary: string;
    };
  };
  productionStoragePath?: {
    readonly readyForSelectedProfile: boolean;
    readonly blockers?: readonly {
      readonly code: string;
      readonly component: string;
      readonly message: string;
    }[];
  };
}

export interface StartHttpServerOptions {
  startupDiagnostics?: HttpServerStartupDiagnostics;
}

type HonoNodeServer = ReturnType<typeof serve>;

function closeServer(server: HonoNodeServer): void {
  const maybeClosable = server as { close?: unknown };
  if (typeof maybeClosable.close === 'function') {
    maybeClosable.close();
  }
}

function logTelemetryStartup(telemetry: ReturnType<typeof initializeTelemetry>): void {
  if (telemetry.traces.enabled && telemetry.traces.endpoint) {
    console.log(`[telemetry] OTLP traces enabled (${telemetry.traces.protocol}) -> ${telemetry.traces.endpoint}`);
  }
  if (telemetry.metrics.enabled && telemetry.metrics.endpoint) {
    console.log(`[telemetry] OTLP metrics enabled (${telemetry.metrics.protocol}) -> ${telemetry.metrics.endpoint} @ ${telemetry.metrics.exportIntervalMillis ?? 1000}ms`);
  }
  if (!telemetry.traces.enabled && !telemetry.metrics.enabled && telemetry.disabledReason) {
    console.log(`[telemetry] Disabled: ${telemetry.disabledReason}`);
  }
}

function logRuntimeStartupDiagnostics(
  diagnostics?: HttpServerStartupDiagnostics,
): void {
  const runtime = diagnostics?.runtimeProfileDiagnostics;
  if (!runtime) return;

  const storeModes = runtime.releaseStores
    .map((store) => `${store.component}=${store.mode}`)
    .join(', ');
  console.log(
    `[runtime] profile=${runtime.profile.id} (${runtime.profile.label}), production=${runtime.profile.production}, durability=${runtime.durability.ready ? 'ready' : 'not-ready'}`,
  );
  console.log(`[runtime] ${runtime.durability.summary}`);
  console.log(`[runtime] release stores: ${storeModes}`);
}

function assertProductionSharedStartupStorageReady(
  diagnostics?: HttpServerStartupDiagnostics,
): void {
  if (diagnostics?.runtimeProfileDiagnostics?.profile.id !== 'production-shared') {
    return;
  }
  const storagePath = diagnostics.productionStoragePath;
  if (!storagePath || storagePath.readyForSelectedProfile) {
    return;
  }

  const blockerText = (storagePath.blockers ?? [])
    .map((blocker) => `${blocker.component}:${blocker.code}`)
    .join(', ');
  throw new Error(
    `Production-shared startup storage gate failed: ${blockerText || 'production storage path is not ready'}`,
  );
}

export function startHttpServer(
  app: Hono,
  port: number = 3700,
  options: StartHttpServerOptions = {},
): HttpServerHandle {
  assertProductionSharedStartupStorageReady(options.startupDiagnostics);

  const telemetry = initializeTelemetry(ATTESTOR_SERVICE_VERSION);
  configureTenantRuntimeBackends();

  const highAvailability = evaluateApiHighAvailabilityState({
    redisMode: redisMode as 'external' | 'localhost' | 'embedded' | 'none' | 'unavailable',
    asyncBackendMode: asyncBackendMode as 'bullmq' | 'in_process' | 'none',
    sharedControlPlane: isSharedControlPlaneConfigured(),
    sharedBillingLedger: !!process.env.ATTESTOR_BILLING_LEDGER_PG_URL?.trim(),
  });

  if (!highAvailability.ready) {
    if (highAvailability.enabled) {
      throw new Error(`ATTESTOR_HA_MODE startup guard failed for instance '${highAvailability.instanceId}': ${highAvailability.issues.join(' ')}`);
    }
    if (highAvailability.publicHosted) {
      throw new Error(`Public hosted startup guard failed for instance '${highAvailability.instanceId}': ${highAvailability.issues.join(' ')}`);
    }
  }
  if (highAvailability.enabled) {
    console.log(`[ha] Multi-node first slice enabled for instance '${highAvailability.instanceId}' (redis=${highAvailability.redisMode}, sharedControlPlane=${highAvailability.sharedControlPlane}, sharedBillingLedger=${highAvailability.sharedBillingLedger})`);
  }

  logTelemetryStartup(telemetry);
  logRuntimeStartupDiagnostics(options.startupDiagnostics);

  const server = serve({ fetch: app.fetch, port });
  return {
    port,
    close: () => {
      void forceFlushTelemetry().catch(() => {});
      shutdownHostedEmailDelivery();
      closeServer(server);
      void shutdownTenantRuntimeBackends().catch(() => {});
      void shutdownTelemetry().catch(() => {});
    },
  };
}

export function installGracefulShutdown(handle: HttpServerHandle): void {
  const shutdown = (signal: NodeJS.Signals) => {
    console.log(`[attestor] ${signal} received - shutting down gracefully...`);
    handle.close();
    setTimeout(() => {
      console.log('[attestor] Force exit after timeout');
      process.exit(0);
    }, 5000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
