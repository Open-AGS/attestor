/**
 * Multi-query, healthcare, PostgreSQL demo, and doctor commands.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateKeyPair } from '../../signing/keys.js';
import {
  COUNTERPARTY_SQL, COUNTERPARTY_INTENT, COUNTERPARTY_FIXTURE,
  COUNTERPARTY_REPORT_CONTRACT, COUNTERPARTY_REPORT,
  LIQUIDITY_SQL, LIQUIDITY_INTENT, LIQUIDITY_FIXTURE,
  RECON_SQL, RECON_INTENT, RECON_FIXTURE,
} from '../fixtures/scenarios.js';
import { runMultiQueryPipeline, type MultiQueryUnit } from '../multi-query-pipeline.js';
import { buildMultiQueryDossier, buildMultiQueryOutputPack, buildMultiQueryVerificationKit, renderMultiQuerySummary } from '../multi-query-proof.js';
import { envSet, shellName } from './helpers.js';

/**
 * Multi-Query Demo — governed multi-query proof with signed certificate and verification kit.
 */
export async function runMultiQueryDemo(): Promise<void> {
  console.log(`\n  Attestor Multi-Query — Governed Multi-Query Signed Proof`);
  console.log('');

  const units: MultiQueryUnit[] = [
    {
      unitId: 'counterparty',
      label: 'Counterparty exposure summary',
      input: { runId: 'x', intent: COUNTERPARTY_INTENT, candidateSql: COUNTERPARTY_SQL, fixtures: [COUNTERPARTY_FIXTURE], generatedReport: COUNTERPARTY_REPORT, reportContract: COUNTERPARTY_REPORT_CONTRACT },
    },
    {
      unitId: 'liquidity',
      label: 'Liquidity risk assessment',
      input: { runId: 'x', intent: LIQUIDITY_INTENT, candidateSql: LIQUIDITY_SQL, fixtures: [LIQUIDITY_FIXTURE] },
    },
    {
      unitId: 'recon',
      label: 'Reconciliation variance check',
      input: { runId: 'x', intent: RECON_INTENT, candidateSql: RECON_SQL, fixtures: [RECON_FIXTURE] },
    },
  ];

  const runId = `mq-demo-${Date.now().toString(36)}`;
  const report = runMultiQueryPipeline(runId, units);

  // Display summary
  console.log(renderMultiQuerySummary(report));

  // Signing keys
  const keyPair = generateKeyPair();
  const reviewerKeyPair = generateKeyPair();
  console.log(`\n  Signing key:  ephemeral (${keyPair.fingerprint})`);
  console.log(`  Reviewer key: ephemeral (${reviewerKeyPair.fingerprint})`);

  // Build reviewer endorsement
  const { buildMultiQueryReviewerEndorsement } = await import('../../signing/multi-query-reviewer.js');
  const endorsement = buildMultiQueryReviewerEndorsement(
    report.runId,
    report.multiQueryHash,
    report.unitCount,
    report.aggregateDecision,
    { name: 'Ephemeral Reviewer', role: 'attestor_operator', identifier: `mq-demo:${reviewerKeyPair.fingerprint}`, signerFingerprint: null },
    'Multi-query demo proof review',
    reviewerKeyPair,
  );

  // Build proof artifacts — signed certificate + reviewer-endorsed kit
  const outputPack = buildMultiQueryOutputPack(report);
  const dossier = buildMultiQueryDossier(report);
  const kit = buildMultiQueryVerificationKit(report, keyPair, endorsement, reviewerKeyPair.publicKeyPem);

  console.log(`  Certificate: ${kit.certificate.certificateId}`);
  console.log(`  Kit overall: ${kit.verification.overall.toUpperCase()}`);

  // Persist
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outDir = join('.attestor', 'multi-query', `${runId}_${ts}`);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'output-pack.json'), JSON.stringify(outputPack, null, 2));
  writeFileSync(join(outDir, 'dossier.json'), JSON.stringify(dossier, null, 2));
  writeFileSync(join(outDir, 'kit.json'), JSON.stringify(kit, null, 2));
  writeFileSync(join(outDir, 'certificate.json'), JSON.stringify(kit.certificate, null, 2));
  writeFileSync(join(outDir, 'public-key.pem'), keyPair.publicKeyPem);
  writeFileSync(join(outDir, 'reviewer-public.pem'), reviewerKeyPair.publicKeyPem);
  writeFileSync(join(outDir, 'verification-summary.json'), JSON.stringify(kit.verification, null, 2));

  console.log(`\n  Artifacts saved to: ${outDir}/`);
  console.log(`    kit.json                — multi-query verification kit (certificate + manifest + reviewer + summary)`);
  console.log(`    certificate.json        — Ed25519-signed multi-query attestation certificate`);
  console.log(`    output-pack.json        — machine-readable multi-query output pack`);
  console.log(`    dossier.json            — reviewer-facing multi-query decision dossier`);
  console.log(`    public-key.pem          — signer public key`);
  console.log(`    reviewer-public.pem     — reviewer signer public key`);
  console.log(`    verification-summary.json — multi-query verification result`);

  console.log(`\n  Verification Summary:`);
  console.log(`    Crypto:      ${kit.verification.cryptographic.valid ? '✓' : '✗'} (${kit.verification.cryptographic.algorithm})`);
  console.log(`    Governance:  ${kit.verification.governanceSufficiency.sufficient ? 'sufficient' : 'INSUFFICIENT'}`);
  console.log(`    Proof:       ${kit.verification.proofCompleteness.aggregateMode}`);
  console.log(`    Units:       ${kit.verification.unitCount}`);
  console.log(`    Decision:    ${kit.verification.aggregateDecision}`);
  const re = kit.verification.reviewerEndorsement;
  console.log(`    Reviewer:    ${re.verified ? '✓ verified' : re.present ? '△ present but not verified' : '(none)'} ${re.reviewerName ? `(${re.reviewerName})` : ''}`);
  console.log(`    Overall:     ${kit.verification.overall.toUpperCase()}`);
  console.log('');
}

/**
 * Healthcare Domain Demo — runs healthcare quality measure scenarios through the governance engine.
 */
export async function runHealthcareDemo(): Promise<void> {
  console.log(`\n  Attestor Healthcare Domain — Governed Quality Measure Scenarios\n`);

  const { runFinancialPipeline } = await import('../pipeline.js');
  const {
    READMISSION_SQL, READMISSION_INTENT, READMISSION_FIXTURE,
    SMALL_CELL_SQL, SMALL_CELL_INTENT, SMALL_CELL_FIXTURE,
    TEMPORAL_SQL, TEMPORAL_INTENT, TEMPORAL_FIXTURE,
  } = await import('../../domains/healthcare-scenarios.js');
  const {
    evaluatePatientCountConsistency, evaluateRateBound,
    evaluateSmallCellSuppression, evaluateTemporalConsistency,
  } = await import('../../domains/healthcare-clauses.js');
  const { generateKeyPair } = await import('../../signing/keys.js');

  const scenarios = [
    { id: 'readmission', label: 'Readmission Rate Quality Measure', sql: READMISSION_SQL, intent: READMISSION_INTENT, fixture: READMISSION_FIXTURE, expectedDecision: 'pass' },
    { id: 'small-cell', label: 'Small Cell Suppression Check', sql: SMALL_CELL_SQL, intent: SMALL_CELL_INTENT, fixture: SMALL_CELL_FIXTURE, expectedDecision: 'pass' },
    { id: 'temporal', label: 'Temporal Consistency Check', sql: TEMPORAL_SQL, intent: TEMPORAL_INTENT, fixture: TEMPORAL_FIXTURE, expectedDecision: 'fail' },
  ];

  const keyPair = generateKeyPair();
  let allExpected = true;

  for (const s of scenarios) {
    const report = runFinancialPipeline({ runId: `hc-${s.id}`, intent: s.intent, candidateSql: s.sql, fixtures: [s.fixture], signingKeyPair: keyPair });
    const match = report.decision === s.expectedDecision;
    if (!match) allExpected = false;
    const icon = match ? '✓' : '✗';
    console.log(`  ${icon} ${s.label.padEnd(40)} decision=${report.decision.padEnd(6)} expected=${s.expectedDecision} ${match ? '' : '← MISMATCH'}`);

    // Run domain-specific clause checks
    const rows = s.fixture.result.rows;
    if (s.id === 'readmission') {
      const pc = evaluatePatientCountConsistency(rows, 'numerator', 'excluded', 'denominator');
      const rb = evaluateRateBound(rows, 'readmission_rate', 0.0, 0.30, 'readmission');
      console.log(`    clauses: patient_count=${pc.passed ? '✓' : '✗'}, rate_bound=${rb.passed ? '✓' : '✗'}`);
    }
    if (s.id === 'small-cell') {
      const sc = evaluateSmallCellSuppression(rows, 'patient_count', 11);
      console.log(`    clauses: small_cell=${sc.passed ? '✓ (no violations)' : `✗ (${(sc.evidence as any).violations.length} violations)`}`);
    }
    if (s.id === 'temporal') {
      const tc = evaluateTemporalConsistency(rows, 'admission_date', 'discharge_date');
      console.log(`    clauses: temporal=${tc.passed ? '✓' : `✗ (${(tc.evidence as any).violations} inconsistencies)`}`);
    }
  }

  // eCQM measure evaluation
  const { evaluateMeasure, CMS_READMISSION_MEASURE } = await import('../../domains/healthcare-measures.js');
  const measureResult = evaluateMeasure(CMS_READMISSION_MEASURE, {
    initial_population: 350,
    denominator: 300,
    denominator_exclusion: 50,
    numerator: 36,
    numerator_exclusion: 0,
  });
  console.log(`\n  eCQM Measure: ${measureResult.title}`);
  console.log(`    Rate: ${measureResult.rate !== null ? (measureResult.rate * 100).toFixed(1) + '%' : 'N/A'}`);
  console.log(`    Performance: ${measureResult.performanceMet ? '✓ met' : '✗ not met'}`);
  for (const gc of measureResult.governanceChecks) {
    console.log(`    ${gc.passed ? '✓' : '✗'} ${gc.description}`);
  }

  // CMS Top-3 quality measures
  const { CMS165_BLOOD_PRESSURE, CMS122_DIABETES_A1C, CMS130_COLORECTAL_SCREENING, toFhirMeasureReport } = await import('../../domains/healthcare-measures.js');
  const { validateFhirMeasureReport } = await import('../../domains/fhir-validator.js');

  const cmsMeasures = [
    { measure: CMS165_BLOOD_PRESSURE, data: { initial_population: 1200, denominator: 1100, denominator_exclusion: 100, numerator: 825 } },
    { measure: CMS122_DIABETES_A1C, data: { initial_population: 800, denominator: 750, denominator_exclusion: 50, numerator: 60 } },
    { measure: CMS130_COLORECTAL_SCREENING, data: { initial_population: 2000, denominator: 1900, denominator_exclusion: 100, numerator: 1520 } },
  ];

  console.log(`\n  ── CMS Quality Measures (eCQM) ──`);
  let fhirValidationErrors = 0;
  for (const { measure, data } of cmsMeasures) {
    const result = evaluateMeasure(measure, data);
    const fhir = toFhirMeasureReport(result);
    const validation = await validateFhirMeasureReport(fhir);
    const rateStr = result.rate !== null ? (result.rate * 100).toFixed(1) + '%' : 'N/A';
    const valIcon = validation.valid ? '✓' : '✗';
    console.log(`  ${result.performanceMet ? '✓' : '✗'} ${measure.measureId}: ${measure.title} — rate=${rateStr}, FHIR=${valIcon} ${validation.scope} (${validation.errors.length} errors)`);
    if (!validation.valid) {
      fhirValidationErrors += validation.errors.length;
      for (const err of validation.errors) {
        console.log(`      ✗ ${err.path}: ${err.message}`);
      }
    }
  }
  if (fhirValidationErrors > 0) {
    console.log(`\n  ⚠ FHIR validation: ${fhirValidationErrors} error(s) — MeasureReport output may not conform to R4 schema`);
  }

  // QRDA III export
  const { generateQrda3, validateQrda3Structure } = await import('../../filing/qrda3-generator.js');
  const allEvaluations = cmsMeasures.map(({ measure, data }) => evaluateMeasure(measure, data));
  const qrda3Xml = generateQrda3(allEvaluations, { reportingYear: '2026', performerName: 'Attestor Healthcare Demo' });
  const qrda3Validation = validateQrda3Structure(qrda3Xml, allEvaluations.length);
  console.log(`\n  QRDA III: generated ${qrda3Xml.length} chars XML for ${allEvaluations.length} measures — structural ${qrda3Validation.valid ? '✓' : '✗'} (${qrda3Validation.checks.length} checks, ${qrda3Validation.scope})`);

  // CMS IG XPath validation (SaxonJS)
  const { validateQrda3Schematron } = await import('../../filing/qrda3-schematron.js');
  const cmsValidation = await validateQrda3Schematron(qrda3Xml);
  console.log(`  CMS IG:  ${cmsValidation.valid ? '✓' : '✗'} ${cmsValidation.passedRules}/${cmsValidation.totalRules} rules pass (${cmsValidation.errors} errors, ${cmsValidation.scope})`);
  if (cmsValidation.errors > 0) {
    for (const a of cmsValidation.assertions.filter(a => !a.passed)) {
      console.log(`    ✗ ${a.ruleId}: ${a.description}`);
    }
  }

  // CMS 2026 Schematron validation (real .sch file)
  const { validateCmsSchematron } = await import('../../filing/qrda3-cms-schematron.js');
  const schResult = await validateCmsSchematron(qrda3Xml);
  const schIcon = schResult.errorCount === 0 ? '✓' : '⚠';
  console.log(`  CMS Sch: ${schIcon} ${schResult.errorCount} errors, ${schResult.warningCount} warnings (${schResult.scope})`);
  if (schResult.errorCount > 0) {
    // Show unique error descriptions
    const unique = new Map<string, number>();
    for (const e of schResult.errors) { unique.set(e.description, (unique.get(e.description) ?? 0) + 1); }
    for (const [desc, count] of [...unique.entries()].slice(0, 5)) {
      console.log(`    ✗ [${count}x] ${desc.slice(0, 120)}`);
    }
    if (unique.size > 5) console.log(`    ... and ${unique.size - 5} more rule types`);
  }

  // Cypress-equivalent validators (Layers 2-6)
  const { validateCypressLayers } = await import('../../filing/qrda3-cypress-validators.js');
  const cypressResult = validateCypressLayers(qrda3Xml);
  console.log(`  Cypress-eq: ${cypressResult.valid ? '✓' : '✗'} ${cypressResult.totalErrors} errors, ${cypressResult.totalWarnings} warnings (${cypressResult.scope}, not actual ONC Cypress)`);
  for (const layer of cypressResult.layers) {
    const icon = layer.valid ? '✓' : '✗';
    const warnStr = layer.warnings.length > 0 ? ` (${layer.warnings.length} warnings)` : '';
    console.log(`    ${icon} L${layer.layer} ${layer.name}: ${layer.errors.length} errors${warnStr}`);
    for (const e of layer.errors) console.log(`      ✗ ${e}`);
  }

  const { isVsacConfigured, validateVsacLayer7ForMeasures } = await import('../../filing/vsac-api-client.js');
  if (isVsacConfigured()) {
    console.log(`  Expanding VSAC Layer 7 value sets...`);
    const vsacResult = await validateVsacLayer7ForMeasures(cmsMeasures.map(entry => entry.measure));
    const vsacIcon = vsacResult.valid ? '✓' : '✗';
    console.log(`  VSAC L7: ${vsacIcon} ${vsacResult.expandedTargets}/${vsacResult.totalTargets} value sets expanded, ${vsacResult.totalCodes} codes (${vsacResult.scope})`);
    if (!vsacResult.valid) {
      const failedTargets = vsacResult.targets.filter(entry => !entry.valid);
      for (const target of failedTargets.slice(0, 5)) {
        console.log(`    - ${target.name} [${target.oid}] ${target.error ?? 'unknown VSAC error'}`);
      }
      if (failedTargets.length > 5) console.log(`    ... and ${failedTargets.length - 5} more`);
    }
  } else {
    console.log(`  VSAC L7: ⊘ skipped (set VSAC_UMLS_API_KEY from the UMLS My Profile page for live value-set expansion)`);
  }

  // ONC Cypress API validation (env-gated — only when Cypress demo credentials are available)
  const { isCypressConfigured, validateViaCypressApi } = await import('../../filing/cypress-api-client.js');
  if (isCypressConfigured()) {
    console.log(`  Submitting to ONC Cypress server...`);
    const apiResult = await validateViaCypressApi(qrda3Xml);
    const apiIcon = apiResult.valid ? '✓' : (apiResult.httpStatus === 0 ? '⊘' : '✗');
    console.log(`  ONC Cypress: ${apiIcon} ${apiResult.errorCount} errors (${apiResult.scope}, HTTP ${apiResult.httpStatus}, ${apiResult.uploadPath ?? 'no upload path'})`);
    if (!apiResult.valid && apiResult.errors.length > 0) {
      for (const e of apiResult.errors.slice(0, 5)) console.log(`    - ${e.message.slice(0, 120)}`);
      if (apiResult.errors.length > 5) console.log(`    ... and ${apiResult.errors.length - 5} more`);
    }
  } else {
    console.log(`  ONC Cypress: ⊘ skipped (set CYPRESS_EMAIL + CYPRESS_PASSWORD, or legacy CYPRESS_UMLS_USER + CYPRESS_UMLS_PASS, for real ONC validation)`);
  }

  console.log(`\n  Healthcare scenarios: ${scenarios.length} ran, ${allExpected ? 'all matched expected decisions' : 'SOME MISMATCHES'}`);
  if (allExpected) {
    console.log(`  Certificate: ${scenarios[0].id} issued with signing key ${keyPair.fingerprint}`);
  }
  console.log('');
}

/**
 * Healthcare live closeout — canonical credentialed closure for VSAC Layer 7 and ONC Cypress.
 */
export async function runHealthcareCloseout(): Promise<void> {
  console.log(`\n  Attestor Healthcare Live Closeout — ONC Cypress + VSAC Layer 7\n`);

  const { runHealthcareLiveCloseout } = await import('../../filing/healthcare-live-closeout.js');
  const result = await runHealthcareLiveCloseout();

  console.log(`  Local preflight: ${result.localPreflight.cypressEquivalentValid ? '✓' : '✗'} Cypress-equivalent Layers 2-6`);
  console.log(`    QRDA XML chars: ${result.localPreflight.qrdaXmlChars}`);
  console.log(`    Curated VSAC targets: ${result.localPreflight.curatedVsacTargets}`);
  console.log(`    Local errors/warnings: ${result.localPreflight.cypressEquivalentErrors}/${result.localPreflight.cypressEquivalentWarnings}`);
  console.log('');
  console.log(`  Credential readiness:`);
  console.log(`    ${result.credentials.cypressConfigured ? '✓' : '○'} ONC Cypress credentials (CYPRESS_EMAIL + CYPRESS_PASSWORD, legacy fallback supported)`);
  console.log(`    ${result.credentials.vsacConfigured ? '✓' : '○'} VSAC API key (VSAC_UMLS_API_KEY or UMLS_API_KEY)`);
  if (result.credentials.missingEnvVars.length > 0) {
    console.log(`    Missing: ${result.credentials.missingEnvVars.join(', ')}`);
  }

  if (result.vsac) {
    const icon = result.vsac.valid ? '✓' : '✗';
    console.log('');
    console.log(`  VSAC Layer 7: ${icon} ${result.vsac.expandedTargets}/${result.vsac.totalTargets} targets expanded, codes=${result.vsac.totalCodes}`);
    if (!result.vsac.valid) {
      for (const target of result.vsac.targets.filter(entry => !entry.valid).slice(0, 5)) {
        console.log(`    - ${target.name} [${target.oid}] HTTP ${target.httpStatus}: ${target.error ?? 'unknown error'}`);
      }
    }
  }

  if (result.oncCypress) {
    const icon = result.oncCypress.valid ? '✓' : '✗';
    console.log('');
    console.log(`  ONC Cypress: ${icon} HTTP ${result.oncCypress.httpStatus}, executionErrors=${result.oncCypress.errorCount}`);
    if (!result.oncCypress.valid) {
      for (const error of result.oncCypress.errors.slice(0, 5)) {
        console.log(`    - ${error.message.slice(0, 140)}`);
      }
    }
  }

  console.log('');
  if (result.closureAchieved) {
    console.log('  ✓ Healthcare live closeout achieved.');
    console.log('    11/11 curated VSAC targets expanded and ONC Cypress returned zero execution errors.\n');
    return;
  }

  console.log('  ✗ Healthcare live closeout not yet achieved.');
  for (const blocker of result.blockers) {
    console.log(`    - ${blocker}`);
  }
  console.log('');
  process.exit(1);
}

/**
 * PostgreSQL Demo Bootstrap — seeds a deterministic demo schema for real DB proof.
 *
 * This is the ONLY write operation in Attestor's PostgreSQL integration.
 * It creates an `attestor_demo` schema with tables matching the repo's
 * fixture scenarios, so `prove counterparty` can run against real Postgres.
 */
export async function runPgDemoInit(): Promise<void> {
  const { runDemoBootstrap, getDemoBootstrapPlan, getDemoAllowedSchemas } = await import('../../connectors/postgres-demo.js');

  console.log(`\n  Attestor PostgreSQL Demo Bootstrap`);
  console.log(`  This creates a demo schema with deterministic data for real DB proof.\n`);

  const plan = getDemoBootstrapPlan();
  console.log(`  Schema: ${plan.schema}`);
  console.log(`  Tables:`);
  for (const t of plan.tables) {
    console.log(`    ${plan.schema}.${t.name.padEnd(30)} ${t.rowCount} rows  (${t.columns.join(', ')})`);
  }
  console.log('');

  const result = await runDemoBootstrap();
  if (result.success) {
    console.log(`  ✓ ${result.message}`);
    console.log('');
    for (const [table, count] of Object.entries(result.rowCounts)) {
      console.log(`    ${plan.schema}.${table}: ${count} rows`);
    }
    console.log('');
    console.log(`  Next steps (${shellName()}):`);
    console.log(`    1. ${envSet('ATTESTOR_PG_ALLOWED_SCHEMAS', getDemoAllowedSchemas().join(','))}`);
    console.log(`    2. npm run prove -- counterparty`);
    console.log('');
    console.log(`  When ATTESTOR_PG_ALLOWED_SCHEMAS includes '${plan.schema}', the counterparty`);
    console.log(`  scenario uses canonical demo SQL from the bootstrap module (not regex rewriting).`);
    console.log(`  Other scenarios without a dedicated demo helper fall back to schema rewriting.`);
    console.log('');
    console.log(`  Important: This bootstrap is for demo/proof setup only.`);
    console.log(`  The governed proof path remains strictly read-only.`);
  } else {
    console.log(`  ✗ ${result.message}`);
  }
  console.log('');
}

/**
 * PostgreSQL Demo Teardown — removes the demo schema.
 */
export async function runPgDemoTeardown(): Promise<void> {
  const { runDemoTeardown } = await import('../../connectors/postgres-demo.js');

  console.log(`\n  Attestor PostgreSQL Demo Teardown\n`);

  const result = await runDemoTeardown();
  if (result.success) {
    console.log(`  ✓ ${result.message}`);
  } else {
    console.log(`  ✗ ${result.message}`);
  }
  console.log('');
}

/**
 * Doctor — readiness check for real product proof.
 *
 * When Postgres is configured and the driver is available, runs a bounded
 * connectivity probe (SELECT version(), current_schemas, read-only txn).
 */
export async function runDoctor(): Promise<void> {
  const { reportPostgresReadiness, runPostgresProbe } = await import('../../connectors/postgres.js');
  const { existsSync } = await import('node:fs');

  console.log(`\n  Attestor Doctor — Product Proof Readiness`);
  console.log('');

  // Signing
  const hasKeyDir = existsSync('.attestor/private.pem');
  console.log(`  ${hasKeyDir ? '✓' : '○'} Signing key pair  ${hasKeyDir ? '.attestor/private.pem found' : 'Not found — run: npm run keygen'}`);

  // Model credentials
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  console.log(`  ${hasOpenAI ? '✓' : '○'} OpenAI API key    ${hasOpenAI ? 'Set' : 'Not set — needed for live model proof'}`);

  // PostgreSQL — surface readiness
  const pgReadiness = await reportPostgresReadiness();
  console.log(`  ${pgReadiness.runnable ? '✓' : pgReadiness.configured ? '△' : '○'} PostgreSQL         ${pgReadiness.message}`);

  // Deep Postgres probe when both URL and driver are present
  let pgProbeOk = false;
  if (pgReadiness.runnable) {
    console.log('');
    console.log(`  ── PostgreSQL Proof Probe ──`);
    const probe = await runPostgresProbe();
    for (const step of probe.steps) {
      console.log(`    ${step.passed ? '✓' : '✗'} ${step.step.padEnd(14)} ${step.detail}`);
      if (!step.passed && step.remediation) {
        console.log(`      → ${step.remediation}`);
      }
    }
    pgProbeOk = probe.success;
    if (probe.success) {
      console.log(`\n    Readiness: configured ✓  reachable ✓  read-only safe ✓  ready for prove ✓`);
    } else {
      // Find the first failed step for a targeted summary
      const failedStep = probe.steps.find(s => !s.passed);
      console.log(`\n    ✗ Probe failed at step: ${failedStep?.step ?? 'unknown'}`);
      console.log(`    ${probe.message}`);
    }
  }

  // SQLite
  console.log(`\n  ✓ SQLite (built-in)  Always available for fixture/local live proof`);

  console.log('');
  console.log(`  Proof modes:`);
  console.log(`    ✓ offline_fixture        — always available (fixture data)`);
  console.log(`    ${hasOpenAI ? '✓' : '○'} live_model             — ${hasOpenAI ? 'ready' : 'needs OPENAI_API_KEY'}`);
  console.log(`    ✓ live_runtime (SQLite)  — built-in local execution`);
  console.log(`    ${pgProbeOk ? '✓' : pgReadiness.runnable ? '△' : '○'} live_runtime (Postgres) — ${pgProbeOk ? 'verified and operational' : pgReadiness.runnable ? 'driver+URL present but probe not passed' : 'not ready'}`);

  // ── Repo-native demo proof path ──
  console.log('');
  console.log(`  ── Repo-Native Demo Proof Path ──`);
  console.log(`  The fastest way to a real PostgreSQL-backed proof from this repo:`);

  const demoSteps: string[] = [];
  if (!pgReadiness.configured) demoSteps.push(envSet('ATTESTOR_PG_URL', 'postgres://user:pass@host:5432/db'));
  if (!pgReadiness.driverInstalled) demoSteps.push('npm install pg');
  if (pgReadiness.runnable && !pgProbeOk) demoSteps.push('Fix PostgreSQL connectivity (see probe results above)');
  if (!hasKeyDir) demoSteps.push('npm run keygen');

  if (pgProbeOk) {
    // DB is reachable — show the exact demo sequence
    demoSteps.push('npx tsx src/financial/cli.ts pg-demo-init');
    demoSteps.push(envSet('ATTESTOR_PG_ALLOWED_SCHEMAS', 'attestor_demo'));
    if (hasKeyDir) {
      demoSteps.push('npm run prove -- counterparty .attestor');
    } else {
      demoSteps.push('npm run prove -- counterparty');
    }
    console.log(`  Commands for ${shellName()}:`);
    for (let i = 0; i < demoSteps.length; i++) {
      console.log(`    ${i + 1}. ${demoSteps[i]}`);
    }
    console.log('');
    console.log(`  This seeds a deterministic attestor_demo schema, then runs a real`);
    console.log(`  PostgreSQL-backed governed proof with signed certificate and kit.`);
    console.log(`  (Seeded demo data — not external production data.)`);
  } else {
    // Prerequisites not met
    for (let i = 0; i < demoSteps.length; i++) {
      console.log(`    ${i + 1}. ${demoSteps[i]}`);
    }
    console.log(`    Then:`);
    console.log(`      npx tsx src/financial/cli.ts pg-demo-init`);
    console.log(`      ${envSet('ATTESTOR_PG_ALLOWED_SCHEMAS', 'attestor_demo')}`);
    console.log(`      npm run prove -- counterparty`);
  }
  console.log('');
}
