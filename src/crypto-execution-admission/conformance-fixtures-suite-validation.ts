import { CRYPTO_ADMISSION_RECEIPT_SIGNATURE_MODES, CRYPTO_ADMISSION_RECEIPT_SPEC_VERSION, CRYPTO_ADMISSION_TELEMETRY_EVENT_TYPE, CRYPTO_ADMISSION_TELEMETRY_SPEC_VERSION, verifyCryptoAdmissionReceipt, type CryptoAdmissionReceipt } from './telemetry-receipts.js';
import { EXPECTED_CLASSIFICATION_BY_OUTCOME, EXPECTED_SIGNAL_BY_OUTCOME } from './conformance-fixtures-negative.js';
import { arrayAt, assertEqual, hasStringArray, isPlanOutcome, isReceiptClassification, isRecord, isRequiredSurface, isSha256Digest, isTelemetrySignal, pushError, stringAt } from './conformance-fixtures-validation-helpers.js';
import {
  type CryptoAdmissionConformanceFixtureSigner,
  type CryptoAdmissionConformanceSurface,
  type CryptoAdmissionConformanceValidationFinding,
} from './conformance-fixtures-types.js';

export function validateFixture(
  input: unknown,
  index: number,
  signer: CryptoAdmissionConformanceFixtureSigner | null,
  seenFixtureIds: Set<string>,
  coveredSurfaces: Set<CryptoAdmissionConformanceSurface>,
  findings: CryptoAdmissionConformanceValidationFinding[],
): void {
  const path = `fixtures[${index}]`;
  if (!isRecord(input)) {
    pushError(findings, path, 'fixture-not-object', 'Fixture must be an object.');
    return;
  }

  const fixtureId = stringAt(input, 'fixtureId');
  if (fixtureId == null || fixtureId.length === 0) {
    pushError(findings, `${path}.fixtureId`, 'fixture-id-required', 'Fixture id is required.');
  } else if (seenFixtureIds.has(fixtureId)) {
    pushError(
      findings,
      `${path}.fixtureId`,
      'fixture-id-duplicate',
      `Fixture id ${fixtureId} appears more than once.`,
    );
  } else {
    seenFixtureIds.add(fixtureId);
  }

  const surface = input.surface;
  if (!isRequiredSurface(surface)) {
    pushError(
      findings,
      `${path}.surface`,
      'surface-unsupported',
      'Fixture surface must be one of the required external admission surfaces.',
    );
  } else {
    coveredSurfaces.add(surface);
  }

  if (stringAt(input, 'adapterKind') == null) {
    pushError(findings, `${path}.adapterKind`, 'adapter-kind-required', 'Adapter kind is required.');
  }
  if (stringAt(input, 'scenario') == null) {
    pushError(findings, `${path}.scenario`, 'scenario-required', 'Scenario is required.');
  }
  if (!hasStringArray(input, 'standards') || arrayAt(input, 'standards').length === 0) {
    pushError(
      findings,
      `${path}.standards`,
      'standards-required',
      'Fixture must name at least one external standard or surface convention.',
    );
  }
  if (!hasStringArray(input, 'externalIntegratorAssertions') ||
    arrayAt(input, 'externalIntegratorAssertions').length < 4) {
    pushError(
      findings,
      `${path}.externalIntegratorAssertions`,
      'integrator-assertions-required',
      'Fixture must include fail-closed assertions for external integrators.',
    );
  }

  const expectedSignal = input.expectedSignal;
  const expectedReceiptClassification = input.expectedReceiptClassification;
  const expectedPlanOutcome = input.expectedPlanOutcome;
  if (!isTelemetrySignal(expectedSignal)) {
    pushError(
      findings,
      `${path}.expectedSignal`,
      'expected-signal-invalid',
      'Expected signal must be admitted, blocked, or missing-evidence.',
    );
  }
  if (!isReceiptClassification(expectedReceiptClassification)) {
    pushError(
      findings,
      `${path}.expectedReceiptClassification`,
      'expected-classification-invalid',
      'Expected receipt classification is invalid.',
    );
  }
  if (!isPlanOutcome(expectedPlanOutcome)) {
    pushError(
      findings,
      `${path}.expectedPlanOutcome`,
      'expected-plan-outcome-invalid',
      'Expected plan outcome is invalid.',
    );
  }
  if (stringAt(input, 'expectedDownstreamAction') == null) {
    pushError(
      findings,
      `${path}.expectedDownstreamAction`,
      'expected-action-required',
      'Expected downstream action is required.',
    );
  }
  if (isPlanOutcome(expectedPlanOutcome) && isTelemetrySignal(expectedSignal)) {
    assertEqual(
      findings,
      expectedSignal,
      EXPECTED_SIGNAL_BY_OUTCOME[expectedPlanOutcome],
      `${path}.expectedSignal`,
      'signal-outcome-mismatch',
      'Expected telemetry signal must match the expected plan outcome.',
    );
  }
  if (isPlanOutcome(expectedPlanOutcome) && isReceiptClassification(expectedReceiptClassification)) {
    assertEqual(
      findings,
      expectedReceiptClassification,
      EXPECTED_CLASSIFICATION_BY_OUTCOME[expectedPlanOutcome],
      `${path}.expectedReceiptClassification`,
      'classification-outcome-mismatch',
      'Expected receipt classification must match the expected plan outcome.',
    );
  }

  const plan = input.plan;
  const subject = input.subject;
  const telemetryEvent = input.telemetryEvent;
  const receipt = input.receipt;
  if (!isRecord(plan)) {
    pushError(findings, `${path}.plan`, 'plan-required', 'Plan fixture object is required.');
  }
  if (!isRecord(subject)) {
    pushError(
      findings,
      `${path}.subject`,
      'subject-required',
      'Telemetry subject fixture object is required.',
    );
  }
  if (!isRecord(telemetryEvent)) {
    pushError(
      findings,
      `${path}.telemetryEvent`,
      'telemetry-event-required',
      'Telemetry event fixture object is required.',
    );
  }
  if (!isRecord(receipt)) {
    pushError(findings, `${path}.receipt`, 'receipt-required', 'Receipt fixture object is required.');
  }
  if (!isRecord(plan) || !isRecord(subject) || !isRecord(telemetryEvent) || !isRecord(receipt)) {
    return;
  }

  assertEqual(
    findings,
    plan.version,
    'attestor.crypto-execution-admission.v1',
    `${path}.plan.version`,
    'plan-version-mismatch',
    'Plan version must match crypto execution admission v1.',
  );
  assertEqual(
    findings,
    plan.surface,
    surface,
    `${path}.plan.surface`,
    'plan-surface-mismatch',
    'Plan surface must match fixture surface.',
  );
  assertEqual(
    findings,
    plan.adapterKind,
    input.adapterKind,
    `${path}.plan.adapterKind`,
    'plan-adapter-mismatch',
    'Plan adapter kind must match fixture adapter kind.',
  );
  assertEqual(
    findings,
    plan.outcome,
    expectedPlanOutcome,
    `${path}.plan.outcome`,
    'plan-outcome-mismatch',
    'Plan outcome must match fixture expectation.',
  );
  if (!isSha256Digest(plan.digest)) {
    pushError(
      findings,
      `${path}.plan.digest`,
      'plan-digest-invalid',
      'Plan digest must be a sha256 digest.',
    );
  }

  assertEqual(
    findings,
    subject.surface,
    surface,
    `${path}.subject.surface`,
    'subject-surface-mismatch',
    'Subject surface must match fixture surface.',
  );
  assertEqual(
    findings,
    subject.adapterKind,
    input.adapterKind,
    `${path}.subject.adapterKind`,
    'subject-adapter-mismatch',
    'Subject adapter kind must match fixture adapter kind.',
  );
  assertEqual(
    findings,
    subject.planId,
    plan.planId,
    `${path}.subject.planId`,
    'subject-plan-id-mismatch',
    'Subject plan id must bind to plan id.',
  );
  assertEqual(
    findings,
    subject.planDigest,
    plan.digest,
    `${path}.subject.planDigest`,
    'subject-plan-digest-mismatch',
    'Subject plan digest must bind to plan digest.',
  );
  if (!isSha256Digest(subject.subjectDigest)) {
    pushError(
      findings,
      `${path}.subject.subjectDigest`,
      'subject-digest-invalid',
      'Subject digest must be a sha256 digest.',
    );
  }

  assertEqual(
    findings,
    telemetryEvent.version,
    CRYPTO_ADMISSION_TELEMETRY_SPEC_VERSION,
    `${path}.telemetryEvent.version`,
    'telemetry-version-mismatch',
    'Telemetry version must match crypto admission telemetry v1.',
  );
  assertEqual(
    findings,
    telemetryEvent.specversion,
    '1.0',
    `${path}.telemetryEvent.specversion`,
    'telemetry-specversion-mismatch',
    'Telemetry event must use CloudEvents specversion 1.0.',
  );
  assertEqual(
    findings,
    telemetryEvent.type,
    CRYPTO_ADMISSION_TELEMETRY_EVENT_TYPE,
    `${path}.telemetryEvent.type`,
    'telemetry-type-mismatch',
    'Conformance telemetry event must be an admission decision event.',
  );
  assertEqual(
    findings,
    telemetryEvent.signal,
    expectedSignal,
    `${path}.telemetryEvent.signal`,
    'telemetry-signal-mismatch',
    'Telemetry signal must match fixture expectation.',
  );
  const eventData = isRecord(telemetryEvent.data) ? telemetryEvent.data : null;
  if (eventData == null) {
    pushError(
      findings,
      `${path}.telemetryEvent.data`,
      'telemetry-data-required',
      'Telemetry data object is required.',
    );
  } else {
    assertEqual(
      findings,
      eventData.planId,
      plan.planId,
      `${path}.telemetryEvent.data.planId`,
      'telemetry-plan-id-mismatch',
      'Telemetry plan id must bind to plan id.',
    );
    assertEqual(
      findings,
      eventData.planDigest,
      plan.digest,
      `${path}.telemetryEvent.data.planDigest`,
      'telemetry-plan-digest-mismatch',
      'Telemetry plan digest must bind to plan digest.',
    );
    assertEqual(
      findings,
      eventData.surface,
      surface,
      `${path}.telemetryEvent.data.surface`,
      'telemetry-surface-mismatch',
      'Telemetry surface must match fixture surface.',
    );
    assertEqual(
      findings,
      eventData.subjectId,
      subject.subjectId,
      `${path}.telemetryEvent.data.subjectId`,
      'telemetry-subject-id-mismatch',
      'Telemetry subject id must bind to subject.',
    );
  }
  if (!isSha256Digest(telemetryEvent.eventDigest)) {
    pushError(
      findings,
      `${path}.telemetryEvent.eventDigest`,
      'telemetry-digest-invalid',
      'Telemetry event digest must be a sha256 digest.',
    );
  }

  assertEqual(
    findings,
    receipt.version,
    CRYPTO_ADMISSION_RECEIPT_SPEC_VERSION,
    `${path}.receipt.version`,
    'receipt-version-mismatch',
    'Receipt version must match crypto admission receipt v1.',
  );
  assertEqual(
    findings,
    receipt.classification,
    expectedReceiptClassification,
    `${path}.receipt.classification`,
    'receipt-classification-mismatch',
    'Receipt classification must match fixture expectation.',
  );
  assertEqual(
    findings,
    receipt.planId,
    plan.planId,
    `${path}.receipt.planId`,
    'receipt-plan-id-mismatch',
    'Receipt plan id must bind to plan id.',
  );
  assertEqual(
    findings,
    receipt.planDigest,
    plan.digest,
    `${path}.receipt.planDigest`,
    'receipt-plan-digest-mismatch',
    'Receipt plan digest must bind to plan digest.',
  );
  assertEqual(
    findings,
    receipt.surface,
    surface,
    `${path}.receipt.surface`,
    'receipt-surface-mismatch',
    'Receipt surface must match fixture surface.',
  );
  assertEqual(
    findings,
    receipt.adapterKind,
    input.adapterKind,
    `${path}.receipt.adapterKind`,
    'receipt-adapter-mismatch',
    'Receipt adapter kind must match fixture adapter kind.',
  );
  assertEqual(
    findings,
    receipt.planOutcome,
    expectedPlanOutcome,
    `${path}.receipt.planOutcome`,
    'receipt-plan-outcome-mismatch',
    'Receipt plan outcome must match fixture expectation.',
  );
  if (!isSha256Digest(receipt.receiptDigest)) {
    pushError(
      findings,
      `${path}.receipt.receiptDigest`,
      'receipt-digest-invalid',
      'Receipt digest must be a sha256 digest.',
    );
  }
  const signature = isRecord(receipt.signature) ? receipt.signature : null;
  if (signature == null) {
    pushError(
      findings,
      `${path}.receipt.signature`,
      'receipt-signature-required',
      'Receipt signature object is required.',
    );
  } else {
    assertEqual(
      findings,
      signature.mode,
      CRYPTO_ADMISSION_RECEIPT_SIGNATURE_MODES[0],
      `${path}.receipt.signature.mode`,
      'receipt-signature-mode-mismatch',
      'Receipt signature must use the fixture signature mode.',
    );
    if (signer != null) {
      assertEqual(
        findings,
        signature.keyId,
        signer.keyId,
        `${path}.receipt.signature.keyId`,
        'receipt-signature-key-mismatch',
        'Receipt signature key must match fixture signer key id.',
      );
      try {
        const verification = verifyCryptoAdmissionReceipt({
          receipt: receipt as unknown as CryptoAdmissionReceipt,
          signer,
        });
        if (verification.status !== 'valid') {
          pushError(
            findings,
            `${path}.receipt.signature`,
            'receipt-signature-invalid',
            `Receipt signature failed verification: ${verification.failureReasons.join(', ')}`,
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        pushError(
          findings,
          `${path}.receipt.signature`,
          'receipt-signature-verification-error',
          message,
        );
      }
    }
  }
}

export function fixtureSignerFrom(input: Record<string, unknown>): CryptoAdmissionConformanceFixtureSigner | null {
  const signerInput = input.fixtureSigner;
  if (!isRecord(signerInput)) {
    return null;
  }
  const keyId = stringAt(signerInput, 'keyId');
  const secret = stringAt(signerInput, 'secret');
  const purpose = signerInput.purpose;
  if (keyId == null || secret == null || purpose !== 'fixture-only') {
    return null;
  }
  return Object.freeze({
    keyId,
    secret,
    purpose,
  });
}
