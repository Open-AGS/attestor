import type * as ControlPlaneStore from '../control-plane-store.js';

export type PipelineIdempotencyResponseBody = Record<string, unknown>;

export interface PipelineIdempotencyBeginInput {
  idempotencyKey: string | null;
  tenantId: string;
  routeId: string;
  requestPayload: unknown;
}

export interface PipelineIdempotencyReadyResult {
  kind: 'ready';
  idempotencyKey: string | null;
  requestHash: string;
}

export interface PipelineIdempotencyReplayResult {
  kind: 'replay';
  statusCode: number;
  responseBody: unknown;
  headers: Record<string, string>;
}

export interface PipelineIdempotencyConflictResult {
  kind: 'conflict';
  statusCode: 409;
  responseBody: PipelineIdempotencyResponseBody;
}

export interface PipelineIdempotencyUnavailableResult {
  kind: 'unavailable';
  statusCode: 503;
  responseBody: PipelineIdempotencyResponseBody;
}

export type PipelineIdempotencyBeginResult =
  | PipelineIdempotencyReadyResult
  | PipelineIdempotencyReplayResult
  | PipelineIdempotencyConflictResult
  | PipelineIdempotencyUnavailableResult;

export interface PipelineIdempotencyFinalizationInput {
  idempotencyKey: string | null;
  tenantId: string;
  routeId: string;
  requestPayload: unknown;
  statusCode: number;
  responseBody: PipelineIdempotencyResponseBody;
}

export interface PipelineIdempotencyService {
  begin(input: PipelineIdempotencyBeginInput): Promise<PipelineIdempotencyBeginResult>;
  finalize(input: PipelineIdempotencyFinalizationInput): Promise<PipelineIdempotencyResponseBody>;
}

export interface PipelineIdempotencyServiceDeps {
  hashJsonValue(value: unknown): string;
  ensurePipelineIdempotencyStateReady: typeof ControlPlaneStore.ensurePipelineIdempotencyStateReady;
  lookupPipelineIdempotencyState: typeof ControlPlaneStore.lookupPipelineIdempotencyState;
  recordPipelineIdempotencyState: typeof ControlPlaneStore.recordPipelineIdempotencyState;
}

export function createPipelineIdempotencyService(
  deps: PipelineIdempotencyServiceDeps,
): PipelineIdempotencyService {
  return {
    async begin(input) {
      if (!input.idempotencyKey) {
        return {
          kind: 'ready',
          idempotencyKey: null,
          requestHash: deps.hashJsonValue({
            tenantId: input.tenantId,
            routeId: input.routeId,
            payload: input.requestPayload,
          }),
        };
      }

      try {
        deps.ensurePipelineIdempotencyStateReady();
      } catch {
        return {
          kind: 'unavailable',
          statusCode: 503,
          responseBody: {
            error: 'Pipeline idempotency store is not configured.',
          },
        };
      }
      const lookup = await deps.lookupPipelineIdempotencyState({
        idempotencyKey: input.idempotencyKey,
        tenantId: input.tenantId,
        routeId: input.routeId,
        requestPayload: input.requestPayload,
      });

      if (lookup.kind === 'conflict') {
        return {
          kind: 'conflict',
          statusCode: 409,
          responseBody: {
            error: 'Idempotency-Key was already used for a different pipeline request.',
            routeId: lookup.record.routeId,
            createdAt: lookup.record.createdAt,
          },
        };
      }

      if (lookup.kind === 'replay') {
        return {
          kind: 'replay',
          statusCode: lookup.record.statusCode,
          responseBody: lookup.response,
          headers: {
            'content-type': 'application/json; charset=UTF-8',
            'x-attestor-idempotent-replay': 'true',
            'x-attestor-idempotency-key': input.idempotencyKey,
          },
        };
      }

      return {
        kind: 'ready',
        idempotencyKey: input.idempotencyKey,
        requestHash: lookup.requestHash,
      };
    },

    async finalize(input) {
      if (input.idempotencyKey) {
        await deps.recordPipelineIdempotencyState({
          idempotencyKey: input.idempotencyKey,
          tenantId: input.tenantId,
          routeId: input.routeId,
          requestPayload: input.requestPayload,
          statusCode: input.statusCode,
          response: input.responseBody,
        });
      }
      return input.responseBody;
    },
  };
}
