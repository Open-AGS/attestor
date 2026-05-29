import type { Context, Hono } from 'hono';
import {
  createShadowPolicySimulationReport,
  GENERIC_ADMISSION_MODES,
  type GenericAdmissionMode,
} from '../../../consequence-admission/index.js';
import { acceptsJsonRequestBody } from '../route-response-helpers.js';
import {
  beginShadowMutationIdempotency,
  finalizeShadowMutationIdempotency,
  recordShadowMutationAudit,
} from './shadow-mutation-route-helpers.js';
import type { ShadowRouteDeps } from './shadow-routes.js';
import {
  assertTenantBoundRecord,
  assertTenantBoundRecords,
  boundedErrorDetail,
  caughtErrorStatus,
  isRecord,
  problem,
  shadowListPage,
  tenantSummary,
} from './shadow-route-helpers.js';

function parseGenericMode(value: string | null | undefined): GenericAdmissionMode | null {
  if (value === undefined || value === null || value.trim() === '') return null;
  const normalized = value.trim();
  return GENERIC_ADMISSION_MODES.includes(normalized as GenericAdmissionMode)
    ? normalized as GenericAdmissionMode
    : null;
}

async function readSimulationRequestBody(c: Context): Promise<{
  readonly proposedMode: GenericAdmissionMode;
  readonly minimumPromotionEvents: number | null;
} | Response> {
  if (!acceptsJsonRequestBody(c)) {
    return problem(c, {
      type: 'https://attestor.dev/problems/shadow-simulation-json-required',
      title: 'Shadow simulation JSON required',
      status: 415,
      detail: 'The shadow simulation route requires Content-Type: application/json.',
      reasonCodes: ['shadow-simulation-json-required'],
    });
  }

  let body: unknown;
  try {
    body = await c.req.json<unknown>();
  } catch {
    return problem(c, {
      type: 'https://attestor.dev/problems/shadow-simulation-json-invalid',
      title: 'Invalid shadow simulation JSON',
      status: 400,
      detail: 'The shadow simulation route requires a valid JSON object when a body is provided.',
      reasonCodes: ['invalid-json'],
    });
  }
  if (!isRecord(body)) {
    return problem(c, {
      type: 'https://attestor.dev/problems/shadow-simulation-input-invalid',
      title: 'Invalid shadow simulation input',
      status: 400,
      detail: 'The shadow simulation route requires an object body when a body is provided.',
      reasonCodes: ['invalid-shadow-simulation-input'],
    });
  }

  const proposedMode = typeof body.proposedMode === 'string'
    ? parseGenericMode(body.proposedMode)
    : null;
  if (body.proposedMode === undefined || body.proposedMode === null) {
    return problem(c, {
      type: 'https://attestor.dev/problems/shadow-simulation-mode-required',
      title: 'Shadow simulation mode required',
      status: 400,
      detail: `proposedMode is required and must be one of: ${GENERIC_ADMISSION_MODES.join(', ')}.`,
      reasonCodes: ['shadow-simulation-mode-required'],
    });
  }
  if (!proposedMode) {
    return problem(c, {
      type: 'https://attestor.dev/problems/shadow-simulation-mode-invalid',
      title: 'Invalid shadow simulation mode',
      status: 400,
      detail: `proposedMode must be one of: ${GENERIC_ADMISSION_MODES.join(', ')}.`,
      reasonCodes: ['invalid-shadow-simulation-mode'],
    });
  }

  const minimumPromotionEvents = body.minimumPromotionEvents === undefined || body.minimumPromotionEvents === null
    ? null
    : Number(body.minimumPromotionEvents);
  if (
    minimumPromotionEvents !== null &&
    (!Number.isInteger(minimumPromotionEvents) || minimumPromotionEvents <= 0 || minimumPromotionEvents > 10_000)
  ) {
    return problem(c, {
      type: 'https://attestor.dev/problems/shadow-simulation-input-invalid',
      title: 'Invalid shadow simulation input',
      status: 400,
      detail: 'minimumPromotionEvents must be a positive integer no larger than 10000.',
      reasonCodes: ['invalid-shadow-simulation-input'],
    });
  }

  return {
    proposedMode,
    minimumPromotionEvents,
  };
}

export function registerShadowSimulationHistoryRoutes(app: Hono, deps: ShadowRouteDeps): void {
  app.post('/api/v1/shadow/simulations', async (c) => {
    c.header('cache-control', 'no-store');
    const body = await readSimulationRequestBody(c);
    if (body instanceof Response) return body;
    if (!deps.recordShadowPolicySimulationReport) {
      return problem(c, {
        type: 'https://attestor.dev/problems/shadow-simulation-store-unavailable',
        title: 'Shadow simulation store unavailable',
        status: 503,
        detail: 'Shadow simulation persistence is not configured for this runtime.',
        reasonCodes: ['shadow-simulation-store-unavailable'],
      });
    }

    try {
      const routeId = 'shadow.simulations.create';
      const requestPayload = {
        proposedMode: body.proposedMode,
        minimumPromotionEvents: body.minimumPromotionEvents,
      };
      const idempotency = await beginShadowMutationIdempotency(c, deps, routeId, requestPayload);
      if (idempotency.kind === 'response') return idempotency.response;
      const { tenant } = idempotency;
      const events = assertTenantBoundRecords(
        tenant,
        deps.listShadowEvents({ tenant }),
        'shadow admission event',
        { allowNullTenantId: true },
      );
      const report = createShadowPolicySimulationReport({
        events,
        proposedMode: body.proposedMode,
        minimumPromotionEvents: body.minimumPromotionEvents,
        generatedAt: deps.now?.() ?? null,
      });
      const persisted = deps.recordShadowPolicySimulationReport({
        tenant,
        report,
      });
      const persistedRecord = assertTenantBoundRecord(
        tenant,
        persisted.record,
        'shadow simulation',
      );
      await recordShadowMutationAudit(deps, {
        routeId,
        action: 'shadow.simulation.recorded',
        tenant,
        requestPayload,
        statusCode: 200,
        metadata: {
          persistenceKind: persisted.kind,
          reportId: persistedRecord.reportId,
          reportDigest: persistedRecord.reportDigest,
          eventCount: persistedRecord.eventCount,
        },
      });
      const responseBody = await finalizeShadowMutationIdempotency(
        deps,
        tenant,
        routeId,
        requestPayload,
        idempotency.ready,
        200,
        {
          tenant: tenantSummary(tenant),
          storageMode: 'file-backed-evaluation',
          productionReady: false,
          rawPayloadStored: false,
          report,
          persisted: {
            kind: persisted.kind,
            record: persistedRecord,
          },
        },
      );
      return c.json(responseBody);
    } catch (error) {
      const status = caughtErrorStatus(error, {
        statusMarkers: [{ marker: 'exceeds maximum', status: 400 }],
        defaultStatus: 503,
      });
      return problem(c, {
        type: 'https://attestor.dev/problems/shadow-simulation-record-failed',
        title: 'Shadow simulation record failed',
        status,
        detail: boundedErrorDetail(error, 'The shadow simulation report could not be recorded.', {
          safeMarkers: ['exceeds maximum'],
          safeDetail: 'The shadow simulation request exceeds the supported event bound.',
        }),
        reasonCodes: ['shadow-simulation-record-failed'],
      });
    }
  });

  app.get('/api/v1/shadow/simulations', (c) => {
    c.header('cache-control', 'no-store');
    if (!deps.listShadowPolicySimulationReports) {
      return problem(c, {
        type: 'https://attestor.dev/problems/shadow-simulation-store-unavailable',
        title: 'Shadow simulation store unavailable',
        status: 503,
        detail: 'Shadow simulation listing is not configured for this runtime.',
        reasonCodes: ['shadow-simulation-store-unavailable'],
      });
    }
    const modeQuery = c.req.query('proposedMode');
    const proposedMode = parseGenericMode(modeQuery);
    if (modeQuery && !proposedMode) {
      return problem(c, {
        type: 'https://attestor.dev/problems/shadow-simulation-mode-invalid',
        title: 'Invalid shadow simulation mode',
        status: 400,
        detail: `proposedMode must be one of: ${GENERIC_ADMISSION_MODES.join(', ')}.`,
        reasonCodes: ['invalid-shadow-simulation-mode'],
      });
    }
    try {
      const tenant = deps.currentTenant(c);
      const records = assertTenantBoundRecords(
        tenant,
        deps.listShadowPolicySimulationReports({ tenant, proposedMode }),
        'shadow simulation',
      );
      const page = shadowListPage(c, records, 'Shadow simulation');
      if (page instanceof Response) return page;
      return c.json({
        tenant: tenantSummary(tenant),
        storageMode: 'file-backed-evaluation',
        recordCount: page.records.length,
        pageInfo: page.pageInfo,
        rawPayloadStored: false,
        productionReady: false,
        records: page.records,
      });
    } catch (error) {
      return problem(c, {
        type: 'https://attestor.dev/problems/shadow-simulation-list-failed',
        title: 'Shadow simulation list failed',
        status: 503,
        detail: boundedErrorDetail(error, 'The shadow simulation reports could not be listed.'),
        reasonCodes: ['shadow-simulation-list-failed'],
      });
    }
  });

  app.get('/api/v1/shadow/simulations/:reportId', (c) => {
    c.header('cache-control', 'no-store');
    if (!deps.findShadowPolicySimulationReport) {
      return problem(c, {
        type: 'https://attestor.dev/problems/shadow-simulation-store-unavailable',
        title: 'Shadow simulation store unavailable',
        status: 503,
        detail: 'Shadow simulation lookup is not configured for this runtime.',
        reasonCodes: ['shadow-simulation-store-unavailable'],
      });
    }
    try {
      const tenant = deps.currentTenant(c);
      const record = deps.findShadowPolicySimulationReport({
        tenant,
        reportId: c.req.param('reportId'),
      });
      if (!record) {
        return problem(c, {
          type: 'https://attestor.dev/problems/shadow-simulation-not-found',
          title: 'Shadow simulation not found',
          status: 404,
          detail: 'No shadow simulation report was found for this tenant and report id.',
          reasonCodes: ['shadow-simulation-not-found'],
        });
      }
      const tenantRecord = assertTenantBoundRecord(tenant, record, 'shadow simulation');
      return c.json({
        tenant: tenantSummary(tenant),
        storageMode: 'file-backed-evaluation',
        rawPayloadStored: false,
        productionReady: false,
        record: tenantRecord,
      });
    } catch (error) {
      return problem(c, {
        type: 'https://attestor.dev/problems/shadow-simulation-load-failed',
        title: 'Shadow simulation load failed',
        status: 503,
        detail: boundedErrorDetail(error, 'The shadow simulation report could not be loaded.'),
        reasonCodes: ['shadow-simulation-load-failed'],
      });
    }
  });
}
