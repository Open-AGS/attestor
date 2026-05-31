import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  createFinancePipelineAdmissionResponse,
  evaluateConsequenceAdmissionGate,
  type FinancePipelineAdmissionRun,
} from '../../src/consequence-admission/index.js';
import {
  buildFinanceFilingReleaseMaterial,
  buildFinanceFilingReleaseObservation,
  createFinanceFilingReleaseCandidateFromReport,
  finalizeFinanceFilingReleaseDecision,
} from '../../src/release-kernel/finance-record-release.js';
import { createReleaseDecisionEngine } from '../../src/release-kernel/release-decision-engine.js';
import { createInMemoryReleaseDecisionLogWriter } from '../../src/release-kernel/release-decision-log.js';
import {
  introspectReleaseToken,
  type AwaitableReleaseTokenIntrospectionStore,
} from '../../src/release-kernel/release-introspection.js';
import {
  createReleaseTokenIssuer,
  verifyIssuedReleaseToken,
} from '../../src/release-kernel/release-token.js';
import {
  createReleaseEvidencePackIssuer,
  verifyIssuedReleaseEvidencePack,
  type IssuedReleaseEvidencePack,
} from '../../src/release-kernel/release-evidence-pack.js';
import {
  applyReviewerDecision,
  attachIssuedTokenToReviewerQueueRecord,
  createFinanceReviewerQueueItem,
  type ReleaseReviewerQueueDetail,
  type ReleaseReviewerQueueListOptions,
  type ReleaseReviewerQueueListResult,
  type ReleaseReviewerQueueRecord,
} from '../../src/release-kernel/reviewer-queue.js';
import { generateKeyPair } from '../../src/signing/keys.js';
import { createSharedReleaseTokenIntrospectionStore } from '../../src/service/release/release-token-introspection-store.js';
import { createSharedReleaseEvidencePackStore } from '../../src/service/release/release-evidence-pack-store.js';
import {
  createSharedReleaseReviewerQueueStore,
  type SharedReleaseReviewerQueueClaim,
  type SharedReleaseReviewerQueueClaimInput,
} from '../../src/service/release/release-reviewer-queue-store.js';

type CheckStatus = 'pass' | 'fail' | 'skip';
type Environment = Readonly<Record<string, string | undefined>>;
type StoreMode = 'shared-authority' | 'injected-test-store';

interface TargetProfile {
  readonly profileId: string;
  readonly targetEnvironment: {
    readonly provider: string;
    readonly namespace: string;
  };
  readonly runtime: {
    readonly profile: string;
    readonly requireSharedAuthority: boolean;
    readonly noLocalFallback: boolean;
    readonly sharedAuthorityContract: string;
  };
}

interface SubstrateSummary {
  readonly profileId: string;
  readonly readiness: {
    readonly passed: boolean;
    readonly state: string;
    readonly issues: readonly string[];
  };
  readonly target: {
    readonly provider: string;
    readonly namespace: string;
    readonly publicHostname: string | null;
  };
}

interface EvidencePackStore {
  upsert(pack: IssuedReleaseEvidencePack): IssuedReleaseEvidencePack | Promise<IssuedReleaseEvidencePack>;
  get(id: string): IssuedReleaseEvidencePack | null | Promise<IssuedReleaseEvidencePack | null>;
}

interface ReviewerQueueStore {
  upsert(record: ReleaseReviewerQueueRecord): ReleaseReviewerQueueDetail | Promise<ReleaseReviewerQueueDetail>;
  get(id: string): ReleaseReviewerQueueDetail | null | Promise<ReleaseReviewerQueueDetail | null>;
  getRecord(id: string): ReleaseReviewerQueueRecord | null | Promise<ReleaseReviewerQueueRecord | null>;
  listPending(options?: ReleaseReviewerQueueListOptions): ReleaseReviewerQueueListResult | Promise<ReleaseReviewerQueueListResult>;
  claimNextPending(input: SharedReleaseReviewerQueueClaimInput): SharedReleaseReviewerQueueClaim | null | Promise<SharedReleaseReviewerQueueClaim | null>;
  releaseClaim(input: { readonly reviewId: string; readonly claimToken: string }): boolean | Promise<boolean>;
}

export interface ProductionConsequenceBehaviorStores {
  readonly tokenIntrospection: AwaitableReleaseTokenIntrospectionStore;
  readonly evidencePack: EvidencePackStore;
  readonly reviewerQueue: ReviewerQueueStore;
  readonly mode: StoreMode;
}

export interface ProductionConsequenceBehaviorCheck {
  readonly id: string;
  readonly status: CheckStatus;
  readonly detail: string;
  readonly evidence?: unknown;
}

interface BehaviorSummary {
  readonly admittedGate: {
    readonly decision: string;
    readonly outcome: string;
    readonly proofRefCount: number;
  };
  readonly blockedGate: {
    readonly decision: string;
    readonly outcome: string;
    readonly failClosed: boolean;
    readonly proofRefCount: number;
  };
  readonly reviewGate: {
    readonly decision: string;
    readonly outcome: string;
    readonly failClosed: boolean;
  };
  readonly token: {
    readonly issuedTokenId: string;
    readonly activeBeforeUse: boolean;
    readonly consumedInactiveReason: string | null;
    readonly revokedInactiveReason: string | null;
  };
  readonly reviewerQueue: {
    readonly reviewId: string;
    readonly claimTokenSeen: boolean;
    readonly firstApprovalStatus: string;
    readonly finalStatus: string;
    readonly finalDecisionStatus: string;
  };
  readonly evidencePack: {
    readonly evidencePackId: string;
    readonly bundleDigest: string;
    readonly verified: boolean;
    readonly stored: boolean;
  };
}

export interface ProductionConsequenceBehaviorSummary {
  readonly generatedAt: string;
  readonly profileId: string;
  readonly readiness: {
    readonly state:
      | 'passed-core-consequence-rehearsal'
      | 'blocked-on-target-prerequisites'
      | 'failed-core-consequence-rehearsal';
    readonly passed: boolean;
    readonly issues: readonly string[];
  };
  readonly target: {
    readonly provider: string;
    readonly namespace: string;
    readonly publicHostname: string | null;
  };
  readonly stores: {
    readonly mode: StoreMode;
    readonly requestPathContract: string;
  };
  readonly artifacts: {
    readonly outputDir: string;
    readonly summaryPath: string;
    readonly readmePath: string;
  };
  readonly checks: readonly ProductionConsequenceBehaviorCheck[];
  readonly behavior: BehaviorSummary | null;
  readonly nonClaims: readonly string[];
}

function arg(name: string, fallback?: string): string | undefined {
  const prefixed = `--${name}=`;
  const found = process.argv.find((entry) => entry.startsWith(prefixed));
  if (found) return found.slice(prefixed.length);
  return fallback;
}

function envValue(env: Environment, name: string): string | null {
  const value = env[name];
  return value && value.trim() ? value.trim() : null;
}

function pass(id: string, detail: string, evidence?: unknown): ProductionConsequenceBehaviorCheck {
  return { id, status: 'pass', detail, evidence };
}

function fail(id: string, detail: string, evidence?: unknown): ProductionConsequenceBehaviorCheck {
  return { id, status: 'fail', detail, evidence };
}

function skip(id: string, detail: string, evidence?: unknown): ProductionConsequenceBehaviorCheck {
  return { id, status: 'skip', detail, evidence };
}

function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(path), 'utf8')) as T;
}

function readTargetProfile(path: string): TargetProfile {
  return readJsonFile<TargetProfile>(path);
}

function tryReadSubstrateSummary(path: string): SubstrateSummary | null {
  try {
    return readJsonFile<SubstrateSummary>(path);
  } catch {
    return null;
  }
}

function targetPrerequisiteChecks(input: {
  readonly env: Environment;
  readonly profile: TargetProfile;
  readonly substrateSummary: SubstrateSummary | null;
}): ProductionConsequenceBehaviorCheck[] {
  const checks: ProductionConsequenceBehaviorCheck[] = [];
  const profileIssues: string[] = [];
  if (input.profile.profileId !== 'gke-production-rehearsal') {
    profileIssues.push(`unexpected profile id: ${input.profile.profileId}`);
  }
  if (input.profile.runtime.profile !== 'production-shared') {
    profileIssues.push('target profile must use production-shared');
  }
  if (!input.profile.runtime.requireSharedAuthority) {
    profileIssues.push('target profile must require shared authority');
  }
  if (!input.profile.runtime.noLocalFallback) {
    profileIssues.push('target profile must disable local fallback');
  }
  if (input.profile.runtime.sharedAuthorityContract !== 'async-shared-authority-stores') {
    profileIssues.push('target profile must use async-shared-authority-stores');
  }
  checks.push(
    profileIssues.length === 0
      ? pass('target-profile-contract', 'Target profile pins production-shared async shared authority stores')
      : fail('target-profile-contract', profileIssues.join(' ')),
  );

  const envIssues: string[] = [];
  if (envValue(input.env, 'ATTESTOR_RUNTIME_PROFILE') !== 'production-shared') {
    envIssues.push('ATTESTOR_RUNTIME_PROFILE must be production-shared');
  }
  if (!envValue(input.env, 'ATTESTOR_RELEASE_AUTHORITY_PG_URL')) {
    envIssues.push('ATTESTOR_RELEASE_AUTHORITY_PG_URL is required for shared release authority');
  }
  checks.push(
    envIssues.length === 0
      ? pass('shared-authority-env', 'Runtime env selects production-shared release authority')
      : fail('shared-authority-env', envIssues.join(' ')),
  );

  if (!input.substrateSummary) {
    checks.push(fail('substrate-readiness-prerequisite', 'Step 05 substrate readiness summary is missing'));
  } else if (!input.substrateSummary.readiness.passed) {
    checks.push(
      fail(
        'substrate-readiness-prerequisite',
        `Step 05 substrate readiness is ${input.substrateSummary.readiness.state}`,
        { issues: input.substrateSummary.readiness.issues },
      ),
    );
  } else {
    checks.push(
      pass('substrate-readiness-prerequisite', 'Step 05 substrate readiness passed for the named target', {
        state: input.substrateSummary.readiness.state,
      }),
    );
  }

  return checks;
}

function defaultStores(): ProductionConsequenceBehaviorStores {
  return {
    tokenIntrospection: createSharedReleaseTokenIntrospectionStore(),
    evidencePack: createSharedReleaseEvidencePackStore(),
    reviewerQueue: createSharedReleaseReviewerQueueStore(),
    mode: 'shared-authority',
  };
}

function financeRun(input: {
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
      planId: 'enterprise',
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

function makeFinanceReport(overrides: Record<string, unknown> = {}): any {
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

async function runCoreBehavior(
  stores: ProductionConsequenceBehaviorStores,
): Promise<{
  readonly checks: readonly ProductionConsequenceBehaviorCheck[];
  readonly behavior: BehaviorSummary;
}> {
  const checks: ProductionConsequenceBehaviorCheck[] = [];
  const admittedAdmission = createFinancePipelineAdmissionResponse({
    run: financeRun({
      runId: 'production_rehearsal_admit',
      decision: 'pass',
      certificateId: 'cert_production_rehearsal_admit',
      releaseDecisionStatus: 'accepted',
      tokenId: 'rt_production_rehearsal_admit',
      evidencePackId: 'ep_production_rehearsal_admit',
    }),
    decidedAt: '2026-04-28T12:00:00.000Z',
  });
  const admittedGate = evaluateConsequenceAdmissionGate({
    admission: admittedAdmission,
    downstreamAction: 'customer_reporting_store.write',
    requireProof: true,
  });
  checks.push(
    admittedAdmission.decision === 'admit' &&
      admittedGate.outcome === 'proceed' &&
      admittedGate.proofRefs.length > 0
      ? pass('admitted-downstream-gate', 'Admitted consequence proceeds with proof references', {
          admissionId: admittedAdmission.admissionId,
          proofRefs: admittedGate.proofRefs.length,
        })
      : fail('admitted-downstream-gate', 'Admitted consequence did not proceed with proof references'),
  );

  const blockedAdmission = createFinancePipelineAdmissionResponse({
    run: financeRun({
      runId: 'production_rehearsal_block',
      decision: 'fail',
      auditChainIntact: false,
    }),
    decidedAt: '2026-04-28T12:00:10.000Z',
  });
  const blockedGate = evaluateConsequenceAdmissionGate({
    admission: blockedAdmission,
    downstreamAction: 'customer_message_sender.send',
    requireProof: false,
  });
  checks.push(
    blockedAdmission.decision === 'block' &&
      blockedGate.outcome === 'hold' &&
      blockedGate.failClosed &&
      blockedGate.proofRefs.length === 0
      ? pass('blocked-downstream-gate', 'Blocked consequence fails closed and does not proceed')
      : fail('blocked-downstream-gate', 'Blocked consequence did not fail closed'),
  );

  const reviewAdmission = createFinancePipelineAdmissionResponse({
    run: financeRun({
      runId: 'production_rehearsal_review',
      decision: 'pending-review',
      auditChainIntact: true,
      releaseDecisionStatus: 'hold',
      reviewQueueId: 'review_production_rehearsal_review',
    }),
    decidedAt: '2026-04-28T12:00:20.000Z',
  });
  const reviewGate = evaluateConsequenceAdmissionGate({
    admission: reviewAdmission,
    downstreamAction: 'filing_export.submit',
    requireProof: false,
  });
  checks.push(
    reviewAdmission.decision === 'review' &&
      reviewGate.outcome === 'hold' &&
      reviewGate.failClosed
      ? pass('review-hold-downstream-gate', 'Review-required consequence holds before downstream execution')
      : fail('review-hold-downstream-gate', 'Review-required consequence did not hold'),
  );

  const report = makeFinanceReport();
  const candidate = createFinanceFilingReleaseCandidateFromReport(report);
  if (!candidate) throw new Error('Production consequence rehearsal could not build a finance release candidate.');

  const material = buildFinanceFilingReleaseMaterial(candidate);
  const decisionLog = createInMemoryReleaseDecisionLogWriter();
  const engine = createReleaseDecisionEngine({ decisionLog });
  const evaluation = engine.evaluateWithDeterministicChecks(
    {
      id: 'production-rehearsal-release-decision',
      createdAt: report.timestamp,
      outputHash: material.hashBundle.outputHash,
      consequenceHash: material.hashBundle.consequenceHash,
      outputContract: material.outputContract,
      capabilityBoundary: material.capabilityBoundary,
      requester: {
        id: 'svc.attestor.production-rehearsal',
        type: 'service',
        displayName: 'Attestor Production Rehearsal',
      },
      target: material.target,
    },
    buildFinanceFilingReleaseObservation(material, report),
  );
  const heldDecision = finalizeFinanceFilingReleaseDecision(evaluation.decision, report);
  const queueItem = createFinanceReviewerQueueItem({
    decision: heldDecision,
    candidate,
    report,
    logEntries: decisionLog.entries(),
  });
  await stores.reviewerQueue.upsert(queueItem);
  const pendingList = await stores.reviewerQueue.listPending({ riskClass: 'R4', limit: 1 });
  const claimed = await stores.reviewerQueue.claimNextPending({
    riskClass: 'R4',
    claimedBy: 'production-rehearsal-operator',
    claimedAt: '2026-04-28T12:00:30.000Z',
    leaseMs: 120000,
  });
  if (!claimed) throw new Error('Production consequence rehearsal could not claim a reviewer queue item.');
  await stores.reviewerQueue.releaseClaim({
    reviewId: claimed.record.detail.id,
    claimToken: claimed.claimToken,
  });

  const firstApproval = applyReviewerDecision({
    record: claimed.record,
    outcome: 'approved',
    reviewerId: 'reviewer.alpha',
    reviewerName: 'Alpha Reviewer',
    reviewerRole: 'financial_reporting_manager',
    decidedAt: '2026-04-28T12:01:00.000Z',
    note: 'Production rehearsal first approval.',
  });
  await stores.reviewerQueue.upsert(firstApproval.record);
  const secondApproval = applyReviewerDecision({
    record: firstApproval.record,
    outcome: 'approved',
    reviewerId: 'reviewer.beta',
    reviewerName: 'Beta Reviewer',
    reviewerRole: 'financial_reporting_manager',
    decidedAt: '2026-04-28T12:02:00.000Z',
    note: 'Production rehearsal second approval.',
  });
  await stores.reviewerQueue.upsert(secondApproval.record);

  checks.push(
    pendingList.totalPending >= 1 &&
      claimed.claimToken.length > 0 &&
      firstApproval.record.detail.status === 'pending-review' &&
      secondApproval.record.detail.status === 'approved' &&
      secondApproval.record.releaseDecision.status === 'accepted'
      ? pass('reviewer-queue-claim', 'Reviewer queue item was listed, claimed, released, and closed by dual approval', {
          reviewId: secondApproval.record.detail.id,
        })
      : fail('reviewer-queue-claim', 'Reviewer queue claim or approval closure did not complete'),
  );

  decisionLog.append({
    occurredAt: '2026-04-28T12:01:00.000Z',
    requestId: 'production-rehearsal-review-alpha',
    phase: 'review',
    matchedPolicyId: secondApproval.record.releaseDecision.policyVersion,
    decision: secondApproval.record.releaseDecision,
    metadata: {
      policyMatched: true,
      pendingChecks: [],
      pendingEvidenceKinds: [],
      requiresReview: true,
      deterministicChecksCompleted: true,
      effectivePolicyId: secondApproval.record.releaseDecision.policyVersion,
      rolloutMode: null,
      rolloutEvaluationMode: null,
      rolloutReason: null,
      rolloutCanaryBucket: null,
      rolloutFallbackPolicyId: null,
    },
  });
  decisionLog.append({
    occurredAt: '2026-04-28T12:02:00.000Z',
    requestId: 'production-rehearsal-terminal-accept',
    phase: 'terminal-accept',
    matchedPolicyId: secondApproval.record.releaseDecision.policyVersion,
    decision: secondApproval.record.releaseDecision,
    metadata: {
      policyMatched: true,
      pendingChecks: [],
      pendingEvidenceKinds: [],
      requiresReview: false,
      deterministicChecksCompleted: true,
      effectivePolicyId: secondApproval.record.releaseDecision.policyVersion,
      rolloutMode: null,
      rolloutEvaluationMode: null,
      rolloutReason: null,
      rolloutCanaryBucket: null,
      rolloutFallbackPolicyId: null,
    },
  });

  const signingKeys = generateKeyPair();
  const tokenIssuer = createReleaseTokenIssuer({
    issuer: 'attestor.production-rehearsal',
    privateKeyPem: signingKeys.privateKeyPem,
    publicKeyPem: signingKeys.publicKeyPem,
  });
  const verificationKey = await tokenIssuer.exportVerificationKey();
  const issuedToken = await tokenIssuer.issue({
    decision: secondApproval.record.releaseDecision,
    issuedAt: '2026-04-28T12:02:10.000Z',
    tokenId: 'rt_production_rehearsal_release',
  });
  const releaseTokenAudience = secondApproval.record.releaseDecision.target.id;
  await verifyIssuedReleaseToken({
    token: issuedToken.token,
    verificationKey,
    audience: releaseTokenAudience,
    currentDate: '2026-04-28T12:02:20.000Z',
  });
  await stores.tokenIntrospection.registerIssuedToken({
    issuedToken,
    decision: secondApproval.record.releaseDecision,
  });
  const activeBeforeUse = await introspectReleaseToken({
    token: issuedToken.token,
    verificationKey,
    audience: releaseTokenAudience,
    currentDate: '2026-04-28T12:02:20.000Z',
    resourceServerId: 'production-rehearsal-downstream-gate',
    store: stores.tokenIntrospection,
  });
  const firstUse = await stores.tokenIntrospection.recordTokenUse({
    tokenId: issuedToken.tokenId,
    usedAt: '2026-04-28T12:02:30.000Z',
    resourceServerId: 'production-rehearsal-downstream-gate',
  });
  const consumed = await introspectReleaseToken({
    token: issuedToken.token,
    verificationKey,
    audience: releaseTokenAudience,
    currentDate: '2026-04-28T12:02:40.000Z',
    resourceServerId: 'production-rehearsal-downstream-gate',
    store: stores.tokenIntrospection,
  });
  const revokedToken = await tokenIssuer.issue({
    decision: secondApproval.record.releaseDecision,
    issuedAt: '2026-04-28T12:02:10.000Z',
    tokenId: 'rt_production_rehearsal_revoked',
  });
  await stores.tokenIntrospection.registerIssuedToken({
    issuedToken: revokedToken,
    decision: secondApproval.record.releaseDecision,
  });
  await stores.tokenIntrospection.revokeToken({
    tokenId: revokedToken.tokenId,
    revokedAt: '2026-04-28T12:02:35.000Z',
    reason: 'production rehearsal revocation check',
    revokedBy: 'production-rehearsal-operator',
  });
  const revoked = await introspectReleaseToken({
    token: revokedToken.token,
    verificationKey,
    audience: releaseTokenAudience,
    currentDate: '2026-04-28T12:02:40.000Z',
    resourceServerId: 'production-rehearsal-downstream-gate',
    store: stores.tokenIntrospection,
  });

  checks.push(
    activeBeforeUse.active === true &&
      firstUse.accepted === true &&
      consumed.active === false &&
      !consumed.active &&
      consumed.inactive_reason === 'usage_exhausted' &&
      revoked.active === false &&
      !revoked.active &&
      revoked.inactive_reason === 'revoked'
      ? pass('release-token-introspection-revocation-replay', 'Token active, revocation, and single-use replay exhaustion behaved fail-closed', {
          issuedTokenId: issuedToken.tokenId,
          revokedTokenId: revokedToken.tokenId,
        })
      : fail('release-token-introspection-revocation-replay', 'Token lifecycle did not enforce active/revoked/consumed states'),
  );

  const recordWithToken = attachIssuedTokenToReviewerQueueRecord({
    record: secondApproval.record,
    issuedToken,
  });
  const evidenceIssuer = createReleaseEvidencePackIssuer({
    issuer: 'attestor.production-rehearsal',
    privateKeyPem: signingKeys.privateKeyPem,
    publicKeyPem: signingKeys.publicKeyPem,
  });
  const issuedEvidencePack = await evidenceIssuer.issue({
    decision: {
      ...recordWithToken.releaseDecision,
      evidencePackId: 'ep_production_rehearsal_release',
    },
    evidencePackId: 'ep_production_rehearsal_release',
    issuedAt: '2026-04-28T12:03:00.000Z',
    decisionLogEntries: decisionLog.entries().filter((entry) => entry.decisionId === recordWithToken.releaseDecision.id),
    decisionLogChainIntact: decisionLog.verify().valid,
    review: recordWithToken.detail,
    releaseToken: issuedToken,
    artifactReferences: [
      {
        kind: 'provenance',
        path: 'finance-evidence-chain://production-rehearsal-finance-release',
        digest: report.evidenceChain.terminalHash,
      },
    ],
  });
  const evidenceVerification = verifyIssuedReleaseEvidencePack({
    issuedEvidencePack,
    verificationKey: issuedEvidencePack.verificationKey,
  });
  await stores.evidencePack.upsert(issuedEvidencePack);
  const storedEvidencePack = await stores.evidencePack.get(issuedEvidencePack.evidencePack.id);
  checks.push(
    evidenceVerification.valid &&
      storedEvidencePack?.bundleDigest === issuedEvidencePack.bundleDigest
      ? pass('release-evidence-pack-export', 'Evidence pack exported, verified, and round-tripped through the authority store', {
          evidencePackId: issuedEvidencePack.evidencePack.id,
          bundleDigest: issuedEvidencePack.bundleDigest,
        })
      : fail('release-evidence-pack-export', 'Evidence pack export did not verify or round-trip'),
  );

  return {
    checks,
    behavior: {
      admittedGate: {
        decision: admittedAdmission.decision,
        outcome: admittedGate.outcome,
        proofRefCount: admittedGate.proofRefs.length,
      },
      blockedGate: {
        decision: blockedAdmission.decision,
        outcome: blockedGate.outcome,
        failClosed: blockedGate.failClosed,
        proofRefCount: blockedGate.proofRefs.length,
      },
      reviewGate: {
        decision: reviewAdmission.decision,
        outcome: reviewGate.outcome,
        failClosed: reviewGate.failClosed,
      },
      token: {
        issuedTokenId: issuedToken.tokenId,
        activeBeforeUse: activeBeforeUse.active,
        consumedInactiveReason: consumed.active ? null : consumed.inactive_reason,
        revokedInactiveReason: revoked.active ? null : revoked.inactive_reason,
      },
      reviewerQueue: {
        reviewId: secondApproval.record.detail.id,
        claimTokenSeen: claimed.claimToken.length > 0,
        firstApprovalStatus: firstApproval.record.detail.status,
        finalStatus: secondApproval.record.detail.status,
        finalDecisionStatus: secondApproval.record.releaseDecision.status,
      },
      evidencePack: {
        evidencePackId: issuedEvidencePack.evidencePack.id,
        bundleDigest: issuedEvidencePack.bundleDigest,
        verified: evidenceVerification.valid,
        stored: storedEvidencePack?.bundleDigest === issuedEvidencePack.bundleDigest,
      },
    },
  };
}

function renderReadme(summary: ProductionConsequenceBehaviorSummary): string {
  const checkLines = summary.checks
    .map((check) => `- ${check.status.toUpperCase()} ${check.id}: ${check.detail}`)
    .join('\n');
  const issueLines = summary.readiness.issues.length
    ? summary.readiness.issues.map((issue) => `- ${issue}`).join('\n')
    : '- none';
  return `# Production rehearsal consequence behavior

Generated at:

- ${summary.generatedAt}

Profile:

- ${summary.profileId}
- provider: ${summary.target.provider}
- namespace: ${summary.target.namespace}
- public hostname: ${summary.target.publicHostname ?? 'not configured'}
- store mode: ${summary.stores.mode}
- request path contract: ${summary.stores.requestPathContract}

Readiness:

- state: ${summary.readiness.state}
- passed: ${summary.readiness.passed}

Checks:

${checkLines}

Issues:

${issueLines}

Non-claims:

${summary.nonClaims.map((claim) => `- ${claim}`).join('\n')}
`;
}

export async function rehearseProductionConsequenceBehavior(options?: {
  readonly profilePath?: string;
  readonly substrateSummaryPath?: string;
  readonly substrateSummary?: SubstrateSummary | null;
  readonly outputDir?: string;
  readonly env?: Environment;
  readonly stores?: ProductionConsequenceBehaviorStores;
}): Promise<ProductionConsequenceBehaviorSummary> {
  const env = options?.env ?? process.env;
  const profilePath = resolve(options?.profilePath ?? arg(
    'profile',
    'docs/08-deployment/production-rehearsal-targets/gke-production-rehearsal.json',
  )!);
  const substrateSummaryPath = resolve(options?.substrateSummaryPath ?? arg(
    'substrate-summary',
    '.attestor/rehearsal/gke-production-rehearsal/substrate-readiness/summary.json',
  )!);
  const outputDir = resolve(options?.outputDir ?? arg(
    'output-dir',
    '.attestor/rehearsal/gke-production-rehearsal/consequence-behavior',
  )!);
  const profile = readTargetProfile(profilePath);
  const substrateSummary =
    options?.substrateSummary !== undefined
      ? options.substrateSummary
      : tryReadSubstrateSummary(substrateSummaryPath);
  const target = substrateSummary?.target ?? {
    provider: profile.targetEnvironment.provider,
    namespace: profile.targetEnvironment.namespace,
    publicHostname: envValue(env, 'ATTESTOR_PUBLIC_HOSTNAME'),
  };
  const checks: ProductionConsequenceBehaviorCheck[] = [
    ...targetPrerequisiteChecks({ env, profile, substrateSummary }),
  ];
  let behavior: BehaviorSummary | null = null;

  const prerequisitesPassed = checks.every((check) => check.status === 'pass');
  const stores = options?.stores ?? (prerequisitesPassed ? defaultStores() : null);
  if (!prerequisitesPassed) {
    checks.push(skip('core-consequence-rehearsal', 'Core consequence behavior was not exercised because target prerequisites failed'));
  } else if (!stores) {
    checks.push(fail('shared-store-adapter', 'Shared authority stores were not available'));
  } else {
    try {
      const result = await runCoreBehavior(stores);
      checks.push(...result.checks);
      behavior = result.behavior;
    } catch (error) {
      checks.push(
        fail(
          'core-consequence-rehearsal',
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
  }

  const issues = checks
    .filter((check) => check.status === 'fail')
    .map((check) => `${check.id}: ${check.detail}`);
  const summary: ProductionConsequenceBehaviorSummary = {
    generatedAt: new Date().toISOString(),
    profileId: profile.profileId,
    readiness: {
      state: !prerequisitesPassed
        ? 'blocked-on-target-prerequisites'
        : issues.length === 0
          ? 'passed-core-consequence-rehearsal'
          : 'failed-core-consequence-rehearsal',
      passed: prerequisitesPassed && issues.length === 0,
      issues,
    },
    target,
    stores: {
      mode: stores?.mode ?? 'shared-authority',
      requestPathContract: profile.runtime.sharedAuthorityContract,
    },
    artifacts: {
      outputDir,
      summaryPath: resolve(outputDir, 'summary.json'),
      readmePath: resolve(outputDir, 'README.md'),
    },
    checks,
    behavior,
    nonClaims: [
      'This consequence-behavior rehearsal is not market validation.',
      'This consequence-behavior rehearsal is not a hosted public SaaS launch.',
      'This consequence-behavior rehearsal is not a blanket production guarantee for other environments.',
      'This consequence-behavior rehearsal does not add a hosted crypto route or a new product line.',
      'This consequence-behavior rehearsal does not replace independent security review or operator approval.',
    ],
  };

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(summary.artifacts.summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  writeFileSync(summary.artifacts.readmePath, renderReadme(summary), 'utf8');
  return summary;
}

async function main(): Promise<void> {
  const summary = await rehearseProductionConsequenceBehavior();
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.readiness.passed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exit(1);
  });
}
