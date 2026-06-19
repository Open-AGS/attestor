import type { Span } from '@opentelemetry/api';

export type TraceContextStatus = 'present' | 'absent' | 'invalid';
export type BillingWebhookMetricOutcome = 'applied' | 'ignored' | 'duplicate' | 'conflict' | 'signature_invalid';

export interface RequestTraceContext {
  traceId: string;
  parentSpanId: string | null;
  spanId: string;
  traceFlags: string;
  incomingStatus: TraceContextStatus;
  responseTraceparent: string;
  span: Span | null;
}

export interface BeginRequestTraceInput {
  method: string;
  path: string;
  url: string;
  remoteAddress: string | null;
  userAgent: string | null;
  serverAddress: string | null;
  serverPort: number | null;
}

export interface CompleteRequestTraceInput {
  route: string;
  method: string;
  path: string;
  statusCode: number;
  durationSeconds: number;
  tenantId: string | null;
  planId: string | null;
  accountId: string | null;
  accountStatus: string | null;
  rateLimited: boolean;
  quotaRejected: boolean;
  remoteAddress: string | null;
  userAgent: string | null;
  error?: unknown;
}

export interface HttpObservation {
  route: string;
  method: string;
  statusCode: number;
  durationSeconds: number;
  traceContextStatus: TraceContextStatus;
}

export interface StructuredRequestLogRecord {
  occurredAt: string;
  route: string;
  path: string;
  method: string;
  statusCode: number;
  durationMs: number;
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  traceFlags: string;
  tenantId: string | null;
  planId: string | null;
  accountId: string | null;
  accountStatus: string | null;
  rateLimited: boolean;
  quotaRejected: boolean;
  remoteAddress: string | null;
  userAgent: string | null;
}

export interface PrivacySafeStructuredRequestLogRecord {
  occurredAt: string;
  route: string;
  rawPathOmitted: true;
  method: string;
  statusCode: number;
  durationMs: number;
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  traceFlags: string;
  tenantPresent: boolean;
  planId: string | null;
  accountPresent: boolean;
  accountStatus: string | null;
  rateLimited: boolean;
  quotaRejected: boolean;
  clientAddressPresent: boolean;
  userAgentPresent: boolean;
}

export interface DurationHistogramState {
  count: number;
  sum: number;
  bucketCounts: number[];
}

export interface ParsedTraceparent {
  traceId: string;
  parentSpanId: string;
  traceFlags: string;
}

export interface TelemetryConfig {
  serviceName: string;
  serviceVersion: string;
  serviceInstanceId: string;
  logs: {
    enabled: boolean;
    protocol: string | null;
    endpoint: string | null;
    headers: Record<string, string>;
    timeoutMillis: number | null;
    disabledReason: string | null;
  };
  traces: {
    enabled: boolean;
    protocol: string | null;
    endpoint: string | null;
    headers: Record<string, string>;
    timeoutMillis: number | null;
    disabledReason: string | null;
  };
  metrics: {
    enabled: boolean;
    protocol: string | null;
    endpoint: string | null;
    headers: Record<string, string>;
    timeoutMillis: number | null;
    exportIntervalMillis: number | null;
    disabledReason: string | null;
  };
}

export interface TelemetrySignalStatus {
  enabled: boolean;
  protocol: string | null;
  endpoint: string | null;
  timeoutMillis: number | null;
  disabledReason: string | null;
}

export interface TelemetryMetricsStatus extends TelemetrySignalStatus {
  exportIntervalMillis: number | null;
}

export interface TelemetryStatus {
  enabled: boolean;
  serviceName: string;
  serviceVersion: string;
  serviceInstanceId: string;
  disabledReason: string | null;
  logs: TelemetrySignalStatus;
  traces: TelemetrySignalStatus;
  metrics: TelemetryMetricsStatus;
}

export interface RuntimeTruthMetrics {
  runtimeProfile: string | null;
  releaseRuntimeReady: boolean | null;
  requestPathContract: string | null;
  requestPathUsesSharedStores: boolean | null;
}
