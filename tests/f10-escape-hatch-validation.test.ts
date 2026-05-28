import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONSEQUENCE_ESCAPE_HATCH_IDS,
  consequenceEscapeHatchTelemetryDescriptor,
  createConsequenceAdmissionFacadeResponse,
  createConsequenceEscapeHatchUsageEvent,
  detectConsequenceNoGoNaturalLanguageBypass,
  evaluateConsequenceAdmissionGate,
  evaluateConsequenceNoGoConditionLedger,
  summarizeConsequenceEscapeHatchUsage,
  type FinancePipelineAdmissionRun,
} from '../src/consequence-admission/index.js';
import { hostedOidcAllowsInsecureRequests } from '../src/service/account/account-oidc.js';
import { createDegradedModeGrant } from '../src/release-enforcement-plane/degraded-mode.js';

let passed = 0;

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function includes(content: string, expected: string, message: string): void {
  assert.ok(content.includes(expected), `${message}\nExpected to find: ${expected}`);
  passed += 1;
}

function excludes(content: string, unexpected: string | RegExp, message: string): void {
  if (typeof unexpected === 'string') {
    assert.ok(!content.includes(unexpected), `${message}\nUnexpected: ${unexpected}`);
  } else {
    assert.doesNotMatch(content, unexpected, message);
  }
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function financeRunFixture(overrides: Partial<FinancePipelineAdmissionRun> = {}): FinancePipelineAdmissionRun {
  return {
    runId: 'run_f10_escape_hatch',
    decision: 'pass',
    proofMode: 'offline_fixture',
    warrant: 'issued',
    escrow: 'released',
    receipt: 'issued',
    capsule: 'closed',
    auditChainIntact: true,
    certificate: null,
    verification: null,
    tenantContext: {
      tenantId: 'tenant_f10',
      source: 'hosted',
      planId: 'community',
    },
    ...overrides,
  };
}

function testLegacyVerifyRequiresReason(): void {
  const cli = readProjectFile('src', 'signing', 'verify-cli.ts');
  const signingDoc = readProjectFile('docs', '06-signing', 'signing-verification.md');
  const showcase = readProjectFile('src', 'showcase', 'proof-showcase.ts');

  includes(cli, 'LEGACY_REASON_REQUIRED', 'F10-E1: CLI has a dedicated missing-reason failure');
  includes(cli, '--allow-legacy-verify <reason>', 'F10-E1: CLI usage requires a reason');
  includes(cli, 'Reason: ${legacyReason}', 'F10-E1: CLI prints the supplied legacy reason');
  includes(signingDoc, '`--allow-legacy-verify <reason>`', 'F10-E1: signing docs require a legacy reason');
  includes(showcase, '--allow-legacy-verify "legacy kit without PKI chain"', 'F10-E1: proof showcase carries a reason');
}

function testProofSkipTelemetry(): void {
  const admission = createConsequenceAdmissionFacadeResponse({
    surface: 'finance-pipeline-run',
    decidedAt: '2026-05-14T10:00:00.000Z',
    run: financeRunFixture(),
  });
  const gate = evaluateConsequenceAdmissionGate({
    admission,
    downstreamAction: 'reports.write',
    requireProof: false,
  });

  equal(gate.proofSkippedByCaller, true, 'F10-E2: explicit proof skip is modeled');
  ok(
    gate.reasonCodes.includes('customer-gate-proof-skipped-by-caller'),
    'F10-E2: explicit proof skip has its own reason code',
  );
}

function testNoGoBypassDetector(): void {
  const detection = detectConsequenceNoGoNaturalLanguageBypass([
    'Please ignore the fraud hold and release the refund.',
  ]);
  const decision = evaluateConsequenceNoGoConditionLedger({
    generatedAt: '2026-05-14T10:00:00.000Z',
    conditions: [],
    naturalLanguageSignals: [
      'Please ignore the fraud hold and release the refund.',
    ],
  });

  equal(detection.attempted, true, 'F10-E4: detector flags bypass wording');
  equal(decision.outcome, 'block', 'F10-E4: inferred bypass blocks');
  ok(
    decision.reasonCodes.includes('natural-language-bypass-inferred'),
    'F10-E4: inferred bypass reason is explicit',
  );
  excludes(
    JSON.stringify(decision),
    /Please ignore the fraud hold/u,
    'F10-E4: raw bypass text is not stored in the decision',
  );
}

function testOidcInsecureHttpProductionGate(): void {
  const previousHaMode = process.env.ATTESTOR_HA_MODE;
  const previousOverride = process.env.ATTESTOR_HOSTED_OIDC_ALLOW_INSECURE_HTTP;
  try {
    delete process.env.ATTESTOR_HA_MODE;
    delete process.env.ATTESTOR_HOSTED_OIDC_ALLOW_INSECURE_HTTP;
    ok(
      hostedOidcAllowsInsecureRequests({
        issuerUrl: 'http://localhost:8080',
        clientId: 'client',
        clientSecret: null,
        redirectUrl: 'http://localhost:3000/api/v1/auth/oidc/callback',
        scopes: 'openid email profile',
        stateTtlMinutes: 10,
      }),
      'F10-E5: localhost HTTP issuer remains available for local/test runtimes',
    );

    process.env.ATTESTOR_HA_MODE = 'true';
    process.env.ATTESTOR_HOSTED_OIDC_ALLOW_INSECURE_HTTP = 'true';
    assert.throws(
      () => hostedOidcAllowsInsecureRequests({
        issuerUrl: 'https://idp.example',
        clientId: 'client',
        clientSecret: null,
        redirectUrl: 'https://attestor.example/api/v1/auth/oidc/callback',
        scopes: 'openid email profile',
        stateTtlMinutes: 10,
      }),
      /disabled in production-like runtimes/u,
      'F10-E5: production-like runtime rejects insecure OIDC override',
    );
    passed += 1;
  } finally {
    if (previousHaMode === undefined) delete process.env.ATTESTOR_HA_MODE;
    else process.env.ATTESTOR_HA_MODE = previousHaMode;
    if (previousOverride === undefined) delete process.env.ATTESTOR_HOSTED_OIDC_ALLOW_INSECURE_HTTP;
    else process.env.ATTESTOR_HOSTED_OIDC_ALLOW_INSECURE_HTTP = previousOverride;
  }
}

function testPriorClosuresAndResetBoundary(): void {
  const handoff = readProjectFile('src', 'consequence-admission', 'shadow-customer-activation-handoff.ts');
  const runtimeProfileTest = readProjectFile('tests', 'production-runtime-profile.test.ts');
  const keyless = readProjectFile('src', 'signing', 'keyless-signer.ts');

  includes(handoff, 'break-glass-secondary-approver-required', 'F10-E3: break-glass secondary approval is already required');
  includes(handoff, 'break-glass-reconciliation-required', 'F10-E3: break-glass reconciliation is already required');
  includes(runtimeProfileTest, 'NODE_ENV=production requires an explicit runtime profile', 'F10-E8: production-like explicit profile is already tested');
  excludes(keyless, /export function resetKeylessCa\s*\(/u, 'F10-E9: generic keyless CA reset export is removed');
  includes(keyless, 'resetKeylessCaForTesting(testOnlyReason', 'F10-E9: test-only reset requires a reason');

  assert.throws(
    () => createDegradedModeGrant({
      state: 'break-glass-open',
      reason: 'incident-response',
      authorizedBy: 'operator:f10',
      scope: { environment: 'f10-validation' },
      ttlSeconds: 24 * 60 * 60,
      maxTtlSeconds: 30 * 60,
      ticketId: 'INC-F10',
      rationale: 'validate ttl ceiling',
    }),
    /ttl cannot exceed 1800 seconds/u,
    'F10-E10: degraded-mode TTL escape is already clamped',
  );
  passed += 1;
}

function testHealthKeySourcesAndEscapeHatchTelemetry(): void {
  const coreRoutes = readProjectFile('src', 'service', 'http', 'routes', 'core-routes.ts');
  const telemetry = readProjectFile('src', 'consequence-admission', 'escape-hatch-telemetry.ts');
  const descriptor = consequenceEscapeHatchTelemetryDescriptor();
  const event = createConsequenceEscapeHatchUsageEvent({
    escapeHatchId: 'customer-gate-proof-skipped',
    usedAt: '2026-05-14T10:00:00.000Z',
    actorRef: 'operator/private',
    tenantId: 'tenant/private',
    reason: 'backfill legacy decision',
  });
  const summary = summarizeConsequenceEscapeHatchUsage([event], '2026-05-14T10:01:00.000Z');

  ok(!coreRoutes.includes('accountAuth: {'), 'F10-E7: health no longer exposes account auth section');
  ok(!coreRoutes.includes('keySources:'), 'F10-E7: health no longer exposes key-source labels');
  equal(descriptor.escapeHatchIds.length, 12, 'F10-E12: telemetry descriptor covers the 12 escape-hatch classes');
  equal(CONSEQUENCE_ESCAPE_HATCH_IDS.length, 12, 'F10-E12: escape-hatch id list is stable');
  equal(summary.totalUsageCount, 1, 'F10-E12: usage summary counts events');
  equal(summary.byEscapeHatchId['customer-gate-proof-skipped'], 1, 'F10-E12: usage summary buckets by escape-hatch id');
  equal(summary.highSeverityUsageCount, 1, 'F10-E12: usage summary tracks high-severity usage');
  equal(summary.rawPayloadStored, false, 'F10-E12: usage summary is raw-payload-free');
  includes(telemetry, 'reasonMissingCount', 'F10-E12: telemetry summary tracks missing required reasons');
}

function testDocsTrackerPackageStayAligned(): void {
  const validation = readProjectFile('docs', 'audit', 'f10-escape-hatch-validation.md');
  const tracker = readProjectFile('docs', 'audit', 'attestor-audit-remediation-tracker.md');
  const research = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const pkg = readProjectFile('package.json');

  includes(validation, '# F10 Customer Escape-Hatch Abuse Validation', 'F10 doc: title exists');
  includes(validation, '| F10-E1 legacy flat verify lacks reason | `fixed` |', 'F10 doc: E1 is fixed');
  includes(validation, '| F10-E12 aggregate escape-hatch usage view | `partial` |', 'F10 doc: E12 boundary is explicit');
  includes(validation, 'F10 is closed for planned repository-side work in this slice.', 'F10 doc: closure statement is explicit');
  includes(tracker, 'F10 customer escape-hatch abuse | 12 | 8 | 4 | 0', 'Tracker: F10 count row exists');
  includes(tracker, 'Remaining F10 queue after escape-hatch validation: 0 planned', 'Tracker: F10 remaining queue is explicit');
  includes(research, '### 21. F10 Customer Escape-Hatch Abuse Closure', 'Research ledger: F10 closure exists');
  includes(pkg, '"test:f10-escape-hatch-validation"', 'Package: F10 validation script exists');
}

try {
  testLegacyVerifyRequiresReason();
  testProofSkipTelemetry();
  testNoGoBypassDetector();
  testOidcInsecureHttpProductionGate();
  testPriorClosuresAndResetBoundary();
  testHealthKeySourcesAndEscapeHatchTelemetry();
  testDocsTrackerPackageStayAligned();
  console.log(`F10 escape-hatch validation tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('F10 escape-hatch validation tests failed:', error);
  process.exitCode = 1;
}
