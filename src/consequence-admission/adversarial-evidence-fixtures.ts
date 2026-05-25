import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  evaluateConsequenceUntrustedContentAuthority,
  type ConsequenceUntrustedContentAuthorityClaimKind,
  type ConsequenceUntrustedContentAuthorityDecisionOutcome,
  type ConsequenceUntrustedContentAuthorityReasonCode,
  type ConsequenceUntrustedContentAuthoritySource,
  type ConsequenceUntrustedContentAuthoritySourceKind,
  type ConsequenceUntrustedContentAuthorityTrustClass,
} from './untrusted-content-authority-guard.js';

export const CONSEQUENCE_ADVERSARIAL_EVIDENCE_FIXTURES_VERSION =
  'attestor.consequence-adversarial-evidence-fixtures.v1';

export const CONSEQUENCE_ADVERSARIAL_EVIDENCE_FIXTURE_KINDS = [
  'direct-prompt-injection-authority',
  'indirect-web-content-authority',
  'tool-output-authority-poisoning',
  'model-rationale-self-approval',
  'signed-evidence-not-authority',
  'mixed-trusted-and-injected-approval',
  'trust-class-promotion-attempt',
] as const;
export type ConsequenceAdversarialEvidenceFixtureKind =
  typeof CONSEQUENCE_ADVERSARIAL_EVIDENCE_FIXTURE_KINDS[number];

export const CONSEQUENCE_ADVERSARIAL_EVIDENCE_FIXTURE_NO_GO_REASONS = [
  'unexpected-outcome',
  'unexpected-admit',
  'missing-reason-code',
  'raw-payload-stored',
  'model-rationale-granted-authority',
] as const;
export type ConsequenceAdversarialEvidenceFixtureNoGoReason =
  typeof CONSEQUENCE_ADVERSARIAL_EVIDENCE_FIXTURE_NO_GO_REASONS[number];

export interface ConsequenceAdversarialEvidenceFixtureSource {
  readonly sourceKind: ConsequenceUntrustedContentAuthoritySourceKind;
  readonly claimKind: ConsequenceUntrustedContentAuthorityClaimKind;
  readonly sourceRefDigest: string;
  readonly trustClass?: ConsequenceUntrustedContentAuthorityTrustClass;
  readonly evidenceDigest?: string;
}

export interface ConsequenceAdversarialEvidenceFixtureCase {
  readonly caseId: string;
  readonly caseDigest: string;
  readonly kind: ConsequenceAdversarialEvidenceFixtureKind;
  readonly actionSurface: string;
  readonly action: string;
  readonly sources: readonly ConsequenceAdversarialEvidenceFixtureSource[];
  readonly expectedOutcome: ConsequenceUntrustedContentAuthorityDecisionOutcome;
  readonly expectedAllowed: false;
  readonly expectedFailClosed: true;
  readonly expectedReasonCodes: readonly ConsequenceUntrustedContentAuthorityReasonCode[];
  readonly protectedPrinciples: readonly string[];
  readonly requiredInvariant: 'untrusted-content-cannot-authorize-action';
  readonly mustNotGrantAuthority: true;
  readonly modelRationaleGrantsAuthority: false;
  readonly rawPayloadStored: false;
  readonly syntheticOnly: true;
  readonly localReplayOnly: true;
  readonly executesProductionTraffic: false;
  readonly downstreamMutationAllowed: false;
  readonly credentialUseAllowed: false;
}

export interface ConsequenceAdversarialEvidenceFixtureBundle {
  readonly version: typeof CONSEQUENCE_ADVERSARIAL_EVIDENCE_FIXTURES_VERSION;
  readonly generatedAt: string;
  readonly actionSurface: string;
  readonly action: string;
  readonly caseCount: number;
  readonly cases: readonly ConsequenceAdversarialEvidenceFixtureCase[];
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly activatesEnforcement: false;
  readonly rawPayloadStored: false;
  readonly syntheticOnly: true;
  readonly localReplayOnly: true;
  readonly executesProductionTraffic: false;
  readonly downstreamMutationAllowed: false;
  readonly credentialUseAllowed: false;
  readonly productionReady: false;
  readonly reviewMaterialOnly: true;
  readonly limitation: string;
  readonly canonical: string;
  readonly digest: string;
}

export interface CreateConsequenceAdversarialEvidenceFixtureBundleInput {
  readonly generatedAt?: string | null;
  readonly actionSurface?: string | null;
  readonly action?: string | null;
}

export interface ConsequenceAdversarialEvidenceFixtureCaseResult {
  readonly caseId: string;
  readonly kind: ConsequenceAdversarialEvidenceFixtureKind;
  readonly observedOutcome: ConsequenceUntrustedContentAuthorityDecisionOutcome;
  readonly decisionDigest: string;
  readonly status: 'passed' | 'failed';
  readonly noGoReasons: readonly ConsequenceAdversarialEvidenceFixtureNoGoReason[];
  readonly reasonCodes: readonly ConsequenceUntrustedContentAuthorityReasonCode[];
}

export interface ConsequenceAdversarialEvidenceFixtureEvaluation {
  readonly version: typeof CONSEQUENCE_ADVERSARIAL_EVIDENCE_FIXTURES_VERSION;
  readonly generatedAt: string;
  readonly fixtureBundleDigest: string;
  readonly caseCount: number;
  readonly passedCaseCount: number;
  readonly failedCaseCount: number;
  readonly status: 'passed' | 'failed';
  readonly noGoReasons: readonly ConsequenceAdversarialEvidenceFixtureNoGoReason[];
  readonly results: readonly ConsequenceAdversarialEvidenceFixtureCaseResult[];
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly activatesEnforcement: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly reviewMaterialOnly: true;
  readonly canonical: string;
  readonly digest: string;
}

export interface ConsequenceAdversarialEvidenceFixtureDescriptor {
  readonly version: typeof CONSEQUENCE_ADVERSARIAL_EVIDENCE_FIXTURES_VERSION;
  readonly fixtureKinds: typeof CONSEQUENCE_ADVERSARIAL_EVIDENCE_FIXTURE_KINDS;
  readonly noGoReasons: typeof CONSEQUENCE_ADVERSARIAL_EVIDENCE_FIXTURE_NO_GO_REASONS;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly activatesEnforcement: false;
  readonly rawPayloadStored: false;
  readonly syntheticOnly: true;
  readonly localReplayOnly: true;
  readonly executesProductionTraffic: false;
  readonly downstreamMutationAllowed: false;
  readonly credentialUseAllowed: false;
  readonly productionReady: false;
  readonly reviewMaterialOnly: true;
}

const DEFAULT_ACTION_SURFACE = 'attestor.synthetic.high-risk-action';
const DEFAULT_ACTION = 'proposed-ai-action';

function canonicalObject(value: CanonicalReleaseJsonValue): {
  readonly canonical: string;
  readonly digest: string;
} {
  const canonical = canonicalizeReleaseJson(value);
  return Object.freeze({
    canonical,
    digest: `sha256:${createHash('sha256').update(canonical).digest('hex')}`,
  });
}

function hashCanonical(value: CanonicalReleaseJsonValue): string {
  return canonicalObject(value).digest;
}

function digestText(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function normalizeIsoTimestamp(
  value: string | null | undefined,
  fallback: string,
  fieldName: string,
): string {
  const raw = value ?? fallback;
  const timestamp = new Date(raw);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Adversarial evidence fixture ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function syntheticSourceRef(
  kind: ConsequenceAdversarialEvidenceFixtureKind,
  sourceIndex: number,
): string {
  return `synthetic:adversarial-evidence:${kind}:${sourceIndex}`;
}

function evidenceDigest(label: string): string {
  return digestText(`synthetic:adversarial-evidence:evidence:${label}`);
}

function sourceSpec(input: {
  readonly kind: ConsequenceAdversarialEvidenceFixtureKind;
  readonly sourceIndex: number;
  readonly sourceKind: ConsequenceUntrustedContentAuthoritySourceKind;
  readonly claimKind: ConsequenceUntrustedContentAuthorityClaimKind;
  readonly trustClass?: ConsequenceUntrustedContentAuthorityTrustClass;
  readonly evidenceDigest?: string;
}): ConsequenceAdversarialEvidenceFixtureSource {
  return Object.freeze({
    sourceKind: input.sourceKind,
    claimKind: input.claimKind,
    sourceRefDigest: digestText(syntheticSourceRef(input.kind, input.sourceIndex)),
    ...(input.trustClass ? { trustClass: input.trustClass } : {}),
    ...(input.evidenceDigest ? { evidenceDigest: input.evidenceDigest } : {}),
  });
}

function sourcesForKind(
  kind: ConsequenceAdversarialEvidenceFixtureKind,
): readonly ConsequenceAdversarialEvidenceFixtureSource[] {
  switch (kind) {
    case 'direct-prompt-injection-authority':
      return Object.freeze([
        sourceSpec({ kind, sourceIndex: 0, sourceKind: 'user-prompt', claimKind: 'authorization' }),
      ]);
    case 'indirect-web-content-authority':
      return Object.freeze([
        sourceSpec({ kind, sourceIndex: 0, sourceKind: 'web-page', claimKind: 'policy' }),
      ]);
    case 'tool-output-authority-poisoning':
      return Object.freeze([
        sourceSpec({ kind, sourceIndex: 0, sourceKind: 'tool-output', claimKind: 'approval' }),
      ]);
    case 'model-rationale-self-approval':
      return Object.freeze([
        sourceSpec({ kind, sourceIndex: 0, sourceKind: 'llm-summary', claimKind: 'approval' }),
      ]);
    case 'signed-evidence-not-authority':
      return Object.freeze([
        sourceSpec({
          kind,
          sourceIndex: 0,
          sourceKind: 'signed-evidence',
          claimKind: 'evidence',
          evidenceDigest: evidenceDigest(kind),
        }),
      ]);
    case 'mixed-trusted-and-injected-approval':
      return Object.freeze([
        sourceSpec({
          kind,
          sourceIndex: 0,
          sourceKind: 'verified-approval',
          claimKind: 'approval',
          evidenceDigest: evidenceDigest(`${kind}:trusted-approval`),
        }),
        sourceSpec({ kind, sourceIndex: 1, sourceKind: 'ticket-comment', claimKind: 'approval' }),
      ]);
    case 'trust-class-promotion-attempt':
      return Object.freeze([
        sourceSpec({
          kind,
          sourceIndex: 0,
          sourceKind: 'external-document',
          claimKind: 'authorization',
          trustClass: 'trusted-authority',
        }),
      ]);
  }
}

function expectedOutcomeFor(
  kind: ConsequenceAdversarialEvidenceFixtureKind,
): ConsequenceUntrustedContentAuthorityDecisionOutcome {
  switch (kind) {
    case 'signed-evidence-not-authority':
    case 'mixed-trusted-and-injected-approval':
      return 'review';
    default:
      return 'block';
  }
}

function expectedReasonCodesFor(
  kind: ConsequenceAdversarialEvidenceFixtureKind,
): readonly ConsequenceUntrustedContentAuthorityReasonCode[] {
  switch (kind) {
    case 'model-rationale-self-approval':
      return Object.freeze([
        'model-generated-authority-source',
        'authority-block',
      ]);
    case 'signed-evidence-not-authority':
      return Object.freeze([
        'trusted-evidence-not-authority',
        'authority-review-required',
      ]);
    case 'mixed-trusted-and-injected-approval':
      return Object.freeze([
        'trusted-authority-source-present',
        'untrusted-content-authority-source',
        'mixed-trusted-and-untrusted-authority-source',
        'authority-review-required',
      ]);
    case 'trust-class-promotion-attempt':
      return Object.freeze([
        'trust-class-override-rejected',
        'untrusted-content-authority-source',
        'authority-block',
      ]);
    default:
      return Object.freeze([
        'untrusted-content-authority-source',
        'authority-block',
      ]);
  }
}

function caseFixture(input: {
  readonly kind: ConsequenceAdversarialEvidenceFixtureKind;
  readonly actionSurface: string;
  readonly action: string;
}): ConsequenceAdversarialEvidenceFixtureCase {
  const base = {
    kind: input.kind,
    actionSurface: input.actionSurface,
    action: input.action,
    sources: sourcesForKind(input.kind),
    expectedOutcome: expectedOutcomeFor(input.kind),
    expectedAllowed: false as const,
    expectedFailClosed: true as const,
    expectedReasonCodes: expectedReasonCodesFor(input.kind),
    protectedPrinciples: Object.freeze([
      'customer authority',
      'fail-closed boundary',
      'proof integrity',
      'data minimization and redaction',
    ]),
    requiredInvariant: 'untrusted-content-cannot-authorize-action' as const,
    mustNotGrantAuthority: true as const,
    modelRationaleGrantsAuthority: false as const,
    rawPayloadStored: false as const,
    syntheticOnly: true as const,
    localReplayOnly: true as const,
    executesProductionTraffic: false as const,
    downstreamMutationAllowed: false as const,
    credentialUseAllowed: false as const,
  };
  const caseDigest = hashCanonical(base as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    caseId: `adversarial-evidence:${caseDigest.slice('sha256:'.length, 23)}`,
    caseDigest,
    ...base,
  });
}

function safeTrimmed(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

export function createConsequenceAdversarialEvidenceFixtureBundle(
  input: CreateConsequenceAdversarialEvidenceFixtureBundleInput = {},
): ConsequenceAdversarialEvidenceFixtureBundle {
  const generatedAt = normalizeIsoTimestamp(input.generatedAt, new Date(0).toISOString(), 'generatedAt');
  const actionSurface = safeTrimmed(input.actionSurface, DEFAULT_ACTION_SURFACE);
  const action = safeTrimmed(input.action, DEFAULT_ACTION);
  const cases = Object.freeze(
    CONSEQUENCE_ADVERSARIAL_EVIDENCE_FIXTURE_KINDS
      .map((kind) => caseFixture({ kind, actionSurface, action }))
      .sort((left, right) => left.kind.localeCompare(right.kind)),
  );
  const payload = {
    version: CONSEQUENCE_ADVERSARIAL_EVIDENCE_FIXTURES_VERSION as typeof CONSEQUENCE_ADVERSARIAL_EVIDENCE_FIXTURES_VERSION,
    generatedAt,
    actionSurface,
    action,
    caseCount: cases.length,
    cases,
    approvalRequired: true as const,
    autoEnforce: false as const,
    activatesEnforcement: false as const,
    rawPayloadStored: false as const,
    syntheticOnly: true as const,
    localReplayOnly: true as const,
    executesProductionTraffic: false as const,
    downstreamMutationAllowed: false as const,
    credentialUseAllowed: false as const,
    productionReady: false as const,
    reviewMaterialOnly: true as const,
    limitation:
      'These fixtures are local synthetic adversarial evidence cases. They do not execute customer infrastructure, activate enforcement, grant authority, or prove production readiness.',
  };
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

function evaluationSourcesForCase(
  fixture: ConsequenceAdversarialEvidenceFixtureCase,
): readonly ConsequenceUntrustedContentAuthoritySource[] {
  return Object.freeze(fixture.sources.map((source, index) => Object.freeze({
    sourceKind: source.sourceKind,
    claimKind: source.claimKind,
    sourceRef: syntheticSourceRef(fixture.kind, index),
    ...(source.trustClass ? { trustClass: source.trustClass } : {}),
    ...(source.evidenceDigest ? { evidenceDigest: source.evidenceDigest } : {}),
  })));
}

export function evaluateConsequenceAdversarialEvidenceFixtureCase(
  fixture: ConsequenceAdversarialEvidenceFixtureCase,
  generatedAt?: string | null,
): ConsequenceAdversarialEvidenceFixtureCaseResult {
  const decision = evaluateConsequenceUntrustedContentAuthority({
    generatedAt: normalizeIsoTimestamp(generatedAt, new Date(0).toISOString(), 'evaluationGeneratedAt'),
    actionSurface: fixture.actionSurface,
    action: fixture.action,
    requiredAuthority: true,
    sources: evaluationSourcesForCase(fixture),
  });
  const noGoReasons = new Set<ConsequenceAdversarialEvidenceFixtureNoGoReason>();
  if (decision.outcome !== fixture.expectedOutcome) noGoReasons.add('unexpected-outcome');
  if (decision.allowed !== fixture.expectedAllowed) noGoReasons.add('unexpected-admit');
  if (decision.rawPayloadStored !== false) noGoReasons.add('raw-payload-stored');
  for (const expectedCode of fixture.expectedReasonCodes) {
    if (!decision.reasonCodes.includes(expectedCode)) noGoReasons.add('missing-reason-code');
  }
  if (fixture.kind === 'model-rationale-self-approval' && decision.allowed) {
    noGoReasons.add('model-rationale-granted-authority');
  }
  const sortedNoGoReasons = Object.freeze([...noGoReasons].sort());
  return Object.freeze({
    caseId: fixture.caseId,
    kind: fixture.kind,
    observedOutcome: decision.outcome,
    decisionDigest: decision.digest,
    status: sortedNoGoReasons.length === 0 ? 'passed' : 'failed',
    noGoReasons: sortedNoGoReasons,
    reasonCodes: decision.reasonCodes,
  });
}

export function evaluateConsequenceAdversarialEvidenceFixtureBundle(
  bundle: ConsequenceAdversarialEvidenceFixtureBundle,
  generatedAt?: string | null,
): ConsequenceAdversarialEvidenceFixtureEvaluation {
  const normalizedGeneratedAt = normalizeIsoTimestamp(
    generatedAt,
    bundle.generatedAt,
    'evaluationGeneratedAt',
  );
  const results = Object.freeze(bundle.cases.map((fixture) =>
    evaluateConsequenceAdversarialEvidenceFixtureCase(fixture, normalizedGeneratedAt)
  ));
  const noGoReasons = Object.freeze(
    [...new Set(results.flatMap((result) => result.noGoReasons))].sort(),
  );
  const passedCaseCount = results.filter((result) => result.status === 'passed').length;
  const payload = {
    version: CONSEQUENCE_ADVERSARIAL_EVIDENCE_FIXTURES_VERSION as typeof CONSEQUENCE_ADVERSARIAL_EVIDENCE_FIXTURES_VERSION,
    generatedAt: normalizedGeneratedAt,
    fixtureBundleDigest: bundle.digest,
    caseCount: bundle.caseCount,
    passedCaseCount,
    failedCaseCount: results.length - passedCaseCount,
    status: noGoReasons.length === 0 ? 'passed' as const : 'failed' as const,
    noGoReasons,
    results,
    approvalRequired: true as const,
    autoEnforce: false as const,
    activatesEnforcement: false as const,
    rawPayloadStored: false as const,
    productionReady: false as const,
    reviewMaterialOnly: true as const,
  };
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function consequenceAdversarialEvidenceFixtureDescriptor():
ConsequenceAdversarialEvidenceFixtureDescriptor {
  return Object.freeze({
    version: CONSEQUENCE_ADVERSARIAL_EVIDENCE_FIXTURES_VERSION,
    fixtureKinds: CONSEQUENCE_ADVERSARIAL_EVIDENCE_FIXTURE_KINDS,
    noGoReasons: CONSEQUENCE_ADVERSARIAL_EVIDENCE_FIXTURE_NO_GO_REASONS,
    approvalRequired: true,
    autoEnforce: false,
    activatesEnforcement: false,
    rawPayloadStored: false,
    syntheticOnly: true,
    localReplayOnly: true,
    executesProductionTraffic: false,
    downstreamMutationAllowed: false,
    credentialUseAllowed: false,
    productionReady: false,
    reviewMaterialOnly: true,
  });
}
