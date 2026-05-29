import {
  COUNTERPARTY_SQL, COUNTERPARTY_INTENT, COUNTERPARTY_FIXTURE,
  COUNTERPARTY_REPORT_CONTRACT, COUNTERPARTY_REPORT,
  LIQUIDITY_SQL, LIQUIDITY_INTENT, LIQUIDITY_FIXTURE,
  RECON_SQL, RECON_INTENT, RECON_FIXTURE,
  UNSAFE_SQL_WRITE,
} from '../../src/financial/fixtures/scenarios.js';

import type { FinancialTestContext } from './helpers.js';

export async function runMultiQueryFinancialTests({ ok }: FinancialTestContext): Promise<void> {
  // ═══ MULTI-QUERY PIPELINE ═══
  console.log('\n  [Multi-Query Pipeline]');
  {
    const { runMultiQueryPipeline } = await import('../../src/financial/multi-query-pipeline.js');

    // Two-query run: counterparty (pass) + unsafe SQL (block)
    const mqResult = runMultiQueryPipeline('mq-test-1', [
      {
        unitId: 'counterparty',
        label: 'Counterparty exposure summary',
        input: { runId: 'x', intent: COUNTERPARTY_INTENT, candidateSql: COUNTERPARTY_SQL, fixtures: [COUNTERPARTY_FIXTURE], generatedReport: COUNTERPARTY_REPORT, reportContract: COUNTERPARTY_REPORT_CONTRACT },
      },
      {
        unitId: 'unsafe',
        label: 'Unsafe SQL write attempt',
        input: { runId: 'x', intent: COUNTERPARTY_INTENT, candidateSql: UNSAFE_SQL_WRITE, fixtures: [] },
      },
    ]);

    // Per-unit results preserved
    ok(mqResult.unitCount === 2, 'MQ: 2 units');
    ok(mqResult.units.length === 2, 'MQ: 2 unit results');
    ok(mqResult.units[0].unitId === 'counterparty', 'MQ: unit 0 = counterparty');
    ok(mqResult.units[1].unitId === 'unsafe', 'MQ: unit 1 = unsafe');

    // Per-unit decisions
    ok(mqResult.units[0].decision === 'pass', 'MQ: counterparty passes');
    ok(mqResult.units[1].decision === 'block', 'MQ: unsafe blocks');

    // Aggregate decision is worst-case
    ok(mqResult.aggregateDecision === 'block', 'MQ: aggregate=block (worst case)');

    // Decision breakdown
    ok(mqResult.decisionBreakdown.pass === 1, 'MQ: 1 pass');
    ok(mqResult.decisionBreakdown.block === 1, 'MQ: 1 block');
    ok(mqResult.decisionBreakdown.fail === 0, 'MQ: 0 fail');

    // Governance sufficiency
    ok(!mqResult.governanceSufficiency.sufficient, 'MQ: not sufficient (unsafe SQL fails governance)');
    ok(mqResult.governanceSufficiency.sqlPassCount === 1, 'MQ: 1 SQL pass');
    ok(mqResult.governanceSufficiency.totalUnits === 2, 'MQ: 2 total units');

    // Proof mode
    ok(mqResult.aggregateProofMode === 'offline_fixture', 'MQ: proof=offline_fixture');

    // Per-unit evidence preserved
    ok(mqResult.units[0].evidenceChainTerminal.length > 0, 'MQ: unit 0 has evidence chain');
    ok(mqResult.units[1].evidenceChainTerminal.length > 0, 'MQ: unit 1 has evidence chain');
    ok(mqResult.units[0].evidenceChainTerminal !== mqResult.units[1].evidenceChainTerminal, 'MQ: distinct evidence chains');

    // Audit
    ok(mqResult.totalAuditEntries > 0, 'MQ: audit entries > 0');
    ok(mqResult.allAuditChainsIntact, 'MQ: all audit chains intact');

    // Multi-query hash
    ok(mqResult.multiQueryHash.length === 32, 'MQ: multiQueryHash is 32 hex chars');

    // Blockers from unsafe unit
    ok(mqResult.allBlockers.length > 0, 'MQ: has blockers');
    ok(mqResult.allBlockers.some(b => b.unitId === 'unsafe'), 'MQ: blocker from unsafe unit');

    console.log(`    Units: ${mqResult.unitCount}, aggregate=${mqResult.aggregateDecision}, proof=${mqResult.aggregateProofMode}`);
    console.log(`    Breakdown: pass=${mqResult.decisionBreakdown.pass}, block=${mqResult.decisionBreakdown.block}`);
    console.log(`    Governance: sufficient=${mqResult.governanceSufficiency.sufficient}, sql=${mqResult.governanceSufficiency.sqlPassCount}/${mqResult.governanceSufficiency.totalUnits}`);
    console.log(`    Blockers: ${mqResult.allBlockers.length} from ${mqResult.allBlockers.map(b => b.unitId).join(',')}`);
  }

  // ═══ MULTI-QUERY: ALL PASS ═══
  console.log('\n  [Multi-Query All Pass]');
  {
    const { runMultiQueryPipeline } = await import('../../src/financial/multi-query-pipeline.js');

    const mqPass = runMultiQueryPipeline('mq-test-2', [
      {
        unitId: 'counterparty',
        label: 'Counterparty exposure',
        input: { runId: 'x', intent: COUNTERPARTY_INTENT, candidateSql: COUNTERPARTY_SQL, fixtures: [COUNTERPARTY_FIXTURE], generatedReport: COUNTERPARTY_REPORT, reportContract: COUNTERPARTY_REPORT_CONTRACT },
      },
      {
        unitId: 'liquidity',
        label: 'Liquidity risk',
        input: { runId: 'x', intent: LIQUIDITY_INTENT, candidateSql: LIQUIDITY_SQL, fixtures: [LIQUIDITY_FIXTURE] },
      },
    ]);

    // Liquidity scenario fails due to negative values, so aggregate should reflect that
    ok(mqPass.units[0].decision === 'pass', 'MQPass: counterparty passes');
    ok(mqPass.units[1].decision === 'fail', 'MQPass: liquidity fails');
    ok(mqPass.aggregateDecision === 'fail', 'MQPass: aggregate=fail');
    ok(mqPass.decisionBreakdown.pass === 1, 'MQPass: 1 pass');
    ok(mqPass.decisionBreakdown.fail === 1, 'MQPass: 1 fail');

    console.log(`    aggregate=${mqPass.aggregateDecision}, pass=${mqPass.decisionBreakdown.pass}, fail=${mqPass.decisionBreakdown.fail}`);
  }

  // ═══ MULTI-QUERY: SINGLE UNIT ═══
  console.log('\n  [Multi-Query Single Unit]');
  {
    const { runMultiQueryPipeline } = await import('../../src/financial/multi-query-pipeline.js');

    const mqSingle = runMultiQueryPipeline('mq-test-3', [
      {
        unitId: 'only',
        label: 'Single counterparty',
        input: { runId: 'x', intent: COUNTERPARTY_INTENT, candidateSql: COUNTERPARTY_SQL, fixtures: [COUNTERPARTY_FIXTURE], generatedReport: COUNTERPARTY_REPORT, reportContract: COUNTERPARTY_REPORT_CONTRACT },
      },
    ]);

    ok(mqSingle.unitCount === 1, 'MQSingle: 1 unit');
    ok(mqSingle.aggregateDecision === 'pass', 'MQSingle: aggregate=pass');
    ok(mqSingle.governanceSufficiency.sufficient, 'MQSingle: governance sufficient');
    ok(mqSingle.allBlockers.length === 0, 'MQSingle: no blockers');

    console.log(`    Single unit: aggregate=${mqSingle.aggregateDecision}, sufficient=${mqSingle.governanceSufficiency.sufficient}`);
  }

  // ═══ MULTI-QUERY PROOF ARTIFACTS ═══
  console.log('\n  [Multi-Query Proof Artifacts]');
  {
    const { runMultiQueryPipeline } = await import('../../src/financial/multi-query-pipeline.js');
    const { buildMultiQueryOutputPack, buildMultiQueryDossier, buildMultiQueryManifest, renderMultiQuerySummary } = await import('../../src/financial/multi-query-proof.js');

    // Mixed run: pass + fail + block
    const mqReport = runMultiQueryPipeline('mq-proof-test', [
      {
        unitId: 'counterparty',
        label: 'Counterparty exposure',
        input: { runId: 'x', intent: COUNTERPARTY_INTENT, candidateSql: COUNTERPARTY_SQL, fixtures: [COUNTERPARTY_FIXTURE], generatedReport: COUNTERPARTY_REPORT, reportContract: COUNTERPARTY_REPORT_CONTRACT },
      },
      {
        unitId: 'unsafe',
        label: 'Unsafe write attempt',
        input: { runId: 'x', intent: COUNTERPARTY_INTENT, candidateSql: UNSAFE_SQL_WRITE, fixtures: [] },
      },
      {
        unitId: 'recon',
        label: 'Reconciliation check',
        input: { runId: 'x', intent: RECON_INTENT, candidateSql: RECON_SQL, fixtures: [RECON_FIXTURE] },
      },
    ]);

    // ── Output Pack ──
    const pack = buildMultiQueryOutputPack(mqReport);
    ok(pack.version === '1.0', 'MQPack: version 1.0');
    ok(pack.type === 'attestor.multi_query_output_pack.v1', 'MQPack: correct type');
    ok(pack.runId === 'mq-proof-test', 'MQPack: runId preserved');
    ok(pack.unitCount === 3, 'MQPack: 3 units');
    ok(pack.aggregate.decision === 'block', 'MQPack: aggregate=block');
    ok(pack.aggregate.proofMode === 'offline_fixture', 'MQPack: proof=offline_fixture');
    ok(!pack.aggregate.allUnitsLive, 'MQPack: not all live');
    ok(pack.aggregate.allAuditChainsIntact, 'MQPack: audit intact');

    // Per-unit summaries preserved
    ok(pack.units.length === 3, 'MQPack: 3 unit summaries');
    ok(pack.units[0].unitId === 'counterparty', 'MQPack: unit 0 = counterparty');
    ok(pack.units[0].decision === 'pass', 'MQPack: counterparty passes');
    ok(pack.units[1].unitId === 'unsafe', 'MQPack: unit 1 = unsafe');
    ok(pack.units[1].decision === 'block', 'MQPack: unsafe blocks');
    ok(pack.units[2].unitId === 'recon', 'MQPack: unit 2 = recon');

    // Per-unit evidence chain terminals in pack (portable anchors)
    ok(pack.units[0].evidenceChainTerminal.length > 0, 'MQPack: unit 0 has terminal');
    ok(pack.units[1].evidenceChainTerminal.length > 0, 'MQPack: unit 1 has terminal');
    ok(pack.units[0].evidenceChainTerminal !== pack.units[1].evidenceChainTerminal, 'MQPack: distinct terminals');

    // Per-unit governance
    ok(pack.units[0].governance.sqlPass, 'MQPack: counterparty SQL pass');
    ok(!pack.units[1].governance.sqlPass, 'MQPack: unsafe SQL fail');

    // Pack-level blocker attribution
    ok(pack.blockers.length > 0, 'MQPack: has blockers');
    ok(pack.blockers.some(b => b.unitId === 'unsafe'), 'MQPack: blocker attributed to unsafe');

    // Pack-level evidence
    ok(pack.evidence.multiQueryHash.length === 32, 'MQPack: hash present');
    ok(pack.evidence.totalAuditEntries > 0, 'MQPack: audit entries');

    // Unit summaries do NOT contain full reports (portability check)
    const unitKeys = Object.keys(pack.units[0]);
    ok(!unitKeys.includes('report'), 'MQPack: unit summary does NOT contain full report');

    console.log(`    OutputPack: type=${pack.type}, units=${pack.unitCount}, decision=${pack.aggregate.decision}`);

    // ── Dossier ──
    const dossier = buildMultiQueryDossier(mqReport);
    ok(dossier.version === '1.0', 'MQDossier: version 1.0');
    ok(dossier.type === 'attestor.multi_query_dossier.v1', 'MQDossier: correct type');
    ok(dossier.runId === 'mq-proof-test', 'MQDossier: runId');
    ok(dossier.aggregateDecision === 'block', 'MQDossier: aggregate=block');
    ok(dossier.verdict.includes('BLOCK'), 'MQDossier: verdict mentions BLOCK');

    // Per-unit entries with explanations
    ok(dossier.unitEntries.length === 3, 'MQDossier: 3 entries');
    ok(dossier.unitEntries[0].decision === 'pass', 'MQDossier: counterparty pass');
    ok(dossier.unitEntries[0].explanation.includes('pass'), 'MQDossier: pass explanation');
    ok(dossier.unitEntries[1].decision === 'block', 'MQDossier: unsafe block');
    ok(dossier.unitEntries[1].explanation.includes('lock'), 'MQDossier: block explanation');

    // Dossier summaries
    ok(dossier.governanceSummary.length > 0, 'MQDossier: governance summary');
    ok(dossier.proofSummary.length > 0, 'MQDossier: proof summary');

    // Blocker attribution in dossier
    ok(dossier.blockers.some(b => b.unitId === 'unsafe'), 'MQDossier: blocker attributed');

    console.log(`    Dossier: verdict="${dossier.verdict}"`);

    // ── Manifest ──
    const manifest = buildMultiQueryManifest(mqReport);
    ok(manifest.version === '1.0', 'MQManifest: version 1.0');
    ok(manifest.type === 'attestor.multi_query_manifest.v1', 'MQManifest: correct type');
    ok(manifest.runId === 'mq-proof-test', 'MQManifest: runId');
    ok(manifest.unitCount === 3, 'MQManifest: 3 units');
    ok(manifest.multiQueryHash === mqReport.multiQueryHash, 'MQManifest: multiQueryHash matches');
    ok(manifest.manifestHash.length === 32, 'MQManifest: manifestHash present');

    // Unit anchors
    ok(manifest.unitAnchors.length === 3, 'MQManifest: 3 anchors');
    ok(manifest.unitAnchors[0].unitId === 'counterparty', 'MQManifest: anchor 0 = counterparty');
    ok(manifest.unitAnchors[0].evidenceChainTerminal === pack.units[0].evidenceChainTerminal, 'MQManifest: anchor terminal matches pack');

    // Manifest hash is deterministic: same report → same hash
    const manifest2 = buildMultiQueryManifest(mqReport);
    ok(manifest.manifestHash === manifest2.manifestHash, 'MQManifest: deterministic hash');

    console.log(`    Manifest: hash=${manifest.manifestHash.slice(0, 16)}..., anchors=${manifest.unitAnchors.length}`);

    // ── Render Summary ──
    const summary = renderMultiQuerySummary(mqReport);
    ok(summary.includes('mq-proof-test'), 'MQRender: contains runId');
    ok(summary.includes('BLOCK'), 'MQRender: shows aggregate decision');
    ok(summary.includes('counterparty'), 'MQRender: shows counterparty');
    ok(summary.includes('unsafe'), 'MQRender: shows unsafe');
    ok(summary.includes('multiQueryHash'), 'MQRender: shows hash');

    console.log(`    Render: ${summary.split('\n').length} lines`);
  }

  // ═══ MULTI-QUERY PROOF: ALL PASS ═══
  console.log('\n  [Multi-Query Proof: All Pass]');
  {
    const { runMultiQueryPipeline } = await import('../../src/financial/multi-query-pipeline.js');
    const { buildMultiQueryOutputPack, buildMultiQueryDossier } = await import('../../src/financial/multi-query-proof.js');

    const mqAllPass = runMultiQueryPipeline('mq-proof-allpass', [
      {
        unitId: 'cp1',
        label: 'Counterparty 1',
        input: { runId: 'x', intent: COUNTERPARTY_INTENT, candidateSql: COUNTERPARTY_SQL, fixtures: [COUNTERPARTY_FIXTURE], generatedReport: COUNTERPARTY_REPORT, reportContract: COUNTERPARTY_REPORT_CONTRACT },
      },
    ]);

    const pack = buildMultiQueryOutputPack(mqAllPass);
    const dossier = buildMultiQueryDossier(mqAllPass);

    ok(pack.aggregate.decision === 'pass', 'MQAllPass: pack decision=pass');
    ok(pack.governanceSufficiency.sufficient, 'MQAllPass: governance sufficient');
    ok(pack.blockers.length === 0, 'MQAllPass: no blockers');
    ok(dossier.verdict.includes('PASS'), 'MQAllPass: dossier verdict PASS');
    ok(dossier.governanceSummary.includes('passed'), 'MQAllPass: governance summary confirms pass');

    console.log(`    All pass: decision=${pack.aggregate.decision}, verdict="${dossier.verdict}"`);
  }

  // ═══ MULTI-QUERY SIGNED CERTIFICATE ═══
  console.log('\n  [Multi-Query Signed Certificate]');
  {
    const { runMultiQueryPipeline } = await import('../../src/financial/multi-query-pipeline.js');
    const { issueMultiQueryCertificate, verifyMultiQueryCertificate } = await import('../../src/signing/multi-query-certificate.js');
    const { generateKeyPair } = await import('../../src/signing/keys.js');

    const keyPair = generateKeyPair();

    // Mixed run: pass + block + fail
    const mqReport = runMultiQueryPipeline('mq-cert-test', [
      { unitId: 'cp', label: 'Counterparty', input: { runId: 'x', intent: COUNTERPARTY_INTENT, candidateSql: COUNTERPARTY_SQL, fixtures: [COUNTERPARTY_FIXTURE], generatedReport: COUNTERPARTY_REPORT, reportContract: COUNTERPARTY_REPORT_CONTRACT } },
      { unitId: 'unsafe', label: 'Unsafe SQL', input: { runId: 'x', intent: COUNTERPARTY_INTENT, candidateSql: UNSAFE_SQL_WRITE, fixtures: [] } },
      { unitId: 'recon', label: 'Recon', input: { runId: 'x', intent: RECON_INTENT, candidateSql: RECON_SQL, fixtures: [RECON_FIXTURE] } },
    ]);

    // Issue certificate
    const cert = issueMultiQueryCertificate(mqReport, keyPair);
    ok(cert.type === 'attestor.certificate.multi_query.v1', 'MQCert: correct type');
    ok(cert.certificateId.startsWith('mqcert_'), 'MQCert: ID prefix');
    ok(cert.runId === 'mq-cert-test', 'MQCert: runId preserved');
    ok(cert.aggregateDecision === 'block', 'MQCert: aggregate=block');
    ok(cert.unitCount === 3, 'MQCert: 3 units');
    ok(cert.unitAnchors.length === 3, 'MQCert: 3 unit anchors');
    ok(cert.unitAnchors[0].unitId === 'cp', 'MQCert: first anchor = cp');
    ok(cert.unitAnchors[1].unitId === 'unsafe', 'MQCert: second anchor = unsafe');
    ok(cert.signing.algorithm === 'ed25519', 'MQCert: ed25519 algorithm');
    ok(cert.signing.fingerprint === keyPair.fingerprint, 'MQCert: fingerprint matches');
    ok(cert.signing.signature.length === 128, 'MQCert: 64-byte signature');
    ok(cert.evidence.multiQueryHash === mqReport.multiQueryHash, 'MQCert: multiQueryHash matches');

    // Verify certificate
    const verifyResult = verifyMultiQueryCertificate(cert, keyPair.publicKeyPem);
    ok(verifyResult.signatureValid, 'MQCert: signature valid');
    ok(verifyResult.fingerprintConsistent, 'MQCert: fingerprint consistent');
    ok(verifyResult.schemaValid, 'MQCert: schema valid');
    ok(verifyResult.overall === 'valid', 'MQCert: overall valid');

    // Tamper detection
    const tampered = { ...cert, aggregateDecision: 'pass' };
    const tamperResult = verifyMultiQueryCertificate(tampered as any, keyPair.publicKeyPem);
    ok(!tamperResult.signatureValid, 'MQCert: tampered cert fails verification');

    // Wrong key
    const wrongKey = generateKeyPair();
    const wrongResult = verifyMultiQueryCertificate(cert, wrongKey.publicKeyPem);
    ok(!wrongResult.signatureValid, 'MQCert: wrong key fails verification');

    console.log(`    cert=${cert.certificateId}, units=${cert.unitCount}, verified=${verifyResult.overall}, tamper=${!tamperResult.signatureValid}, wrongKey=${!wrongResult.signatureValid}`);
  }

  // ═══ MULTI-QUERY VERIFICATION KIT ═══
  console.log('\n  [Multi-Query Verification Kit]');
  {
    const { runMultiQueryPipeline } = await import('../../src/financial/multi-query-pipeline.js');
    const { buildMultiQueryVerificationKit } = await import('../../src/financial/multi-query-proof.js');
    const { generateKeyPair } = await import('../../src/signing/keys.js');

    const keyPair = generateKeyPair();

    // All-pass scenario
    const mqPass = runMultiQueryPipeline('mq-kit-pass', [
      { unitId: 'cp', label: 'Counterparty', input: { runId: 'x', intent: COUNTERPARTY_INTENT, candidateSql: COUNTERPARTY_SQL, fixtures: [COUNTERPARTY_FIXTURE], generatedReport: COUNTERPARTY_REPORT, reportContract: COUNTERPARTY_REPORT_CONTRACT } },
    ]);

    const kit = buildMultiQueryVerificationKit(mqPass, keyPair);
    ok(kit.type === 'attestor.verification_kit.multi_query.v1', 'MQKit: correct type');
    ok(kit.certificate.type === 'attestor.certificate.multi_query.v1', 'MQKit: certificate type');
    ok(kit.manifest.type === 'attestor.multi_query_manifest.v1', 'MQKit: manifest type');
    ok(kit.signerPublicKeyPem === keyPair.publicKeyPem, 'MQKit: public key preserved');

    // Verification summary
    ok(kit.verification.cryptographic.valid, 'MQKit: crypto valid');
    ok(kit.verification.structural.valid, 'MQKit: structural valid');
    ok(kit.verification.governanceSufficiency.sufficient, 'MQKit: governance sufficient');
    ok(kit.verification.unitCount === 1, 'MQKit: 1 unit');
    ok(kit.verification.aggregateDecision === 'pass', 'MQKit: aggregate=pass');
    ok(kit.verification.overall === 'proof_degraded', 'MQKit: offline fixture = proof_degraded');

    // Mixed scenario → governance_insufficient
    const mqMixed = runMultiQueryPipeline('mq-kit-mixed', [
      { unitId: 'cp', label: 'Counterparty', input: { runId: 'x', intent: COUNTERPARTY_INTENT, candidateSql: COUNTERPARTY_SQL, fixtures: [COUNTERPARTY_FIXTURE], generatedReport: COUNTERPARTY_REPORT, reportContract: COUNTERPARTY_REPORT_CONTRACT } },
      { unitId: 'unsafe', label: 'Unsafe', input: { runId: 'x', intent: COUNTERPARTY_INTENT, candidateSql: UNSAFE_SQL_WRITE, fixtures: [] } },
    ]);
    const kitMixed = buildMultiQueryVerificationKit(mqMixed, keyPair);
    ok(!kitMixed.verification.governanceSufficiency.sufficient, 'MQKit(mixed): governance insufficient');
    ok(kitMixed.verification.overall === 'governance_insufficient', 'MQKit(mixed): overall=governance_insufficient');
    ok(kitMixed.verification.cryptographic.valid, 'MQKit(mixed): crypto still valid');

    console.log(`    pass: overall=${kit.verification.overall}, mixed: overall=${kitMixed.verification.overall}`);

    // Without reviewer: endorsement dimension should be absent
    ok(!kit.verification.reviewerEndorsement.present, 'MQKit(noReviewer): not present');
    ok(!kit.verification.reviewerEndorsement.verified, 'MQKit(noReviewer): not verified');
  }

  // ═══ MULTI-QUERY REVIEWER ENDORSEMENT ═══
  console.log('\n  [Multi-Query Reviewer Endorsement]');
  {
    const { runMultiQueryPipeline } = await import('../../src/financial/multi-query-pipeline.js');
    const { buildMultiQueryVerificationKit } = await import('../../src/financial/multi-query-proof.js');
    const { buildMultiQueryReviewerEndorsement, verifyMultiQueryReviewerEndorsement } = await import('../../src/signing/multi-query-reviewer.js');
    const { generateKeyPair } = await import('../../src/signing/keys.js');

    const signingKey = generateKeyPair();
    const reviewerKey = generateKeyPair();

    const mqReport = runMultiQueryPipeline('mq-reviewer-test', [
      { unitId: 'cp', label: 'Counterparty', input: { runId: 'x', intent: COUNTERPARTY_INTENT, candidateSql: COUNTERPARTY_SQL, fixtures: [COUNTERPARTY_FIXTURE], generatedReport: COUNTERPARTY_REPORT, reportContract: COUNTERPARTY_REPORT_CONTRACT } },
      { unitId: 'recon', label: 'Recon', input: { runId: 'x', intent: RECON_INTENT, candidateSql: RECON_SQL, fixtures: [RECON_FIXTURE] } },
    ]);

    // Build signed endorsement
    const endorsement = buildMultiQueryReviewerEndorsement(
      mqReport.runId, mqReport.multiQueryHash, mqReport.unitCount,
      mqReport.aggregateDecision,
      { name: 'Test Reviewer', role: 'risk_officer', identifier: 'test@bank.internal', signerFingerprint: null },
      'Reviewed and approved the aggregate result',
      reviewerKey,
    );

    // Endorsement structure
    ok(endorsement.endorsedDecision === mqReport.aggregateDecision, 'MQReviewer: endorsed decision matches aggregate');
    ok(endorsement.runBinding.runId === 'mq-reviewer-test', 'MQReviewer: bound to correct runId');
    ok(endorsement.runBinding.multiQueryHash === mqReport.multiQueryHash, 'MQReviewer: bound to correct multiQueryHash');
    ok(endorsement.runBinding.unitCount === 2, 'MQReviewer: bound to correct unitCount');
    ok(endorsement.signature !== null, 'MQReviewer: signature present');
    ok(endorsement.signature!.length === 128, 'MQReviewer: 64-byte signature');
    ok(endorsement.reviewer.signerFingerprint === reviewerKey.fingerprint, 'MQReviewer: fingerprint set');

    // Verify endorsement independently
    const verifyResult = verifyMultiQueryReviewerEndorsement(
      endorsement, reviewerKey.publicKeyPem,
      mqReport.runId, mqReport.multiQueryHash,
    );
    ok(verifyResult.valid, 'MQReviewer: signature valid');
    ok(verifyResult.fingerprintMatch, 'MQReviewer: fingerprint matches');
    ok(verifyResult.boundToRun, 'MQReviewer: bound to run');
    ok(!verifyResult.bindingMismatch, 'MQReviewer: no binding mismatch');

    // Tamper detection: change rationale
    const tampered = { ...endorsement, rationale: 'TAMPERED' };
    const tamperResult = verifyMultiQueryReviewerEndorsement(tampered, reviewerKey.publicKeyPem);
    ok(!tamperResult.valid, 'MQReviewer: tampered endorsement fails');

    // Replay rejection: check against wrong runId
    const replayResult = verifyMultiQueryReviewerEndorsement(
      endorsement, reviewerKey.publicKeyPem,
      'different-run-id', mqReport.multiQueryHash,
    );
    ok(replayResult.bindingMismatch, 'MQReviewer: replay detected (wrong runId)');

    // Replay rejection: wrong multiQueryHash
    const replayResult2 = verifyMultiQueryReviewerEndorsement(
      endorsement, reviewerKey.publicKeyPem,
      mqReport.runId, 'aaaa' + mqReport.multiQueryHash.slice(4),
    );
    ok(replayResult2.bindingMismatch, 'MQReviewer: replay detected (wrong hash)');

    // Wrong key
    const wrongKey = generateKeyPair();
    const wrongResult = verifyMultiQueryReviewerEndorsement(endorsement, wrongKey.publicKeyPem);
    ok(!wrongResult.valid, 'MQReviewer: wrong key fails');

    console.log(`    endorsement: signed=${!!endorsement.signature}, verified=${verifyResult.valid}, tamper=${!tamperResult.valid}, replay1=${replayResult.bindingMismatch}, replay2=${replayResult2.bindingMismatch}`);

    // Build kit WITH reviewer endorsement
    const kit = buildMultiQueryVerificationKit(mqReport, signingKey, endorsement, reviewerKey.publicKeyPem);
    ok(kit.reviewerEndorsement !== null, 'MQReviewerKit: endorsement in kit');
    ok(kit.reviewerPublicKeyPem === reviewerKey.publicKeyPem, 'MQReviewerKit: reviewer key in kit');
    ok(kit.verification.reviewerEndorsement.present, 'MQReviewerKit: reviewer present');
    ok(kit.verification.reviewerEndorsement.signed, 'MQReviewerKit: reviewer signed');
    ok(kit.verification.reviewerEndorsement.boundToRun, 'MQReviewerKit: reviewer bound');
    ok(kit.verification.reviewerEndorsement.verified, 'MQReviewerKit: reviewer verified');
    ok(kit.verification.reviewerEndorsement.reviewerName === 'Test Reviewer', 'MQReviewerKit: reviewer name');

    // Kit without reviewer key → present + signed but not verified
    const kitNoKey = buildMultiQueryVerificationKit(mqReport, signingKey, endorsement, null);
    ok(kitNoKey.verification.reviewerEndorsement.present, 'MQReviewerKit(noKey): present');
    ok(kitNoKey.verification.reviewerEndorsement.signed, 'MQReviewerKit(noKey): signed');
    ok(!kitNoKey.verification.reviewerEndorsement.verified, 'MQReviewerKit(noKey): NOT verified');

    console.log(`    kit: present=${kit.verification.reviewerEndorsement.present}, verified=${kit.verification.reviewerEndorsement.verified}, noKey=${!kitNoKey.verification.reviewerEndorsement.verified}`);
  }

}
