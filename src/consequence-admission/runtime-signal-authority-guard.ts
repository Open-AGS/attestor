import {
  RUNTIME_SIGNAL_ENVELOPE_VERSION,
  RUNTIME_SIGNAL_KINDS,
  RUNTIME_SIGNAL_SOURCE_TRUST_LEVELS,
  type RuntimeSignalKind,
  type RuntimeSignalSourceTrustLevel,
} from './runtime-signal-envelope.js';

export const RUNTIME_SIGNAL_AUTHORITY_GUARD_VERSION =
  'attestor.runtime-signal-authority-guard.v1';

export const RUNTIME_SIGNAL_AUTHORITY_PROHIBITED_FLAGS = [
  'grantsAuthority',
  'canGrantAuthority',
  'canAdmit',
  'activatesEnforcement',
  'autoEnforce',
  'productionReady',
] as const;
export type RuntimeSignalAuthorityProhibitedFlag =
  typeof RUNTIME_SIGNAL_AUTHORITY_PROHIBITED_FLAGS[number];

export const RUNTIME_SIGNAL_AUTHORITY_ALLOWED_USES = [
  'surface-inventory',
  'auto-context',
  'integration-readiness-review',
  'review-pressure',
  'missing-control-detection',
  'replay-analysis',
  'admission-material-candidate',
  'scope-evidence-review',
  'proof-intake-material',
  'receipt-correlation',
] as const;
export type RuntimeSignalAuthorityAllowedUse =
  typeof RUNTIME_SIGNAL_AUTHORITY_ALLOWED_USES[number];

export const RUNTIME_SIGNAL_AUTHORITY_PROHIBITED_USES = [
  'grant-authority',
  'admit-consequence',
  'activate-enforcement',
  'mark-safe',
  'prove-production-readiness',
  'reduce-customer-gate-requirements',
] as const;
export type RuntimeSignalAuthorityProhibitedUse =
  typeof RUNTIME_SIGNAL_AUTHORITY_PROHIBITED_USES[number];

export const RUNTIME_SIGNAL_AUTHORITY_FINDING_CODES = [
  'signal-kind-invalid',
  'source-trust-level-invalid',
  'proof-trust-without-proof-signal',
  'authority-flag-true',
  'decision-support-flag-invalid',
  'admission-decision-present',
  'safe-status-present',
] as const;
export type RuntimeSignalAuthorityFindingCode =
  typeof RUNTIME_SIGNAL_AUTHORITY_FINDING_CODES[number];

export interface RuntimeSignalAuthorityFinding {
  readonly code: RuntimeSignalAuthorityFindingCode;
  readonly field: string;
  readonly message: string;
}

export interface RuntimeSignalAuthorityBoundaryReport {
  readonly version: typeof RUNTIME_SIGNAL_AUTHORITY_GUARD_VERSION;
  readonly runtimeSignalEnvelopeVersion: typeof RUNTIME_SIGNAL_ENVELOPE_VERSION;
  readonly signalKind: RuntimeSignalKind;
  readonly sourceTrustLevel: RuntimeSignalSourceTrustLevel;
  readonly targetLabel: string;
  readonly allowedUses: readonly RuntimeSignalAuthorityAllowedUse[];
  readonly prohibitedUses: typeof RUNTIME_SIGNAL_AUTHORITY_PROHIBITED_USES;
  readonly findings: readonly RuntimeSignalAuthorityFinding[];
  readonly failClosed: true;
  readonly decisionAuthority: 'none';
  readonly enforcementAuthority: 'none';
  readonly telemetryCanGrantAuthority: false;
  readonly metadataCanMarkSafe: false;
  readonly observationCanAdmit: false;
  readonly canGrantAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly productionReady: false;
  readonly outputIsDecisionSupportOnly: true;
}

export interface RuntimeSignalAuthorityGuardDescriptor {
  readonly version: typeof RUNTIME_SIGNAL_AUTHORITY_GUARD_VERSION;
  readonly runtimeSignalEnvelopeVersion: typeof RUNTIME_SIGNAL_ENVELOPE_VERSION;
  readonly signalKinds: typeof RUNTIME_SIGNAL_KINDS;
  readonly sourceTrustLevels: typeof RUNTIME_SIGNAL_SOURCE_TRUST_LEVELS;
  readonly prohibitedFlags: typeof RUNTIME_SIGNAL_AUTHORITY_PROHIBITED_FLAGS;
  readonly allowedUses: typeof RUNTIME_SIGNAL_AUTHORITY_ALLOWED_USES;
  readonly prohibitedUses: typeof RUNTIME_SIGNAL_AUTHORITY_PROHIBITED_USES;
  readonly findingCodes: typeof RUNTIME_SIGNAL_AUTHORITY_FINDING_CODES;
  readonly failClosed: true;
  readonly metadataCannotMarkSafe: true;
  readonly telemetryCannotGrantAuthority: true;
  readonly observationCannotAdmit: true;
  readonly measurementCannotActivateEnforcement: true;
  readonly canGrantAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly productionReady: false;
  readonly outputIsDecisionSupportOnly: true;
  readonly nonClaims: readonly string[];
}

export interface AssertRuntimeSignalAuthorityBoundaryInput {
  readonly signalKind: RuntimeSignalKind;
  readonly sourceTrustLevel: RuntimeSignalSourceTrustLevel;
  readonly target: object;
  readonly targetLabel?: string | null;
}

const ADMISSION_DECISION_FIELDS = [
  'admissionDecision',
  'executionDecision',
  'gateDecision',
] as const;

const ADMISSION_DECISION_VALUES = new Set([
  'admit',
  'narrow',
  'allow',
  'allowed',
  'approved',
  'execute',
  'proceed',
]);

const SAFE_STATUS_FIELDS = [
  'safe',
  'markedSafe',
  'readyForExecution',
  'executionAllowed',
] as const;

function fieldExists(
  target: Partial<Record<string, unknown>>,
  field: string,
): boolean {
  return Object.prototype.hasOwnProperty.call(target, field);
}

function finding(
  code: RuntimeSignalAuthorityFindingCode,
  field: string,
  message: string,
): RuntimeSignalAuthorityFinding {
  return Object.freeze({ code, field, message });
}

function allowedUsesFor(
  signalKind: RuntimeSignalKind,
): readonly RuntimeSignalAuthorityAllowedUse[] {
  switch (signalKind) {
    case 'declaration':
      return Object.freeze([
        'surface-inventory',
        'auto-context',
        'integration-readiness-review',
      ]);
    case 'observation':
      return Object.freeze([
        'review-pressure',
        'missing-control-detection',
        'replay-analysis',
      ]);
    case 'proposed-action':
      return Object.freeze([
        'admission-material-candidate',
        'scope-evidence-review',
      ]);
    case 'enforcement-proof':
      return Object.freeze([
        'proof-intake-material',
        'receipt-correlation',
      ]);
  }
}

function collectAuthorityFindings(input: {
  readonly signalKind: RuntimeSignalKind;
  readonly sourceTrustLevel: RuntimeSignalSourceTrustLevel;
  readonly target: Partial<Record<string, unknown>>;
}): readonly RuntimeSignalAuthorityFinding[] {
  const findings: RuntimeSignalAuthorityFinding[] = [];

  if (!RUNTIME_SIGNAL_KINDS.includes(input.signalKind)) {
    findings.push(finding(
      'signal-kind-invalid',
      'signalKind',
      'Runtime signal authority guard requires a known signal kind.',
    ));
  }
  if (!RUNTIME_SIGNAL_SOURCE_TRUST_LEVELS.includes(input.sourceTrustLevel)) {
    findings.push(finding(
      'source-trust-level-invalid',
      'sourceTrustLevel',
      'Runtime signal authority guard requires a known source trust level.',
    ));
  }
  if (
    input.sourceTrustLevel === 'enforcement-proof' &&
    input.signalKind !== 'enforcement-proof'
  ) {
    findings.push(finding(
      'proof-trust-without-proof-signal',
      'sourceTrustLevel',
      'Runtime signal authority guard requires proof trust to stay on proof signals.',
    ));
  }

  for (const field of RUNTIME_SIGNAL_AUTHORITY_PROHIBITED_FLAGS) {
    if (input.target[field] === true) {
      findings.push(finding(
        'authority-flag-true',
        field,
        `Runtime signal authority guard does not allow authority upgrade through ${field}.`,
      ));
    }
  }

  if (
    fieldExists(input.target, 'outputIsDecisionSupportOnly') &&
    input.target.outputIsDecisionSupportOnly !== true
  ) {
    findings.push(finding(
      'decision-support-flag-invalid',
      'outputIsDecisionSupportOnly',
      'Runtime signal authority guard requires runtime signal output to remain decision-support only.',
    ));
  }

  for (const field of ADMISSION_DECISION_FIELDS) {
    const value = input.target[field];
    if (
      typeof value === 'string' &&
      ADMISSION_DECISION_VALUES.has(value.trim().toLowerCase())
    ) {
      findings.push(finding(
        'admission-decision-present',
        field,
        `Runtime signal authority guard does not allow ${field} to carry an admission outcome.`,
      ));
    }
  }

  for (const field of SAFE_STATUS_FIELDS) {
    if (input.target[field] === true) {
      findings.push(finding(
        'safe-status-present',
        field,
        `Runtime signal authority guard does not allow metadata or telemetry to mark an action safe through ${field}.`,
      ));
    }
  }

  return Object.freeze(findings);
}

export function assertRuntimeSignalAuthorityBoundary(
  input: AssertRuntimeSignalAuthorityBoundaryInput,
): RuntimeSignalAuthorityBoundaryReport {
  const target = input.target as Partial<Record<string, unknown>>;
  const targetLabel =
    typeof input.targetLabel === 'string' && input.targetLabel.trim().length > 0
      ? input.targetLabel.trim()
      : 'runtime-signal-output';
  const findings = collectAuthorityFindings({
    signalKind: input.signalKind,
    sourceTrustLevel: input.sourceTrustLevel,
    target,
  });

  if (findings.length > 0) {
    const fields = findings.map((entry) => entry.field).join(', ');
    throw new Error(
      `Runtime signal authority guard rejected ${targetLabel}: ${fields}.`,
    );
  }

  return Object.freeze({
    version: RUNTIME_SIGNAL_AUTHORITY_GUARD_VERSION,
    runtimeSignalEnvelopeVersion: RUNTIME_SIGNAL_ENVELOPE_VERSION,
    signalKind: input.signalKind,
    sourceTrustLevel: input.sourceTrustLevel,
    targetLabel,
    allowedUses: allowedUsesFor(input.signalKind),
    prohibitedUses: RUNTIME_SIGNAL_AUTHORITY_PROHIBITED_USES,
    findings,
    failClosed: true,
    decisionAuthority: 'none',
    enforcementAuthority: 'none',
    telemetryCanGrantAuthority: false,
    metadataCanMarkSafe: false,
    observationCanAdmit: false,
    canGrantAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    productionReady: false,
    outputIsDecisionSupportOnly: true,
  });
}

export function runtimeSignalAuthorityGuardDescriptor(): RuntimeSignalAuthorityGuardDescriptor {
  return Object.freeze({
    version: RUNTIME_SIGNAL_AUTHORITY_GUARD_VERSION,
    runtimeSignalEnvelopeVersion: RUNTIME_SIGNAL_ENVELOPE_VERSION,
    signalKinds: RUNTIME_SIGNAL_KINDS,
    sourceTrustLevels: RUNTIME_SIGNAL_SOURCE_TRUST_LEVELS,
    prohibitedFlags: RUNTIME_SIGNAL_AUTHORITY_PROHIBITED_FLAGS,
    allowedUses: RUNTIME_SIGNAL_AUTHORITY_ALLOWED_USES,
    prohibitedUses: RUNTIME_SIGNAL_AUTHORITY_PROHIBITED_USES,
    findingCodes: RUNTIME_SIGNAL_AUTHORITY_FINDING_CODES,
    failClosed: true,
    metadataCannotMarkSafe: true,
    telemetryCannotGrantAuthority: true,
    observationCannotAdmit: true,
    measurementCannotActivateEnforcement: true,
    canGrantAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    productionReady: false,
    outputIsDecisionSupportOnly: true,
    nonClaims: Object.freeze([
      'not-authority',
      'not-admission',
      'not-gate',
      'not-proof-intake',
      'not-production-ready',
    ]),
  });
}
