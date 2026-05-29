/**
 * Artifact persistence and summary rendering for financial CLI commands.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { buildVerificationKit } from '../../signing/bundle.js';
import type { TrustChain } from '../../signing/pki-chain.js';
import type { FinancialRunReport } from '../types.js';
import type { SqlGenerationMetadata } from './helpers.js';

export type PersistedArtifactPaths = {
  runDir: string;
  report: string;
  outputPack: string;
  dossier: string;
  manifest: string;
  attestation: string | null;
  openLineage: string | null;
  candidateSql: string;
  sqlGeneration: string | null;
  snapshotDir: string | null;
};

export type PersistedPortableProofPaths = {
  outDir: string;
  certificate: string;
  publicKey: string;
  kit: string;
  verificationSummary: string;
  bundle: string;
  reviewerPublicKey: string | null;
  trustChain: string | null;
  caPublicKey: string | null;
};

export function persistFinancialArtifacts(
  report: FinancialRunReport,
  runDir: string,
  extras: { candidateSql: string; sqlGeneration?: SqlGenerationMetadata | null; snapshotDir?: string | null },
): PersistedArtifactPaths {
  mkdirSync(runDir, { recursive: true });

  const reportPath = join(runDir, 'report.json');
  const outputPackPath = join(runDir, 'output-pack.json');
  const dossierPath = join(runDir, 'dossier.json');
  const manifestPath = join(runDir, 'manifest.json');
  const attestationPath = report.attestation ? join(runDir, 'attestation.json') : null;
  const openLineagePath = report.openLineageExport ? join(runDir, 'openlineage.json') : null;
  const candidateSqlPath = join(runDir, 'candidate.sql');
  const sqlGenerationPath = extras.sqlGeneration ? join(runDir, 'sql-generation.json') : null;

  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(outputPackPath, `${JSON.stringify(report.outputPack, null, 2)}\n`, 'utf8');
  writeFileSync(dossierPath, `${JSON.stringify(report.dossier, null, 2)}\n`, 'utf8');
  writeFileSync(manifestPath, `${JSON.stringify(report.manifest, null, 2)}\n`, 'utf8');
  writeFileSync(candidateSqlPath, `${extras.candidateSql.trim()}\n`, 'utf8');
  if (attestationPath && report.attestation) {
    writeFileSync(attestationPath, `${JSON.stringify(report.attestation, null, 2)}\n`, 'utf8');
  }
  if (openLineagePath && report.openLineageExport) {
    writeFileSync(openLineagePath, `${JSON.stringify(report.openLineageExport, null, 2)}\n`, 'utf8');
  }
  if (sqlGenerationPath && extras.sqlGeneration) {
    writeFileSync(sqlGenerationPath, `${JSON.stringify(extras.sqlGeneration, null, 2)}\n`, 'utf8');
  }

  return {
    runDir,
    report: reportPath,
    outputPack: outputPackPath,
    dossier: dossierPath,
    manifest: manifestPath,
    attestation: attestationPath,
    openLineage: openLineagePath,
    candidateSql: candidateSqlPath,
    sqlGeneration: sqlGenerationPath,
    snapshotDir: extras.snapshotDir ?? null,
  };
}

export function persistPortableProofArtifacts(input: {
  report: FinancialRunReport;
  kit: NonNullable<ReturnType<typeof buildVerificationKit>>;
  outDir: string;
  signerPublicKeyPem: string;
  reviewerPublicKeyPem?: string | null;
  trustChain?: TrustChain | null;
  caPublicKeyPem?: string | null;
}): PersistedPortableProofPaths {
  mkdirSync(input.outDir, { recursive: true });

  const certificatePath = join(input.outDir, 'certificate.json');
  const publicKeyPath = join(input.outDir, 'public-key.pem');
  const kitPath = join(input.outDir, 'kit.json');
  const verificationSummaryPath = join(input.outDir, 'verification-summary.json');
  const bundlePath = join(input.outDir, 'bundle.json');
  const reviewerPublicKeyPath = input.reviewerPublicKeyPem ? join(input.outDir, 'reviewer-public.pem') : null;
  const trustChainPath = input.trustChain ? join(input.outDir, 'trust-chain.json') : null;
  const caPublicKeyPath = input.caPublicKeyPem ? join(input.outDir, 'ca-public.pem') : null;

  writeFileSync(certificatePath, `${JSON.stringify(input.report.certificate, null, 2)}\n`, 'utf8');
  writeFileSync(publicKeyPath, input.signerPublicKeyPem, 'utf8');
  writeFileSync(kitPath, `${JSON.stringify(input.kit, null, 2)}\n`, 'utf8');
  writeFileSync(verificationSummaryPath, `${JSON.stringify(input.kit.verification, null, 2)}\n`, 'utf8');
  writeFileSync(bundlePath, `${JSON.stringify(input.kit.bundle, null, 2)}\n`, 'utf8');
  if (reviewerPublicKeyPath && input.reviewerPublicKeyPem) {
    writeFileSync(reviewerPublicKeyPath, input.reviewerPublicKeyPem, 'utf8');
  }
  if (trustChainPath && input.trustChain) {
    writeFileSync(trustChainPath, `${JSON.stringify(input.trustChain, null, 2)}\n`, 'utf8');
  }
  if (caPublicKeyPath && input.caPublicKeyPem) {
    writeFileSync(caPublicKeyPath, input.caPublicKeyPem, 'utf8');
  }

  return {
    outDir: input.outDir,
    certificate: certificatePath,
    publicKey: publicKeyPath,
    kit: kitPath,
    verificationSummary: verificationSummaryPath,
    bundle: bundlePath,
    reviewerPublicKey: reviewerPublicKeyPath,
    trustChain: trustChainPath,
    caPublicKey: caPublicKeyPath,
  };
}

export function printReportSummary(report: FinancialRunReport): void {
  console.log(`  Decision: ${report.decision.toUpperCase()}`);
  console.log(`  Scorers: ${report.scoring.scorersRun} ran`);
  console.log(`  Audit: ${report.audit.entries.length} entries, chain ${report.audit.chainIntact ? 'intact' : 'BROKEN'}`);
  console.log(`  Lineage: ${report.lineage.inputs.length} inputs, ${report.lineage.outputs.length} outputs`);
  console.log(`  Review: ${report.reviewPolicy.required ? `required (${report.reviewPolicy.triggeredBy.join(', ')})` : 'not required'}`);
  console.log(`  Manifest: ${report.manifest.artifacts.outputPack.present ? 'output pack' : '-'}, ${report.manifest.artifacts.dossier.present ? 'dossier' : '-'}`);
  console.log(`  Mode: ${report.liveProof.mode} (upstream_live=${report.liveProof.upstream.live}, execution_live=${report.liveProof.execution.live}, gaps=${report.liveProof.gaps.length})`);
}
