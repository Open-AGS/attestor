import {
  Hono,
  equal,
  ok,
  registerGenericAdmissionRoutes,
  validAdmissionPayload,
} from './helpers.js';
import type {
  PipelineIdempotencyService,
} from '../../src/service/application/pipeline-idempotency-service.js';

function fakeAdmissionIdempotencyService() {
  const records = new Map<string, {
    readonly requestHash: string;
    readonly statusCode: number;
    readonly responseBody: Record<string, unknown>;
  }>();
  const keyFor = (tenantId: string, routeId: string, idempotencyKey: string): string =>
    `${tenantId}:${routeId}:${idempotencyKey}`;
  const hashFor = (value: unknown): string => JSON.stringify(value);

  const service: PipelineIdempotencyService = {
    async begin(input) {
      const requestHash = hashFor(input.requestPayload);
      if (!input.idempotencyKey) {
        return {
          kind: 'ready',
          idempotencyKey: null,
          requestHash,
        };
      }
      const key = keyFor(input.tenantId, input.routeId, input.idempotencyKey);
      const existing = records.get(key);
      if (!existing) {
        return {
          kind: 'ready',
          idempotencyKey: input.idempotencyKey,
          requestHash,
        };
      }
      if (existing.requestHash !== requestHash) {
        return {
          kind: 'conflict',
          statusCode: 409,
          responseBody: {
            error: 'fake admission idempotency conflict',
          },
        };
      }
      return {
        kind: 'replay',
        statusCode: existing.statusCode,
        responseBody: existing.responseBody,
        headers: {
          'content-type': 'application/json; charset=UTF-8',
          'x-attestor-idempotent-replay': 'true',
          'x-attestor-idempotency-key': input.idempotencyKey,
        },
      };
    },
    async finalize(input) {
      if (input.idempotencyKey) {
        records.set(keyFor(input.tenantId, input.routeId, input.idempotencyKey), {
          requestHash: hashFor(input.requestPayload),
          statusCode: input.statusCode,
          responseBody: input.responseBody,
        });
      }
      return input.responseBody;
    },
  };

  return service;
}

function idempotencyApp(options: {
  readonly requireAdmissionIdempotencyKeyForEnforce?: boolean;
  readonly recordShadowAdmission?: () => void;
} = {}): Hono {
  const app = new Hono();
  registerGenericAdmissionRoutes(app, {
    currentTenant: () => ({
      tenantId: 'tenant_route',
      tenantName: 'Route Tenant',
      authenticatedAt: '2026-05-01T18:00:00.000Z',
      source: 'api_key',
      planId: 'custom-route-test-plan',
      monthlyRunQuota: 100,
    }),
    recordShadowAdmission: options.recordShadowAdmission ?? (() => {}),
    admissionIdempotencyService: fakeAdmissionIdempotencyService(),
    requireAdmissionIdempotencyKeyForEnforce:
      options.requireAdmissionIdempotencyKeyForEnforce,
  });
  return app;
}

async function testAdmissionIdempotencyReplaysWithoutDuplicatingShadow(): Promise<void> {
  let shadowRecords = 0;
  const app = idempotencyApp({
    recordShadowAdmission: () => {
      shadowRecords += 1;
    },
  });
  const request = {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'Idempotency-Key': 'generic-admission-replay-1',
    },
    body: JSON.stringify(validAdmissionPayload()),
  };

  const first = await app.request('/api/v1/admissions', request);
  const second = await app.request('/api/v1/admissions', request);
  const firstBody = await first.json() as { admission: { admissionId: string } };
  const secondText = await second.text();
  const secondBody = JSON.parse(secondText) as { admission: { admissionId: string } };

  equal(first.status, 200, 'Generic admission route: first idempotent admission succeeds');
  equal(second.status, 200, 'Generic admission route: idempotent admission replay succeeds');
  equal(second.headers.get('x-attestor-idempotent-replay'), 'true', 'Generic admission route: replay header is set');
  equal(second.headers.get('x-attestor-idempotency-key'), null, 'Generic admission route: raw idempotency key is not echoed');
  equal(secondBody.admission.admissionId, firstBody.admission.admissionId, 'Generic admission route: replay returns stored admission');
  equal(shadowRecords, 1, 'Generic admission route: replay does not duplicate shadow recording');
  ok(
    !secondText.includes('generic-admission-replay-1'),
    'Generic admission route: replay body does not expose raw idempotency key',
  );
}

async function testAdmissionIdempotencyRejectsSameKeyDifferentPayload(): Promise<void> {
  let shadowRecords = 0;
  const app = idempotencyApp({
    recordShadowAdmission: () => {
      shadowRecords += 1;
    },
  });
  const key = 'generic-admission-conflict-1';
  const first = await app.request('/api/v1/admissions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify(validAdmissionPayload()),
  });
  const conflict = await app.request('/api/v1/admissions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify(validAdmissionPayload({ amount: { value: 39000, currency: 'HUF' } })),
  });
  const conflictText = await conflict.text();
  const conflictBody = JSON.parse(conflictText) as { reasonCodes: readonly string[] };

  equal(first.status, 200, 'Generic admission route: first conflict fixture request succeeds');
  equal(conflict.status, 409, 'Generic admission route: same key with different payload conflicts');
  ok(
    conflictBody.reasonCodes.includes('admission-idempotency-conflict'),
    'Generic admission route: idempotency conflict reason is explicit',
  );
  equal(shadowRecords, 1, 'Generic admission route: conflict does not duplicate shadow recording');
  equal(conflict.headers.get('x-attestor-idempotency-key'), null, 'Generic admission route: conflict does not echo raw key');
  ok(!conflictText.includes(key), 'Generic admission route: conflict body does not expose raw idempotency key');
}

async function testEnforceAdmissionCanRequireIdempotencyKey(): Promise<void> {
  let shadowRecords = 0;
  const app = idempotencyApp({
    requireAdmissionIdempotencyKeyForEnforce: true,
    recordShadowAdmission: () => {
      shadowRecords += 1;
    },
  });
  const response = await app.request('/api/v1/admissions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(validAdmissionPayload()),
  });
  const body = await response.json() as { reasonCodes: readonly string[] };

  equal(response.status, 428, 'Generic admission route: enforce can require Idempotency-Key');
  ok(
    body.reasonCodes.includes('admission-idempotency-key-required'),
    'Generic admission route: missing idempotency key reason is explicit',
  );
  equal(shadowRecords, 0, 'Generic admission route: missing idempotency key stops before shadow recording');
}

export async function runIdempotencyRouteTests(): Promise<void> {
  await testAdmissionIdempotencyReplaysWithoutDuplicatingShadow();
  await testAdmissionIdempotencyRejectsSameKeyDifferentPayload();
  await testEnforceAdmissionCanRequireIdempotencyKey();
}
