import { consequenceDataMinimizationMaterialSafetyFindings } from '../consequence-admission/data-minimization-redaction-policy.js';
import { CRYPTO_ADMISSION_NEGATIVE_CONFORMANCE_FIXTURES, EXPECTED_SIGNAL_BY_OUTCOME, NEGATIVE_SURFACE_PROFILES } from './conformance-fixtures-negative.js';
import { fixtureSignerFrom, validateFixture } from './conformance-fixtures-suite-validation.js';
import { arrayAt, assertEqual, hasStringArray, isNegativeClass, isPlanOutcome, isRecord, isRequiredSurface, isTelemetrySignal, pushError, stringAt } from './conformance-fixtures-validation-helpers.js';
import {
  CRYPTO_ADMISSION_CONFORMANCE_FIXTURES_SPEC_VERSION,
  CRYPTO_ADMISSION_CONFORMANCE_REQUIRED_SURFACES,
  CRYPTO_ADMISSION_CONFORMANCE_SCHEMA_DIALECT,
  CRYPTO_ADMISSION_NEGATIVE_CONFORMANCE_CLASSES,
  type CryptoAdmissionConformanceSurface,
  type CryptoAdmissionConformanceValidationFinding,
  type CryptoAdmissionConformanceValidationResult,
  type CryptoAdmissionNegativeConformanceValidationResult,
} from './conformance-fixtures-types.js';

export function validateNegativeFixture(
  fixture: unknown,
  index: number,
  seenFixtureIds: Set<string>,
  coverage: Set<string>,
  findings: CryptoAdmissionConformanceValidationFinding[],
): void {
  const path = `negativeFixtures[${index}]`;
  if (!isRecord(fixture)) {
    pushError(findings, path, 'negative-fixture-not-object', 'Negative fixture must be an object.');
    return;
  }

  const fixtureId = stringAt(fixture, 'fixtureId');
  if (fixtureId == null || fixtureId.length === 0) {
    pushError(findings, `${path}.fixtureId`, 'negative-fixture-id-required', 'Fixture id is required.');
  } else if (seenFixtureIds.has(fixtureId)) {
    pushError(findings, `${path}.fixtureId`, 'negative-fixture-id-duplicate', `Fixture id ${fixtureId} appears more than once.`);
  } else {
    seenFixtureIds.add(fixtureId);
  }

  const surface = fixture.surface;
  const negativeClass = fixture.negativeClass;
  if (!isRequiredSurface(surface)) {
    pushError(findings, `${path}.surface`, 'negative-surface-unsupported', 'Negative fixture surface is unsupported.');
  }
  if (!isNegativeClass(negativeClass)) {
    pushError(findings, `${path}.negativeClass`, 'negative-class-unsupported', 'Negative fixture class is unsupported.');
  }
  if (isRequiredSurface(surface) && isNegativeClass(negativeClass)) {
    coverage.add(`${surface}:${negativeClass}`);
    const expectedProfile = NEGATIVE_SURFACE_PROFILES[surface];
    assertEqual(
      findings,
      fixture.adapterKind,
      expectedProfile.adapterKind,
      `${path}.adapterKind`,
      'negative-adapter-kind-mismatch',
      'Negative fixture adapter kind must match its required surface.',
    );
  }

  if (fixture.shouldFailClosed !== true) {
    pushError(findings, `${path}.shouldFailClosed`, 'negative-fixture-not-fail-closed', 'Negative fixture must fail closed.');
  }
  for (const flag of [
    'rawPayloadStored',
    'rawProviderResponseStored',
    'customerIdentifiersStored',
    'privatePolicyThresholdsStored',
    'solverRouteSecretsStored',
  ]) {
    if (fixture[flag] !== false) {
      pushError(findings, `${path}.${flag}`, 'negative-privacy-flag-not-false', `${flag} must be false.`);
    }
  }

  const expectedPlanOutcome = fixture.expectedPlanOutcome;
  const expectedSignal = fixture.expectedSignal;
  if (!isPlanOutcome(expectedPlanOutcome) || expectedPlanOutcome === 'admit') {
    pushError(findings, `${path}.expectedPlanOutcome`, 'negative-plan-outcome-invalid', 'Negative fixture cannot expect an admit outcome.');
  }
  if (!isTelemetrySignal(expectedSignal) || expectedSignal === 'admitted') {
    pushError(findings, `${path}.expectedSignal`, 'negative-signal-invalid', 'Negative fixture cannot expect an admitted signal.');
  }
  if (
    isPlanOutcome(expectedPlanOutcome) &&
    expectedPlanOutcome !== 'admit' &&
    isTelemetrySignal(expectedSignal)
  ) {
    assertEqual(
      findings,
      expectedSignal,
      EXPECTED_SIGNAL_BY_OUTCOME[expectedPlanOutcome],
      `${path}.expectedSignal`,
      'negative-signal-outcome-mismatch',
      'Negative fixture signal must match the expected fail-closed plan outcome.',
    );
  }

  if (!hasStringArray(fixture, 'standards') || arrayAt(fixture, 'standards').length === 0) {
    pushError(findings, `${path}.standards`, 'negative-standards-required', 'Negative fixture must name at least one standard.');
  }
  for (const field of ['scenario', 'evidenceClass', 'expectedFindingCode']) {
    if (stringAt(fixture, field) == null) {
      pushError(findings, `${path}.${field}`, 'negative-field-required', `${field} is required.`);
    }
  }
  if (!hasStringArray(fixture, 'modelSafeFeedback') || arrayAt(fixture, 'modelSafeFeedback').length < 3) {
    pushError(findings, `${path}.modelSafeFeedback`, 'negative-feedback-required', 'Negative fixture feedback must be model-safe and actionable.');
  }

  const safetyFindings = consequenceDataMinimizationMaterialSafetyFindings({
    material: JSON.stringify({
      fixtureId,
      scenario: fixture.scenario,
      evidenceClass: fixture.evidenceClass,
      expectedFindingCode: fixture.expectedFindingCode,
      modelSafeFeedback: fixture.modelSafeFeedback,
      rawPayloadStored: fixture.rawPayloadStored,
    }),
    findingSubject: `negative fixture ${fixtureId ?? index}`,
  });
  for (const safetyFinding of safetyFindings) {
    pushError(
      findings,
      path,
      'negative-fixture-privacy-unsafe',
      safetyFinding,
    );
  }
}

export function validateCryptoAdmissionConformanceFixtureSuite(
  suite: unknown,
): CryptoAdmissionConformanceValidationResult {
  const findings: CryptoAdmissionConformanceValidationFinding[] = [];
  const coveredSurfaces = new Set<CryptoAdmissionConformanceSurface>();
  const seenFixtureIds = new Set<string>();

  if (!isRecord(suite)) {
    pushError(findings, '$', 'suite-not-object', 'Conformance suite must be an object.');
    return Object.freeze({
      status: 'invalid',
      fixtureCount: 0,
      coveredSurfaces: Object.freeze([]),
      missingSurfaces: CRYPTO_ADMISSION_CONFORMANCE_REQUIRED_SURFACES,
      findings: Object.freeze(findings),
    });
  }

  assertEqual(
    findings,
    suite.version,
    CRYPTO_ADMISSION_CONFORMANCE_FIXTURES_SPEC_VERSION,
    '$.version',
    'suite-version-mismatch',
    'Suite version must match crypto admission conformance fixtures v1.',
  );
  assertEqual(
    findings,
    suite.schemaDialect,
    CRYPTO_ADMISSION_CONFORMANCE_SCHEMA_DIALECT,
    '$.schemaDialect',
    'schema-dialect-mismatch',
    'Suite schema dialect must be JSON Schema Draft 2020-12.',
  );
  if (stringAt(suite, 'generatedAt') == null) {
    pushError(findings, '$.generatedAt', 'generated-at-required', 'Generated timestamp is required.');
  }

  const signer = fixtureSignerFrom(suite);
  if (signer == null) {
    pushError(
      findings,
      '$.fixtureSigner',
      'fixture-signer-invalid',
      'Fixture signer must include keyId, secret, and purpose=fixture-only.',
    );
  }

  const requiredSurfaces = arrayAt(suite, 'requiredSurfaces');
  for (const requiredSurface of CRYPTO_ADMISSION_CONFORMANCE_REQUIRED_SURFACES) {
    if (!requiredSurfaces.includes(requiredSurface)) {
      pushError(
        findings,
        '$.requiredSurfaces',
        'required-surface-missing-from-suite',
        `Suite requiredSurfaces must include ${requiredSurface}.`,
      );
    }
  }

  const fixtures = arrayAt(suite, 'fixtures');
  if (fixtures.length === 0) {
    pushError(findings, '$.fixtures', 'fixtures-empty', 'At least one conformance fixture is required.');
  }
  fixtures.forEach((fixture, index) =>
    validateFixture(fixture, index, signer, seenFixtureIds, coveredSurfaces, findings),
  );

  const missingSurfaces = CRYPTO_ADMISSION_CONFORMANCE_REQUIRED_SURFACES.filter(
    (surface) => !coveredSurfaces.has(surface),
  );
  for (const missingSurface of missingSurfaces) {
    pushError(
      findings,
      '$.fixtures',
      'surface-coverage-missing',
      `No conformance fixture covers ${missingSurface}.`,
    );
  }

  const errorCount = findings.filter((finding) => finding.severity === 'error').length;
  return Object.freeze({
    status: errorCount === 0 ? 'valid' : 'invalid',
    fixtureCount: fixtures.length,
    coveredSurfaces: Object.freeze([...coveredSurfaces].sort()),
    missingSurfaces: Object.freeze(missingSurfaces),
    findings: Object.freeze(findings),
  });
}

export function validateCryptoAdmissionNegativeConformanceFixtures(
  fixtures: readonly unknown[] = CRYPTO_ADMISSION_NEGATIVE_CONFORMANCE_FIXTURES,
): CryptoAdmissionNegativeConformanceValidationResult {
  const findings: CryptoAdmissionConformanceValidationFinding[] = [];
  const coverage = new Set<string>();
  const seenFixtureIds = new Set<string>();

  fixtures.forEach((fixture, index) =>
    validateNegativeFixture(fixture, index, seenFixtureIds, coverage, findings),
  );

  const expectedCoverage = CRYPTO_ADMISSION_CONFORMANCE_REQUIRED_SURFACES.flatMap((surface) =>
    CRYPTO_ADMISSION_NEGATIVE_CONFORMANCE_CLASSES.map(
      (negativeClass) => `${surface}:${negativeClass}`,
    ),
  );
  const missingCoverage = Object.freeze(
    expectedCoverage.filter((entry) => !coverage.has(entry)),
  );
  for (const missing of missingCoverage) {
    pushError(
      findings,
      '$.negativeFixtures',
      'negative-fixture-coverage-missing',
      `No negative conformance fixture covers ${missing}.`,
    );
  }

  const errorCount = findings.filter((finding) => finding.severity === 'error').length;
  return Object.freeze({
    status: errorCount === 0 ? 'valid' : 'invalid',
    fixtureCount: fixtures.length,
    missingCoverage,
    findings: Object.freeze(findings),
  });
}
