/**
 * Bounded live-model + local SQLite financial CLI command.
 */

import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { callGpt, GPT_MODEL } from '../../api/openai.js';
import { buildVerificationKit } from '../../signing/bundle.js';
import { verifyCertificate } from '../../signing/certificate.js';
import { executeSqliteQuery, materializeSqliteFixtureDatabases, type SqliteSchemaBinding } from '../execution.js';
import { COUNTERPARTY_INTENT, COUNTERPARTY_LIVE_DATABASES } from '../fixtures/scenarios.js';
import { renderPackSummary } from '../output-pack.js';
import { runFinancialPipeline } from '../pipeline.js';
import { governSql } from '../sql-governance.js';
import type { LiveProofInput } from '../types.js';
import { persistFinancialArtifacts, persistPortableProofArtifacts, printReportSummary } from './artifacts.js';
import { estimateOpenAICostUsd, extractSql, looksCompleteSql, type SqlGenerationMetadata } from './helpers.js';
import { LIVE_SCENARIOS } from './scenarios.js';

async function generateLiveCounterpartySql(bindings: SqliteSchemaBinding[]): Promise<{ sql: string; proof: LiveProofInput; metadata: SqlGenerationMetadata }> {
  const basePrompt = LIVE_SCENARIOS['counterparty'].buildSqlPrompt();
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCachedInputTokens = 0;
  let totalLatencyMs = 0;
  let repairHint: string | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    const start = Date.now();
    const result = await callGpt({
      stage: 'financial_live_sql',
      systemPrompt: repairHint
        ? `${basePrompt.systemPrompt} Previous response was incomplete or invalid. Return one complete SQL query only.`
        : basePrompt.systemPrompt,
      userMessage: repairHint
        ? `${basePrompt.userMessage}\n\nRepair hint: ${repairHint}`
        : basePrompt.userMessage,
      effort: 'low',
      maxTokens: 600,
    });
    const latencyMs = Date.now() - start;
    const sql = extractSql(result.content);

    totalInputTokens += result.inputTokens;
    totalOutputTokens += result.outputTokens;
    totalCachedInputTokens += result.cachedInputTokens;
    totalLatencyMs += latencyMs;

    const governance = governSql(sql, COUNTERPARTY_INTENT);
    const executionPreflight = executeSqliteQuery(sql, { provider: 'sqlite', bindings });
    if (looksCompleteSql(sql) && governance.result === 'pass' && executionPreflight.success) {
      const estimatedCostUsd = estimateOpenAICostUsd(totalInputTokens, totalOutputTokens, totalCachedInputTokens);
      return {
        sql,
        proof: {
          upstream: {
            provider: 'openai',
            model: GPT_MODEL,
            tokenUsage: { input: totalInputTokens, output: totalOutputTokens },
            latencyMs: totalLatencyMs,
            requestId: null,
            providerProofContext: result.providerProofContext,
            live: true,
          },
        },
        metadata: {
          provider: 'openai',
          model: GPT_MODEL,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          cachedInputTokens: totalCachedInputTokens,
          latencyMs: totalLatencyMs,
          estimatedCostUsd,
        },
      };
    }

    repairHint = [
      !looksCompleteSql(sql) ? 'Query was incomplete or truncated.' : null,
      governance.result !== 'pass' ? `Governance failed: ${governance.gates.filter((gate) => !gate.passed).map((gate) => gate.detail).join(' | ')}` : null,
      !executionPreflight.success ? `SQLite execution failed: ${executionPreflight.error}` : null,
    ].filter(Boolean).join(' ');
  }

  throw new Error('Unable to produce a complete governance-safe SQL query after 2 attempts.');
}

export async function runLiveScenario(id: string): Promise<void> {
  const scenario = LIVE_SCENARIOS[id];
  if (!scenario) {
    console.error(`Unknown live scenario "${id}". Available: ${Object.keys(LIVE_SCENARIOS).join(', ')}`);
    process.exit(1);
  }

  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.includes('your-')) {
    console.error('OPENAI_API_KEY is required for live financial SQL generation.');
    process.exit(1);
  }

  const runId = `financial-live-${id}-${randomUUID()}`;
  const runDir = join(process.cwd(), '.attestor-financial', 'runs', runId);
  const snapshotDir = join(runDir, 'snapshot');

  console.log(`\n  Attestor Financial - Running live scenario: ${id}`);
  console.log(`  ${scenario.description}`);
  console.log(`  Run ID: ${runId}\n`);

  const overallStart = Date.now();
  const { generatePkiHierarchy } = await import('../../signing/pki-chain.js');
  const pkiHierarchy = generatePkiHierarchy('Attestor Live Scenario CA', 'Live Scenario Runtime Signer', 'Live Scenario Reviewer');
  const signingKeyPair = pkiHierarchy.signer.keyPair;
  const reviewerKeyPair = pkiHierarchy.reviewer.keyPair;
  const snapshot = materializeSqliteFixtureDatabases(snapshotDir, COUNTERPARTY_LIVE_DATABASES);
  const generated = await generateLiveCounterpartySql(snapshot.bindings);
  const input = scenario.buildInput(runId, generated.sql, generated.proof);
  input.intent = { ...input.intent, materialityTier: 'high' };
  input.liveExecution = {
    provider: 'sqlite',
    bindings: snapshot.bindings,
  };
  input.signingKeyPair = signingKeyPair;
  input.approval = {
    status: 'approved',
    reviewerRole: 'attestor_operator',
    reviewNote: 'Approved for hybrid live proof showcase.',
    reviewerIdentity: {
      name: 'Attestor Live Reviewer',
      role: 'attestor_operator',
      identifier: `financial-live-reviewer:${runId}`,
      signerFingerprint: null,
    },
    reviewerKeyPair,
  };

  const report = runFinancialPipeline(input);
  const persisted = persistFinancialArtifacts(report, runDir, {
    candidateSql: generated.sql,
    sqlGeneration: generated.metadata,
    snapshotDir,
  });
  const certificateVerification = report.certificate
    ? verifyCertificate(report.certificate, signingKeyPair.publicKeyPem)
    : null;
  const kit = report.certificate
    ? buildVerificationKit(
      report,
      signingKeyPair.publicKeyPem,
      reviewerKeyPair.publicKeyPem,
      pkiHierarchy.chains.signer,
      pkiHierarchy.ca.keyPair.publicKeyPem,
    )
    : null;
  const portableArtifacts = report.certificate && kit
    ? persistPortableProofArtifacts({
      report,
      kit,
      outDir: runDir,
      signerPublicKeyPem: signingKeyPair.publicKeyPem,
      reviewerPublicKeyPem: reviewerKeyPair.publicKeyPem,
      trustChain: pkiHierarchy.chains.signer,
      caPublicKeyPem: pkiHierarchy.ca.keyPair.publicKeyPem,
    })
    : null;

  printReportSummary(report);
  console.log(`  Snapshot: ${report.snapshot.version} (${report.snapshot.sourceCount ?? report.snapshot.fixtureCount} ${report.snapshot.sourceKind ?? 'fixture'} source${(report.snapshot.sourceCount ?? report.snapshot.fixtureCount) === 1 ? '' : 's'})`);
  console.log(`  SQL model: ${generated.metadata.provider}/${generated.metadata.model}`);
  console.log(`  SQL tokens: in=${generated.metadata.inputTokens}, out=${generated.metadata.outputTokens}, cached_in=${generated.metadata.cachedInputTokens}`);
  console.log(`  Est. SQL cost: $${generated.metadata.estimatedCostUsd.toFixed(4)}`);
  console.log(`  Duration: ${Date.now() - overallStart}ms`);
  console.log(`  Artifacts:`);
  console.log(`    report: ${persisted.report}`);
  console.log(`    output-pack: ${persisted.outputPack}`);
  console.log(`    dossier: ${persisted.dossier}`);
  console.log(`    manifest: ${persisted.manifest}`);
  if (persisted.attestation) console.log(`    attestation: ${persisted.attestation}`);
  if (persisted.openLineage) console.log(`    openlineage: ${persisted.openLineage}`);
  console.log(`    candidate-sql: ${persisted.candidateSql}`);
  if (persisted.sqlGeneration) console.log(`    sql-generation: ${persisted.sqlGeneration}`);
  if (persisted.snapshotDir) console.log(`    snapshot-dir: ${persisted.snapshotDir}`);
  if (portableArtifacts) {
    console.log(`    certificate: ${portableArtifacts.certificate}`);
    console.log(`    kit: ${portableArtifacts.kit}`);
    console.log(`    verification-summary: ${portableArtifacts.verificationSummary}`);
    console.log(`    bundle: ${portableArtifacts.bundle}`);
    console.log(`    public-key: ${portableArtifacts.publicKey}`);
    if (portableArtifacts.reviewerPublicKey) console.log(`    reviewer-public-key: ${portableArtifacts.reviewerPublicKey}`);
    if (portableArtifacts.trustChain) console.log(`    trust-chain: ${portableArtifacts.trustChain}`);
    if (portableArtifacts.caPublicKey) console.log(`    ca-public-key: ${portableArtifacts.caPublicKey}`);
  }
  console.log('');
  if (certificateVerification && kit) {
    console.log(`  Certificate: ${certificateVerification.overall.toUpperCase()} (${report.certificate?.certificateId})`);
    console.log(`  Verification kit: ${kit.verification.overall.toUpperCase()} — proof=${kit.verification.proofCompleteness.mode}, gaps=${kit.verification.proofCompleteness.gapCount}, reviewer=${kit.verification.reviewerEndorsement.verified ? 'verified' : 'not verified'}`);
    console.log(`  Re-verify: npm run verify:cert -- ${runDir.replaceAll('\\', '/')}/kit.json`);
    console.log(`  Showcase:   npm run showcase:proof -- --from ${runDir.replaceAll('\\', '/')} --skip-run`);
    console.log('');
  }
  console.log(renderPackSummary(report.outputPack));
}
