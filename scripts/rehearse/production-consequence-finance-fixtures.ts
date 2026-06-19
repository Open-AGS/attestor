import {
  type FinancePipelineAdmissionRun,
} from '../../src/consequence-admission/index.js';

export function financeRun(input: {
  readonly runId: string;
  readonly decision: string;
  readonly certificateId?: string;
  readonly proofMode?: string;
  readonly auditChainIntact?: boolean;
  readonly releaseDecisionStatus?: string;
  readonly reviewQueueId?: string;
  readonly tokenId?: string;
  readonly evidencePackId?: string;
}): FinancePipelineAdmissionRun {
  return {
    runId: input.runId,
    decision: input.decision,
    proofMode: input.proofMode ?? (input.decision === 'pass' ? 'live_runtime' : 'missing_evidence'),
    warrant: input.decision === 'pass' ? 'issued' : 'missing',
    escrow: input.decision === 'pass' ? 'released' : 'held',
    receipt: input.decision === 'pass' ? 'issued' : 'missing',
    capsule: input.decision === 'pass' ? 'closed' : 'open',
    auditChainIntact: input.auditChainIntact ?? input.decision === 'pass',
    certificate: input.certificateId
      ? {
          certificateId: input.certificateId,
          signing: {
            fingerprint: `fingerprint:${input.certificateId}`,
          },
        }
      : null,
    verification: input.certificateId
      ? {
          digest: `sha256:${input.certificateId}`,
        }
      : null,
    tenantContext: {
      tenantId: 'tenant_production_rehearsal',
      source: 'production-rehearsal',
      planId: 'trial',
    },
    release: input.releaseDecisionStatus
      ? {
          filingExport: {
            targetId: 'finance.reporting.record-store',
            decisionId: `decision:${input.runId}`,
            decisionStatus: input.releaseDecisionStatus,
            policyVersion: 'finance.structured-record-release.v1',
            introspectionRequired: true,
            outputHash: `sha256:output:${input.runId}`,
            consequenceHash: `sha256:consequence:${input.runId}`,
            tokenId: input.tokenId,
            expiresAt: '2026-04-28T12:05:00.000Z',
            evidencePackId: input.evidencePackId,
            evidencePackDigest: input.evidencePackId ? `sha256:${input.evidencePackId}` : null,
            evidencePackPath: input.evidencePackId ? `release-evidence-pack://${input.evidencePackId}` : null,
            reviewQueueId: input.reviewQueueId,
            reviewQueuePath: input.reviewQueueId ? `release-review://${input.reviewQueueId}` : null,
          },
        }
      : null,
  };
}

export function makeFinanceReport(overrides: Record<string, unknown> = {}): any {
  return {
    runId: 'production-rehearsal-finance-release',
    timestamp: '2026-04-28T12:00:00.000Z',
    decision: 'pending_approval',
    certificate: { certificateId: 'cert_production_rehearsal_finance_release' },
    evidenceChain: { terminalHash: `sha256:${'d'.repeat(64)}`, intact: true },
    execution: {
      success: true,
      rows: [
        {
          counterparty_name: 'Bank of Nova Scotia',
          exposure_usd: 250000000,
          credit_rating: 'AA-',
          sector: 'Banking',
        },
        {
          counterparty_name: 'BNP Paribas',
          exposure_usd: 185000000,
          credit_rating: 'A+',
          sector: 'Banking',
        },
      ],
    },
    liveProof: {
      mode: 'live_runtime',
      consistent: true,
    },
    receipt: {
      receiptStatus: 'withheld',
    },
    oversight: {
      status: 'pending',
    },
    escrow: {
      state: 'held',
    },
    filingReadiness: {
      status: 'internal_report_ready',
    },
    audit: {
      chainIntact: true,
    },
    attestation: {
      manifestHash: 'manifest_hash_production_rehearsal',
    },
    ...overrides,
  };
}
