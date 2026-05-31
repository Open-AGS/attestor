import { strict as assert } from 'node:assert';
import { createPrivateKey, sign } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildFinanceFilingReleaseMaterial,
  buildFinanceFilingReleaseObservation,
  createFinanceFilingReleaseCandidateFromReport,
  finalizeFinanceFilingReleaseDecision,
} from '../src/release-kernel/finance-record-release.js';
import { createReleaseDecisionEngine } from '../src/release-kernel/release-decision-engine.js';
import { createInMemoryReleaseDecisionLogWriter } from '../src/release-kernel/release-decision-log.js';
import {
  applyReviewerDecision,
  attachIssuedTokenToReviewerQueueRecord,
  createFinanceReviewerQueueItem,
} from '../src/release-kernel/reviewer-queue.js';
import {
  ReleaseEvidencePackStoreError,
  RELEASE_EVIDENCE_PACK_DSSE_PAYLOAD_TYPE,
  createFileBackedReleaseEvidencePackStore,
  createInMemoryReleaseEvidencePackStore,
  createReleaseEvidencePackIssuer,
  type IssuedReleaseEvidencePack,
  type ReleaseEvidenceStatement,
  resetFileBackedReleaseEvidencePackStoreForTests,
  verifyIssuedReleaseEvidencePack,
} from '../src/release-kernel/release-evidence-pack.js';
import { canonicalizeReleaseJson } from '../src/release-kernel/release-canonicalization.js';
import { createReleaseTokenIssuer } from '../src/release-kernel/release-token.js';
import { generateKeyPair } from '../src/signing/keys.js';

let passed = 0;
const VALID_PROVENANCE_DIGEST = `sha256:${'a'.repeat(64)}`;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function deepEqual<T>(actual: T, expected: T, message: string): void {
  assert.deepEqual(actual, expected, message);
  passed += 1;
}

function dssePreAuthEncoding(payloadType: string, payload: Buffer): Buffer {
  const payloadTypeBuffer = Buffer.from(payloadType, 'utf-8');
  return Buffer.concat([
    Buffer.from('DSSEv1 ', 'utf-8'),
    Buffer.from(String(payloadTypeBuffer.length), 'utf-8'),
    Buffer.from(' ', 'utf-8'),
    payloadTypeBuffer,
    Buffer.from(' ', 'utf-8'),
    Buffer.from(String(payload.length), 'utf-8'),
    Buffer.from(' ', 'utf-8'),
    payload,
  ]);
}

function resignEvidencePackStatement(input: {
  readonly issuedEvidencePack: IssuedReleaseEvidencePack;
  readonly statement: ReleaseEvidenceStatement;
  readonly privateKeyPem: string;
}): IssuedReleaseEvidencePack {
  const payload = Buffer.from(canonicalizeReleaseJson(input.statement as never), 'utf-8');
  const signature = sign(
    null,
    dssePreAuthEncoding(RELEASE_EVIDENCE_PACK_DSSE_PAYLOAD_TYPE, payload),
    createPrivateKey(input.privateKeyPem),
  );

  return {
    ...input.issuedEvidencePack,
    statement: input.statement,
    envelope: {
      ...input.issuedEvidencePack.envelope,
      payload: payload.toString('base64'),
      signatures: [
        {
          ...input.issuedEvidencePack.envelope.signatures[0]!,
          sig: signature.toString('base64'),
        },
      ],
    },
  };
}

function makeFinanceReport(overrides: Record<string, unknown> = {}) {
  return {
    runId: 'api-finance-release-evidence',
    timestamp: '2026-04-17T23:30:00.000Z',
    decision: 'pending_approval',
    certificate: { certificateId: 'cert_finance_release_evidence' },
    evidenceChain: { terminalHash: VALID_PROVENANCE_DIGEST, intact: true },
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
      manifestHash: 'manifest_hash_release_evidence',
    },
    ...overrides,
  } as any;
}

async function main(): Promise<void> {
  const report = makeFinanceReport();
  const candidate = createFinanceFilingReleaseCandidateFromReport(report);
  ok(candidate !== null, 'Release evidence pack: review-required finance report still produces a release candidate');

  const material = buildFinanceFilingReleaseMaterial(candidate!);
  const decisionLog = createInMemoryReleaseDecisionLogWriter();
  const engine = createReleaseDecisionEngine({ decisionLog });
  const evaluation = engine.evaluateWithDeterministicChecks(
    {
      id: 'finance-release-evidence-decision',
      createdAt: report.timestamp,
      outputHash: material.hashBundle.outputHash,
      consequenceHash: material.hashBundle.consequenceHash,
      outputContract: material.outputContract,
      capabilityBoundary: material.capabilityBoundary,
      requester: {
        id: 'svc.attestor.api',
        type: 'service',
        displayName: 'Attestor API',
      },
      target: material.target,
    },
    buildFinanceFilingReleaseObservation(material, report),
  );

  equal(evaluation.decision.status, 'review-required', 'Release evidence pack: deterministic evaluation routes regulated finance release through review');

  const finalized = finalizeFinanceFilingReleaseDecision(evaluation.decision, report);
  equal(finalized.status, 'hold', 'Release evidence pack: finance release remains held until explicit reviewer authority closure');

  const queueItem = createFinanceReviewerQueueItem({
    decision: finalized,
    candidate: candidate!,
    report,
    logEntries: decisionLog.entries(),
  });

  const firstApproval = applyReviewerDecision({
    record: queueItem,
    outcome: 'approved',
    reviewerId: 'reviewer.alpha',
    reviewerName: 'Alpha Reviewer',
    reviewerRole: 'financial_reporting_manager',
    decidedAt: '2026-04-17T23:31:00.000Z',
    note: 'First reviewer confirms release conditions.',
  });
  const secondApproval = applyReviewerDecision({
    record: firstApproval.record,
    outcome: 'approved',
    reviewerId: 'reviewer.beta',
    reviewerName: 'Beta Reviewer',
    reviewerRole: 'financial_reporting_manager',
    decidedAt: '2026-04-17T23:32:00.000Z',
    note: 'Second reviewer closes regulated release authority.',
  });

  equal(secondApproval.record.detail.status, 'approved', 'Release evidence pack: dual approval closes the regulated review path');
  equal(secondApproval.record.releaseDecision.status, 'accepted', 'Release evidence pack: dual approval upgrades the decision to accepted');

  decisionLog.append({
    occurredAt: '2026-04-17T23:31:00.000Z',
    requestId: 'review:finance-release-evidence:approve-1',
    phase: 'review',
    matchedPolicyId: secondApproval.record.releaseDecision.policyVersion,
    decision: secondApproval.record.releaseDecision,
    metadata: {
      policyMatched: true,
      pendingChecks: [],
      pendingEvidenceKinds: [],
      requiresReview: true,
      deterministicChecksCompleted: true,
    },
  });
  decisionLog.append({
    occurredAt: '2026-04-17T23:32:00.000Z',
    requestId: 'review:finance-release-evidence:terminal-accept',
    phase: 'terminal-accept',
    matchedPolicyId: secondApproval.record.releaseDecision.policyVersion,
    decision: secondApproval.record.releaseDecision,
    metadata: {
      policyMatched: true,
      pendingChecks: [],
      pendingEvidenceKinds: [],
      requiresReview: false,
      deterministicChecksCompleted: true,
    },
  });

  const signingKeys = generateKeyPair();
  const tokenIssuer = createReleaseTokenIssuer({
    issuer: 'attestor.test.release',
    privateKeyPem: signingKeys.privateKeyPem,
    publicKeyPem: signingKeys.publicKeyPem,
  });
  const issuedToken = await tokenIssuer.issue({
    decision: secondApproval.record.releaseDecision,
    issuedAt: '2026-04-17T23:32:30.000Z',
  });
  const recordWithToken = attachIssuedTokenToReviewerQueueRecord({
    record: secondApproval.record,
    issuedToken,
  });

  const evidenceIssuer = createReleaseEvidencePackIssuer({
    issuer: 'attestor.test.release',
    privateKeyPem: signingKeys.privateKeyPem,
    publicKeyPem: signingKeys.publicKeyPem,
  });
  const issuedEvidencePack = await evidenceIssuer.issue({
    decision: {
      ...recordWithToken.releaseDecision,
      evidencePackId: 'ep_release_evidence_test',
    },
    evidencePackId: 'ep_release_evidence_test',
    issuedAt: '2026-04-17T23:33:00.000Z',
    decisionLogEntries: decisionLog.entries().filter((entry) => entry.decisionId === recordWithToken.releaseDecision.id),
    decisionLogChainIntact: decisionLog.verify().valid,
    review: recordWithToken.detail,
    releaseToken: issuedToken,
    artifactReferences: [
      {
        kind: 'provenance',
        path: 'finance-evidence-chain://api-finance-release-evidence',
        digest: report.evidenceChain.terminalHash,
      },
    ],
  });
  const expectedEvidencePolicyContext = {
    policyVersion: recordWithToken.releaseDecision.policyVersion,
    policyHash: recordWithToken.releaseDecision.policyHash,
    policyIrHash: recordWithToken.releaseDecision.policyProvenance?.compiledPolicyIrHash ?? null,
    policyProvenanceSource: recordWithToken.releaseDecision.policyProvenance?.source ?? null,
    compiledPolicyIndexVersion:
      recordWithToken.releaseDecision.policyProvenance?.compiledPolicyIndexVersion ?? null,
    compiledPolicyIrVersion:
      recordWithToken.releaseDecision.policyProvenance?.compiledPolicyIrVersion ?? null,
  };
  const expectedTokenPolicyContext = {
    policyVersion: issuedToken.claims.policy_version ?? null,
    policyHash: issuedToken.claims.policy_hash,
    policyIrHash: issuedToken.claims.policy_ir_hash ?? null,
    policyProvenanceSource: issuedToken.claims.policy_provenance_source ?? null,
    compiledPolicyIndexVersion: issuedToken.claims.compiled_policy_index_version ?? null,
    compiledPolicyIrVersion: issuedToken.claims.compiled_policy_ir_version ?? null,
  };

  equal(issuedEvidencePack.evidencePack.id, 'ep_release_evidence_test', 'Release evidence pack: caller-provided pack id is preserved');
  equal(issuedEvidencePack.evidencePack.retentionClass, 'regulated', 'Release evidence pack: regulated finance release gets regulated retention');
  equal(
    issuedEvidencePack.evidencePack.policyIrHash,
    recordWithToken.releaseDecision.policyProvenance?.compiledPolicyIrHash ?? null,
    'Release evidence pack: durable evidence preserves the compiled policy IR hash from the release decision',
  );
  equal(
    issuedEvidencePack.evidencePack.policyProvenanceSource,
    recordWithToken.releaseDecision.policyProvenance?.source ?? null,
    'Release evidence pack: durable evidence preserves the policy provenance source from the release decision',
  );
  equal(
    issuedEvidencePack.evidencePack.compiledPolicyIndexVersion,
    recordWithToken.releaseDecision.policyProvenance?.compiledPolicyIndexVersion ?? null,
    'Release evidence pack: durable evidence preserves the compiled policy index version from the release decision',
  );
  equal(
    issuedEvidencePack.evidencePack.compiledPolicyIrVersion,
    recordWithToken.releaseDecision.policyProvenance?.compiledPolicyIrVersion ?? null,
    'Release evidence pack: durable evidence preserves the compiled policy IR version from the release decision',
  );
  deepEqual(
    issuedEvidencePack.evidencePack.policyContext,
    expectedEvidencePolicyContext,
    'Release evidence pack: durable evidence exposes a structured policy context',
  );
  ok(issuedEvidencePack.evidencePack.artifacts.some((artifact) => artifact.kind === 'review-record'), 'Release evidence pack: review-record artifact is captured');
  ok(issuedEvidencePack.evidencePack.artifacts.some((artifact) => artifact.kind === 'signature'), 'Release evidence pack: release-token artifact is captured');
  equal(
    issuedEvidencePack.evidencePack.artifacts.find((artifact) => artifact.kind === 'provenance')?.verificationStatus,
    'declared-unverified',
    'Release evidence pack: caller-provided provenance artifacts are labelled declared-unverified',
  );
  ok(
    issuedEvidencePack.evidencePack.artifacts
      .filter((artifact) => artifact.kind !== 'provenance')
      .every((artifact) => artifact.verificationStatus === 'issuer-derived'),
    'Release evidence pack: internally derived artifacts are labelled issuer-derived',
  );
  equal(
    issuedEvidencePack.statement.subject[0]?.digest.sha256,
    recordWithToken.releaseDecision.outputHash.replace('sha256:', ''),
    'Release evidence pack: output subject digest binds to the release output hash',
  );
  let malformedArtifactDigestError: Error | null = null;
  try {
    await evidenceIssuer.issue({
      decision: {
        ...recordWithToken.releaseDecision,
        evidencePackId: 'ep_release_evidence_bad_artifact',
      },
      evidencePackId: 'ep_release_evidence_bad_artifact',
      issuedAt: '2026-04-17T23:33:30.000Z',
      decisionLogEntries: decisionLog.entries().filter((entry) => entry.decisionId === recordWithToken.releaseDecision.id),
      decisionLogChainIntact: decisionLog.verify().valid,
      review: recordWithToken.detail,
      releaseToken: issuedToken,
      artifactReferences: [
        {
          kind: 'provenance',
          path: 'finance-evidence-chain://api-finance-release-evidence',
          digest: 'sha256:not-a-strict-digest',
        },
      ],
    });
  } catch (error) {
    malformedArtifactDigestError = error as Error;
  }
  ok(
    malformedArtifactDigestError?.message.includes('sha256:<64 lowercase hex>'),
    'Release evidence pack: malformed caller-provided artifact digests fail closed',
  );
  equal(
    issuedEvidencePack.statement.subject[1]?.digest.sha256,
    recordWithToken.releaseDecision.consequenceHash.replace('sha256:', ''),
    'Release evidence pack: consequence subject digest binds to the release consequence hash',
  );
  equal(
    issuedEvidencePack.statement.predicate.releaseToken?.tokenId,
    issuedToken.tokenId,
    'Release evidence pack: predicate carries the issued release token summary',
  );
  equal(
    issuedEvidencePack.statement.predicate.releaseToken?.policyIrHash ?? null,
    issuedToken.claims.policy_ir_hash ?? null,
    'Release evidence pack: predicate token summary preserves the token policy IR hash',
  );
  equal(
    issuedEvidencePack.statement.predicate.releaseToken?.policyProvenanceSource ?? null,
    issuedToken.claims.policy_provenance_source ?? null,
    'Release evidence pack: predicate token summary preserves the token policy provenance source',
  );
  equal(
    issuedEvidencePack.statement.predicate.releaseToken?.compiledPolicyIndexVersion ?? null,
    issuedToken.claims.compiled_policy_index_version ?? null,
    'Release evidence pack: predicate token summary preserves the token compiled policy index version',
  );
  equal(
    issuedEvidencePack.statement.predicate.releaseToken?.compiledPolicyIrVersion ?? null,
    issuedToken.claims.compiled_policy_ir_version ?? null,
    'Release evidence pack: predicate token summary preserves the token compiled policy IR version',
  );
  deepEqual(
    issuedEvidencePack.statement.predicate.releaseToken?.policyContext,
    expectedTokenPolicyContext,
    'Release evidence pack: predicate token summary exposes a structured policy context',
  );
  equal(
    issuedEvidencePack.statement.predicate.decision.policyIrHash,
    recordWithToken.releaseDecision.policyProvenance?.compiledPolicyIrHash ?? null,
    'Release evidence pack: predicate decision summary preserves the runtime policy IR hash',
  );
  equal(
    issuedEvidencePack.statement.predicate.decision.policyProvenanceSource,
    recordWithToken.releaseDecision.policyProvenance?.source ?? null,
    'Release evidence pack: predicate decision summary preserves the runtime policy provenance source',
  );
  equal(
    issuedEvidencePack.statement.predicate.decision.compiledPolicyIndexVersion,
    recordWithToken.releaseDecision.policyProvenance?.compiledPolicyIndexVersion ?? null,
    'Release evidence pack: predicate decision summary preserves the runtime compiled policy index version',
  );
  equal(
    issuedEvidencePack.statement.predicate.decision.compiledPolicyIrVersion,
    recordWithToken.releaseDecision.policyProvenance?.compiledPolicyIrVersion ?? null,
    'Release evidence pack: predicate decision summary preserves the runtime compiled policy IR version',
  );
  deepEqual(
    issuedEvidencePack.statement.predicate.decision.policyContext,
    expectedEvidencePolicyContext,
    'Release evidence pack: predicate decision summary exposes a structured policy context',
  );
  equal(
    issuedEvidencePack.statement.predicate.review?.reviewId,
    recordWithToken.detail.id,
    'Release evidence pack: predicate carries the reviewer queue summary',
  );
  equal(
    issuedEvidencePack.statement.predicate.decision.evidencePackId,
    issuedEvidencePack.evidencePack.id,
    'Release evidence pack: decision summary binds back to the durable evidence pack id',
  );

  const verification = verifyIssuedReleaseEvidencePack({
    issuedEvidencePack,
    verificationKey: evidenceIssuer.exportVerificationKey(),
  });
  equal(verification.valid, true, 'Release evidence pack: DSSE signature verifies');
  equal(
    verification.bundleDigest,
    issuedEvidencePack.bundleDigest,
    'Release evidence pack: verification preserves the exported bundle digest',
  );
  equal(
    verification.decisionId,
    recordWithToken.releaseDecision.id,
    'Release evidence pack: verification result exposes the signed release decision id',
  );
  equal(
    verification.outputHash,
    recordWithToken.releaseDecision.outputHash,
    'Release evidence pack: verification result exposes the signed output hash',
  );
  equal(
    verification.consequenceHash,
    recordWithToken.releaseDecision.consequenceHash,
    'Release evidence pack: verification result exposes the signed consequence hash',
  );
  equal(
    verification.policyVersion,
    recordWithToken.releaseDecision.policyVersion,
    'Release evidence pack: verification result exposes the signed policy version',
  );
  equal(
    verification.policyHash,
    recordWithToken.releaseDecision.policyHash,
    'Release evidence pack: verification result exposes the signed policy hash',
  );
  equal(
    verification.policyIrHash,
    recordWithToken.releaseDecision.policyProvenance?.compiledPolicyIrHash ?? null,
    'Release evidence pack: verification result exposes the signed policy IR hash',
  );
  equal(
    verification.policyProvenanceSource,
    recordWithToken.releaseDecision.policyProvenance?.source ?? null,
    'Release evidence pack: verification result exposes the signed policy provenance source',
  );
  equal(
    verification.compiledPolicyIndexVersion,
    recordWithToken.releaseDecision.policyProvenance?.compiledPolicyIndexVersion ?? null,
    'Release evidence pack: verification result exposes the signed compiled policy index version',
  );
  equal(
    verification.compiledPolicyIrVersion,
    recordWithToken.releaseDecision.policyProvenance?.compiledPolicyIrVersion ?? null,
    'Release evidence pack: verification result exposes the signed compiled policy IR version',
  );
  deepEqual(
    verification.policyContext,
    expectedEvidencePolicyContext,
    'Release evidence pack: verification result exposes the signed structured policy context',
  );
  equal(
    verification.releaseTokenId,
    issuedToken.tokenId,
    'Release evidence pack: verification result exposes the signed release token id',
  );
  equal(
    verification.reviewId,
    recordWithToken.detail.id,
    'Release evidence pack: verification result exposes the signed reviewer queue id',
  );

  const store = createInMemoryReleaseEvidencePackStore();
  store.upsert(issuedEvidencePack);
  equal(
    store.get(issuedEvidencePack.evidencePack.id)?.evidencePack.id,
    issuedEvidencePack.evidencePack.id,
    'Release evidence pack: in-memory store round-trips the exported bundle',
  );

  const fileBackedStorePath = join(
    mkdtempSync(join(tmpdir(), 'attestor-release-evidence-pack-store-')),
    'store.json',
  );
  resetFileBackedReleaseEvidencePackStoreForTests(fileBackedStorePath);
  const fileBackedStore = createFileBackedReleaseEvidencePackStore(fileBackedStorePath);
  fileBackedStore.upsert(issuedEvidencePack);
  const reloadedFileBackedStore = createFileBackedReleaseEvidencePackStore(fileBackedStorePath);
  const reloadedEvidencePack = reloadedFileBackedStore.get(issuedEvidencePack.evidencePack.id);
  equal(
    reloadedEvidencePack?.bundleDigest,
    issuedEvidencePack.bundleDigest,
    'Release evidence pack: file-backed store survives restart with bundle digest intact',
  );
  equal(
    verifyIssuedReleaseEvidencePack({
      issuedEvidencePack: reloadedEvidencePack!,
      verificationKey: reloadedEvidencePack!.verificationKey,
    }).valid,
    true,
    'Release evidence pack: file-backed store reload remains verifiable',
  );

  const tamperedStoreFile = JSON.parse(readFileSync(fileBackedStorePath, 'utf8')) as {
    packs: Array<{ bundleDigest: string }>;
  };
  tamperedStoreFile.packs[0]!.bundleDigest = 'sha256:deadbeef';
  writeFileSync(fileBackedStorePath, `${JSON.stringify(tamperedStoreFile, null, 2)}\n`);
  assert.throws(
    () =>
      verifyIssuedReleaseEvidencePack(
        { issuedEvidencePack } as unknown as Parameters<
          typeof verifyIssuedReleaseEvidencePack
        >[0],
      ),
    /explicit trusted verification key/i,
    'Release evidence pack: verification requires a caller-supplied trusted key',
  );
  passed += 1;

  assert.throws(
    () => createFileBackedReleaseEvidencePackStore(fileBackedStorePath),
    ReleaseEvidencePackStoreError,
    'Release evidence pack: file-backed store rejects tampered bundle digest on restart',
  );
  passed += 1;

  writeFileSync(fileBackedStorePath, '{not-json');
  assert.throws(
    () => createFileBackedReleaseEvidencePackStore(fileBackedStorePath),
    ReleaseEvidencePackStoreError,
    'Release evidence pack: file-backed store rejects malformed persisted state',
  );
  passed += 1;

  let tamperedSignatureError: Error | null = null;
  try {
    verifyIssuedReleaseEvidencePack({
      issuedEvidencePack: {
        ...issuedEvidencePack,
        envelope: {
          ...issuedEvidencePack.envelope,
          signatures: [
            {
              ...issuedEvidencePack.envelope.signatures[0]!,
              sig: 'A'.repeat(issuedEvidencePack.envelope.signatures[0]!.sig.length),
            },
          ],
        },
      },
      verificationKey: evidenceIssuer.exportVerificationKey(),
    });
  } catch (error) {
    tamperedSignatureError = error as Error;
  }
  ok(
    tamperedSignatureError?.message.includes('DSSE signature'),
    'Release evidence pack: tampered DSSE envelope is rejected',
  );

  let mismatchedStatementError: Error | null = null;
  try {
    verifyIssuedReleaseEvidencePack({
      issuedEvidencePack: {
        ...issuedEvidencePack,
        statement: {
          ...issuedEvidencePack.statement,
          predicate: {
            ...issuedEvidencePack.statement.predicate,
            decision: {
              ...issuedEvidencePack.statement.predicate.decision,
              policyIrHash: 'sha256:mismatched-exported-statement-policy-ir',
            },
          },
        },
      },
      verificationKey: evidenceIssuer.exportVerificationKey(),
    });
  } catch (error) {
    mismatchedStatementError = error as Error;
  }
  ok(
    mismatchedStatementError?.message.includes('signed payload'),
    'Release evidence pack: exported statement must match the signed DSSE payload',
  );

  let mismatchedEvidencePackError: Error | null = null;
  try {
    verifyIssuedReleaseEvidencePack({
      issuedEvidencePack: {
        ...issuedEvidencePack,
        evidencePack: {
          ...issuedEvidencePack.evidencePack,
          policyIrHash: 'sha256:mismatched-exported-evidence-pack-policy-ir',
        },
      },
      verificationKey: evidenceIssuer.exportVerificationKey(),
    });
  } catch (error) {
    mismatchedEvidencePackError = error as Error;
  }
  ok(
    mismatchedEvidencePackError?.message.includes('exported evidence pack'),
    'Release evidence pack: exported evidence pack must match the signed DSSE payload',
  );

  let inconsistentDecisionPolicyError: Error | null = null;
  try {
    const inconsistentStatement: ReleaseEvidenceStatement = {
      ...issuedEvidencePack.statement,
      predicate: {
        ...issuedEvidencePack.statement.predicate,
        decision: {
          ...issuedEvidencePack.statement.predicate.decision,
          policyHash: 'sha256:inconsistent-decision-policy',
          policyContext: {
            ...issuedEvidencePack.statement.predicate.decision.policyContext,
            policyHash: 'sha256:inconsistent-decision-policy',
          },
        },
      },
    };
    verifyIssuedReleaseEvidencePack({
      issuedEvidencePack: resignEvidencePackStatement({
        issuedEvidencePack,
        statement: inconsistentStatement,
        privateKeyPem: signingKeys.privateKeyPem,
      }),
      verificationKey: evidenceIssuer.exportVerificationKey(),
    });
  } catch (error) {
    inconsistentDecisionPolicyError = error as Error;
  }
  ok(
    inconsistentDecisionPolicyError?.message.includes('decision summary policy hash'),
    'Release evidence pack: signed decision policy summary must match the signed evidence pack',
  );

  let inconsistentDecisionPolicyContextError: Error | null = null;
  try {
    const inconsistentStatement: ReleaseEvidenceStatement = {
      ...issuedEvidencePack.statement,
      predicate: {
        ...issuedEvidencePack.statement.predicate,
        decision: {
          ...issuedEvidencePack.statement.predicate.decision,
          policyContext: {
            ...issuedEvidencePack.statement.predicate.decision.policyContext,
            policyHash: 'sha256:inconsistent-decision-policy-context',
          },
        },
      },
    };
    verifyIssuedReleaseEvidencePack({
      issuedEvidencePack: resignEvidencePackStatement({
        issuedEvidencePack,
        statement: inconsistentStatement,
        privateKeyPem: signingKeys.privateKeyPem,
      }),
      verificationKey: evidenceIssuer.exportVerificationKey(),
    });
  } catch (error) {
    inconsistentDecisionPolicyContextError = error as Error;
  }
  ok(
    inconsistentDecisionPolicyContextError?.message.includes('decision policy context policy hash'),
    'Release evidence pack: signed decision policy context must match the signed decision policy fields',
  );

  let inconsistentTokenPolicyError: Error | null = null;
  try {
    const inconsistentStatement: ReleaseEvidenceStatement = {
      ...issuedEvidencePack.statement,
      predicate: {
        ...issuedEvidencePack.statement.predicate,
        releaseToken: issuedEvidencePack.statement.predicate.releaseToken
          ? {
              ...issuedEvidencePack.statement.predicate.releaseToken,
              policyHash: 'sha256:inconsistent-token-policy',
              policyContext: {
                ...issuedEvidencePack.statement.predicate.releaseToken.policyContext,
                policyHash: 'sha256:inconsistent-token-policy',
              },
            }
          : null,
      },
    };
    verifyIssuedReleaseEvidencePack({
      issuedEvidencePack: resignEvidencePackStatement({
        issuedEvidencePack,
        statement: inconsistentStatement,
        privateKeyPem: signingKeys.privateKeyPem,
      }),
      verificationKey: evidenceIssuer.exportVerificationKey(),
    });
  } catch (error) {
    inconsistentTokenPolicyError = error as Error;
  }
  ok(
    inconsistentTokenPolicyError?.message.includes('token summary policy hash'),
    'Release evidence pack: signed token policy summary must match the signed evidence pack',
  );

  let inconsistentTokenPolicyContextError: Error | null = null;
  try {
    const inconsistentStatement: ReleaseEvidenceStatement = {
      ...issuedEvidencePack.statement,
      predicate: {
        ...issuedEvidencePack.statement.predicate,
        releaseToken: issuedEvidencePack.statement.predicate.releaseToken
          ? {
              ...issuedEvidencePack.statement.predicate.releaseToken,
              policyContext: {
                ...issuedEvidencePack.statement.predicate.releaseToken.policyContext,
                policyHash: 'sha256:inconsistent-token-policy-context',
              },
            }
          : null,
      },
    };
    verifyIssuedReleaseEvidencePack({
      issuedEvidencePack: resignEvidencePackStatement({
        issuedEvidencePack,
        statement: inconsistentStatement,
        privateKeyPem: signingKeys.privateKeyPem,
      }),
      verificationKey: evidenceIssuer.exportVerificationKey(),
    });
  } catch (error) {
    inconsistentTokenPolicyContextError = error as Error;
  }
  ok(
    inconsistentTokenPolicyContextError?.message.includes('token policy context policy hash'),
    'Release evidence pack: signed token policy context must match the signed token policy fields',
  );

  let inconsistentSubjectError: Error | null = null;
  try {
    const inconsistentStatement: ReleaseEvidenceStatement = {
      ...issuedEvidencePack.statement,
      subject: [
        {
          ...issuedEvidencePack.statement.subject[0]!,
          digest: { sha256: 'inconsistent-output-subject' },
        },
        ...issuedEvidencePack.statement.subject.slice(1),
      ],
    };
    verifyIssuedReleaseEvidencePack({
      issuedEvidencePack: resignEvidencePackStatement({
        issuedEvidencePack,
        statement: inconsistentStatement,
        privateKeyPem: signingKeys.privateKeyPem,
      }),
      verificationKey: evidenceIssuer.exportVerificationKey(),
    });
  } catch (error) {
    inconsistentSubjectError = error as Error;
  }
  ok(
    inconsistentSubjectError?.message.includes('statement subject'),
    'Release evidence pack: signed statement subjects must match the signed release hashes',
  );

  let tamperedDigestError: Error | null = null;
  try {
    verifyIssuedReleaseEvidencePack({
      issuedEvidencePack: {
        ...issuedEvidencePack,
        bundleDigest: 'sha256:deadbeef',
      },
      verificationKey: evidenceIssuer.exportVerificationKey(),
    });
  } catch (error) {
    tamperedDigestError = error as Error;
  }
  ok(
    tamperedDigestError?.message.includes('bundle digest'),
    'Release evidence pack: tampered bundle digest is rejected',
  );

  console.log(`\nRelease kernel release-evidence-pack tests: ${passed} passed, 0 failed`);
}

main().catch((error) => {
  console.error('\nRelease kernel release-evidence-pack tests failed.');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
