import type { Context, Hono } from 'hono';
import {
  createConsequenceAdmissionProblem,
  createGenericAdmissionEnvelope,
  evaluateGenericAdmissionProtectedReleaseTokenRequirement,
  GenericAdmissionProtectedReleaseTokenIssuanceError,
  type ConsequenceAdmissionAgentLoopAbuseGuardDecision,
  type GenericAdmissionProtectedReleaseTokenIssueResult,
  type GenericAdmissionEnvelope,
} from '../../../consequence-admission/index.js';
import type {
  ReleaseTokenConfirmationClaim,
} from '../../../release-layer/index.js';
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
  }): ConsequenceAdmissionAgentLoopAbuseGuardDecision | Promise<ConsequenceAdmissionAgentLoopAbuseGuardDecision>;
  issueProtectedReleaseToken?(input: {
    readonly context: Context;
    readonly tenant: TenantContext;
    readonly envelope: GenericAdmissionEnvelope;
    readonly receivedAt: string;
    readonly senderConfirmation?: ReleaseTokenConfirmationClaim | null;
  }): GenericAdmissionProtectedReleaseTokenIssueResult | Promise<GenericAdmissionProtectedReleaseTokenIssueResult>;
  resolveProtectedReleaseTokenConfirmation?(input: {
    readonly context: Context;
    readonly tenant: TenantContext;
    readonly envelope: GenericAdmissionEnvelope;
    readonly receivedAt: string;
  }): ReleaseTokenConfirmationClaim | null | Promise<ReleaseTokenConfirmationClaim | null>;
  readonly requireProtectedReleaseTokenForHighRisk?: boolean;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function admissionPayloadWithTenant(payload: unknown, tenant: TenantContext): unknown {
  if (!isRecord(payload)) return payload;
  if (typeof payload.tenantId === 'string') {
    const requestedTenantId = payload.tenantId.trim();
    if (requestedTenantId && requestedTenantId !== tenant.tenantId) {
      throw new GenericAdmissionTenantScopeMismatchError();
    }
  }
  return {
    ...payload,
    tenantId: tenant.tenantId,
    environment:
      typeof payload.environment === 'string' ? payload.environment : tenant.source,
  };
}

class GenericAdmissionTenantScopeMismatchError extends Error {
  constructor() {
    super('Admission tenantId must match the authenticated tenant context.');
    this.name = 'GenericAdmissionTenantScopeMismatchError';
  }
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
      let envelope: GenericAdmissionEnvelope;
      try {
        envelope = createGenericAdmissionEnvelope(
          admissionPayloadWithTenant(payload, tenant),
        );
      } catch (error) {
        if (error instanceof GenericAdmissionTenantScopeMismatchError) {
          const problem = createConsequenceAdmissionProblem({
            type: 'https://attestor.dev/problems/admission-tenant-scope-mismatch',
            title: 'Admission tenant scope mismatch',
            status: 403,
            detail: error.message,
            instance: '/api/v1/admissions',
            reasonCodes: ['tenant-scope-mismatch'],
          });
          return c.json(problem, 403);
        }
        throw error;
      }
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
      let loopGuard: ConsequenceAdmissionAgentLoopAbuseGuardDecision | undefined;
      try {
        loopGuard = await deps.evaluateAgentLoopAbuse?.({
          tenant,
          envelope,
          receivedAt: new Date().toISOString(),
        });
      } catch (error) {
        const detail =
          error instanceof Error
            ? error.message
            : 'The agent loop abuse guard could not evaluate the admission.';
        const problem = createConsequenceAdmissionProblem({
          type: 'https://attestor.dev/problems/agent-loop-abuse-guard-unavailable',
          title: 'Agent loop abuse guard unavailable',
          status: 503,
          detail,
          instance: '/api/v1/admissions',
          reasonCodes: ['agent-loop-abuse-guard-unavailable'],
        });
        return c.json(problem, 503);
      }
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
      const protectedReleaseTokenRequirement =
        evaluateGenericAdmissionProtectedReleaseTokenRequirement({ envelope });
      let envelopeForShadow: GenericAdmissionEnvelope = envelope;
      let responseEnvelope: GenericAdmissionEnvelope | (GenericAdmissionEnvelope & {
        readonly protectedReleaseTokenAuthorization?: GenericAdmissionProtectedReleaseTokenIssueResult['authorization'];
      }) = envelope;
      if (protectedReleaseTokenRequirement.required && deps.issueProtectedReleaseToken) {
        try {
          const receivedAt = new Date().toISOString();
          const senderConfirmation =
            await deps.resolveProtectedReleaseTokenConfirmation?.({
              context: c,
              tenant,
              envelope,
              receivedAt,
            }) ?? null;
          const issued = await deps.issueProtectedReleaseToken({
            context: c,
            tenant,
            envelope,
            receivedAt,
            senderConfirmation,
          });
          envelopeForShadow = issued.envelope;
          responseEnvelope = {
            ...issued.envelope,
            protectedReleaseTokenAuthorization: issued.authorization,
          };
        } catch (error) {
          const reasonCodes = error instanceof GenericAdmissionProtectedReleaseTokenIssuanceError
            ? [
                'protected-release-token-issuance-unavailable',
                ...error.reasonCodes,
              ]
            : ['protected-release-token-issuance-unavailable'];
          const detail =
            error instanceof Error
              ? error.message
              : 'The protected release-token issuer could not issue a token.';
          const problem = createConsequenceAdmissionProblem({
            type: 'https://attestor.dev/problems/protected-release-token-issuance-unavailable',
            title: 'Protected release-token issuance unavailable',
            status: 503,
            detail,
            instance: '/api/v1/admissions',
            reasonCodes,
          });
          return c.json(problem, 503);
        }
      } else if (
        protectedReleaseTokenRequirement.required &&
        deps.requireProtectedReleaseTokenForHighRisk
      ) {
        const problem = createConsequenceAdmissionProblem({
          type: 'https://attestor.dev/problems/protected-release-token-issuer-missing',
          title: 'Protected release-token issuer missing',
          status: 503,
          detail:
            'This admission requires a protected sender-constrained release token, but no issuer was configured for the generic admission route.',
          instance: '/api/v1/admissions',
          reasonCodes: [
            'protected-release-token-required',
            'protected-release-token-issuer-missing',
          ],
        });
        return c.json(problem, 503);
      }
      try {
        deps.recordShadowAdmission?.({ tenant, envelope: envelopeForShadow });
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
      return c.json(responseEnvelope);
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
