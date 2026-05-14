/**
 * Attestor Verify CLI - certificate and verification-kit verification.
 *
 * Usage:
 *   npx tsx src/signing/verify-cli.ts <certificate.json> <public-key.pem>
 *   npx tsx src/signing/verify-cli.ts <kit.json>
 *   npx tsx src/signing/verify-cli.ts <kit.json> --trusted-ca-fingerprint <fingerprint>
 *   npx tsx src/signing/verify-cli.ts <kit.json> --developer-mode
 */

import { readFileSync } from 'node:fs';
import { verifyCertificate, type AttestationCertificate } from './certificate.js';
import { buildVerificationSummary, type AuthorityBundle, type VerificationKit } from './bundle.js';
import { verifyPkiBoundCertificate } from './verification-trust-binding.js';

function main(): void {
  const args = process.argv.slice(2);

  if (args.length < 1 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
  Attestor Verify

  Usage:
    npx tsx src/signing/verify-cli.ts <certificate.json> <public-key.pem>
    npx tsx src/signing/verify-cli.ts <kit.json>
    npx tsx src/signing/verify-cli.ts <kit.json> --trusted-ca-fingerprint <fingerprint>
    npx tsx src/signing/verify-cli.ts <kit.json> --developer-mode

  Exit codes:
    0  Fully verified
    1  Verification failed or degraded
    2  Usage error or PKI material missing
`);
    process.exit(args.length < 1 ? 2 : 0);
  }

  try {
    const firstFile = JSON.parse(readFileSync(args[0], 'utf-8')) as {
      readonly type?: string;
    };

    if (firstFile.type === 'attestor.verification_kit.v1') {
      verifyKit(firstFile as VerificationKit);
    } else if (firstFile.type === 'attestor.certificate.v1') {
      if (!args[1]) {
        console.error('  FAIL Certificate verification requires a public key PEM file as second argument.');
        process.exit(2);
      }
      const publicKeyPem = readFileSync(args[1], 'utf-8');
      verifyCertificateStandalone(firstFile as AttestationCertificate, publicKeyPem);
    } else {
      console.error(`  FAIL Unknown artifact type: ${firstFile.type ?? 'none'}`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`  FAIL Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

function trustedCaFingerprintFromArgs(): string | null {
  const args = process.argv.slice(2);
  const flagIndex = args.indexOf('--trusted-ca-fingerprint');
  if (flagIndex >= 0) {
    const value = args[flagIndex + 1]?.trim();
    if (!value) {
      throw new Error('--trusted-ca-fingerprint requires a fingerprint value');
    }
    return value;
  }
  const envValue = process.env.ATTESTOR_TRUSTED_CA_FINGERPRINT?.trim();
  return envValue && envValue.length > 0 ? envValue : null;
}

function developerModeFromArgs(): boolean {
  return process.argv.slice(2).includes('--developer-mode');
}

function verifyCertificateStandalone(cert: AttestationCertificate, publicKeyPem: string): void {
  console.log('\n  Attestor Verify - Certificate');
  console.log(`  ID:       ${cert.certificateId}`);
  console.log(`  Run:      ${cert.runIdentity}`);
  console.log(`  Decision: ${cert.decision}`);
  console.log(`  Issued:   ${cert.issuedAt}`);
  console.log(`  Signer:   ${cert.signing?.fingerprint ?? 'unknown'}`);

  const crypto = verifyCertificate(cert, publicKeyPem);
  const minimalBundle: AuthorityBundle = {
    version: '1.0',
    type: 'attestor.authority_bundle.v1',
    runId: cert.runIdentity,
    timestamp: cert.issuedAt,
    decision: cert.decision,
    authority: {
      warrant: {
        id: 'from-cert',
        status: cert.authority.warrantStatus,
        trustLevel: 'unknown',
        obligationsFulfilled: cert.authority.obligationsFulfilled,
        obligationsTotal: cert.authority.obligationsTotal,
      },
      escrow: {
        state: cert.authority.escrowState,
        releasedCount: 0,
        totalObligations: 0,
        reviewHeld: false,
      },
      receipt: {
        id: null,
        status: cert.authority.receiptStatus,
        signatureMode: 'unknown',
      },
      capsule: {
        id: null,
        authorityState: cert.authority.capsuleAuthority,
        factCount: 0,
      },
    },
    evidence: {
      chainRoot: cert.evidence.evidenceChainRoot,
      chainTerminal: cert.evidence.evidenceChainTerminal,
      replayIdentity: cert.runIdentity,
      auditEntryCount: cert.evidence.auditEntryCount,
      auditChainIntact: cert.evidence.auditChainIntact,
      sqlHash: cert.evidence.sqlHash,
      snapshotHash: cert.evidence.snapshotHash,
    },
    governance: {
      sqlGovernance: { result: cert.governance.sqlGovernance, gatesPassed: 0, gatesTotal: 0 },
      policy: { result: cert.governance.policy, leastPrivilegePreserved: true },
      guardrails: { result: cert.governance.guardrails, checksRun: 0 },
      dataContracts: { result: cert.governance.dataContracts, checksRun: 0, failedCount: 0 },
      scoring: {
        decision: cert.decision,
        scorersRun: cert.governance.scorersRun,
        passCount: 0,
        failCount: 0,
        warnCount: 0,
      },
      review: { required: cert.governance.reviewRequired, triggeredBy: [], endorsement: null },
    },
    proof: {
      mode: cert.liveProof.mode,
      upstreamLive: cert.liveProof.upstreamLive,
      executionLive: cert.liveProof.executionLive,
      executionProvider: null,
      executionContextHash: null,
      consistent: cert.liveProof.consistent,
      gapCategories: [],
    },
    filing: { status: 'unknown', blockingGapCount: 0 },
  };

  const summary = buildVerificationSummary(cert, minimalBundle, crypto);
  printSummary(summary);
  process.exit(summary.overall === 'verified' ? 0 : 1);
}

function verifyKit(kit: VerificationKit): void {
  console.log('\n  Attestor Verify - Verification Kit');
  console.log(`  Run:      ${kit.bundle.runId}`);
  console.log(`  Decision: ${kit.bundle.decision}`);

  const kitAny = kit as VerificationKit;
  const trustedCaFingerprint = trustedCaFingerprintFromArgs();
  const allowKitContainedCaForDeveloperMode = developerModeFromArgs();
  let pkiVerified = false;
  let pkiVerificationRequired = true;
  let crypto = verifyCertificate(kit.certificate, kit.signerPublicKeyPem);
  let trustBinding: ReturnType<typeof verifyPkiBoundCertificate> | null = null;

  if (kitAny.trustChain && kitAny.caPublicKeyPem) {
    if (!trustedCaFingerprint && !allowKitContainedCaForDeveloperMode) {
      console.log('\n  PKI Trust Chain');
      console.log('  FAIL Trusted CA fingerprint is required for independent third-party kit verification.');
      console.log('  Use --trusted-ca-fingerprint <fingerprint> from an out-of-band trusted source.');
      console.log('  For local developer chain-integrity checks only, rerun with --developer-mode.');
      console.log('\n  Overall: TRUST_ROOT_REQUIRED\n');
      process.exit(2);
    }
    trustBinding = verifyPkiBoundCertificate({
      certificate: kit.certificate,
      publicKeyPem: kit.signerPublicKeyPem,
      trustChain: kitAny.trustChain,
      caPublicKeyPem: kitAny.caPublicKeyPem,
      trustedCaFingerprint,
      allowKitContainedCaForDeveloperMode,
    });
    crypto = trustBinding.certificateVerification;
    pkiVerified = trustBinding.pkiVerified;
  }

  const summary = buildVerificationSummary(
    kit.certificate,
    kit.bundle,
    crypto,
    kit.reviewerEndorsement ?? null,
    kit.reviewerPublicKeyPem ?? null,
  );
  printSummary(summary);

  console.log('\n  PKI Trust Chain');
  if (kitAny.trustChain && kitAny.caPublicKeyPem && trustBinding) {
    const chainResult = trustBinding.chainVerification;
    const leafBound =
      trustBinding.leafMatchesCertificateKey &&
      trustBinding.leafMatchesCertificateFingerprint;

    console.log(`  CA:         ${chainResult.caValid ? 'valid' : 'INVALID'} (${kitAny.trustChain.ca?.name ?? 'unknown'})`);
    console.log(`  Leaf:       ${chainResult.leafValid ? 'valid' : 'INVALID'} (${kitAny.trustChain.leaf?.subject ?? 'unknown'})`);
    console.log(`  Chain:      ${chainResult.chainIntact ? 'intact' : 'BROKEN'}`);
    console.log(`  Cert bound: ${leafBound ? 'certificate matches leaf' : 'MISMATCH'}`);
    if (trustBinding.independentTrustRootVerified) {
      console.log(`  CA pin:     ${trustBinding.trustedCaFingerprintMatch ? 'trusted fingerprint matches' : 'MISMATCH'}`);
    } else {
      console.log('  CA pin:     developer mode; kit-contained root checks integrity only');
    }
    console.log(`  PKI:        ${pkiVerified ? 'VERIFIED' : trustBinding.failureReasons.join(', ')}`);
  } else {
    const allowLegacy =
      process.argv.includes('--allow-legacy-verify') ||
      process.env.ATTESTOR_ALLOW_LEGACY === 'true';
    if (allowLegacy) {
      pkiVerificationRequired = false;
      console.log('  No PKI chain - using legacy flat Ed25519 verification (deprecated)');
      console.log('  This mode will be removed in a future version.');
    } else {
      console.log('  FAIL No PKI chain material - PKI verification is mandatory.');
      console.log('  This kit was issued without trust chain and cannot be fully verified.');
      console.log('  Override: --allow-legacy-verify or ATTESTOR_ALLOW_LEGACY=true');
      console.log('\n  Overall: PKI_REQUIRED\n');
      process.exit(2);
    }
  }

  process.exit(summary.overall === 'verified' && (!pkiVerificationRequired || pkiVerified) ? 0 : 1);
}

function printSummary(s: VerificationSummary): void {
  const icon = (ok: boolean) => (ok ? 'OK' : 'FAIL');

  console.log('\n  Cryptographic');
  console.log(`  ${icon(s.cryptographic.valid)} Signature:   ${s.cryptographic.valid ? 'valid' : 'INVALID'} (${s.cryptographic.algorithm}, ${s.cryptographic.fingerprint})`);

  console.log('\n  Structural');
  console.log(`  ${icon(s.structural.valid)} Schema:      ${s.structural.valid ? 'valid' : 'INVALID'} (${s.structural.version} ${s.structural.type})`);

  console.log('\n  Authority');
  console.log(`  ${icon(s.authority.warrantFulfilled)} Warrant:     ${s.authority.warrantFulfilled ? 'fulfilled' : 'incomplete'}`);
  console.log(`  ${icon(s.authority.escrowReleased)} Escrow:      ${s.authority.escrowReleased ? 'released' : 'held'}`);
  console.log(`  ${icon(s.authority.receiptIssued)} Receipt:     ${s.authority.receiptIssued ? 'issued' : 'pending'}`);
  console.log(`    State:       ${s.authority.state}`);

  console.log('\n  Governance Sufficiency');
  console.log(`  ${icon(s.governanceSufficiency.sqlPass)} SQL:         ${s.governanceSufficiency.sqlPass ? 'pass' : 'FAIL'}`);
  console.log(`  ${icon(s.governanceSufficiency.policyPass)} Policy:      ${s.governanceSufficiency.policyPass ? 'pass' : 'FAIL'}`);
  console.log(`  ${icon(s.governanceSufficiency.guardrailsPass)} Guardrails:  ${s.governanceSufficiency.guardrailsPass ? 'pass' : 'FAIL'}`);
  console.log(`  ${icon(s.governanceSufficiency.sufficient)} Sufficient:  ${s.governanceSufficiency.sufficient ? 'yes' : 'NO'}`);
  console.log(`    Scoring:     ${s.governanceSufficiency.scoringDecision}`);

  console.log('\n  Proof Completeness');
  console.log(`    Mode:        ${s.proofCompleteness.mode}`);
  console.log(`    Upstream:    ${s.proofCompleteness.upstreamLive ? 'live' : 'fixture'}`);
  console.log(`    Execution:   ${s.proofCompleteness.executionLive ? 'live' : 'fixture'}${s.proofCompleteness.executionProvider ? ` (${s.proofCompleteness.executionProvider})` : ''}`);
  if (s.proofCompleteness.hasDbContextEvidence) {
    console.log('    DB context:  execution context hash present');
  }
  console.log(`    Gaps:        ${s.proofCompleteness.gapCount > 0 ? s.proofCompleteness.gaps.join(', ') : 'none'}`);

  console.log('\n  Reviewer Endorsement');
  if (!s.reviewerEndorsement.present) {
    console.log('    (no endorsement)');
  } else {
    console.log(`  ${icon(s.reviewerEndorsement.present)} Present:     yes (${s.reviewerEndorsement.reviewerName ?? 'unknown'})`);
    console.log(`  ${icon(s.reviewerEndorsement.signed)} Signed:      ${s.reviewerEndorsement.signed ? 'yes' : 'no'}${s.reviewerEndorsement.fingerprint ? ` (${s.reviewerEndorsement.fingerprint})` : ''}`);
    if (s.reviewerEndorsement.bindingMismatch) {
      console.log('  FAIL Run-bound:   NO - binding mismatch');
    } else {
      console.log(`  ${icon(s.reviewerEndorsement.boundToRun)} Run-bound:   ${s.reviewerEndorsement.boundToRun ? 'yes' : 'NO - no binding'}`);
    }
    console.log(`  ${icon(s.reviewerEndorsement.verified)} Verified:    ${s.reviewerEndorsement.verified ? 'yes' : 'NO'}`);
  }

  console.log(`\n  Overall: ${s.overall.toUpperCase()}\n`);
}

type VerificationSummary = import('./bundle.js').VerificationSummary;

main();
