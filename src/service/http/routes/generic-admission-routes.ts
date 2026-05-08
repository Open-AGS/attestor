import type { Context, Hono } from 'hono';
import {
  createConsequenceAdmissionProblem,
  createGenericAdmissionEnvelope,
  type ConsequenceAdmissionAgentLoopAbuseGuardDecision,
  type GenericAdmissionEnvelope,
} from '../../../consequence-admission/index.js';
import { resolvePlanGenericAdmissionMode } from '../../plan-catalog.js';
import type { TenantContext } from '../../tenant-isolation.js';

export interface GenericAdmissionRouteDeps {
  currentTenant(context: Context): TenantContext;
  recordShadowAdmission?(input: {
    readonly tenant: TenantContext;
    readonly envelope: GenericAdmissionEnvelope;
  }): void;
  evaluateAgentLoopAbuse?(input: {
    readonly tenant: TenantContext;
    readonly envelope: GenericAdmissionEnvelope;
    readonly receivedAt: string;
  }): ConsequenceAdmissionAgentLoopAbuseGuardDecision;
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
      const envelope = createGenericAdmissionEnvelope(
        admissionPayloadWithTenant(payload, tenant),
      );
      const modePolicy = resolvePlanGenericAdmissionMode(tenant.planId, envelope.mode);
      if (!modePolicy.allowed) {
        const problem = createConsequenceAdmissionProblem({
          type: 'https://attestor.dev/problems/admission-plan-mode-restricted',
          title: 'Admission mode not available on plan',
          status: 403,
          detail: `Plan ${modePolicy.planId} only allows ${modePolicy.allowedModes.join(', ')} admission modes; requested ${modePolicy.mode}.`,
          instance: '/api/v1/admissions',
          reasonCodes: modePolicy.reasonCodes,
        });
        return c.json(problem, 403);
      }
      const loopGuard = deps.evaluateAgentLoopAbuse?.({
        tenant,
        envelope,
        receivedAt: new Date().toISOString(),
      });
      if (loopGuard && !loopGuard.allowed) {
        if (loopGuard.retryAfterSeconds > 0) {
          c.header('retry-after', String(loopGuard.retryAfterSeconds));
        }
        const status = loopGuard.outcome === 'throttle' ? 429 : 409;
        const problem = createConsequenceAdmissionProblem({
          type: 'https://attestor.dev/problems/agent-loop-abuse-guard',
          title: 'Agent loop held',
          status,
          detail: loopGuard.reason,
          instance: '/api/v1/admissions',
          reasonCodes: [
            'agent-loop-abuse-guard',
            ...loopGuard.reasonCodes,
          ],
        });
        return c.json(problem, status);
      }
      try {
        deps.recordShadowAdmission?.({ tenant, envelope });
      } catch (error) {
        const detail =
          error instanceof Error
            ? error.message
            : 'The shadow admission event could not be recorded.';
        const problem = createConsequenceAdmissionProblem({
          type: 'https://attestor.dev/problems/shadow-recording-unavailable',
          title: 'Shadow recording unavailable',
          status: 503,
          detail,
          instance: '/api/v1/admissions',
          reasonCodes: ['shadow-recording-unavailable'],
        });
        return c.json(problem, 503);
      }
      return c.json(envelope);
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
