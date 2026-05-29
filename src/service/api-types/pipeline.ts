/**
 * Attestor service API pipeline types.
 *
 * This module is re-exported by ../api-types.ts for compatibility.
 */

import type { PipelineBillingMeteringResult, RateLimitContext, UsageContext } from './shared.js';

export interface SyncPipelineRunRequest {
  candidateSql: string;
  intent: Record<string, unknown>;
  sign?: boolean;
  fixtures?: Record<string, unknown>[];
  generatedReport?: Record<string, unknown>;
  reportContract?: Record<string, unknown>;
  connector?: string;
  reviewerOidcToken?: string;
  oidcIssuer?: string;
  oidcAudience?: string;
  reviewerName?: string;
  reviewerRole?: string;
  reviewerIdentifier?: string;
}

export interface SyncPipelineRunResponse {
  runId: string;
  decision: string;
  scoring: { scorersRun: number; decision: string };
  warrant: string;
  escrow: string;
  receipt: string | null;
  capsule: string | null;
  proofMode: string;
  auditEntries: number;
  auditChainIntact: boolean;
  certificate: Record<string, unknown> | null;
  verification: Record<string, unknown> | null;
  publicKeyPem: string | null;
  trustChain: Record<string, unknown> | null;
  caPublicKeyPem: string | null;
  signingMode: 'keyless' | null;
  connectorUsed: string | null;
  schemaAttestation: SchemaAttestationSummary | null;
  tenantContext: { tenantId: string; source: string; planId: string | null };
  usage: UsageContext;
  billingMetering: PipelineBillingMeteringResult | null;
  rateLimit: RateLimitContext;
  identitySource: 'operator_asserted' | 'oidc_verified' | 'pki_bound';
  reviewerName: string | null;
  filingExport: { adapterId: string; coveragePercent: number; mappedCount: number } | null;
  filingPackage: {
    adapterId: string;
    coveragePercent: number;
    mappedCount: number;
    issuedPackage: Record<string, unknown>;
  } | null;
}

// ─── Async Pipeline ─────────────────────────────────────────────────────────

export interface AsyncPipelineRunRequest {
  candidateSql: string;
  intent: Record<string, unknown>;
  sign?: boolean;
  fixtures?: Record<string, unknown>[];
  generatedReport?: Record<string, unknown>;
  reportContract?: Record<string, unknown>;
}

export interface AsyncPipelineSubmitResponse {
  jobId: string;
  status: 'queued';
  backendMode: 'bullmq' | 'in_process';
  submittedAt: string;
  tenantContext: { tenantId: string; source: string; planId: string | null };
  usage: UsageContext;
  billingMetering: PipelineBillingMeteringResult | null;
  rateLimit: RateLimitContext;
  asyncQueue: {
    tenantPendingJobs: number;
    tenantPendingLimit: number | null;
    tenantIsolationEnforced: boolean;
    tenantActiveExecutions: number;
    tenantActiveExecutionLimit: number | null;
    tenantActiveExecutionEnforced: boolean;
    tenantActiveExecutionBackend: 'memory' | 'redis';
    tenantWeightedDispatchEnforced: boolean;
    tenantWeightedDispatchBackend: 'memory' | 'redis';
    tenantWeightedDispatchWeight: number | null;
    tenantWeightedDispatchWindowMs: number | null;
    tenantWeightedDispatchNextEligibleAt: string | null;
    tenantWeightedDispatchWaitMs: number;
    retryPolicy: {
      attempts: number;
      backoffMs: number;
      maxStalledCount: number;
      workerConcurrency: number;
      completedTtlSeconds: number;
      failedTtlSeconds: number;
    };
  };
}

export interface AsyncPipelineStatusResponse {
  jobId: string;
  backendMode: 'bullmq' | 'in_process';
  status: 'queued' | 'running' | 'waiting' | 'active' | 'delayed' | 'prioritized' | 'completed' | 'failed';
  submittedAt: string | null;
  completedAt: string | null;
  result: {
    runId: string;
    decision: string;
    proofMode: string;
    certificateId: string | null;
    certificate: Record<string, unknown> | null;
    verification: Record<string, unknown> | null;
    publicKeyPem: string | null;
    trustChain: Record<string, unknown> | null;
    caPublicKeyPem: string | null;
  } | null;
  error: string | null;
  attemptsMade: number;
  maxAttempts: number;
  tenantContext: { tenantId: string; source: string; planId: string | null } | null;
  failedAt: string | null;
}

// ─── Verify ─────────────────────────────────────────────────────────────────

export interface VerifyRequest {
  certificate: Record<string, unknown>;
  publicKeyPem: string;
  trustChain?: Record<string, unknown>;
  caPublicKeyPem?: string;
  trustedCaFingerprint?: string;
}

export interface VerifyResponse {
  signatureValid: boolean;
  fingerprintConsistent: boolean;
  schemaValid: boolean;
  overall: 'valid' | 'invalid' | 'expired' | 'revoked' | 'schema_error';
  explanation: string;
  chainVerification: {
    caValid: boolean;
    leafValid: boolean;
    chainIntact: boolean;
    issuerMatch: boolean;
    caExpired: boolean;
    leafExpired: boolean;
    caRevoked: boolean;
    leafRevoked: boolean;
    leafMatchesCertificateKey: boolean;
    leafMatchesCertificateFingerprint: boolean;
    trustedCaFingerprintMatch: boolean;
    independentTrustRootVerified: boolean;
    pkiBound: boolean;
    overall: string;
    caName: string | null;
    leafSubject: string | null;
  } | null;
  trustBinding: {
    certificateSignature: boolean;
    chainValid: boolean;
    certificateBoundToLeaf: boolean;
    pkiVerified: boolean;
  };
}

// ─── Filing Export ──────────────────────────────────────────────────────────

export interface FilingExportRequest {
  adapterId: string;
  runId: string;
  decision?: string;
  certificateId?: string;
  evidenceChainTerminal?: string;
  rows: Record<string, unknown>[];
  proofMode?: string;
}

export interface FilingExportResponse {
  adapterId: string;
  format: string;
  taxonomyVersion: string;
  mapping: { mappedCount: number; unmappedCount: number; coveragePercent: number };
  package: Record<string, unknown>;
}

// ─── Schema Attestation ────────────────────────────────────────────────────

export interface SchemaAttestationSummary {
  present: boolean;
  scope: 'schema_attestation_full' | 'schema_attestation_connector' | 'execution_context_only';
  executionContextHash: string | null;
  provider: string | null;
  txidSnapshot: string | null;
  columnFingerprint: string | null;
  constraintFingerprint: string | null;
  indexFingerprint: string | null;
  schemaFingerprint: string | null;
  sentinelFingerprint: string | null;
  contentFingerprint: string | null;
  tableNames: string[] | null;
  attestationHash: string | null;
  tableFingerprints: Array<{
    tableName: string;
    rowCount: number;
    sampledRowCount: number;
    rowLimit: number;
    mode: 'full' | 'truncated' | 'unavailable';
    orderBy: string[];
    maxXmin: string | null;
    contentHash: string | null;
  }> | null;
  historicalComparison: {
    historyKey: string;
    previousCapturedAt: string;
    previousAttestationHash: string;
    currentAttestationHash: string;
    schemaChanged: boolean;
    dataChanged: boolean;
    contentChanged: boolean;
    summary: string;
  } | null;
}

// ─── Health ─────────────────────────────────────────────────────────────────
