import type { Context, Hono } from 'hono';
import {
  createConsequenceAdmissionProblem,
  createGenericAdmissionEnvelope,
} from '../../../consequence-admission/index.js';
import type { TenantContext } from '../../tenant-isolation.js';

export interface GenericAdmissionRouteDeps {
  currentTenant(context: Context): TenantContext;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function admissionPayloadWithTenant(payload: unknown, tenant: TenantContext): unknown {
  if (!isRecord(payload)) return payload;
  return {
    ...payload,
    tenantId: typeof payload.tenantId === 'string' ? payload.tenantId : tenant.tenantId,
    environment:
      typeof payload.environment === 'string' ? payload.environment : tenant.source,
  };
}

export function registerGenericAdmissionRoutes(
  app: Hono,
  deps: GenericAdmissionRouteDeps,
): void {
  app.post('/api/v1/admissions', async (c) => {
    c.header('cache-control', 'no-store');

    let payload: unknown;
    try {
      payload = await c.req.json<unknown>();
    } catch {
      const problem = createConsequenceAdmissionProblem({
        type: 'https://attestor.dev/problems/admission-json-invalid',
        title: 'Invalid admission JSON',
        status: 400,
        detail: 'The generic admission route requires a valid JSON object.',
        instance: '/api/v1/admissions',
        reasonCodes: ['invalid-json'],
      });
      return c.json(problem, 400);
    }

    try {
      const tenant = deps.currentTenant(c);
      return c.json(createGenericAdmissionEnvelope(
        admissionPayloadWithTenant(payload, tenant),
      ));
    } catch (error) {
      const detail =
        error instanceof Error
          ? error.message
          : 'The generic admission request could not be evaluated.';
      const problem = createConsequenceAdmissionProblem({
        type: 'https://attestor.dev/problems/admission-input-invalid',
        title: 'Invalid admission input',
        status: 400,
        detail,
        instance: '/api/v1/admissions',
        reasonCodes: ['invalid-admission-input'],
      });
      return c.json(problem, 400);
    }
  });
}
