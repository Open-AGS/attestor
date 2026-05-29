

import type { FinancialTestContext } from './helpers.js';

export async function runReviewerIdentityFinancialTests({ ok }: FinancialTestContext): Promise<void> {
  // ── Workflow-Bound Reviewer Identity ──
  console.log('\n  [Workflow-Bound Reviewer Identity]');
  {
    const { runFinancialPipeline } = await import('../../src/financial/pipeline.js');
    const { COUNTERPARTY_SQL, COUNTERPARTY_INTENT, COUNTERPARTY_FIXTURE, COUNTERPARTY_REPORT_CONTRACT, COUNTERPARTY_REPORT } = await import('../../src/financial/fixtures/scenarios.js');

    // Scenario: Approved run with reviewer identity
    const reviewerIdentity = {
      name: 'Jane Chen',
      role: 'risk_officer',
      identifier: 'jchen@bank.internal',
      signerFingerprint: null, // not yet Ed25519-signed
    };
    const approvedReport = runFinancialPipeline({
      runId: 'reviewer-id-test',
      intent: { ...COUNTERPARTY_INTENT, materialityTier: 'high' as const },
      candidateSql: COUNTERPARTY_SQL,
      fixtures: [COUNTERPARTY_FIXTURE],
      generatedReport: COUNTERPARTY_REPORT,
      reportContract: COUNTERPARTY_REPORT_CONTRACT,
      approval: { status: 'approved', reviewerRole: 'risk_officer', reviewNote: 'Exposure within limits', reviewerIdentity },
    });

    // Reviewer identity propagates
    ok(approvedReport.oversight.reviewerIdentity !== null, 'Reviewer: identity present in oversight');
    ok(approvedReport.oversight.reviewerIdentity!.name === 'Jane Chen', 'Reviewer: name preserved');
    ok(approvedReport.oversight.reviewerIdentity!.role === 'risk_officer', 'Reviewer: role preserved');
    ok(approvedReport.oversight.reviewerIdentity!.identifier === 'jchen@bank.internal', 'Reviewer: identifier preserved');
    ok(approvedReport.oversight.reviewerIdentity!.signerFingerprint === null, 'Reviewer: unsigned (no fingerprint yet)');

    // Decision should be approved (not pending) since approval was provided
    ok(approvedReport.decision === 'pass', 'Reviewer: approved high-materiality → decision pass');

    // Reviewer identity in output pack
    ok(approvedReport.outputPack.oversight.reviewerIdentity !== null, 'Reviewer: identity in output pack');
    ok(approvedReport.outputPack.oversight.reviewerIdentity!.name === 'Jane Chen', 'Reviewer: output pack name');

    // Reviewer identity in dossier
    ok(approvedReport.dossier.reviewPath.reviewerIdentity !== null, 'Reviewer: identity in dossier');
    ok(approvedReport.dossier.reviewPath.reviewerIdentity!.identifier === 'jchen@bank.internal', 'Reviewer: dossier identifier');

    // Without reviewer identity — null
    const noIdReport = runFinancialPipeline({
      runId: 'reviewer-noid-test',
      intent: { ...COUNTERPARTY_INTENT, materialityTier: 'high' as const },
      candidateSql: COUNTERPARTY_SQL,
      fixtures: [COUNTERPARTY_FIXTURE],
      generatedReport: COUNTERPARTY_REPORT,
      reportContract: COUNTERPARTY_REPORT_CONTRACT,
      approval: { status: 'approved', reviewerRole: 'risk_officer', reviewNote: 'OK' },
    });
    ok(noIdReport.oversight.reviewerIdentity === null, 'Reviewer: no identity when not provided');

    console.log(`    With identity: reviewer=${approvedReport.oversight.reviewerIdentity!.name}, role=${approvedReport.oversight.reviewerIdentity!.role}, decision=${approvedReport.decision}`);
    console.log(`    Without identity: reviewerIdentity=${noIdReport.oversight.reviewerIdentity}`);

    // Test: Role normalization — identity role overrides approval.reviewerRole
    const mismatchReport = runFinancialPipeline({
      runId: 'reviewer-mismatch-test',
      intent: { ...COUNTERPARTY_INTENT, materialityTier: 'high' as const },
      candidateSql: COUNTERPARTY_SQL,
      fixtures: [COUNTERPARTY_FIXTURE],
      generatedReport: COUNTERPARTY_REPORT,
      reportContract: COUNTERPARTY_REPORT_CONTRACT,
      approval: { status: 'approved', reviewerRole: 'old_role', reviewNote: 'OK', reviewerIdentity: { name: 'Bob Lee', role: 'compliance_officer', identifier: 'blee@bank.internal', signerFingerprint: null } },
    });
    ok(mismatchReport.oversight.reviewerRole === 'compliance_officer', 'Reviewer: identity role overrides approval.reviewerRole');
    ok(mismatchReport.oversight.reviewerIdentity!.role === 'compliance_officer', 'Reviewer: identity role consistent');

    // Test: Endorsement created when identity is provided
    ok(mismatchReport.oversight.endorsement !== null, 'Endorsement: created when identity provided');
    ok(mismatchReport.oversight.endorsement!.reviewer.name === 'Bob Lee', 'Endorsement: reviewer name');
    ok(mismatchReport.oversight.endorsement!.endorsedDecision === 'approved', 'Endorsement: endorsed decision');
    ok(mismatchReport.oversight.endorsement!.rationale === 'OK', 'Endorsement: rationale');
    ok(mismatchReport.oversight.endorsement!.scope.includes('output_pack'), 'Endorsement: scope includes output_pack');
    ok(mismatchReport.oversight.endorsement!.signature === null, 'Endorsement: unsigned (no Ed25519 yet)');

    // Test: Endorsement in output pack
    ok(mismatchReport.outputPack.oversight.endorsement !== null, 'Endorsement: present in output pack');
    ok(mismatchReport.outputPack.oversight.endorsement!.reviewerName === 'Bob Lee', 'Endorsement: output pack reviewer name');
    ok(mismatchReport.outputPack.oversight.endorsement!.signed === false, 'Endorsement: output pack unsigned');

    // Test: No endorsement when no identity
    ok(noIdReport.oversight.endorsement === null, 'Endorsement: null when no identity');

    console.log(`    Role normalization: approval.role='old_role', identity.role='${mismatchReport.oversight.reviewerRole}' → identity wins`);
    console.log(`    Endorsement: reviewer=${mismatchReport.oversight.endorsement!.reviewer.name}, decision=${mismatchReport.oversight.endorsement!.endorsedDecision}, signed=${mismatchReport.oversight.endorsement!.signature !== null}`);

    // Test: Endorsement in dossier review path
    ok(mismatchReport.dossier.reviewPath.endorsement !== null, 'Dossier: endorsement present in review path');
    ok(mismatchReport.dossier.reviewPath.endorsement!.reviewerName === 'Bob Lee', 'Dossier: endorsement reviewer name');
    ok(mismatchReport.dossier.reviewPath.endorsement!.signed === false, 'Dossier: endorsement unsigned');

    // Test: Reviewer-signed endorsement with Ed25519
    const { generateKeyPair: genReviewerKey } = await import('../../src/signing/keys.js');
    const { verifyReviewerEndorsement } = await import('../../src/signing/reviewer-endorsement.js');
    const reviewerKeyPair = genReviewerKey();

    const signedReport = runFinancialPipeline({
      runId: 'reviewer-signed-test',
      intent: { ...COUNTERPARTY_INTENT, materialityTier: 'high' as const },
      candidateSql: COUNTERPARTY_SQL,
      fixtures: [COUNTERPARTY_FIXTURE],
      generatedReport: COUNTERPARTY_REPORT,
      reportContract: COUNTERPARTY_REPORT_CONTRACT,
      approval: {
        status: 'approved',
        reviewerRole: 'risk_officer',
        reviewNote: 'Exposure within approved limits',
        reviewerIdentity: { name: 'Alice Park', role: 'risk_officer', identifier: 'apark@bank.internal', signerFingerprint: null },
        reviewerKeyPair,
      },
    });

    // Endorsement is signed
    ok(signedReport.oversight.endorsement !== null, 'Signed: endorsement exists');
    ok(signedReport.oversight.endorsement!.signature !== null, 'Signed: endorsement has signature');
    ok(signedReport.oversight.endorsement!.signature!.length === 128, 'Signed: signature is 64 bytes (128 hex)');
    ok(signedReport.oversight.endorsement!.reviewer.signerFingerprint === reviewerKeyPair.fingerprint, 'Signed: reviewer fingerprint set');

    // Verify the endorsement independently
    const verifyResult = verifyReviewerEndorsement(signedReport.oversight.endorsement!, reviewerKeyPair.publicKeyPem);
    ok(verifyResult.valid, 'Signed: endorsement signature valid');
    ok(verifyResult.fingerprintMatch, 'Signed: fingerprint matches');

    // Tamper detection
    const tampered = { ...signedReport.oversight.endorsement!, rationale: 'TAMPERED' };
    const tamperVerify = verifyReviewerEndorsement(tampered, reviewerKeyPair.publicKeyPem);
    ok(!tamperVerify.valid, 'Signed: tampered endorsement fails verification');

    // Endorsement surfaced as signed in artifacts
    ok(signedReport.outputPack.oversight.endorsement!.signed === true, 'Signed: output pack shows signed=true');
    ok(signedReport.dossier.reviewPath.endorsement!.signed === true, 'Signed: dossier shows signed=true');

    console.log(`    Signed endorsement: reviewer=${signedReport.oversight.endorsement!.reviewer.name}, fingerprint=${signedReport.oversight.endorsement!.reviewer.signerFingerprint}, verified=${verifyResult.valid}`);

    // ═══ RUN-BOUND ENDORSEMENT ═══
    console.log('\n  [Run-Bound Endorsement]');

    // Endorsement is bound to the specific run
    ok(signedReport.oversight.endorsement!.runBinding !== null, 'RunBound: endorsement has runBinding');
    ok(signedReport.oversight.endorsement!.runBinding!.runId === 'reviewer-signed-test', 'RunBound: bound to correct runId');
    ok(signedReport.oversight.endorsement!.runBinding!.replayIdentity.length > 0, 'RunBound: replayIdentity populated');
    ok(signedReport.oversight.endorsement!.runBinding!.evidenceChainTerminal.length > 0, 'RunBound: evidenceChainTerminal populated');

    // Run binding matches evidence chain
    ok(
      signedReport.oversight.endorsement!.runBinding!.evidenceChainTerminal === signedReport.evidenceChain.terminalHash,
      'RunBound: evidenceChainTerminal matches report evidence chain',
    );

    // Run binding matches replay identity
    ok(
      signedReport.oversight.endorsement!.runBinding!.replayIdentity === signedReport.replayMetadata.replayIdentity,
      'RunBound: replayIdentity matches report replay metadata',
    );

    console.log(`    RunBinding: runId=${signedReport.oversight.endorsement!.runBinding!.runId}, terminal=${signedReport.oversight.endorsement!.runBinding!.evidenceChainTerminal.slice(0, 12)}...`);

    // ═══ REPLAY REJECTION ═══
    console.log('\n  [Replay Rejection]');

    // Replay attack: take a valid signed endorsement and change the runBinding
    const replayedEndorsement = {
      ...signedReport.oversight.endorsement!,
      runBinding: {
        ...signedReport.oversight.endorsement!.runBinding!,
        runId: 'different-run-id',
      },
    };
    const replayVerify = verifyReviewerEndorsement(replayedEndorsement, reviewerKeyPair.publicKeyPem);
    ok(!replayVerify.valid, 'Replay: changing runId breaks signature');

    // Replay attack: change evidenceChainTerminal
    const replayedEndorsement2 = {
      ...signedReport.oversight.endorsement!,
      runBinding: {
        ...signedReport.oversight.endorsement!.runBinding!,
        evidenceChainTerminal: 'aaaa' + signedReport.oversight.endorsement!.runBinding!.evidenceChainTerminal.slice(4),
      },
    };
    const replayVerify2 = verifyReviewerEndorsement(replayedEndorsement2, reviewerKeyPair.publicKeyPem);
    ok(!replayVerify2.valid, 'Replay: changing evidenceChainTerminal breaks signature');

    // Replay attack: change replayIdentity
    const replayedEndorsement3 = {
      ...signedReport.oversight.endorsement!,
      runBinding: {
        ...signedReport.oversight.endorsement!.runBinding!,
        replayIdentity: 'forged-replay-identity',
      },
    };
    const replayVerify3 = verifyReviewerEndorsement(replayedEndorsement3, reviewerKeyPair.publicKeyPem);
    ok(!replayVerify3.valid, 'Replay: changing replayIdentity breaks signature');

    // Original still verifies (proves we didn't break anything with replay tests)
    const reVerify = verifyReviewerEndorsement(signedReport.oversight.endorsement!, reviewerKeyPair.publicKeyPem);
    ok(reVerify.valid, 'Replay: original endorsement still valid after replay tests');

    console.log(`    Replay rejection: runId=${!replayVerify.valid}, terminal=${!replayVerify2.valid}, replay=${!replayVerify3.valid}`);

    // ═══ KIT-LEVEL VERIFICATION ═══
    console.log('\n  [Kit-Level Reviewer Verification]');

    const { buildVerificationKit } = await import('../../src/signing/bundle.js');
    const { generatePkiHierarchy } = await import('../../src/signing/pki-chain.js');
    const testPki = generatePkiHierarchy('Test CA', 'Test Signer', 'Test Reviewer');
    const certKeyPair = testPki.signer.keyPair;

    // Run a signed pipeline with both certificate signing key and reviewer key
    const kitReport = runFinancialPipeline({
      runId: 'kit-reviewer-test',
      intent: { ...COUNTERPARTY_INTENT, materialityTier: 'high' as const },
      candidateSql: COUNTERPARTY_SQL,
      fixtures: [COUNTERPARTY_FIXTURE],
      generatedReport: COUNTERPARTY_REPORT,
      reportContract: COUNTERPARTY_REPORT_CONTRACT,
      signingKeyPair: certKeyPair,
      approval: {
        status: 'approved',
        reviewerRole: 'risk_officer',
        reviewNote: 'Full review complete',
        reviewerIdentity: { name: 'Jane Chen', role: 'risk_officer', identifier: 'jchen@bank.internal', signerFingerprint: null },
        reviewerKeyPair,
      },
    });

    ok(kitReport.certificate !== null, 'Kit: certificate issued');
    ok(kitReport.oversight.endorsement !== null, 'Kit: endorsement present');
    ok(kitReport.oversight.endorsement!.signature !== null, 'Kit: endorsement signed');
    ok(kitReport.oversight.endorsement!.runBinding !== null, 'Kit: endorsement run-bound');

    // Build verification kit with reviewer public key + PKI trust chain
    const kit = buildVerificationKit(
      kitReport, certKeyPair.publicKeyPem, reviewerKeyPair.publicKeyPem,
      testPki.chains.signer, testPki.ca.keyPair.publicKeyPem,
    );
    ok(kit !== null, 'Kit: built successfully');

    // Kit carries PKI material
    ok(kit!.trustChain !== null, 'Kit: trustChain present');
    ok(kit!.caPublicKeyPem !== null, 'Kit: caPublicKeyPem present');
    ok(kit!.trustChain!.type === 'attestor.trust_chain.v1', 'Kit: trustChain type correct');

    // Kit carries reviewer material
    ok(kit!.reviewerEndorsement !== null, 'Kit: reviewerEndorsement present');
    ok(kit!.reviewerPublicKeyPem === reviewerKeyPair.publicKeyPem, 'Kit: reviewerPublicKeyPem present');

    // 6-dimensional verification summary
    const v = kit!.verification;
    ok(v.cryptographic.valid, 'Kit: certificate signature valid');
    ok(v.structural.valid, 'Kit: structural valid');
    ok(v.reviewerEndorsement.present, 'Kit: reviewer present');
    ok(v.reviewerEndorsement.signed, 'Kit: reviewer signed');
    ok(v.reviewerEndorsement.boundToRun, 'Kit: reviewer bound to run');
    ok(v.reviewerEndorsement.verified, 'Kit: reviewer verified');
    ok(v.reviewerEndorsement.reviewerName === 'Jane Chen', 'Kit: reviewer name in summary');
    ok(v.reviewerEndorsement.fingerprint === reviewerKeyPair.fingerprint, 'Kit: reviewer fingerprint in summary');

    console.log(`    Kit verification: present=${v.reviewerEndorsement.present}, signed=${v.reviewerEndorsement.signed}, bound=${v.reviewerEndorsement.boundToRun}, verified=${v.reviewerEndorsement.verified}`);

    // Kit without reviewer key → not verified but present/signed/bound
    const kitNoKey = buildVerificationKit(kitReport, certKeyPair.publicKeyPem, null);
    ok(kitNoKey!.verification.reviewerEndorsement.present, 'Kit(noKey): present');
    ok(kitNoKey!.verification.reviewerEndorsement.signed, 'Kit(noKey): signed');
    ok(kitNoKey!.verification.reviewerEndorsement.boundToRun, 'Kit(noKey): bound');
    ok(!kitNoKey!.verification.reviewerEndorsement.verified, 'Kit(noKey): NOT verified without key');

    console.log(`    Without reviewer key: present=${kitNoKey!.verification.reviewerEndorsement.present}, verified=${kitNoKey!.verification.reviewerEndorsement.verified}`);

    // Kit from run without endorsement → all false
    const noEndorsementReport = runFinancialPipeline({
      runId: 'kit-no-endorsement',
      intent: COUNTERPARTY_INTENT,
      candidateSql: COUNTERPARTY_SQL,
      fixtures: [COUNTERPARTY_FIXTURE],
      generatedReport: COUNTERPARTY_REPORT,
      reportContract: COUNTERPARTY_REPORT_CONTRACT,
      signingKeyPair: certKeyPair,
    });
    const kitNoEndorsement = buildVerificationKit(noEndorsementReport, certKeyPair.publicKeyPem, null);
    ok(!kitNoEndorsement!.verification.reviewerEndorsement.present, 'Kit(noEndorsement): not present');
    ok(!kitNoEndorsement!.verification.reviewerEndorsement.signed, 'Kit(noEndorsement): not signed');
    ok(!kitNoEndorsement!.verification.reviewerEndorsement.boundToRun, 'Kit(noEndorsement): not bound');
    ok(!kitNoEndorsement!.verification.reviewerEndorsement.verified, 'Kit(noEndorsement): not verified');

    console.log(`    No endorsement: present=${kitNoEndorsement!.verification.reviewerEndorsement.present}`);

    // Bundle carries enriched endorsement (run binding + fingerprint)
    const { buildAuthorityBundle } = await import('../../src/signing/bundle.js');
    const bundle = buildAuthorityBundle(kitReport);
    ok(bundle.governance.review.endorsement !== null, 'Bundle: endorsement present');
    ok(bundle.governance.review.endorsement!.signed === true, 'Bundle: endorsement signed');
    ok(bundle.governance.review.endorsement!.runBinding !== null, 'Bundle: endorsement has runBinding');
    ok(bundle.governance.review.endorsement!.runBinding!.runId === 'kit-reviewer-test', 'Bundle: correct runId');
    ok(bundle.governance.review.endorsement!.signerFingerprint === reviewerKeyPair.fingerprint, 'Bundle: reviewer fingerprint');

    console.log(`    Bundle endorsement: signed=${bundle.governance.review.endorsement!.signed}, runBinding=${bundle.governance.review.endorsement!.runBinding!.runId}, fingerprint=${bundle.governance.review.endorsement!.signerFingerprint}`);

    // Bundle carries replayIdentity in evidence
    ok(bundle.evidence.replayIdentity.length > 0, 'Bundle: replayIdentity in evidence');
    ok(bundle.evidence.replayIdentity === kitReport.replayMetadata.replayIdentity, 'Bundle: replayIdentity matches report');

    // ═══ KIT-LEVEL BINDING MISMATCH DETECTION ═══
    console.log('\n  [Kit-Level Binding Mismatch]');

    const { buildVerificationSummary } = await import('../../src/signing/bundle.js');
    const { verifyCertificate } = await import('../../src/signing/certificate.js');

    // Take a valid signed endorsement from one run and inject it into a different run's kit
    const otherReport = runFinancialPipeline({
      runId: 'kit-other-run',
      intent: { ...COUNTERPARTY_INTENT, materialityTier: 'high' as const },
      candidateSql: COUNTERPARTY_SQL,
      fixtures: [COUNTERPARTY_FIXTURE],
      generatedReport: COUNTERPARTY_REPORT,
      reportContract: COUNTERPARTY_REPORT_CONTRACT,
      signingKeyPair: certKeyPair,
      approval: {
        status: 'approved',
        reviewerRole: 'risk_officer',
        reviewNote: 'Other run review',
        reviewerIdentity: { name: 'Jane Chen', role: 'risk_officer', identifier: 'jchen@bank.internal', signerFingerprint: null },
        reviewerKeyPair,
      },
    });
    const otherBundle = buildAuthorityBundle(otherReport);
    const otherCrypto = verifyCertificate(otherReport.certificate!, certKeyPair.publicKeyPem);

    // Steal the signed endorsement from kitReport and inject into otherReport's verification summary
    const stolenEndorsement = kitReport.oversight.endorsement!;
    const mismatchSummary = buildVerificationSummary(
      otherReport.certificate!,
      otherBundle,
      otherCrypto,
      stolenEndorsement,          // endorsement from a DIFFERENT run
      reviewerKeyPair.publicKeyPem,
    );

    // The stolen endorsement is signed and has run binding, but NOT bound to THIS run
    ok(mismatchSummary.reviewerEndorsement.present, 'Mismatch: endorsement present');
    ok(mismatchSummary.reviewerEndorsement.signed, 'Mismatch: endorsement signed');
    ok(!mismatchSummary.reviewerEndorsement.boundToRun, 'Mismatch: NOT bound to this run');
    ok(mismatchSummary.reviewerEndorsement.bindingMismatch, 'Mismatch: bindingMismatch=true');
    ok(!mismatchSummary.reviewerEndorsement.verified, 'Mismatch: NOT verified (binding mismatch blocks verification)');

    // The correct endorsement in the correct kit still passes
    const correctSummary = buildVerificationSummary(
      kitReport.certificate!,
      bundle,
      verifyCertificate(kitReport.certificate!, certKeyPair.publicKeyPem),
      kitReport.oversight.endorsement!,
      reviewerKeyPair.publicKeyPem,
    );
    ok(correctSummary.reviewerEndorsement.boundToRun, 'Correct: bound to run');
    ok(!correctSummary.reviewerEndorsement.bindingMismatch, 'Correct: no mismatch');
    ok(correctSummary.reviewerEndorsement.verified, 'Correct: verified');

    console.log(`    Mismatch detection: bound=${mismatchSummary.reviewerEndorsement.boundToRun}, mismatch=${mismatchSummary.reviewerEndorsement.bindingMismatch}, verified=${mismatchSummary.reviewerEndorsement.verified}`);
    console.log(`    Correct kit: bound=${correctSummary.reviewerEndorsement.boundToRun}, mismatch=${correctSummary.reviewerEndorsement.bindingMismatch}, verified=${correctSummary.reviewerEndorsement.verified}`);

    // ═══ BINDING MISMATCH: runId match but terminal mismatch ═══
    // Craft a scenario where runId matches but chainTerminal doesn't
    const partialMismatchEndorsement = {
      ...kitReport.oversight.endorsement!,
      runBinding: {
        ...kitReport.oversight.endorsement!.runBinding!,
        evidenceChainTerminal: 'ffff' + kitReport.oversight.endorsement!.runBinding!.evidenceChainTerminal.slice(4),
      },
    };
    const partialSummary = buildVerificationSummary(
      kitReport.certificate!,
      bundle,
      verifyCertificate(kitReport.certificate!, certKeyPair.publicKeyPem),
      partialMismatchEndorsement,
      reviewerKeyPair.publicKeyPem,
    );
    ok(!partialSummary.reviewerEndorsement.boundToRun, 'PartialMismatch: terminal mismatch → not bound');
    ok(partialSummary.reviewerEndorsement.bindingMismatch, 'PartialMismatch: detected as mismatch');
    ok(!partialSummary.reviewerEndorsement.verified, 'PartialMismatch: not verified');

    console.log(`    Partial mismatch (terminal): bound=${partialSummary.reviewerEndorsement.boundToRun}, mismatch=${partialSummary.reviewerEndorsement.bindingMismatch}`);

    // ═══ NO BINDING AT ALL ═══
    const unboundEndorsement = {
      ...kitReport.oversight.endorsement!,
      runBinding: null,
    };
    const unboundSummary = buildVerificationSummary(
      kitReport.certificate!,
      bundle,
      verifyCertificate(kitReport.certificate!, certKeyPair.publicKeyPem),
      unboundEndorsement,
      reviewerKeyPair.publicKeyPem,
    );
    ok(!unboundSummary.reviewerEndorsement.boundToRun, 'Unbound: not bound');
    ok(!unboundSummary.reviewerEndorsement.bindingMismatch, 'Unbound: no mismatch (no binding to mismatch)');
    ok(!unboundSummary.reviewerEndorsement.verified, 'Unbound: not verified');

    console.log(`    No binding: bound=${unboundSummary.reviewerEndorsement.boundToRun}, mismatch=${unboundSummary.reviewerEndorsement.bindingMismatch}`);
  }

}
