/**
 * Attestor service API shared context types.
 *
 * This module is re-exported by ../api-types.ts for compatibility.
 */

export interface UsageContext {
  tenantId: string;
  planId: string;
  meter: 'monthly_admission_runs';
  period: string;
  used: number;
  quota: number | null;
  remaining: number | null;
  enforced: boolean;
  hardLimit: boolean;
  overage: boolean;
  overageUnits: number;
}

export interface PipelineBillingMeteringResult {
  provider: 'stripe';
  status: 'not_applicable' | 'skipped' | 'mock_recorded' | 'sent' | 'failed';
  reason: string | null;
  eventName: string | null;
  eventIdentifier: string | null;
  value: number;
  mock: boolean;
}

export interface RateLimitContext {
  tenantId: string;
  planId: string;
  scope: 'pipeline_requests';
  backend: 'memory' | 'redis';
  windowSeconds: number;
  requestsPerWindow: number | null;
  used: number;
  remaining: number | null;
  enforced: boolean;
  resetAt: string;
  retryAfterSeconds: number;
}

// ─── Route Constants ────────────────────────────────────────────────────────
